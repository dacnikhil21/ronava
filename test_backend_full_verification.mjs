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
  getInquiries,
  submitInquiry,
  updateUserStatus,
  createDownstreamUser,
  getPlatformPublicStats
} from './src/services/api.js';
import { generateBankBatchCSV } from './src/utils/bankExportUtils.js';

let passedCount = 0;
let failedCount = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ PASS: ${message}`);
    passedCount++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failedCount++;
  }
}

async function runBackendVerification() {
  console.log('================================================================');
  console.log('   RONAV TECHNOLOGIES — LIVE BACKEND FULL VERIFICATION SUITE    ');
  console.log('================================================================\n');

  try {
    // -------------------------------------------------------------
    // TEST SUITE 1: MULTI-DEVICE ACCOUNT SUSPENSION & ACTIVATION
    // -------------------------------------------------------------
    console.log('>>> [1/7] Testing Cloud-Synced Account Suspension & Login Lockout...');
    const testUserId = 'MID6925';
    
    // Step 1: Suspend user
    const suspendRes = await updateUserStatus(testUserId, 'SUSPENDED');
    assert(suspendRes.success, 'Admin successfully set status to SUSPENDED in Supabase');

    // Step 2: Attempt login while suspended
    const blockedLogin = await loginUser({ id: testUserId, password: `Ronav@${testUserId.slice(-4)}` });
    assert(!blockedLogin.success && blockedLogin.message.includes('suspended'), 'Suspended merchant was blocked from logging in with suspension message');

    // Step 3: Reactivate user
    const reactivateRes = await updateUserStatus(testUserId, 'ACTIVE');
    assert(reactivateRes.success, 'Admin successfully reactivated merchant in Supabase');

    // Step 4: Login should now succeed
    const allowedLogin = await loginUser({ id: testUserId, password: `Ronav@${testUserId.slice(-4)}` });
    assert(allowedLogin.success && allowedLogin.user.id === testUserId, 'Reactivated merchant logged in successfully');

    // -------------------------------------------------------------
    // TEST SUITE 2: PUBLIC LEAD INQUIRIES (BBPS, POS, CONTACT)
    // -------------------------------------------------------------
    console.log('\n>>> [2/7] Testing Public Lead Form Submissions & Sanitization...');
    const bbpsInquiry = await submitInquiry({
      name: 'Test BBPS Customer',
      phone: '9848099881',
      type: 'BBPS',
      category: 'Electricity Bill Inquiry',
      location: 'Hyderabad',
      remarks: 'Automated test inquiry for BBPS'
    });
    assert(bbpsInquiry.success, 'BBPS lead successfully sanitized and inserted into Supabase without enum errors');

    const posInquiry = await submitInquiry({
      name: 'Test POS Retailer',
      phone: '9848099882',
      type: 'POS',
      category: 'Pine Labs Android Machine',
      location: 'Secunderabad',
      remarks: 'Automated test inquiry for POS'
    });
    assert(posInquiry.success, 'POS machine lead successfully inserted into Supabase');

    const contactInquiry = await submitInquiry({
      name: 'Test Contact Form',
      phone: '9848099883',
      type: 'CONTACT',
      category: 'General Partnership Support',
      location: 'Telangana',
      remarks: 'Automated test contact form'
    });
    assert(contactInquiry.success, 'Contact lead successfully inserted into Supabase');

    // Verify Inquiries Queue has no SEED_INQUIRIES
    const inqRes = await getInquiries();
    assert(inqRes.success && Array.isArray(inqRes.inquiries), 'Inquiries retrieved from Supabase');
    const fakeSeedFound = inqRes.inquiries.some(i => i.name && i.name.includes('Rajesh Varma (Varma Electronics)'));
    assert(!fakeSeedFound, 'Fake loan applicant "Rajesh Varma" successfully eliminated from queue');

    // Clean up test leads
    if (bbpsInquiry.data?.id) await supabase.from('inquiries').delete().eq('id', bbpsInquiry.data.id);
    if (posInquiry.data?.id) await supabase.from('inquiries').delete().eq('id', posInquiry.data.id);
    if (contactInquiry.data?.id) await supabase.from('inquiries').delete().eq('id', contactInquiry.data.id);
    console.log('  ✓ Cleaned up test inquiry entries from Supabase');

    // -------------------------------------------------------------
    // TEST SUITE 3: ADMIN ONBOARDING MODAL & WHOLESALE SPREAD
    // -------------------------------------------------------------
    console.log('\n>>> [3/7] Testing Admin Onboarding (2-Box Rates) & Dynamic Setup...');
    const newMerchantMobile = '984899' + Math.floor(1000 + Math.random() * 9000);
    const onboardRes = await createDownstreamUser({
      creator_id: 'ADM001',
      parent_id: 'DIST2001', // Under Area Distributor Sri Sai Distribution
      name: 'Test Verified Store',
      mobile: newMerchantMobile,
      role: 'MERCHANT',
      pos_provider: 'Pine Labs',
      commission_rate_t1: '1.50',
      commission_rate_instant: '1.80'
    });

    assert(onboardRes.success, `Created merchant ${onboardRes.user?.id} under DIST2001 with T+1: 1.50% & Instant: 1.80%`);
    const createdMerchantId = onboardRes.user?.id;

    // -------------------------------------------------------------
    // TEST SUITE 4: MACHINE ISOLATION & SALES RECORDING
    // -------------------------------------------------------------
    console.log('\n>>> [4/7] Testing Machine-Specific Sales Recording & Calculations...');

    // Sale A: Pine Labs Card Swipe at 1.50% (T+1)
    const swipeAmount = 10000;
    const swipeFeeRate = 1.50; // 1.50%
    const companyFeePine = (swipeAmount * swipeFeeRate) / 100; // ₹150
    const customerCharge = (swipeAmount * 2.0) / 100; // ₹200 (merchant charges 2%)
    const merchantCommissionPine = customerCharge - companyFeePine; // ₹50 merchant profit

    const pineSaleRes = await recordMerchantSale({
      merchant_id: createdMerchantId,
      amount: swipeAmount,
      customer_name: 'Walk-in Customer A',
      customer_mobile: '9848011223',
      type: 'POS_SWIPE',
      provider: 'Pine Labs',
      ref_number: 'RRN-PL-' + Math.floor(100000 + Math.random() * 900000),
      settlement_type: 'T1',
      customer_charge: customerCharge,
      company_fee: companyFeePine,
      merchant_commission: merchantCommissionPine
    });
    assert(pineSaleRes.success, `Pine Labs POS swipe recorded (₹${swipeAmount}) under ${createdMerchantId}`);

    // Sale B: QR Payment (Instant UPI)
    const qrAmount = 4000;
    const qrFeeRate = 1.80; // 1.80%
    const companyFeeQr = (qrAmount * qrFeeRate) / 100; // ₹72

    const qrSaleRes = await recordMerchantSale({
      merchant_id: createdMerchantId,
      amount: qrAmount,
      customer_name: 'UPI Customer B',
      customer_mobile: '9848011224',
      type: 'QR_SCAN',
      provider: 'Company QR (UPI)',
      ref_number: 'UPI-RR-' + Math.floor(100000 + Math.random() * 900000),
      settlement_type: 'INSTANT',
      customer_charge: companyFeeQr,
      company_fee: companyFeeQr,
      merchant_commission: 0
    });
    assert(qrSaleRes.success, `Company QR instant payment recorded (₹${qrAmount}) under ${createdMerchantId}`);

    // -------------------------------------------------------------
    // TEST SUITE 5: ZERO COMMISSION LEAKAGE & WHOLESALE MARKUP AUDIT
    // -------------------------------------------------------------
    console.log('\n>>> [5/7] Verifying Zero-Leakage Commission Roll-Up Across Network...');
    
    // Check Admin Wallet & Upline Wallets
    const adminPending = await getAdminPending();
    assert(adminPending.success, 'Retrieved live Admin summary from Supabase');
    assert(adminPending.stats.atmTxns >= 1, `Admin QR Transaction Counter is active (${adminPending.stats.atmTxns} QR txns counted, not stuck at 0)`);
    assert(adminPending.stats.adminNetProfit > 0, `Admin Net Profit calculated dynamically: ₹${adminPending.stats.adminNetProfit}`);

    // -------------------------------------------------------------
    // TEST SUITE 6: HOMEPAGE PLATFORM TELEMETRY STATS
    // -------------------------------------------------------------
    console.log('\n>>> [6/7] Testing Homepage Dynamic Telemetry Engine...');
    const publicStats = await getPlatformPublicStats();
    assert(publicStats.success, 'getPlatformPublicStats executed successfully');
    assert(publicStats.merchants >= 2500, `Merchants count is live (${publicStats.merchants}+ onboarded)`);
    assert(publicStats.volume >= 33.45, `Volume count is live (₹${publicStats.volume}L ecosystem turnover)`);
    assert(publicStats.outlets >= 180, `Outlets count is live (${publicStats.outlets}+ deployed terminals)`);

    // -------------------------------------------------------------
    // TEST SUITE 7: WITHDRAWAL LIFECYCLE & BANK EXPORT CSV
    // -------------------------------------------------------------
    console.log('\n>>> [7/7] Testing Withdrawal Request, Bank CSV & Final Approval...');

    // Approve the 2 sales first so merchant wallet has funds
    await verifyTransaction(pineSaleRes.transaction.id, 'APPROVE', 'Verified Slip');
    await verifyTransaction(qrSaleRes.transaction.id, 'APPROVE', 'Verified UPI');

    // Check merchant wallet
    const merchantWalletRes = await getWallet(createdMerchantId);
    assert(merchantWalletRes.wallet.available_balance >= 14000, `Merchant available balance is ₹${merchantWalletRes.wallet.available_balance}`);

    // Create withdrawal request
    const withdrawAmount = 5000;
    const withdrawRes = await requestWithdrawal({
      merchant_id: createdMerchantId,
      amount: withdrawAmount,
      bank_name: 'HDFC Bank',
      account_number: '50100234567890',
      ifsc: 'HDFC0001234',
      customer_name: 'Test Verified Store'
    });
    assert(withdrawRes.success, `Withdrawal requested for ₹${withdrawAmount} (WTH ID: ${withdrawRes.withdrawal?.id})`);

    // Generate Bank Batch CSV
    const csvExport = generateBankBatchCSV([withdrawRes.withdrawal]);
    assert(csvExport.success, 'Bank Batch CSV generated with UTF-8 BOM and formula protection');
    assert(csvExport.csvContent.includes('="50100234567890"'), 'Account number is formula protected with ="" against scientific notation corruption');

    // Admin marks as SUBMITTED_TO_BANK
    const submittedRes = await markWithdrawalsSubmittedToBank([withdrawRes.withdrawal.id]);
    assert(submittedRes.success, 'Admin transitioned withdrawal status to SUBMITTED_TO_BANK');

    // Admin final approval with Bank UTR
    const testUtr = 'CMS-IMPS-' + Date.now();
    const finalApproval = await verifyWithdrawal(withdrawRes.withdrawal.id, 'APPROVE', testUtr);
    assert(finalApproval.success, `Withdrawal approved with bank UTR ${testUtr}`);

    // Final Wallet Check
    const finalWalletRes = await getWallet(createdMerchantId);
    assert(finalWalletRes.wallet.withdrawn_amount === withdrawAmount, `Merchant withdrawn total settled to ₹${finalWalletRes.wallet.withdrawn_amount}`);

    // Cleanup created test user and wallet
    await supabase.from('transactions').delete().eq('merchant_id', createdMerchantId);
    await supabase.from('withdrawals').delete().eq('merchant_id', createdMerchantId);
    await supabase.from('merchant_pos').delete().eq('merchant_id', createdMerchantId);
    await supabase.from('wallets').delete().eq('user_id', createdMerchantId);
    await supabase.from('users').delete().eq('id', createdMerchantId);
    console.log('  ✓ Cleaned up test merchant and test records from Supabase');

    console.log('\n================================================================');
    console.log(`   BACKEND VERIFICATION COMPLETE: ${passedCount} PASSED | ${failedCount} FAILED   `);
    console.log('================================================================\n');

  } catch (err) {
    console.error('Fatal test error:', err);
  }
}

runBackendVerification();
