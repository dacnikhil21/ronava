import { query, pgQuery } from '../server/pg_db.js';

async function migrate() {
  console.log('--- STARTING PAYOUTS ARCHITECTURE MIGRATION ---');

  // 1. Add payout_type column with default 'REGULAR'
  await pgQuery(`
    ALTER TABLE withdrawals 
    ADD COLUMN IF NOT EXISTS payout_type VARCHAR(20) DEFAULT 'REGULAR';
  `);
  console.log('✓ Added payout_type column to withdrawals table.');

  // 2. Normalize legacy 'APPROVED' to 'COMPLETED'
  const converted = await pgQuery(`
    UPDATE withdrawals 
    SET status = 'COMPLETED' 
    WHERE status = 'APPROVED'
    RETURNING id;
  `);
  console.log(`✓ Normalized ${converted.length} legacy 'APPROVED' withdrawals to 'COMPLETED'.`);

  // 3. Drop existing status check constraint and re-add strict constraint
  await pgQuery(`
    ALTER TABLE withdrawals 
    DROP CONSTRAINT IF EXISTS withdrawals_status_check;
  `);
  await pgQuery(`
    ALTER TABLE withdrawals 
    ADD CONSTRAINT withdrawals_status_check 
    CHECK (status IN ('PENDING', 'SUBMITTED_TO_BANK', 'COMPLETED', 'REJECTED'));
  `);
  console.log('✓ Replaced withdrawals_status_check constraint with strict vocabulary (PENDING, SUBMITTED_TO_BANK, COMPLETED, REJECTED).');

  // 4. Add check constraint on payout_type
  await pgQuery(`
    ALTER TABLE withdrawals 
    DROP CONSTRAINT IF EXISTS chk_withdrawals_payout_type;
  `);
  await pgQuery(`
    ALTER TABLE withdrawals 
    ADD CONSTRAINT chk_withdrawals_payout_type 
    CHECK (payout_type IN ('REGULAR', 'COMMISSION'));
  `);
  console.log('✓ Added chk_withdrawals_payout_type constraint (REGULAR, COMMISSION).');

  // 4.1 Ensure transactions has verified_at and admin_remark for audit tracking
  await pgQuery(`
    ALTER TABLE transactions 
    ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS admin_remark TEXT;
  `);
  console.log('✓ Ensured transactions table has verified_at and admin_remark columns.');

  // 5. Ensure system_settings has commission_payouts_locked
  await pgQuery(`
    INSERT INTO system_settings (key, value_numeric, value_text, description, updated_at)
    VALUES ('commission_payouts_locked', 0, '0', 'Commission payouts lock (1 = LOCKED, 0 = UNLOCKED)', NOW())
    ON CONFLICT (key) DO NOTHING;
  `);
  console.log('✓ Seeded system_settings commission_payouts_locked setting.');

  // 6. Verify existing test records
  const w2500 = await pgQuery(`SELECT id, merchant_id, amount_paise, channel, payout_type, status FROM withdrawals WHERE amount_paise = 250000`);
  console.log('\n--- VERIFICATION: DD1001 ₹2,500 REQUESTS ---');
  console.table(w2500);

  console.log('--- MIGRATION COMPLETED SUCCESSFULLY ---');
  process.exit(0);
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
