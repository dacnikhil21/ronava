import http from 'node:http';
import { handleApiRequest } from './server/api.js';
import { setMockQueryHandler } from './server/pg_db.js';

// In-Memory Test Database State
const mockDb = {
  users: [
    { id: 'ADM001', name: 'Super Admin', role: 'ADMIN', mobile: '9966203053', password: 'Ronav@123' },
    { id: 'MID1001', name: 'Test Merchant', role: 'MERCHANT', mobile: '9876543210', password: 'Secret@123' }
  ],
  wallets: [
    { user_id: 'MID1001', available_balance: 5000, total_sales: 10000, received_sales: 5000, pending_balance: 0, withdrawn_amount: 0 }
  ],
  merchant_pos: [
    { merchant_id: 'MID1001', provider: 'Pine Labs', terminal_id: 'PL-1001', commission_rate: 1.50 }
  ],
  transactions: [
    { id: 'TXN-PL-001', merchant_id: 'MID1001', amount: 1000, status: 'PENDING', ref_number: 'REF123456' }
  ],
  inquiries: []
};

// Configure Mock Query Engine
setMockQueryHandler(async (sql, params = []) => {
  const cleanSql = sql.replace(/\s+/g, ' ').trim();

  // Public stats count queries
  if (cleanSql.includes("COUNT(*) as c FROM users WHERE role = 'MERCHANT'")) {
    return [{ c: mockDb.users.filter(u => u.role === 'MERCHANT').length }];
  }
  if (cleanSql.includes("COUNT(*) as c FROM users WHERE role = 'SUPER_DISTRIBUTOR'")) {
    return [{ c: mockDb.users.filter(u => u.role === 'SUPER_DISTRIBUTOR').length }];
  }
  if (cleanSql.includes("COUNT(*) as c FROM users WHERE role IN")) {
    return [{ c: mockDb.users.filter(u => u.role === 'DISTRIBUTOR').length }];
  }
  if (cleanSql.includes("SUM(amount) as s FROM transactions WHERE status = 'APPROVED'")) {
    const sum = mockDb.transactions.filter(t => t.status === 'APPROVED').reduce((s, t) => s + t.amount, 0);
    return [{ s: sum }];
  }
  if (cleanSql.includes("COUNT(*) as c FROM merchant_pos")) {
    return [{ c: mockDb.merchant_pos.length }];
  }

  // User queries
  if (cleanSql.startsWith('SELECT * FROM users WHERE UPPER(id) = UPPER($1)')) {
    const user = mockDb.users.find(u => u.id.toUpperCase() === params[0].toUpperCase());
    return user ? [user] : [];
  }
  if (cleanSql.includes('FROM users WHERE UPPER(id) = UPPER($1) OR mobile = $1')) {
    const user = mockDb.users.find(u => u.id.toUpperCase() === params[0].toUpperCase() || u.mobile === params[0]);
    return user ? [user] : [];
  }
  if (cleanSql.includes('SELECT u.id, u.name, u.mobile')) {
    const user = mockDb.users.find(u => u.id.toUpperCase() === params[0].toUpperCase());
    return user ? [user] : [];
  }

  // Transaction queries
  if (cleanSql.startsWith('SELECT * FROM transactions WHERE id = $1')) {
    const txn = mockDb.transactions.find(t => t.id === params[0]);
    return txn ? [txn] : [];
  }

  // Password update
  if (cleanSql.startsWith('UPDATE users SET password = $1')) {
    const user = mockDb.users.find(u => u.id.toUpperCase() === params[1].toUpperCase());
    if (user) user.password = params[0];
    return [{ success: true }];
  }

  // Inquiry insert
  if (cleanSql.startsWith('INSERT INTO inquiries')) {
    mockDb.inquiries.push({ id: params[0], remarks: params[params.length - 1] });
    return [{ id: params[0] }];
  }

  // POS assign
  if (cleanSql.includes('INSERT INTO merchant_pos')) {
    return [{ merchant_id: params[0] }];
  }
  if (cleanSql.includes('SELECT * FROM merchant_pos WHERE merchant_id = $1')) {
    return [{ merchant_id: params[0], provider: 'Pine Labs', terminal_id: 'PL-1001' }];
  }

  return [];
});

// Start ephemeral local test server
const server = http.createServer(async (req, res) => {
  if (req.url && req.url.startsWith('/api/')) {
    await handleApiRequest(req, res);
    return;
  }
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

const PORT = 5556;
server.listen(PORT, '127.0.0.1', async () => {
  console.log('===============================================================');
  console.log('🛡️ RONAV BATCH 1: CRITICAL SECURITY AUTOMATED TEST SUITE');
  console.log(`Running against Local Ephemeral Test Server: http://127.0.0.1:${PORT}`);
  console.log('===============================================================\n');

  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      await fn();
      console.log(`  ✅ PASS: ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ FAIL: ${name} -> ${err.message}`);
      failed++;
    }
  }

  // -------------------------------------------------------------
  // GROUP 1: SECURITY LOCKOUT & ARBITRARY ACCESS REJECTIONS
  // -------------------------------------------------------------
  console.log('▶ GROUP 1: VERIFYING /api/db/* REJECTIONS (SEC-01 & SEC-02)');

  await test('POST /api/db/query is blocked with HTTP 403', async () => {
    const res = await fetch(`http://127.0.0.1:${PORT}/api/db/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sql: 'SELECT 1;' })
    });
    const json = await res.json();
    if (res.status !== 403 || json.success !== false || json.error !== 'ACCESS_DENIED') {
      throw new Error(`Expected HTTP 403 with ACCESS_DENIED, got status ${res.status}`);
    }
  });

  await test('POST /api/db/insert is blocked with HTTP 403', async () => {
    const res = await fetch(`http://127.0.0.1:${PORT}/api/db/insert`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ table: 'wallets', data: { user_id: 'HACK', available_balance: 999999 } })
    });
    const json = await res.json();
    if (res.status !== 403 || json.success !== false || json.error !== 'ACCESS_DENIED') {
      throw new Error(`Expected HTTP 403, got status ${res.status}`);
    }
  });

  await test('POST /api/db/update is blocked with HTTP 403', async () => {
    const res = await fetch(`http://127.0.0.1:${PORT}/api/db/update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ table: 'users', data: { role: 'ADMIN' }, matchColumn: 'id', matchValue: 'TEST' })
    });
    const json = await res.json();
    if (res.status !== 403 || json.success !== false || json.error !== 'ACCESS_DENIED') {
      throw new Error(`Expected HTTP 403, got status ${res.status}`);
    }
  });

  await test('POST /api/db/delete is blocked with HTTP 403', async () => {
    const res = await fetch(`http://127.0.0.1:${PORT}/api/db/delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ table: 'users', matchColumn: 'id', matchValue: 'ADM001' })
    });
    const json = await res.json();
    if (res.status !== 403 || json.success !== false || json.error !== 'ACCESS_DENIED') {
      throw new Error(`Expected HTTP 403, got status ${res.status}`);
    }
  });

  await test('POST /api/db/select is blocked with HTTP 403', async () => {
    const res = await fetch(`http://127.0.0.1:${PORT}/api/db/select`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ table: 'users' })
    });
    const json = await res.json();
    if (res.status !== 403 || json.success !== false || json.error !== 'ACCESS_DENIED') {
      throw new Error(`Expected HTTP 403, got status ${res.status}`);
    }
  });

  // -------------------------------------------------------------
  // GROUP 2: PASSWORD SECURITY & ROLE AUTHORIZATION
  // -------------------------------------------------------------
  console.log('\n▶ GROUP 2: VERIFYING PASSWORD SECURITY & ROLE AUTHORIZATION');

  await test('POST /api/auth/change-password rejects missing required fields with HTTP 400', async () => {
    const res = await fetch(`http://127.0.0.1:${PORT}/api/auth/change-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: 'ADM001' })
    });
    const json = await res.json();
    if (res.status !== 400 || json.success !== false) {
      throw new Error(`Expected HTTP 400, got status ${res.status}`);
    }
  });

  await test('POST /api/auth/change-password rejects incorrect current password with HTTP 401', async () => {
    const res = await fetch(`http://127.0.0.1:${PORT}/api/auth/change-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: 'ADM001',
        currentPassword: 'WrongPassword999',
        newPassword: 'BrandNewPassword@123'
      })
    });
    const json = await res.json();
    if (res.status !== 401 || json.success !== false) {
      throw new Error(`Expected HTTP 401 for wrong current password, got status ${res.status}`);
    }
  });

  await test('POST /api/admin/users/reset-password rejects unauthorized caller with HTTP 403', async () => {
    const res = await fetch(`http://127.0.0.1:${PORT}/api/admin/users/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        adminId: 'MID1001', // Normal merchant trying to reset password
        adminPassword: 'Secret@123',
        targetUserId: 'ADM001',
        newPassword: 'NewPassword@123'
      })
    });
    const json = await res.json();
    if (res.status !== 403 || json.success !== false) {
      throw new Error(`Expected HTTP 403 for non-admin user, got status ${res.status}`);
    }
  });

  await test('POST /api/auth/forgot-password-request registers ticket safely without plaintext reset', async () => {
    const res = await fetch(`http://127.0.0.1:${PORT}/api/auth/forgot-password-request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'MID1001' })
    });
    const json = await res.json();
    if (res.status !== 200 || json.success !== true || !json.ticketId) {
      throw new Error(`Expected ticket creation with ticketId, got: ${JSON.stringify(json)}`);
    }
  });

  // -------------------------------------------------------------
  // GROUP 3: DEDICATED VALIDATED BUSINESS ENDPOINTS
  // -------------------------------------------------------------
  console.log('\n▶ GROUP 3: VERIFYING DEDICATED VALIDATED BUSINESS ENDPOINTS');

  await test('GET /api/public/stats returns structured public stats schema', async () => {
    const res = await fetch(`http://127.0.0.1:${PORT}/api/public/stats`);
    const json = await res.json();
    if (res.status !== 200 || json.success !== true || typeof json.stats !== 'object') {
      throw new Error(`Expected 200 OK with stats object, got status ${res.status}`);
    }
    if (json.stats.totalMerchants !== 1) {
      throw new Error(`Expected totalMerchants = 1, got ${json.stats.totalMerchants}`);
    }
  });

  await test('GET /api/users/:id returns sanitized profile without exposing password', async () => {
    const res = await fetch(`http://127.0.0.1:${PORT}/api/users/MID1001`);
    const json = await res.json();
    if (res.status !== 200 || json.success !== true || !json.user) {
      throw new Error(`Expected 200 OK with user object, got status ${res.status}`);
    }
    if (json.user.password) {
      throw new Error('SECURITY VULNERABILITY: Password exposed in user profile response!');
    }
  });

  await test('POST /api/pos/assign rejects request with missing merchantId with HTTP 400', async () => {
    const res = await fetch(`http://127.0.0.1:${PORT}/api/pos/assign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminId: 'ADM001' })
    });
    const json = await res.json();
    if (res.status !== 400 || json.success !== false) {
      throw new Error(`Expected HTTP 400 for missing merchantId, got status ${res.status}`);
    }
  });

  await test('POST /api/admin/verify-transaction rejects missing txnId with HTTP 400', async () => {
    const res = await fetch(`http://127.0.0.1:${PORT}/api/admin/verify-transaction`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'APPROVE' })
    });
    const json = await res.json();
    if (res.status !== 400 || json.success !== false) {
      throw new Error(`Expected HTTP 400 for missing txnId, got status ${res.status}`);
    }
  });

  console.log('\n===============================================================');
  console.log(`📊 TEST RESULTS: ${passed} PASSED | ${failed} FAILED`);
  console.log('===============================================================');

  server.close(() => {
    process.exit(failed > 0 ? 1 : 0);
  });
});
