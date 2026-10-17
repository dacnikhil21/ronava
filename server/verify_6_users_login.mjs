// server/verify_6_users_login.mjs
// Verifies confirmed login for all 6 test users using canonical credentials from test_config.js.
// Captures proof screenshots, records observed page headings, and tests failure handling.

import { chromium } from 'playwright';
import { cleanAndReseed } from './clean_and_reseed.mjs';
import { ORDERED_TEST_USERS, performConfirmedLogin } from './test_config.js';

async function run() {
  console.log('=== VERIFYING CONFIRMED LOGIN FOR ALL 6 TEST USERS ===');
  
  // 1. Reseed clean test database
  await cleanAndReseed();

  const browser = await chromium.launch({ headless: true });
  const results = [];

  try {
    for (const user of ORDERED_TEST_USERS) {
      console.log(`\n▶ Testing confirmed login for: ${user.id} (${user.role})...`);
      const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
      const page = await context.newPage();

      try {
        const loginData = await performConfirmedLogin(page, user.id, {
          baseUrl: 'http://localhost:3000',
          screenshotDir: 'audit/screens/logins'
        });

        results.push({
          userId: user.id,
          role: user.role,
          heading: loginData.heading,
          screenshotPath: loginData.screenshotPath,
          status: 'CONFIRMED_PASSED'
        });
      } finally {
        await context.close();
      }
    }

    console.log('\n============================================================');
    console.log('         CONFIRMED LOGIN AUDIT RESULTS (ALL 6 USERS)        ');
    console.log('============================================================');
    console.table(results.map(r => ({
      'User ID': r.userId,
      'Role': r.role,
      'Page Heading Seen': r.heading,
      'Screenshot Path': r.screenshotPath,
      'Status': r.status
    })));

    // 2. Also verify failure handling: intentional wrong login MUST fail loudly
    console.log('\n▶ Testing failure guard: attempting login with invalid user...');
    const failContext = await browser.newContext();
    const failPage = await failContext.newPage();
    let failedLoudly = false;
    try {
      await performConfirmedLogin(failPage, 'NON_EXISTENT_USER');
    } catch (err) {
      failedLoudly = true;
      console.log(`   ✓ Correctly failed loudly: "${err.message}"`);
    } finally {
      await failContext.close();
    }

    if (!failedLoudly) {
      throw new Error('Failure guard check failed: invalid login did not throw loudly!');
    }

    console.log('\n🎉 ALL 6 USERS SUCCESSFULLY CONFIRMED AND VERIFIED WITH REAL SCREENSHOTS!');
  } finally {
    await browser.close();
  }
}

run().catch(err => {
  console.error('\n🚨 VERIFICATION FAILED LOUDLY:', err);
  process.exit(1);
});
