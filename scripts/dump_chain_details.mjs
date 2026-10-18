import { pgQuery } from '../server/pg_db.js';

async function run() {
  const users = await pgQuery('SELECT * FROM users ORDER BY created_at ASC');
  console.log('=== USERS ===');
  for (const u of users) {
    console.log(`${u.id} | ${u.name} | ${u.role} | sponsor_id: ${u.sponsor_id} | creator: ${u.creator_id || u.assigned_by || ''}`);
  }

  const rates = await pgQuery('SELECT * FROM user_channel_rates ORDER BY user_id, channel, settlement_mode');
  console.log('\n=== USER_CHANNEL_RATES ===');
  for (const r of rates) {
    console.log(JSON.stringify(r));
  }

  const txns = await pgQuery('SELECT * FROM transactions');
  console.log('\n=== TRANSACTIONS ===');
  for (const t of txns) {
    console.log(JSON.stringify(t, null, 2));
  }

  const ledger = await pgQuery('SELECT * FROM financial_ledger ORDER BY created_at ASC');
  console.log('\n=== FINANCIAL LEDGER ===');
  for (const l of ledger) {
    console.log(JSON.stringify(l));
  }

  process.exit(0);
}
run();
