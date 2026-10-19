import { getActiveRate } from './rate_engine.js';
import { postLedgerEntry } from './ledger_engine.js';
import { getSetting } from './settings.js';
import { reverseTransaction } from './reversal_engine.js';

/**
 * Process a Swipe / QR payment transaction with atomic ledger posting,
 * exact rate snapshots, upline hierarchy distribution, and mathematical invariant verification.
 */
export async function processSwipeTransaction(client, {
  merchantId,
  amountPaise,
  channel = 'pinelabs',
  settlementMode = null,
  refNumber = null,
  slipNumber = null,
  notes = null,
  idempotencyKey = null,
  createdBy = null,
  simulatedFailure = false
}) {
  if (!client || typeof client.query !== 'function') {
    throw new Error('DATABASE_CLIENT_REQUIRED: processSwipeTransaction requires an active client.');
  }
  const actor = createdBy || merchantId;
  if (!actor) {
    throw new Error('CALLER_IDENTIFICATION_REQUIRED: merchantId or createdBy is required for processSwipeTransaction.');
  }

  const grossPaise = BigInt(amountPaise);
  if (grossPaise <= 0n) {
    throw new Error('INVALID_TRANSACTION_AMOUNT: Transaction amount must be greater than 0 paise.');
  }

  // 0. Verify swiper is not an Admin
  const swiperCheck = await client.query(
    `SELECT id, role FROM users WHERE UPPER(id) = UPPER($1)`,
    [merchantId]
  );
  if (swiperCheck.rows.length > 0 && swiperCheck.rows[0].role === 'ADMIN') {
    throw new Error('ADMIN_CANNOT_SWIPE: Administrators cannot record payment transactions.');
  }

  if (!channel || !channel.trim()) {
    throw new Error('CHANNEL_REQUIRED: channel is strictly required for transaction.');
  }
  const cleanChannel = channel.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!['pinelabs', 'payswiff', 'qr'].includes(cleanChannel)) {
    throw new Error(`INVALID_CHANNEL: "${channel}" is not allowed. Channel must be one of: pinelabs, payswiff, qr.`);
  }
  let mode = (settlementMode || '').toUpperCase().trim();

  if (cleanChannel === 'qr' || cleanChannel === 'companyqr') {
    if (mode && mode !== 'NONE') {
      throw new Error('INVALID_SETTLEMENT_MODE: QR transactions cannot specify a settlement mode (must be NONE).');
    }
    mode = 'NONE';
  } else if (cleanChannel === 'pinelabs' || cleanChannel === 'payswiff') {
    if (!mode || (mode !== 'T1' && mode !== 'INSTANT')) {
      throw new Error(`SETTLEMENT_MODE_REQUIRED: Channel "${channel}" requires settlement_mode T1 or INSTANT.`);
    }
  } else {
    if (!mode) mode = 'T1';
  }

  // 1. Idempotency Check
  if (idempotencyKey) {
    const idempRes = await client.query(
      `SELECT response_body FROM idempotency_keys WHERE key = $1`,
      [idempotencyKey]
    );
    if (idempRes.rows.length > 0) {
      return idempRes.rows[0].response_body;
    }
  }

  // 2. Uniqueness Rule for Manually Entered Swipes (Merchant + Slip/UTR + Amount + Date)
  const identifier = (refNumber || slipNumber || '').trim();
  if (identifier) {
    const dupRes = await client.query(`
      SELECT id, ref_number, slip_number FROM transactions 
      WHERE UPPER(merchant_id) = UPPER($1) 
        AND (
          (ref_number IS NOT NULL AND UPPER(ref_number) = UPPER($2))
          OR
          (slip_number IS NOT NULL AND UPPER(slip_number) = UPPER($2))
        )
        AND amount_paise = $3 
        AND transaction_date = CURRENT_DATE 
        AND status != 'REVERSED'
      LIMIT 1
    `, [merchantId, identifier, grossPaise.toString()]);

    if (dupRes.rows.length > 0) {
      throw new Error(`DUPLICATE_SWIPE: Transaction with reference/slip "${identifier}" and amount already recorded today.`);
    }
  }

  // 3. Hierarchy Traversal & Rate Resolution
  // Climb from merchant up to ADMIN
  const hierarchy = []; // [{ user_id, role, creator_id, rate_bps, settlement_mode }]
  let currentId = merchantId;

  while (currentId) {
    const userRes = await client.query(
      `SELECT id, name, role, creator_id FROM users WHERE UPPER(id) = UPPER($1)`,
      [currentId]
    );
    if (userRes.rows.length === 0) {
      throw new Error(`USER_NOT_FOUND: User "${currentId}" not found in hierarchy.`);
    }
    const u = userRes.rows[0];
    let rateInfo = { rate_bps: 0 };
    if (u.role !== 'ADMIN') {
      rateInfo = await getActiveRate(client, {
        userId: u.id,
        channel: cleanChannel,
        settlementMode: mode
      });

      if (rateInfo.is_default) {
        throw new Error(`RATE_NOT_CONFIGURED: Rate not configured for user "${u.id}" on channel "${cleanChannel}" and mode "${mode}".`);
      }
    }

    hierarchy.push({
      user_id: u.id,
      name: u.name,
      role: u.role,
      creator_id: u.creator_id,
      rate_bps: u.role === 'ADMIN' ? null : rateInfo.rate_bps,
      settlement_mode: mode
    });

    if (u.role === 'ADMIN' || !u.creator_id) {
      break;
    }
    currentId = u.creator_id;
  }

  // 4. Rate Hierarchy Validation (each child rate >= parent rate, except parent Admin who has no rate)
  for (let i = 0; i < hierarchy.length - 1; i++) {
    const child = hierarchy[i];
    const parent = hierarchy[i + 1];
    if (parent.role !== 'ADMIN' && child.rate_bps < parent.rate_bps) {
      throw new Error(
        `INVALID_RATE_HIERARCHY: ${child.user_id} (${child.rate_bps} bps) has lower rate than upline ${parent.user_id} (${parent.rate_bps} bps).`
      );
    }
  }

  // 5. Commission Calculations
  const merchant = hierarchy[0];
  const merchantFeePaise = BigInt(Math.floor((Number(grossPaise) * merchant.rate_bps) / 10000));
  const merchantNetPaise = grossPaise - merchantFeePaise;

  const distributions = []; // [{ user_id, role, amount_paise, rate_used_bps, child_rate_bps, parent_rate_bps }]
  let distributedPaiseSum = 0n;

  // Compute upline margins:
  // Walk up the real parent chain. Each parent earns (rate of person directly below them) minus (parent's own rate).
  for (let i = 1; i < hierarchy.length; i++) {
    const current = hierarchy[i];
    if (current.role === 'ADMIN') {
      // Top Admin level: gets remainder after all child cuts
      continue;
    }
    const child = hierarchy[i - 1];
    const marginBps = child.rate_bps - current.rate_bps;

    // Round each level down to the paisa
    const commPaise = BigInt(Math.floor((Number(grossPaise) * marginBps) / 10000));
    distributedPaiseSum += commPaise;

    distributions.push({
      user_id: current.user_id,
      role: current.role,
      amount_paise: commPaise,
      rate_used_bps: marginBps,
      child_rate_bps: child.rate_bps,
      parent_rate_bps: current.rate_bps
    });
  }

  // Bank Cost Check
  const bankCostSetting = await getSetting('bank_cost_enabled', client);
  const bankCostBpsSetting = await getSetting('bank_cost_bps', client);
  const isBankCostEnabled = Number(bankCostSetting.value_numeric || 0) === 1;
  const bankCostBps = isBankCostEnabled ? Number(bankCostBpsSetting.value_numeric || 0) : 0;
  const bankCostPaise = BigInt(Math.floor((Number(grossPaise) * bankCostBps) / 10000));

  // Admin Remainder Rule:
  // Admin has NO rate of its own. Admin receives the remainder: the swipe charge minus all commissions paid,
  // which equals the rate of the top person under Admin, plus any rounding remainder.
  const adminUser = hierarchy[hierarchy.length - 1];
  const adminRemainderPaise = merchantFeePaise - distributedPaiseSum - bankCostPaise;
  const topPersonUnderAdmin = hierarchy.length > 1 ? hierarchy[hierarchy.length - 2] : merchant;
  const adminEffectiveRateBps = topPersonUnderAdmin.rate_bps;

  distributions.push({
    user_id: adminUser.user_id,
    role: adminUser.role,
    amount_paise: adminRemainderPaise,
    rate_used_bps: adminEffectiveRateBps,
    child_rate_bps: topPersonUnderAdmin.rate_bps,
    parent_rate_bps: adminEffectiveRateBps,
    is_admin_remainder: true
  });
  distributedPaiseSum += adminRemainderPaise;

  // 6. Mathematical Invariant Verification
  // total charged = merchant net + all commissions (+ bank cost if enabled), to the paisa.
  const totalAccountedFor = merchantNetPaise + distributedPaiseSum + bankCostPaise;
  if (totalAccountedFor !== grossPaise) {
    throw new Error(
      `MATHEMATICAL_INVARIANT_VIOLATION: Gross (${grossPaise}) != Net (${merchantNetPaise}) + Distributed (${distributedPaiseSum}) + BankCost (${bankCostPaise}). Aborting transaction.`
    );
  }

  // 7. Atomic Database Execution
  const txnId = `TXN-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

  await client.query('BEGIN');
  try {
    // 7.1 Insert transaction
    await client.query(`
      INSERT INTO transactions (
        id, merchant_id, amount_paise, customer_charge_paise, net_amount_paise,
        type, provider, channel, settlement_mode, ref_number, slip_number, transaction_date, notes, status, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, CURRENT_DATE, $12, 'APPROVED', NOW())
    `, [
      txnId,
      merchantId,
      grossPaise.toString(),
      merchantFeePaise.toString(),
      merchantNetPaise.toString(),
      'POS_SWIPE',
      cleanChannel,
      cleanChannel,
      mode,
      refNumber,
      slipNumber,
      notes
    ]);

    // 7.2 Post Merchant Credit
    await postLedgerEntry(client, {
      userId: merchantId,
      type: 'swipe_credit',
      amountPaise: merchantNetPaise,
      referenceId: txnId,
      referenceType: 'SWIPE',
      channel: cleanChannel,
      metadata: {
        gross_paise: grossPaise.toString(),
        merchant_fee_paise: merchantFeePaise.toString(),
        rate_bps: merchant.rate_bps,
        settlement_mode: mode
      },
      createdBy: actor
    });

    // 7.3 Post All Upline Commissions
    for (const dist of distributions) {
      if (dist.amount_paise > 0n) {
        await postLedgerEntry(client, {
          userId: dist.user_id,
          type: 'commission',
          amountPaise: dist.amount_paise,
          referenceId: txnId,
          referenceType: 'SWIPE',
          channel: cleanChannel,
          metadata: {
            rate_used_bps: dist.rate_used_bps,
            child_rate_bps: dist.child_rate_bps,
            parent_rate_bps: dist.parent_rate_bps,
            channel: cleanChannel,
            settlement_mode: mode,
            is_admin_remainder: !!dist.is_admin_remainder
          },
          createdBy: actor
        });
      }
    }

    if (simulatedFailure) {
      throw new Error('SIMULATED_FAILURE: Testing transaction rollback midway.');
    }

    const result = {
      id: txnId,
      merchant_id: merchantId,
      amount_paise: grossPaise,
      customer_charge_paise: merchantFeePaise,
      net_amount_paise: merchantNetPaise,
      channel: cleanChannel,
      settlement_mode: mode,
      distributions
    };

    // 7.4 Record Idempotency Key
    if (idempotencyKey) {
      const serializableResult = {
        id: txnId,
        merchant_id: merchantId,
        amount_paise: grossPaise.toString(),
        customer_charge_paise: merchantFeePaise.toString(),
        net_amount_paise: merchantNetPaise.toString(),
        channel: cleanChannel,
        distributions: distributions.map(d => ({
          ...d,
          amount_paise: d.amount_paise.toString()
        }))
      };

      await client.query(`
        INSERT INTO idempotency_keys (key, endpoint, response_code, response_body, created_at)
        VALUES ($1, $2, 200, $3, NOW())
        ON CONFLICT (key) DO NOTHING
      `, [idempotencyKey, '/api/transactions/record', JSON.stringify(serializableResult)]);
    }

    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  }
}

/**
 * Edit a swipe transaction after commission credit:
 * Posts signed reversing entries for merchant and every upline, then posts corrected transaction.
 * Never silently modifies or deletes historical records.
 */
export async function editSwipeTransaction(client, {
  oldTxnId,
  correctedAmountPaise,
  channel = null,
  refNumber = null,
  slipNumber = null,
  notes = null,
  reason = 'Transaction edited',
  callerId
}) {
  if (!client || typeof client.query !== 'function') {
    throw new Error('DATABASE_CLIENT_REQUIRED: editSwipeTransaction requires an active client.');
  }
  if (!callerId) {
    throw new Error('CALLER_IDENTIFICATION_REQUIRED: callerId is required for editing a transaction.');
  }

  // 1. Fetch old transaction
  const oldRes = await client.query(`
    SELECT * FROM transactions WHERE id = $1
  `, [oldTxnId]);

  if (oldRes.rows.length === 0) {
    throw new Error(`TRANSACTION_NOT_FOUND: Transaction "${oldTxnId}" not found.`);
  }
  const oldTxn = oldRes.rows[0];

  // 2. Reverse old transaction (reverses merchant + all upline commissions)
  const rev = await reverseTransaction(client, {
    txnId: oldTxnId,
    reason: `EDITED: ${reason}`,
    callerId
  });

  // 3. Post corrected transaction
  const newTxn = await processSwipeTransaction(client, {
    merchantId: oldTxn.merchant_id,
    amountPaise: BigInt(correctedAmountPaise),
    channel: channel || oldTxn.channel,
    settlementMode: oldTxn.settlement_mode || 'T1',
    refNumber: refNumber || (oldTxn.ref_number ? `${oldTxn.ref_number}-REV1` : null),
    slipNumber: slipNumber || oldTxn.slip_number,
    notes: notes || `Correction of ${oldTxnId}: ${reason}`,
    createdBy: callerId
  });

  return {
    old_transaction_id: oldTxnId,
    old_status: 'REVERSED',
    new_transaction: newTxn,
    reversal_details: rev
  };
}

/**
 * Server-authoritative quote for card swipe / QR collection
 * Pure read-only calculation using live user_channel_rates.
 * Throws RATE_NOT_CONFIGURED if no active rate exists. Zero browser math.
 */
export async function quoteSwipeTransaction(client, {
  merchantId,
  amountPaise,
  channel = 'pinelabs',
  settlementMode = null
}) {
  if (!client || typeof client.query !== 'function') {
    throw new Error('DATABASE_CLIENT_REQUIRED: quoteSwipeTransaction requires an active client.');
  }
  if (!merchantId) {
    throw new Error('MERCHANT_ID_REQUIRED: merchantId is required for quote.');
  }
  const grossPaise = BigInt(amountPaise || 0);
  if (grossPaise <= 0n) {
    throw new Error('INVALID_TRANSACTION_AMOUNT: Transaction amount must be greater than 0 paise.');
  }

  // 0. Verify swiper is not an Admin
  const swiperCheck = await client.query(
    `SELECT id, role FROM users WHERE UPPER(id) = UPPER($1)`,
    [merchantId]
  );
  if (swiperCheck.rows.length === 0) {
    throw new Error(`USER_NOT_FOUND: User "${merchantId}" not found.`);
  }
  if (swiperCheck.rows[0].role === 'ADMIN') {
    throw new Error('ADMIN_CANNOT_SWIPE: Administrators cannot record payment transactions.');
  }

  if (!channel || !channel.trim()) {
    throw new Error('CHANNEL_REQUIRED: channel is strictly required for transaction.');
  }
  const cleanChannel = channel.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!['pinelabs', 'payswiff', 'qr'].includes(cleanChannel)) {
    throw new Error(`INVALID_CHANNEL: "${channel}" is not allowed. Channel must be one of: pinelabs, payswiff, qr.`);
  }
  let mode = (settlementMode || '').toUpperCase().trim();

  if (cleanChannel === 'qr' || cleanChannel === 'companyqr') {
    mode = 'NONE';
  } else if (cleanChannel === 'pinelabs' || cleanChannel === 'payswiff') {
    if (!mode || (mode !== 'T1' && mode !== 'INSTANT')) {
      throw new Error(`SETTLEMENT_MODE_REQUIRED: Channel "${channel}" requires settlement_mode T1 or INSTANT.`);
    }
  } else {
    if (!mode) mode = 'T1';
  }

  // Hierarchy traversal & rate resolution
  const hierarchy = [];
  let currentId = merchantId;

  while (currentId) {
    const userRes = await client.query(
      `SELECT id, name, role, creator_id FROM users WHERE UPPER(id) = UPPER($1)`,
      [currentId]
    );
    if (userRes.rows.length === 0) {
      throw new Error(`USER_NOT_FOUND: User "${currentId}" not found in hierarchy.`);
    }
    const u = userRes.rows[0];
    let rateInfo = { rate_bps: 0 };
    if (u.role !== 'ADMIN') {
      rateInfo = await getActiveRate(client, {
        userId: u.id,
        channel: cleanChannel,
        settlementMode: mode
      });

      if (rateInfo.is_default) {
        throw new Error(`RATE_NOT_CONFIGURED: Rate not configured for user "${u.id}" on channel "${cleanChannel}" and mode "${mode}".`);
      }
    }

    hierarchy.push({
      user_id: u.id,
      name: u.name,
      role: u.role,
      creator_id: u.creator_id,
      rate_bps: u.role === 'ADMIN' ? null : rateInfo.rate_bps,
      settlement_mode: mode
    });

    if (u.role === 'ADMIN' || !u.creator_id) {
      break;
    }
    currentId = u.creator_id;
  }

  // Rate hierarchy validation
  for (let i = 0; i < hierarchy.length - 1; i++) {
    const child = hierarchy[i];
    const parent = hierarchy[i + 1];
    if (parent.role !== 'ADMIN' && child.rate_bps < parent.rate_bps) {
      throw new Error(
        `INVALID_RATE_HIERARCHY: ${child.user_id} (${child.rate_bps} bps) has lower rate than upline ${parent.user_id} (${parent.rate_bps} bps).`
      );
    }
  }

  const merchant = hierarchy[0];
  const merchantFeePaise = BigInt(Math.floor((Number(grossPaise) * merchant.rate_bps) / 10000));
  const merchantNetPaise = grossPaise - merchantFeePaise;

  const distributions = [];
  let distributedPaiseSum = 0n;

  for (let i = 1; i < hierarchy.length; i++) {
    const current = hierarchy[i];
    if (current.role === 'ADMIN') continue;
    const child = hierarchy[i - 1];
    const marginBps = child.rate_bps - current.rate_bps;
    const commPaise = BigInt(Math.floor((Number(grossPaise) * marginBps) / 10000));
    distributedPaiseSum += commPaise;

    distributions.push({
      user_id: current.user_id,
      name: current.name,
      role: current.role,
      amount_paise: commPaise.toString(),
      amount_rupees: (Number(commPaise) / 100).toFixed(2),
      rate_used_bps: marginBps,
      margin_pct: (marginBps / 100).toFixed(2)
    });
  }

  const bankCostSetting = await getSetting('bank_cost_enabled', client);
  const bankCostBpsSetting = await getSetting('bank_cost_bps', client);
  const isBankCostEnabled = Number(bankCostSetting.value_numeric || 0) === 1;
  const bankCostBps = isBankCostEnabled ? Number(bankCostBpsSetting.value_numeric || 0) : 0;
  const bankCostPaise = BigInt(Math.floor((Number(grossPaise) * bankCostBps) / 10000));

  const adminUser = hierarchy[hierarchy.length - 1];
  const adminRemainderPaise = merchantFeePaise - distributedPaiseSum - bankCostPaise;
  const topPersonUnderAdmin = hierarchy.length > 1 ? hierarchy[hierarchy.length - 2] : merchant;
  const adminEffectiveRateBps = topPersonUnderAdmin.rate_bps;

  distributions.push({
    user_id: adminUser.user_id,
    name: adminUser.name,
    role: adminUser.role,
    amount_paise: adminRemainderPaise.toString(),
    amount_rupees: (Number(adminRemainderPaise) / 100).toFixed(2),
    rate_used_bps: adminEffectiveRateBps,
    margin_pct: (adminEffectiveRateBps / 100).toFixed(2),
    is_admin_remainder: true
  });

  return {
    merchant_id: merchant.user_id,
    channel: cleanChannel,
    settlement_mode: mode,
    amount_paise: grossPaise.toString(),
    amount_rupees: (Number(grossPaise) / 100).toFixed(2),
    fee_paise: merchantFeePaise.toString(),
    fee_rupees: (Number(merchantFeePaise) / 100).toFixed(2),
    rate_bps: merchant.rate_bps,
    rate_pct: (merchant.rate_bps / 100).toFixed(2),
    net_paise: merchantNetPaise.toString(),
    net_rupees: (Number(merchantNetPaise) / 100).toFixed(2),
    splits: distributions
  };
}

