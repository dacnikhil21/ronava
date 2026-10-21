import { chromium } from 'playwright';

const BASE_URL = 'http://localhost:3000';
const PASSWORD = 'Ronav@123';

const TEST_ROLES = [
  { role: 'MERCHANT', id: 'MID1001', name: 'Merchant MID1001' },
  { role: 'DISTRIBUTOR', id: 'DIST1001', name: 'Area Distributor DIST1001' },
  { role: 'DISTRICT_DISTRIBUTOR', id: 'DD1001', name: 'District Distributor DD1001' },
  { role: 'MASTER', id: 'MST1002', name: 'Master Distributor MST1002' },
  { role: 'ADMIN', id: 'ADM001', name: 'Super Admin ADM001' }
];

async function runStep1Audit() {
  console.log('=== STEP 1: REAL BROWSER AUDIT ACROSS ALL ROLES & SCREENS ===\n');

  const browser = await chromium.launch({ headless: true });
  const reportRows = [];
  let swipeToastDetails = null;

  for (const target of TEST_ROLES) {
    console.log(`\n--------------------------------------------------`);
    console.log(`AUDITING ROLE: ${target.role} (${target.id})`);
    console.log(`--------------------------------------------------`);

    const context = await browser.newContext();
    const page = await context.newPage();

    let currentScreen = 'login';
    let currentAction = 'initial_load';

    // Track network errors (4xx / 5xx)
    page.on('response', async (res) => {
      const status = res.status();
      const url = res.url();
      if (status >= 400 && !url.includes('favicon.ico')) {
        let body = '';
        try {
          body = await res.text();
        } catch (_) {
          body = '<unreadable body>';
        }
        reportRows.push({
          role: target.role,
          userId: target.id,
          screen: currentScreen,
          action: currentAction,
          url,
          status,
          body: body.slice(0, 150),
          type: 'HTTP_ERROR'
        });
        console.log(`  [HTTP ${status}] ${url.replace(BASE_URL, '')} (${currentScreen} / ${currentAction})`);
      }
    });

    // Track console errors and warnings
    page.on('console', (msg) => {
      const type = msg.type();
      const text = msg.text();
      if (type === 'error' || type === 'warning') {
        if (!text.includes('Download the React DevTools') && !text.includes('favicon')) {
          reportRows.push({
            role: target.role,
            userId: target.id,
            screen: currentScreen,
            action: currentAction,
            url: text.slice(0, 100),
            status: type.toUpperCase(),
            body: text.slice(0, 150),
            type: 'CONSOLE'
          });
        }
      }
    });

    // 1. Visit Login Page
    currentScreen = target.role === 'ADMIN' ? 'admin-login' : 'merchant-login';
    currentAction = 'open_login';
    await page.goto(`${BASE_URL}/#${currentScreen}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    // 2. Perform Login
    currentAction = 'submit_login';
    if (target.role === 'ADMIN') {
      await page.fill('input[placeholder*="ADM"], input[type="text"]', target.id);
      await page.fill('input[type="password"]', PASSWORD);
      await page.click('button[type="submit"]');
    } else {
      await page.fill('input[placeholder*="User ID"], input[type="text"]', target.id);
      await page.fill('input[type="password"]', PASSWORD);
      await page.click('button[type="submit"]');
    }
    await page.waitForTimeout(2000);

    // 3. Navigate tabs
    if (target.role === 'ADMIN') {
      const adminTabs = [
        { name: 'Dashboard', hash: '#admin-dashboard' },
        { name: 'Payouts', text: 'Payout Requests' },
        { name: 'Transactions', text: 'All Transactions' },
        { name: 'Merchants', text: 'Merchant Network' },
        { name: 'Reports', text: 'Reports & Analytics' }
      ];

      for (const tab of adminTabs) {
        currentScreen = `Admin > ${tab.name}`;
        currentAction = 'view_tab';
        if (tab.text) {
          const btn = page.locator(`button:has-text("${tab.text}"), div:has-text("${tab.text}")`).first();
          if (await btn.isVisible()) {
            await btn.click();
            await page.waitForTimeout(1500);
          }
        }
      }
    } else {
      // Merchant / Distributor Screens
      const merchantTabs = [
        { key: 'home', name: 'Home Workspace' },
        { key: 'record-sale', name: 'Record Sale' },
        { key: 'withdraw', name: 'Withdraw Payout' },
        { key: 'network', name: 'My Network / Downline' },
        { key: 'history', name: 'Transactions Ledger' },
        { key: 'bbps', name: 'Bill Payments (BBPS)' }
      ];

      for (const tab of merchantTabs) {
        currentScreen = `Merchant > ${tab.name}`;
        currentAction = `view_${tab.key}`;
        
        // Try navigation
        const tabBtn = page.locator(`button:has-text("${tab.name}"), div:has-text("${tab.name}"), [data-tab="${tab.key}"]`).first();
        if (await tabBtn.isVisible()) {
          await tabBtn.click();
          await page.waitForTimeout(1500);
        } else {
          // Alternative bottom bar buttons
          const altBtn = page.locator(`button:has-text("${tab.key}"), div:has-text("${tab.key}")`).first();
          if (await altBtn.isVisible()) {
            await altBtn.click();
            await page.waitForTimeout(1500);
          }
        }

        // Test Record Sale specifically to catch the exact toast trigger
        if (tab.key === 'record-sale') {
          currentAction = 'perform_swipe_sale';
          console.log(`  -> Performing test swipe on Record Sale for ${target.id}...`);
          try {
            await page.fill('input[placeholder*="0.00"], input[type="number"]', '100');
            const utrInput = page.locator('input[placeholder*="UTR"], input[placeholder*="slip"], input[placeholder*="3344"]').first();
            if (await utrInput.isVisible()) {
              const testUtr = `TEST-${Date.now().toString().slice(-6)}`;
              await utrInput.fill(testUtr);
            }

            // Click submit button
            const submitBtn = page.locator('button:has-text("Record"), button:has-text("Enter Amount")').first();
            if (await submitBtn.isVisible()) {
              await submitBtn.click();
              await page.waitForTimeout(2000);

              // Check what toasts or banners appeared
              const toastEl = page.locator('.toast, [role="alert"], div:has-text("wrong"), div:has-text("Swipe Recorded")').first();
              if (await toastEl.isVisible()) {
                const toastText = await toastEl.textContent();
                console.log(`  -> User Toast on Swipe: "${toastText.trim()}"`);
                if (toastText.includes('wrong') || toastText.includes('Error')) {
                  swipeToastDetails = {
                    role: target.role,
                    userId: target.id,
                    toast: toastText.trim()
                  };
                }
              }
            }
          } catch (err) {
            console.log(`  -> Swipe form interaction error: ${err.message}`);
          }
        }
      }
    }

    await context.close();
  }

  await browser.close();

  console.log('\n==================================================');
  console.log('AUDIT SUMMARY');
  console.log('==================================================');
  console.log(`Total 4xx/5xx HTTP errors & warnings recorded: ${reportRows.length}`);
  if (swipeToastDetails) {
    console.log(`Triggered Swipe Error Toast:`, swipeToastDetails);
  }

  return { reportRows, swipeToastDetails };
}

runStep1Audit().then(res => {
  console.log('Audit completed successfully.');
  process.exit(0);
}).catch(err => {
  console.error('Audit failed:', err);
  process.exit(1);
});
