import assert from 'node:assert/strict';
import { getDbPool } from './pg_db.js';

async function testPayoutTypeConstraint() {
  console.log('--- TEST: withdrawals.payout_type NOT NULL and CHECK constraint ---');
  const pool = getDbPool();
  const client = await pool.connect();
  try {
    // 1. Verify constraint exists in pg_constraint
    const res = await client.query(`
      SELECT conname, pg_get_constraintdef(c.oid) as def
      FROM pg_constraint c
      WHERE conrelid = 'withdrawals'::regclass AND conname = 'chk_withdrawals_payout_type'
    `);
    assert.equal(res.rows.length, 1, 'Constraint chk_withdrawals_payout_type must exist on withdrawals table');
    assert.ok(res.rows[0].def.includes("'REGULAR'") && res.rows[0].def.includes("'COMMISSION'"), 'Check constraint must enforce REGULAR or COMMISSION');

    // 2. Verify NOT NULL constraint on column
    const colRes = await client.query(`
      SELECT is_nullable
      FROM information_schema.columns
      WHERE table_name = 'withdrawals' AND column_name = 'payout_type'
    `);
    assert.equal(colRes.rows[0]?.is_nullable, 'NO', 'withdrawals.payout_type must be NOT NULL');

    // 3. Test rejection of invalid payout_type
    let rejectedInvalid = false;
    try {
      await client.query(`
        INSERT INTO withdrawals (
          id, merchant_id, amount_paise, net_payout_paise, beneficiary_id, channel, settlement_type, payout_type, status
        ) VALUES (
          'WTH-TEST-INV-TYPE', 'MID1001', 10000, 10000, 'BEN-MID1001-TEST', 'pinelabs', 'T1', 'INVALID', 'PENDING'
        )
      `);
    } catch (e) {
      rejectedInvalid = true;
      assert.ok(e.message.includes('chk_withdrawals_payout_type') || e.code === '23514', `Expected check constraint violation, got: ${e.message}`);
    }
    assert.ok(rejectedInvalid, 'DB must reject insert with payout_type not in (REGULAR, COMMISSION)');

    // 4. Test rejection of NULL payout_type
    let rejectedNull = false;
    try {
      await client.query(`
        INSERT INTO withdrawals (
          id, merchant_id, amount_paise, net_payout_paise, beneficiary_id, channel, settlement_type, payout_type, status
        ) VALUES (
          'WTH-TEST-NULL-TYPE', 'MID1001', 10000, 10000, 'BEN-MID1001-TEST', 'pinelabs', 'T1', NULL, 'PENDING'
        )
      `);
    } catch (e) {
      rejectedNull = true;
      assert.ok(e.code === '23502' || e.message.includes('not-null'), `Expected not-null violation, got: ${e.message}`);
    }
    assert.ok(rejectedNull, 'DB must reject insert with payout_type = NULL');

    console.log('✅ TEST PASSED: withdrawals.payout_type NOT NULL and CHECK constraints verified.');
  } finally {
    client.release();
    await pool.end();
  }
}

testPayoutTypeConstraint().catch(err => {
  console.error('❌ TEST FAILED:', err.message);
  process.exit(1);
});
