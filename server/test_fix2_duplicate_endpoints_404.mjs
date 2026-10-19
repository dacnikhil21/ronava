import assert from 'node:assert/strict';
import http from 'node:http';

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

async function testDuplicateEndpoints() {
  console.log('--- TEST: Duplicate Endpoints Return 404 ---');

  const oldEndpoints = [
    '/api/transactions/process-swipe',
    '/api/transactions/record-authoritative',
    '/api/withdrawals/execute',
    '/api/withdrawals/request-authoritative'
  ];

  for (const ep of oldEndpoints) {
    const res = await postRequest(ep, { test: 1 });
    assert.equal(
      res.statusCode, 
      404, 
      `Deleted endpoint ${ep} must return 404 Not Found. Got status ${res.statusCode}`
    );
    console.log(`✓ PASS: ${ep} returned 404`);
  }

  // Canonical endpoints must NOT return 404 (they exist)
  const canonicalSwipe = await postRequest('/api/transactions/record', {});
  assert.notEqual(canonicalSwipe.statusCode, 404, 'Canonical /api/transactions/record must exist (not 404)');

  const canonicalWithdrawal = await postRequest('/api/withdrawals/request', {});
  assert.notEqual(canonicalWithdrawal.statusCode, 404, 'Canonical /api/withdrawals/request must exist (not 404)');

  console.log('✓ Canonical endpoints are active and old duplicates return 404.');
}

testDuplicateEndpoints().then(() => {
  process.exit(0);
}).catch(err => {
  console.error('TEST FAILED:', err.message);
  process.exit(1);
});
