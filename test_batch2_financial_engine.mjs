/**
 * RONAV TECHNOLOGIES — BATCH 2 FINANCIAL ENGINE AUTOMATED TEST SUITE
 * 
 * Verifies:
 * 1. Authoritative Backend Commission Calculations & Dynamic Hierarchy Margin Spreads
 * 2. 100.00% Exact Mathematical Reconciliation (Gross == Net + Sum(Uplines) + AdminProfit)
 * 3. Rate Validation & No Silent Fallback (HTTP 400 on missing/zero rate)
 * 4. UTR/Reference Deduplication (HTTP 409 on non-rejected duplicate ref)
 * 5. Instant Merchant Wallet Credit ($Net = Gross - Fee$)
 * 6. Idempotent Admin Approval (No duplicate balance credits)
 * 7. Sale Rejection Clawback & Auditable Unrecovered Deficit Tracking
 * 8. Automatic Deficit Clearance on Subsequent Sales
 * 9. ₹500 Regular Withdrawal Reserve Hold Enforcement
 * 10. ₹0 Commission Withdrawal Reserve & Admin Master Payout Toggle Lockout
 * 11. Row-Level Concurrency & Race Condition Protection (ACID withTransaction)
 */

import http from 'node:http';
import { handleApiRequest } from './server/api.js';
import { setMockQueryHandler, pgQuery, withTransaction } from './server/pg_db.js';

// In-Memory Test Database State
const mockDb = {
  users: [],
  wallets: [],
  merchant_pos: [],
  transactions: [],
  withdrawals: [],
  beneficiaries: [],
  inquiries: []
};

// Configure Mock Query Engine
setMockQueryHandler(async (sql, params = []) => {
  const cleanSql = sql.replace(/\s+/g, ' ').trim();

  // 1. DELETE operations
  if (cleanSql.startsWith('DELETE FROM')) {
    const table = cleanSql.split(' ')[2].toLowerCase();
    if (mockDb[table]) {
      mockDb[table] = [];
    }
    return [{ success: true }];
  }

  // 2. USERS
  if (cleanSql === 'SELECT * FROM users') {
    return [...mockDb.users];
  }
  if (cleanSql.startsWith('SELECT * FROM users WHERE UPPER(id) = UPPER($1)') || cleanSql.startsWith('SELECT * FROM users WHERE id = $1')) {
    const u = mockDb.users.find(x => x.id.toUpperCase() === (params[0] || '').toString().toUpperCase());
    return u ? [{ ...u }] : [];
  }
  if (cleanSql.startsWith('INSERT INTO users')) {
    const match = sql.match(/INSERT INTO users \((.*?)\) VALUES \((.*?)\)/i);
    if (match) {
      const cols = match[1].split(',').map(c => c.trim());
      const row = {};
      cols.forEach((col, idx) => {
        row[col] = params[idx];
      });
      mockDb.users.push(row);
      return [{ ...row }];
    }
    return [];
  }

  // 3. WALLETS
  if (cleanSql.startsWith('SELECT * FROM wallets WHERE user_id = $1')) {
    const w = mockDb.wallets.find(x => x.user_id.toUpperCase() === (params[0] || '').toString().toUpperCase());
    return w ? [{ ...w }] : [];
  }
  if (cleanSql.startsWith('SELECT * FROM wallets WHERE user_id = \'ADM001\'')) {
    const w = mockDb.wallets.find(x => x.user_id === 'ADM001');
    return w ? [{ ...w }] : [];
  }
  if (cleanSql.startsWith('INSERT INTO wallets')) {
    const match = sql.match(/INSERT INTO wallets \((.*?)\) VALUES \((.*?)\)/i);
    if (match) {
      const cols = match[1].split(',').map(c => c.trim());
      const row = { available_balance: 0, total_sales: 0, received_sales: 0, pending_balance: 0, withdrawn_amount: 0, unrecovered_deficit: 0 };
      cols.forEach((col, idx) => {
        row[col] = params[idx];
      });
      mockDb.wallets.push(row);
      return [{ ...row }];
    }
    return [];
  }
  if (cleanSql.includes('UPDATE wallets') && cleanSql.includes('unrecovered_deficit = $2') && cleanSql.includes('received_sales = GREATEST')) {
    // Merchant Reversal
    const w = mockDb.wallets.find(x => x.user_id === params[3]);
    if (w) {
      w.available_balance = parseFloat(params[0]);
      w.unrecovered_deficit = parseFloat(params[1]);
      w.received_sales = Math.max(0.0, parseFloat(w.received_sales || 0) - parseFloat(params[2]));
      w.total_sales = Math.max(0.0, parseFloat(w.total_sales || 0) - parseFloat(params[2]));
      return [{ ...w }];
    }
    return [];
  }
  if (cleanSql.includes('UPDATE wallets') && cleanSql.includes('unrecovered_deficit = $2') && cleanSql.includes('total_sales = GREATEST')) {
    // Upline Reversal
    const w = mockDb.wallets.find(x => x.user_id === params[3]);
    if (w) {
      w.available_balance = parseFloat(params[0]);
      w.unrecovered_deficit = parseFloat(params[1]);
      w.total_sales = Math.max(0.0, parseFloat(w.total_sales || 0) - parseFloat(params[2]));
      return [{ ...w }];
    }
    return [];
  }
  if (cleanSql.includes('UPDATE wallets') && cleanSql.includes('unrecovered_deficit = $2') && cleanSql.includes('received_sales = received_sales + $3')) {
    // Merchant Sale credit
    const w = mockDb.wallets.find(x => x.user_id === params[3]);
    if (w) {
      w.available_balance = parseFloat(params[0]);
      w.unrecovered_deficit = parseFloat(params[1]);
      w.received_sales = parseFloat((parseFloat(w.received_sales || 0) + parseFloat(params[2])).toFixed(2));
      w.total_sales = parseFloat((parseFloat(w.total_sales || 0) + parseFloat(params[2])).toFixed(2));
      return [{ ...w }];
    }
    return [];
  }
  if (cleanSql.includes('UPDATE wallets') && cleanSql.includes('unrecovered_deficit = $2') && cleanSql.includes('total_sales = total_sales + $3')) {
    // Upline Commission credit
    const w = mockDb.wallets.find(x => x.user_id === params[3]);
    if (w) {
      w.available_balance = parseFloat(params[0]);
      w.unrecovered_deficit = parseFloat(params[1]);
      w.total_sales = parseFloat((parseFloat(w.total_sales || 0) + parseFloat(params[2])).toFixed(2));
      return [{ ...w }];
    }
    return [];
  }
  if (cleanSql.includes('UPDATE wallets') && cleanSql.includes('WHERE user_id = \'ADM001\'')) {
    // Admin Net margin credit or reversal
    const w = mockDb.wallets.find(x => x.user_id === 'ADM001');
    if (w) {
      if (cleanSql.includes('available_balance + $1')) {
        w.available_balance = parseFloat((parseFloat(w.available_balance || 0) + parseFloat(params[0])).toFixed(2));
        w.total_sales = parseFloat((parseFloat(w.total_sales || 0) + parseFloat(params[1])).toFixed(2));
      } else if (cleanSql.includes('GREATEST(0.0, available_balance - $1)')) {
        w.available_balance = Math.max(0.0, parseFloat((parseFloat(w.available_balance || 0) - parseFloat(params[0])).toFixed(2)));
        w.total_sales = Math.max(0.0, parseFloat((parseFloat(w.total_sales || 0) - parseFloat(params[1])).toFixed(2)));
      }
      return [{ ...w }];
    }
    return [];
  }
  if (cleanSql.includes('UPDATE wallets') && cleanSql.includes('pending_balance = pending_balance + $1')) {
    // Withdrawal Request
    const w = mockDb.wallets.find(x => x.user_id === params[1]);
    const numAmt = parseFloat(params[0]);
    const reserve = parseFloat(params[2]);
    if (w && (parseFloat(w.available_balance) >= numAmt + reserve)) {
      w.available_balance = parseFloat((parseFloat(w.available_balance) - numAmt).toFixed(2));
      w.pending_balance = parseFloat((parseFloat(w.pending_balance || 0) + numAmt).toFixed(2));
      return [{ ...w }];
    }
    return [];
  }
  if (cleanSql.includes('UPDATE wallets') && cleanSql.includes('withdrawn_amount = withdrawn_amount + $1')) {
    // Withdrawal Approve
    const w = mockDb.wallets.find(x => x.user_id === params[1]);
    if (w) {
      const amt = parseFloat(params[0]);
      w.pending_balance = Math.max(0.0, parseFloat((parseFloat(w.pending_balance || 0) - amt).toFixed(2)));
      w.withdrawn_amount = parseFloat((parseFloat(w.withdrawn_amount || 0) + amt).toFixed(2));
      return [{ ...w }];
    }
    return [];
  }
  if (cleanSql.includes('UPDATE wallets') && cleanSql.includes('pending_balance = GREATEST') && cleanSql.includes('available_balance = available_balance + $1')) {
    // Withdrawal Reject
    const w = mockDb.wallets.find(x => x.user_id === params[1]);
    if (w) {
      const amt = parseFloat(params[0]);
      w.pending_balance = Math.max(0.0, parseFloat((parseFloat(w.pending_balance || 0) - amt).toFixed(2)));
      w.available_balance = parseFloat((parseFloat(w.available_balance || 0) + amt).toFixed(2));
      return [{ ...w }];
    }
    return [];
  }
  if (cleanSql.startsWith('UPDATE wallets SET available_balance = $1 WHERE user_id = $2') || cleanSql.startsWith('UPDATE wallets SET available_balance = 100.00 WHERE user_id = \'SD101\'')) {
    const w = mockDb.wallets.find(x => x.user_id === (params[1] || 'SD101'));
    if (w) {
      w.available_balance = parseFloat(params[0] || 100.00);
      return [{ ...w }];
    }
    return [];
  }

  // 4. MERCHANT POS
  if (cleanSql === 'SELECT * FROM merchant_pos') {
    return [...mockDb.merchant_pos];
  }
  if (cleanSql.startsWith('SELECT * FROM merchant_pos WHERE UPPER(merchant_id) = UPPER($1)') || cleanSql.startsWith('SELECT * FROM merchant_pos WHERE merchant_id = $1')) {
    const p = mockDb.merchant_pos.find(x => x.merchant_id.toUpperCase() === (params[0] || '').toString().toUpperCase());
    return p ? [{ ...p }] : [];
  }
  if (cleanSql.startsWith('INSERT INTO merchant_pos')) {
    const match = cleanSql.match(/INSERT INTO merchant_pos \((.*?)\) VALUES/i);
    if (match) {
      const cols = match[1].split(',').map(c => c.trim());
      const row = {};
      cols.forEach((col, idx) => {
        row[col] = params[idx];
      });
      mockDb.merchant_pos.push(row);
      return [{ ...row }];
    }
    return [];
  }

  // 5. TRANSACTIONS
  if (cleanSql.includes('SELECT id, amount, status FROM transactions WHERE UPPER(ref_number) = UPPER($1) AND status != \'REJECTED\'')) {
    const ref = (params[0] || '').toString().toUpperCase();
    const matches = mockDb.transactions.filter(t => (t.ref_number || '').toUpperCase() === ref && t.status !== 'REJECTED');
    return matches.map(t => ({ id: t.id, amount: t.amount, status: t.status }));
  }
  if (cleanSql.startsWith('SELECT * FROM transactions WHERE id = $1')) {
    const t = mockDb.transactions.find(x => x.id === params[0]);
    return t ? [{ ...t }] : [];
  }
  if (cleanSql.startsWith('INSERT INTO transactions')) {
    const match = cleanSql.match(/INSERT INTO transactions \((.*?)\) VALUES/i);
    if (match) {
      const cols = match[1].split(',').map(c => c.trim());
      const row = {};
      cols.forEach((col, idx) => {
        row[col] = params[idx];
      });
      mockDb.transactions.push(row);
      return [{ ...row }];
    }
    return [];
  }
  if (cleanSql.startsWith('UPDATE transactions SET status = $1, admin_remark = $2, verified_at = CURRENT_TIMESTAMP WHERE id = $3') || cleanSql.startsWith('UPDATE transactions SET admin_remark = $1, verified_at = CURRENT_TIMESTAMP WHERE id = $2')) {
    const isApproveOnly = cleanSql.startsWith('UPDATE transactions SET admin_remark = $1');
    const id = isApproveOnly ? params[1] : params[2];
    const t = mockDb.transactions.find(x => x.id === id);
    if (t) {
      if (!isApproveOnly) t.status = params[0];
      t.admin_remark = isApproveOnly ? params[0] : params[1];
      t.verified_at = new Date().toISOString();
      return [{ ...t }];
    }
    return [];
  }
  if (cleanSql.includes('UPDATE transactions SET status = \'REJECTED\'')) {
    const id = params[1];
    const t = mockDb.transactions.find(x => x.id === id);
    if (t) {
      t.status = 'REJECTED';
      t.admin_remark = params[0];
      t.verified_at = new Date().toISOString();
      return [{ ...t }];
    }
    return [];
  }

  // 6. WITHDRAWALS
  if (cleanSql.startsWith('SELECT * FROM withdrawals WHERE id = $1')) {
    const wth = mockDb.withdrawals.find(x => x.id === params[0]);
    return wth ? [{ ...wth }] : [];
  }
  if (cleanSql.startsWith('INSERT INTO withdrawals')) {
    const match = cleanSql.match(/INSERT INTO withdrawals \((.*?)\) VALUES/i);
    if (match) {
      const cols = match[1].split(',').map(c => c.trim());
      const row = {};
      cols.forEach((col, idx) => {
        row[col] = params[idx];
      });
      row.status = row.status || 'PENDING';
      mockDb.withdrawals.push(row);
      return [{ ...row }];
    }
    return [];
  }
  if (cleanSql.includes('UPDATE withdrawals') && cleanSql.includes('status = \'APPROVED\'')) {
    const wth = mockDb.withdrawals.find(x => x.id === params[1]);
    if (wth) {
      wth.status = 'APPROVED';
      wth.admin_remark = params[0];
      wth.verified_at = new Date().toISOString();
      return [{ ...wth }];
    }
    return [];
  }
  if (cleanSql.includes('UPDATE withdrawals') && cleanSql.includes('status = \'REJECTED\'')) {
    const wth = mockDb.withdrawals.find(x => x.id === params[1]);
    if (wth) {
      wth.status = 'REJECTED';
      wth.admin_remark = params[0];
      wth.verified_at = new Date().toISOString();
      return [{ ...wth }];
    }
    return [];
  }

  // 7. INQUIRIES
  if (cleanSql.startsWith('SELECT * FROM inquiries WHERE id = \'SYS-COMMISSION-PAYOUTS\'') || cleanSql.startsWith('SELECT * FROM inquiries WHERE id = $1')) {
    const id = params[0] || 'SYS-COMMISSION-PAYOUTS';
    const inq = mockDb.inquiries.find(x => x.id === id);
    return inq ? [{ ...inq }] : [];
  }
  if (cleanSql.startsWith('INSERT INTO inquiries')) {
    const match = sql.match(/INSERT INTO inquiries \((.*?)\) VALUES \((.*?)\)/i);
    if (match) {
      const cols = match[1].split(',').map(c => c.trim());
      const row = {};
      cols.forEach((col, idx) => {
        row[col] = params[idx];
      });
      mockDb.inquiries.push(row);
      return [{ ...row }];
    }
    return [];
  }

  return [];
});

const PORT = 3098;
const server = http.createServer(async (req, res) => {
  try {
    const handled = await handleApiRequest(req, res);
    if (!handled && !res.headersSent) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, message: 'Not Found' }));
    }
  } catch (e) {
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, message: e.message }));
    }
  }
});

function apiRequest(path, options = {}) {
  return new Promise((resolve, reject) => {
    const reqOptions = {
      hostname: 'localhost',
      port: PORT,
      path: path,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      }
    };

    const req = http.request(reqOptions, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ status: res.statusCode, body: json });
        } catch (e) {
          resolve({ status: res.statusCode, text: data });
        }
      });
    });

    req.on('error', reject);

    if (options.body) {
      req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    }
    req.end();
  });
}

// Helpers for test setup
async function setupTestHierarchy() {
  mockDb.users = [];
  mockDb.wallets = [];
  mockDb.merchant_pos = [];
  mockDb.transactions = [];
  mockDb.withdrawals = [];
  mockDb.inquiries = [];

  // 1. Admin
  mockDb.users.push({ id: 'ADM001', name: 'Super Admin', mobile: '9966203038', role: 'ADMIN', creator_id: null, password: 'Ronav@123' });
  mockDb.wallets.push({ user_id: 'ADM001', available_balance: 0.0, total_sales: 0.0, received_sales: 0.0, pending_balance: 0.0, withdrawn_amount: 0.0, unrecovered_deficit: 0.0 });

  // 2. Super Distributor: Buy Rate 1.20%
  mockDb.users.push({ id: 'SD101', name: 'Super Dist Alpha', mobile: '9966201001', role: 'SUPER_DISTRIBUTOR', creator_id: 'ADM001', commission_rate_t1: 1.20, commission_rate_instant: 1.40 });
  mockDb.wallets.push({ user_id: 'SD101', available_balance: 0.0, total_sales: 0.0, received_sales: 0.0, pending_balance: 0.0, withdrawn_amount: 0.0, unrecovered_deficit: 0.0 });

  // 3. District Distributor: Buy Rate 1.40%
  mockDb.users.push({ id: 'DD101', name: 'District Dist Bravo', mobile: '9966201002', role: 'DISTRICT_DISTRIBUTOR', creator_id: 'SD101', commission_rate_t1: 1.40, commission_rate_instant: 1.60 });
  mockDb.wallets.push({ user_id: 'DD101', available_balance: 0.0, total_sales: 0.0, received_sales: 0.0, pending_balance: 0.0, withdrawn_amount: 0.0, unrecovered_deficit: 0.0 });

  // 4. Area Distributor: Buy Rate 1.60%
  mockDb.users.push({ id: 'DIST101', name: 'Area Dist Charlie', mobile: '9966201003', role: 'DISTRIBUTOR', creator_id: 'DD101', commission_rate_t1: 1.60, commission_rate_instant: 1.80 });
  mockDb.wallets.push({ user_id: 'DIST101', available_balance: 0.0, total_sales: 0.0, received_sales: 0.0, pending_balance: 0.0, withdrawn_amount: 0.0, unrecovered_deficit: 0.0 });

  // 5. Merchant: Buy Rate 1.80% (T+1), 2.00% (Instant)
  mockDb.users.push({ id: 'MID101', name: 'Merchant Delta Store', mobile: '9966201004', role: 'MERCHANT', creator_id: 'DIST101', commission_rate_t1: 1.80, commission_rate_instant: 2.00 });
  mockDb.wallets.push({ user_id: 'MID101', available_balance: 0.0, total_sales: 0.0, received_sales: 0.0, pending_balance: 0.0, withdrawn_amount: 0.0, unrecovered_deficit: 0.0 });

  // Attach POS terminal to Merchant
  mockDb.merchant_pos.push({
    merchant_id: 'MID101',
    terminal_id: 'PL-MID101',
    provider: 'Pine Labs',
    commission_rate: 1.80,
    commission_rate_t1: 1.80,
    commission_rate_instant: 2.00,
    vendor_entity: 'Rose Navaneetham Enterprises'
  });
}

async function runTests() {
  console.log('===============================================================');
  console.log('🚀 STARTING RONAV BATCH 2 FINANCIAL ENGINE VERIFICATION SUITE');
  console.log('===============================================================');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✓ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${message}`);
      failed++;
    }
  }

  await new Promise(resolve => server.listen(PORT, resolve));

  try {
    await setupTestHierarchy();

    // -------------------------------------------------------------
    // TEST 1: POS Sale Recording with Dynamic 5-Tier Margin Calculation
    // Amount = ₹10,000 | Merchant Rate = 1.80% (Fee = ₹180, Net = ₹9,820)
    // DIST101 (Rate 1.60% -> Spread 0.20% = ₹20)
    // DD101   (Rate 1.40% -> Spread 0.20% = ₹20)
    // SD101   (Rate 1.20% -> Spread 0.20% = ₹20)
    // Admin Net Margin = ₹180 - (₹20 + ₹20 + ₹20) = ₹120
    // -------------------------------------------------------------
    console.log('\n--- TEST 1: 5-Tier Hierarchy Margin Calculation & 100% Reconciliation ---');
    const sale1Res = await apiRequest('/api/transactions/record', {
      method: 'POST',
      body: {
        merchant_id: 'MID101',
        amount: 10000,
        ref_number: 'UTR100001',
        settlement_type: 'T1',
        type: 'POS_SWIPE',
        provider: 'Pine Labs'
      }
    });

    assert(sale1Res.status === 201, `Sale recorded successfully (Status: ${sale1Res.status})`);
    assert(sale1Res.body.success === true, 'Response marked success');

    const mWallet1 = mockDb.wallets.find(w => w.user_id === 'MID101');
    const distWallet1 = mockDb.wallets.find(w => w.user_id === 'DIST101');
    const ddWallet1 = mockDb.wallets.find(w => w.user_id === 'DD101');
    const sdWallet1 = mockDb.wallets.find(w => w.user_id === 'SD101');
    const adminWallet1 = mockDb.wallets.find(w => w.user_id === 'ADM001');

    const netCredit = parseFloat(mWallet1.available_balance);
    const distComm = parseFloat(distWallet1.available_balance);
    const ddComm = parseFloat(ddWallet1.available_balance);
    const sdComm = parseFloat(sdWallet1.available_balance);
    const adminProfit = parseFloat(adminWallet1.available_balance);

    assert(netCredit === 9820.00, `Merchant received exact Net Settlement: ₹${netCredit} (Expected: 9820.00)`);
    assert(distComm === 20.00, `Area Distributor received exact Commission: ₹${distComm} (Expected: 20.00)`);
    assert(ddComm === 20.00, `District Distributor received exact Commission: ₹${ddComm} (Expected: 20.00)`);
    assert(sdComm === 20.00, `Super Distributor received exact Commission: ₹${sdComm} (Expected: 20.00)`);
    assert(adminProfit === 120.00, `Admin received exact Platform Residual Profit: ₹${adminProfit} (Expected: 120.00)`);

    const totalReconciled = parseFloat((netCredit + distComm + ddComm + sdComm + adminProfit).toFixed(2));
    assert(totalReconciled === 10000.00, `Exact 100.00% Financial Reconciliation: ₹${totalReconciled} == ₹10,000.00`);

    // -------------------------------------------------------------
    // TEST 2: Instant Settlement Calculation
    // Amount = ₹5,000 | Merchant Rate = 2.00% (Fee = ₹100, Net = ₹4,900)
    // DIST101 (Rate 1.80% -> Spread 0.20% = ₹10)
    // DD101   (Rate 1.60% -> Spread 0.20% = ₹10)
    // SD101   (Rate 1.40% -> Spread 0.20% = ₹10)
    // Admin Net Margin = ₹100 - (₹10 + ₹10 + ₹10) = ₹70
    // -------------------------------------------------------------
    console.log('\n--- TEST 2: Instant Settlement Mode Commission Split ---');
    const sale2Res = await apiRequest('/api/transactions/record', {
      method: 'POST',
      body: {
        merchant_id: 'MID101',
        amount: 5000,
        ref_number: 'UTR100002',
        settlement_type: 'INSTANT',
        type: 'POS_SWIPE',
        provider: 'Pine Labs'
      }
    });

    assert(sale2Res.status === 201, `Instant Sale recorded (Status: ${sale2Res.status})`);
    const mWallet2 = mockDb.wallets.find(w => w.user_id === 'MID101');
    assert(parseFloat(mWallet2.available_balance) === 9820 + 4900, `Merchant balance updated to ₹${mWallet2.available_balance} (Expected: 14720.00)`);

    // -------------------------------------------------------------
    // TEST 3: Rate Validation & No Silent Fallbacks (Reject Missing Rate)
    // -------------------------------------------------------------
    console.log('\n--- TEST 3: Rate Validation & Strict Non-Zero Requirement ---');
    mockDb.users.push({
      id: 'MID_NORATE',
      name: 'Merchant Without Rate',
      mobile: '9966209999',
      role: 'MERCHANT',
      creator_id: 'DIST101'
    });
    const noRateRes = await apiRequest('/api/transactions/record', {
      method: 'POST',
      body: {
        merchant_id: 'MID_NORATE',
        amount: 1000,
        ref_number: 'UTR_NORATE',
        settlement_type: 'T1'
      }
    });

    assert(noRateRes.status === 400, `Transaction rejected with HTTP 400 for unconfigured rate (Status: ${noRateRes.status})`);
    assert(noRateRes.body.success === false, 'Response returned success: false');

    // -------------------------------------------------------------
    // TEST 4: Duplicate Reference / UTR Deduplication
    // -------------------------------------------------------------
    console.log('\n--- TEST 4: Unique UTR / Reference Deduplication ---');
    const dupRes = await apiRequest('/api/transactions/record', {
      method: 'POST',
      body: {
        merchant_id: 'MID101',
        amount: 1000,
        ref_number: 'UTR100001', // Already used in Test 1
        settlement_type: 'T1'
      }
    });

    assert(dupRes.status === 409, `Duplicate UTR rejected with HTTP 409 (Status: ${dupRes.status})`);
    assert(dupRes.body.success === false, 'Duplicate reference blocked');

    // -------------------------------------------------------------
    // TEST 5: Idempotent Admin Approval
    // -------------------------------------------------------------
    console.log('\n--- TEST 5: Idempotent Admin Verification ---');
    const txn1Id = sale1Res.body.transaction.id;
    const approveRes = await apiRequest('/api/admin/verify-transaction', {
      method: 'POST',
      body: {
        txn_id: txn1Id,
        action: 'APPROVE',
        remark: 'Audited against settlement slip'
      }
    });

    assert(approveRes.status === 200, `Approval succeeded (Status: ${approveRes.status})`);
    const mWalletAfterApprove = mockDb.wallets.find(w => w.user_id === 'MID101');
    assert(parseFloat(mWalletAfterApprove.available_balance) === 14720.00, `Merchant balance unchanged after approval (No double credit): ₹${mWalletAfterApprove.available_balance}`);

    // -------------------------------------------------------------
    // TEST 6: Regular Withdrawal with ₹500 Reserve Hold Enforcement
    // Available Balance = ₹14,720.00 | Reserve Hold = ₹500.00 -> Max Withdrawable = ₹14,220.00
    // Attempting ₹14,500.00 must fail.
    // -------------------------------------------------------------
    console.log('\n--- TEST 6: ₹500 Regular Withdrawal Reserve Hold Enforcement ---');
    const overWithdrawRes = await apiRequest('/api/withdrawals/request', {
      method: 'POST',
      body: {
        merchant_id: 'MID101',
        amount: 14500.00,
        bank_name: 'State Bank of India',
        account_number: '123456789012',
        ifsc: 'SBIN0001234',
        payout_purpose: 'REGULAR'
      }
    });

    assert(overWithdrawRes.status === 400, `Over-reserve withdrawal rejected (Status: ${overWithdrawRes.status})`);

    // Withdraw valid ₹14,000.00 (Leaves ₹720.00 in wallet, exceeding ₹500 reserve)
    const validWithdrawRes = await apiRequest('/api/withdrawals/request', {
      method: 'POST',
      body: {
        merchant_id: 'MID101',
        amount: 14000.00,
        bank_name: 'State Bank of India',
        account_number: '123456789012',
        ifsc: 'SBIN0001234',
        payout_purpose: 'REGULAR'
      }
    });

    assert(validWithdrawRes.status === 201, `Valid withdrawal accepted (Status: ${validWithdrawRes.status})`);
    const mWalletAfterWithdraw = mockDb.wallets.find(w => w.user_id === 'MID101');
    assert(parseFloat(mWalletAfterWithdraw.available_balance) === 720.00, `Available balance deducted: ₹${mWalletAfterWithdraw.available_balance} (Expected: 720.00)`);
    assert(parseFloat(mWalletAfterWithdraw.pending_balance) === 14000.00, `Pending balance held: ₹${mWalletAfterWithdraw.pending_balance} (Expected: 14000.00)`);

    // Admin approves withdrawal payout
    const wthId = validWithdrawRes.body.withdrawal_id;
    const approveWthRes = await apiRequest('/api/admin/verify-withdrawal', {
      method: 'POST',
      body: {
        withdrawal_id: wthId,
        action: 'APPROVE',
        utr: 'BANK_DISB_999'
      }
    });

    assert(approveWthRes.status === 200, `Withdrawal approved by Admin (Status: ${approveWthRes.status})`);
    const mWalletSettled = mockDb.wallets.find(w => w.user_id === 'MID101');
    assert(parseFloat(mWalletSettled.pending_balance) === 0.00, 'Pending balance cleared to 0.00');
    assert(parseFloat(mWalletSettled.withdrawn_amount) === 14000.00, 'Withdrawn amount updated to 14000.00');

    // -------------------------------------------------------------
    // TEST 7: Auditable Reversal & Unrecovered Deficit Tracking
    // Available Balance is currently ₹720.00.
    // We now REJECT the original ₹10,000 transaction (Net Credited = ₹9,820.00).
    // Available balance decreases from ₹720.00 to ₹0.00.
    // Unrecovered Deficit is recorded as ₹9,820.00 - ₹720.00 = ₹9,100.00!
    // -------------------------------------------------------------
    console.log('\n--- TEST 7: Sale Rejection, Clawback & Deficit Tracking ---');
    const rejectSaleRes = await apiRequest('/api/admin/verify-transaction', {
      method: 'POST',
      body: {
        txn_id: txn1Id,
        action: 'REJECT',
        remark: 'POS dispute / chargeback by bank'
      }
    });

    assert(rejectSaleRes.status === 200, `Transaction reversal executed (Status: ${rejectSaleRes.status})`);
    const mWalletAfterReject = mockDb.wallets.find(w => w.user_id === 'MID101');
    assert(parseFloat(mWalletAfterReject.available_balance) === 0.00, `Available balance capped at 0.00: ₹${mWalletAfterReject.available_balance}`);
    assert(parseFloat(mWalletAfterReject.unrecovered_deficit) === 9100.00, `Exact Deficit tracked: ₹${mWalletAfterReject.unrecovered_deficit} (Expected: 9100.00)`);

    // Upline and Admin reversals check
    const distWalletAfterReject = mockDb.wallets.find(w => w.user_id === 'DIST101');
    const adminWalletAfterReject = mockDb.wallets.find(w => w.user_id === 'ADM001');
    assert(parseFloat(distWalletAfterReject.available_balance) === 10.00, `Distributor commission rolled back (₹30 - ₹20 = ₹10): ₹${distWalletAfterReject.available_balance}`);
    assert(parseFloat(adminWalletAfterReject.available_balance) === 70.00, `Admin margin rolled back (₹190 - ₹120 = ₹70): ₹${adminWalletAfterReject.available_balance}`);

    // Reversals cannot be reversed again
    const doubleRejectRes = await apiRequest('/api/admin/verify-transaction', {
      method: 'POST',
      body: {
        txn_id: txn1Id,
        action: 'REJECT'
      }
    });
    assert(doubleRejectRes.status === 400, `Double rejection prevented with HTTP 400 (Status: ${doubleRejectRes.status})`);

    // Withdrawals must be blocked while deficit exists
    const blockedWithdrawRes = await apiRequest('/api/withdrawals/request', {
      method: 'POST',
      body: {
        merchant_id: 'MID101',
        amount: 100.00,
        bank_name: 'State Bank of India',
        account_number: '123456789012',
        ifsc: 'SBIN0001234'
      }
    });
    assert(blockedWithdrawRes.status === 400, `Withdrawal blocked due to outstanding deficit (Status: ${blockedWithdrawRes.status})`);

    // -------------------------------------------------------------
    // TEST 8: Automatic Deficit Clearance on Subsequent Sales
    // Merchant records a new sale of ₹10,000 (Net Credit = ₹9,820.00).
    // It should clear the ₹9,100.00 deficit, leaving ₹720.00 available balance and ₹0.00 deficit!
    // -------------------------------------------------------------
    console.log('\n--- TEST 8: Automatic Deficit Clearance on Future Sales ---');
    const recoverySaleRes = await apiRequest('/api/transactions/record', {
      method: 'POST',
      body: {
        merchant_id: 'MID101',
        amount: 10000,
        ref_number: 'UTR100003',
        settlement_type: 'T1'
      }
    });

    assert(recoverySaleRes.status === 201, `Recovery sale recorded (Status: ${recoverySaleRes.status})`);
    const mWalletRecovered = mockDb.wallets.find(w => w.user_id === 'MID101');
    assert(parseFloat(mWalletRecovered.unrecovered_deficit) === 0.00, `Deficit fully cleared: ₹${mWalletRecovered.unrecovered_deficit} (Expected: 0.00)`);
    assert(parseFloat(mWalletRecovered.available_balance) === 720.00, `Available balance credited with remainder: ₹${mWalletRecovered.available_balance} (Expected: 720.00)`);

    // -------------------------------------------------------------
    // TEST 9: Commission Withdrawal Reserve (₹0) & Admin Master Toggle
    // -------------------------------------------------------------
    console.log('\n--- TEST 9: Commission Disbursal & Admin Master Toggle ---');
    // 1. When toggle is disabled (SYS-COMMISSION-PAYOUTS does not exist or is INACTIVE)
    const toggleBlockedRes = await apiRequest('/api/withdrawals/request', {
      method: 'POST',
      body: {
        merchant_id: 'SD101',
        amount: 30.00,
        bank_name: 'HDFC Bank',
        account_number: '987654321012',
        ifsc: 'HDFC0001234',
        payout_purpose: 'COMMISSION'
      }
    });

    assert(toggleBlockedRes.status === 403, `Commission withdrawal blocked when toggle is disabled (Status: ${toggleBlockedRes.status})`);

    // 2. Enable Master Commission Payout Toggle in inquiries
    mockDb.inquiries.push({
      id: 'SYS-COMMISSION-PAYOUTS',
      type: 'SYS_CONFIG',
      name: 'Commission Payout Master Toggle',
      phone: '9966203038',
      status: 'ACTIVE'
    });

    // Top up SD101 to ₹30
    const sdW = mockDb.wallets.find(w => w.user_id === 'SD101');
    sdW.available_balance = 30.00;

    // 3. Request commission withdrawal with ₹0 reserve
    const toggleActiveRes = await apiRequest('/api/withdrawals/request', {
      method: 'POST',
      body: {
        merchant_id: 'SD101',
        amount: 30.00,
        bank_name: 'HDFC Bank',
        account_number: '987654321012',
        ifsc: 'HDFC0001234',
        payout_purpose: 'COMMISSION'
      }
    });

    assert(toggleActiveRes.status === 201, `Commission withdrawal allowed with ₹0 reserve (Status: ${toggleActiveRes.status})`);
    const sdWalletAfterWth = mockDb.wallets.find(w => w.user_id === 'SD101');
    assert(parseFloat(sdWalletAfterWth.available_balance) === 0.00, `SD Available balance reduced to ₹0.00 (₹0 reserve held)`);

    // -------------------------------------------------------------
    // TEST 10: Concurrency & Double-Spend Protection
    // -------------------------------------------------------------
    console.log('\n--- TEST 10: Atomic Concurrency & Double-Spend Protection ---');
    // Top-up SD101 to ₹100
    sdW.available_balance = 100.00;

    const concurrentReqs = [
      apiRequest('/api/withdrawals/request', {
        method: 'POST',
        body: { merchant_id: 'SD101', amount: 80.00, bank_name: 'HDFC', account_number: '111', payout_purpose: 'COMMISSION' }
      }),
      apiRequest('/api/withdrawals/request', {
        method: 'POST',
        body: { merchant_id: 'SD101', amount: 80.00, bank_name: 'HDFC', account_number: '111', payout_purpose: 'COMMISSION' }
      })
    ];

    const results = await Promise.all(concurrentReqs);
    const successCount = results.filter(r => r.status === 201).length;
    const rejectedCount = results.filter(r => r.status === 400).length;

    assert(successCount === 1, `Exactly one concurrent withdrawal succeeded (${successCount})`);
    assert(rejectedCount === 1, `Second concurrent withdrawal rejected for insufficient funds (${rejectedCount})`);

    const finalSdWallet = mockDb.wallets.find(w => w.user_id === 'SD101');
    assert(parseFloat(finalSdWallet.available_balance) === 20.00, `Final balance is consistent: ₹${finalSdWallet.available_balance} (Expected: 20.00)`);

  } catch (err) {
    console.error('Test execution error:', err);
    failed++;
  } finally {
    server.close();
  }

  console.log('\n===============================================================');
  console.log(`🏁 TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('===============================================================');

  if (failed === 0) {
    console.log('🎉 ALL BATCH 2 FINANCIAL ENGINE TESTS PASSED PERFECTLY!');
    process.exit(0);
  } else {
    console.error('❌ SOME TESTS FAILED. PLEASE REVIEW.');
    process.exit(1);
  }
}

runTests();
