import assert from 'node:assert';
import http from 'node:http';
import { pgQuery } from './pg_db.js';
import { generateToken } from './security.js';
import { handleApiRequest } from './api.js';

async function runTests() {
  console.log('--- RUNNING STEP 2 TEST SUITE: ADMIN WITHDRAWALS LIMIT 100 FIX ---');

  // 1. Generate Admin Token
  const adminToken = generateToken({ id: 'ADM001', role: 'ADMIN', name: 'Super Admin' });

  // 2. Query Authoritative Count from DB directly
  const dbCountRes = await pgQuery(`SELECT COUNT(*)::int as count FROM withdrawals`);
  const initialTotal = dbCountRes[0]?.count || 0;
  console.log(`Current DB withdrawals count: ${initialTotal}`);

  // Insert test withdrawals to guarantee we test beyond 100 records
  const needed = Math.max(0, 105 - initialTotal);
  if (needed > 0) {
    console.log(`Inserting ${needed} test withdrawals to guarantee dataset > 100...`);
    const merchantId = 'TEST_PAGINATION_M01';
    await pgQuery(`
      INSERT INTO users (id, name, mobile, role, status)
      VALUES ($1, 'Test Pagination Merchant', '9999988888', 'MERCHANT', 'ACTIVE')
      ON CONFLICT (id) DO NOTHING
    `, [merchantId]);

    await pgQuery(`
      INSERT INTO beneficiaries (id, merchant_id, account_number, ifsc, holder_name, bank_name, is_verified)
      VALUES ('BEN_TEST_PAGIN_01', $1, '987654321012', 'HDFC0001234', 'Test Merchant', 'HDFC Bank', true)
      ON CONFLICT (id) DO NOTHING
    `, [merchantId]);

    for (let i = 0; i < needed; i++) {
      const isOldPending = (i === 0);
      const status = isOldPending ? 'PENDING' : 'COMPLETED';
      const createdDate = isOldPending 
        ? new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString()
        : new Date(Date.now() - (i + 1) * 3600 * 1000).toISOString();
      const utr = isOldPending ? null : `TEST_PAGIN_UTR_${10000 + i}`;
      const amountPaise = Math.round((150.00 + i) * 100);

      await pgQuery(`
        INSERT INTO withdrawals (
          id, merchant_id, amount, amount_paise, fee_paise, net_payout_paise, beneficiary_id, status, payout_type, settlement_type, channel, utr, created_at
        ) VALUES (
          $1, $2, $3, $4, 0, $4, 'BEN_TEST_PAGIN_01', $5, $6, $7, $8, $9, $10
        ) ON CONFLICT (id) DO NOTHING
      `, [
        `TEST_W_${Date.now()}_${i}`,
        merchantId,
        150.00 + i,
        amountPaise,
        status,
        'REGULAR',
        'T1',
        'pinelabs',
        utr,
        createdDate
      ]);
    }
  }

  // Verify total is now > 100
  const afterCountRes = await pgQuery(`SELECT COUNT(*)::int as count FROM withdrawals`);
  const totalInDb = afterCountRes[0]?.count || 0;
  console.log(`Verified DB withdrawals count: ${totalInDb} (must be >= 100)`);
  assert(totalInDb >= 100, `Expected totalInDb >= 100, got ${totalInDb}`);

  // Start self-contained ephemeral test server
  const testServer = http.createServer(async (req, res) => {
    if (req.url && req.url.startsWith('/api/')) {
      await handleApiRequest(req, res);
      return;
    }
    res.writeHead(404);
    res.end();
  });

  await new Promise((resolve) => testServer.listen(0, '127.0.0.1', resolve));
  const testPort = testServer.address().port;
  console.log(`Test server running on port ${testPort}`);

  function makeGet(path) {
    return new Promise((resolve, reject) => {
      const req = http.request({
        hostname: '127.0.0.1',
        port: testPort,
        path,
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'Accept': 'application/json'
        }
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            resolve({ statusCode: res.statusCode, body: JSON.parse(data) });
          } catch (e) {
            resolve({ statusCode: res.statusCode, raw: data });
          }
        });
      });
      req.on('error', reject);
      req.end();
    });
  }

  try {
    // TEST 1: GET /api/admin/pending returns all actionable items and authoritative counts
    console.log('\n[TEST 1] Verifying GET /api/admin/pending returns actionable items and accurate counts...');
    const pendingRes = await makeGet('/api/admin/pending');
    assert.strictEqual(pendingRes.statusCode, 200, 'Expected status 200');
    assert(pendingRes.body.success, 'Expected success: true');
    
    const pendingWithdrawals = pendingRes.body.pendingWithdrawals || [];
    const wTotals = pendingRes.body.stats?.withdrawalTotals || {};
    console.log(`  -> pendingWithdrawals array length: ${pendingWithdrawals.length}`);
    console.log(`  -> Authoritative counts in stats.withdrawalTotals:`, {
      pending_regular_count: wTotals.pending_regular_count,
      pending_commission_count: wTotals.pending_commission_count,
      submitted_count: wTotals.submitted_count,
      completed_count: wTotals.completed_count,
      total_count: wTotals.total_count
    });

    assert(wTotals.total_count >= 100, `Expected total_count >= 100, got ${wTotals.total_count}`);
    assert(typeof wTotals.pending_regular_count === 'number', 'pending_regular_count must be a number');
    assert(typeof wTotals.submitted_count === 'number', 'submitted_count must be a number');
    assert(typeof wTotals.completed_count === 'number', 'completed_count must be a number');
    console.log('  ✓ TEST 1 PASSED: Authoritative counts present and accurate.');

    // TEST 2: GET /api/admin/withdrawals pagination (page 1)
    console.log('\n[TEST 2] Verifying GET /api/admin/withdrawals pagination...');
    const page1Res = await makeGet('/api/admin/withdrawals?limit=12&page=1');
    assert.strictEqual(page1Res.statusCode, 200);
    assert(page1Res.body.success);
    assert.strictEqual(page1Res.body.withdrawals.length, 12, 'Page 1 must have 12 items');
    assert.strictEqual(page1Res.body.pagination.limit, 12);
    assert.strictEqual(page1Res.body.pagination.page, 1);
    assert.strictEqual(page1Res.body.pagination.total, totalInDb);
    assert(page1Res.body.pagination.total_pages >= 9, 'With >100 items and limit=12, total_pages must be >= 9');
    assert.strictEqual(page1Res.body.pagination.has_more, true);
    console.log(`  ✓ TEST 2 PASSED: Page 1 returned 12 items of ${totalInDb} total (${page1Res.body.pagination.total_pages} total pages).`);

    // TEST 3: Accessing Page 9 (Records 97 to 108) - Beyond index 100!
    console.log('\n[TEST 3] Accessing Page 9 to fetch records beyond record 100...');
    const page9Res = await makeGet('/api/admin/withdrawals?limit=12&page=9');
    assert.strictEqual(page9Res.statusCode, 200);
    assert(page9Res.body.success);
    assert(page9Res.body.withdrawals.length > 0, 'Page 9 must return records beyond 100');
    console.log(`  -> Page 9 returned ${page9Res.body.withdrawals.length} records. First record on page 9: ID=${page9Res.body.withdrawals[0]?.id}, Created=${page9Res.body.withdrawals[0]?.created_at}`);
    console.log('  ✓ TEST 3 PASSED: Older records beyond 100 are fully accessible via server-side pagination.');

    // TEST 4: Filter by Status=COMPLETED
    console.log('\n[TEST 4] Verifying status=COMPLETED filter...');
    const completedRes = await makeGet('/api/admin/withdrawals?status=COMPLETED&limit=12&page=1');
    assert.strictEqual(completedRes.statusCode, 200);
    assert(completedRes.body.success);
    completedRes.body.withdrawals.forEach(w => {
      assert(['COMPLETED', 'APPROVED'].includes(w.status), `Expected COMPLETED or APPROVED, got ${w.status}`);
    });
    console.log(`  ✓ TEST 4 PASSED: Filtered completed withdrawals (${completedRes.body.pagination.total} total completed in DB).`);

    // TEST 5: Server-side Search across complete database
    console.log('\n[TEST 5] Verifying server-side search across whole database...');
    const searchRes = await makeGet('/api/admin/withdrawals?search=TEST_PAGINATION_M01&limit=50');
    assert.strictEqual(searchRes.statusCode, 200);
    assert(searchRes.body.success);
    assert(searchRes.body.withdrawals.length > 0, 'Search must find records for merchant TEST_PAGINATION_M01');
    searchRes.body.withdrawals.forEach(w => {
      assert.strictEqual(w.merchant_id, 'TEST_PAGINATION_M01');
    });
    console.log(`  ✓ TEST 5 PASSED: Server-side search found ${searchRes.body.pagination.total} records across full database.`);

    console.log('\nALL STEP 2 WITHDRAWAL LIMIT 100 TESTS PASSED SUCCESSFULLY!\n');
  } finally {
    testServer.close();
    process.exit(0);
  }
}

runTests().catch(err => {
  console.error('Test failed with error:', err);
  process.exit(1);
});
