import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({
  connectionString: 'postgres://ronav_admin:RonavSecure2026!Fintech@localhost:5432/ronav_db'
});

try {
  console.log('1. Updating WTH-048008 and WTH-066432 to channel = "qr"...');
  await pool.query(`UPDATE withdrawals SET channel = 'qr' WHERE id IN ('WTH-048008', 'WTH-066432')`);

  console.log('2. Updating WTH-662601 to channel = "payswiff"...');
  await pool.query(`UPDATE withdrawals SET channel = 'payswiff' WHERE id = 'WTH-662601'`);

  console.log('3. Verifying updated rows in PostgreSQL:');
  const res = await pool.query(`SELECT id, amount, channel, status, created_at, admin_remark FROM withdrawals WHERE id IN ('WTH-048008', 'WTH-066432', 'WTH-662601')`);
  console.table(res.rows);

  console.log('✓ Step 1 Database updates completed successfully!');
} catch (err) {
  console.error('Database update error:', err);
} finally {
  await pool.end();
}
