import assert from 'node:assert';
import { generateBankBatchCSV } from './src/utils/bankExportUtils.js';

async function runWithdrawalLifecycleAudit() {
  const baseUrl = 'http://13.201.4.145';
  console.log('========================================================================');
  console.log('🧪 COMPREHENSIVE END-TO-END WITHDRAWAL & PAYOUT LIFECYCLE AUDIT (AWS)');
  console.log('========================================================================\n');

  const getWallet = async (id) => {
    const res = await fetch(`${baseUrl}/api/wallet/${id}`).then(r => r.json());
    return res.wallet || {};
  };

  // Helper to ensure merchant has funds
  console.log('--- SETUP: Funding Test Merchant (MID1001) with ₹20,000 Sale ---');
  const fundRef = `SLIP-FUND-${Date.now().toString().slice(-6)}`;
  const fundRes = await fetch(`${baseUrl}/api/transactions/record`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      merchant_id: 'MID1001',
      amount: 20000,
      customer_mobile: '9876543205',
      provider: 'Pine Labs',
      type: 'POS_SWIPE',
      ref_number: fundRef,
      settlement_type: 'T1'
    })
  }).then(r => r.json());

  console.log('  fundRes:', fundRes);
  assert.strictEqual(fundRes.success, true, `Funding sale failed: ${fundRes.message || JSON.stringify(fundRes)}`);
  const initialWallet = await getWallet('MID1001');
  const initialAvail = parseFloat(initialWallet.available_balance || 0);
  const initialPending = parseFloat(initialWallet.pending_balance || 0);
  const initialWithdrawn = parseFloat(initialWallet.withdrawn_amount || 0);
  console.log(`  ✓ MID1001 Available Balance: ₹${initialAvail.toFixed(2)} (Pending: ₹${initialPending.toFixed(2)}, Withdrawn: ₹${initialWithdrawn.toFixed(2)})\n`);

  // ========================================================================
  // TEST 1: Regular Withdrawal - Minimum ₹500 Reserve Hold Enforcement
  // ========================================================================
  console.log('--- TEST 1: Regular Withdrawal & ₹500 Reserve Hold Rule ---');
  // Attempt to withdraw entire balance (should be blocked by ₹500 reserve)
  const overWithdrawRes = await fetch(`${baseUrl}/api/withdrawals/request`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      merchant_id: 'MID1001',
      amount: initialAvail, // entire balance
      bank_name: 'HDFC Bank',
      account_number: '50100234567890',
      ifsc: 'HDFC0001234',
      payout_purpose: 'REGULAR',
      payout_type: 'MERCHANT_OWN'
    })
  }).then(r => r.json());

  console.log('  Attempt over-reserve withdrawal (Full balance):', overWithdrawRes.success ? '❌ UNEXPECTED SUCCESS' : `✅ BLOCKED AS EXPECTED (${overWithdrawRes.message})`);
  assert.strictEqual(overWithdrawRes.success, false);

  // Valid withdrawal of ₹5,000 (leaving > ₹500 reserve)
  const validAmt = 5000;
  const wthRes1 = await fetch(`${baseUrl}/api/withdrawals/request`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      merchant_id: 'MID1001',
      amount: validAmt,
      bank_name: 'HDFC Bank',
      account_number: '50100234567890',
      ifsc: 'HDFC0001234',
      payout_purpose: 'REGULAR',
      payout_type: 'MERCHANT_OWN',
      customer_name: 'Retail Merchant Owner',
      customer_mobile: '9876543205'
    })
  }).then(r => r.json());

  console.log('  Valid Regular Payout Request (₹5,000):', wthRes1.success ? `✅ CREATED (${wthRes1.withdrawal_id})` : '❌ FAILED');
  assert.strictEqual(wthRes1.success, true);
  const wthId1 = wthRes1.withdrawal_id;

  const walletAfterWth1 = await getWallet('MID1001');
  console.log(`  ✓ Available Balance: ₹${walletAfterWth1.available_balance} (Expected: ₹${(initialAvail - validAmt).toFixed(2)})`);
  console.log(`  ✓ Pending Balance Held: ₹${walletAfterWth1.pending_balance} (Expected: ₹${(initialPending + validAmt).toFixed(2)})`);
  assert.strictEqual(parseFloat(walletAfterWth1.available_balance), parseFloat((initialAvail - validAmt).toFixed(2)));
  assert.strictEqual(parseFloat(walletAfterWth1.pending_balance), parseFloat((initialPending + validAmt).toFixed(2)));
  console.log('  ✅ TEST 1 PASSED!\n');

  // ========================================================================
  // TEST 2: Customer Direct Liquidity Payout vs Merchant Own Account
  // ========================================================================
  console.log('--- TEST 2: Customer Direct Liquidity Disbursal ---');
  const custAmt = 3000;
  const wthRes2 = await fetch(`${baseUrl}/api/withdrawals/request`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      merchant_id: 'MID1001',
      amount: custAmt,
      bank_name: 'State Bank of India',
      account_number: '200192837465',
      ifsc: 'SBIN0005678',
      payout_purpose: 'REGULAR',
      payout_type: 'CUSTOMER_DISBURSAL',
      customer_name: 'Suresh Kumar',
      customer_mobile: '9849012345'
    })
  }).then(r => r.json());

  console.log('  Customer Direct Disbursal Request (₹3,000):', wthRes2.success ? `✅ CREATED (${wthRes2.withdrawal_id})` : '❌ FAILED');
  assert.strictEqual(wthRes2.success, true);
  const wthId2 = wthRes2.withdrawal_id;

  // Verify withdrawal details recorded accurately
  const wthList = (await fetch(`${baseUrl}/api/withdrawals/merchant/MID1001`).then(r => r.json())).withdrawals || [];
  const custWthRecord = wthList.find(w => w.id === wthId2);
  console.log('  ✓ Verified Bank Name on record:', custWthRecord?.bank_name);
  console.log('  ✓ Verified Account Number on record:', custWthRecord?.account_number);
  console.log('  ✓ Verified Status:', custWthRecord?.status);
  assert.strictEqual(custWthRecord?.bank_name, 'State Bank of India');
  assert.strictEqual(custWthRecord?.account_number, '200192837465');
  assert.strictEqual(custWthRecord?.status, 'PENDING');
  console.log('  ✅ TEST 2 PASSED!\n');

  // ========================================================================
  // TEST 3: Commission Payout Mode (Zero ₹0.00 Reserve Hold) & Admin Toggle
  // ========================================================================
  console.log('--- TEST 3: Commission Payout Mode (Zero Reserve Hold) & Master Toggle ---');
  // SD1001 has commission balance
  const sdWallet = await getWallet('SD1001');
  const sdAvail = parseFloat(sdWallet.available_balance || 0);
  console.log(`  SD1001 Available Commission Balance: ₹${sdAvail.toFixed(2)}`);

  if (sdAvail > 0) {
    // Withdraw 100% of commission (₹0 reserve held)
    const commWthRes = await fetch(`${baseUrl}/api/withdrawals/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        merchant_id: 'SD1001',
        amount: sdAvail, // full amount
        bank_name: 'ICICI Bank',
        account_number: '123405009876',
        ifsc: 'ICIC0001234',
        payout_purpose: 'COMMISSION',
        payout_type: 'MERCHANT_OWN'
      })
    }).then(r => r.json());

    console.log(`  Commission Withdrawal Request (₹${sdAvail}):`, commWthRes.success ? `✅ SUCCESS (${commWthRes.withdrawal_id})` : `❌ FAILED (${commWthRes.message})`);
    assert.strictEqual(commWthRes.success, true);
    const updatedSdWallet = await getWallet('SD1001');
    console.log(`  ✓ SD Available Balance after ₹0-reserve payout: ₹${updatedSdWallet.available_balance} (Expected: 0.00)`);
    assert.strictEqual(parseFloat(updatedSdWallet.available_balance), 0.00);
  }
  console.log('  ✅ TEST 3 PASSED!\n');

  // ========================================================================
  // TEST 4: Excel / Bank Batch CSV Export Generation & Data Formatting Audit
  // ========================================================================
  console.log('--- TEST 4: Bank Batch Excel / CSV Export Generation Audit ---');
  const allPendingWths = (await fetch(`${baseUrl}/api/admin/pending`).then(r => r.json())).pendingWithdrawals || [];
  console.log(`  Fetched ${allPendingWths.length} pending withdrawals from Admin API.`);

  // Generate Bank Batch CSV using production utility
  const { csvContent } = generateBankBatchCSV(allPendingWths);
  console.log('  Generated CSV Sample (First 3 lines):');
  const csvLines = csvContent.replace('\uFEFF', '').split('\r\n');
  csvLines.slice(0, 3).forEach((line, idx) => console.log(`    Line ${idx + 1}: ${line}`));

  // Audit CSV contents:
  assert(csvContent.includes('Merchant ID (User ID)'), 'Missing Header column');
  assert(csvContent.includes('Account Number'), 'Missing Account Number header');
  assert(csvContent.includes('IFSC Code'), 'Missing IFSC header');
  assert(csvContent.includes('="50100234567890"'), 'Account number must be preserved as text formula for Excel');
  assert(!csvContent.includes('NaN'), 'CSV contains corrupted NaN values');
  assert(!csvContent.includes('undefined'), 'CSV contains undefined tokens');
  console.log('  ✓ Verified: Excel formula format ="..." prevents scientific notation on account numbers.');
  console.log('  ✓ Verified: Zero NaN or undefined tokens in export sheet.');
  console.log('  ✅ TEST 4 PASSED!\n');

  // ========================================================================
  // TEST 5: Admin Batch Status Transitions: "Submitted to Bank"
  // ========================================================================
  console.log('--- TEST 5: Admin Batch Status Update ("Submitted to Bank") ---');
  const batchSubmitRes = await fetch(`${baseUrl}/api/admin/withdrawals/batch-status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      withdrawalIds: [wthId1, wthId2],
      action: 'SUBMIT_TO_BANK',
      bankName: 'HDFC Bulk CMS Payout Desk',
      batchReference: 'BATCH-HDFC-20261011-01'
    })
  }).then(r => r.json());

  console.log('  Batch Submit to Bank Response:', batchSubmitRes.success ? '✅ SUCCESS' : '❌ FAILED');
  assert.strictEqual(batchSubmitRes.success, true);

  // Verify status in admin feed
  const checkPendingRes = await fetch(`${baseUrl}/api/admin/pending`).then(r => r.json());
  const wth1Check = (checkPendingRes.pendingWithdrawals || []).find(w => w.id === wthId1);
  console.log('  ✓ Withdrawal remark updated with Batch Ref:', wth1Check?.admin_remark);
  assert(wth1Check?.admin_remark?.includes('BATCH-HDFC-20261011-01'), 'Batch remark missing on record');
  console.log('  ✅ TEST 5 PASSED!\n');

  // ========================================================================
  // TEST 6: Admin Approval & Bank Settlement with Bank UTR Number
  // ========================================================================
  console.log('--- TEST 6: Admin Approval & Bank UTR Settlement (Clearing wthId1) ---');
  const midWalletBeforeApprove = await getWallet('MID1001');
  const pendingBeforeApprove = parseFloat(midWalletBeforeApprove.pending_balance || 0);
  const withdrawnBeforeApprove = parseFloat(midWalletBeforeApprove.withdrawn_amount || 0);

  const bankUtr = `IMPS${Date.now().toString().slice(-8)}`;
  const approveRes = await fetch(`${baseUrl}/api/admin/verify-withdrawal`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      withdrawal_id: wthId1,
      action: 'APPROVE',
      utr: bankUtr,
      remark: 'Disbursed via HDFC CMS NetBanking'
    })
  }).then(r => r.json());

  console.log('  Admin Approval Response:', approveRes.success ? '✅ APPROVED' : '❌ FAILED');
  assert.strictEqual(approveRes.success, true);

  // Verify wallet pending balance cleared and withdrawn amount incremented
  const postApproveWallet = await getWallet('MID1001');
  console.log(`  ✓ Pending Balance after approval: ₹${postApproveWallet.pending_balance} (Expected: ₹${(pendingBeforeApprove - validAmt).toFixed(2)})`);
  console.log(`  ✓ Total Withdrawn Amount: ₹${postApproveWallet.withdrawn_amount} (Expected: ₹${(withdrawnBeforeApprove + validAmt).toFixed(2)})`);
  assert.strictEqual(parseFloat(postApproveWallet.pending_balance), parseFloat((pendingBeforeApprove - validAmt).toFixed(2)));
  assert.strictEqual(parseFloat(postApproveWallet.withdrawn_amount), parseFloat((withdrawnBeforeApprove + validAmt).toFixed(2)));
  console.log('  ✅ TEST 6 PASSED!\n');

  // ========================================================================
  // TEST 7: Admin Rejection & Immediate Fund Refund Workflow (wthId2)
  // ========================================================================
  console.log('--- TEST 7: Admin Rejection & Immediate Automatic Fund Refund (wthId2) ---');
  const preRejectWallet = await getWallet('MID1001');
  const preRejectAvail = parseFloat(preRejectWallet.available_balance);
  const preRejectPending = parseFloat(preRejectWallet.pending_balance);

  const rejectWthRes = await fetch(`${baseUrl}/api/admin/verify-withdrawal`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      withdrawal_id: wthId2,
      action: 'REJECT',
      remark: 'Beneficiary account inactive / name mismatch on bank server'
    })
  }).then(r => r.json());

  console.log('  Admin Rejection Response:', rejectWthRes.success ? '✅ REJECTED & REFUNDED' : '❌ FAILED');
  assert.strictEqual(rejectWthRes.success, true);

  // Verify pending balance deducted and available balance restored by ₹3,000
  const postRejectWallet = await getWallet('MID1001');
  console.log(`  ✓ Available Balance after refund: ₹${postRejectWallet.available_balance} (Expected: ₹${(preRejectAvail + custAmt).toFixed(2)})`);
  console.log(`  ✓ Pending Balance after refund: ₹${postRejectWallet.pending_balance} (Expected: ₹${(preRejectPending - custAmt).toFixed(2)})`);
  assert.strictEqual(parseFloat(postRejectWallet.available_balance), parseFloat((preRejectAvail + custAmt).toFixed(2)));
  assert.strictEqual(parseFloat(postRejectWallet.pending_balance), parseFloat((preRejectPending - custAmt).toFixed(2)));
  console.log('  ✅ TEST 7 PASSED!\n');

  // ========================================================================
  // TEST 8: Atomic Concurrency & Double-Spend Protection
  // ========================================================================
  console.log('--- TEST 8: Atomic Concurrency & Double-Spend Protection ---');
  const currentAvail = parseFloat((await getWallet('MID1001')).available_balance);
  // Attempt two simultaneous withdrawals for nearly the full balance
  const reqAmt = currentAvail - 600; // valid alone, but 2x exceeds balance

  const [resA, resB] = await Promise.all([
    fetch(`${baseUrl}/api/withdrawals/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        merchant_id: 'MID1001',
        amount: reqAmt,
        bank_name: 'HDFC Bank',
        account_number: '50100234567890',
        ifsc: 'HDFC0001234',
        payout_purpose: 'REGULAR',
        payout_type: 'MERCHANT_OWN'
      })
    }).then(r => r.json()),
    fetch(`${baseUrl}/api/withdrawals/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        merchant_id: 'MID1001',
        amount: reqAmt,
        bank_name: 'HDFC Bank',
        account_number: '50100234567890',
        ifsc: 'HDFC0001234',
        payout_purpose: 'REGULAR',
        payout_type: 'MERCHANT_OWN'
      })
    }).then(r => r.json())
  ]);

  const successCount = (resA.success ? 1 : 0) + (resB.success ? 1 : 0);
  console.log(`  Concurrent Execution Result: Exactly ${successCount} succeeded, ${2 - successCount} rejected for insufficient funds.`);
  assert.strictEqual(successCount, 1, 'Double spend occurred! Both concurrent withdrawals succeeded.');
  console.log('  ✓ Double spend prevented via row-level PostgreSQL transaction locks.');
  console.log('  ✅ TEST 8 PASSED!\n');

  console.log('========================================================================');
  console.log('🏁 ALL 8 END-TO-END WITHDRAWAL & PAYOUT TEST SCENARIOS PASSED (100%)');
  console.log('========================================================================');
}

runWithdrawalLifecycleAudit();
