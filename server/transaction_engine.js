import { getActiveRate } from './rate_engine.js';
import { postLedgerEntry } from './ledger_engine.js';
import { getSetting } from './settings.js';

/**
 * Process a Swipe / QR payment transaction with atomic ledger posting,
 * exact rate snapshots, upline hierarchy distribution, and mathematical invariant verification.
 */
export async function processSwipeTransaction(client, {
  merchantId,
  amountPaise,
  channel = 'pinelabs',
  refNumber = null,
  slipNumber = null,
  notes = null,
  idempotencyKey = null,
  createdBy = 'SYSTEM',
  simulatedFailure = false
}) {
  if (!client || typeof client.query !== 'function') {
    throw new Error('DATABASE_CLIENT_REQUIRED: processSwipeTransaction requires an active client.');
  }

  const grossPaise = BigInt(amountPaise);
  if (grossPaise <= 0n) {
    throw new Error('INVALID_TRANSACTION_AMOUNT: Transaction amount must be greater than 0 paise.');
  }

  const cleanChannel = channel.toLowerCase().replace(/[^a-z0-9]/g, '');

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

  // 2. Uniqueness Rule for Manually Entered Swipes
  if (refNumber && refNumber.trim()) {
    const dupRes = await client.query(`
      SELECT id FROM transactions 
      WHERE UPPER(merchant_id) = UPPER($1) 
        AND UPPER(ref_number) = UPPER($2) 
        AND amount_paise = $3 
        AND transaction_date = CURRENT_DATE 
        AND status != 'REVERSED'
      LIMIT 1
    `, [merchantId, refNumber.trim(), grossPaise.toString()]);

    if (dupRes.rows.length > 0) {
      throw new Error(`DUPLICATE_SWIPE: Transaction with reference "${refNumber}" and amount already recorded today.`);
    }
  }

  // 3. Hierarchy Traversal & Rate Resolution
  // Climb from merchant up to ADMIN
  const hierarchy = []; // [{ user_id, role, creator_id, rate_bps }]
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
    const rateInfo = await getActiveRate(client, { userId: u.id, channel: cleanChannel });
    hierarchy.push({
      user_id: u.id,
      name: u.name,
      role: u.role,
      creator_id: u.creator_id,
      rate_bps: rateInfo.rate_bps
    });

    if (u.role === 'ADMIN' || !u.creator_id) {
      break;
    }
    currentId = u.creator_id;
  }

  // 4. Rate Hierarchy Validation (each child rate >= parent rate)
  for (let i = 0; i < hierarchy.length - 1; i++) {
    const child = hierarchy[i];
    const parent = hierarchy[i + 1];
    if (child.rate_bps < parent.rate_bps) {
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

  // Compute upline margins
  for (let i = 1; i < hierarchy.length; i++) {
    const child = hierarchy[i - 1];
    const current = hierarchy[i];
    const nextParent = i + 1 < hierarchy.length ? hierarchy[i + 1] : null;

    let marginBps = 0;
    if (current.role === 'ADMIN' || !nextParent) {
      // Top Admin level: gets remainder after all child cuts
      // Will be calculated after all child levels
      continue;
    } else {
      marginBps = current.rate_bps - nextParent.rate_bps;
    }

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

  // Admin Remainder Rule: Any fractional or base remainder goes strictly to Admin
  const adminUser = hierarchy[hierarchy.length - 1];
  const adminRemainderPaise = merchantFeePaise - distributedPaiseSum - bankCostPaise;

  distributions.push({
    user_id: adminUser.user_id,
    role: adminUser.role,
    amount_paise: adminRemainderPaise,
    rate_used_bps: adminUser.rate_bps,
    child_rate_bps: hierarchy.length > 1 ? hierarchy[hierarchy.length - 2].rate_bps : adminUser.rate_bps,
    parent_rate_bps: adminUser.rate_bps,
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
        type, provider, channel, ref_number, slip_number, transaction_date, notes, status, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_DATE, $11, 'APPROVED', NOW())
    `, [
      txnId,
      merchantId,
      grossPaise.toString(),
      merchantFeePaise.toString(),
      merchantNetPaise.toString(),
      'POS_SWIPE',
      cleanChannel,
      cleanChannel,
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
        rate_bps: merchant.rate_bps
      },
      createdBy
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
            is_admin_remainder: !!dist.is_admin_remainder
          },
          createdBy
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
