import pg from 'pg';

async function main() {
  const pool = new pg.Pool({
    connectionString: 'postgres://postgres:postgres@localhost:5432/ronav_test_db'
  });

  const allRows = await pool.query(`
    SELECT l.id, l.user_id, l.type, l.amount_paise, l.reference_id, l.reference_type, l.channel,
           t.id as txn_id, t.channel as txn_channel, t.provider as txn_provider
    FROM financial_ledger l
    LEFT JOIN transactions t ON l.reference_id = t.id
    ORDER BY l.id ASC
  `);

  console.log('Total ledger rows:', allRows.rows.length);

  const untagged = allRows.rows.filter(r => !r.channel || r.channel.trim() === '');
  console.log('Untagged ledger rows count:', untagged.length);
  console.log('Untagged ledger rows details:', JSON.stringify(untagged, null, 2));

  await pool.end();
}

main().catch(console.error);
