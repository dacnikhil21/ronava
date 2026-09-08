import { db } from './db.js';
import { syncToSupabase } from './supabase.js';

// Helper to parse JSON body from incoming Node HTTP request
export async function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(err);
      }
    });
  });
}

// Helper to send JSON response
export function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  });
  res.end(JSON.stringify(data));
}

// Master API Handler
export async function handleApiRequest(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;
  const method = req.method;

  // Handle CORS preflight
  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    });
    return res.end();
  }

  try {
    // ----------------------------------------------------
    // 1. AUTH & USER PROFILES
    // ----------------------------------------------------
    if (pathname === '/api/auth/login' && method === 'POST') {
      const { id, role, mobile } = await parseJsonBody(req);
      
      let user = null;
      if (id) {
        user = db.prepare(`SELECT * FROM users WHERE id = ? OR mobile = ?`).get(id, id);
      } else if (role) {
        user = db.prepare(`SELECT * FROM users WHERE role = ? LIMIT 1`).get(role);
      }

      if (!user) {
        return sendJson(res, 404, { success: false, message: 'User not found in system.' });
      }

      const wallet = db.prepare(`SELECT * FROM wallets WHERE user_id = ?`).get(user.id);
      const pos = db.prepare(`SELECT * FROM merchant_pos WHERE merchant_id = ?`).get(user.id);

      return sendJson(res, 200, {
        success: true,
        user,
        wallet: wallet || { available_balance: 0, total_sales: 0, received_sales: 0, pending_balance: 0, withdrawn_amount: 0 },
        pos: pos || null
      });
    }

    // List all users in hierarchy
    if (pathname === '/api/users' && method === 'GET') {
      const users = db.prepare(`
        SELECT u.*, 
               p.provider AS pos_provider, 
               p.terminal_id AS pos_terminal, 
               p.commission_rate AS pos_rate,
               c.name AS creator_name,
               w.available_balance,
               w.total_sales
        FROM users u
        LEFT JOIN merchant_pos p ON u.id = p.merchant_id
        LEFT JOIN users c ON u.creator_id = c.id
        LEFT JOIN wallets w ON u.id = w.user_id
        ORDER BY u.created_at DESC
      `).all();

      return sendJson(res, 200, { success: true, users });
    }

    // Create a new downstream user (Strict Hierarchy Enforcement)
    if (pathname === '/api/users/create' && method === 'POST') {
      const { creator_id, name, mobile, role, pos_provider, commission_rate } = await parseJsonBody(req);

      if (!creator_id || !name || !mobile || !role) {
        return sendJson(res, 400, { success: false, message: 'Missing required fields (creator_id, name, mobile, role).' });
      }

      const creator = db.prepare(`SELECT * FROM users WHERE id = ?`).get(creator_id);
      if (!creator) {
        return sendJson(res, 403, { success: false, message: 'Invalid creator ID.' });
      }

      // Hierarchy Rule 1: Merchants CANNOT create downstream users
      if (creator.role === 'MERCHANT') {
        return sendJson(res, 403, { 
          success: false, 
          message: 'Permission denied: Merchants are end-users and cannot create accounts.' 
        });
      }

      // Hierarchy Rule 2: Distributor can ONLY create Merchants
      if (creator.role === 'DISTRIBUTOR' && role !== 'MERCHANT') {
        return sendJson(res, 403, { 
          success: false, 
          message: 'Permission denied: Distributors can only create Retailers / Merchants.' 
        });
      }

      // Hierarchy Rule 3: DIST Franchise / District Distributor can create Distributor or Merchant
      if ((creator.role === 'DISTRICT_DISTRIBUTOR' || creator.role === 'DIST_FRANCHISE') && role !== 'DISTRIBUTOR' && role !== 'MERCHANT') {
        return sendJson(res, 403, { 
          success: false, 
          message: 'Permission denied: DIST Franchise can only create Distributors or Merchants.' 
        });
      }

      // Hierarchy Rule 4: Super Distributor can create DIST Franchise, Distributor, or Merchant
      if (creator.role === 'SUPER_DISTRIBUTOR' && role !== 'DISTRICT_DISTRIBUTOR' && role !== 'DIST_FRANCHISE' && role !== 'DISTRIBUTOR' && role !== 'MERCHANT') {
        return sendJson(res, 403, { 
          success: false, 
          message: 'Permission denied: Super Distributors cannot create Super Distributors or Admins.' 
        });
      }

      // Hierarchy Rule 5: Master / Admin can create SD, DD/Franchise, Distributor, or Merchant
      if ((creator.role === 'MASTER' || creator.role === 'ADMIN') && role === 'ADMIN') {
        return sendJson(res, 403, { 
          success: false, 
          message: 'Permission denied: Cannot create Admin accounts via downstream onboarding.' 
        });
      }

      // Generate Clean ID based on role
      const prefixMap = {
        'MASTER': 'MST',
        'SUPER_DISTRIBUTOR': 'SD',
        'DISTRICT_DISTRIBUTOR': 'DD',
        'DIST_FRANCHISE': 'DD',
        'DISTRIBUTOR': 'DIST',
        'MERCHANT': 'MID'
      };
      const randomNum = Math.floor(1000 + Math.random() * 9000);
      const newUserId = `${prefixMap[role] || 'USR'}${randomNum}`;

      try {
        db.prepare(`
          INSERT INTO users (id, name, mobile, role, creator_id)
          VALUES (?, ?, ?, ?, ?)
        `).run(newUserId, name, mobile, role, creator.id);

        // Initialize user wallet
        db.prepare(`
          INSERT INTO wallets (user_id, available_balance, total_sales, received_sales, pending_balance, withdrawn_amount)
          VALUES (?, 0.0, 0.0, 0.0, 0.0, 0.0)
        `).run(newUserId);

        // If Merchant, configure Swipe Machine Provider (Pine Labs vs Payswiff) with official 1.53% Retailer MDR
        if (role === 'MERCHANT') {
          const provider = pos_provider === 'Payswiff' ? 'Payswiff' : 'Pine Labs';
          const defaultRate = 1.53; // Official Retailer MDR from T+1 tables
          const rate = commission_rate ? parseFloat(commission_rate) : defaultRate;
          const terminalPrefix = provider === 'Payswiff' ? 'SWIFF-TS' : 'PL-HYD';
          const terminalId = `${terminalPrefix}-${Math.floor(1000 + Math.random() * 9000)}`;

          db.prepare(`
            INSERT INTO merchant_pos (merchant_id, provider, terminal_id, commission_rate, assigned_by)
            VALUES (?, ?, ?, ?, ?)
          `).run(newUserId, provider, terminalId, rate, creator.id);
        }

        const createdUser = db.prepare(`SELECT * FROM users WHERE id = ?`).get(newUserId);
        const createdPOS = db.prepare(`SELECT * FROM merchant_pos WHERE merchant_id = ?`).get(newUserId);
        const createdWallet = db.prepare(`SELECT * FROM wallets WHERE user_id = ?`).get(newUserId);

        // Async sync to Supabase
        syncToSupabase('users', createdUser).catch(() => {});
        if (createdPOS) syncToSupabase('merchant_pos', createdPOS).catch(() => {});
        if (createdWallet) syncToSupabase('wallets', createdWallet).catch(() => {});

        return sendJson(res, 201, {
          success: true,
          message: `Successfully created ${role} account (${newUserId}).`,
          user: createdUser,
          pos: createdPOS || null,
          credentials: {
            id: newUserId,
            name: createdUser.name,
            mobile: createdUser.mobile,
            role: createdUser.role,
            password: 'Ronav@' + newUserId.slice(-4)
          }
        });
      } catch (err) {
        if (err.message && err.message.includes('UNIQUE constraint failed: users.mobile')) {
          return sendJson(res, 400, { success: false, message: 'A user with this mobile number already exists.' });
        }
        throw err;
      }
    }

    // ----------------------------------------------------
    // 2. LIVE WALLET & METRICS
    // ----------------------------------------------------
    if (pathname.startsWith('/api/wallet/') && method === 'GET') {
      const userId = pathname.replace('/api/wallet/', '');
      const wallet = db.prepare(`SELECT * FROM wallets WHERE user_id = ?`).get(userId);
      const pos = db.prepare(`SELECT * FROM merchant_pos WHERE merchant_id = ?`).get(userId);
      
      if (!wallet) {
        return sendJson(res, 404, { success: false, message: 'Wallet not found.' });
      }

      return sendJson(res, 200, { success: true, wallet, pos });
    }

    // ----------------------------------------------------
    // 3. TRANSACTIONS & MANUAL MERCHANT RECORDING
    // ----------------------------------------------------
    // Merchant records a manual sale / collection
    if (pathname === '/api/transactions/record' && method === 'POST') {
      const { merchant_id, amount, customer_mobile, type, provider: bodyProvider, ref_number, notes } = await parseJsonBody(req);

      if (!merchant_id || !amount) {
        return sendJson(res, 400, { success: false, message: 'Merchant ID and Amount are required.' });
      }

      const numAmount = parseFloat(amount);
      if (isNaN(numAmount) || numAmount <= 0) {
        return sendJson(res, 400, { success: false, message: 'Amount must be a positive number.' });
      }

      // Check merchant & POS
      const merchant = db.prepare(`SELECT * FROM users WHERE id = ?`).get(merchant_id);
      if (!merchant) {
        return sendJson(res, 404, { success: false, message: 'Merchant not found.' });
      }

      const pos = db.prepare(`SELECT * FROM merchant_pos WHERE merchant_id = ?`).get(merchant_id);
      const provider = bodyProvider || (pos ? pos.provider : (type === 'BBPS_BILL' ? 'BBPS' : 'Pine Labs'));
      
      const txnId = `TXN-${provider === 'Payswiff' ? 'SW' : (provider === 'Pine Labs' ? 'PL' : 'GEN')}-${Date.now().toString().slice(-6)}`;

      // Insert transaction with status PENDING
      db.prepare(`
        INSERT INTO transactions (id, merchant_id, customer_mobile, amount, type, provider, ref_number, notes, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PENDING')
      `).run(
        txnId, 
        merchant_id, 
        customer_mobile || null, 
        numAmount, 
        type || 'POS_SWIPE', 
        provider, 
        ref_number || `REF-${Math.floor(100000 + Math.random() * 900000)}`, 
        notes || 'Manual counter transaction entry'
      );

      // Add to merchant's pending balance in wallet
      db.prepare(`
        UPDATE wallets 
        SET pending_balance = pending_balance + ?,
            total_sales = total_sales + ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE user_id = ?
      `).run(numAmount, numAmount, merchant_id);

      const updatedWallet = db.prepare(`SELECT * FROM wallets WHERE user_id = ?`).get(merchant_id);
      const createdTxn = db.prepare(`SELECT * FROM transactions WHERE id = ?`).get(txnId);

      // Async sync to Supabase
      syncToSupabase('transactions', createdTxn).catch(() => {});
      if (updatedWallet) syncToSupabase('wallets', updatedWallet).catch(() => {});

      return sendJson(res, 201, {
        success: true,
        message: 'Transaction recorded successfully! Awaiting Admin verification.',
        transaction: createdTxn,
        wallet: updatedWallet
      });
    }

    // Fetch transactions for a specific merchant
    if (pathname.startsWith('/api/transactions/merchant/') && method === 'GET') {
      const merchantId = pathname.replace('/api/transactions/merchant/', '');
      const transactions = db.prepare(`
        SELECT * FROM transactions 
        WHERE merchant_id = ? 
        ORDER BY created_at DESC
      `).all(merchantId);

      return sendJson(res, 200, { success: true, transactions });
    }

    // ----------------------------------------------------
    // NETWORK & DOWNSTREAM REFERRALS ENGINE
    // ----------------------------------------------------
    // Fetch all downstream partners referred by creator
    if (pathname === '/api/network/downstream' && method === 'GET') {
      const urlObj = new URL(req.url, 'http://localhost');
      const creatorId = urlObj.searchParams.get('creator_id');
      if (!creatorId) {
        return sendJson(res, 400, { success: false, message: 'creator_id parameter is required.' });
      }

      const creator = db.prepare(`SELECT * FROM users WHERE id = ?`).get(creatorId);
      const creatorRole = creator?.role || 'DISTRIBUTOR';
      // Commission margins based on creator tier:
      // Master / Admin: 0.75% margin
      // Super Distributor: 0.50% margin
      // District Distributor: 0.35% margin
      // Distributor: 0.25% margin
      const commissionRatePct = (creatorRole === 'MASTER' || creatorRole === 'ADMIN') ? 0.75 : (creatorRole === 'SUPER_DISTRIBUTOR' ? 0.50 : (creatorRole === 'DISTRICT_DISTRIBUTOR' ? 0.35 : 0.25));

      const partners = db.prepare(`
        SELECT u.*, 
               w.available_balance, 
               w.total_sales, 
               w.received_sales,
               p.provider AS pos_provider,
               p.terminal_id AS pos_terminal
        FROM users u
        LEFT JOIN wallets w ON u.id = w.user_id
        LEFT JOIN merchant_pos p ON u.id = p.merchant_id
        WHERE u.creator_id = ?
        ORDER BY u.created_at DESC
      `).all(creatorId);

      const todayStr = new Date().toISOString().slice(0, 10);
      let todayProfit = 0;

      const enrichedPartners = partners.map(p => {
        const txns = db.prepare(`
          SELECT COUNT(*) as txn_count, COALESCE(SUM(amount), 0) as total_volume
          FROM transactions
          WHERE merchant_id = ?
        `).get(p.id);

        const volume = txns?.total_volume || 0;
        const count = txns?.txn_count || 0;
        const commissionEarned = (volume * commissionRatePct) / 100;

        // Today's txns
        const todayTxns = db.prepare(`
          SELECT COALESCE(SUM(amount), 0) as today_volume
          FROM transactions
          WHERE merchant_id = ? AND date(created_at) = date(?)
        `).get(p.id, todayStr);

        const todayVol = todayTxns?.today_volume || 0;
        const partnerTodayProfit = (todayVol * commissionRatePct) / 100;
        todayProfit += partnerTodayProfit;

        return {
          ...p,
          txn_count: count,
          total_volume: volume,
          commission_earned: parseFloat(commissionEarned.toFixed(2)),
          commission_rate_pct: commissionRatePct
        };
      });

      const totalCommission = enrichedPartners.reduce((acc, p) => acc + p.commission_earned, 0);

      return sendJson(res, 200, {
        success: true,
        creator,
        commission_rate_pct: commissionRatePct,
        partners: enrichedPartners,
        total_partners: enrichedPartners.length,
        total_commission_earned: parseFloat(totalCommission.toFixed(2)),
        today_network_profit: parseFloat(todayProfit.toFixed(2))
      });
    }

    // Fetch individual partner transactions with line-by-line commission profit
    if (pathname === '/api/network/partner-transactions' && method === 'GET') {
      const urlObj = new URL(req.url, 'http://localhost');
      const creatorId = urlObj.searchParams.get('creator_id');
      const partnerId = urlObj.searchParams.get('partner_id');

      if (!partnerId) {
        return sendJson(res, 400, { success: false, message: 'partner_id is required.' });
      }

      const partner = db.prepare(`SELECT * FROM users WHERE id = ?`).get(partnerId);
      const creator = creatorId ? db.prepare(`SELECT * FROM users WHERE id = ?`).get(creatorId) : null;
      const creatorRole = creator?.role || 'DISTRIBUTOR';
      const commissionRatePct = creatorRole === 'SUPER_DISTRIBUTOR' ? 0.50 : (creatorRole === 'DISTRICT_DISTRIBUTOR' ? 0.35 : 0.25);

      const txns = db.prepare(`
        SELECT * FROM transactions
        WHERE merchant_id = ?
        ORDER BY created_at DESC
      `).all(partnerId);

      const enrichedTxns = txns.map(t => {
        const amt = parseFloat(t.amount) || 0;
        const profit = (amt * commissionRatePct) / 100;
        return {
          ...t,
          commission_profit: parseFloat(profit.toFixed(2)),
          commission_rate_pct: commissionRatePct
        };
      });

      const totalPartnerSales = enrichedTxns.reduce((acc, t) => acc + (parseFloat(t.amount) || 0), 0);
      const totalProfitEarned = enrichedTxns.reduce((acc, t) => acc + t.commission_profit, 0);

      return sendJson(res, 200, {
        success: true,
        partner,
        transactions: enrichedTxns,
        total_sales: totalPartnerSales,
        total_profit_earned: parseFloat(totalProfitEarned.toFixed(2)),
        commission_rate_pct: commissionRatePct
      });
    }

    // ----------------------------------------------------
    // BENEFICIARY BANK ACCOUNTS
    // ----------------------------------------------------
    if (pathname.startsWith('/api/beneficiaries/') && method === 'GET') {
      const merchantId = pathname.replace('/api/beneficiaries/', '');
      const beneficiaries = db.prepare(`
        SELECT * FROM beneficiaries 
        WHERE merchant_id = ? 
        ORDER BY is_primary DESC, created_at DESC
      `).all(merchantId);

      return sendJson(res, 200, { success: true, beneficiaries });
    }

    if (pathname === '/api/beneficiaries/add' && method === 'POST') {
      const { merchant_id, bank_name, account_number, ifsc, holder_name, is_primary } = await parseJsonBody(req);

      if (!merchant_id || !bank_name || !account_number) {
        return sendJson(res, 400, { success: false, message: 'Missing required bank details.' });
      }

      const benId = `BEN-${Date.now().toString().slice(-6)}`;
      db.prepare(`
        INSERT INTO beneficiaries (id, merchant_id, bank_name, account_number, ifsc, holder_name, is_primary)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(benId, merchant_id, bank_name, account_number, ifsc || 'SBIN0001234', holder_name || 'Account Holder', is_primary ? 1 : 0);

      const created = db.prepare(`SELECT * FROM beneficiaries WHERE id = ?`).get(benId);
      // Async sync to Supabase
      if (created) syncToSupabase('beneficiaries', created).catch(() => {});

      return sendJson(res, 201, { success: true, message: 'Beneficiary account added successfully!', beneficiary: created });
    }

    // ----------------------------------------------------
    // 4. ADMIN VERIFICATION & APPROVAL ENGINE
    // ----------------------------------------------------
    // Admin gets all pending transactions, withdrawals, and platform stats across the database
    if (pathname === '/api/admin/pending' && method === 'GET') {
      const pendingTransactions = db.prepare(`
        SELECT t.*, u.name as merchant_name, u.mobile as merchant_mobile, COALESCE(t.provider, p.provider, 'Pine Labs') as pos_provider, p.commission_rate as pos_rate
        FROM transactions t
        JOIN users u ON t.merchant_id = u.id
        LEFT JOIN merchant_pos p ON t.merchant_id = p.merchant_id
        WHERE t.status = 'PENDING'
        ORDER BY t.created_at DESC
      `).all();

      const pendingWithdrawals = db.prepare(`
        SELECT w.*, u.name as merchant_name, u.mobile as merchant_mobile
        FROM withdrawals w
        JOIN users u ON w.merchant_id = u.id
        WHERE w.status = 'PENDING'
        ORDER BY w.created_at DESC
      `).all();

      const allTransactions = db.prepare(`
        SELECT t.*, u.name as merchant_name, COALESCE(t.provider, p.provider, 'Pine Labs') as pos_provider
        FROM transactions t
        JOIN users u ON t.merchant_id = u.id
        LEFT JOIN merchant_pos p ON t.merchant_id = p.merchant_id
        ORDER BY t.created_at DESC
        LIMIT 100
      `).all();

      const stats = {
        totalMerchants: db.prepare(`SELECT COUNT(*) as c FROM users WHERE role = 'MERCHANT'`).get().c,
        loansCount: db.prepare(`SELECT COUNT(*) as c FROM inquiries WHERE type = 'LOAN'`).get().c,
        franchiseRequests: db.prepare(`SELECT COUNT(*) as c FROM inquiries WHERE type = 'FRANCHISE'`).get().c,
        bbpsTxns: db.prepare(`SELECT COUNT(*) as c FROM transactions WHERE type = 'BBPS_BILL'`).get().c,
        pgPosTxns: db.prepare(`SELECT COUNT(*) as c FROM transactions WHERE type = 'POS_SWIPE'`).get().c,
        atmTxns: db.prepare(`SELECT COUNT(*) as c FROM transactions WHERE type = 'QR_COLLECT'`).get().c,
        withdrawalsCount: db.prepare(`SELECT COUNT(*) as c FROM withdrawals`).get().c,
        totalVolume: db.prepare(`SELECT COALESCE(SUM(amount), 0) as s FROM transactions WHERE status = 'APPROVED'`).get().s,
        pendingVolume: db.prepare(`SELECT COALESCE(SUM(amount), 0) as s FROM transactions WHERE status = 'PENDING'`).get().s
      };

      return sendJson(res, 200, {
        success: true,
        pendingTransactions,
        pendingWithdrawals,
        allTransactions,
        stats
      });
    }

    // Admin verifies (Approve / Reject) a merchant transaction
    if (pathname === '/api/admin/verify-transaction' && method === 'POST') {
      const { txn_id, action, remark } = await parseJsonBody(req); // action: 'APPROVE' or 'REJECT'

      if (!txn_id || !action) {
        return sendJson(res, 400, { success: false, message: 'txn_id and action (APPROVE/REJECT) are required.' });
      }

      const txn = db.prepare(`SELECT * FROM transactions WHERE id = ?`).get(txn_id);
      if (!txn) {
        return sendJson(res, 404, { success: false, message: 'Transaction not found.' });
      }

      if (txn.status !== 'PENDING') {
        return sendJson(res, 400, { success: false, message: `Transaction already processed (${txn.status}).` });
      }

      const amount = txn.amount;
      const merchantId = txn.merchant_id;

      if (action === 'APPROVE') {
        // Mark Approved
        db.prepare(`
          UPDATE transactions 
          SET status = 'APPROVED', 
              admin_remark = ?, 
              verified_at = CURRENT_TIMESTAMP 
          WHERE id = ?
        `).run(remark || 'Verified and approved by Admin Command Center', txn_id);

        // Credit Merchant Wallet (Move from Pending to Available & Received)
        db.prepare(`
          UPDATE wallets 
          SET available_balance = available_balance + ?,
              received_sales = received_sales + ?,
              pending_balance = MAX(0.0, pending_balance - ?),
              updated_at = CURRENT_TIMESTAMP
          WHERE user_id = ?
        `).run(amount, amount, amount, merchantId);

      } else {
        // Mark Rejected
        db.prepare(`
          UPDATE transactions 
          SET status = 'REJECTED', 
              admin_remark = ?, 
              verified_at = CURRENT_TIMESTAMP 
          WHERE id = ?
        `).run(remark || 'Transaction rejected by Admin. Invalid reference/slip.', txn_id);

        // Deduct from Pending balance and total_sales
        db.prepare(`
          UPDATE wallets 
          SET pending_balance = MAX(0.0, pending_balance - ?),
              total_sales = MAX(0.0, total_sales - ?),
              updated_at = CURRENT_TIMESTAMP
          WHERE user_id = ?
        `).run(amount, amount, merchantId);
      }

      const updatedTxn = db.prepare(`SELECT * FROM transactions WHERE id = ?`).get(txn_id);
      const updatedWallet = db.prepare(`SELECT * FROM wallets WHERE user_id = ?`).get(merchantId);

      // Async sync to Supabase
      if (updatedTxn) syncToSupabase('transactions', updatedTxn).catch(() => {});
      if (updatedWallet) syncToSupabase('wallets', updatedWallet).catch(() => {});

      return sendJson(res, 200, {
        success: true,
        message: `Transaction ${txn_id} marked as ${action === 'APPROVE' ? 'Approved' : 'Rejected'}.`,
        transaction: updatedTxn,
        wallet: updatedWallet
      });
    }

    // ----------------------------------------------------
    // 5. WITHDRAWALS
    // ----------------------------------------------------
    // Merchant requests payout to bank
    if (pathname === '/api/withdrawals/request' && method === 'POST') {
      const { merchant_id, amount, bank_name, account_number, ifsc } = await parseJsonBody(req);

      const numAmount = parseFloat(amount);
      if (!merchant_id || !numAmount || !bank_name || !account_number) {
        return sendJson(res, 400, { success: false, message: 'Missing required withdrawal details.' });
      }

      const wallet = db.prepare(`SELECT * FROM wallets WHERE user_id = ?`).get(merchant_id);
      if (!wallet || wallet.available_balance < numAmount) {
        return sendJson(res, 400, { 
          success: false, 
          message: `Insufficient balance! Available: ₹${wallet ? wallet.available_balance.toFixed(2) : '0.00'}` 
        });
      }

      const wId = `WTH-${Date.now().toString().slice(-6)}`;

      // Deduct from available balance immediately and place in pending
      db.prepare(`
        UPDATE wallets 
        SET available_balance = available_balance - ?,
            pending_balance = pending_balance + ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE user_id = ?
      `).run(numAmount, numAmount, merchant_id);

      db.prepare(`
        INSERT INTO withdrawals (id, merchant_id, amount, bank_name, account_number, ifsc, status)
        VALUES (?, ?, ?, ?, ?, ?, 'PENDING')
      `).run(wId, merchant_id, numAmount, bank_name, account_number, ifsc || 'SBIN0001234');

      const createdWth = db.prepare(`SELECT * FROM withdrawals WHERE id = ?`).get(wId);
      const updatedWWallet = db.prepare(`SELECT * FROM wallets WHERE user_id = ?`).get(merchant_id);

      // Async sync to Supabase
      if (createdWth) syncToSupabase('withdrawals', createdWth).catch(() => {});
      if (updatedWWallet) syncToSupabase('wallets', updatedWWallet).catch(() => {});

      return sendJson(res, 201, {
        success: true,
        message: 'Withdrawal request submitted! Pending Admin payout clearance.',
        withdrawal: createdWth,
        withdrawal_id: wId
      });
    }

    // Admin verifies payout
    if (pathname === '/api/admin/verify-withdrawal' && method === 'POST') {
      const { withdrawal_id, action, remark } = await parseJsonBody(req);

      const wth = db.prepare(`SELECT * FROM withdrawals WHERE id = ?`).get(withdrawal_id);
      if (!wth) return sendJson(res, 404, { success: false, message: 'Withdrawal record not found.' });

      if (action === 'APPROVE') {
        db.prepare(`
          UPDATE withdrawals 
          SET status = 'APPROVED', admin_remark = ?, verified_at = CURRENT_TIMESTAMP 
          WHERE id = ?
        `).run(remark || 'Bank payout cleared via IMPS/NEFT', withdrawal_id);

        db.prepare(`
          UPDATE wallets 
          SET pending_balance = MAX(0.0, pending_balance - ?),
              withdrawn_amount = withdrawn_amount + ?,
              updated_at = CURRENT_TIMESTAMP
          WHERE user_id = ?
        `).run(wth.amount, wth.amount, wth.merchant_id);
      } else {
        db.prepare(`
          UPDATE withdrawals 
          SET status = 'REJECTED', admin_remark = ?, verified_at = CURRENT_TIMESTAMP 
          WHERE id = ?
        `).run(remark || 'Bank account details mismatch', withdrawal_id);

        // Revert back to available balance
        db.prepare(`
          UPDATE wallets 
          SET pending_balance = MAX(0.0, pending_balance - ?),
              available_balance = available_balance + ?,
              updated_at = CURRENT_TIMESTAMP
          WHERE user_id = ?
        `).run(wth.amount, wth.amount, wth.merchant_id);
      }

      const updatedW = db.prepare(`SELECT * FROM withdrawals WHERE id = ?`).get(withdrawal_id);
      const updatedWWallet = db.prepare(`SELECT * FROM wallets WHERE user_id = ?`).get(wth.merchant_id);

      // Async sync to Supabase
      if (updatedW) syncToSupabase('withdrawals', updatedW).catch(() => {});
      if (updatedWWallet) syncToSupabase('wallets', updatedWWallet).catch(() => {});

      return sendJson(res, 200, {
        success: true,
        message: `Withdrawal ${action === 'APPROVE' ? 'Approved' : 'Rejected'}.`,
        withdrawal: updatedW,
        wallet: updatedWWallet
      });
    }

    // Fetch withdrawals for a specific merchant
    if (pathname.startsWith('/api/withdrawals/merchant/') && method === 'GET') {
      const merchantId = pathname.replace('/api/withdrawals/merchant/', '');
      const withdrawals = db.prepare(`
        SELECT * FROM withdrawals 
        WHERE merchant_id = ? 
        ORDER BY created_at DESC
      `).all(merchantId);

      return sendJson(res, 200, { success: true, withdrawals });
    }

    // ----------------------------------------------------
    // 6. INQUIRIES & APPLICATIONS (LOANS, FRANCHISES, TICKETS)
    // ----------------------------------------------------
    if (pathname === '/api/inquiries/submit' && method === 'POST') {
      const { type, name, phone, merchant_id, amount, category, location, remarks } = await parseJsonBody(req);
      if (!name || !phone) {
        return sendJson(res, 400, { success: false, message: 'Name and phone are required.' });
      }
      const prefix = type === 'LOAN' ? 'LN' : (type === 'FRANCHISE' ? 'FR' : 'INQ');
      const inqId = `${prefix}-${Math.floor(1000 + Math.random() * 9000)}`;
      db.prepare(`
        INSERT INTO inquiries (id, type, name, phone, merchant_id, amount, category, location, remarks)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(inqId, type || 'LOAN', name, phone, merchant_id || null, amount || 'N/A', category || 'General', location || 'Hyderabad', remarks || '');

      const created = db.prepare(`SELECT * FROM inquiries WHERE id = ?`).get(inqId);
      // Async sync to Supabase
      if (created) syncToSupabase('inquiries', created).catch(() => {});

      return sendJson(res, 201, { success: true, message: 'Application submitted successfully!', inquiry: created });
    }

    if (pathname === '/api/inquiries' && method === 'GET') {
      const inquiries = db.prepare(`
        SELECT * FROM inquiries 
        ORDER BY created_at DESC
      `).all();
      return sendJson(res, 200, { success: true, inquiries });
    }

    // 404 for unknown /api routes
    return sendJson(res, 404, { success: false, message: `API endpoint not found: ${pathname}` });

  } catch (err) {
    console.error('API Error:', err);
    return sendJson(res, 500, { success: false, message: err.message || 'Internal Server Error' });
  }
}
