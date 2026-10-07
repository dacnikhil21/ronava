async function cleanPg() {
  const statements = [
    'DELETE FROM transactions',
    'DELETE FROM withdrawals',
    'DELETE FROM beneficiaries',
    'DELETE FROM merchant_pos',
    "DELETE FROM wallets WHERE user_id != 'ADM001'",
    'DELETE FROM inquiries',
    "DELETE FROM users WHERE id != 'ADM001'",
    "UPDATE wallets SET available_balance = 0, total_sales = 0, received_sales = 0, pending_balance = 0, withdrawn_amount = 0 WHERE user_id = 'ADM001'"
  ];
  for (const sql of statements) {
    try {
      const res = await fetch('http://13.201.4.145/api/db/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sql })
      }).then(r => r.json());
      console.log(sql, '=>', res);
    } catch (e) {
      console.error('Error on', sql, e.message);
    }
  }

  // Also verify SQLite
  console.log('\nVerifying remaining live users:');
  const check = await fetch('http://13.201.4.145/api/db/select', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ table: 'users' })
  }).then(r => r.json());
  console.table(check.data);
}

cleanPg();
