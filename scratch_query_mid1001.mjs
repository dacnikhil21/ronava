import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({
  connectionString: 'postgres://ronav_admin:RonavSecure2026!Fintech@localhost:5432/ronav_db'
});

try {
  const t = await pool.query(`SELECT id, merchant_id, amount, provider, status, created_at, notes FROM transactions WHERE amount::text LIKE '%31%' OR notes LIKE '%31%'`);
  console.log('--- TRANSACTIONS MATCHING 31 ---');
  console.table(t.rows);

  const w = await pool.query(`SELECT id, merchant_id, amount, status, channel, created_at, admin_remark FROM withdrawals WHERE amount::text LIKE '%31%'`);
  console.log('--- WITHDRAWALS MATCHING 31 ---');
  console.table(w.rows);

} catch (err) {
  console.error(err);
} finally {
  await pool.end();
}
