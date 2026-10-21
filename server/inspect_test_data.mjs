import { query } from './pg_db.js';

async function main() {
  console.log('=== TEST ROWS DETAILS ===');

  // 1. Two Rs 2500 requests
  const w2500 = await query("SELECT * FROM withdrawals WHERE amount_paise = 250000 ORDER BY created_at ASC");
  console.log('\n--- The Two Rs 2,500 Requests ---');
  console.log(JSON.stringify(w2500, null, 2));

  // 2. Latest withdrawal for MID1001
  const wLatest = await query("SELECT * FROM withdrawals WHERE merchant_id = 'MID1001' ORDER BY created_at DESC LIMIT 3");
  console.log('\n--- Latest Withdrawals for MID1001 ---');
  console.log(JSON.stringify(wLatest, null, 2));

  // 3. Latest Swipes
  const tLatest = await query("SELECT * FROM transactions ORDER BY created_at DESC LIMIT 3");
  console.log('\n--- Latest Swipes ---');
  console.log(JSON.stringify(tLatest, null, 2));

  // 4. Ledger rows for the two 2500 requests
  const fl2500 = await query("SELECT * FROM financial_ledger WHERE reference_id IN ('WTH-1792411938114-4252', 'WTH-1792411972138-1039')");
  console.log('\n--- Ledger Rows for the Two 2500 Requests ---');
  console.log(JSON.stringify(fl2500, null, 2));

  // 5. Ledger rows for latest withdrawal
  const flWLatest = await query("SELECT * FROM financial_ledger WHERE reference_id = 'WTH-1792416053367-2257' OR reference_id = 'WTH-1792416053234-6138'");
  console.log('\n--- Ledger Rows for Latest Withdrawals ---');
  console.log(JSON.stringify(flWLatest, null, 2));

  process.exit(0);
}

main().catch(console.error);
