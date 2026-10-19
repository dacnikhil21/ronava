import assert from 'node:assert/strict';
import http from 'node:http';
import { generateToken } from './security.js';

const BASE_URL = process.env.TEST_API_URL || 'http://localhost:3000';

function postRequest(path, body = {}, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const data = JSON.stringify(body);
    const req = http.request({
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
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
    req.write(data);
    req.end();
  });
}

async function testIdentityGuards() {
  console.log('--- TEST: Strict Identity & Authorization Guards ---');

  // 1. Unauthenticated requests MUST return 401
  const unauthSwipe = await postRequest('/api/transactions/record', {
    merchant_id: 'MID1001',
    amount: 1000,
    channel: 'pinelabs',
    settlement_type: 'T1'
  });
  assert.equal(unauthSwipe.statusCode, 401, 'Unauthenticated transaction record must be refused with 401');

  const unauthWithdraw = await postRequest('/api/withdrawals/request', {
    merchant_id: 'MID1001',
    amount: 500,
    channel: 'pinelabs'
  });
  assert.equal(unauthWithdraw.statusCode, 401, 'Unauthenticated withdrawal request must be refused with 401');

  // 2. Spoofing merchant_id from another account MUST return 403
  // Merchant A tries to swipe or withdraw for Merchant B
  const merchantAToken = generateToken({ id: 'MID_ATTACKER_A', role: 'MERCHANT', name: 'Attacker A' });
  const spoofedSwipe = await postRequest('/api/transactions/record', {
    merchant_id: 'MID_VICTIM_B',
    amount: 1000,
    channel: 'pinelabs',
    settlement_type: 'T1'
  }, {
    'Authorization': `Bearer ${merchantAToken}`
  });
  assert.equal(spoofedSwipe.statusCode, 403, 'Merchant A spoofing Merchant B swipe must be refused with 403 Forbidden');

  const spoofedWithdrawal = await postRequest('/api/withdrawals/request', {
    merchant_id: 'MID_VICTIM_B',
    amount: 1000,
    channel: 'pinelabs'
  }, {
    'Authorization': `Bearer ${merchantAToken}`
  });
  assert.equal(spoofedWithdrawal.statusCode, 403, 'Merchant A spoofing Merchant B withdrawal must be refused with 403 Forbidden');

  // 3. Spoofed headers (x-caller-id / x-user-id) without valid bearer token MUST fail
  const headerSpoof = await postRequest('/api/transactions/record', {
    amount: 1000,
    channel: 'pinelabs',
    settlement_type: 'T1'
  }, {
    'x-caller-id': 'ADM001',
    'x-user-id': 'ADM001',
    'x-caller-role': 'ADMIN'
  });
  assert.equal(headerSpoof.statusCode, 401, 'Request with spoofed headers but missing token must be refused with 401');

  console.log('✓ PASS: All strict identity guards verified (401 unauth, 403 spoofing refused).');
}

testIdentityGuards().then(() => {
  process.exit(0);
}).catch(err => {
  console.error('TEST FAILED:', err.message);
  process.exit(1);
});
