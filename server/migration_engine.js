/**
 * Data Migration Engine: Builds Opening Ledger Entries from Existing Data
 * Runs strictly on local/staging database copies, generates before/after reconciliation,
 * and flags any mismatches.
 */
export async function migrateHistoricalDataToLedger(client) {
  if (!client || typeof client.query !== 'function') {
    throw new Error('DATABASE_CLIENT_REQUIRED: migrateHistoricalDataToLedger requires an active database client.');
  }

  await client.query('BEGIN');
  try {
    // 1. Snapshot Before Balances
    const beforeWalletsRes = await client.query(`
      SELECT user_id, balance_paise FROM wallets
    `);
    const beforeBalances = new Map();
    for (const w of beforeWalletsRes.rows) {
      beforeBalances.set(w.user_id, BigInt(w.balance_paise || 0));
    }

    // 2. Migrate Approved Transactions without existing ledger entries
    const txnsRes = await client.query(`
      SELECT t.id, t.merchant_id, t.amount_paise, t.net_amount_paise, t.channel, t.created_at
      FROM transactions t
      WHERE t.status = 'APPROVED'
        AND NOT EXISTS (
          SELECT 1 FROM financial_ledger fl WHERE fl.reference_id = t.id
        )
      ORDER BY t.created_at ASC
    `);

    let migratedTxnCount = 0;
    for (const t of txnsRes.rows) {
      const netPaise = BigInt(t.net_amount_paise || t.amount_paise || 0);
      await client.query(`
        INSERT INTO financial_ledger (
          user_id, type, amount_paise, reference_id, reference_type, channel, metadata, created_by, created_at
        ) VALUES ($1, 'swipe_credit', $2, $3, 'OPENING_SWIPE', $4, $5, 'MIGRATION', COALESCE($6, NOW()))
      `, [
        t.merchant_id,
        netPaise.toString(),
        t.id,
        t.channel || 'pinelabs',
        JSON.stringify({ is_opening_balance: true }),
        t.created_at
      ]);
      migratedTxnCount++;
    }

    // 3. Migrate Approved/Non-Rejected Withdrawals without existing ledger entries
    const withRes = await client.query(`
      SELECT w.id, w.merchant_id, w.amount_paise, w.channel, w.created_at
      FROM withdrawals w
      WHERE w.status != 'REJECTED'
        AND NOT EXISTS (
          SELECT 1 FROM financial_ledger fl WHERE fl.reference_id = w.id
        )
      ORDER BY w.created_at ASC
    `);

    let migratedWithdrawalCount = 0;
    for (const w of withRes.rows) {
      const amtPaise = BigInt(w.amount_paise || 0);
      const negPaise = -amtPaise;
      await client.query(`
        INSERT INTO financial_ledger (
          user_id, type, amount_paise, reference_id, reference_type, channel, metadata, created_by, created_at
        ) VALUES ($1, 'withdrawal_paid', $2, $3, 'OPENING_WITHDRAWAL', $4, $5, 'MIGRATION', COALESCE($6, NOW()))
      `, [
        w.merchant_id,
        negPaise.toString(),
        w.id,
        w.channel || 'pinelabs',
        JSON.stringify({ is_opening_balance: true }),
        w.created_at
      ]);
      migratedWithdrawalCount++;
    }

    // 4. Update Wallets Cached Balances strictly from Ledger Sums
    await client.query(`
      UPDATE wallets w
      SET balance_paise = COALESCE((
        SELECT SUM(fl.amount_paise) 
        FROM financial_ledger fl 
        WHERE fl.user_id = w.user_id
      ), 0),
      updated_at = NOW()
    `);

    // 5. Build Before / After Comparison Audit
    const allUsersRes = await client.query(`SELECT id FROM users`);
    const comparisons = [];

    for (const u of allUsersRes.rows) {
      const uid = u.id;
      const before = beforeBalances.get(uid) || 0n;

      const sumRes = await client.query(`
        SELECT COALESCE(SUM(amount_paise), 0) as ledger_sum 
        FROM financial_ledger 
        WHERE user_id = $1
      `, [uid]);
      const after = BigInt(sumRes.rows[0]?.ledger_sum || 0);

      const diff = after - before;
      comparisons.push({
        user_id: uid,
        before_balance_paise: before,
        ledger_sum_paise: after,
        difference_paise: diff,
        mismatch: diff !== 0n
      });
    }

    await client.query('COMMIT');

    return {
      total_migrated_txns: migratedTxnCount,
      total_migrated_withdrawals: migratedWithdrawalCount,
      users_compared: comparisons
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  }
}
