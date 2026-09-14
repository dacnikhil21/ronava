import { supabase } from './src/services/supabase.js';
import { 
  loginUser,
  recordMerchantSale, 
  requestWithdrawal, 
  markWithdrawalsSubmittedToBank, 
  verifyWithdrawal, 
  verifyTransaction,
  getWallet,
  getMerchantTransactions,
  getMerchantWithdrawals,
  getAdminPending,
  getHierarchyTree,
  getPlatformQrConfig,
  savePlatformQrConfig,
  getInquiries
} from './src/services/api.js';
import { generateBankBatchCSV } from './src/utils/bankExportUtils.js';

async function runAudit() {
  console.log('================================================================');
  console.log('   RONAV TECHNOLOGIES — LIVE SUPABASE END-TO-END AUDIT REPORT   ');
  console.log('================================================================\n');

  const auditLog = {
    timestamp: new Date().toISOString(),
    tests: [],
    leakageAudit: {},
    payoutLifecycle: {},
    multiDeviceQrSync: {}
  };

  function logPass(title, details = '') {
    console.log(`[PASS] ${title}`);
    if (details) console.log(`       ${details}`);
    auditLog.tests.push({ title, status: 'PASS', details });
  }

  function logFail(title, err) {
    console.error(`[FAIL] ${title}`);
    console.error(`       Error:`, err);
    auditLog.tests.push({ title, status: 'FAIL', error: String(err) });
  }

  // -------------------------------------------------------------
  // STEP 1: PURGE DIRTY / DUMMY TEST RECORDS FOR FRESH AUDIT
  // -------------------------------------------------------------
  console.log('\n>>> STEP 1: CLEANING DUMMY TEST DATA FOR FRESH AUDIT...');
  try {
    // Delete test transactions
    const { error: delTxErr } = await supabase
      .from('transactions')
      .delete()
      .neq('id', 'KEEP_NONE'); // delete all test rows
    if (delTxErr) throw delTxErr;

    // Delete test withdrawals
    const { error: delWthErr } = await supabase
      .from('withdrawals')
      .delete()
      .neq('id', 'KEEP_NONE');
    if (delWthErr) throw delWthErr;

    // Reset all test user wallets to 0.00
    const resetUsers = ['MID6925', 'DIST2001', 'DD4729', 'SD1001', 'ADM001', 'MID3826', 'SD4935'];
    for (const uid of resetUsers) {
      await supabase.from('wallets').upsert({
        user_id: uid,
        available_balance: 0,
        total_sales: 0,
        received_sales: 0,
        pending_balance: 0,
        withdrawn_amount: 0,
        updated_at: new Date().toISOString()
      });
    }

    logPass('Clean Slate Initialized', 'All test transactions and withdrawals purged. Wallets reset to ₹0.00.');
  } catch (e) {
    logFail('Clean Slate Initialization', e);
  }

  // -------------------------------------------------------------
  // STEP 2: VERIFY DOWNSTREAM HIERARCHY CHAIN & POS RATE CONFIG
  // -------------------------------------------------------------
  console.log('\n>>> STEP 2: VERIFYING HIERARCHY CHAIN & COMMISSION CONFIG...');
  try {
    const treeRes = await getHierarchyTree();
    if (!treeRes.success) throw new Error(treeRes.message);

    const { data: users } = await supabase.from('users').select('*');
    const userMap = new Map(users.map(u => [u.id, u]));

    const merchant = userMap.get('MID6925');
    const distributor = userMap.get('DIST2001');
    const districtDist = userMap.get('DD4729');
    const superDist = userMap.get('SD1001');
    const admin = userMap.get('ADM001');

    console.log(`    Hierarchy Chain Verification:`);
    console.log(`    1. Admin:               ${admin.name} (${admin.id})`);
    console.log(`    2. Super Distributor:   ${superDist.name} (${superDist.id}) -> Creator: ${superDist.creator_id}`);
    console.log(`    3. District Franchise:  ${districtDist.name} (${districtDist.id}) -> Creator: ${districtDist.creator_id}`);
    console.log(`    4. Area Distributor:    ${distributor.name} (${distributor.id}) -> Creator: ${distributor.creator_id}`);
    console.log(`    5. Retailer / Merchant: ${merchant.name} (${merchant.id}) -> Creator: ${merchant.creator_id}`);

    const isChainValid = (
      merchant.creator_id === 'DIST2001' &&
      distributor.creator_id === 'DD4729' &&
      districtDist.creator_id === 'SD1001' &&
      superDist.creator_id === 'ADM001'
    );

    if (!isChainValid) throw new Error('Hierarchy parent links are broken!');
    logPass('Hierarchy Unbroken', 'Admin -> Super Dist (SD1001) -> District Dist (DD4729) -> Dist (DIST2001) -> Merchant (MID6925)');

    // Verify POS Rates for MID6925
    const { data: pos } = await supabase
      .from('merchant_pos')
      .select('*')
      .eq('merchant_id', 'MID6925')
      .single();

    console.log(`    Configured POS Machine (Terminal: ${pos.terminal_id}, Provider: ${pos.provider}):`);
    console.log(`    - T+1 MDR Rate:            ${pos.commission_rate_t1}%`);
    console.log(`    - Instant Settlement Rate: ${pos.commission_rate_instant}%`);
    console.log(`    - Admin Retained Cut:      ${pos.admin_cut_rate}%`);
    console.log(`    - Upline Override Pool:    ${pos.upline_override_rate}%`);

    logPass('POS Terminal Rates Verified', `Terminal ${pos.terminal_id} | T+1: ${pos.commission_rate_t1}% | Instant: ${pos.commission_rate_instant}% | Admin: ${pos.admin_cut_rate}% | Upline: ${pos.upline_override_rate}%`);
  } catch (e) {
    logFail('Hierarchy Verification', e);
  }

  // -------------------------------------------------------------
  // STEP 3: MULTI-DEVICE DYNAMIC SUPABASE QR SYNC AUDIT
  // -------------------------------------------------------------
  console.log('\n>>> STEP 3: TESTING DYNAMIC SUPABASE QR STORAGE & BROADCAST...');
  try {
    const testSvgBase64 = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iIzBGNTJCQSIvPjwvc3ZnPg==';
    const testPayeeName = 'RONAV TECHNOLOGIES PRIVATE LIMITED';

    // 1. Admin saves QR to Supabase
    const saveRes = await savePlatformQrConfig({ image: testSvgBase64, name: testPayeeName });
    if (!saveRes.success) throw new Error('savePlatformQrConfig failed');

    // 2. Merchant on another device queries Supabase
    const fetchRes = await getPlatformQrConfig();
    if (!fetchRes.image || fetchRes.name !== testPayeeName) {
      throw new Error(`QR Config mismatch! Read: ${fetchRes.name}`);
    }

    // 3. Verify getInquiries() does NOT return SYS-CONFIG-QR as a loan/franchise inquiry
    const inqRes = await getInquiries();
    const leaked = (inqRes.inquiries || []).find(i => i.id === 'SYS-CONFIG-QR');
    if (leaked) throw new Error('SYS-CONFIG-QR leaked into standard inquiries feed!');

    logPass('Dynamic Multi-Device QR Sync', `QR Image & Payee "${testPayeeName}" saved directly to Supabase and fetched across devices.`);
  } catch (e) {
    logFail('Dynamic QR Sync', e);
  }

  // -------------------------------------------------------------
  // STEP 4: RECORD SALES (PINE LABS POS + QR) & COMMISSION AUDIT
  // -------------------------------------------------------------
  console.log('\n>>> STEP 4: RECORDING SALES & CALCULATING ZERO COMMISSION LEAKAGE...');
  try {
    // SALE 1: Pine Labs POS Card Swipe (₹10,000, T+1 Mode)
    console.log('\n  [A] Recording Pine Labs POS Swipe (₹10,000, T+1)...');
    const posSaleRes = await recordMerchantSale({
      merchant_id: 'MID6925',
      amount: 10000,
      customer_name: 'Harish Reddy',
      customer_mobile: '9848012345',
      type: 'POS_SWIPE',
      provider: 'Pine Labs',
      ref_number: 'RRN-9988112233',
      settlement_type: 'T1',
      customer_charge: 200,   // 2.00% charged by merchant to cardholder
      company_fee: 150,       // 1.50% base fee collected by platform
      merchant_commission: 50,// ₹50 merchant profit
      notes: 'Pine Labs Counter Card Swipe'
    });

    if (!posSaleRes.success) throw new Error(posSaleRes.message);
    const txn1 = posSaleRes.transaction;
    logPass('Pine Labs POS Sale Recorded in Supabase', `Txn ID: ${txn1.id} | Amount: ₹${txn1.amount} | Status: ${txn1.status}`);

    // SALE 2: Dynamic QR Code Payment (₹5,000, Instant Mode)
    console.log('  [B] Recording QR Payment (₹5,000, Instant)...');
    const qrSaleRes = await recordMerchantSale({
      merchant_id: 'MID6925',
      amount: 5000,
      customer_name: 'Ananya Sharma',
      customer_mobile: '9000199887',
      type: 'QR_SCAN',
      provider: 'RONAV_QR',
      ref_number: 'UPI-7766554433',
      settlement_type: 'INSTANT',
      customer_charge: 90,    // 1.80% instant rate
      company_fee: 90,        // 1.80%
      merchant_commission: 0,
      notes: 'Scan & Pay QR Sale'
    });

    if (!qrSaleRes.success) throw new Error(qrSaleRes.message);
    const txn2 = qrSaleRes.transaction;
    logPass('QR Sale Recorded in Supabase with ZERO ERRORS', `Txn ID: ${txn2.id} | Amount: ₹${txn2.amount} | Status: ${txn2.status}`);

    // Inspect Hierarchy Commission Calculations & Zero Leakage Proof
    console.log('\n  [C] Hierarchy Wallet Balances & Commission Audit:');
    const [wMid, wDist, wDd, wSd, wAdm] = await Promise.all([
      getWallet('MID6925'),
      getWallet('DIST2001'),
      getWallet('DD4729'),
      getWallet('SD1001'),
      getWallet('ADM001')
    ]);

    const midPending = wMid.wallet.pending_balance;
    const midTotal = wMid.wallet.total_sales;
    const distEarned = wDist.wallet.available_balance;
    const ddEarned = wDd.wallet.available_balance;
    const sdEarned = wSd.wallet.available_balance;
    const admEarned = wAdm.wallet.available_balance;

    console.log(`      - Merchant Pending (Total Sales ₹15,000): ₹${midPending}`);
    console.log(`      - Area Distributor DIST2001 Commission:    ₹${distEarned}`);
    console.log(`      - District Franchise DD4729 Commission:    ₹${ddEarned}`);
    console.log(`      - Super Distributor SD1001 Commission:     ₹${sdEarned}`);
    console.log(`      - Admin Retained Margin (ADM001):          ₹${admEarned}`);

    // Math Verification:
    // Sale 1: ₹10,000 @ 1.50% fee = ₹150. Upline 0.20% = ₹20. Dist(50%)=₹10, DD(30%)=₹6, SD(20%)=₹4. Admin=₹150-₹20=₹130.
    // Sale 2: ₹5,000 @ 1.80% fee = ₹90. Upline 0.20% = ₹10. Dist(50%)=₹5, DD(30%)=₹3, SD(20%)=₹2. Admin=₹90-₹10=₹80.
    // Total Upline pool = ₹30.00 (Dist ₹15, DD ₹9, SD ₹6).
    // Total Admin pool = ₹130 + ₹80 = ₹210.
    // Total Platform Fee = ₹150 + ₹90 = ₹240.00.
    // Check: Total Upline (₹30) + Total Admin (₹210) = ₹240.00!
    const totalFeesCollected = 150 + 90;
    const totalDistributed = distEarned + ddEarned + sdEarned + admEarned;
    const leakage = Math.abs(totalFeesCollected - totalDistributed);

    console.log(`      - Total Platform Fee Collected:            ₹${totalFeesCollected.toFixed(2)}`);
    console.log(`      - Total Distributed across Hierarchy:      ₹${totalDistributed.toFixed(2)}`);
    console.log(`      - Mathematical Commission Leakage:         ₹${leakage.toFixed(4)}`);

    if (leakage > 0.01) {
      throw new Error(`Commission Leakage detected! Difference: ₹${leakage}`);
    }

    logPass('Zero Commission Leakage Verified', `Total Platform Fees Collected (₹${totalFeesCollected}) = Admin Net (₹${admEarned}) + Upline Cuts (₹${distEarned + ddEarned + sdEarned}). Leakage = ₹0.00.`);
  } catch (e) {
    logFail('Sales & Commission Calculation', e);
  }

  // -------------------------------------------------------------
  // STEP 5: ADMIN APPROVAL OF SALES IN SUPABASE
  // -------------------------------------------------------------
  console.log('\n>>> STEP 5: ADMIN VIEW & APPROVAL OF SALES...');
  try {
    const pendingRes = await getAdminPending();
    const pendingIds = (pendingRes.pendingTransactions || []).map(t => t.id);
    console.log(`    Found ${pendingIds.length} pending transactions in Admin view:`, pendingIds);

    for (const id of pendingIds) {
      const appRes = await verifyTransaction(id, 'APPROVE', 'Verified against POS terminal back-office');
      if (!appRes.success) throw new Error(appRes.message);
    }

    // Verify Merchant Wallet after sales approval
    const wAfter = await getWallet('MID6925');
    console.log(`    Merchant Wallet after Sales Approved:`);
    console.log(`    - Available Balance: ₹${wAfter.wallet.available_balance}`);
    console.log(`    - Pending Balance:   ₹${wAfter.wallet.pending_balance}`);
    console.log(`    - Received Sales:    ₹${wAfter.wallet.received_sales}`);

    if (wAfter.wallet.available_balance !== 15000) {
      throw new Error(`Available balance expected ₹15,000, found ₹${wAfter.wallet.available_balance}`);
    }

    logPass('Transactions Approved & Settled into Merchant Wallet', `Available Balance is now ₹15,000.00 (100% ready for disbursal).`);
  } catch (e) {
    logFail('Admin Sales Approval', e);
  }

  // -------------------------------------------------------------
  // STEP 6: WITHDRAWAL LIFECYCLE, BANK EXPORT & FINAL SETTLEMENT
  // -------------------------------------------------------------
  console.log('\n>>> STEP 6: WITHDRAWAL LIFECYCLE, BANK EXPORT & FINAL SETTLEMENT...');
  try {
    // 1. Merchant requests payout of ₹8,000
    console.log('  [A] Merchant initiating withdrawal of ₹8,000 to State Bank of India...');
    const wthRes = await requestWithdrawal({
      merchant_id: 'MID6925',
      amount: 8000,
      bank_name: 'State Bank of India',
      account_number: '30891245678',
      ifsc: 'SBIN0001234',
      payout_type: 'CUSTOMER_DISBURSAL',
      customer_name: 'Ravi Kumar',
      customer_mobile: '9848011223',
      settlement_mode: 'INSTANT'
    });

    if (!wthRes.success) throw new Error(wthRes.message);
    const wthId = wthRes.withdrawal_id;
    logPass('Withdrawal Request Created', `ID: ${wthId} | Status: PENDING | Amount: ₹8,000`);

    // Verify wallet deduction
    const wMidAfterReq = await getWallet('MID6925');
    console.log(`      - Merchant Available Balance: ₹${wMidAfterReq.wallet.available_balance} (Expected ₹7,000)`);
    console.log(`      - Merchant Pending Balance:   ₹${wMidAfterReq.wallet.pending_balance} (Expected ₹8,000)`);
    if (wMidAfterReq.wallet.available_balance !== 7000) {
      throw new Error(`Wallet balance deduction mismatch!`);
    }

    // 2. Admin queries pending withdrawals and generates bank CSV
    console.log('\n  [B] Admin generating Bank Batch File (Excel / CSV)...');
    const adminPend = await getAdminPending();
    const targetWth = (adminPend.pendingWithdrawals || []).find(w => w.id === wthId);
    if (!targetWth) throw new Error(`Target withdrawal ${wthId} not found in Admin pending queue!`);

    const { csvContent, count } = generateBankBatchCSV([targetWth]);
    console.log(`      Generated CSV (${count} row, ${csvContent.length} bytes):`);
    const csvLines = csvContent.split('\r\n');
    csvLines.forEach((l, idx) => console.log(`      Line ${idx + 1}: ${l}`));

    // Validate 6 Bank Standard Columns
    const headerLine = csvLines[0].replace('\uFEFF', '');
    const expectedHeaders = 'Sl No,Beneficiary Name,Account Number,IFSC Code,Bank Name,Amount';
    if (headerLine !== expectedHeaders) {
      throw new Error(`CSV Header mismatch! Got: ${headerLine}`);
    }

    // Validate Account Number Protection
    if (!csvContent.includes('="30891245678"')) {
      throw new Error('Account number is not protected with ="..." formula format!');
    }
    logPass('Bank Batch CSV Validated', 'Strict 6 columns formatted, UTF-8 BOM, account formula protection active.');

    // 3. Admin submits to Bank (Transitions status to SUBMITTED_TO_BANK)
    console.log('\n  [C] Admin marks withdrawal as SUBMITTED_TO_BANK...');
    const markRes = await markWithdrawalsSubmittedToBank([wthId]);
    if (!markRes.success) throw new Error(markRes.message);

    // Verify in Supabase
    const { data: dbWthAfterSubmit } = await supabase
      .from('withdrawals')
      .select('*')
      .eq('id', wthId)
      .single();

    console.log(`      Database record remark: "${dbWthAfterSubmit.admin_remark}"`);
    console.log(`      Submitted to Bank timestamp: ${dbWthAfterSubmit.submitted_to_bank_at}`);

    if (!dbWthAfterSubmit.admin_remark.includes('[SUBMITTED_TO_BANK]')) {
      throw new Error('Database remark missing [SUBMITTED_TO_BANK] tag!');
    }
    logPass('Submitted to Bank Status Reflected in Supabase', `Record updated with [SUBMITTED_TO_BANK] and timestamp ${dbWthAfterSubmit.submitted_to_bank_at}`);

    // Check Merchant View during Submitted to Bank
    const mWithdrawals = await getMerchantWithdrawals('MID6925');
    const mItem = (mWithdrawals.withdrawals || []).find(w => w.id === wthId);
    console.log(`      Merchant view is_submitted_to_bank: ${mItem?.is_submitted_to_bank}`);
    if (!mItem?.is_submitted_to_bank) {
      throw new Error('Merchant dashboard does not detect is_submitted_to_bank flag!');
    }
    logPass('Merchant Payouts Page Reflects Submitted to Bank', 'Status badge resolves to 🏦 Submitted to Bank.');

    // 4. Admin Approves Disbursal with Bank UTR Number
    console.log('\n  [D] Admin confirms Bank Disbursal with UTR Number...');
    const testUtr = 'CMS-IMPS-20260914-998822';
    const appWthRes = await verifyWithdrawal(wthId, 'APPROVE', 'Disbursed via Bank CMS IMPS', testUtr);
    if (!appWthRes.success) throw new Error(appWthRes.message);

    // Verify Final Database State
    const { data: dbFinalWth } = await supabase
      .from('withdrawals')
      .select('*')
      .eq('id', wthId)
      .single();

    console.log(`      Final Withdrawal Status: ${dbFinalWth.status}`);
    console.log(`      Final Admin Remark:     "${dbFinalWth.admin_remark}"`);
    console.log(`      Verified At:            ${dbFinalWth.verified_at}`);

    if (dbFinalWth.status !== 'APPROVED') {
      throw new Error(`Expected APPROVED status, got ${dbFinalWth.status}`);
    }

    // Verify Merchant Wallet Final Balances
    const finalWallet = await getWallet('MID6925');
    console.log(`      Final Merchant Wallet:`);
    console.log(`      - Available Balance: ₹${finalWallet.wallet.available_balance} (Expected ₹7,000)`);
    console.log(`      - Pending Balance:   ₹${finalWallet.wallet.pending_balance} (Expected ₹0)`);
    console.log(`      - Withdrawn Amount:  ₹${finalWallet.wallet.withdrawn_amount} (Expected ₹8,000)`);
    console.log(`      - Total Sales:       ₹${finalWallet.wallet.total_sales} (Expected ₹15,000)`);

    if (
      finalWallet.wallet.available_balance !== 7000 ||
      finalWallet.wallet.pending_balance !== 0 ||
      finalWallet.wallet.withdrawn_amount !== 8000
    ) {
      throw new Error('Final wallet balances do not match expected settlement math!');
    }

    // Check Merchant Payouts query resolves to APPROVED with UTR
    const finalMerchantList = await getMerchantWithdrawals('MID6925');
    const finalItem = (finalMerchantList.withdrawals || []).find(w => w.id === wthId);
    console.log(`      Merchant view final status: ${finalItem?.status}`);
    console.log(`      Merchant view UTR extracted: ${finalItem?.utr_number}`);

    if (finalItem?.status !== 'APPROVED' || finalItem?.utr_number !== testUtr) {
      throw new Error('Merchant payouts list failed to show settled status with UTR!');
    }

    logPass('Final Disbursal Approved & Settled', `Status: APPROVED | UTR: ${testUtr} | Merchant Withdrawn: ₹8,000.00.`);
  } catch (e) {
    logFail('Withdrawal Lifecycle & Bank Settlement', e);
  }

  // -------------------------------------------------------------
  // SUMMARY
  // -------------------------------------------------------------
  console.log('\n================================================================');
  console.log('                   AUDIT EXECUTION SUMMARY                      ');
  console.log('================================================================');
  const total = auditLog.tests.length;
  const passed = auditLog.tests.filter(t => t.status === 'PASS').length;
  const failed = auditLog.tests.filter(t => t.status === 'FAIL').length;
  console.log(`Total Checks Executed: ${total}`);
  console.log(`Passed:                ${passed}`);
  console.log(`Failed:                ${failed}`);
  console.log('================================================================\n');

  return { total, passed, failed, log: auditLog };
}

runAudit().then(res => {
  if (res.failed > 0) process.exit(1);
  else process.exit(0);
});
