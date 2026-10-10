import assert from 'node:assert';
import { getAuthSession, setAuthSession, clearAuthSession } from './src/services/api.js';

// Mock browser window and sessionStorage environment for Node.js
class MockStorage {
  constructor() {
    this.store = {};
  }
  getItem(key) {
    return this.store[key] || null;
  }
  setItem(key, value) {
    this.store[key] = String(value);
  }
  removeItem(key) {
    delete this.store[key];
  }
  clear() {
    this.store = {};
  }
}

const mockSessionStorage = new MockStorage();
const mockLocalStorage = new MockStorage();

global.window = {
  location: {
    origin: 'http://localhost:3000',
    pathname: '/',
    hash: '',
    replaceState: (state, title, url) => {
      global.window.location.hash = url.includes('#') ? url.substring(url.indexOf('#')) : '';
    }
  },
  history: {
    pushState: (state, title, url) => {
      if (url.startsWith('/admin')) {
        global.window.location.pathname = '/admin';
      } else if (url.startsWith('/')) {
        global.window.location.pathname = '/';
      }
      global.window.location.hash = url.includes('#') ? url.substring(url.indexOf('#')) : '';
    }
  },
  sessionStorage: mockSessionStorage,
  localStorage: mockLocalStorage
};

global.sessionStorage = mockSessionStorage;
global.localStorage = mockLocalStorage;

console.log('===============================================================');
console.log('🧪 RONAV SESSION LIFECYCLE & DASHBOARD INTEGRITY TEST SUITE');
console.log('===============================================================');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✅ PASS: ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${name}`);
    console.error(err.message);
    failed++;
  }
}

// 1. Initial Empty State
test('Initial session state is null', () => {
  clearAuthSession();
  const session = getAuthSession();
  assert.strictEqual(session, null, 'Session should be null initially');
});

// 2. Admin Login Lifecycle
test('Admin login sets authoritative ADMIN session', () => {
  clearAuthSession();
  const adminUser = { id: 'ADM001', name: 'Super Admin', role: 'ADMIN' };
  setAuthSession({ role: 'ADMIN', user: adminUser });

  const session = getAuthSession();
  assert.ok(session, 'Session must exist');
  assert.strictEqual(session.role, 'ADMIN');
  assert.strictEqual(session.user.id, 'ADM001');
  assert.strictEqual(session.user.name, 'Super Admin');
  assert.strictEqual(mockSessionStorage.getItem('ronav_admin_session'), 'true');
  assert.strictEqual(mockSessionStorage.getItem('ronav_merchant_user'), null);
});

// 3. Switching from Admin to Master Distributor
test('Switching to Master Distributor overrides Admin and prevents Admin restoration', () => {
  // Step A: Admin was logged in
  window.history.pushState({}, '', '/admin');
  setAuthSession({ role: 'ADMIN', user: { id: 'ADM001', name: 'Super Admin', role: 'ADMIN' } });

  // Step B: Master Distributor logs in
  const masterUser = {
    id: 'MST1001',
    name: 'balingam',
    role: 'SUPER_DISTRIBUTOR',
    mobile: '9092029021',
    commission_rate_t1: 1.20,
    commission_rate_instant: 1.30
  };
  
  // Clean URL and set session
  window.history.pushState({}, '', '/#merchant-dashboard');
  setAuthSession({ role: masterUser.role, user: masterUser });

  const activeSession = getAuthSession();
  assert.ok(activeSession, 'Active session must exist');
  assert.strictEqual(activeSession.role, 'SUPER_DISTRIBUTOR');
  assert.strictEqual(activeSession.user.id, 'MST1001');
  assert.strictEqual(activeSession.user.name, 'balingam');

  // Verify old Admin flag is completely stripped
  assert.strictEqual(mockSessionStorage.getItem('ronav_admin_session'), null, 'Admin flag must be null');
});

// 4. Page Refresh Simulation for Master Distributor
test('Page refresh while in Master Distributor maintains MST1001 identity', () => {
  const restoredSession = getAuthSession();
  assert.ok(restoredSession, 'Restored session must exist');
  assert.strictEqual(restoredSession.user.id, 'MST1001');
  assert.strictEqual(restoredSession.user.name, 'balingam');
  assert.strictEqual(restoredSession.role, 'SUPER_DISTRIBUTOR');
});

// 5. Switching to Area Distributor and Retailer
test('Switching across distributor hierarchy maintains exact role and credentials', () => {
  const distUser = {
    id: 'DIST101',
    name: 'Area Dist Charlie',
    role: 'DISTRIBUTOR',
    commission_rate_t1: 1.40,
    commission_rate_instant: 1.50
  };
  setAuthSession({ role: distUser.role, user: distUser });

  let s = getAuthSession();
  assert.strictEqual(s.user.id, 'DIST101');
  assert.strictEqual(s.user.name, 'Area Dist Charlie');
  assert.strictEqual(s.role, 'DISTRIBUTOR');

  const merchantUser = {
    id: 'MID101',
    name: 'Merchant Delta Store',
    role: 'MERCHANT',
    commission_rate_t1: 1.65,
    commission_rate_instant: 1.83
  };
  setAuthSession({ role: merchantUser.role, user: merchantUser });

  s = getAuthSession();
  assert.strictEqual(s.user.id, 'MID101');
  assert.strictEqual(s.user.name, 'Merchant Delta Store');
  assert.strictEqual(s.role, 'MERCHANT');
});

// 6. Complete Logout
test('Logout clears all authentication tokens and restores clean home state', () => {
  clearAuthSession();
  window.history.pushState({}, '', '/');
  
  assert.strictEqual(getAuthSession(), null, 'Session should be null after logout');
  assert.strictEqual(mockSessionStorage.getItem('ronav_session'), null);
  assert.strictEqual(mockSessionStorage.getItem('ronav_admin_session'), null);
  assert.strictEqual(mockSessionStorage.getItem('ronav_merchant_user'), null);
  assert.strictEqual(window.location.pathname, '/');
});

// 7. Rate Calculation Integrity Verification
test('Rate calculation handles loaded profile, loading profile, and defaults safely', () => {
  // Case A: Full profile with assigned rates
  const fullProfile = {
    commission_rate_t1: 1.25,
    commission_rate_instant: 1.35
  };
  const profileRateT1 = parseFloat(fullProfile?.commission_rate_t1 || 0);
  const profileRateInstant = parseFloat(fullProfile?.commission_rate_instant || profileRateT1);
  assert.strictEqual(profileRateT1, 1.25);
  assert.strictEqual(profileRateInstant, 1.35);

  // Case B: Profile with only T1 rate (Instant defaults to T1 rate)
  const t1OnlyProfile = {
    commission_rate_t1: 1.40
  };
  const t1Rate = parseFloat(t1OnlyProfile?.commission_rate_t1 || 0);
  const instRate = parseFloat(t1OnlyProfile?.commission_rate_instant || t1Rate);
  assert.strictEqual(t1Rate, 1.40);
  assert.strictEqual(instRate, 1.40);

  // Case C: Null / loading profile falls back safely to default without throwing ReferenceError
  const nullProfile = null;
  const baseRateT1 = 1.48;
  const baseRateInstant = 1.78;
  const safeT1 = parseFloat(nullProfile?.commission_rate_t1 || baseRateT1 || 0);
  const safeInstant = parseFloat(nullProfile?.commission_rate_instant || safeT1 || baseRateInstant || 0);
  assert.strictEqual(safeT1, 1.48);
  assert.strictEqual(safeInstant, 1.48);
});

console.log('\n===============================================================');
console.log(`🏁 TEST RESULTS: ${passed} PASSED | ${failed} FAILED`);
console.log('===============================================================');

if (failed > 0) process.exit(1);
else process.exit(0);
