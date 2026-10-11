import assert from 'node:assert';

async function runAudit() {
  const baseUrl = 'http://13.201.4.145';
  console.log('===============================================================');
  console.log('🧪 RUNNING COMPREHENSIVE 3-SCENARIO AUDIT ON RONAV PLATFORM');
  console.log('===============================================================\n');

  const getBal = async (id) => {
    const res = await fetch(`${baseUrl}/api/wallet/${id}`).then(r => r.json());
    return parseFloat(res.wallet?.available_balance || 0);
  };

  // --- 1. Scenario 1: Distributor Direct Swipe ---
  console.log('--- SCENARIO 1: Distributor Direct Swipe (DIST1001 swiping ₹10,000) ---');
  const bDist_0 = await getBal('DIST1001');
  const bDD_0 = await getBal('DD1001');
  const bSD_0 = await getBal('SD1001');
  const bMST_0 = await getBal('MST1001');
  const bAdmin_0 = await getBal('ADM001');

  const slipRef1 = `SLIP-D1-${Date.now().toString().slice(-6)}`;
  const res1 = await fetch(`${baseUrl}/api/transactions/record`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      merchant_id: 'DIST1001',
      amount: 10000,
      customer_mobile: '9876543204',
      provider: 'Pine Labs',
      type: 'POS_SWIPE',
      ref_number: slipRef1,
      settlement_type: 'T1'
    })
  }).then(r => r.json());

  console.log('Distributor Direct Sale Status:', res1.success ? '✅ SUCCESS' : '❌ FAILED', res1.message || '');
  assert.strictEqual(res1.success, true, 'Distributor direct swipe failed');

  const bDist_1 = await getBal('DIST1001');
  const bDD_1 = await getBal('DD1001');
  const bSD_1 = await getBal('SD1001');
  const bMST_1 = await getBal('MST1001');
  const bAdmin_1 = await getBal('ADM001');

  const deltaDist = parseFloat((bDist_1 - bDist_0).toFixed(2));
  const deltaDD = parseFloat((bDD_1 - bDD_0).toFixed(2));
  const deltaSD = parseFloat((bSD_1 - bSD_0).toFixed(2));
  const deltaMST = parseFloat((bMST_1 - bMST_0).toFixed(2));
  const deltaAdmin = parseFloat((bAdmin_1 - bAdmin_0).toFixed(2));

  console.log(`  ✓ DIST1001 (Distributor Shop) Net Credit Delta: +₹${deltaDist} (Expected: +₹9840.00)`);
  console.log(`  ✓ DD1001 (Upline District Dist) Commission Delta: +₹${deltaDD} (Expected: +₹20.00)`);
  console.log(`  ✓ SD1001 (Upline Super Dist) Commission Delta: +₹${deltaSD} (Expected: +₹20.00)`);
  console.log(`  ✓ MST1001 (Upline Master Partner) Commission Delta: +₹${deltaMST} (Expected: +₹20.00)`);
  console.log(`  ✓ ADM001 (Admin Net Margin) Delta: +₹${deltaAdmin} (Expected: +₹100.00)`);
  
  assert.strictEqual(deltaDist, 9840.00);
  assert.strictEqual(deltaDD, 20.00);
  assert.strictEqual(deltaSD, 20.00);
  assert.strictEqual(deltaMST, 20.00);
  assert.strictEqual(deltaAdmin, 100.00);
  console.log('  ✅ SCENARIO 1 PASSED: 100% exact upline distribution on Distributor direct sale!\n');

  // --- 2. Scenario 2: Super Distributor Direct Merchant (Skipping DD & Area Dist) ---
  console.log('--- SCENARIO 2: Skipped Tiers (SD1001 onboards MID_DIRECT at 1.80%, skipping DD and DIST) ---');
  const directMerchantMobile = `91${Math.floor(10000000 + Math.random() * 90000000)}`;
  const createDirectRes = await fetch(`${baseUrl}/api/users/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      creator_id: 'SD1001',
      name: 'Direct Store Under SD',
      mobile: directMerchantMobile,
      role: 'MERCHANT',
      password: 'Ronav@123',
      commission_rate_t1: '1.80',
      commission_rate_instant: '2.00',
      channels: {
        pine_labs: { enabled: true, terminal_id: 'PL-DIRECT-SD', vendor: 'Rose Navaneetham Enterprises', plan: 'RENTAL', rent: '499', rate_t1: '1.80', rate_instant: '2.00' }
      }
    })
  }).then(r => r.json());

  console.log('Direct Merchant Creation:', createDirectRes.success ? `✅ SUCCESS (${createDirectRes.user?.id})` : '❌ FAILED');
  assert.strictEqual(createDirectRes.success, true);
  const directMid = createDirectRes.user.id;

  const bMid_before = await getBal(directMid);
  const bSD_before = await getBal('SD1001');
  const bMST_before = await getBal('MST1001');
  const bDD_before = await getBal('DD1001');
  const bAdmin_before = await getBal('ADM001');

  const slipRef2 = `SLIP-D2-${Date.now().toString().slice(-6)}`;
  const res2 = await fetch(`${baseUrl}/api/transactions/record`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      merchant_id: directMid,
      amount: 10000,
      customer_mobile: directMerchantMobile,
      provider: 'Pine Labs',
      type: 'POS_SWIPE',
      ref_number: slipRef2,
      settlement_type: 'T1'
    })
  }).then(r => r.json());

  console.log('Direct Merchant Sale Recorded:', res2.success ? '✅ SUCCESS' : '❌ FAILED');
  assert.strictEqual(res2.success, true);

  const bMid_after = await getBal(directMid);
  const bSD_after = await getBal('SD1001');
  const bMST_after = await getBal('MST1001');
  const bDD_after = await getBal('DD1001');
  const bAdmin_after = await getBal('ADM001');

  const deltaMid2 = parseFloat((bMid_after - bMid_before).toFixed(2));
  const deltaSD2 = parseFloat((bSD_after - bSD_before).toFixed(2));
  const deltaMST2 = parseFloat((bMST_after - bMST_before).toFixed(2));
  const deltaDD2 = parseFloat((bDD_after - bDD_before).toFixed(2));
  const deltaAdmin2 = parseFloat((bAdmin_after - bAdmin_before).toFixed(2));

  console.log(`  ✓ MID_DIRECT Net Credit Delta: +₹${deltaMid2} (Expected: +₹9820.00)`);
  console.log(`  ✓ SD1001 (Direct Upline) Commission Delta: +₹${deltaSD2} (Expected: +₹60.00)`);
  console.log(`  ✓ MST1001 (Master Upline) Commission Delta: +₹${deltaMST2} (Expected: +₹20.00)`);
  console.log(`  ✓ DD1001 (Skipped Intermediate Tier) Commission Delta: +₹${deltaDD2} (Expected: +₹0.00 [Untouched])`);
  console.log(`  ✓ ADM001 (Admin Margin) Delta: +₹${deltaAdmin2} (Expected: +₹100.00)`);

  assert.strictEqual(deltaMid2, 9820.00);
  assert.strictEqual(deltaSD2, 60.00);
  assert.strictEqual(deltaMST2, 20.00);
  assert.strictEqual(deltaDD2, 0.00);
  assert.strictEqual(deltaAdmin2, 100.00);
  console.log('  ✅ SCENARIO 2 PASSED: Dynamic upline climbing handles skipped tiers without fallback errors!\n');

  // --- 3. Scenario 3: Admin Rejection & Atomic Clawback Reconciliation ---
  console.log('--- SCENARIO 3: Admin Rejection & Atomic Clawback ---');
  const txnToReject = res2.transaction.id;
  const rejectRes = await fetch(`${baseUrl}/api/admin/verify-transaction`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      txnId: txnToReject,
      action: 'REJECT',
      remark: 'Test dispute reversal clawback verification'
    })
  }).then(r => r.json());

  console.log('Admin Rejection Response:', rejectRes.success ? '✅ REJECTED & CLAWED BACK' : '❌ FAILED');
  assert.strictEqual(rejectRes.success, true);

  const bMid_postClaw = await getBal(directMid);
  const bSD_postClaw = await getBal('SD1001');
  const bMST_postClaw = await getBal('MST1001');
  const bAdmin_postClaw = await getBal('ADM001');

  const clawbackMid = parseFloat((bMid_postClaw - bMid_after).toFixed(2));
  const clawbackSD = parseFloat((bSD_postClaw - bSD_after).toFixed(2));
  const clawbackMST = parseFloat((bMST_postClaw - bMST_after).toFixed(2));
  const clawbackAdmin = parseFloat((bAdmin_postClaw - bAdmin_after).toFixed(2));

  console.log(`  ✓ MID_DIRECT Balance Clawback: ${clawbackMid} (Expected: -₹9820.00)`);
  console.log(`  ✓ SD1001 Commission Clawback: ${clawbackSD} (Expected: -₹60.00)`);
  console.log(`  ✓ MST1001 Commission Clawback: ${clawbackMST} (Expected: -₹20.00)`);
  console.log(`  ✓ ADM001 Platform Margin Clawback: ${clawbackAdmin} (Expected: -₹100.00)`);

  assert.strictEqual(clawbackMid, -9820.00);
  assert.strictEqual(clawbackSD, -60.00);
  assert.strictEqual(clawbackMST, -20.00);
  assert.strictEqual(clawbackAdmin, -100.00);
  console.log('  ✅ SCENARIO 3 PASSED: Exact atomic clawback of all merchant credits, upline commissions & platform margins!\n');

  console.log('===============================================================');
  console.log('🏁 ALL 3 USER SCENARIOS AUDITED AND PROVEN 100% ACCURATE');
  console.log('===============================================================');
}

runAudit();
