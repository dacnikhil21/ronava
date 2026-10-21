import { query } from './pg_db.js';

async function main() {
  console.log('=== 1. CHECK CONSTRAINTS ON WITHDRAWALS, TRANSACTIONS, FINANCIAL LEDGER ===');
  const constraints = await query(`
    SELECT c.conrelid::regclass as tbl, conname, pg_get_constraintdef(c.oid) as def
    FROM pg_constraint c
    WHERE conrelid IN ('withdrawals'::regclass, 'transactions'::regclass, 'financial_ledger'::regclass)
  `);
  for (const c of constraints) {
    console.log(`${c.tbl} -> ${c.conname}: ${c.def}`);
  }

  console.log('\n=== 2. THE TWO RS 2,500 WITHDRAWALS ===');
  const w2500 = await query("SELECT * FROM withdrawals WHERE amount_paise = 250000");
  console.log(JSON.stringify(w2500, null, 2));

  console.log('\n=== 3. LATEST TRANSACTIONS & THEIR REVERSED OR PENDING STATUS ===');
  const tx = await query("SELECT id, merchant_id, amount_paise, type, channel, status, created_at FROM transactions ORDER BY created_at DESC LIMIT 6");
  console.log(JSON.stringify(tx, null, 2));

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
