import { chromium } from 'playwright';

async function checkLoginDom() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 412, height: 915 } });
  await page.goto('http://localhost:3000/#merchant-login', { waitUntil: 'networkidle' });
  await page.fill('input[type="text"]', 'MID1001');
  await page.fill('input[type="password"]', 'Ronav@123');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(3000);
  console.log('Current URL:', page.url());
  const bodyText = await page.innerText('body');
  console.log('Body Text snippet:\n', bodyText.slice(0, 800));

  // Check buttons
  const buttons = await page.locator('button').allInnerTexts();
  console.log('Buttons:', buttons.map(b => b.trim()).filter(Boolean));

  await browser.close();
}

checkLoginDom();
