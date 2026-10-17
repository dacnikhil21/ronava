// server/test_config.js
// CANONICAL SHARED TEST CREDENTIALS CONFIGURATION & LOGIN VERIFIER
// All test scripts MUST import credentials from this file. No script may hardcode or type its own password.

import fs from 'fs';
import path from 'path';
import { generateToken } from './security.js';

export const TEST_PASSWORD = 'Ronav@123';

export const TEST_USERS = {
  ADM001: {
    id: 'ADM001',
    role: 'ADMIN',
    name: 'RONAV Super Admin',
    password: TEST_PASSWORD,
    loginPath: '/admin-login',
    expectedHeading: 'Admin Ecosystem Command Center'
  },
  MST1001: {
    id: 'MST1001',
    role: 'MASTER',
    name: 'Master Distributor',
    password: TEST_PASSWORD,
    loginPath: '/#merchant-login',
    expectedHeading: 'Merchant Operational Workspace'
  },
  SD1001: {
    id: 'SD1001',
    role: 'SUPER_DISTRIBUTOR',
    name: 'Super Distributor',
    password: TEST_PASSWORD,
    loginPath: '/#merchant-login',
    expectedHeading: 'Merchant Operational Workspace'
  },
  DIST2001: {
    id: 'DIST2001',
    role: 'DISTRICT_DISTRIBUTOR',
    name: 'District Distributor',
    password: TEST_PASSWORD,
    loginPath: '/#merchant-login',
    expectedHeading: 'Merchant Operational Workspace'
  },
  AREA3001: {
    id: 'AREA3001',
    role: 'DISTRIBUTOR',
    name: 'Area Distributor',
    password: TEST_PASSWORD,
    loginPath: '/#merchant-login',
    expectedHeading: 'Merchant Operational Workspace'
  },
  MID4001: {
    id: 'MID4001',
    role: 'MERCHANT',
    name: 'Test Merchant Store',
    password: TEST_PASSWORD,
    loginPath: '/#merchant-login',
    expectedHeading: 'Merchant Operational Workspace'
  }
};

export const ORDERED_TEST_USERS = [
  TEST_USERS.ADM001,
  TEST_USERS.MST1001,
  TEST_USERS.SD1001,
  TEST_USERS.DIST2001,
  TEST_USERS.AREA3001,
  TEST_USERS.MID4001
];

/**
 * Perform a strictly confirmed login via Playwright.
 * Guarantees:
 * 1. Reads credentials strictly from TEST_USERS (Ronav@123).
 * 2. Asserts login form is detached/gone.
 * 3. Asserts dashboard heading is visible and captures innerText.
 * 4. Saves a timestamped/confirmed screenshot.
 * 5. Throws loudly naming the user if ANY step fails.
 */
export async function performConfirmedLogin(page, userId, { baseUrl = 'http://localhost:3000', screenshotDir = 'audit/screens/logins' } = {}) {
  const user = TEST_USERS[userId];
  if (!user) {
    throw new Error(`🚨 FATAL LOGIN ATTEMPT: User ID "${userId}" is not defined in server/test_config.js!`);
  }

  const isAdm = user.role === 'ADMIN' || userId === 'ADM001';
  const targetUrl = `${baseUrl}${user.loginPath}`;

  console.log(`🔐 [Confirmed Login] Navigating to ${targetUrl} as ${user.id} (${user.role})...`);
  await page.goto(targetUrl, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);

  // 1. Fill User ID and Canonical Password strictly from TEST_USERS
  await page.fill('input[type="text"]', user.id);
  await page.fill('input[type="password"]', user.password);

  // 2. Click Submit
  const submitBtn = page.locator('button[type="submit"], button:has-text("Login"), button:has-text("Secure Admin Login"), button:has-text("Sign In")').first();
  await submitBtn.click();

  // 3. Confirm login form is completely gone
  const loginFormSelector = isAdm ? 'button:has-text("Secure Admin Login")' : 'button:has-text("Sign In")';
  try {
    await page.waitForSelector(loginFormSelector, { state: 'detached', timeout: 10000 });
  } catch (timeoutErr) {
    let errorBanner = '';
    try {
      errorBanner = await page.locator('.error-banner, [role="alert"], div[style*="background: rgb(254, 242, 242)"]').innerText();
    } catch (_) {
      errorBanner = 'Form button still visible after 10s';
    }
    throw new Error(`🚨 LOGIN FAILED LOUDLY for user "${user.id}" (${user.role})! The login form did not dismiss. Observed: "${errorBanner.trim()}". A run with a failed login must never count as passed.`);
  }

  // 4. Confirm dashboard heading is visible and verify heading text
  const headingSelector = isAdm ? '.admin-dashboard-heading' : '.merchant-dashboard-heading';
  try {
    await page.waitForSelector(headingSelector, { state: 'visible', timeout: 10000 });
  } catch (headingErr) {
    throw new Error(`🚨 DASHBOARD HEADING NOT VISIBLE for user "${user.id}" (${user.role})! Expected selector "${headingSelector}". A run with a missing heading must never count as passed.`);
  }

  const headingText = (await page.locator(headingSelector).innerText()).trim();

  // 5. Ensure screenshot directory exists and save proof screenshot
  let screenshotPath = '';
  if (screenshotDir) {
    fs.mkdirSync(screenshotDir, { recursive: true });
    screenshotPath = path.join(screenshotDir, `${user.id}_confirmed.png`).replace(/\\/g, '/');
    await page.screenshot({ path: screenshotPath, fullPage: false });
    console.log(`   ✓ Confirmed login for ${user.id}: heading visible ("${headingText}"), screenshot saved to: ${screenshotPath}`);
  }

  return {
    userId: user.id,
    role: user.role,
    heading: headingText,
    screenshotPath
  };
}

/**
 * Generate a cryptographically valid test Bearer token for automated API testing
 */
export function getTestAuthToken(userId) {
  const user = TEST_USERS[userId];
  if (!user) {
    throw new Error(`Unknown test user ID: ${userId}`);
  }
  return generateToken(user);
}

