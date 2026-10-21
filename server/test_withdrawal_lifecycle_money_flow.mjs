import assert from 'node:assert/strict';
import http from 'node:http';
process.env.TEST_DATABASE_URL = 'postgres://postgres:postgres@localhost:5432/ronav_test_db';
import { getDbPool } from './pg_db.js';
import { resetTestDatabase } from './test_db_helper.js';
import { setUserRate } from './rate_engine.js';
import { handleApiRequest } from './api.js';
import { generateToken } from './security.js';
import { postLedgerEntry, getWalletBalances } from './ledger_engine.js';

const PORT = 5992;

async function runWithdrawalLifecycleMoneyFlowTests() {
  console.log('========================================================================');
  console.log('    TEST SUITE: Strict Withdrawal Money Flow & Bank Failure Safety     ');
  console.log('========================================================================\n');

  const pool = getDbPool();
  const client = await pool.connect();

  const ts = Date.now().toString().slice(-4);
  const MERCHANT_ID = `MID-FLW-${ts}`;
  const ADMIN_ID = 'ADM001';
  let benId;

  try {
    const mobile = '97' + Math.floor(10000000 + Math.random() * 89999999);
    // 1. Setup Admin and Merchant
    await client.query(`
      INSERT INTO users (id, name, mobile, role) VALUES
        ('${ADMIN_ID}', 'Admin User', '9999000001', 'ADMIN'),
        ('${MERCHANT_ID}', 'Money Flow Merchant', '${mobile}', 'MERCHANT')
      ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role;
    `);

    // Fund merchant with ₹20,000 (2,000,000 paise) via ledger entry
    await postLedgerEntry(client, {
      userId: MERCHANT_ID,
      type: 'swipe_credit',
      amountPaise: 2000000n,
      referenceId: 'INITIAL-SWIPE-20000',
      referenceType: 'TRANSACTION',
      channel: 'pinelabs',
      createdBy: MERCHANT_ID
    });

    // Rates & beneficiary
    await setUserRate(client, { userId: MERCHANT_ID, channel: 'pinelabs', settlementMode: 'T1', rateBps: 150 });

    benId = `BEN-${ts}-01`;
    await client.query(`
      INSERT INTO beneficiaries (id, merchant_id, bank_name, account_number, ifsc, holder_name, is_verified)
      VALUES ($1, $2, 'HDFC Bank', '123456789012', 'HDFC0001234', 'Money Flow Merchant', TRUE)
      ON CONFLICT (id) DO NOTHING;
    `, [benId, MERCHANT_ID]);

    // Initial dummy swipe so merchant has T1 history
    const initialSwipeId = `TXN-SWIPE-T1-${ts}`;
    await client.query(`
      INSERT INTO transactions (id, merchant_id, amount_paise, customer_charge_paise, net_amount_paise, type, channel, settlement_mode, status)
      VALUES ($1, $2, 2000000, 30000, 1970000, 'POS_SWIPE', 'pinelabs', 'T1', 'APPROVED')
      ON CONFLICT (id) DO NOTHING;
    `, [initialSwipeId, MERCHANT_ID]);
  } finally {
    client.release();
  }

  const server = http.createServer((req, res) => {
    handleApiRequest(req, res).catch(err => {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, message: err.message }));
    });
  });

  await new Promise(resolve => server.listen(PORT, resolve));
  console.log(`Test HTTP server listening on http://127.0.0.1:${PORT}`);

  const merchantToken = generateToken({ id: MERCHANT_ID, role: 'MERCHANT' });
  const adminToken = generateToken({ id: ADMIN_ID, role: 'ADMIN' });

  const merchantHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${merchantToken}`
  };
  const adminHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${adminToken}`
  };

  try {
    // =========================================================================
    // STEP 1: USER REQUESTS ₹10,000 FROM ₹20,000
    // =========================================================================
    console.log('\n[Scenario 1] Request ₹10,000 withdrawal from ₹20,000 available...');
    const balancesBefore = await getWalletBalances(pool, MERCHANT_ID);
    assert.equal(balancesBefore.available_balance_paise, 2000000n, 'Available balance must be ₹20,000 (2,000,000 paise)');

    const reqRes1 = await fetch(`http://127.0.0.1:${PORT}/api/withdrawals/request`, {
      method: 'POST',
      headers: merchantHeaders,
      body: JSON.stringify({
        merchant_id: MERCHANT_ID,
        amount: 10000,
        channel: 'pinelabs',
        settlement_type: 'T1',
        beneficiary_id: benId
      })
    });
    const reqData1 = await reqRes1.json();
    assert.equal(reqRes1.status, 200, `Withdrawal request must succeed: ${JSON.stringify(reqData1)}`);
    const wth1 = reqData1.withdrawal;
    assert.equal(wth1.status, 'PENDING', 'Withdrawal status must be PENDING');
    const wthId1 = wth1.id;

    // Check balances after request: Available = ₹10,000, Withdrawable = ₹9,500 (after ₹500 reserve)
    const balancesAfter1 = await getWalletBalances(pool, MERCHANT_ID);
    assert.equal(balancesAfter1.available_balance_paise, 1000000n, 'Available balance must now be exactly ₹10,000 (1,000,000 paise)');
    assert.equal(balancesAfter1.withdrawable_balance_paise, 950000n, 'Withdrawable balance must be ₹9,500 after ₹500 reserve');

    // Attempting to withdraw the same ₹10,000 again MUST FAIL
    const reqResDup = await fetch(`http://127.0.0.1:${PORT}/api/withdrawals/request`, {
      method: 'POST',
      headers: merchantHeaders,
      body: JSON.stringify({
        merchant_id: MERCHANT_ID,
        amount: 10000,
        channel: 'pinelabs',
        settlement_type: 'T1',
        beneficiary_id: benId
      })
    });
    assert.equal(reqResDup.status, 400, 'Duplicate withdrawal of ₹10,000 must be rejected due to reserve/available limit');
    const dupJson = await reqResDup.json();
    assert(dupJson.message.includes('can withdraw at most Rs 9,500'), `Expected max withdrawable error, got: ${dupJson.message}`);
    console.log('✓ Scenario 1 PASS: ₹10,000 held, available becomes ₹10,000, user cannot withdraw same funds twice');

    // =========================================================================
    // STEP 2: ADMIN EXPORTS PENDING -> SUBMITTED_TO_BANK
    // =========================================================================
    console.log('\n[Scenario 2] Admin exports withdrawal (PENDING -> SUBMITTED_TO_BANK)...');
    const exportRes1 = await fetch(`http://127.0.0.1:${PORT}/api/admin/withdrawals/export-excel`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        withdrawalIds: [wthId1],
        batchTag: 'BATCH-FLOW-01',
        bankName: 'HDFC Bank'
      })
    });
    assert.equal(exportRes1.status, 200, 'Export must succeed');
    const exportJson1 = await exportRes1.json();
    assert.equal(exportJson1.exportedCount, 1);

    // Verify status changed to SUBMITTED_TO_BANK and money remains held
    const wthRow1 = (await pool.query('SELECT status, batch_id FROM withdrawals WHERE id = $1', [wthId1])).rows[0];
    assert.equal(wthRow1.status, 'SUBMITTED_TO_BANK', 'Status must be SUBMITTED_TO_BANK');
    const balancesAfterExport = await getWalletBalances(pool, MERCHANT_ID);
    assert.equal(balancesAfterExport.available_balance_paise, 1000000n, 'Money remains held: available balance unchanged at ₹10,000');

    // Attempting to export the same withdrawal a second time MUST FAIL
    const exportResDup = await fetch(`http://127.0.0.1:${PORT}/api/admin/withdrawals/export-excel`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        withdrawalIds: [wthId1],
        batchTag: 'BATCH-FLOW-02',
        bankName: 'HDFC Bank'
      })
    });
    assert.equal(exportResDup.status, 400, 'Re-export of already submitted withdrawal must fail');
    console.log('✓ Scenario 2 PASS: PENDING -> SUBMITTED_TO_BANK, funds remain held, no second export');

    // =========================================================================
    // STEP 3: BANK RESULT UNKNOWN -> DO NOTHING TO MONEY
    // =========================================================================
    console.log('\n[Scenario 3] Bank result unknown: safety state...');
    const balancesUnknown = await getWalletBalances(pool, MERCHANT_ID);
    assert.equal(balancesUnknown.available_balance_paise, 1000000n, 'Money remains safely held at ₹10,000');
    assert.equal(wthRow1.status, 'SUBMITTED_TO_BANK', 'Status remains SUBMITTED_TO_BANK');
    console.log('✓ Scenario 3 PASS: While bank result is unknown, money remains held, no status change');

    // =========================================================================
    // STEP 4: SUBMITTED_TO_BANK REJECTION WITHOUT CONFIRMATION (MUST RETURN 409)
    // =========================================================================
    console.log('\n[Scenario 4] Rejecting SUBMITTED_TO_BANK without confirming bank failure (must return HTTP 409)...');
    const unconfirmedRejectRes = await fetch(`http://127.0.0.1:${PORT}/api/admin/verify-withdrawal`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        withdrawal_id: wthId1,
        action: 'REJECT',
        remark: 'Attempting unconfirmed rejection',
        confirmBankDidNotPay: false
      })
    });
    assert.equal(unconfirmedRejectRes.status, 409, `Expected HTTP 409, got ${unconfirmedRejectRes.status}`);
    const unconfirmedJson = await unconfirmedRejectRes.json();
    assert.equal(unconfirmedJson.success, false);
    assert.equal(unconfirmedJson.error, 'BANK_FAILURE_CONFIRMATION_REQUIRED');
    assert(
      unconfirmedJson.message.includes('Confirm that the bank transfer failed or was cancelled before refunding the wallet'),
      `Expected safety message, got: ${unconfirmedJson.message}`
    );

    // Verify withdrawal status is UNCHANGED and NO reversal entry created
    const wthCheck4 = (await pool.query('SELECT status FROM withdrawals WHERE id = $1', [wthId1])).rows[0];
    assert.equal(wthCheck4.status, 'SUBMITTED_TO_BANK', 'Status must remain SUBMITTED_TO_BANK');
    const reversals4 = (await pool.query(
      "SELECT * FROM financial_ledger WHERE reference_id = $1 AND type = 'withdrawal_reversal'",
      [wthId1]
    )).rows;
    assert.equal(reversals4.length, 0, 'No reversal ledger entry should exist');
    const balances4 = await getWalletBalances(pool, MERCHANT_ID);
    assert.equal(balances4.available_balance_paise, 1000000n, 'Available balance still untouched at ₹10,000');
    console.log('✓ Scenario 4 PASS: HTTP 409 returned, status unchanged, zero ledger changes, zero wallet refunds');

    // =========================================================================
    // STEP 5: SUBMITTED_TO_BANK CONFIRMED BANK FAILURE -> REJECT & REFUND
    // =========================================================================
    console.log('\n[Scenario 5] Confirmed bank failure rejection -> releases held funds back to wallet...');
    const confirmedRejectRes = await fetch(`http://127.0.0.1:${PORT}/api/admin/verify-withdrawal`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        withdrawal_id: wthId1,
        action: 'REJECT',
        remark: 'Bank IMPS failed: beneficiary IFSC invalid',
        confirmBankDidNotPay: true
      })
    });
    assert.equal(confirmedRejectRes.status, 200, `Confirmed failure must return 200: ${JSON.stringify(await confirmedRejectRes.json())}`);
    
    // Status is REJECTED
    const wthCheck5 = (await pool.query('SELECT status, admin_remark FROM withdrawals WHERE id = $1', [wthId1])).rows[0];
    assert.equal(wthCheck5.status, 'REJECTED');
    assert(wthCheck5.admin_remark.includes('beneficiary IFSC invalid'));

    // Held money returned to wallet: Available is back to ₹20,000
    const balances5 = await getWalletBalances(pool, MERCHANT_ID);
    assert.equal(balances5.available_balance_paise, 2000000n, 'Available balance must be restored to ₹20,000 (2,000,000 paise)');

    // Ledger sum strictly matches cached wallet balance
    const ledgerSumRes5 = await pool.query('SELECT SUM(amount_paise) as s FROM financial_ledger WHERE user_id = $1', [MERCHANT_ID]);
    const walletRes5 = await pool.query('SELECT balance_paise FROM wallets WHERE user_id = $1', [MERCHANT_ID]);
    assert.equal(BigInt(ledgerSumRes5.rows[0].s), BigInt(walletRes5.rows[0].balance_paise), 'Ledger sum must exactly equal wallet cache');
    console.log('✓ Scenario 5 PASS: Status is REJECTED, held funds returned exactly once, ledger balances perfectly');

    // =========================================================================
    // STEP 6: SUBMITTED_TO_BANK SUCCESSFUL BANK PAYMENT -> COMPLETED
    // =========================================================================
    console.log('\n[Scenario 6] Successful bank payout with valid UTR...');
    // Create new withdrawal of ₹10,000
    const reqRes2 = await fetch(`http://127.0.0.1:${PORT}/api/withdrawals/request`, {
      method: 'POST',
      headers: merchantHeaders,
      body: JSON.stringify({
        merchant_id: MERCHANT_ID,
        amount: 10000,
        channel: 'pinelabs',
        settlement_type: 'T1',
        beneficiary_id: benId
      })
    });
    const reqData2 = await reqRes2.json();
    assert.equal(reqRes2.status, 200);
    const wthId2 = reqData2.withdrawal.id;

    // Export to SUBMITTED_TO_BANK
    await fetch(`http://127.0.0.1:${PORT}/api/admin/withdrawals/export-excel`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        withdrawalIds: [wthId2],
        batchTag: 'BATCH-FLOW-02',
        bankName: 'HDFC Bank'
      })
    });

    const utr1 = `UTR-BANK-OK-${ts}`;
    // Complete with valid UTR
    const completeRes2 = await fetch(`http://127.0.0.1:${PORT}/api/admin/verify-withdrawal`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        withdrawal_id: wthId2,
        action: 'APPROVE',
        utr: utr1
      })
    });
    assert.equal(completeRes2.status, 200, 'Completion must succeed');
    const compData2 = await completeRes2.json();
    assert.equal(compData2.withdrawal.status, 'COMPLETED');
    assert.equal(compData2.withdrawal.utr, utr1);

    // Available balance does NOT increase (held money permanently paid)
    const balances6 = await getWalletBalances(pool, MERCHANT_ID);
    assert.equal(balances6.available_balance_paise, 1000000n, 'Available balance remains ₹10,000, no refund');
    console.log('✓ Scenario 6 PASS: COMPLETED with UTR, held money preserved as paid, no wallet refund');

    // =========================================================================
    // STEP 7: DUPLICATE BANK UTR REJECTED
    // =========================================================================
    console.log('\n[Scenario 7] Duplicate bank UTR must be rejected...');
    // Create a ₹5,000 withdrawal (within remaining ₹9,500 withdrawable)
    const reqRes3 = await fetch(`http://127.0.0.1:${PORT}/api/withdrawals/request`, {
      method: 'POST',
      headers: merchantHeaders,
      body: JSON.stringify({
        merchant_id: MERCHANT_ID,
        amount: 5000,
        channel: 'pinelabs',
        settlement_type: 'T1',
        beneficiary_id: benId
      })
    });
    const wthId3 = (await reqRes3.json()).withdrawal.id;

    // Attempt to complete with the SAME UTR as wthId2
    const dupUtrRes = await fetch(`http://127.0.0.1:${PORT}/api/admin/verify-withdrawal`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        withdrawal_id: wthId3,
        action: 'APPROVE',
        utr: utr1 // Duplicate!
      })
    });
    assert.equal(dupUtrRes.status, 400, 'Duplicate UTR must return HTTP 400');
    const dupJson7 = await dupUtrRes.json();
    assert(dupJson7.message.includes('DUPLICATE_UTR'), `Expected DUPLICATE_UTR error, got: ${dupJson7.message}`);
    console.log('✓ Scenario 7 PASS: Duplicate UTR strictly rejected');

    // =========================================================================
    // STEP 8: SECOND COMPLETION REJECTED
    // =========================================================================
    console.log('\n[Scenario 8] Second completion attempt on completed withdrawal must be rejected...');
    const secondCompRes = await fetch(`http://127.0.0.1:${PORT}/api/admin/verify-withdrawal`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        withdrawal_id: wthId2,
        action: 'APPROVE',
        utr: `UTR-NEW-RANDOM-${ts}`
      })
    });
    assert.equal(secondCompRes.status, 400, 'Second completion must fail');
    const secondCompJson = await secondCompRes.json();
    assert(secondCompJson.message.includes('CANNOT_MODIFY_COMPLETED'), `Expected CANNOT_MODIFY_COMPLETED, got: ${secondCompJson.message}`);
    console.log('✓ Scenario 8 PASS: Second completion rejected');

    // =========================================================================
    // STEP 9: SECOND REJECTION REJECTED
    // =========================================================================
    console.log('\n[Scenario 9] Second rejection attempt on rejected withdrawal must be rejected...');
    const secondRejRes = await fetch(`http://127.0.0.1:${PORT}/api/admin/verify-withdrawal`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        withdrawal_id: wthId1,
        action: 'REJECT',
        remark: 'Trying to reject again',
        confirmBankDidNotPay: true
      })
    });
    assert.equal(secondRejRes.status, 400, 'Second rejection must fail');
    const secondRejJson = await secondRejRes.json();
    assert(secondRejJson.message.includes('CANNOT_MODIFY_REJECTED'), `Expected CANNOT_MODIFY_REJECTED, got: ${secondRejJson.message}`);
    console.log('✓ Scenario 9 PASS: Second rejection rejected');

    // =========================================================================
    // STEP 10: CONCURRENT COMPLETE AND REJECT (EXACTLY ONE SUCCEEDS)
    // =========================================================================
    console.log('\n[Scenario 10] Concurrent complete & reject on same withdrawal: row lock ensures exactly one succeeds...');
    // wthId3 is currently PENDING (amount: 5,000)
    // Export to SUBMITTED_TO_BANK first
    await fetch(`http://127.0.0.1:${PORT}/api/admin/withdrawals/export-excel`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        withdrawalIds: [wthId3],
        batchTag: 'BATCH-FLOW-03',
        bankName: 'HDFC Bank'
      })
    });

    const [raceCompRes, raceRejRes] = await Promise.all([
      fetch(`http://127.0.0.1:${PORT}/api/admin/verify-withdrawal`, {
        method: 'POST',
        headers: adminHeaders,
        body: JSON.stringify({
          withdrawal_id: wthId3,
          action: 'APPROVE',
          utr: `UTR-RACE-WINNER-${ts}`
        })
      }),
      fetch(`http://127.0.0.1:${PORT}/api/admin/verify-withdrawal`, {
        method: 'POST',
        headers: adminHeaders,
        body: JSON.stringify({
          withdrawal_id: wthId3,
          action: 'REJECT',
          remark: 'Concurrent bank failure race',
          confirmBankDidNotPay: true
        })
      })
    ]);

    const statuses = [raceCompRes.status, raceRejRes.status].sort();
    assert.deepEqual(statuses, [200, 400], `Expected exactly one 200 and one 400 in concurrent race, got: ${statuses.join(', ')}`);
    console.log('✓ Scenario 10 PASS: Row-level lock ensures race atomicity, exactly one action succeeds');

    // =========================================================================
    // STEP 11: EXISTING PENDING REJECTION WORKS WITHOUT BANK CONFIRMATION
    // =========================================================================
    console.log('\n[Scenario 11] PENDING rejection continues to work without requiring bank failure confirmation...');
    // Create ₹1,000 withdrawal
    const reqRes4 = await fetch(`http://127.0.0.1:${PORT}/api/withdrawals/request`, {
      method: 'POST',
      headers: merchantHeaders,
      body: JSON.stringify({
        merchant_id: MERCHANT_ID,
        amount: 1000,
        channel: 'pinelabs',
        settlement_type: 'T1',
        beneficiary_id: benId
      })
    });
    const wthId4 = (await reqRes4.json()).withdrawal.id;

    // Reject directly while in PENDING (no bank confirmation needed)
    const pendRejRes = await fetch(`http://127.0.0.1:${PORT}/api/admin/verify-withdrawal`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        withdrawal_id: wthId4,
        action: 'REJECT',
        remark: 'Pre-export cancellation: fraud flag'
      })
    });
    assert.equal(pendRejRes.status, 200, 'Pending rejection must succeed without bank confirmation');
    const pendRejJson = await pendRejRes.json();
    assert.equal(pendRejJson.withdrawal.status, 'REJECTED');
    console.log('✓ Scenario 11 PASS: PENDING rejection functions correctly without bank confirmation');

    // =========================================================================
    // STEP 12: EXISTING COMPLETED REJECTION REMAINS FORBIDDEN
    // =========================================================================
    console.log('\n[Scenario 12] Rejection of COMPLETED withdrawal remains strictly forbidden...');
    const rejectCompletedRes = await fetch(`http://127.0.0.1:${PORT}/api/admin/verify-withdrawal`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        withdrawal_id: wthId2, // wthId2 is COMPLETED
        action: 'REJECT',
        remark: 'Attempting to reject completed withdrawal',
        confirmBankDidNotPay: true
      })
    });
    assert.equal(rejectCompletedRes.status, 400, 'Rejecting COMPLETED withdrawal must return HTTP 400');
    const rejectCompJson = await rejectCompletedRes.json();
    assert(rejectCompJson.message.includes('CANNOT_MODIFY_COMPLETED'), `Expected CANNOT_MODIFY_COMPLETED, got: ${rejectCompJson.message}`);
    console.log('✓ Scenario 12 PASS: Rejection of COMPLETED withdrawal remains forbidden');

    // =========================================================================
    // STEP 13: FINAL RECONCILIATION & INTEGRITY CHECK
    // =========================================================================
    console.log('\n[Scenario 13] Verifying final ledger integrity and reconciliation...');
    const finalBalances = await getWalletBalances(pool, MERCHANT_ID);
    const finalSumRes = await pool.query('SELECT SUM(amount_paise) as s FROM financial_ledger WHERE user_id = $1', [MERCHANT_ID]);
    const finalWalletRes = await pool.query('SELECT balance_paise FROM wallets WHERE user_id = $1', [MERCHANT_ID]);
    
    assert.equal(BigInt(finalSumRes.rows[0].s), BigInt(finalWalletRes.rows[0].balance_paise), 'Ledger sum must match wallet cache');
    assert.equal(finalBalances.reconciled !== false, true, 'Wallet must be reconciled');
    console.log('✓ Scenario 13 PASS: Final ledger sum perfectly matches cached balance');

    console.log('\n========================================================================');
    console.log('    ALL 13 WITHDRAWAL MONEY FLOW SCENARIOS PASSED WITH ZERO ERRORS     ');
    console.log('========================================================================\n');
  } finally {
    server.close();
  }
}

runWithdrawalLifecycleMoneyFlowTests().catch(err => {
  console.error('❌ TEST SUITE FAILED:', err);
  process.exit(1);
});
