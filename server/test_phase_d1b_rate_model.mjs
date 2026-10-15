import assert from 'node:assert/strict';
import { getDbPool } from './pg_db.js';
import { resetTestDatabase } from './test_db_helper.js';
import { setUserRate, getActiveRate, validateHierarchyRates } from './rate_engine.js';
import { runRateModelMigration } from './migration_rates_phase_d1b.mjs';

async function testRateModel() {
  console.log('=== TEST SUITE: Phase D1b Rate Model & Settlement Modes ===');
  await resetTestDatabase();
  const pool = getDbPool();
  const client = await pool.connect();

  try {
    // 1. Setup a test user
    await client.query(`
      INSERT INTO users (id, name, mobile, role)
      VALUES ('USR_RATE_01', 'Test Rate Merchant', '9999900001', 'MERCHANT')
      ON CONFLICT (id) DO NOTHING;
    `);

    // 2. Set independent T1 and INSTANT rates for Pine Labs
    console.log('1. Setting T1 (150 bps) and INSTANT (185 bps) rates for Pine Labs...');
    const t1Rate = await setUserRate(client, {
      userId: 'USR_RATE_01',
      channel: 'pinelabs',
      settlementMode: 'T1',
      rateBps: 150
    });
    assert.equal(t1Rate.settlement_mode, 'T1');
    assert.equal(t1Rate.rate_bps, 150);

    const instRate = await setUserRate(client, {
      userId: 'USR_RATE_01',
      channel: 'pinelabs',
      settlementMode: 'INSTANT',
      rateBps: 185
    });
    assert.equal(instRate.settlement_mode, 'INSTANT');
    assert.equal(instRate.rate_bps, 185);

    // 3. Verify getActiveRate retrieves correct mode rate
    console.log('2. Verifying getActiveRate retrieves correct mode rate...');
    const fetchedT1 = await getActiveRate(client, {
      userId: 'USR_RATE_01',
      channel: 'pinelabs',
      settlementMode: 'T1'
    });
    assert.equal(fetchedT1.rate_bps, 150, 'Pine Labs T1 rate must be 150 bps');

    const fetchedInst = await getActiveRate(client, {
      userId: 'USR_RATE_01',
      channel: 'pinelabs',
      settlementMode: 'INSTANT'
    });
    assert.equal(fetchedInst.rate_bps, 185, 'Pine Labs Instant rate must be 185 bps');

    // 4. QR channel must use NONE mode
    console.log('3. Setting and querying QR channel with NONE mode...');
    const qrRate = await setUserRate(client, {
      userId: 'USR_RATE_01',
      channel: 'qr',
      settlementMode: 'NONE',
      rateBps: 0
    });
    assert.equal(qrRate.settlement_mode, 'NONE');

    const fetchedQr = await getActiveRate(client, {
      userId: 'USR_RATE_01',
      channel: 'qr',
      settlementMode: 'NONE'
    });
    assert.equal(fetchedQr.rate_bps, 0);

    // 5. Invalid mode validation
    console.log('4. Testing invalid mode rejections...');
    await assert.rejects(
      async () => setUserRate(client, {
        userId: 'USR_RATE_01',
        channel: 'pinelabs',
        settlementMode: 'NONE',
        rateBps: 150
      }),
      /INVALID_SETTLEMENT_MODE/,
      'Pine Labs must reject NONE mode'
    );

    await assert.rejects(
      async () => setUserRate(client, {
        userId: 'USR_RATE_01',
        channel: 'qr',
        settlementMode: 'T1',
        rateBps: 50
      }),
      /INVALID_SETTLEMENT_MODE/,
      'QR must reject T1 mode'
    );

    // 6. Test Migration on legacy single-channel row
    console.log('5. Testing runRateModelMigration on legacy rows...');
    await client.query(`
      INSERT INTO users (id, name, mobile, role)
      VALUES ('USR_LEGACY_01', 'Legacy User', '9999900002', 'MERCHANT')
      ON CONFLICT (id) DO NOTHING;
    `);
    // Insert raw legacy row without settlement_mode or with old schema
    await client.query(`
      INSERT INTO user_channel_rates (user_id, channel, settlement_mode, rate_bps, needs_review)
      VALUES ('USR_LEGACY_01', 'payswiff', 'T1', 190, FALSE);
    `);

    const migrationResult = await runRateModelMigration(client);
    console.log('   Migration report:', migrationResult);
    assert(migrationResult.affectedUsers.includes('USR_LEGACY_01'), 'Legacy user must be in affected users');

    const migratedT1 = await getActiveRate(client, {
      userId: 'USR_LEGACY_01',
      channel: 'payswiff',
      settlementMode: 'T1'
    });
    const migratedInst = await getActiveRate(client, {
      userId: 'USR_LEGACY_01',
      channel: 'payswiff',
      settlementMode: 'INSTANT'
    });
    assert.equal(migratedT1.rate_bps, 190);
    assert.equal(migratedInst.rate_bps, 190);
    assert.equal(migratedT1.record.needs_review, true, 'Migrated T1 must be marked needs_review');
    assert.equal(migratedInst.record.needs_review, true, 'Migrated Instant must be marked needs_review');

    console.log('✅ ALL RATE MODEL & SETTLEMENT MODE TESTS PASSED!');
  } finally {
    client.release();
    await pool.end();
  }
}

testRateModel().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
