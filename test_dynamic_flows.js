// 5 Automated End-to-End Dynamic Integration Tests for RONAV FinTech Platform
// Tests live database connectivity, swipe provider detection, admin pending reflection, and wallet ledger updates.

const BASE_URL = 'http://localhost:3000/api';

async function request(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  return res.json();
}

async function runAllTests() {
  console.log('\n============================================================');
  console.log('🚀 RUNNING 5 DYNAMIC DATABASE INTEGRATION TEST CASES');
  console.log('============================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✓ [PASS] ${message}`);
      passed++;
    } else {
      console.error(`  ✕ [FAIL] ${message}`);
      failed++;
    }
  }

  try {
    // -------------------------------------------------------------
    // TEST CASE 1: Record Pine Labs POS Swipe (₹4,500)
    // -------------------------------------------------------------
    console.log('TEST CASE 1: Merchant records a Pine Labs POS Swipe (₹4,500)');
    const t1Ref = `UTR-PL-${Date.now().toString().slice(-6)}`;
    const sale1Res = await request('/transactions/record', {
      method: 'POST',
      body: JSON.stringify({
        merchant_id: 'MID3001',
        amount: 4500,
        customer_mobile: '9849011223',
        type: 'POS_SWIPE',
        provider: 'Pine Labs',
        ref_number: t1Ref,
        notes: 'Pine Labs POS Swipe (RuPay Card) • 1.25% MDR - ₹4500'
      })
    });

    assert(sale1Res.success === true, 'Pine Labs swipe recorded successfully');

    // Check Admin Pending list immediately
    const admin1 = await request('/admin/pending');
    assert(admin1.success === true, 'Admin pending endpoint returned status 200');
    
    const pendingTxn1 = admin1.pendingTransactions.find(t => t.ref_number === t1Ref);
    assert(pendingTxn1 !== undefined, 'Transaction appears immediately in Admin Pending list');
    assert(pendingTxn1?.pos_provider === 'Pine Labs', `Provider correctly recorded as Pine Labs (got: ${pendingTxn1?.pos_provider})`);
    assert(parseFloat(pendingTxn1?.amount) === 4500, 'Transaction amount correctly recorded as ₹4,500');

    // -------------------------------------------------------------
    // TEST CASE 2: Record Payswiff POS Swipe (₹7,200)
    // -------------------------------------------------------------
    console.log('\nTEST CASE 2: Merchant records a Payswiff POS Swipe (₹7,200)');
    const t2Ref = `UTR-SW-${Date.now().toString().slice(-6)}`;
    const sale2Res = await request('/transactions/record', {
      method: 'POST',
      body: JSON.stringify({
        merchant_id: 'MID3001',
        amount: 7200,
        customer_mobile: '9700988776',
        type: 'POS_SWIPE',
        provider: 'Payswiff',
        ref_number: t2Ref,
        notes: 'Payswiff POS Swipe (Mastercard) • 1.65% MDR - ₹7200'
      })
    });

    assert(sale2Res.success === true, 'Payswiff swipe recorded successfully');

    // Check Admin Pending list
    const admin2 = await request('/admin/pending');
    const pendingTxn2 = admin2.pendingTransactions.find(t => t.ref_number === t2Ref);
    assert(pendingTxn2 !== undefined, 'Payswiff transaction appears in Admin Pending list');
    assert(pendingTxn2?.pos_provider === 'Payswiff', `Provider correctly recorded as Payswiff (got: ${pendingTxn2?.pos_provider})`);
    assert(parseFloat(pendingTxn2?.amount) === 7200, 'Transaction amount correctly recorded as ₹7,200');

    // -------------------------------------------------------------
    // TEST CASE 3: Admin Approves the Pine Labs Transaction
    // -------------------------------------------------------------
    console.log('\nTEST CASE 3: Admin Approves the Pine Labs Swipe & Credits Merchant Wallet');
    const preWallet = await request('/wallet/MID3001');
    const initialBalance = parseFloat(preWallet.wallet.available_balance);

    const approveTxnRes = await request('/admin/verify-transaction', {
      method: 'POST',
      body: JSON.stringify({
        txn_id: pendingTxn1.id,
        action: 'APPROVE',
        remark: 'Approved by Super Admin after bank terminal verification'
      })
    });

    assert(approveTxnRes.success === true, 'Admin approval request returned success');
    assert(approveTxnRes.transaction?.status === 'APPROVED', 'Transaction status updated to APPROVED in database');

    const postWallet = await request('/wallet/MID3001');
    const newBalance = parseFloat(postWallet.wallet.available_balance);
    assert(newBalance === initialBalance + 4500, `Merchant available balance credited: was ₹${initialBalance}, now ₹${newBalance}`);

    // Verify it is no longer in pending list
    const adminAfterApprove = await request('/admin/pending');
    const stillPending = adminAfterApprove.pendingTransactions.some(t => t.id === pendingTxn1.id);
    assert(!stillPending, 'Approved transaction removed from Admin Pending list');

    // -------------------------------------------------------------
    // TEST CASE 4: Merchant Requests Bank Withdrawal (₹3,000)
    // -------------------------------------------------------------
    console.log('\nTEST CASE 4: Merchant Requests a Bank Withdrawal (₹3,000)');
    const withdrawRes = await request('/withdrawals/request', {
      method: 'POST',
      body: JSON.stringify({
        merchant_id: 'MID3001',
        amount: 3000,
        bank_name: 'State Bank of India',
        account_number: '30891245678',
        ifsc: 'SBIN0001234'
      })
    });

    assert(withdrawRes.success === true, 'Withdrawal request created successfully');
    const wthId = withdrawRes.withdrawal?.id;
    assert(Boolean(wthId), `Received valid withdrawal ID (${wthId})`);

    // Verify it appears in Admin Pending Withdrawals
    const adminWithdrawals = await request('/admin/pending');
    const pendingWth = adminWithdrawals.pendingWithdrawals.find(w => w.id === wthId);
    assert(pendingWth !== undefined, 'Withdrawal appears in Admin Pending Withdrawals table');
    assert(parseFloat(pendingWth?.amount) === 3000, 'Withdrawal amount is ₹3,000');
    assert(pendingWth?.status === 'PENDING', 'Withdrawal status is PENDING');

    // -------------------------------------------------------------
    // TEST CASE 5: Admin Approves the Bank Withdrawal
    // -------------------------------------------------------------
    console.log('\nTEST CASE 5: Admin Approves the Bank Withdrawal & Updates Settled Amount');
    const preWthWallet = await request('/wallet/MID3001');
    const preWithdrawnAmount = parseFloat(preWthWallet.wallet.withdrawn_amount);

    const approveWthRes = await request('/admin/verify-withdrawal', {
      method: 'POST',
      body: JSON.stringify({
        withdrawal_id: wthId,
        action: 'APPROVE',
        remark: 'IMPS Bank Transfer Dispatched via SBI Gateway'
      })
    });

    assert(approveWthRes.success === true, 'Admin withdrawal approval request returned success');
    assert(approveWthRes.withdrawal?.status === 'APPROVED', 'Withdrawal status updated to APPROVED');

    const postWthWallet = await request('/wallet/MID3001');
    const postWithdrawnAmount = parseFloat(postWthWallet.wallet.withdrawn_amount);
    assert(postWithdrawnAmount === preWithdrawnAmount + 3000, `Withdrawn total incremented: was ₹${preWithdrawnAmount}, now ₹${postWithdrawnAmount}`);

    // Verify withdrawal removed from pending
    const adminAfterWth = await request('/admin/pending');
    const stillPendingWth = adminAfterWth.pendingWithdrawals.some(w => w.id === wthId);
    assert(!stillPendingWth, 'Approved payout removed from Admin Pending list');

    console.log('\n============================================================');
    console.log(`🏁 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('============================================================\n');

    if (failed === 0) {
      console.log('✨ ALL 5 DYNAMIC DATABASE TEST CASES PASSED FLAWLESSLY!');
      process.exit(0);
    } else {
      process.exit(1);
    }
  } catch (err) {
    console.error('Fatal error during test run:', err);
    process.exit(1);
  }
}

runAllTests();
