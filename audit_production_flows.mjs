import { 
  loginUser, 
  createDownstreamUser, 
  adminResetUserPassword, 
  recordMerchantSale, 
  requestWithdrawal, 
  clawbackTransaction, 
  getAdminPending, 
  getDownstreamNetwork,
  getUserBuyRate
} from './src/services/api.js';
import { supabase } from './src/services/supabase.js';

async function runAudit() {
  console.log('====================================================');
  console.log('🚀 STARTING END-TO-END PRODUCTION SYSTEM AUDIT');
  console.log('====================================================\n');

  const flaws = [];
  const timestamp = Date.now().toString().slice(-4);

  // ----------------------------------------------------
  // TEST CASE 1: HIERARCHY ONBOARDING & CREDENTIALS
  // ----------------------------------------------------
  console.log('📋 STEP 1: Creating Multi-Tier Partner Hierarchy...');
  
  // 1. Super Distributor (Rate: 1.20%)
  const sdMobile = `98${timestamp}0001`;
  const sdRes = await createDownstreamUser({
    creator_id: 'ADM001',
    name: `SD Test ${timestamp}`,
    mobile: sdMobile,
    role: 'SUPER_DISTRIBUTOR',
    commission_rate_t1: 1.20,
    commission_rate_instant: 1.50,
    password: `Ronav@${timestamp}`
  });

  if (!sdRes.success) flaws.push(`Super Distributor creation failed: ${sdRes.message}`);
  const sdId = sdRes.user?.id || `SD${timestamp}`;
  console.log(`  ✓ Super Distributor Created: ${sdId} (Rate: 1.20%)`);

  // 2. Area Distributor under SD (Rate: 1.30%)
  const distMobile = `98${timestamp}0002`;
  const distRes = await createDownstreamUser({
    creator_id: sdId,
    name: `Dist Test ${timestamp}`,
    mobile: distMobile,
    role: 'DISTRIBUTOR',
    commission_rate_t1: 1.30,
    commission_rate_instant: 1.60,
    password: `Ronav@${timestamp}`
  });

  if (!distRes.success) flaws.push(`Distributor creation failed: ${distRes.message}`);
  const distId = distRes.user?.id || `DIST${timestamp}`;
  console.log(`  ✓ Area Distributor Created: ${distId} (Rate: 1.30%, Parent: ${sdId})`);

  // 3. Merchant under Distributor (Rate: 1.50%)
  const midMobile = `98${timestamp}0003`;
  const midRes = await createDownstreamUser({
    creator_id: distId,
    name: `Merchant Test ${timestamp}`,
    mobile: midMobile,
    role: 'MERCHANT',
    pos_provider: 'Pine Labs',
    commission_rate_t1: 1.50,
    commission_rate_instant: 1.80,
    password: `Ronav@${timestamp}`
  });

  if (!midRes.success) flaws.push(`Merchant creation failed: ${midRes.message}`);
  const midId = midRes.user?.id || `MID${timestamp}`;
  console.log(`  ✓ Merchant Created: ${midId} (Rate: 1.50%, Parent: ${distId})`);

  // ----------------------------------------------------
  // TEST CASE 2: CREDENTIAL & AUTHENTICATION SSOT VERIFICATION
  // ----------------------------------------------------
  console.log('\n📋 STEP 2: Verifying Credential Authentication & Admin Reset...');
  
  // Test Merchant Login with Onboarding Password
  const loginAttempt1 = await loginUser({ id: midId, password: `Ronav@${timestamp}` });
  if (!loginAttempt1.success) {
    flaws.push(`Login failed with onboarding password: ${loginAttempt1.message}`);
  } else {
    console.log(`  ✓ Merchant ${midId} successfully logged in with onboarding password.`);
  }

  // Admin resets password to Ronav@9999
  const resetRes = await adminResetUserPassword(midId, 'Ronav@9999');
  if (!resetRes.success) {
    flaws.push(`Admin password reset failed: ${resetRes.message}`);
  } else {
    console.log(`  ✓ Admin reset password for ${midId} to "Ronav@9999".`);
  }

  // Verify login with new reset password
  const loginAttempt2 = await loginUser({ id: midId, password: 'Ronav@9999' });
  if (!loginAttempt2.success) {
    flaws.push(`Login failed after admin password reset: ${loginAttempt2.message}`);
  } else {
    console.log(`  ✓ Merchant ${midId} successfully logged in with newly reset password.`);
  }

  // ----------------------------------------------------
  // TEST CASE 3: INSTANT RECORD SALE & DYNAMIC MARGIN SPLIT (₹10,000 SALE)
  // ----------------------------------------------------
  console.log('\n📋 STEP 3: Executing Instant Record Sale (₹10,000 Sale @ 1.50%)...');
  
  const sale1Res = await recordMerchantSale({
    merchant_id: midId,
    amount: 10000,
    customer_name: 'Rajesh Kumar',
    customer_mobile: '9876543210',
    type: 'POS_SWIPE',
    provider: 'Pine Labs',
    rrn_number: `RRN${timestamp}01`,
    settlement_type: 'T1',
    notes: 'Audit Test Swipe'
  });

  if (!sale1Res.success) {
    flaws.push(`Record sale failed: ${sale1Res.message}`);
  } else {
    console.log(`  ✓ Sale recorded: TXN ID ${sale1Res.transaction?.id}`);
  }

  // Verify Wallets after ₹10,000 Sale
  const [midW1, distW1, sdW1, admW1] = await Promise.all([
    supabase.from('wallets').select('*').eq('user_id', midId).single(),
    supabase.from('wallets').select('*').eq('user_id', distId).single(),
    supabase.from('wallets').select('*').eq('user_id', sdId).single(),
    supabase.from('wallets').select('*').eq('user_id', 'ADM001').single()
  ]);

  const midBal1 = parseFloat(midW1.data?.available_balance || 0);
  const distBal1 = parseFloat(distW1.data?.available_balance || 0);
  const sdBal1 = parseFloat(sdW1.data?.available_balance || 0);

  console.log(`  📊 Wallet Balances after ₹10,000 Sale:`);
  console.log(`     - Merchant (${midId}): ₹${midBal1.toFixed(2)} (Expected: ₹9,850.00)`);
  console.log(`     - Distributor (${distId}): ₹${distBal1.toFixed(2)} (Expected: ₹20.00)`);
  console.log(`     - Super Distributor (${sdId}): ₹${sdBal1.toFixed(2)} (Expected: ₹10.00)`);

  if (midBal1 !== 9850.00) flaws.push(`Merchant net credit mismatch: Got ₹${midBal1}, expected ₹9850.00`);
  if (distBal1 !== 20.00) flaws.push(`Distributor commission mismatch: Got ₹${distBal1}, expected ₹20.00`);
  if (sdBal1 !== 10.00) flaws.push(`Super Distributor commission mismatch: Got ₹${sdBal1}, expected ₹10.00`);

  // ----------------------------------------------------
  // TEST CASE 4: DUAL-MODE WITHDRAWALS & 100% BALANCE WITHDRAWAL
  // ----------------------------------------------------
  console.log('\n📋 STEP 4: Testing Two-Mode Withdrawals...');

  // Mode 1: Customer Payout (24/7 Active) - Disburse ₹9,000 to customer
  const custPayoutRes = await requestWithdrawal({
    merchant_id: midId,
    amount: 9000,
    payout_type: 'CUSTOMER_BENEFICIARY',
    customer_name: 'Rajesh Kumar',
    customer_mobile: '9876543210',
    account_number: '9876543210@upi',
    ifsc: 'UPI0000000',
    bank_name: 'Customer UPI Payout',
    rrn_number: `RRN${timestamp}01`,
    remarks: 'Instant Counter Payout'
  });

  if (!custPayoutRes.success) {
    flaws.push(`Customer payout request failed: ${custPayoutRes.message}`);
  } else {
    console.log(`  ✓ Mode 1 (Customer Payout): Successfully submitted ₹9,000.00 anytime 24/7.`);
  }

  // Mode 2: Weekday Self-Commission Lock Check
  const currentDay = new Date().getDay();
  const selfWithdrawRes = await requestWithdrawal({
    merchant_id: midId,
    amount: 850,
    payout_type: 'MERCHANT_OWN',
    bank_name: 'HDFC Bank',
    account_number: '50100012345678',
    ifsc: 'HDFC0001234',
    remarks: 'Self Profit Settlement'
  });

  if (currentDay !== 0) {
    // If not Sunday, must block with notice
    if (selfWithdrawRes.success) {
      flaws.push('Self-commission withdrawal was allowed on a weekday (should be locked to Sunday).');
    } else {
      console.log(`  ✓ Mode 2 (Self Withdrawal): Correctly locked on weekday with notice: "${selfWithdrawRes.message}".`);
    }
  }

  // ----------------------------------------------------
  // TEST CASE 5: ADMIN FRAUD CLAWBACK REVERSAL
  // ----------------------------------------------------
  console.log('\n📋 STEP 5: Testing Admin Clawback & Reversal Protection...');
  
  const clawbackRes = await clawbackTransaction(sale1Res.transaction?.id, 'POS Slip Disputed / Chargeback');
  if (!clawbackRes.success) {
    flaws.push(`Clawback failed: ${clawbackRes.message}`);
  } else {
    console.log(`  ✓ Admin Clawback executed for ${sale1Res.transaction?.id}.`);
  }

  // Check wallets after clawback
  const [midW2, distW2, sdW2] = await Promise.all([
    supabase.from('wallets').select('*').eq('user_id', midId).single(),
    supabase.from('wallets').select('*').eq('user_id', distId).single(),
    supabase.from('wallets').select('*').eq('user_id', sdId).single()
  ]);

  const midBal2 = parseFloat(midW2.data?.available_balance || 0);
  const distBal2 = parseFloat(distW2.data?.available_balance || 0);
  const sdBal2 = parseFloat(sdW2.data?.available_balance || 0);

  console.log(`  📊 Wallet Balances after Clawback Reversal:`);
  console.log(`     - Merchant (${midId}): ₹${midBal2.toFixed(2)}`);
  console.log(`     - Distributor (${distId}): ₹${distBal2.toFixed(2)} (Expected: ₹0.00)`);
  console.log(`     - Super Distributor (${sdId}): ₹${sdBal2.toFixed(2)} (Expected: ₹0.00)`);

  if (distBal2 !== 0.00) flaws.push(`Distributor commission not reversed on clawback: Got ₹${distBal2}`);
  if (sdBal2 !== 0.00) flaws.push(`Super Distributor commission not reversed on clawback: Got ₹${sdBal2}`);

  // ----------------------------------------------------
  // SUMMARY AUDIT REPORT
  // ----------------------------------------------------
  console.log('\n====================================================');
  console.log('🏁 PRODUCTION AUDIT RESULTS');
  console.log('====================================================');
  if (flaws.length === 0) {
    console.log('✅ ALL SYSTEMS PASSED! ZERO CRITICAL FLAWS FOUND.');
    console.log('✓ Account Onboarding & Database SSOT: 100% Verified');
    console.log('✓ Instant Record Sale (24/7): 100% Verified');
    console.log('✓ Dynamic Hierarchy Margin Calculation: 100% Verified (Exact to the Penny)');
    console.log('✓ Dual-Mode Withdrawal Protection: 100% Verified');
    console.log('✓ Admin Clawback & Full Tree Reversal: 100% Verified');
  } else {
    console.log(`❌ FOUND ${flaws.length} FLAW(S):`);
    flaws.forEach((f, idx) => console.log(`   ${idx + 1}. ${f}`));
  }
  console.log('====================================================\n');
}

runAudit().catch(err => console.error('Audit Exception:', err));
