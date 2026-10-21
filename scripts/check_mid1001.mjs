import { pgQuery, getDbPool } from '../server/pg_db.js';

async function check() {
  const w = await pgQuery('SELECT * FROM wallets WHERE user_id = $1', ['MID1001']);
  const l = await pgQuery('SELECT * FROM financial_ledger WHERE user_id = $1 ORDER BY created_at ASC', ['MID1001']);
  const t = await pgQuery('SELECT * FROM transactions WHERE merchant_id = $1', ['MID1001']);
  const wt = await pgQuery('SELECT * FROM withdrawals WHERE merchant_id = $1', ['MID1001']);
  console.log('=== MID1001 WALLET ===\n', JSON.stringify(w, null, 2));
  console.log('=== MID1001 LEDGER ===\n', JSON.stringify(l, null, 2));
  console.log('=== MID1001 TRANSACTIONS ===\n', JSON.stringify(t, null, 2));
  console.log('=== MID1001 WITHDRAWALS ===\n', JSON.stringify(wt, null, 2));
  const pool = getDbPool();
  await pool.end();
}
check();
