import { pgQuery } from '../server/pg_db.js';

async function run() {
  const users = await pgQuery('SELECT * FROM users ORDER BY created_at ASC');
  console.log('=== USERS ===');
  console.log(JSON.stringify(users, null, 2));

  const rates = await pgQuery('SELECT * FROM user_channel_rates ORDER BY user_id, channel, settlement_mode, effective_from DESC');
  console.log('=== USER CHANNEL RATES ===');
  console.log(JSON.stringify(rates, null, 2));

  const txns = await pgQuery('SELECT * FROM transactions');
  console.log('=== TRANSACTIONS ===');
  console.log(JSON.stringify(txns, null, 2));

  const ledger = await pgQuery('SELECT * FROM financial_ledger ORDER BY created_at ASC');
  console.log('=== FINANCIAL LEDGER ===');
  console.log(JSON.stringify(ledger, null, 2));

  const wallets = await pgQuery('SELECT * FROM wallets');
  console.log('=== WALLETS ===');
  console.log(JSON.stringify(wallets, null, 2));

  const pos = await pgQuery('SELECT * FROM merchant_pos');
  console.log('=== MERCHANT POS ===');
  console.log(JSON.stringify(pos, null, 2));

  process.exit(0);
}
run();
