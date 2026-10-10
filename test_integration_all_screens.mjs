import http from 'node:http';
import { handleApiRequest } from './server/api.js';
import { 
  getAllUsers, 
  getHierarchyTree, 
  createDownstreamUser, 
  getAdminPending, 
  getMerchantWithdrawals, 
  getInquiries,
  getPlatformQrConfig,
  savePlatformQrConfig,
  getCommissionPayoutConfig,
  saveCommissionPayoutConfig,
  adminResetUserPassword,
  updateUserStatus
} from './src/services/api.js';

// Global mock for fetch in Node to point to local server
const TEST_PORT = 5570;
process.env.VITE_API_URL = `http://localhost:${TEST_PORT}`;

const server = http.createServer(async (req, res) => {
  await handleApiRequest(req, res);
});

server.listen(TEST_PORT, async () => {
  console.log('===============================================================');
  console.log('🧪 RONAV COMPREHENSIVE INTEGRATION & SCREEN VERIFICATION TEST');
  console.log('===============================================================');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      failed++;
    }
  }

  try {
    // 1. Verify Initial User Roster
    console.log('\n--- 1. Testing getAllUsers() & Admin User Roster ---');
    const usersRes1 = await getAllUsers();
    assert(usersRes1.success, 'getAllUsers returned success: true');
    assert(Array.isArray(usersRes1.users), 'getAllUsers returned array of users');
    assert(usersRes1.users.some(u => u.id === 'ADM001'), 'Super Admin (ADM001) found in user list');

    // 2. Create Downstream Master Distributor
    console.log('\n--- 2. Testing createDownstreamUser() for Master Distributor ---');
    const dynamicMobile = `98${Math.floor(10000000 + Math.random() * 90000000)}`;
    const createRes = await createDownstreamUser({
      creator_id: 'ADM001',
      name: 'Naveen Master Partner',
      mobile: dynamicMobile,
      role: 'MASTER',
      channels: {
        pine_labs: { enabled: true, rate_t1: 1.5, rate_instant: 1.8, plan: 'RENTAL', rent: 500 },
        payswiff: { enabled: true, rate_t1: 1.6, rate_instant: 1.9, plan: 'RENTAL', rent: 400 },
        qr: { enabled: true, rate_instant: 1.2 }
      }
    });

    assert(createRes.success, `Master Distributor created: ${createRes.message}`);
    assert(createRes.credentials && (createRes.credentials.id.startsWith('MST') || createRes.credentials.id.startsWith('SD')), `Assigned ID prefix valid: ${createRes.credentials?.id}`);
    const createdUserId = createRes.credentials?.id;

    // 3. Verify Newly Created User Appears in getAllUsers()
    console.log('\n--- 3. Verifying Newly Created User Appears in getAllUsers() ---');
    const usersRes2 = await getAllUsers();
    const foundUser = usersRes2.users.find(u => u.id === createdUserId);
    assert(Boolean(foundUser), `Created user ${createdUserId} is present in Admin user list`);
    assert(foundUser?.name === 'Naveen Master Partner', `User name matches entered name: ${foundUser?.name}`);

    // 4. Verify Hierarchy Tree
    console.log('\n--- 4. Testing getHierarchyTree() ---');
    const treeRes = await getHierarchyTree();
    assert(treeRes.success, 'getHierarchyTree returned success: true');
    assert(treeRes.tree && Array.isArray(treeRes.tree.superDistributors), 'Hierarchy tree has superDistributors array');
    assert(Array.isArray(treeRes.flatUsers), 'Hierarchy tree returns flatUsers array');

    // 5. Verify Admin Pending Screen
    console.log('\n--- 5. Testing getAdminPending() ---');
    const pendingRes = await getAdminPending();
    assert(pendingRes.success, 'getAdminPending returned success: true');
    assert(Array.isArray(pendingRes.pendingTransactions), 'Pending transactions list is valid');
    assert(Array.isArray(pendingRes.pendingWithdrawals), 'Pending withdrawals list is valid');

    // 6. Verify Merchant Withdrawals Screen
    console.log('\n--- 6. Testing getMerchantWithdrawals() ---');
    const wthRes = await getMerchantWithdrawals(createdUserId);
    assert(wthRes.success, 'getMerchantWithdrawals returned success: true');
    assert(Array.isArray(wthRes.withdrawals), 'Withdrawals returned as array');

    // 7. Verify Inquiries Screen
    console.log('\n--- 7. Testing getInquiries() ---');
    const inqRes = await getInquiries();
    assert(inqRes.success, 'getInquiries returned success: true');
    assert(Array.isArray(inqRes.inquiries), 'Inquiries returned as array');

    // 8. Verify System Settings Sync
    console.log('\n--- 8. Testing System Settings Sync (QR & Commission Toggle) ---');
    const qrSaveRes = await savePlatformQrConfig({ image: 'data:image/png;base64,TEST', name: 'RONAV HQ PAY' });
    assert(qrSaveRes.success, 'savePlatformQrConfig succeeded');
    const qrGetRes = await getPlatformQrConfig();
    assert(qrGetRes.name === 'RONAV HQ PAY', `getPlatformQrConfig returned updated name: ${qrGetRes.name}`);

    const commSaveRes = await saveCommissionPayoutConfig(true);
    assert(commSaveRes.success, 'saveCommissionPayoutConfig succeeded');
    const commGetRes = await getCommissionPayoutConfig();
    assert(commGetRes.enabled === true, 'getCommissionPayoutConfig returned enabled: true');

    // 9. Verify Admin Password Reset and User Status Toggle
    console.log('\n--- 9. Testing Admin Password Reset & Status Toggle ---');
    const resetRes = await adminResetUserPassword('MST1001', 'NewSecret@2026');
    assert(resetRes.success, `adminResetUserPassword succeeded: ${resetRes.message}`);
    assert(resetRes.newPassword === 'NewSecret@2026', `New password correctly assigned`);

    const toggleRes = await updateUserStatus('MST1001', 'SUSPENDED');
    assert(toggleRes.success, `updateUserStatus to SUSPENDED succeeded: ${toggleRes.message}`);

    const toggleBackRes = await updateUserStatus('MST1001', 'ACTIVE');
    assert(toggleBackRes.success, `updateUserStatus back to ACTIVE succeeded: ${toggleBackRes.message}`);

    console.log('\n===============================================================');
    console.log(`🏁 INTEGRATION TEST RESULTS: ${passed} PASSED | ${failed} FAILED`);
    console.log('===============================================================');

    if (failed > 0) process.exit(1);
    else process.exit(0);

  } catch (err) {
    console.error('Fatal Integration Test Error:', err);
    process.exit(1);
  } finally {
    server.close();
  }
});
