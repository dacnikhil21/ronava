import fetch from 'node:fetch';

const BASE_URL = 'http://13.201.4.145';

async function testAuth() {
  console.log('=== RONAV PRODUCTION AUTHENTICATION & SINGLE-SOURCE VERIFICATION ===\n');

  // Test 1: ADM001 login with correct password
  console.log('Test 1: Testing ADM001 login with strict password (Ronav@123)...');
  const res1 = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: 'ADM001', password: 'Ronav@123' })
  });
  const json1 = await res1.json();
  console.log('Result 1:', json1.success ? 'SUCCESS' : 'FAILED', json1.user?.name || json1.message);

  // Test 2: ADM001 login with wrong password
  console.log('\nTest 2: Testing ADM001 login with wrong password (FakePass@999)...');
  const res2 = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: 'ADM001', password: 'FakePass@999' })
  });
  const json2 = await res2.json();
  console.log('Result 2 (Should fail):', !json2.success ? 'PASSED (Rejected as expected)' : 'FAILED (Accepted wrong pass!)', json2.message);

  // Test 3: Check live database select via /api/db/select
  console.log('\nTest 3: Querying live users table via /api/db/select...');
  const res3 = await fetch(`${BASE_URL}/api/db/select`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ table: 'users', filters: { id: 'ADM001' } })
  });
  const json3 = await res3.json();
  console.log('Result 3:', json3.success ? 'SUCCESS' : 'FAILED', 'Found users:', json3.data?.length);

  console.log('\n=== PRE-FLIGHT LIVE CHECK COMPLETE ===');
}

testAuth().catch(console.error);
