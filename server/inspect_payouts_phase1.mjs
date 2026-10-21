import { query } from './pg_db.js';

async function main() {
  console.log('=== 1. CHECK CONSTRAINTS ===');
  const constraints = await query(`
    SELECT conname, pg_get_constraintdef(c.oid) as def
    FROM pg_constraint c
    WHERE conrelid IN ('withdrawals'::regclass, 'transactions'::regclass, 'financial_ledger'::regclass)
  `);
  for (const c of constraints) {
    console.log(c.conname, ':', c.def);
  }

  console.log('\n=== 2. THE TWO RS 2,500 WITHDRAWALS ===');
  const w2500 = await query("SELECT * FROM withdrawals WHERE amount_paise = 250000");
  console.table(w2500);

  console.log('\n=== 3. LATEST WITHDRAWALS (ALL) ===');
  const wAll = await query("SELECT * FROM withdrawals ORDER BY created_at DESC");
  console.table(wAll);

  console.log('\n=== 4. LATEST TRANSACTIONS ===');
  const tLatest = await query("SELECT * FROM transactions ORDER BY created_at DESC LIMIT 5");
  console.table(tLatest);

  console.log('\n=== 5. FINANCIAL LEDGER FOR DD1001 & MID1001 ===');
  const flTest = await query("SELECT * FROM financial_ledger WHERE user_id IN ('DD1001', 'MID1001') ORDER BY id DESC LIMIT 25");
  console.table(flTest);

  console.log('\n=== 6. SYSTEM SETTINGS ===');
  const sysSettings = await query("SELECT * FROM system_settings");
  console.table(sysSettings);

  console.log('\n=== 7. BENEFICIARIES ===');
  const bList = await query("SELECT * FROM beneficiaries");
  console.table(bList);

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
