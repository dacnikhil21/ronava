import assert from 'node:assert/strict';
import { testPool, resetTestDatabase } from './test_db_helper.js';
import { 
  validateHierarchyRates, 
  setUserRate, 
  getActiveRate 
} from './rate_engine.js';

async function runTest() {
  console.log('--- RUNNING TEST 3: Rate Versioning & Hierarchy Validation ---');
  await resetTestDatabase();

  const client = await testPool.connect();
  try {
    // 1. Rate Hierarchy Validation tests
    // Valid: child rate 1.50% (150 bps) >= parent rate 1.20% (120 bps)
    assert.doesNotThrow(() => {
      validateHierarchyRates(150, 120);
    });

    // Valid: equal rates (zero commission)
    assert.doesNotThrow(() => {
      validateHierarchyRates(120, 120);
    });

    // Invalid: child rate 1.00% < parent rate 1.20%
    assert.throws(
      () => validateHierarchyRates(100, 120),
      { message: /INVALID_RATE_HIERARCHY/ },
      'Child rate lower than parent rate must be rejected'
    );

    // Invalid: negative rate
    assert.throws(
      () => validateHierarchyRates(-50, 100),
      { message: /INVALID_RATE_VALUE/ },
      'Negative rate must be rejected'
    );

    // Invalid: NaN or huge rate (> 10000 bps = 100%)
    assert.throws(
      () => validateHierarchyRates(15000, 100),
      { message: /INVALID_RATE_VALUE/ },
      'Rate exceeding 100% must be rejected'
    );
    assert.throws(
      () => validateHierarchyRates(NaN, 100),
      { message: /INVALID_RATE_VALUE/ },
      'NaN rate must be rejected'
    );

    // 2. Rate Versioning in Database
    await client.query(`
      INSERT INTO users (id, name, mobile, role) 
      VALUES ('MID3001', 'Ravi General Store', '9876543210', 'MERCHANT');
    `);

    // Set initial rate: 1.50% (150 bps) effective yesterday
    const yesterday = new Date(Date.now() - 24 * 3600 * 1000);
    await setUserRate(client, {
      userId: 'MID3001',
      channel: 'pinelabs',
      rateBps: 150,
      effectiveFrom: yesterday
    });

    // Query active rate right now -> should be 150 bps
    const rateNow = await getActiveRate(client, { userId: 'MID3001', channel: 'pinelabs' });
    assert.equal(rateNow.rate_bps, 150);

    // Now update rate to 1.80% (180 bps) effective right now
    const now = new Date();
    await setUserRate(client, {
      userId: 'MID3001',
      channel: 'pinelabs',
      rateBps: 180,
      effectiveFrom: now
    });

    // Active rate now should be 180 bps
    const rateUpdated = await getActiveRate(client, { userId: 'MID3001', channel: 'pinelabs' });
    assert.equal(rateUpdated.rate_bps, 180);

    // Historical query for yesterday should still return 150 bps (History preserved!)
    const rateYesterday = await getActiveRate(client, { 
      userId: 'MID3001', 
      channel: 'pinelabs', 
      asOfDate: yesterday 
    });
    assert.equal(rateYesterday.rate_bps, 150, 'Historical rate must remain 150 bps');

    console.log('✅ TEST 3 PASSED: Rate versioning and hierarchy validation strictly enforced.');
  } finally {
    client.release();
    await testPool.end();
  }
}

runTest().catch(err => {
  console.error('❌ TEST 3 FAILED:', err);
  process.exit(1);
});
