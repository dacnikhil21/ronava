import { getWalletBalances, postLedgerEntry } from './ledger_engine.js';
import { getSetting } from './settings.js';

/**
 * Server-authoritative quote for withdrawal
 * Determines exact fee, net payout, remaining balance, and reserve compliance.
 */
export async function quoteWithdrawal(clientOrPool, {
  userId,
  amountPaise,
  settlementType = 'T1',
  channel = 'pinelabs'
}) {
  if (!clientOrPool || typeof clientOrPool.query !== 'function') {
    throw new Error('DATABASE_CLIENT_REQUIRED: quoteWithdrawal requires a query client.');
  }

  const reqPaise = BigInt(amountPaise);
  if (reqPaise <= 0n) {
    throw new Error('INVALID_WITHDRAWAL_AMOUNT: Amount must be greater than 0 paise.');
  }

  if (!channel || !channel.trim()) {
    throw new Error('CHANNEL_REQUIRED: channel is strictly required for withdrawal.');
  }
  const cleanChannel = channel.trim().toLowerCase();
  const validChannels = ['pinelabs', 'payswiff', 'qr'];
  if (!validChannels.includes(cleanChannel)) {
    throw new Error(`INVALID_CHANNEL: "${channel}" is not allowed. Channel must be one of: pinelabs, payswiff, qr.`);
  }

  // 1. Fetch live balance and reserve requirement
  const balances = await getWalletBalances(clientOrPool, userId);

  // 2. Fetch channel balance directly from financial_ledger
  const channelLedgerRes = await clientOrPool.query(`
    SELECT COALESCE(SUM(amount_paise), 0)::bigint AS channel_balance_paise
    FROM financial_ledger
    WHERE UPPER(user_id) = UPPER($1) AND channel = $2
  `, [userId, cleanChannel]);
  const channelBalancePaise = BigInt(channelLedgerRes.rows[0]?.channel_balance_paise || 0);

  const totalBalancePaise = balances.balance_paise;
  const reserveRequiredPaise = balances.reserve_required_paise;
  const totalAfterReserve = totalBalancePaise > reserveRequiredPaise ? totalBalancePaise - reserveRequiredPaise : 0n;
  const maxWithdrawablePaise = channelBalancePaise > 0n 
    ? (channelBalancePaise < totalAfterReserve ? channelBalancePaise : totalAfterReserve)
    : 0n;

  // 3. Resolve fee basis points from settings table
  const isInstant = settlementType.toUpperCase() === 'INSTANT';
  const settingKey = isInstant ? 'instant_settlement_fee_bps' : 't1_settlement_fee_bps';
  const feeSetting = await getSetting(settingKey, clientOrPool);
  const feeBps = Number(feeSetting.value_numeric || (isInstant ? 150 : 0));

  // 4. Compute fee and net payout
  const feePaise = BigInt(Math.floor((Number(reqPaise) * feeBps) / 10000));
  const netPayoutPaise = reqPaise - feePaise;

  const reserveCompliant = reqPaise <= maxWithdrawablePaise;
  const shortfallPaise = reserveCompliant ? 0n : (reqPaise - maxWithdrawablePaise);

  return {
    user_id: userId,
    requested_amount_paise: reqPaise,
    settlement_type: isInstant ? 'INSTANT' : 'T1',
    channel: cleanChannel,
    channel_balance_paise: channelBalancePaise,
    max_withdrawable_paise: maxWithdrawablePaise,
    fee_bps: feeBps,
    fee_paise: feePaise,
    net_payout_paise: netPayoutPaise,
    remaining_balance_paise: maxWithdrawablePaise > reqPaise ? maxWithdrawablePaise - reqPaise : 0n,
    reserve_required_paise: reserveRequiredPaise,
    reserve_compliant: reserveCompliant,
    shortfall_paise: shortfallPaise
  };
}

/**
 * Process atomic withdrawal request with row-level locking (SELECT ... FOR UPDATE),
 * verified beneficiary check, and idempotency protection.
 */
export async function processWithdrawalRequest(client, {
  merchantId,
  amountPaise,
  beneficiaryId,
  bankName,
  accountNumber,
  ifsc,
  holderName,
  channel = 'pinelabs',
  settlementType = 'T1',
  payoutType = 'REGULAR',
  idempotencyKey = null,
  createdBy = null,
  ...restParams
} = {}) {
  if (!client || typeof client.query !== 'function') {
    throw new Error('DATABASE_CLIENT_REQUIRED: processWithdrawalRequest requires a transaction client.');
  }
  const actor = createdBy || merchantId;
  if (!actor) {
    throw new Error('CALLER_IDENTIFICATION_REQUIRED: merchantId or createdBy is required for processWithdrawalRequest.');
  }

  let cleanPayoutType = (payoutType || 'REGULAR').toString().trim().toUpperCase();
  if (cleanPayoutType !== 'COMMISSION') {
    cleanPayoutType = 'REGULAR';
  }

  // Server-Enforced Commission Lock
  if (cleanPayoutType === 'COMMISSION') {
    const lockRes = await client.query(`SELECT value_numeric FROM system_settings WHERE key = 'commission_payouts_locked'`);
    const isLocked = Number(lockRes.rows[0]?.value_numeric || 0) === 1;
    if (isLocked) {
      throw new Error('COMMISSION_PAYOUTS_LOCKED: Downline commission withdrawals are currently frozen by the administrator.');
    }
  }

  const reqPaise = BigInt(amountPaise);
  if (reqPaise <= 0n) {
    throw new Error('INVALID_WITHDRAWAL_AMOUNT: Withdrawal amount must be greater than 0 paise.');
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

  // 2. Beneficiary Resolution & Auto-Creation (Per Confirmed Business Rule 1: typed accounts usable immediately)
  let beneficiary = null;
  const typedAcc = (accountNumber || restParams.account_number || '').toString().trim();
  const typedIfsc = (ifsc || restParams.ifsc_code || '').toString().trim().toUpperCase();
  const typedBankName = (bankName || restParams.bank_name || 'Bank Account').toString().trim();
  const typedHolder = (holderName || restParams.holder_name || restParams.beneficiary_name || merchantId).toString().trim();

  if (beneficiaryId) {
    const benRes = await client.query(`
      SELECT id, merchant_id, bank_name, account_number, ifsc, holder_name, is_verified 
      FROM beneficiaries 
      WHERE id = $1 AND UPPER(merchant_id) = UPPER($2)
    `, [beneficiaryId, merchantId]);

    if (benRes.rows.length === 0) {
      throw new Error('INVALID_BENEFICIARY: Selected beneficiary is not registered or does not belong to this merchant.');
    }
    beneficiary = benRes.rows[0];
  } else if (typedAcc && typedIfsc) {
    // Check if an identical account already exists for this merchant
    const existingBen = await client.query(`
      SELECT id, merchant_id, bank_name, account_number, ifsc, holder_name, is_verified 
      FROM beneficiaries 
      WHERE UPPER(merchant_id) = UPPER($1) AND account_number = $2 AND UPPER(ifsc) = $3
      LIMIT 1
    `, [merchantId, typedAcc, typedIfsc]);

    if (existingBen.rows.length > 0) {
      beneficiary = existingBen.rows[0];
    } else {
      const newBenId = `BEN-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;
      const benCountRes = await client.query(`SELECT COUNT(*)::int as count FROM beneficiaries WHERE UPPER(merchant_id) = UPPER($1)`, [merchantId]);
      const isFirst = (benCountRes.rows[0]?.count || 0) === 0;

      const newBenRes = await client.query(`
        INSERT INTO beneficiaries (id, merchant_id, bank_name, account_number, ifsc, holder_name, is_verified, is_primary)
        VALUES ($1, $2, $3, $4, $5, $6, true, $7)
        RETURNING id, merchant_id, bank_name, account_number, ifsc, holder_name, is_verified
      `, [newBenId, merchantId, typedBankName, typedAcc, typedIfsc, typedHolder, isFirst]);
      beneficiary = newBenRes.rows[0];
    }
  } else {
    throw new Error('BENEFICIARY_REQUIRED: Please select a saved bank account or enter account number and IFSC.');
  }

  if (!beneficiary || !beneficiary.account_number || !beneficiary.account_number.trim() || !beneficiary.ifsc || !beneficiary.ifsc.trim()) {
    throw new Error('INVALID_BENEFICIARY_DETAILS: Beneficiary missing account number or IFSC.');
  }
  beneficiaryId = beneficiary.id;

  // 3. Row-Level Locking on Wallet (SELECT ... FOR UPDATE prevents race conditions / double-spend)
  const walletLockRes = await client.query(`
    SELECT user_id, balance_paise, held_paise 
    FROM wallets 
    WHERE UPPER(user_id) = UPPER($1) 
    FOR UPDATE
  `, [merchantId]);

  if (walletLockRes.rows.length === 0) {
    throw new Error('WALLET_NOT_FOUND: Merchant wallet not found.');
  }

  if (!channel || !channel.trim()) {
    throw new Error('CHANNEL_REQUIRED: channel is strictly required for withdrawal.');
  }
  const cleanChannel = channel.trim().toLowerCase();
  const validChannels = ['pinelabs', 'payswiff', 'qr'];
  if (!validChannels.includes(cleanChannel)) {
    throw new Error(`INVALID_CHANNEL: "${channel}" is not allowed. Channel must be one of: pinelabs, payswiff, qr.`);
  }

  // 4. Per-channel balance & Shared Reserve validation inside the locked transaction
  const ledgerTotalRes = await client.query(`
    SELECT COALESCE(SUM(amount_paise), 0)::bigint AS ledger_total_balance_paise
    FROM financial_ledger
    WHERE UPPER(user_id) = UPPER($1)
  `, [merchantId]);
  const ledgerTotalBalancePaise = BigInt(ledgerTotalRes.rows[0]?.ledger_total_balance_paise || 0);
  const walletCachedBalancePaise = BigInt(walletLockRes.rows[0].balance_paise || 0);

  if (ledgerTotalBalancePaise !== walletCachedBalancePaise) {
    throw new Error(
      `LEDGER_WALLET_DISCREPANCY: Financial ledger total (${ledgerTotalBalancePaise} paise) does not match wallet cache (${walletCachedBalancePaise} paise) for user "${merchantId}". Reconciliation required.`
    );
  }

  const channelLedgerRes = await client.query(`
    SELECT COALESCE(SUM(amount_paise), 0)::bigint AS channel_balance_paise
    FROM financial_ledger
    WHERE UPPER(user_id) = UPPER($1) AND channel = $2
  `, [merchantId, cleanChannel]);
  const channelBalancePaise = BigInt(channelLedgerRes.rows[0]?.channel_balance_paise || 0);

  const totalBalancePaise = ledgerTotalBalancePaise;

  if (totalBalancePaise < 0n || channelBalancePaise < 0n) {
    const owedPaise = totalBalancePaise < 0n ? -totalBalancePaise : -channelBalancePaise;
    const formattedOwed = (Number(owedPaise) / 100).toLocaleString('en-IN', {
      minimumFractionDigits: (Number(owedPaise) % 100 === 0) ? 0 : 2,
      maximumFractionDigits: 2
    });
    throw new Error(`Your account has a negative balance (Amount owed: Rs ${formattedOwed}). Withdrawals are blocked until this amount is cleared.`);
  }

  const reserveSetting = await getSetting('reserve_amount_paise', client);
  const reserveRequiredPaise = BigInt(reserveSetting.value_numeric || 50000); // 50,000 paise = Rs 500

  // The most withdrawable from channel C = max(0, min(balance of C, total of all channels - 500)).
  const totalAfterReserve = totalBalancePaise > reserveRequiredPaise ? totalBalancePaise - reserveRequiredPaise : 0n;
  const maxWithdrawablePaise = channelBalancePaise > 0n
    ? (channelBalancePaise < totalAfterReserve ? channelBalancePaise : totalAfterReserve)
    : 0n;

  if (reqPaise > maxWithdrawablePaise) {
    const formattedMax = (Number(maxWithdrawablePaise) / 100).toLocaleString('en-IN', {
      minimumFractionDigits: (Number(maxWithdrawablePaise) % 100 === 0) ? 0 : 2,
      maximumFractionDigits: 2
    });
    throw new Error(`You can withdraw at most Rs ${formattedMax}.`);
  }

  // 5. Quote fee and net payout
  const quote = await quoteWithdrawal(client, {
    userId: merchantId,
    amountPaise: reqPaise,
    settlementType,
    channel
  });

  const withdrawalId = `WTH-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

  // 6. Post withdrawal hold in financial ledger & update wallet
  await postLedgerEntry(client, {
    userId: merchantId,
    type: 'withdrawal_hold',
    amountPaise: -reqPaise, // Signed negative debit
    referenceId: withdrawalId,
    referenceType: 'WITHDRAWAL',
    channel,
    metadata: {
      beneficiary_id: beneficiary.id,
      bank_name: beneficiary.bank_name,
      account_number_masked: beneficiary.account_number.slice(-4),
      ifsc: beneficiary.ifsc,
      fee_paise: quote.fee_paise.toString(),
      net_payout_paise: quote.net_payout_paise.toString(),
      settlement_type: quote.settlement_type
    },
    createdBy: actor
  });

  // 7. Insert withdrawal record
  const amountRupees = (Number(reqPaise) / 100).toFixed(2);
  await client.query(`
    INSERT INTO withdrawals (
      id, merchant_id, amount_paise, amount, fee_paise, net_payout_paise,
      beneficiary_id, channel, settlement_type, payout_type, status, created_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'PENDING', NOW())
  `, [
    withdrawalId,
    merchantId,
    reqPaise.toString(),
    amountRupees,
    quote.fee_paise.toString(),
    quote.net_payout_paise.toString(),
    beneficiary.id,
    channel,
    quote.settlement_type,
    cleanPayoutType
  ]);

  const result = {
    id: withdrawalId,
    merchant_id: merchantId,
    amount_paise: reqPaise.toString(),
    amount: amountRupees,
    fee_paise: quote.fee_paise.toString(),
    net_payout_paise: quote.net_payout_paise.toString(),
    beneficiary_id: beneficiary.id,
    channel,
    settlement_type: quote.settlement_type,
    withdrawal_mode: quote.settlement_type,
    payout_type: cleanPayoutType,
    status: 'PENDING'
  };

  // 8. Store Idempotency Key
  if (idempotencyKey) {
    await client.query(`
      INSERT INTO idempotency_keys (key, endpoint, response_code, response_body, created_at)
      VALUES ($1, $2, 200, $3, NOW())
      ON CONFLICT (key) DO NOTHING
    `, [idempotencyKey, '/api/withdrawals/request', JSON.stringify(result)]);
  }

  return result;
}
