import assert from 'node:assert/strict';
import http from 'node:http';
import { generateToken } from './security.js';

const BASE_URL = process.env.TEST_API_URL || 'http://localhost:3000';

function getRequest(path, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const req = http.request({
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    }, res => {
      let resData = '';
      res.on('data', chunk => resData += chunk);
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(resData); } catch (_) {}
        resolve({ statusCode: res.statusCode, data: json, raw: resData });
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function testPagination() {
  console.log('--- TEST: Pagination (Default 50, Max 200, Totals across all list endpoints) ---');

  const adminToken = generateToken({ id: 'ADM001', role: 'ADMIN', name: 'Super Admin' });
  const authHeaders = { 'Authorization': `Bearer ${adminToken}` };
  const merchantToken = generateToken({ id: 'MID1001', role: 'MERCHANT', name: 'Merchant Test' });
  const merchantHeaders = { 'Authorization': `Bearer ${merchantToken}` };

  // 1. Test /api/users
  const usersRes = await getRequest('/api/users?limit=10&offset=0', authHeaders);
  assert.equal(usersRes.statusCode, 200);
  assert.ok(usersRes.data.pagination, 'Must return pagination metadata on /api/users');
  assert.equal(usersRes.data.pagination.limit, 10, 'Limit must match requested');
  assert.equal(usersRes.data.pagination.offset, 0, 'Offset must match requested');
  assert.ok(typeof usersRes.data.pagination.total === 'number', 'Total count must be a number');

  // 2. Test max limit 200 clamp
  const maxClampRes = await getRequest('/api/users?limit=500', authHeaders);
  assert.equal(maxClampRes.data.pagination.limit, 200, 'Limit must be clamped to max 200');

  // 3. Test default limit 50
  const defaultLimitRes = await getRequest('/api/users', authHeaders);
  assert.equal(defaultLimitRes.data.pagination.limit, 50, 'Default limit must be 50');

  // 4. Test /api/admin/transactions
  const txnsRes = await getRequest('/api/admin/transactions?limit=25&offset=0', authHeaders);
  assert.equal(txnsRes.statusCode, 200);
  assert.ok(txnsRes.data.pagination, 'Must return pagination metadata on /api/admin/transactions');
  assert.equal(txnsRes.data.pagination.limit, 25);
  assert.ok(typeof txnsRes.data.pagination.total === 'number');

  // 5. Test /api/admin/withdrawals
  const wthRes = await getRequest('/api/admin/withdrawals?limit=15&offset=0', authHeaders);
  assert.equal(wthRes.statusCode, 200);
  assert.ok(wthRes.data.pagination, 'Must return pagination metadata on /api/admin/withdrawals');
  assert.equal(wthRes.data.pagination.limit, 15);
  assert.ok(typeof wthRes.data.pagination.total === 'number');

  // 6. Test /api/withdrawals/merchant/:id
  const mWithdrawalsRes = await getRequest('/api/withdrawals/merchant/MID1001?limit=10&offset=0', merchantHeaders);
  assert.equal(mWithdrawalsRes.statusCode, 200);
  assert.ok(mWithdrawalsRes.data.pagination, 'Must return pagination on /api/withdrawals/merchant/:id');
  assert.equal(mWithdrawalsRes.data.pagination.limit, 10);
  assert.ok(typeof mWithdrawalsRes.data.pagination.total === 'number');

  // 7. Test /api/transactions/merchant/:id
  const mTxnsRes = await getRequest('/api/transactions/merchant/MID1001?limit=10&offset=0', merchantHeaders);
  assert.equal(mTxnsRes.statusCode, 200);
  assert.ok(mTxnsRes.data.pagination, 'Must return pagination on /api/transactions/merchant/:id');
  assert.equal(mTxnsRes.data.pagination.limit, 10);
  assert.ok(typeof mTxnsRes.data.pagination.total === 'number');

  // 8. Test /api/wallets
  const walletsRes = await getRequest('/api/wallets?limit=20&offset=0', authHeaders);
  assert.equal(walletsRes.statusCode, 200);
  assert.ok(walletsRes.data.pagination, 'Must return pagination on /api/wallets');
  assert.equal(walletsRes.data.pagination.limit, 20);
  assert.ok(typeof walletsRes.data.pagination.total === 'number');

  // 9. Test /api/financial-ledger
  const ledgerRes = await getRequest('/api/financial-ledger?limit=30&offset=0', authHeaders);
  assert.equal(ledgerRes.statusCode, 200);
  assert.ok(ledgerRes.data.pagination, 'Must return pagination on /api/financial-ledger');
  assert.equal(ledgerRes.data.pagination.limit, 30);
  assert.ok(typeof ledgerRes.data.pagination.total === 'number');

  // 10. Test /api/inquiries
  const inquiriesRes = await getRequest('/api/inquiries?limit=5&offset=0', authHeaders);
  assert.equal(inquiriesRes.statusCode, 200);
  assert.ok(inquiriesRes.data.pagination, 'Must return pagination on /api/inquiries');
  assert.equal(inquiriesRes.data.pagination.limit, 5);
  assert.ok(typeof inquiriesRes.data.pagination.total === 'number');

  console.log('✓ PASS: All list endpoints strictly follow limit, offset, max 200, and total pagination contract.');
}

testPagination().then(() => {
  process.exit(0);
}).catch(err => {
  console.error('TEST FAILED:', err.message);
  process.exit(1);
});
