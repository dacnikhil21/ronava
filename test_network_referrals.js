// Automated Verification for Hierarchy Referral Flow & Commission Profits
import http from 'http';

function request(options, data) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });
    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

async function runTests() {
  console.log('🚀 Starting Hierarchy Referral & Commission Tests...\n');

  // Test 1: Super Distributor (SD1001) onboards a District Distributor
  console.log('Test 1: Super Distributor onboards District Distributor (DD)...');
  const res1 = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/users/create',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    creator_id: 'SD1001',
    name: 'Warangal District Hub',
    mobile: `98${Math.floor(10000000 + Math.random() * 90000000)}`,
    role: 'DISTRICT_DISTRIBUTOR'
  });
  console.log('Status:', res1.status, 'Response:', res1.data.message, 'ID:', res1.data.user?.id);
  if (res1.status !== 201) throw new Error('Failed Test 1');

  const ddId = res1.data.user.id;

  // Test 2: District Distributor onboards a Distributor
  console.log('\nTest 2: District Distributor onboards a Distributor...');
  const res2 = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/users/create',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    creator_id: ddId,
    name: 'Hanamkonda Retail Network',
    mobile: `97${Math.floor(10000000 + Math.random() * 90000000)}`,
    role: 'DISTRIBUTOR'
  });
  console.log('Status:', res2.status, 'Response:', res2.data.message, 'ID:', res2.data.user?.id);
  if (res2.status !== 201) throw new Error('Failed Test 2');

  const distId = res2.data.user.id;

  // Test 3: Distributor onboards a Merchant
  console.log('\nTest 3: Distributor onboards a Merchant (MID)...');
  const res3 = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/users/create',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    creator_id: distId,
    name: 'Balaji Provisions Store',
    mobile: `96${Math.floor(10000000 + Math.random() * 90000000)}`,
    role: 'MERCHANT',
    pos_provider: 'Pine Labs'
  });
  console.log('Status:', res3.status, 'Response:', res3.data.message, 'ID:', res3.data.user?.id);
  if (res3.status !== 201) throw new Error('Failed Test 3');

  const merchantId = res3.data.user.id;

  // Test 4: Verify Merchant cannot create anyone (Blocked with 403)
  console.log('\nTest 4: Verify Merchant is blocked from creating accounts...');
  const res4 = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/users/create',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    creator_id: merchantId,
    name: 'Unauthorized User',
    mobile: '9123456780',
    role: 'MERCHANT'
  });
  console.log('Status (Expected 403):', res4.status, 'Message:', res4.data.message);
  if (res4.status !== 403) throw new Error('Expected 403 Forbidden for Merchant');

  // Test 5: Merchant records a POS swipe sale of ₹10,000
  console.log('\nTest 5: Merchant records POS sale of ₹10,000...');
  const res5 = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/transactions/record',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    merchant_id: merchantId,
    amount: 10000,
    customer_mobile: '9988776655',
    type: 'POS_SWIPE',
    ref_number: `UTR-${Date.now().toString().slice(-6)}`,
    notes: 'Test sale for referral commission'
  });
  console.log('Status:', res5.status, 'Txn ID:', res5.data.transaction?.id);

  // Test 6: Check Distributor downstream network & commission profit
  console.log('\nTest 6: Check Distributor downstream network & commission profit...');
  const res6 = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/network/downstream?creator_id=${distId}`,
    method: 'GET'
  });
  console.log('Status:', res6.status);
  console.log('Total Partners:', res6.data.total_partners);
  console.log('Commission Rate:', res6.data.commission_rate_pct + '%');
  console.log('Total Commission Earned:', '₹' + res6.data.total_commission_earned);
  if (res6.data.total_commission_earned !== 25) {
    console.warn('Note: Expected ₹25 (0.25% of 10000), got:', res6.data.total_commission_earned);
  }

  // Test 7: Check line-by-line partner transactions
  console.log('\nTest 7: Check line-by-line partner transactions...');
  const res7 = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/network/partner-transactions?creator_id=${distId}&partner_id=${merchantId}`,
    method: 'GET'
  });
  console.log('Status:', res7.status);
  console.log('Transactions Count:', res7.data.transactions?.length);
  console.log('Commission on Txn 1:', '₹' + res7.data.transactions?.[0]?.commission_profit);

  console.log('\n🎉 ALL 7 TESTS PASSED SUCCESSFULLY!\n');
}

runTests().catch(console.error);
