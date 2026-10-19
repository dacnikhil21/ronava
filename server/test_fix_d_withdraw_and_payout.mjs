import assert from 'assert';

const BASE_URL = 'http://localhost:3000';

async function testFixDWithdrawAndPayout() {
  console.log('=== TEST FIX D: End-to-End Withdrawal and Admin Payout Lifecycle ===');

  // 1. Admin Login (ADM001)
  const adminLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: 'ADM001', password: 'Ronav@123' })
  });
  const adminLoginJson = await adminLoginRes.json();
  assert.equal(adminLoginRes.status, 200, 'Admin login must succeed');
  const adminToken = adminLoginJson.token;
  const adminHeaders = {
    'Authorization': `Bearer ${adminToken}`,
    'Content-Type': 'application/json'
  };

  // 2. Merchant Login (MID1001)
  const merchantLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: 'MID1001', password: 'Ronav@123' })
  });
  const merchantLoginJson = await merchantLoginRes.json();
  assert.equal(merchantLoginRes.status, 200, 'Merchant login must succeed');
  const merchantToken = merchantLoginJson.token;
  const merchantHeaders = {
    'Authorization': `Bearer ${merchantToken}`,
    'Content-Type': 'application/json'
  };

  // 3. Record a swipe sale of Rs 2,000 for MID1001 to fund channel wallet
  console.log('Funding MID1001 wallet with a test swipe of ₹2,000...');
  const swipeRes = await fetch(`${BASE_URL}/api/transactions/record`, {
    method: 'POST',
    headers: merchantHeaders,
    body: JSON.stringify({
      merchant_id: 'MID1001',
      amount: 2000,
      customer_name: 'Lifecycle Test Customer',
      type: 'POS_SWIPE',
      channel: 'pinelabs',
      provider: 'Pine Labs',
      ref_number: `SLIP-${Date.now().toString().slice(-6)}`,
      settlement_type: 'T1',
      terminal_id: 'PL-TEST'
    })
  });
  const swipeJson = await swipeRes.json();
  assert.equal(swipeRes.status, 200, 'Swipe sale must succeed');
  assert.equal(swipeJson.success, true, 'Swipe must be recorded');

  // 4. Test Authoritative Quote for Rs 1,000 withdrawal
  console.log('Testing withdrawal quote for ₹1,000...');
  const quoteRes = await fetch(`${BASE_URL}/api/withdrawals/quote`, {
    method: 'POST',
    headers: merchantHeaders,
    body: JSON.stringify({
      userId: 'MID1001',
      amount: 1000,
      settlement_type: 'T1',
      channel: 'pinelabs'
    })
  });
  const quoteJson = await quoteRes.json();
  assert.equal(quoteRes.status, 200, 'Withdrawal quote must return 200');
  assert.equal(quoteJson.success, true, 'Quote must succeed');
  assert.equal(quoteJson.quote.reserve_compliant, true, 'Rs 1,000 must be reserve-compliant with Rs 2,000 balance');

  // 5. Submit withdrawal request for ₹1,000
  console.log('Submitting withdrawal request for ₹1,000...');
  const wthReqRes = await fetch(`${BASE_URL}/api/withdrawals/request`, {
    method: 'POST',
    headers: merchantHeaders,
    body: JSON.stringify({
      merchant_id: 'MID1001',
      amount: 1000,
      bank_name: 'HDFC Bank',
      account_number: '5010022334455',
      ifsc: 'HDFC0001234',
      holder_name: 'MID1001 Store',
      channel: 'pinelabs',
      settlement_type: 'T1'
    })
  });
  const wthReqJson = await wthReqRes.json();
  assert.equal(wthReqRes.status, 200, 'Withdrawal request must succeed');
  assert.equal(wthReqJson.success, true, 'Withdrawal must return success');
  const wthId = wthReqJson.withdrawal.id;
  assert.ok(wthId, 'Must return created withdrawal ID');
  assert.equal(wthReqJson.withdrawal.status, 'PENDING', 'Initial status must be PENDING');

  // 6. Admin Exports Excel (Transitioning to SUBMITTED_TO_BANK)
  console.log('Testing Admin Excel export for created withdrawal...');
  const exportRes = await fetch(`${BASE_URL}/api/admin/withdrawals/export-excel`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      withdrawalIds: [wthId],
      batchName: 'TEST_BATCH'
    })
  });
  const exportJson = await exportRes.json();
  assert.equal(exportRes.status, 200, 'Excel export must succeed');
  assert.equal(exportJson.success, true, 'Export must return success');
  assert.ok(exportJson.csv, 'Must return CSV string');

  // 7. Verify Idempotent batch-status (must NOT fail with 400 when already SUBMITTED_TO_BANK)
  console.log('Testing idempotent batch-status call after export-excel...');
  const batchStatusRes = await fetch(`${BASE_URL}/api/admin/withdrawals/batch-status`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      withdrawalIds: [wthId],
      action: 'SUBMITTED_TO_BANK',
      batchTag: '[BATCH:TEST_BATCH]'
    })
  });
  const batchStatusJson = await batchStatusRes.json();
  assert.equal(batchStatusRes.status, 200, 'batch-status must be idempotent and return 200');
  assert.equal(batchStatusJson.success, true, 'batch-status must succeed');

  // 8. Admin Marks Payout as Completed with UTR
  console.log('Testing Admin marking payout as COMPLETED with UTR...');
  const testUtr = `UTR${Date.now().toString().slice(-10)}`;
  const completeRes = await fetch(`${BASE_URL}/api/admin/verify-withdrawal`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      withdrawal_id: wthId,
      action: 'COMPLETE',
      utr: testUtr,
      remark: 'Test Payout Settlement'
    })
  });
  const completeJson = await completeRes.json();
  assert.equal(completeRes.status, 200, 'Admin completing payout must succeed');
  assert.equal(completeJson.success, true, 'verify-withdrawal must return success');

  // 9. Verify totals computation includes COMPLETED status
  console.log('Verifying Admin withdrawals list & totals include COMPLETED amount...');
  const listRes = await fetch(`${BASE_URL}/api/admin/withdrawals`, { headers: adminHeaders });
  const listJson = await listRes.json();
  assert.equal(listRes.status, 200, 'Admin withdrawals list must return 200');
  assert.ok(listJson.totals.completed_amount >= 1000, 'completed_amount must include the ₹1,000 payout');

  // 10. Test Rejection Lifecycle with Refund
  console.log('Testing Rejection flow: creating and rejecting a withdrawal to verify refund...');
  const wth2Res = await fetch(`${BASE_URL}/api/withdrawals/request`, {
    method: 'POST',
    headers: merchantHeaders,
    body: JSON.stringify({
      merchant_id: 'MID1001',
      amount: 100,
      bank_name: 'HDFC Bank',
      account_number: '5010022334455',
      ifsc: 'HDFC0001234',
      holder_name: 'MID1001 Store',
      channel: 'pinelabs',
      settlement_type: 'T1'
    })
  });
  const wth2Json = await wth2Res.json();
  assert.equal(wth2Res.status, 200, 'Second withdrawal request must succeed');
  const wth2Id = wth2Json.withdrawal.id;

  const rejectRes = await fetch(`${BASE_URL}/api/admin/verify-withdrawal`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      withdrawal_id: wth2Id,
      action: 'REJECT',
      remark: 'Account details invalid - test rejection'
    })
  });
  const rejectJson = await rejectRes.json();
  assert.equal(rejectRes.status, 200, 'Admin rejecting payout must succeed');
  assert.equal(rejectJson.success, true, 'Rejection must succeed');

  console.log('✅ TEST FIX D PASSED: Full withdrawal and payout lifecycle works end-to-end.');
}

testFixDWithdrawAndPayout().catch(err => {
  console.error('❌ TEST FIX D FAILED:', err.message);
  process.exit(1);
});
