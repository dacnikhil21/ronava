import { getSetting } from './settings.js';

const ALLOWED_LEDGER_TYPES = new Set([
  'swipe_credit',
  'commission',
  'withdrawal_hold',
  'withdrawal_paid',
  'withdrawal_reversal',
  'reserve',
  'fee',
  'adjustment',
  'refund'
]);

/**
 * Post an append-only entry to financial_ledger and atomically update the wallet cache.
 * Must be executed within an active database transaction client.
 */
export async function postLedgerEntry(client, {
  userId,
  type,
  amountPaise,
  referenceId = null,
  referenceType = null,
  channel = null,
  metadata = {},
  createdBy = 'SYSTEM'
}) {
  if (!client || typeof client.query !== 'function') {
    throw new Error('DATABASE_CLIENT_REQUIRED: postLedgerEntry requires an active transaction client.');
  }
  if (!userId) {
    throw new Error('INVALID_ARGUMENT: userId is required for ledger entry.');
  }
  if (!ALLOWED_LEDGER_TYPES.has(type)) {
    throw new Error(`INVALID_LEDGER_TYPE: "${type}" is not a valid ledger entry type.`);
  }

  // Ensure amount is handled as BigInt paise
  const amount = BigInt(amountPaise);

  // 1. Insert into append-only financial_ledger
  const insertSql = `
    INSERT INTO financial_ledger (
      user_id, type, amount_paise, reference_id, reference_type, channel, metadata, created_by, created_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
    RETURNING id, user_id, type, amount_paise, reference_id, reference_type, channel, metadata, created_by, created_at
  `;
  const res = await client.query(insertSql, [
    userId,
    type,
    amount.toString(),
    referenceId,
    referenceType,
    channel,
    JSON.stringify(metadata),
    createdBy
  ]);
  const ledgerRow = res.rows[0];

  // 2. Atomically update wallet cached balance in the SAME transaction
  await client.query(`
    INSERT INTO wallets (user_id, balance_paise, held_paise, total_sales_paise, withdrawn_paise, updated_at)
    VALUES ($1, $2, 0, 0, 0, NOW())
    ON CONFLICT (user_id) DO UPDATE SET
      balance_paise = wallets.balance_paise + $2,
      updated_at = NOW()
  `, [userId, amount.toString()]);

  return ledgerRow;
}

/**
 * Calculate comprehensive authoritative balance from database
 */
export async function getWalletBalances(clientOrPool, userId) {
  if (!clientOrPool || typeof clientOrPool.query !== 'function') {
    throw new Error('DATABASE_CLIENT_REQUIRED: getWalletBalances requires a query client/pool.');
  }
  if (!userId) {
    throw new Error('INVALID_ARGUMENT: userId is required to fetch balance.');
  }

  // 1. Get cached wallet row
  const walletRes = await clientOrPool.query(
    `SELECT balance_paise, held_paise, total_sales_paise, withdrawn_paise FROM wallets WHERE user_id = $1`,
    [userId]
  );
  const wallet = walletRes.rows[0] || { balance_paise: 0n, held_paise: 0n };
  const balancePaise = BigInt(wallet.balance_paise || 0);
  const heldPaise = BigInt(wallet.held_paise || 0);

  // 2. Fetch system reserve setting
  const reserveSetting = await getSetting('reserve_amount_paise', clientOrPool);
  const reserveRequiredPaise = BigInt(reserveSetting.value_numeric || 50000); // 50,000 paise = Rs 500

  // 3. Available balance = balance_paise - held_paise
  const availablePaise = balancePaise > heldPaise ? balancePaise - heldPaise : 0n;

  // 4. Reserve locked
  const reserveLockedPaise = availablePaise >= reserveRequiredPaise ? reserveRequiredPaise : availablePaise;

  // 5. Withdrawable balance = max(0, available_balance - reserve_locked)
  const withdrawablePaise = availablePaise > reserveLockedPaise ? availablePaise - reserveLockedPaise : 0n;

  return {
    user_id: userId,
    balance_paise: balancePaise,
    held_paise: heldPaise,
    available_balance_paise: availablePaise,
    reserve_locked_paise: reserveLockedPaise,
    reserve_required_paise: reserveRequiredPaise,
    withdrawable_balance_paise: withdrawablePaise
  };
}

/**
 * Audit reconciliation check: proves wallets.balance_paise == SUM(financial_ledger.amount_paise)
 */
export async function verifyWalletReconciliation(clientOrPool, userId) {
  const sumRes = await clientOrPool.query(
    `SELECT COALESCE(SUM(amount_paise), 0) as ledger_sum FROM financial_ledger WHERE user_id = $1`,
    [userId]
  );
  const ledgerSumPaise = BigInt(sumRes.rows[0]?.ledger_sum || 0);

  const walletRes = await clientOrPool.query(
    `SELECT balance_paise FROM wallets WHERE user_id = $1`,
    [userId]
  );
  const cachedBalancePaise = BigInt(walletRes.rows[0]?.balance_paise || 0);

  const isReconciled = ledgerSumPaise === cachedBalancePaise;

  return {
    user_id: userId,
    cached_balance_paise: cachedBalancePaise,
    ledger_sum_paise: ledgerSumPaise,
    reconciled: isReconciled
  };
}
