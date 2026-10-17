import assert from 'node:assert/strict';
import { testPool, resetTestDatabase } from './test_db_helper.js';
import { getSetting, getAllSettings, updateSetting } from './settings.js';
import { getCaller } from './caller.js';

async function runTest() {
  console.log('--- RUNNING TEST 1: Settings & getCaller ---');
  await resetTestDatabase();

  // 1. Test getSetting fetches from DB
  const reserveSetting = await getSetting('reserve_amount_paise', testPool);
  assert.equal(reserveSetting.value_numeric, 50000, 'Reserve should be 50,000 paise (Rs 500)');
  assert.equal(reserveSetting.key, 'reserve_amount_paise');

  const rentalSetting = await getSetting('monthly_rental_paise', testPool);
  assert.equal(rentalSetting.value_numeric, 49900, 'Rental should be 49,900 paise (Rs 499)');

  // 2. Test unknown setting throws real error (no silent fallback)
  await assert.rejects(
    async () => await getSetting('non_existent_key_xyz', testPool),
    { message: /SETTING_NOT_FOUND/ },
    'Non-existent setting must throw real error'
  );

  // 3. Test updateSetting updates DB
  await updateSetting('reserve_amount_paise', { value_numeric: 60000 }, 'ADM001', testPool);
  const updated = await getSetting('reserve_amount_paise', testPool);
  assert.equal(updated.value_numeric, 60000, 'Reserve should be updated to 60,000 paise');

  // 4. Test getCaller with signed Bearer token
  const { generateToken } = await import('./security.js');
  const token = generateToken({ id: 'ADM001', role: 'ADMIN', name: 'RONAV Super Admin' });
  const mockReqHeader = {
    headers: { 'authorization': `Bearer ${token}` }
  };
  const caller1 = getCaller(mockReqHeader);
  assert.equal(caller1.id, 'ADM001');
  assert.equal(caller1.role, 'ADMIN');

  // getCaller rejects spoofed headers and missing token
  assert.throws(
    () => getCaller({ headers: { 'x-caller-id': 'ADM001', 'x-caller-role': 'ADMIN' } }),
    { code: 'AUTH_TOKEN_MISSING' },
    'getCaller must reject spoofed x-caller-id header without Bearer token'
  );

  assert.throws(
    () => getCaller({ headers: {} }),
    { code: 'AUTH_TOKEN_MISSING' },
    'getCaller must throw when caller is missing'
  );

  console.log('✅ TEST 1 PASSED: Settings & getCaller working strictly as specified.');
  await testPool.end();
}

runTest().catch(err => {
  console.error('❌ TEST 1 FAILED:', err);
  process.exit(1);
});
