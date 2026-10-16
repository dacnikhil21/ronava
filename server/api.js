import 'dotenv/config';
import { exec } from 'node:child_process';
import { verifyS3Connection, getPresignedUploadUrl, uploadBufferToS3, deleteS3Object } from './s3.js';
import { 
  initPostgresSchema, 
  getMediaFiles, 
  query as pgQuery,
  withTransaction,
  getDbPool
} from './pg_db.js';

import { getCaller } from './caller.js';
import { getSetting, getAllSettings, updateSetting } from './settings.js';
import { postLedgerEntry, getWalletBalances, verifyWalletReconciliation } from './ledger_engine.js';
import { processSwipeTransaction } from './transaction_engine.js';
import { quoteWithdrawal, processWithdrawalRequest } from './withdrawal_engine.js';
import { reverseTransaction } from './reversal_engine.js';
import { validateChildParentRates, setUserRate, getActiveRate } from './rate_engine.js';

export { getCaller };

// Auto-initialize PostgreSQL schema if DATABASE_URL is configured
initPostgresSchema().catch(() => {});

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

// Helper to send JSON response with native BigInt support
export function sendJson(res, statusCode, data) {
  const jsonStr = JSON.stringify(data, (_, v) => typeof v === 'bigint' ? v.toString() : v);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  });
  res.end(jsonStr);
}

/**
 * Authoritative dynamic buy rate resolver (0.0 if not configured)
 */
export function resolveUserBuyRate(user, pos, isInstant = false, targetChannel = null) {
  const chKey = targetChannel ? targetChannel.toLowerCase().replace(/[^a-z]/g, '') : null;
  if (pos) {
    if (pos.terminal_id && pos.terminal_id.startsWith('[PORTFOLIO]')) {
      try {
        const jsonStr = pos.terminal_id.replace('[PORTFOLIO]', '').trim();
        const p = JSON.parse(jsonStr);
        if (chKey && p[chKey] && p[chKey].enabled) {
          const r = isInstant ? (p[chKey].rate_instant || p[chKey].rate_t1) : p[chKey].rate_t1;
          const num = parseFloat(r);
          if (!isNaN(num) && num > 0) return num;
        }
      } catch (_) {}
    }
    const r = isInstant 
      ? (pos.commission_rate_instant || pos.commission_rate_t1 || pos.commission_rate) 
      : (pos.commission_rate_t1 || pos.commission_rate);
    const num = parseFloat(r);
    if (!isNaN(num) && num > 0) return num;
  }
  if (user) {
    const uRate = isInstant 
      ? (user.commission_rate_instant || user.commission_rate_t1 || user.margin_rate) 
      : (user.commission_rate_t1 || user.margin_rate);
    const num = parseFloat(uRate);
    if (!isNaN(num) && num > 0) return num;
  }
  return 0.0;
}

/**
 * Authoritative Server-Side Channel Balance Calculator (100% Single Source of Truth)
 * Evaluates real-time swipes and withdrawals strictly from financial_ledger in PostgreSQL.
 */
export async function calculateUserChannelBalances(userId) {
  try {
    const pool = getDbPool();
    const balances = await getWalletBalances(pool, userId);
    const ledgerRows = await pgQuery(`
      SELECT COALESCE(channel, 'pinelabs') as channel,
             SUM(CASE WHEN amount_paise > 0 THEN amount_paise ELSE 0 END) as credited_paise,
             SUM(CASE WHEN amount_paise < 0 THEN -amount_paise ELSE 0 END) as debited_paise,
             SUM(amount_paise) as net_paise
      FROM financial_ledger
      WHERE UPPER(user_id) = UPPER($1)
      GROUP BY channel
    `, [userId]);

    const channels = {
      pinelabs: { volume: 0, credited: 0, debited: 0, pending: 0, available_balance: 0, withdrawable_balance: 0 },
      payswiff: { volume: 0, credited: 0, debited: 0, pending: 0, available_balance: 0, withdrawable_balance: 0 },
      qr:       { volume: 0, credited: 0, debited: 0, pending: 0, available_balance: 0, withdrawable_balance: 0 },
    };

    for (const r of ledgerRows) {
      const rawCh = (r.channel || 'pinelabs').toLowerCase();
      const ch = rawCh.includes('swiff') ? 'payswiff' : (rawCh.includes('qr') ? 'qr' : 'pinelabs');
      const cred = Number(r.credited_paise || 0) / 100;
      const deb = Number(r.debited_paise || 0) / 100;
      const net = Math.max(0, Number(r.net_paise || 0) / 100);
      channels[ch].volume += cred;
      channels[ch].credited += cred;
      channels[ch].debited += deb;
      channels[ch].available_balance = net;
      channels[ch].withdrawable_balance = net;
    }

    const totalWithdrawable = Number(balances.withdrawable_balance_paise) / 100;
    for (const ch of Object.keys(channels)) {
      channels[ch].withdrawable_balance = Math.min(channels[ch].available_balance, totalWithdrawable);
    }

    return channels;
  } catch (err) {
    console.error('[calculateUserChannelBalances] Error:', err);
    return {
      pinelabs: { volume: 0, credited: 0, debited: 0, pending: 0, available_balance: 0, withdrawable_balance: 0 },
      payswiff: { volume: 0, credited: 0, debited: 0, pending: 0, available_balance: 0, withdrawable_balance: 0 },
      qr:       { volume: 0, credited: 0, debited: 0, pending: 0, available_balance: 0, withdrawable_balance: 0 },
    };
  }
}

// Master API Handler (100% Pure PostgreSQL)
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
    // 0. SECURITY LOCKOUT: DISABLE ALL GENERIC DATABASE ACCESS
    // ----------------------------------------------------
    if (pathname.startsWith('/api/db/')) {
      return sendJson(res, 403, { 
        success: false, 
        error: 'ACCESS_DENIED',
        message: 'Generic database endpoints (/api/db/*) are permanently disabled. All operations must use validated, dedicated business endpoints.' 
      });
    }

    // ----------------------------------------------------
    // 0.1 PUBLIC PLATFORM AGGREGATED STATS (Pure PostgreSQL Aggregation)
    // ----------------------------------------------------
    if (pathname === '/api/public/stats' && method === 'GET') {
      try {
        const [mRes, pRes, volRes, posRes, txRes, disRes] = await Promise.all([
          pgQuery(`SELECT COUNT(*)::int as c FROM users WHERE role = 'MERCHANT'`),
          pgQuery(`SELECT COUNT(*)::int as c FROM users WHERE role IN ('MASTER', 'SUPER_DISTRIBUTOR', 'DISTRICT_DISTRIBUTOR', 'DISTRIBUTOR', 'DIST_FRANCHISE')`),
          pgQuery(`SELECT COALESCE(SUM(amount), 0)::numeric as s FROM transactions WHERE status = 'APPROVED'`),
          pgQuery(`SELECT COUNT(*)::int as c FROM merchant_pos`),
          pgQuery(`SELECT COUNT(*)::int as c FROM transactions`),
          pgQuery(`SELECT COALESCE(SUM(amount), 0)::numeric as s FROM withdrawals WHERE status = 'APPROVED'`)
        ]);

        const totalMerchants = parseInt(mRes[0]?.c || 0, 10);
        const totalPartners = parseInt(pRes[0]?.c || 0, 10);
        const totalVolume = parseFloat(volRes[0]?.s || 0);
        const activeTerminals = parseInt(posRes[0]?.c || 0, 10);
        const totalTransactions = parseInt(txRes[0]?.c || 0, 10);
        const disbursedAmount = parseFloat(disRes[0]?.s || 0);

        return sendJson(res, 200, {
          success: true,
          stats: {
            totalMerchants,
            totalPartners,
            totalVolume,
            activeTerminals,
            totalTransactions,
            disbursedAmount
          }
        });
      } catch (err) {
        return sendJson(res, 500, { success: false, message: err.message });
      }
    }

    // ----------------------------------------------------
    // 0.2 PASSWORD MANAGEMENT & VERIFICATION ENDPOINTS
    // ----------------------------------------------------
    if (pathname === '/api/auth/change-password' && method === 'POST') {
      const { userId, currentPassword, newPassword } = await parseJsonBody(req);
      if (!userId || !currentPassword || !newPassword) {
        return sendJson(res, 400, { success: false, message: 'User ID, current password, and new password are required.' });
      }
      if (newPassword.trim().length < 6) {
        return sendJson(res, 400, { success: false, message: 'New password must be at least 6 characters long.' });
      }

      const users = await pgQuery(`SELECT * FROM users WHERE UPPER(id) = UPPER($1)`, [userId.trim()]);
      const user = users[0];
      if (!user) {
        return sendJson(res, 404, { success: false, message: 'User not found.' });
      }

      if ((user.password || '').trim() !== currentPassword.trim()) {
        return sendJson(res, 401, { success: false, message: 'Current password does not match. Please verify your credentials.' });
      }

      await pgQuery(`UPDATE users SET password = $1, updated_at = CURRENT_TIMESTAMP WHERE UPPER(id) = UPPER($2)`, [newPassword.trim(), userId.trim()]);
      return sendJson(res, 200, { success: true, message: 'Password changed successfully!' });
    }

    if (pathname === '/api/auth/forgot-password-request' && method === 'POST') {
      const { query: userQuery } = await parseJsonBody(req);
      if (!userQuery || !userQuery.trim()) {
        return sendJson(res, 400, { success: false, message: 'Please enter your registered User ID or Mobile Number.' });
      }

      const clean = userQuery.trim();
      const users = await pgQuery(`
        SELECT id, name, mobile, role 
        FROM users 
        WHERE UPPER(id) = UPPER($1) OR mobile = $1
      `, [clean]);

      const user = users[0];
      if (!user) {
        return sendJson(res, 404, { success: false, message: 'No registered account found matching that User ID or Mobile.' });
      }

      const ticketId = `PWD-REQ-${Date.now().toString().slice(-6)}`;
      await pgQuery(`
        INSERT INTO inquiries (id, type, name, phone, merchant_id, amount, category, location, remarks)
        VALUES ($1, 'PASSWORD_RESET', $2, $3, $4, '0', 'SECURITY', 'PORTAL', $5)
      `, [ticketId, user.name, user.mobile, user.id, `Password reset requested for ${user.id} (${user.role}). Verification required by Help Desk.`]);

      return sendJson(res, 200, {
        success: true,
        ticketId,
        message: `Password reset request registered (Ticket #${ticketId}). For security, please contact RONAV Support at 9966203053 or your assigned Distributor to verify your identity.`,
        user: { id: user.id, name: user.name, mobile: user.mobile.replace(/(\d{3})\d{4}(\d{3})/, '$1****$2') }
      });
    }

    if (pathname === '/api/admin/users/reset-password' && method === 'POST') {
      const { adminId, adminPassword, targetUserId, newPassword } = await parseJsonBody(req);
      const cleanAdminId = (adminId || 'ADM001').trim();
      if (!targetUserId) {
        return sendJson(res, 400, { success: false, message: 'Target User ID is required.' });
      }

      const admins = await pgQuery(`SELECT * FROM users WHERE UPPER(id) = UPPER($1)`, [cleanAdminId]);
      const admin = admins[0];
      if (!admin || (admin.role !== 'ADMIN' && admin.role !== 'MASTER')) {
        return sendJson(res, 403, { success: false, message: 'Access Denied: Only authorized Administrators can perform password resets.' });
      }

      if (adminPassword && adminPassword.trim()) {
        if ((admin.password || '').trim() !== adminPassword.trim()) {
          return sendJson(res, 401, { success: false, message: 'Invalid Admin credentials.' });
        }
      }

      const targets = await pgQuery(`SELECT * FROM users WHERE UPPER(id) = UPPER($1)`, [targetUserId.trim()]);
      const target = targets[0];
      if (!target) {
        return sendJson(res, 404, { success: false, message: 'Target user not found.' });
      }

      const randomDigits = Math.floor(1000 + Math.random() * 9000);
      const resetPass = newPassword && newPassword.trim().length >= 6 ? newPassword.trim() : `Ronav@${randomDigits}`;

      await pgQuery(`UPDATE users SET password = $1, updated_at = CURRENT_TIMESTAMP WHERE UPPER(id) = UPPER($2)`, [resetPass, targetUserId.trim()]);

      return sendJson(res, 200, {
        success: true,
        message: `Password reset successfully for ${target.name} (${target.id})!`,
        newPassword: resetPass
      });
    }

    if (pathname === '/api/admin/users/toggle-status' && method === 'POST') {
      const { adminId, targetUserId, status } = await parseJsonBody(req);
      if (!targetUserId || !status) {
        return sendJson(res, 400, { success: false, message: 'targetUserId and status are required.' });
      }

      if (targetUserId.toUpperCase() === 'ADM001') {
        return sendJson(res, 400, { success: false, message: 'Cannot suspend Super Admin (ADM001).' });
      }

      const validStatuses = ['ACTIVE', 'SUSPENDED'];
      if (!validStatuses.includes(status.toUpperCase())) {
        return sendJson(res, 400, { success: false, message: 'Invalid status. Allowed: ACTIVE, SUSPENDED.' });
      }

      const statusRows = await pgQuery(`SELECT * FROM inquiries WHERE id = 'SYS-USER-STATUSES'`);
      let statusMap = {};
      if (statusRows.length > 0 && statusRows[0].remarks) {
        try {
          const parsed = JSON.parse(statusRows[0].remarks);
          if (parsed && typeof parsed === 'object') statusMap = parsed;
        } catch (_) {}
      }
      statusMap[targetUserId] = status.toUpperCase();

      await pgQuery(`
        INSERT INTO inquiries (id, type, name, phone, merchant_id, amount, category, location, remarks)
        VALUES ('SYS-USER-STATUSES', 'SYSTEM', 'System Status Map', '9966203053', 'ADM001', '0', 'SYSTEM', 'SERVER', $1)
        ON CONFLICT (id) DO UPDATE SET remarks = EXCLUDED.remarks, updated_at = CURRENT_TIMESTAMP
      `, [JSON.stringify(statusMap)]);

      return sendJson(res, 200, {
        success: true,
        message: `Account ${targetUserId} status updated to ${status.toUpperCase()}.`,
        status: status.toUpperCase()
      });
    }

    if (pathname === '/api/admin/system/purge-demo-templates' && method === 'POST') {
      try {
        const demoIds = ['SD101', 'DD101', 'DIST101', 'MID101'];
        await pgQuery(`DELETE FROM transactions WHERE merchant_id = ANY($1)`, [demoIds]);
        await pgQuery(`DELETE FROM withdrawals WHERE merchant_id = ANY($1)`, [demoIds]);
        await pgQuery(`DELETE FROM beneficiaries WHERE merchant_id = ANY($1)`, [demoIds]);
        await pgQuery(`DELETE FROM merchant_pos WHERE merchant_id = ANY($1)`, [demoIds]);
        await pgQuery(`DELETE FROM wallets WHERE user_id = ANY($1)`, [demoIds]);
        await pgQuery(`DELETE FROM users WHERE id = ANY($1)`, [demoIds]);
        return sendJson(res, 200, { success: true, message: 'Template demo accounts removed successfully.' });
      } catch (err) {
        return sendJson(res, 500, { success: false, message: err.message });
      }
    }

    if (pathname === '/api/users/update-profile' && method === 'POST') {
      try {
        const { userId, name, mobile, email, aadhaar, pan, address, creator_id, commission_rate_t1, commission_rate_instant, margin_rate } = await parseJsonBody(req);
        if (!userId) {
          return sendJson(res, 400, { success: false, message: 'userId is required.' });
        }

        const updateRes = await pgQuery(`
          UPDATE users 
          SET name = COALESCE($1, name),
              mobile = COALESCE($2, mobile),
              email = COALESCE($3, email),
              aadhaar = COALESCE($4, aadhaar),
              pan = COALESCE($5, pan),
              address = COALESCE($6, address),
              creator_id = COALESCE($7, creator_id),
              commission_rate_t1 = COALESCE($8, commission_rate_t1),
              commission_rate_instant = COALESCE($9, commission_rate_instant),
              margin_rate = COALESCE($10, margin_rate),
              updated_at = CURRENT_TIMESTAMP
          WHERE UPPER(id) = UPPER($11)
          RETURNING id, name, mobile, email, aadhaar, pan, address, role, creator_id, margin_rate, commission_rate_t1, commission_rate_instant, created_at, updated_at
        `, [
          name ? name.trim() : null,
          mobile ? mobile.trim() : null,
          email ? email.trim() : null,
          aadhaar ? aadhaar.trim() : null,
          pan ? pan.trim() : null,
          address ? address.trim() : null,
          creator_id ? creator_id.trim() : null,
          commission_rate_t1 !== undefined && commission_rate_t1 !== null ? parseFloat(commission_rate_t1) : null,
          commission_rate_instant !== undefined && commission_rate_instant !== null ? parseFloat(commission_rate_instant) : null,
          margin_rate !== undefined && margin_rate !== null ? parseFloat(margin_rate) : null,
          userId.trim()
        ]);

        if (updateRes.length === 0) {
          return sendJson(res, 404, { success: false, message: 'User not found.' });
        }

        return sendJson(res, 200, {
          success: true,
          message: 'User profile updated successfully.',
          user: updateRes[0]
        });
      } catch (err) {
        return sendJson(res, 500, { success: false, message: err.message });
      }
    }

    // ----------------------------------------------------
    // 0.3 POS TERMINAL & CHANNELS ASSIGNMENT
    // ----------------------------------------------------
    if (pathname === '/api/pos/assign' && method === 'POST') {
      const { 
        adminId, 
        merchantId, 
        provider, 
        terminalId, 
        vendorEntity, 
        devicePlan, 
        monthlyRent, 
        settlementType, 
        commissionRateT1, 
        commissionRateInstant 
      } = await parseJsonBody(req);

      if (!merchantId) {
        return sendJson(res, 400, { success: false, message: 'merchantId is required.' });
      }

      const rateT1 = parseFloat(commissionRateT1);
      const rateInstant = parseFloat(commissionRateInstant);

      if (isNaN(rateT1) || rateT1 <= 0 || isNaN(rateInstant) || rateInstant <= 0) {
        return sendJson(res, 400, { 
          success: false, 
          message: 'commissionRateT1 and commissionRateInstant are required positive numbers.' 
        });
      }

      const merchants = await pgQuery(`SELECT * FROM users WHERE UPPER(id) = UPPER($1)`, [merchantId.trim()]);
      if (!merchants || merchants.length === 0) {
        return sendJson(res, 404, { success: false, message: 'Merchant not found.' });
      }

      const primaryProvider = provider || 'Pine Labs';
      const termId = terminalId && terminalId.trim() ? terminalId.trim() : `PL-${Math.floor(1000 + Math.random() * 9000)}`;
      const vendor = vendorEntity || 'Rose Navaneetham Enterprises';
      const plan = devicePlan || 'RENTAL';
      const rent = plan === 'RENTAL' ? (parseFloat(monthlyRent) || 0) : 0;
      const settlement = settlementType || 'T1';
      const instantFee = settlement === 'INSTANT' ? 0.30 : 0.0;

      await pgQuery(`
        INSERT INTO merchant_pos (
          merchant_id, provider, terminal_id, commission_rate, assigned_by,
          vendor_entity, device_plan, monthly_rent, settlement_type, instant_surcharge,
          commission_rate_t1, commission_rate_instant
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        ON CONFLICT (merchant_id) DO UPDATE SET
          provider = EXCLUDED.provider,
          terminal_id = EXCLUDED.terminal_id,
          commission_rate = EXCLUDED.commission_rate,
          vendor_entity = EXCLUDED.vendor_entity,
          device_plan = EXCLUDED.device_plan,
          monthly_rent = EXCLUDED.monthly_rent,
          settlement_type = EXCLUDED.settlement_type,
          instant_surcharge = EXCLUDED.instant_surcharge,
          commission_rate_t1 = EXCLUDED.commission_rate_t1,
          commission_rate_instant = EXCLUDED.commission_rate_instant,
          updated_at = CURRENT_TIMESTAMP
      `, [
        merchantId.trim(), primaryProvider, termId, rateT1, adminId || 'ADM001',
        vendor, plan, rent, settlement, instantFee,
        rateT1, rateInstant
      ]);

      const posRows = await pgQuery(`SELECT * FROM merchant_pos WHERE merchant_id = $1`, [merchantId.trim()]);
      return sendJson(res, 200, {
        success: true,
        message: 'POS terminal and channels configured successfully!',
        pos: posRows[0]
      });
    }

    // ----------------------------------------------------
    // 0.4 ADMIN TRANSACTION VERIFICATION & APPROVAL / REVERSAL
    // ----------------------------------------------------
    if (pathname === '/api/admin/verify-transaction' && method === 'POST') {
      const body = await parseJsonBody(req);
      const targetTxnId = (body.transaction_id || body.txnId || body.txn_id || body.id || '').toString().trim();
      const action = (body.action || '').toUpperCase();
      const remark = body.remark || '';
      const utr = body.utr || '';

      if (!targetTxnId || !action) {
        return sendJson(res, 400, { success: false, message: 'txnId and action are required.' });
      }

      const txns = await pgQuery(`SELECT * FROM transactions WHERE id = $1`, [targetTxnId]);
      const txn = txns[0];
      if (!txn) {
        return sendJson(res, 404, { success: false, message: 'Transaction not found.' });
      }

      if (action === 'APPROVE') {
        if (txn.status === 'REVERSED' || txn.status === 'REJECTED') {
          return sendJson(res, 400, { success: false, message: 'Cannot approve a reversed or rejected transaction.' });
        }

        const finalRemark = utr ? `[VERIFIED_BY_ADMIN] UTR: ${utr}` : (remark ? `[VERIFIED_BY_ADMIN] ${remark}` : '[VERIFIED_BY_ADMIN] Audited & verified against POS settlement report');

        await pgQuery(`
          UPDATE transactions 
          SET status = 'APPROVED', admin_remark = $1, verified_at = CURRENT_TIMESTAMP 
          WHERE id = $2
        `, [finalRemark, targetTxnId]);

        const updatedTxn = (await pgQuery(`SELECT * FROM transactions WHERE id = $1`, [targetTxnId]))[0];
        const balances = await getWalletBalances(getDbPool(), txn.merchant_id);

        return sendJson(res, 200, {
          success: true,
          message: `Transaction ${targetTxnId} verified successfully!`,
          transaction: updatedTxn,
          balances
        });
      } else if (action === 'REJECT') {
        if (txn.status === 'REVERSED' || txn.status === 'REJECTED') {
          return sendJson(res, 400, { success: false, message: `Transaction ${targetTxnId} is already reversed or rejected.` });
        }

        const caller = getCaller(req);
        const result = await withTransaction(async (client) => {
          return await reverseTransaction(client, {
            txnId: targetTxnId,
            reason: remark || 'Transaction rejected by Admin',
            callerId: caller.id
          });
        });

        const updatedTxn = (await pgQuery(`SELECT * FROM transactions WHERE id = $1`, [targetTxnId]))[0];
        const balances = await getWalletBalances(getDbPool(), txn.merchant_id);

        return sendJson(res, 200, {
          success: true,
          message: `Transaction ${targetTxnId} reversed successfully. Signed reversing entries posted to financial ledger.`,
          transaction: updatedTxn,
          balances,
          reversal: result
        });
      } else {
        return sendJson(res, 400, { success: false, message: 'Invalid action. Allowed: APPROVE, REJECT.' });
      }
    }

    // ----------------------------------------------------
    // 0.5 SINGLE USER PROFILE WITH POS & WALLET
    // ----------------------------------------------------
    if (pathname === '/api/auth/verify' && method === 'GET') {
      const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
      const userId = (parsedUrl.searchParams.get('userId') || parsedUrl.searchParams.get('id') || '').trim();
      if (!userId) {
        return sendJson(res, 400, { success: false, message: 'userId is required.' });
      }
      try {
        const users = await pgQuery(`SELECT id, name, role, COALESCE(status, 'ACTIVE') as status FROM users WHERE UPPER(id) = UPPER($1)`, [userId]);
        if (!users || users.length === 0) {
          return sendJson(res, 404, { success: false, code: 'USER_NOT_FOUND', message: 'User account not found.' });
        }
        if (users[0].status === 'SUSPENDED') {
          return sendJson(res, 403, { success: false, code: 'USER_SUSPENDED', message: 'User account is suspended.' });
        }
        return sendJson(res, 200, { success: true, user: users[0] });
      } catch (err) {
        return sendJson(res, 500, { success: false, message: err.message });
      }
    }

    if (pathname.startsWith('/api/users/') && method === 'GET' && pathname !== '/api/users/create' && !pathname.endsWith('/financial-summary')) {
      const userId = decodeURIComponent(pathname.replace('/api/users/', '')).trim();
      try {
        const users = await pgQuery(`
          SELECT u.id, u.name, u.mobile, u.email, u.pan, u.aadhaar, u.address, u.role, u.creator_id, u.margin_rate, COALESCE(u.status, 'ACTIVE') as status, u.created_at,
                 p.provider AS pos_provider, 
                 p.terminal_id AS pos_terminal, 
                 p.commission_rate AS pos_rate,
                 p.vendor_entity AS pos_vendor,
                 p.device_plan AS pos_plan,
                 p.monthly_rent AS pos_rent,
                 p.settlement_type AS pos_settlement,
                 p.instant_surcharge AS pos_instant_fee,
                 COALESCE((w.balance_paise - w.held_paise) / 100.0, 0) as available_balance,
                 COALESCE(w.balance_paise / 100.0, 0) as total_sales,
                 COALESCE(w.held_paise / 100.0, 0) as pending_balance,
                 COALESCE(w.balance_paise / 100.0, 0) as received_sales,
                 COALESCE(w.withdrawn_paise / 100.0, 0) as withdrawn_amount,
                 w.balance_paise,
                 w.held_paise
          FROM users u
          LEFT JOIN merchant_pos p ON u.id = p.merchant_id
          LEFT JOIN wallets w ON u.id = w.user_id
          WHERE UPPER(u.id) = UPPER($1)
        `, [userId]);

        if (!users || users.length === 0) {
          return sendJson(res, 404, { success: false, code: 'USER_NOT_FOUND', message: `User ${userId} not found.` });
        }

        if (users[0].status === 'SUSPENDED') {
          return sendJson(res, 403, { success: false, code: 'USER_SUSPENDED', message: `User ${userId} is suspended.` });
        }

        const userProfile = { ...users[0] };
        delete userProfile.password;

        return sendJson(res, 200, { success: true, user: userProfile });
      } catch (err) {
        return sendJson(res, 500, { success: false, message: err.message });
      }
    }

    if (pathname.startsWith('/api/wallet/') && !pathname.startsWith('/api/wallet/balance') && method === 'GET') {
      const userId = decodeURIComponent(pathname.replace('/api/wallet/', '')).trim();
      try {
        const userExists = (await pgQuery(`SELECT id FROM users WHERE UPPER(id) = UPPER($1)`, [userId]))[0];
        if (!userExists) {
          return sendJson(res, 404, { success: false, message: `User ${userId} not found.` });
        }
        const pool = getDbPool();
        const balances = await getWalletBalances(pool, userId);
        const pos = (await pgQuery(`SELECT * FROM merchant_pos WHERE UPPER(merchant_id) = UPPER($1)`, [userId]))[0] || null;
        const channelBalances = await calculateUserChannelBalances(userId);

        const wallet = {
          user_id: userId,
          balance_paise: balances.balance_paise.toString(),
          held_paise: balances.held_paise.toString(),
          available_balance: Number(balances.available_balance_paise) / 100,
          withdrawable_balance: Number(balances.withdrawable_balance_paise) / 100,
          available_balance_paise: balances.available_balance_paise.toString(),
          reserve_locked_paise: balances.reserve_locked_paise.toString(),
          withdrawable_balance_paise: balances.withdrawable_balance_paise.toString(),
          total_sales: Number(balances.balance_paise) / 100,
          received_sales: Number(balances.balance_paise) / 100,
          pending_balance: Number(balances.held_paise) / 100,
          channel_balances: channelBalances
        };

        return sendJson(res, 200, {
          success: true,
          wallet,
          pos,
          balances
        });
      } catch (err) {
        return sendJson(res, 500, { success: false, message: err.message });
      }
    }

    // ----------------------------------------------------
    // 0.6 AUTHORITATIVE DOWNSTREAM USER ONBOARDING
    // ----------------------------------------------------
    if (pathname === '/api/users/create' && method === 'POST') {
      try {
        const userData = await parseJsonBody(req);
        const { 
          creator_id, 
          parent_id, 
          name, 
          mobile, 
          role, 
          pos_provider, 
          pos_vendor,
          device_plan,
          monthly_rent,
          settlement_type,
          commission_rate,
          pos_terminal_id,
          channels
        } = userData;

        if (!creator_id || !name || !mobile || !role) {
          return sendJson(res, 400, { success: false, message: 'Missing required fields (creator_id, name, mobile, role).' });
        }

        // Determine target creator in hierarchy
        let assignedCreatorId = creator_id;
        if (parent_id && parent_id !== 'ADM001' && parent_id !== 'DIRECT') {
          assignedCreatorId = parent_id;
        }

        let dbRole = role;
        if (role === 'DIST_FRANCHISE' || role === 'DISTRICT_DISTRIBUTOR') {
          dbRole = 'DISTRIBUTOR';
        } else if (role === 'MASTER') {
          dbRole = 'SUPER_DISTRIBUTOR';
        }

        const prefixMap = {
          'SUPER_DISTRIBUTOR': 'SD',
          'DISTRIBUTOR': 'DIST',
          'MERCHANT': 'MID',
          'RETAILER': 'MID'
        };
        let idPrefix = prefixMap[dbRole] || prefixMap[role] || 'MID';
        if (role === 'DIST_FRANCHISE' || role === 'DISTRICT_DISTRIBUTOR') {
          idPrefix = 'DD';
        } else if (role === 'MASTER') {
          idPrefix = 'MST';
        }

        // Collision-Free Sequential ID: Check existing IDs in PostgreSQL
        let newUserId = `${idPrefix}1001`;
        try {
          const existingUsers = await pgQuery(`SELECT id FROM users WHERE UPPER(id) LIKE UPPER($1)`, [`${idPrefix}%`]);
          const existingIdSet = new Set((existingUsers || []).map(u => (u.id || '').toUpperCase()));
          let candidateNum = 1001;
          while (existingIdSet.has(`${idPrefix}${candidateNum}`.toUpperCase())) {
            candidateNum++;
          }
          newUserId = `${idPrefix}${candidateNum}`;
        } catch (_) {
          newUserId = `${idPrefix}${Date.now().toString().slice(-4)}`;
        }

        const randomSuffix = Math.floor(1000 + Math.random() * 9000);
        const initialPassword = userData.password || `Ronav@${randomSuffix}`;

        let createdUser = null;
        let createdPOS = null;

        await withTransaction(async (client) => {
          // 0. Validate Channels & Rates against Parent Hierarchy
          if (channels) {
            if (channels.pine_labs?.enabled) {
              const t1Bps = Math.round(parseFloat(channels.pine_labs.rate_t1 || userData.commission_rate_t1 || 0) * 100);
              const instBps = Math.round(parseFloat(channels.pine_labs.rate_instant || channels.pine_labs.rate_t1 || userData.commission_rate_instant || 0) * 100);
              await validateChildParentRates(client, { parentId: assignedCreatorId, channel: 'pinelabs', settlementMode: 'T1', childRateBps: t1Bps });
              await validateChildParentRates(client, { parentId: assignedCreatorId, channel: 'pinelabs', settlementMode: 'INSTANT', childRateBps: instBps });
            }
            if (channels.payswiff?.enabled) {
              const t1Bps = Math.round(parseFloat(channels.payswiff.rate_t1 || userData.commission_rate_t1 || 0) * 100);
              const instBps = Math.round(parseFloat(channels.payswiff.rate_instant || channels.payswiff.rate_t1 || userData.commission_rate_instant || 0) * 100);
              await validateChildParentRates(client, { parentId: assignedCreatorId, channel: 'payswiff', settlementMode: 'T1', childRateBps: t1Bps });
              await validateChildParentRates(client, { parentId: assignedCreatorId, channel: 'payswiff', settlementMode: 'INSTANT', childRateBps: instBps });
            }
            if (channels.qr?.enabled) {
              const qrBps = Math.round(parseFloat(channels.qr.rate || channels.qr.rate_instant || channels.qr.rate_t1 || userData.commission_rate_instant || 0) * 100);
              await validateChildParentRates(client, { parentId: assignedCreatorId, channel: 'qr', settlementMode: 'NONE', childRateBps: qrBps });
            }
          }

          // 1. Insert User
          const userInsertRes = await client.query(`
            INSERT INTO users (
              id, name, mobile, email, aadhaar, pan, address, role, creator_id, password,
              margin_rate, commission_rate_t1, commission_rate_instant
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
            RETURNING *
          `, [
            newUserId,
            name,
            mobile,
            userData.email || null,
            userData.aadhaar || null,
            userData.pan || null,
            userData.address || null,
            dbRole,
            assignedCreatorId,
            initialPassword,
            parseFloat(userData.margin_rate) || 0.0,
            parseFloat(userData.commission_rate_t1) || 0.0,
            parseFloat(userData.commission_rate_instant || userData.commission_rate_t1) || 0.0
          ]);

          createdUser = userInsertRes.rows[0];

          // 2. Initialize Wallet
          await client.query(`
            INSERT INTO wallets (user_id, balance_paise, held_paise, total_sales_paise, withdrawn_paise)
            VALUES ($1, 0, 0, 0, 0)
            ON CONFLICT (user_id) DO NOTHING
          `, [newUserId]);

          // 3. Configure Multi-Channel Portfolio and populate user_channel_rates
          const hasChannels = channels && (channels.pine_labs?.enabled || channels.payswiff?.enabled || channels.qr?.enabled);

          if (hasChannels) {
            const fullTerminalStr = `[PORTFOLIO]${JSON.stringify(channels)}`;
            const pine = channels.pine_labs;
            const swiff = channels.payswiff;
            const qr = channels.qr;

            let primaryProvider = 'Pine Labs';
            let primaryVendor = 'Rose Navaneetham Enterprises';
            let primaryRateT1 = parseFloat(userData.commission_rate_t1 || 0);
            let primaryRateInstant = parseFloat(userData.commission_rate_instant || userData.commission_rate_t1 || 0);

            if (pine && pine.enabled) {
              primaryProvider = 'Pine Labs';
              primaryVendor = 'Rose Navaneetham Enterprises';
              primaryRateT1 = parseFloat(pine.rate_t1 || userData.commission_rate_t1 || 0);
              primaryRateInstant = parseFloat(pine.rate_instant || userData.commission_rate_instant || primaryRateT1);

              const t1Bps = Math.round(primaryRateT1 * 100);
              const instBps = Math.round(primaryRateInstant * 100);
              await setUserRate(client, { userId: newUserId, channel: 'pinelabs', settlementMode: 'T1', rateBps: t1Bps });
              await setUserRate(client, { userId: newUserId, channel: 'pinelabs', settlementMode: 'INSTANT', rateBps: instBps });
            }
            if (swiff && swiff.enabled) {
              if (!pine?.enabled) {
                primaryProvider = 'Payswiff';
                primaryVendor = swiff.vendor === 'R.P. Technologies' ? 'R.P. Technologies' : 'RONAV Technologies';
                primaryRateT1 = parseFloat(swiff.rate_t1 || userData.commission_rate_t1 || 0);
                primaryRateInstant = parseFloat(swiff.rate_instant || userData.commission_rate_instant || primaryRateT1);
              }
              const t1Bps = Math.round(parseFloat(swiff.rate_t1 || userData.commission_rate_t1 || 0) * 100);
              const instBps = Math.round(parseFloat(swiff.rate_instant || swiff.rate_t1 || userData.commission_rate_instant || 0) * 100);
              await setUserRate(client, { userId: newUserId, channel: 'payswiff', settlementMode: 'T1', rateBps: t1Bps });
              await setUserRate(client, { userId: newUserId, channel: 'payswiff', settlementMode: 'INSTANT', rateBps: instBps });
            }
            if (qr && qr.enabled) {
              if (!pine?.enabled && !swiff?.enabled) {
                primaryProvider = 'Company QR (UPI)';
                primaryVendor = 'RONAV Technologies';
                primaryRateT1 = parseFloat(qr.rate_instant || userData.commission_rate_instant || userData.commission_rate_t1 || 0);
                primaryRateInstant = primaryRateT1;
              }
              const qrBps = Math.round(parseFloat(qr.rate || qr.rate_instant || qr.rate_t1 || userData.commission_rate_instant || 0) * 100);
              await setUserRate(client, { userId: newUserId, channel: 'qr', settlementMode: 'NONE', rateBps: qrBps });
            }

            const isQrOnly = Boolean(qr?.enabled && !pine?.enabled && !swiff?.enabled);
            const chosenPlan = isQrOnly ? 'DIRECT' : (pine?.plan || swiff?.plan || 'RENTAL');
            const chosenRent = isQrOnly ? 0.0 : (pine?.rent !== undefined ? (parseFloat(pine.rent) || 0.0) : (swiff?.rent !== undefined ? (parseFloat(swiff.rent) || 0.0) : 0.0));

            const posRes = await client.query(`
              INSERT INTO merchant_pos (
                merchant_id, provider, terminal_id, commission_rate, assigned_by,
                vendor_entity, device_plan, monthly_rent, settlement_type,
                commission_rate_t1, commission_rate_instant, admin_cut_rate, upline_override_rate
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
              RETURNING *
            `, [
              newUserId, primaryProvider, fullTerminalStr, primaryRateT1, assignedCreatorId,
              primaryVendor, chosenPlan, chosenRent, isQrOnly ? 'INSTANT' : 'T1',
              primaryRateT1, primaryRateInstant, parseFloat(userData.admin_cut_rate || 0), parseFloat(userData.upline_override_rate || 0)
            ]);
            createdPOS = posRes.rows[0];
          } else {
            const shouldAssignPOS = pos_provider && pos_provider !== 'NONE';
            if (shouldAssignPOS) {
              let provider = 'Pine Labs';
              let vendorEntity = 'Rose Navaneetham Enterprises';
              let plan = (device_plan === 'CUSTOM' || device_plan === 'LIFETIME' || device_plan === 'DIRECT') ? device_plan : 'RENTAL';
              let rentFee = (plan === 'RENTAL' || plan === 'CUSTOM') ? (parseFloat(monthly_rent) || 0.0) : 0.0;
              let settlement = settlement_type === 'INSTANT' ? 'INSTANT' : 'T1';

              if (pos_provider === 'Payswiff') {
                provider = 'Payswiff';
                vendorEntity = pos_vendor === 'R.P. Technologies' ? 'R.P. Technologies' : 'RONAV Technologies';
              } else if (pos_provider === 'QR' || pos_provider === 'Company QR' || pos_provider === 'Company QR (UPI)') {
                provider = 'Company QR (UPI)';
                vendorEntity = 'RONAV Technologies';
                plan = 'DIRECT';
                rentFee = 0.0;
                settlement = 'INSTANT';
              }

              const rateT1 = parseFloat(userData.commission_rate_t1 || userData.commission_rate) || 0;
              const rateInstant = parseFloat(userData.commission_rate_instant || userData.commission_rate_t1 || userData.commission_rate) || 0;
              const adminCut = parseFloat(userData.admin_cut_rate) || 0;
              const uplineCut = parseFloat(userData.upline_override_rate) || 0;

              const cleanChannel = provider.toLowerCase().includes('swiff') ? 'payswiff' : (provider.toLowerCase().includes('qr') ? 'qr' : 'pinelabs');
              if (cleanChannel === 'qr') {
                const qrBps = Math.round(rateInstant * 100);
                await validateChildParentRates(client, { parentId: assignedCreatorId, channel: 'qr', settlementMode: 'NONE', childRateBps: qrBps });
                await setUserRate(client, { userId: newUserId, channel: 'qr', settlementMode: 'NONE', rateBps: qrBps });
              } else {
                const t1Bps = Math.round(rateT1 * 100);
                const instBps = Math.round(rateInstant * 100);
                await validateChildParentRates(client, { parentId: assignedCreatorId, channel: cleanChannel, settlementMode: 'T1', childRateBps: t1Bps });
                await validateChildParentRates(client, { parentId: assignedCreatorId, channel: cleanChannel, settlementMode: 'INSTANT', childRateBps: instBps });
                await setUserRate(client, { userId: newUserId, channel: cleanChannel, settlementMode: 'T1', rateBps: t1Bps });
                await setUserRate(client, { userId: newUserId, channel: cleanChannel, settlementMode: 'INSTANT', rateBps: instBps });
              }

              const terminalPrefix = provider === 'Payswiff' ? 'SWIFF' : 'PL';
              const cleanTerminalId = (userData.pos_terminal_id && userData.pos_terminal_id.trim())
                ? userData.pos_terminal_id.trim()
                : `${terminalPrefix}-${newUserId.replace(/\D/g, '') || '01'}`;

              const fullTerminalStr = `${cleanTerminalId}|T1:${rateT1}|INS:${rateInstant}|ADM:${adminCut}|UPL:${uplineCut}|PLAN:${plan}|RENT:${rentFee}`;

              const posRes = await client.query(`
                INSERT INTO merchant_pos (
                  merchant_id, provider, terminal_id, commission_rate, assigned_by,
                  vendor_entity, device_plan, monthly_rent, settlement_type,
                  commission_rate_t1, commission_rate_instant, admin_cut_rate, upline_override_rate
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
                RETURNING *
              `, [
                newUserId, provider, fullTerminalStr, rateT1, assignedCreatorId,
                vendorEntity, plan, rentFee, settlement,
                rateT1, rateInstant, adminCut, uplineCut
              ]);
              createdPOS = posRes.rows[0];
            }
          }
        });

        const safeUser = { ...createdUser };
        delete safeUser.password;

        return sendJson(res, 200, {
          success: true,
          message: `Successfully onboarded ${role} account (${newUserId})!`,
          user: safeUser,
          pos: createdPOS,
          credentials: {
            id: newUserId,
            name: createdUser.name,
            mobile: createdUser.mobile,
            role: createdUser.role,
            password: initialPassword
          }
        });
      } catch (err) {
        if (
          err.message && (
            err.message.includes('INVALID_RATE_HIERARCHY') ||
            err.message.includes('PARENT_CHANNEL_MISSING') ||
            err.message.includes('PARENT_MODE_MISSING') ||
            err.message.includes('INVALID_RATE_VALUE') ||
            err.message.includes('unique') ||
            err.message.includes('duplicate')
          )
        ) {
          return sendJson(res, 400, { success: false, message: err.message });
        }
        return sendJson(res, 500, { success: false, message: err.message || 'Failed to create user on server.' });
      }
    }

    // ----------------------------------------------------
    // 0.61 DELETE SPECIFIC USER (EXCLUDING ADM001)
    // ----------------------------------------------------
    if (pathname === '/api/admin/users/delete' && method === 'POST') {
      try {
        const { userId } = await parseJsonBody(req);
        if (!userId || userId.trim().toUpperCase() === 'ADM001') {
          return sendJson(res, 400, { success: false, message: 'Cannot delete Super Admin (ADM001).' });
        }
        const cleanId = userId.trim().toUpperCase();
        await withTransaction(async (client) => {
          await client.query(`DELETE FROM transactions WHERE UPPER(merchant_id) = $1`, [cleanId]);
          await client.query(`DELETE FROM withdrawals WHERE UPPER(merchant_id) = $1`, [cleanId]);
          await client.query(`DELETE FROM beneficiaries WHERE UPPER(merchant_id) = $1`, [cleanId]);
          await client.query(`DELETE FROM merchant_pos WHERE UPPER(merchant_id) = $1`, [cleanId]);
          await client.query(`DELETE FROM wallets WHERE UPPER(user_id) = $1`, [cleanId]);
          await client.query(`DELETE FROM users WHERE UPPER(id) = $1`, [cleanId]);
        });
        return sendJson(res, 200, { success: true, message: `Account ${cleanId} and associated records deleted successfully.` });
      } catch (err) {
        return sendJson(res, 500, { success: false, message: err.message });
      }
    }

    // ----------------------------------------------------
    // 0.62 CLEANUP VERIFIED ANTIGRAVITY TEST ACCOUNTS ONLY
    // ----------------------------------------------------
    if (pathname === '/api/admin/cleanup-test-accounts' && method === 'POST') {
      return sendJson(res, 403, { 
        success: false, 
        error: 'ACCESS_DENIED',
        message: 'Bulk database purge endpoints are permanently disabled for production data safety.' 
      });
    }

    // ----------------------------------------------------
    // 0.7 BENEFICIARY CREATION & MANAGEMENT
    // ----------------------------------------------------
    if (pathname === '/api/beneficiaries/create' && method === 'POST') {
      try {
        const { merchant_id, bank_name, account_number, ifsc, holder_name, beneficiary_name, is_primary } = await parseJsonBody(req);
        if (!merchant_id || !bank_name || !account_number || !account_number.trim() || !ifsc || !ifsc.trim()) {
          return sendJson(res, 400, { success: false, message: 'Missing required bank details (merchant_id, bank_name, account_number, ifsc).' });
        }

        const benName = (holder_name || beneficiary_name || 'Account Holder').trim();
        const benId = `BEN-${Date.now().toString().slice(-6)}`;
        const ifscClean = ifsc.trim().toUpperCase();

        const insertRes = await pgQuery(`
          INSERT INTO beneficiaries (id, merchant_id, bank_name, account_number, ifsc, beneficiary_name, holder_name, is_primary)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          RETURNING *
        `, [benId, merchant_id.trim(), bank_name.trim(), account_number.trim(), ifscClean, benName, benName, Boolean(is_primary)]);

        return sendJson(res, 200, {
          success: true,
          message: 'Beneficiary account added successfully!',
          beneficiary: insertRes[0]
        });
      } catch (err) {
        return sendJson(res, 500, { success: false, message: err.message });
      }
    }

    // ----------------------------------------------------
    // 0.8 INQUIRIES & APPLICATIONS SUBMISSION
    // ----------------------------------------------------
    if (pathname === '/api/inquiries/submit' && method === 'POST') {
      try {
        const { type, name, phone, merchant_id, amount, category, location, remarks } = await parseJsonBody(req);
        if (!name || !phone) {
          return sendJson(res, 400, { success: false, message: 'Name and Phone number are required.' });
        }

        const normalizedType = (type || 'GENERAL').toUpperCase();
        const dbType = normalizedType === 'LOAN' ? 'LOAN' : (normalizedType === 'FRANCHISE' ? 'FRANCHISE' : 'GENERAL');
        const displayCategory = category || (normalizedType === 'BBPS' ? 'BBPS Utility Hub' : (normalizedType === 'POS' ? 'Counter POS Machine' : (normalizedType === 'CONTACT' ? 'Contact Message' : 'General Inquiry')));
        const prefix = dbType === 'LOAN' ? 'LN' : (dbType === 'FRANCHISE' ? 'FR' : 'INQ');
        const inqId = `${prefix}-${Math.floor(1000 + Math.random() * 9000)}`;

        const insertRes = await pgQuery(`
          INSERT INTO inquiries (id, type, name, phone, merchant_id, amount, category, location, remarks, status)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'New')
          RETURNING *
        `, [inqId, dbType, name.trim(), phone.trim(), merchant_id || null, amount || 'N/A', displayCategory, location || 'Hyderabad / Telangana', remarks || '']);

        return sendJson(res, 200, {
          success: true,
          message: 'Application submitted successfully!',
          inquiry: insertRes[0]
        });
      } catch (err) {
        return sendJson(res, 500, { success: false, message: err.message });
      }
    }

    if (pathname === '/api/inquiries/update-status' && method === 'POST') {
      try {
        const { inquiryId, status, remarks } = await parseJsonBody(req);
        if (!inquiryId || !status) {
          return sendJson(res, 400, { success: false, message: 'inquiryId and status are required.' });
        }

        const updateRes = await pgQuery(`
          UPDATE inquiries 
          SET status = $1, remarks = COALESCE($2, remarks), updated_at = CURRENT_TIMESTAMP
          WHERE id = $3
          RETURNING *
        `, [status, remarks || null, inquiryId]);

        if (updateRes.length === 0) {
          return sendJson(res, 404, { success: false, message: 'Inquiry not found.' });
        }

        return sendJson(res, 200, {
          success: true,
          message: `Inquiry marked as ${status}.`,
          inquiry: updateRes[0]
        });
      } catch (err) {
        return sendJson(res, 500, { success: false, message: err.message });
      }
    }

    // ----------------------------------------------------
    // 0.9 CHANNEL PORTFOLIO UPDATE
    // ----------------------------------------------------
    if (pathname === '/api/channels/update' && method === 'POST') {
      try {
        const { merchantId, channels, adminId } = await parseJsonBody(req);
        if (!merchantId || !channels) {
          return sendJson(res, 400, { success: false, message: 'merchantId and channels are required.' });
        }

        await withTransaction(async (client) => {
          const userRes = await client.query(`SELECT id, creator_id FROM users WHERE UPPER(id) = UPPER($1)`, [merchantId.trim()]);
          if (userRes.rows.length === 0) {
            throw new Error(`Merchant not found.`);
          }
          const user = userRes.rows[0];
          const parentId = user.creator_id;

          const pine = channels.pine_labs;
          const swiff = channels.payswiff;
          const qr = channels.qr;

          if (pine && pine.enabled) {
            const t1Bps = Math.round(parseFloat(pine.rate_t1 || 0) * 100);
            const instBps = Math.round(parseFloat(pine.rate_instant || pine.rate_t1 || 0) * 100);
            await validateChildParentRates(client, { parentId, channel: 'pinelabs', settlementMode: 'T1', childRateBps: t1Bps });
            await validateChildParentRates(client, { parentId, channel: 'pinelabs', settlementMode: 'INSTANT', childRateBps: instBps });
            await setUserRate(client, { userId: user.id, channel: 'pinelabs', settlementMode: 'T1', rateBps: t1Bps });
            await setUserRate(client, { userId: user.id, channel: 'pinelabs', settlementMode: 'INSTANT', rateBps: instBps });
          }
          if (swiff && swiff.enabled) {
            const t1Bps = Math.round(parseFloat(swiff.rate_t1 || 0) * 100);
            const instBps = Math.round(parseFloat(swiff.rate_instant || swiff.rate_t1 || 0) * 100);
            await validateChildParentRates(client, { parentId, channel: 'payswiff', settlementMode: 'T1', childRateBps: t1Bps });
            await validateChildParentRates(client, { parentId, channel: 'payswiff', settlementMode: 'INSTANT', childRateBps: instBps });
            await setUserRate(client, { userId: user.id, channel: 'payswiff', settlementMode: 'T1', rateBps: t1Bps });
            await setUserRate(client, { userId: user.id, channel: 'payswiff', settlementMode: 'INSTANT', rateBps: instBps });
          }
          if (qr && qr.enabled) {
            const qrBps = Math.round(parseFloat(qr.rate || qr.rate_instant || qr.rate_t1 || 0) * 100);
            await validateChildParentRates(client, { parentId, channel: 'qr', settlementMode: 'NONE', childRateBps: qrBps });
            await setUserRate(client, { userId: user.id, channel: 'qr', settlementMode: 'NONE', rateBps: qrBps });
          }

          const fullTerminalStr = `[PORTFOLIO]${JSON.stringify(channels)}`;
          let primaryProvider = 'Pine Labs';
          let primaryVendor = 'Rose Navaneetham Enterprises';
          let primaryRateT1 = 0;
          let primaryRateInstant = 0;

          if (pine && pine.enabled) {
            primaryProvider = 'Pine Labs';
            primaryVendor = 'Rose Navaneetham Enterprises';
            primaryRateT1 = parseFloat(pine.rate_t1 || 0);
            primaryRateInstant = parseFloat(pine.rate_instant || primaryRateT1);
          } else if (swiff && swiff.enabled) {
            primaryProvider = 'Payswiff';
            primaryVendor = swiff.vendor === 'R.P. Technologies' ? 'R.P. Technologies' : 'RONAV Technologies';
            primaryRateT1 = parseFloat(swiff.rate_t1 || 0);
            primaryRateInstant = parseFloat(swiff.rate_instant || primaryRateT1);
          } else if (qr && qr.enabled) {
            primaryProvider = 'Company QR (UPI)';
            primaryVendor = 'RONAV Technologies';
            primaryRateT1 = parseFloat(qr.rate_instant || 0);
            primaryRateInstant = primaryRateT1;
          }

          await client.query(`
            INSERT INTO merchant_pos (
              merchant_id, provider, terminal_id, commission_rate, assigned_by,
              vendor_entity, commission_rate_t1, commission_rate_instant
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            ON CONFLICT (merchant_id) DO UPDATE SET
              provider = EXCLUDED.provider,
              terminal_id = EXCLUDED.terminal_id,
              commission_rate = EXCLUDED.commission_rate,
              vendor_entity = EXCLUDED.vendor_entity,
              commission_rate_t1 = EXCLUDED.commission_rate_t1,
              commission_rate_instant = EXCLUDED.commission_rate_instant,
              updated_at = CURRENT_TIMESTAMP
          `, [
            user.id, primaryProvider, fullTerminalStr, primaryRateT1, adminId || 'ADM001',
            primaryVendor, primaryRateT1, primaryRateInstant
          ]);

          await client.query(`
            UPDATE users SET
              commission_rate_t1 = $1,
              commission_rate_instant = $2,
              updated_at = CURRENT_TIMESTAMP
            WHERE UPPER(id) = UPPER($3)
          `, [primaryRateT1, primaryRateInstant, user.id]);
        });

        return sendJson(res, 200, { success: true, message: 'Channels updated successfully!' });
      } catch (err) {
        if (
          err.message && (
            err.message.includes('INVALID_RATE_HIERARCHY') ||
            err.message.includes('PARENT_CHANNEL_MISSING') ||
            err.message.includes('PARENT_MODE_MISSING') ||
            err.message.includes('INVALID_RATE_VALUE')
          )
        ) {
          return sendJson(res, 400, { success: false, message: err.message });
        }
        return sendJson(res, 500, { success: false, message: err.message });
      }
    }
    if (pathname === '/api/auth/login' && method === 'POST') {
      const { id, password } = await parseJsonBody(req);
      let cleanId = (id || '').toString().trim();
      const cleanPass = (password || '').toString().trim();

      if (!cleanId) {
        return sendJson(res, 400, { success: false, message: 'Please enter your User ID.' });
      }

      if (cleanId.toLowerCase() === 'admin' || cleanId.toUpperCase() === 'ADM001') {
        cleanId = 'ADM001';
      }

      // Explicitly reject pure 10-digit mobile numbers
      if (/^\d{10}$/.test(cleanId)) {
        return sendJson(res, 400, { 
          success: false, 
          message: 'Access Denied: Mobile number login is disabled. Please login using your assigned User ID (e.g. ADM001, MST..., SD..., DIST..., MID...).' 
        });
      }

      // Query by User ID from PostgreSQL
      const users = await pgQuery(`SELECT * FROM users WHERE UPPER(id) = UPPER($1)`, [cleanId]);
      const user = users[0] || null;

      if (!user) {
        return sendJson(res, 404, { 
          success: false, 
          message: `User ID "${cleanId}" not found. Please verify your assigned User ID.` 
        });
      }

      const expectedPassword = (user.password || '').trim();
      if (!expectedPassword || cleanPass !== expectedPassword) {
        return sendJson(res, 401, { 
          success: false, 
          message: 'Incorrect password. Please verify your credentials.' 
        });
      }

      const pool = getDbPool();
      const balances = await getWalletBalances(pool, user.id);
      const posList = await pgQuery(`SELECT * FROM merchant_pos WHERE merchant_id = $1`, [user.id]);
      const channelBalances = await calculateUserChannelBalances(user.id);

      const activeWallet = {
        user_id: user.id,
        balance_paise: balances.balance_paise.toString(),
        held_paise: balances.held_paise.toString(),
        available_balance: Number(balances.available_balance_paise) / 100,
        withdrawable_balance: Number(balances.withdrawable_balance_paise) / 100,
        available_balance_paise: balances.available_balance_paise.toString(),
        reserve_locked_paise: balances.reserve_locked_paise.toString(),
        withdrawable_balance_paise: balances.withdrawable_balance_paise.toString(),
        total_sales: Number(balances.balance_paise) / 100,
        received_sales: Number(balances.balance_paise) / 100,
        pending_balance: Number(balances.held_paise) / 100,
        channel_balances: channelBalances
      };

      return sendJson(res, 200, {
        success: true,
        user,
        wallet: activeWallet,
        pos: posList[0] || null
      });
    }

    // List all users in hierarchy
    if (pathname === '/api/users' && method === 'GET') {
      const users = await pgQuery(`
        SELECT u.*, 
               p.provider AS pos_provider, 
               p.terminal_id AS pos_terminal, 
               p.commission_rate AS pos_rate,
               p.vendor_entity AS pos_vendor,
               p.device_plan AS pos_plan,
               p.monthly_rent AS pos_rent,
               p.settlement_type AS pos_settlement,
               p.instant_surcharge AS pos_instant_fee,
               c.name AS creator_name,
               c.role AS creator_role,
               COALESCE((w.balance_paise - w.held_paise) / 100.0, 0) as available_balance,
               COALESCE(w.balance_paise / 100.0, 0) as total_sales,
               COALESCE(w.held_paise / 100.0, 0) as pending_balance,
               COALESCE(w.balance_paise / 100.0, 0) as received_sales,
               COALESCE(w.withdrawn_paise / 100.0, 0) as withdrawn_amount,
               w.balance_paise,
               w.held_paise
        FROM users u
        LEFT JOIN merchant_pos p ON u.id = p.merchant_id
        LEFT JOIN users c ON u.creator_id = c.id
        LEFT JOIN wallets w ON u.id = w.user_id
        ORDER BY u.created_at DESC
      `);

      return sendJson(res, 200, { success: true, users });
    }

    // Comprehensive Hierarchy Tree with Roll-Up Metrics
    if (pathname === '/api/hierarchy/tree' && method === 'GET') {
      const users = await pgQuery(`
        SELECT u.*, 
               p.provider AS pos_provider, 
               p.terminal_id AS pos_terminal, 
               p.commission_rate AS pos_rate,
               p.vendor_entity AS pos_vendor,
               p.device_plan AS pos_plan,
               p.monthly_rent AS pos_rent,
               p.settlement_type AS pos_settlement,
               p.instant_surcharge AS pos_instant_fee,
               c.name AS creator_name,
               c.role AS creator_role,
               COALESCE((w.balance_paise - w.held_paise) / 100.0, 0) as available_balance,
               COALESCE(w.balance_paise / 100.0, 0) as total_sales,
               COALESCE(w.held_paise / 100.0, 0) as pending_balance,
               COALESCE(w.balance_paise / 100.0, 0) as received_sales,
               COALESCE(w.withdrawn_paise / 100.0, 0) as withdrawn_amount,
               w.balance_paise,
               w.held_paise
        FROM users u
        LEFT JOIN merchant_pos p ON u.id = p.merchant_id
        LEFT JOIN users c ON u.creator_id = c.id
        LEFT JOIN wallets w ON u.id = w.user_id
        ORDER BY u.created_at ASC
      `);

      const txCounts = await pgQuery(`
        SELECT merchant_id, COUNT(*) as txn_count, COALESCE(SUM(amount), 0) as total_txn_volume
        FROM transactions
        GROUP BY merchant_id
      `);
      const txMap = {};
      txCounts.forEach(t => {
        txMap[t.merchant_id] = t;
      });

      const enriched = users.map(u => ({
        ...u,
        txn_count: txMap[u.id]?.txn_count || 0,
        total_txn_volume: txMap[u.id]?.total_txn_volume || 0
      }));

      const masterDistributors = enriched.filter(u => u.role === 'MASTER' || u.role === 'MASTER_DISTRIBUTOR' || (u.id && u.id.startsWith('MST')));
      const superDistributors = enriched.filter(u => (u.role === 'SUPER_DISTRIBUTOR') && !(u.id && u.id.startsWith('MST')) && u.role !== 'MASTER');
      const districtDistributors = enriched.filter(u => u.role === 'DISTRICT_DISTRIBUTOR' || u.role === 'DIST_FRANCHISE' || (u.id && (u.id.startsWith('DD') || u.id.startsWith('DF'))));
      const distributors = enriched.filter(u => u.role === 'DISTRIBUTOR' && !(u.id && (u.id.startsWith('DD') || u.id.startsWith('DF'))));
      const merchants = enriched.filter(u => u.role === 'MERCHANT');

      const merchantsByParent = {};
      merchants.forEach(m => {
        const pId = m.creator_id || 'DIRECT';
        if (!merchantsByParent[pId]) merchantsByParent[pId] = [];
        merchantsByParent[pId].push(m);
      });

      const enrichedDistributors = distributors.map(d => {
        const downlineMerchants = merchantsByParent[d.id] || [];
        const downlineVolume = downlineMerchants.reduce((sum, m) => sum + (parseFloat(m.total_sales) || 0), 0);
        return {
          ...d,
          merchants: downlineMerchants,
          merchant_count: downlineMerchants.length,
          downline_volume: downlineVolume
        };
      });

      const enrichedDistrictDistributors = districtDistributors.map(dd => {
        const directDists = enrichedDistributors.filter(d => d.creator_id === dd.id);
        const directMerchants = merchantsByParent[dd.id] || [];
        
        let totalStores = directMerchants.length;
        let totalVol = directMerchants.reduce((sum, m) => sum + (parseFloat(m.total_sales) || 0), 0);
        
        directDists.forEach(d => {
          totalStores += d.merchant_count;
          totalVol += d.downline_volume;
        });

        return {
          ...dd,
          distributors: directDists,
          distributor_count: directDists.length,
          total_merchant_count: totalStores,
          downline_volume: totalVol
        };
      });

      const enrichedSDs = superDistributors.map(sd => {
        const childDDs = enrichedDistrictDistributors.filter(dd => dd.creator_id === sd.id);
        const directDists = enrichedDistributors.filter(d => d.creator_id === sd.id);
        const directMerchants = merchantsByParent[sd.id] || [];
        
        let totalMerchantsInSD = directMerchants.length;
        let totalVolumeInSD = directMerchants.reduce((sum, m) => sum + (parseFloat(m.total_sales) || 0), 0);

        childDDs.forEach(dd => {
          totalMerchantsInSD += dd.total_merchant_count;
          totalVolumeInSD += dd.downline_volume;
        });

        directDists.forEach(d => {
          totalMerchantsInSD += d.merchant_count;
          totalVolumeInSD += d.downline_volume;
        });

        return {
          ...sd,
          district_distributors: childDDs,
          distributors: directDists,
          direct_merchants: directMerchants,
          district_count: childDDs.length,
          distributor_count: directDists.length,
          total_merchant_count: totalMerchantsInSD,
          network_volume: totalVolumeInSD
        };
      });

      const enrichedMasters = masterDistributors.map(m => {
        const childSDs = enrichedSDs.filter(sd => sd.creator_id === m.id || sd.parent_id === m.id);
        const childDDs = childSDs.flatMap(sd => sd.district_distributors || enrichedDistrictDistributors.filter(dd => dd.creator_id === sd.id || dd.parent_id === sd.id));
        const childDists = childDDs.flatMap(dd => dd.distributors || enrichedDistributors.filter(d => d.creator_id === dd.id || d.parent_id === dd.id));
        const allMerchants = childDists.flatMap(d => d.merchants || merchants.filter(mer => mer.creator_id === d.id || mer.parent_id === d.id));
        
        const totalMerchantsInMaster = allMerchants.length;
        const totalVolumeInMaster = allMerchants.reduce((sum, mer) => sum + (parseFloat(mer.total_sales) || 0), 0);

        return {
          ...m,
          super_distributors: childSDs,
          super_distributor_count: childSDs.length,
          total_merchant_count: totalMerchantsInMaster,
          network_volume: totalVolumeInMaster
        };
      });

      const totalNetworkTurnover = merchants.reduce((sum, m) => sum + (parseFloat(m.total_sales) || 0), 0);
      const pineTerminals = merchants.filter(m => (m.pos_provider || '').toLowerCase().includes('pine')).length;
      const payswiffTerminals = merchants.filter(m => (m.pos_provider || '').toLowerCase().includes('payswiff')).length;

      return sendJson(res, 200, {
        success: true,
        tree: {
          masterDistributors: enrichedMasters,
          superDistributors: enrichedSDs,
          districtDistributors: enrichedDistrictDistributors,
          distributors: enrichedDistributors,
          merchants: merchants
        },
        flatUsers: enriched,
        summary: {
          totalMasterDistributors: masterDistributors.length,
          totalSuperDistributors: superDistributors.length,
          totalDistrictDistributors: districtDistributors.length,
          totalDistributors: distributors.length,
          totalMerchants: merchants.length,
          totalTerminals: pineTerminals + payswiffTerminals,
          pineTerminals,
          payswiffTerminals,
          totalNetworkTurnover
        }
      });
    }


    // ----------------------------------------------------
    // 3. TRANSACTIONS & AUTHORITATIVE COMMISSION RECORDING
    // ----------------------------------------------------
    if (pathname === '/api/transactions/record' && method === 'POST') {
      const body = await parseJsonBody(req);
      req.body = body;
      const idempotencyKey = req.headers['idempotency-key'] || body.idempotency_key || null;

      const merchantId = body.merchant_id || body.merchantId;
      const rawAmount = body.amount_paise !== undefined ? body.amount_paise : body.amount;

      if (!merchantId || rawAmount === undefined || rawAmount === null) {
        return sendJson(res, 400, { success: false, message: 'Merchant ID and Amount are required.' });
      }

      let amountPaise;
      try {
        if (body.amount_paise !== undefined) {
          amountPaise = BigInt(body.amount_paise);
        } else {
          const num = Number(body.amount);
          if (isNaN(num) || num <= 0) {
            return sendJson(res, 400, { success: false, message: 'Amount must be a positive number.' });
          }
          amountPaise = BigInt(Math.round(num * 100));
        }
      } catch (e) {
        return sendJson(res, 400, { success: false, message: 'Invalid amount.' });
      }

      if (amountPaise <= 0n) {
        return sendJson(res, 400, { success: false, message: 'Amount must be a positive number.' });
      }

      const caller = getCaller(req);
      const createdBy = caller?.id || merchantId;

      const rawMode = body.settlement_type || body.settlementType || body.settlement_mode || body.settlementMode || null;
      const cleanChannel = (body.channel || body.provider || 'pinelabs').toLowerCase().replace(/[^a-z0-9]/g, '');
      let settlementMode = rawMode ? String(rawMode).toUpperCase().trim() : null;

      if (cleanChannel === 'qr' || cleanChannel === 'companyqr') {
        if (settlementMode && settlementMode !== 'NONE') {
          return sendJson(res, 400, { success: false, message: 'INVALID_SETTLEMENT_MODE: QR channel must have settlement mode NONE.' });
        }
        settlementMode = 'NONE';
      } else if (cleanChannel === 'pinelabs' || cleanChannel === 'payswiff') {
        if (!settlementMode) {
          return sendJson(res, 400, { success: false, message: `SETTLEMENT_MODE_REQUIRED: Channel "${cleanChannel}" requires settlement_type (T1 or INSTANT).` });
        }
        if (settlementMode !== 'T1' && settlementMode !== 'INSTANT') {
          return sendJson(res, 400, { success: false, message: `INVALID_SETTLEMENT_MODE: Settlement mode must be T1 or INSTANT for channel "${cleanChannel}".` });
        }
      }

      const pool = getDbPool();
      const client = await pool.connect();
      try {
        const result = await processSwipeTransaction(client, {
          merchantId: merchantId.trim(),
          amountPaise,
          channel: cleanChannel,
          settlementMode,
          refNumber: body.ref_number || body.refNumber || null,
          slipNumber: body.slip_number || body.slipNumber || null,
          notes: body.notes || null,
          idempotencyKey,
          createdBy
        });

        const serializable = {
          ...result,
          amount_paise: result.amount_paise?.toString(),
          customer_charge_paise: result.customer_charge_paise?.toString(),
          net_amount_paise: result.net_amount_paise?.toString(),
          distributions: result.distributions?.map(d => ({
            ...d,
            amount_paise: d.amount_paise?.toString()
          }))
        };

        return sendJson(res, 200, {
          success: true,
          message: 'Transaction recorded and routed through Phase B ledger engine.',
          transaction: serializable
        });
      } catch (err) {
        if (err.message?.includes('DUPLICATE_SWIPE')) {
          return sendJson(res, 409, { success: false, message: err.message });
        }
        if (err.message?.includes('USER_NOT_FOUND')) {
          return sendJson(res, 404, { success: false, message: err.message });
        }
        if (
          err.message?.includes('INVALID_RATE_HIERARCHY') || 
          err.message?.includes('RATE_NOT_CONFIGURED') ||
          err.message?.includes('INVALID_SETTLEMENT_MODE') ||
          err.message?.includes('SETTLEMENT_MODE_REQUIRED')
        ) {
          return sendJson(res, 400, { success: false, message: err.message });
        }
        return sendJson(res, 500, { success: false, message: err.message });
      } finally {
        client.release();
      }
    }

    if (pathname.startsWith('/api/transactions/merchant/') && method === 'GET') {
      const merchantId = pathname.replace('/api/transactions/merchant/', '').trim();

      // 1. Direct transactions for this merchant ID
      const directTxns = await pgQuery(`
        SELECT t.*, u.name as originating_merchant_name, u.id as originating_merchant_id
        FROM transactions t
        LEFT JOIN users u ON UPPER(u.id) = UPPER(t.merchant_id)
        WHERE UPPER(t.merchant_id) = UPPER($1)
        ORDER BY t.created_at DESC
      `, [merchantId]);

      // 2. Card swipe transactions with commission splits for this distributor / upline
      const uplineRows = await pgQuery(`
        SELECT t.*, u.name as originating_merchant_name, u.id as originating_merchant_id
        FROM transactions t
        LEFT JOIN users u ON UPPER(u.id) = UPPER(t.merchant_id)
        WHERE t.notes ILIKE '%commission_splits%' 
          AND t.notes ILIKE '%' || $1 || '%'
          AND UPPER(t.merchant_id) != UPPER($1)
        ORDER BY t.created_at DESC
      `, [merchantId]);

      const commissionEntries = [];
      for (const row of uplineRows) {
        try {
          const notesStr = row.notes || '';
          const metaJsonStr = notesStr.replace(/^\[CARD_SWIPE_ENTRY\]\s*/, '');
          const meta = JSON.parse(metaJsonStr);
          if (Array.isArray(meta.commission_splits)) {
            const split = meta.commission_splits.find(s => (s.user_id || '').toUpperCase() === merchantId.toUpperCase());
            if (split) {
              const commEarned = parseFloat(split.amount || 0);
              const saleAmt = parseFloat(row.amount || 0);
              let commPct = 0;
              if (split.margin_diff !== undefined && split.margin_diff !== null) {
                commPct = parseFloat(split.margin_diff);
              } else if (split.rate !== undefined && split.rate !== null) {
                commPct = parseFloat(split.rate);
              } else if (saleAmt > 0 && commEarned > 0) {
                commPct = parseFloat(((commEarned / saleAmt) * 100).toFixed(2));
              }

              commissionEntries.push({
                id: `COMM-${row.id}-${merchantId}`,
                original_txn_id: row.id,
                activityType: 'COMMISSION_EARNED',
                is_commission: true,
                type: 'COMMISSION_EARNED',
                originating_merchant_name: row.originating_merchant_name || 'Retail Merchant Store',
                originating_merchant_id: row.originating_merchant_id || row.merchant_id || 'MID1001',
                sale_amount: saleAmt,
                amount: commEarned,
                commission_earned: commEarned,
                commission_percentage: commPct,
                created_at: row.created_at,
                status: 'APPROVED',
                notes: row.notes
              });
            }
          }
        } catch (_) {}
      }

      const allTxns = [...directTxns, ...commissionEntries].sort((a, b) => {
        return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
      });

      return sendJson(res, 200, { success: true, transactions: allTxns });
    }

    // ----------------------------------------------------
    // BENEFICIARY BANK ACCOUNTS
    // ----------------------------------------------------
    if (pathname.startsWith('/api/beneficiaries/') && method === 'GET') {
      const merchantId = pathname.replace('/api/beneficiaries/', '');
      const beneficiaries = await pgQuery(`
        SELECT * FROM beneficiaries 
        WHERE merchant_id = $1 
        ORDER BY is_primary DESC, created_at DESC
      `, [merchantId]);

      return sendJson(res, 200, { success: true, beneficiaries });
    }

    if (pathname === '/api/beneficiaries/add' && method === 'POST') {
      const { merchant_id, bank_name, account_number, ifsc, holder_name, is_primary } = await parseJsonBody(req);

      if (!merchant_id || !bank_name || !account_number || !account_number.trim() || !ifsc || !ifsc.trim()) {
        return sendJson(res, 400, { success: false, message: 'Missing required bank details (merchant_id, bank_name, account_number, ifsc).' });
      }

      const benId = `BEN-${Date.now().toString().slice(-6)}`;
      await pgQuery(`
        INSERT INTO beneficiaries (id, merchant_id, bank_name, account_number, ifsc, holder_name, is_primary)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [benId, merchant_id, bank_name, account_number.trim(), ifsc.trim().toUpperCase(), holder_name || 'Account Holder', is_primary ? 1 : 0]);

      const created = await pgQuery(`SELECT * FROM beneficiaries WHERE id = $1`, [benId]);
      return sendJson(res, 201, { success: true, message: 'Beneficiary account added successfully!', beneficiary: created[0] });
    }

    // ----------------------------------------------------
    // 4. ADMIN VERIFICATION & APPROVAL ENGINE
    // ----------------------------------------------------
    if (pathname === '/api/admin/pending' && method === 'GET') {
      const pendingTransactions = await pgQuery(`
        SELECT t.*, u.name as merchant_name, u.mobile as merchant_mobile, COALESCE(t.provider, p.provider, CASE WHEN t.type = 'QR_SCAN' THEN 'Company QR (UPI)' WHEN t.type = 'BBPS_BILL' THEN 'BBPS' ELSE 'Pine Labs' END) as pos_provider, p.commission_rate as pos_rate
        FROM transactions t
        JOIN users u ON t.merchant_id = u.id
        LEFT JOIN merchant_pos p ON t.merchant_id = p.merchant_id
        WHERE t.status = 'PENDING'
        ORDER BY t.created_at DESC
      `);

      const pendingWithdrawals = await pgQuery(`
        SELECT w.*, u.name as merchant_name, u.mobile as merchant_mobile
        FROM withdrawals w
        JOIN users u ON w.merchant_id = u.id
        WHERE w.status = 'PENDING'
        ORDER BY w.created_at DESC
      `);

      const allTransactions = await pgQuery(`
        SELECT t.*, u.name as merchant_name, COALESCE(t.provider, p.provider, CASE WHEN t.type = 'QR_SCAN' THEN 'Company QR (UPI)' WHEN t.type = 'BBPS_BILL' THEN 'BBPS' ELSE 'Pine Labs' END) as pos_provider
        FROM transactions t
        JOIN users u ON t.merchant_id = u.id
        LEFT JOIN merchant_pos p ON t.merchant_id = p.merchant_id
        ORDER BY t.created_at DESC
        LIMIT 100
      `);

      const allApprovedTxns = await pgQuery(`
        SELECT t.*, COALESCE(t.provider, CASE WHEN t.type = 'QR_SCAN' THEN 'Company QR (UPI)' WHEN t.type = 'BBPS_BILL' THEN 'BBPS' ELSE 'Pine Labs' END) as pos_provider
        FROM transactions t
        WHERE t.status = 'APPROVED'
      `);

      let pineVol = 0;
      let pineCnt = 0;
      let payswiffVol = 0;
      let payswiffCnt = 0;
      let qrVol = 0;
      let qrCnt = 0;
      let totalAdminProfit = 0;

      allApprovedTxns.forEach(t => {
        const amt = parseFloat(t.amount) || 0;
        const p = (t.provider || '').toLowerCase();
        let fee = 0;
        if (t.notes && typeof t.notes === 'string' && t.notes.includes('[CARD_SWIPE_ENTRY]')) {
          try {
            const jsonPart = t.notes.slice(t.notes.indexOf('{'));
            const meta = JSON.parse(jsonPart);
            fee = parseFloat(meta.company_fee) || 0;
          } catch (_) {}
        }

        if (p.includes('swiff') || (t.id && t.id.startsWith('TXN-SW-'))) {
          payswiffVol += amt;
          payswiffCnt++;
          totalAdminProfit += fee > 0 ? fee : (amt * 0.0010);
        } else if (p.includes('qr') || p.includes('upi') || (t.id && t.id.startsWith('TXN-QR-'))) {
          qrVol += amt;
          qrCnt++;
          totalAdminProfit += fee > 0 ? fee : (amt * 0.0030);
        } else {
          pineVol += amt;
          pineCnt++;
          totalAdminProfit += fee > 0 ? fee : (amt * 0.0015);
        }
      });

      const mCount = (await pgQuery(`SELECT COUNT(*) as c FROM users WHERE role = 'MERCHANT'`))[0]?.c || 0;
      const sdCount = (await pgQuery(`SELECT COUNT(*) as c FROM users WHERE role = 'SUPER_DISTRIBUTOR'`))[0]?.c || 0;
      const dCount = (await pgQuery(`SELECT COUNT(*) as c FROM users WHERE role IN ('DISTRIBUTOR', 'DISTRICT_DISTRIBUTOR', 'DIST_FRANCHISE')`))[0]?.c || 0;
      const totalVol = (await pgQuery(`SELECT COALESCE(SUM(amount), 0) as s FROM transactions WHERE status = 'APPROVED'`))[0]?.s || 0;
      const pendingVol = (await pgQuery(`SELECT COALESCE(SUM(amount), 0) as s FROM transactions WHERE status = 'PENDING'`))[0]?.s || 0;

      const stats = {
        totalMerchants: parseInt(mCount),
        totalSuperDistributors: parseInt(sdCount),
        totalDistributors: parseInt(dCount),
        withdrawalsCount: pendingWithdrawals.length,
        pendingWithdrawalsCount: pendingWithdrawals.length,
        totalVolume: parseFloat(totalVol),
        pendingVolume: parseFloat(pendingVol),
        adminNetProfit: parseFloat(totalAdminProfit.toFixed(2)),
        pineVolume: parseFloat(pineVol.toFixed(2)),
        payswiffVolume: parseFloat(payswiffVol.toFixed(2)),
        qrVolume: parseFloat(qrVol.toFixed(2))
      };

      return sendJson(res, 200, {
        success: true,
        pendingTransactions,
        pendingWithdrawals,
        allTransactions,
        stats
      });
    }

    // ----------------------------------------------------
    // 5. WITHDRAWALS & PAYOUT ENGINE (ACID Row-Locked)
    // ----------------------------------------------------
    if (pathname === '/api/withdrawals/request' && method === 'POST') {
      try {
        const body = await parseJsonBody(req);
        req.body = body;

        let merchantId = body.merchant_id || body.merchantId || body.userId;
        if (!merchantId) {
          try {
            merchantId = getCaller(req).id;
          } catch (_) {}
        }
        if (!merchantId) {
          return sendJson(res, 400, { success: false, message: 'Merchant ID is required.' });
        }

        const rawAmount = body.amount_paise !== undefined ? body.amount_paise : body.amount;
        if (rawAmount === undefined || rawAmount === null) {
          return sendJson(res, 400, { success: false, message: 'Withdrawal amount is required.' });
        }

        let amountPaise;
        try {
          if (body.amount_paise !== undefined) {
            amountPaise = BigInt(body.amount_paise);
          } else {
            const num = Number(body.amount);
            if (isNaN(num) || num <= 0) {
              return sendJson(res, 400, { success: false, message: 'Withdrawal amount must be a positive number.' });
            }
            amountPaise = BigInt(Math.round(num * 100));
          }
        } catch (e) {
          return sendJson(res, 400, { success: false, message: 'Invalid withdrawal amount.' });
        }

        if (amountPaise <= 0n) {
          return sendJson(res, 400, { success: false, message: 'Withdrawal amount must be a positive number.' });
        }

        const caller = getCaller(req);
        const createdBy = caller?.id || merchantId;
        const idempotencyKey = req.headers['idempotency-key'] || body.idempotency_key || null;

        const result = await withTransaction(async (client) => {
          return await processWithdrawalRequest(client, {
            merchantId: merchantId.trim(),
            amountPaise,
            beneficiaryId: body.beneficiary_id || body.beneficiaryId,
            channel: (body.channel || body.provider || 'pinelabs').toLowerCase(),
            settlementType: (body.settlement_type || body.settlementType || 'T1').toUpperCase(),
            idempotencyKey,
            createdBy
          });
        });

        return sendJson(res, 200, { success: true, withdrawal: result });
      } catch (err) {
        const status = err.message?.includes('RESERVE_VIOLATION') ? 403 : 400;
        return sendJson(res, status, { success: false, message: err.message });
      }
    }

    if (pathname === '/api/admin/verify-withdrawal' && method === 'POST') {
      const body = await parseJsonBody(req);
      req.body = body;
      const { withdrawal_id, withdrawalId, id, action: reqAction, remark, utr } = body;
      const targetWthId = (withdrawal_id || withdrawalId || id || '').toString().trim();
      const action = (reqAction || '').toUpperCase();
      if (!targetWthId || !action) {
        return sendJson(res, 400, { success: false, message: 'withdrawal_id and action are required.' });
      }

      try {
        let updatedWth = null;
        let caller = null;
        try {
          caller = getCaller(req);
        } catch (_) {
          caller = { id: body.adminId || body.admin_id || 'ADM001', role: 'ADMIN' };
        }

        await withTransaction(async (client) => {
          const wRows = (await client.query(`SELECT * FROM withdrawals WHERE id = $1 FOR UPDATE`, [targetWthId])).rows;
          const wth = wRows[0];
          if (!wth) {
            throw new Error('Withdrawal record not found.');
          }

          if (wth.status === 'COMPLETED' || wth.status === 'APPROVED') {
            throw new Error(`CANNOT_MODIFY_COMPLETED: Withdrawal is already ${wth.status} and cannot be modified.`);
          }
          if (wth.status === 'REJECTED') {
            throw new Error(`CANNOT_MODIFY_REJECTED: Withdrawal is already ${wth.status} and cannot be modified.`);
          }

          const amountPaise = BigInt(wth.amount_paise || Math.round(Number(wth.amount) * 100));

          if (action === 'APPROVE' || action === 'COMPLETE') {
            const cleanUtr = (utr || '').trim();
            if (!cleanUtr) {
              throw new Error('UTR_REQUIRED: A valid Bank UTR / Reference number is required to complete withdrawal.');
            }
            if (!/^[A-Za-z0-9_-]{6,50}$/.test(cleanUtr)) {
              throw new Error('INVALID_UTR_FORMAT: Bank UTR must be alphanumeric (6 to 50 characters).');
            }

            // Database uniqueness guard for completed UTR
            const dupCheck = await client.query(`
              SELECT id FROM withdrawals 
              WHERE UPPER(utr) = UPPER($1) 
                AND status IN ('COMPLETED', 'APPROVED') 
                AND id != $2
            `, [cleanUtr, targetWthId]);

            if (dupCheck.rows.length > 0) {
              throw new Error(`DUPLICATE_UTR: A completed withdrawal with UTR "${cleanUtr}" already exists (${dupCheck.rows[0].id}).`);
            }

            const existingRemark = wth.admin_remark || '';
            const finalRemark = cleanUtr 
              ? (existingRemark ? `${existingRemark} • Disbursed via IMPS (UTR: ${cleanUtr})` : `Disbursed via IMPS (UTR: ${cleanUtr})`)
              : (remark || existingRemark || 'Bank payout cleared via IMPS/NEFT');

            await postLedgerEntry(client, {
              userId: wth.merchant_id,
              type: 'withdrawal_paid',
              amountPaise: 0n,
              referenceId: targetWthId,
              referenceType: 'WITHDRAWAL',
              channel: wth.channel || 'pinelabs',
              metadata: {
                utr: cleanUtr,
                disbursed_paise: amountPaise.toString()
              },
              createdBy: caller.id
            });

            await client.query(`
              UPDATE wallets 
              SET withdrawn_paise = withdrawn_paise + $1,
                  updated_at = NOW()
              WHERE UPPER(user_id) = UPPER($2)
            `, [amountPaise.toString(), wth.merchant_id]);

            const wRes = await client.query(`
              UPDATE withdrawals 
              SET status = 'COMPLETED', 
                  utr = $1,
                  admin_remark = $2, 
                  verified_at = CURRENT_TIMESTAMP 
              WHERE id = $3
              RETURNING *
            `, [cleanUtr, finalRemark, targetWthId]);
            updatedWth = wRes.rows[0];
          } else if (action === 'REJECT') {
            await postLedgerEntry(client, {
              userId: wth.merchant_id,
              type: 'withdrawal_reversal',
              amountPaise: amountPaise,
              referenceId: targetWthId,
              referenceType: 'WITHDRAWAL',
              channel: wth.channel || 'pinelabs',
              metadata: {
                reason: remark || 'Bank account details mismatch / rejected'
              },
              createdBy: caller.id
            });

            const wRes = await client.query(`
              UPDATE withdrawals 
              SET status = 'REJECTED', 
                  admin_remark = $1, 
                  verified_at = CURRENT_TIMESTAMP 
              WHERE id = $2
              RETURNING *
            `, [remark || 'Bank account details mismatch / rejected', targetWthId]);
            updatedWth = wRes.rows[0];
          } else {
            throw new Error('Invalid action. Allowed: APPROVE, COMPLETE, REJECT.');
          }
        });

        const pool = getDbPool();
        const balances = await getWalletBalances(pool, updatedWth.merchant_id);

        return sendJson(res, 200, {
          success: true,
          message: `Withdrawal ${action === 'REJECT' ? 'Rejected' : 'Completed'}.`,
          withdrawal: updatedWth,
          balances
        });
      } catch (err) {
        return sendJson(res, 400, { success: false, message: err.message });
      }
    }

    // ----------------------------------------------------
    // 5.1 WITHDRAWALS READ & BATCH MANAGEMENT
    // ----------------------------------------------------
    if (pathname.startsWith('/api/withdrawals/merchant/') && method === 'GET') {
      const merchantId = decodeURIComponent(pathname.replace('/api/withdrawals/merchant/', '')).trim();
      const withdrawals = await pgQuery(`
        SELECT w.*, 
               COALESCE(w.amount, (w.amount_paise / 100.0)) as amount,
               COALESCE(w.settlement_type, 'T1') as withdrawal_mode
        FROM withdrawals w 
        WHERE UPPER(w.merchant_id) = UPPER($1) 
        ORDER BY w.created_at DESC
      `, [merchantId]);
      return sendJson(res, 200, { success: true, withdrawals });
    }

    if ((pathname === '/api/admin/withdrawals' || pathname === '/api/withdrawals') && method === 'GET') {
      const withdrawals = await pgQuery(`
        SELECT w.*, 
               COALESCE(w.amount, (w.amount_paise / 100.0)) as amount,
               u.name as merchant_name, 
               u.mobile as merchant_mobile,
               b.bank_name as ben_bank_name,
               b.account_number as ben_account_number,
               b.ifsc as ben_ifsc,
               b.holder_name as ben_holder_name,
               COALESCE(w.settlement_type, 'T1') as withdrawal_mode,
               (
                 SELECT t.settlement_mode 
                 FROM transactions t 
                 WHERE t.merchant_id = w.merchant_id 
                   AND t.channel = w.channel 
                   AND t.status != 'REVERSED'
                 ORDER BY t.created_at DESC 
                 LIMIT 1
               ) as swipe_mode
        FROM withdrawals w
        LEFT JOIN users u ON w.merchant_id = u.id
        LEFT JOIN beneficiaries b ON w.beneficiary_id = b.id
        ORDER BY w.created_at DESC
      `);

      const enriched = (withdrawals || []).map(w => {
        const wMode = (w.withdrawal_mode || w.settlement_type || 'T1').toUpperCase();
        const sMode = w.swipe_mode ? w.swipe_mode.toUpperCase() : null;
        const isMismatch = Boolean(sMode && wMode && sMode !== 'NONE' && sMode !== wMode);
        return {
          ...w,
          withdrawal_mode: wMode,
          settlement_type: wMode,
          swipe_mode: sMode,
          mismatch_flag: isMismatch
        };
      });

      return sendJson(res, 200, { success: true, withdrawals: enriched });
    }

    if (pathname === '/api/admin/withdrawals/export-excel' && method === 'POST') {
      try {
        const body = await parseJsonBody(req);
        req.body = body;
        const { withdrawalIds, batchTag, bankName } = body;
        let caller = null;
        try {
          caller = getCaller(req);
        } catch (_) {
          caller = { id: body.adminId || body.admin_id || 'ADM001', role: 'ADMIN' };
        }

        const result = await withTransaction(async (client) => {
          let rows;
          if (Array.isArray(withdrawalIds) && withdrawalIds.length > 0) {
            rows = (await client.query(`
              SELECT w.*, 
                     COALESCE(w.amount, (w.amount_paise / 100.0)) as amount,
                     u.name as merchant_name, 
                     u.mobile as merchant_mobile,
                     b.bank_name as ben_bank_name,
                     b.account_number as ben_account_number,
                     b.ifsc as ben_ifsc,
                     b.holder_name as ben_holder_name,
                     COALESCE(w.settlement_type, 'T1') as withdrawal_mode,
                     (
                       SELECT t.settlement_mode 
                       FROM transactions t 
                       WHERE t.merchant_id = w.merchant_id 
                         AND t.channel = w.channel 
                         AND t.status != 'REVERSED'
                       ORDER BY t.created_at DESC 
                       LIMIT 1
                     ) as swipe_mode
              FROM withdrawals w
              LEFT JOIN users u ON w.merchant_id = u.id
              LEFT JOIN beneficiaries b ON w.beneficiary_id = b.id
              WHERE w.id = ANY($1)
              FOR UPDATE OF w
            `, [withdrawalIds])).rows;
          } else {
            rows = (await client.query(`
              SELECT w.*, 
                     COALESCE(w.amount, (w.amount_paise / 100.0)) as amount,
                     u.name as merchant_name, 
                     u.mobile as merchant_mobile,
                     b.bank_name as ben_bank_name,
                     b.account_number as ben_account_number,
                     b.ifsc as ben_ifsc,
                     b.holder_name as ben_holder_name,
                     COALESCE(w.settlement_type, 'T1') as withdrawal_mode,
                     (
                       SELECT t.settlement_mode 
                       FROM transactions t 
                       WHERE t.merchant_id = w.merchant_id 
                         AND t.channel = w.channel 
                         AND t.status != 'REVERSED'
                       ORDER BY t.created_at DESC 
                       LIMIT 1
                     ) as swipe_mode
              FROM withdrawals w
              LEFT JOIN users u ON w.merchant_id = u.id
              LEFT JOIN beneficiaries b ON w.beneficiary_id = b.id
              WHERE w.status = 'PENDING'
              FOR UPDATE OF w
            `)).rows;
          }

          if (rows.length === 0) {
            throw new Error('NO_PENDING_WITHDRAWALS: No eligible pending withdrawals found for export.');
          }

          const alreadyExported = rows.filter(r => r.status !== 'PENDING');
          if (alreadyExported.length > 0) {
            const badIds = alreadyExported.map(r => `${r.id} (${r.status})`).join(', ');
            throw new Error(`ALREADY_EXPORTED: The following withdrawals are not in PENDING status: ${badIds}`);
          }

          const missingBankRows = rows.filter(r => !r.ben_account_number || !r.ben_account_number.trim() || !r.ben_ifsc || !r.ben_ifsc.trim());
          if (missingBankRows.length > 0) {
            const badIds = missingBankRows.map(r => r.id).join(', ');
            throw new Error(`MISSING_BANK_DETAILS: Cannot export withdrawals with missing account number or IFSC: ${badIds}`);
          }

          const batchId = `BATCH-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
          const selectedIds = rows.map(r => r.id);

          await client.query(`
            UPDATE withdrawals
            SET status = 'SUBMITTED_TO_BANK',
                batch_id = $1,
                submitted_to_bank_at = NOW()
            WHERE id = ANY($2)
          `, [batchId, selectedIds]);

          const csvHeaders = [
            'Sl No',
            'Merchant ID',
            'Merchant Name',
            'Merchant Mobile',
            'Beneficiary Name',
            'Account Number',
            'IFSC',
            'Bank Name',
            'Payout Amount',
            'Channel',
            'Withdrawal Mode',
            'Swipe Mode',
            'Mode Mismatch Flag',
            'Payout Ref ID',
            'Date'
          ];

          let totalAmountPaise = 0n;
          const csvLines = [csvHeaders.join(',')];

          const enriched = rows.map((r, idx) => {
            const wMode = (r.withdrawal_mode || r.settlement_type || 'T1').toUpperCase();
            const sMode = r.swipe_mode ? r.swipe_mode.toUpperCase() : 'UNKNOWN';
            const mismatch = Boolean(sMode && sMode !== 'UNKNOWN' && sMode !== 'NONE' && sMode !== wMode);
            const amtPaise = BigInt(r.amount_paise || Math.round(Number(r.amount) * 100));
            totalAmountPaise += amtPaise;
            const amtRupees = (Number(amtPaise) / 100).toFixed(2);

            const rowData = [
              idx + 1,
              `"${r.merchant_id || ''}"`,
              `"${(r.merchant_name || '').replace(/"/g, '""')}"`,
              `"${r.merchant_mobile || ''}"`,
              `"${(r.ben_holder_name || '').replace(/"/g, '""')}"`,
              `"${r.ben_account_number || ''}"`,
              `"${r.ben_ifsc || ''}"`,
              `"${(r.ben_bank_name || '').replace(/"/g, '""')}"`,
              amtRupees,
              r.channel || 'pinelabs',
              wMode,
              sMode,
              mismatch ? 'MISMATCH' : 'MATCH',
              r.id,
              new Date().toISOString()
            ];
            csvLines.push(rowData.join(','));

            return {
              ...r,
              status: 'SUBMITTED_TO_BANK',
              batch_id: batchId,
              withdrawal_mode: wMode,
              swipe_mode: sMode,
              mismatch_flag: mismatch
            };
          });

          const csvContent = csvLines.join('\n');

          await client.query(`
            INSERT INTO payout_batches (
              id, batch_tag, bank_name, total_payouts, total_amount_paise, csv_content, created_by, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
          `, [
            batchId,
            batchTag || null,
            bankName || null,
            rows.length,
            totalAmountPaise.toString(),
            csvContent,
            caller?.id || 'ADMIN'
          ]);

          return {
            batchId,
            exportedCount: rows.length,
            payouts: enriched,
            csv_content: csvContent
          };
        });

        return sendJson(res, 200, {
          success: true,
          message: `Successfully exported ${result.exportedCount} payout(s) to batch ${result.batchId}.`,
          ...result
        });
      } catch (err) {
        return sendJson(res, 400, { success: false, message: err.message });
      }
    }

    if (pathname.startsWith('/api/admin/withdrawals/batches/') || pathname.startsWith('/api/admin/withdrawals/batch/')) {
      const parts = pathname.split('/');
      const batchId = parts[parts.length - 1] === 'download' ? parts[parts.length - 2] : parts[parts.length - 1];
      const batchRes = await pgQuery(`SELECT * FROM payout_batches WHERE id = $1`, [batchId]);
      if (!batchRes || batchRes.length === 0) {
        return sendJson(res, 404, { success: false, message: `Batch ${batchId} not found.` });
      }
      return sendJson(res, 200, { success: true, batch: batchRes[0] });
    }

    if (pathname === '/api/admin/withdrawals/batch-status' && method === 'POST') {
      try {
        const { withdrawalIds, status, adminRemark, batchTag, batchNameTag, batchReference, bankName, action } = await parseJsonBody(req);
        if (!Array.isArray(withdrawalIds) || withdrawalIds.length === 0) {
          return sendJson(res, 400, { success: false, message: 'withdrawalIds array is required.' });
        }

        const idList = withdrawalIds.map(id => String(id));
        const timestamp = new Date().toISOString();

        const normalizedAction = (action || status || '').toUpperCase();
        if (normalizedAction === 'SUBMITTED_TO_BANK' || normalizedAction === 'SUBMIT_TO_BANK') {
          for (const wId of idList) {
            const current = (await pgQuery(`SELECT * FROM withdrawals WHERE UPPER(id) = UPPER($1)`, [wId]))[0];
            if (current) {
              if (current.status !== 'PENDING') {
                return sendJson(res, 400, { success: false, message: `Withdrawal ${wId} is already in status ${current.status}. Only PENDING can be submitted to bank.` });
              }
              const tagStr = batchTag || (batchReference ? `[BATCH:${batchReference}]` : '');
              const nameTagStr = batchNameTag || (bankName ? `[BATCH_NAME:${bankName}]` : '');
              const newRemark = `${tagStr} ${nameTagStr} ${current.admin_remark || ''}`.trim();
              await pgQuery(`
                UPDATE withdrawals 
                SET status = 'SUBMITTED_TO_BANK', admin_remark = $1, submitted_to_bank_at = $2
                WHERE UPPER(id) = UPPER($3)
              `, [newRemark || null, timestamp, wId]);
            }
          }
          return sendJson(res, 200, { success: true, message: `Successfully marked ${idList.length} payout(s) as Submitted to Bank!` });
        } else if (normalizedAction === 'REVERT_PENDING') {
          for (const wId of idList) {
            const current = (await pgQuery(`SELECT * FROM withdrawals WHERE UPPER(id) = UPPER($1)`, [wId]))[0];
            if (current) {
              if (current.status !== 'SUBMITTED_TO_BANK') {
                return sendJson(res, 400, { success: false, message: `Cannot revert withdrawal ${wId} from status ${current.status} to PENDING.` });
              }
              await pgQuery(`
                UPDATE withdrawals 
                SET status = 'PENDING', submitted_to_bank_at = NULL
                WHERE UPPER(id) = UPPER($2)
              `, [wId]);
            }
          }
          return sendJson(res, 200, { success: true, message: `Successfully reverted ${idList.length} payout(s) to Pending.` });
        } else {
          return sendJson(res, 400, { success: false, message: 'Invalid action. Allowed: SUBMITTED_TO_BANK, REVERT_PENDING.' });
        }
      } catch (err) {
        return sendJson(res, 500, { success: false, message: err.message });
      }
    }

    // ----------------------------------------------------
    // 5.2 TRANSACTIONS, POS & WALLETS BULK READS
    // ----------------------------------------------------
    if ((pathname === '/api/admin/transactions' || pathname === '/api/transactions') && method === 'GET') {
      const transactions = await pgQuery(`
        SELECT t.*, u.name as merchant_name, u.mobile as merchant_mobile,
               COALESCE(t.provider, p.provider, CASE WHEN t.type = 'QR_SCAN' THEN 'Company QR (UPI)' WHEN t.type = 'BBPS_BILL' THEN 'BBPS' ELSE 'Pine Labs' END) as pos_provider
        FROM transactions t
        LEFT JOIN users u ON t.merchant_id = u.id
        LEFT JOIN merchant_pos p ON t.merchant_id = p.merchant_id
        ORDER BY t.created_at DESC
      `);
      return sendJson(res, 200, { success: true, transactions });
    }

    if ((pathname === '/api/pos/all' || pathname === '/api/pos') && method === 'GET') {
      const pos = await pgQuery(`SELECT * FROM merchant_pos ORDER BY created_at DESC`);
      return sendJson(res, 200, { success: true, pos });
    }

    if (pathname.startsWith('/api/pos/merchant/') && method === 'GET') {
      const mId = decodeURIComponent(pathname.replace('/api/pos/merchant/', '')).trim();
      const pos = await pgQuery(`SELECT * FROM merchant_pos WHERE UPPER(merchant_id) = UPPER($1)`, [mId]);
      return sendJson(res, 200, { success: true, pos: pos[0] || null });
    }

    if ((pathname === '/api/wallets' || pathname === '/api/admin/wallets') && method === 'GET') {
      const wallets = await pgQuery(`SELECT * FROM wallets ORDER BY updated_at DESC`);
      return sendJson(res, 200, { success: true, wallets });
    }

    // ----------------------------------------------------
    // 6. INQUIRIES & SYSTEM SETTINGS
    // ----------------------------------------------------
    if (pathname === '/api/inquiries' && method === 'GET') {
      const inquiries = await pgQuery(`SELECT * FROM inquiries ORDER BY created_at DESC`);
      return sendJson(res, 200, { success: true, inquiries });
    }

    if (pathname.startsWith('/api/settings/config') && method === 'GET') {
      const configKey = decodeURIComponent(pathname.replace('/api/settings/config/', '').replace('/api/settings/config', '')).trim() || 'SYS-COMMISSION-PAYOUTS';
      const rows = await pgQuery(`SELECT * FROM inquiries WHERE UPPER(id) = UPPER($1)`, [configKey]);
      let value = null;
      let status = 'INACTIVE';
      if (rows.length > 0) {
        status = rows[0].status === 'ACTIVE' ? 'ACTIVE' : 'INACTIVE';
        try { value = JSON.parse(rows[0].remarks); } catch (_) { value = rows[0].remarks; }
      }
      return sendJson(res, 200, { success: true, key: configKey, status, enabled: status === 'ACTIVE', value });
    }

    if (pathname === '/api/settings/config' && method === 'POST') {
      try {
        const { key, value, status, enabled } = await parseJsonBody(req);
        if (!key) return sendJson(res, 400, { success: false, message: 'key is required.' });
        const cleanKey = key.trim().toUpperCase();
        let finalStatus = 'ACTIVE';
        if (status) {
          finalStatus = String(status).toUpperCase();
        } else if (enabled !== undefined) {
          finalStatus = enabled ? 'ACTIVE' : 'INACTIVE';
        } else if (value !== undefined) {
          finalStatus = (value === true || value === 'true' || value === 'ACTIVE') ? 'ACTIVE' : 'INACTIVE';
        }
        const valStr = typeof value === 'object' ? JSON.stringify(value) : (value !== undefined ? String(value) : finalStatus);
        
        await pgQuery(`
          INSERT INTO inquiries (id, type, name, phone, status, remarks)
          VALUES ($1, 'SYS_CONFIG', $1, '9966203053', $2, $3)
          ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, remarks = EXCLUDED.remarks
        `, [cleanKey, finalStatus, valStr]);

        return sendJson(res, 200, { 
          success: true, 
          message: `Configuration ${cleanKey} updated to ${finalStatus}`, 
          key: cleanKey, 
          status: finalStatus, 
          enabled: finalStatus === 'ACTIVE',
          value 
        });
      } catch (err) {
        return sendJson(res, 500, { success: false, message: err.message });
      }
    }

    // ----------------------------------------------------
    // AWS S3 STORAGE INTEGRATION
    // ----------------------------------------------------
    if (pathname === '/api/s3/status' && method === 'GET') {
      const status = await verifyS3Connection();
      return sendJson(res, status.success ? 200 : 500, status);
    }

    if (pathname === '/api/s3/presigned-url' && method === 'POST') {
      const { fileName, contentType, folder } = await parseJsonBody(req);
      if (!fileName) {
        return sendJson(res, 400, { success: false, message: 'fileName is required.' });
      }
      try {
        const presigned = await getPresignedUploadUrl(fileName, contentType, folder);
        return sendJson(res, 200, { success: true, ...presigned });
      } catch (err) {
        return sendJson(res, 500, { success: false, message: err.message });
      }
    }

    if (pathname === '/api/s3/upload-base64' && method === 'POST') {
      const { base64Data, fileName, contentType, folder } = await parseJsonBody(req);
      if (!base64Data || !fileName) {
        return sendJson(res, 400, { success: false, message: 'base64Data and fileName are required.' });
      }
      try {
        const cleanBase64 = base64Data.replace(/^data:([A-Za-z-+\/]+);base64,/, '');
        const buffer = Buffer.from(cleanBase64, 'base64');
        const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
        const key = `${folder || 'uploads'}/${Date.now()}-${safeName}`;
        const result = await uploadBufferToS3(buffer, key, contentType || 'application/octet-stream');
        return sendJson(res, 200, { success: true, ...result });
      } catch (err) {
        return sendJson(res, 500, { success: false, message: err.message });
      }
    }

    if (pathname === '/api/s3/media' && method === 'GET') {
      const merchantId = url.searchParams.get('merchant_id');
      const entityType = url.searchParams.get('entity_type');
      const media = await getMediaFiles(merchantId, entityType);
      return sendJson(res, 200, { success: true, media });
    }

    if (pathname === '/api/s3/delete' && method === 'POST') {
      const { key } = await parseJsonBody(req);
      if (!key) {
        return sendJson(res, 400, { success: false, message: 'Object key is required.' });
      }
      try {
        const result = await deleteS3Object(key);
        return sendJson(res, 200, { success: true, ...result });
      } catch (err) {
        return sendJson(res, 500, { success: false, message: err.message });
      }
    }



    // ----------------------------------------------------
    // ADMIN PURGE & DELETE (Pure PostgreSQL)
    // ----------------------------------------------------
    if (pathname === '/api/admin/users/purge-test-accounts') {
      return sendJson(res, 403, { 
        success: false, 
        error: 'ACCESS_DENIED',
        message: 'Bulk database purge endpoints are permanently disabled for production data safety.' 
      });
    }

    if (pathname === '/api/admin/users/delete' && method === 'POST') {
      try {
        const { userId } = await parseJsonBody(req);
        if (!userId || userId === 'ADM001') {
          return sendJson(res, 400, { success: false, message: 'Cannot delete Super Admin (ADM001).' });
        }
        await pgQuery(`
          DELETE FROM transactions WHERE merchant_id = $1;
          DELETE FROM wallets WHERE user_id = $1;
          DELETE FROM merchant_pos WHERE merchant_id = $1;
          DELETE FROM withdrawals WHERE merchant_id = $1;
          DELETE FROM beneficiaries WHERE merchant_id = $1;
          DELETE FROM users WHERE id = $1;
        `, [userId]);

        return sendJson(res, 200, { success: true, message: `Account ${userId} permanently deleted.` });
      } catch (err) {
        return sendJson(res, 500, { success: false, error: err.message });
      }
    }

    // ====================================================
    // PHASE B: AUTHORITATIVE MONEY SERVICES (SINGLE SOURCE OF TRUTH)
    // ====================================================

    // 1. Authoritative Wallet Balance
    if ((pathname === '/api/wallets/balance' || pathname === '/api/wallet/balance') && method === 'GET') {
      try {
        let callerId = url.searchParams.get('userId') || url.searchParams.get('merchantId');
        if (!callerId) {
          try {
            callerId = getCaller(req).id;
          } catch (_) {}
        }
        if (!callerId) {
          return sendJson(res, 400, { success: false, message: 'User ID is required to fetch balance.' });
        }

        const balances = await getWalletBalances(getDbPool(), callerId);
        return sendJson(res, 200, {
          success: true,
          balances: {
            user_id: balances.user_id,
            balance_paise: balances.balance_paise.toString(),
            held_paise: balances.held_paise.toString(),
            available_balance_paise: balances.available_balance_paise.toString(),
            reserve_locked_paise: balances.reserve_locked_paise.toString(),
            reserve_required_paise: balances.reserve_required_paise.toString(),
            withdrawable_balance_paise: balances.withdrawable_balance_paise.toString(),
            balance_rupees: (Number(balances.balance_paise) / 100).toFixed(2),
            withdrawable_rupees: (Number(balances.withdrawable_balance_paise) / 100).toFixed(2)
          }
        });
      } catch (err) {
        return sendJson(res, 500, { success: false, message: err.message });
      }
    }

    // 2. Authoritative Withdrawal Quote
    if (pathname === '/api/withdrawals/quote' && method === 'POST') {
      try {
        const body = await parseJsonBody(req);
        let userId = body.userId || body.merchant_id;
        if (!userId) {
          try {
            userId = getCaller(req).id;
          } catch (_) {}
        }
        if (!userId) {
          return sendJson(res, 400, { success: false, message: 'User ID is required.' });
        }

        const amountPaise = body.amount_paise 
          ? BigInt(body.amount_paise) 
          : BigInt(Math.round(parseFloat(body.amount) * 100));

        const quote = await quoteWithdrawal(getDbPool(), {
          userId,
          amountPaise,
          settlementType: body.settlement_type || 'T1',
          channel: body.channel || 'pinelabs'
        });

        return sendJson(res, 200, {
          success: true,
          quote: {
            user_id: quote.user_id,
            requested_amount_paise: quote.requested_amount_paise.toString(),
            fee_bps: quote.fee_bps,
            fee_paise: quote.fee_paise.toString(),
            net_payout_paise: quote.net_payout_paise.toString(),
            remaining_balance_paise: quote.remaining_balance_paise.toString(),
            reserve_required_paise: quote.reserve_required_paise.toString(),
            reserve_compliant: quote.reserve_compliant,
            shortfall_paise: quote.shortfall_paise.toString(),
            requested_amount_rupees: (Number(quote.requested_amount_paise) / 100).toFixed(2),
            fee_rupees: (Number(quote.fee_paise) / 100).toFixed(2),
            net_payout_rupees: (Number(quote.net_payout_paise) / 100).toFixed(2)
          }
        });
      } catch (err) {
        return sendJson(res, 400, { success: false, message: err.message });
      }
    }

    // 2.1 Dynamic System Settings Endpoint
    if (pathname === '/api/settings' && method === 'GET') {
      try {
        const pool = getDbPool();
        const settings = await getAllSettings(pool);
        return sendJson(res, 200, {
          success: true,
          settings: {
            ...settings,
            support_phone: '9966203053',
            support_email: 'rosenavaneethamenterprises@gmail.com'
          }
        });
      } catch (err) {
        return sendJson(res, 500, { success: false, message: err.message });
      }
    }

    // 2.2 Authoritative Downstream Rates Configuration & Creator Minimums
    if (pathname === '/api/rates/config' && method === 'GET') {
      try {
        const userId = url.searchParams.get('userId');
        let creatorId = url.searchParams.get('creatorId');
        if (!creatorId) {
          try {
            creatorId = getCaller(req).id;
          } catch (_) {}
        }
        if (!creatorId && userId) {
          const userRow = (await pgQuery(`SELECT creator_id FROM users WHERE id = $1`, [userId]))[0];
          creatorId = userRow?.creator_id || 'ADM001';
        }
        if (!creatorId) creatorId = 'ADM001';

        const pool = getDbPool();
        const client = await pool.connect();
        try {
          const channels = ['pinelabs', 'payswiff', 'qr'];
          const creatorRates = {};
          for (const ch of channels) {
            if (ch === 'qr') {
              const r = await getActiveRate(client, { userId: creatorId, channel: ch, settlementMode: 'NONE' });
              creatorRates.qr = {
                rate_bps: r.rate_bps,
                rate_percent: (r.rate_bps / 100).toFixed(2),
                is_default: r.is_default
              };
            } else {
              const rT1 = await getActiveRate(client, { userId: creatorId, channel: ch, settlementMode: 'T1' });
              const rIns = await getActiveRate(client, { userId: creatorId, channel: ch, settlementMode: 'INSTANT' });
              creatorRates[ch] = {
                t1: { rate_bps: rT1.rate_bps, rate_percent: (rT1.rate_bps / 100).toFixed(2), is_default: rT1.is_default },
                instant: { rate_bps: rIns.rate_bps, rate_percent: (rIns.rate_bps / 100).toFixed(2), is_default: rIns.is_default }
              };
            }
          }

          let userRates = null;
          if (userId) {
            const rows = (await client.query(`
              SELECT channel, settlement_mode, rate_bps, needs_review, effective_from
              FROM user_channel_rates
              WHERE UPPER(user_id) = UPPER($1) AND effective_to IS NULL
              ORDER BY channel, settlement_mode
            `, [userId])).rows;

            userRates = {};
            for (const r of rows) {
              const ch = r.channel.toLowerCase();
              if (!userRates[ch]) userRates[ch] = {};
              const mode = r.settlement_mode.toUpperCase();
              userRates[ch][mode] = {
                rate_bps: r.rate_bps,
                rate_percent: (r.rate_bps / 100).toFixed(2),
                needs_review: Boolean(r.needs_review)
              };
            }
          }

          return sendJson(res, 200, {
            success: true,
            creator_id: creatorId,
            creator_rates: creatorRates,
            user_id: userId || null,
            user_rates: userRates
          });
        } finally {
          client.release();
        }
      } catch (err) {
        return sendJson(res, 500, { success: false, message: err.message });
      }
    }

    // 2.3 Authoritative Real Ledger Commission & Sales Financial Summary
    if (pathname.startsWith('/api/users/') && pathname.endsWith('/financial-summary') && method === 'GET') {
      try {
        const parts = pathname.split('/');
        const targetUserId = parts[3];
        const pool = getDbPool();
        const client = await pool.connect();
        try {
          const balances = await getWalletBalances(client, targetUserId);
          const channelBalances = await calculateUserChannelBalances(targetUserId);

          const commRows = (await client.query(`
            SELECT COALESCE(channel, 'pinelabs') as channel,
                   SUM(amount_paise) as total_comm_paise,
                   SUM(CASE WHEN created_at >= CURRENT_DATE THEN amount_paise ELSE 0 END) as today_comm_paise
            FROM financial_ledger
            WHERE UPPER(user_id) = UPPER($1) AND type = 'commission'
            GROUP BY channel
          `, [targetUserId])).rows;

          let totalCommPaise = 0n;
          let todayCommPaise = 0n;
          const channelComms = { pinelabs: 0, payswiff: 0, qr: 0 };
          for (const cr of commRows) {
            const cp = BigInt(cr.total_comm_paise || 0);
            const tcp = BigInt(cr.today_comm_paise || 0);
            totalCommPaise += cp;
            todayCommPaise += tcp;
            const ch = (cr.channel || 'pinelabs').toLowerCase();
            if (channelComms[ch] !== undefined) {
              channelComms[ch] = Number(cp) / 100;
            }
          }

          const salesRow = (await client.query(`
            SELECT COALESCE(SUM(amount_paise), 0) as total_sales_paise,
                   COALESCE(SUM(CASE WHEN transaction_date = CURRENT_DATE THEN amount_paise ELSE 0 END), 0) as today_sales_paise
            FROM transactions
            WHERE UPPER(merchant_id) = UPPER($1) AND status != 'REVERSED'
          `, [targetUserId])).rows[0];

          return sendJson(res, 200, {
            success: true,
            user_id: targetUserId,
            balances,
            channel_balances: channelBalances,
            total_commission_paise: totalCommPaise.toString(),
            today_commission_paise: todayCommPaise.toString(),
            total_commission_rupees: (Number(totalCommPaise) / 100).toFixed(2),
            today_commission_rupees: (Number(todayCommPaise) / 100).toFixed(2),
            channel_commissions: channelComms,
            total_sales_paise: salesRow ? salesRow.total_sales_paise.toString() : '0',
            today_sales_paise: salesRow ? salesRow.today_sales_paise.toString() : '0',
            total_sales_rupees: salesRow ? (Number(salesRow.total_sales_paise) / 100).toFixed(2) : '0.00',
            today_sales_rupees: salesRow ? (Number(salesRow.today_sales_paise) / 100).toFixed(2) : '0.00'
          });
        } finally {
          client.release();
        }
      } catch (err) {
        return sendJson(res, 500, { success: false, message: err.message });
      }
    }

    // 2.4 Authoritative Downstream Network Tree & Performance
    if (pathname === '/api/network/downstream' && method === 'GET') {
      try {
        let creatorId = url.searchParams.get('creatorId');
        if (!creatorId) {
          try {
            creatorId = getCaller(req).id;
          } catch (_) {}
        }
        if (!creatorId) creatorId = 'ADM001';

        const pool = getDbPool();
        const client = await pool.connect();
        try {
          const usersRes = await client.query(`
            WITH RECURSIVE downline AS (
              SELECT id, name, mobile, role, creator_id, status, 1 as depth
              FROM users
              WHERE UPPER(creator_id) = UPPER($1)
              UNION ALL
              SELECT u.id, u.name, u.mobile, u.role, u.creator_id, u.status, d.depth + 1
              FROM users u
              INNER JOIN downline d ON UPPER(u.creator_id) = UPPER(d.id)
            )
            SELECT * FROM downline ORDER BY depth, name;
          `, [creatorId]);

          const downlineUsers = usersRes.rows;
          const userIds = downlineUsers.map(u => u.id);

          let commMap = {};
          let salesMap = {};
          if (userIds.length > 0) {
            const commData = await client.query(`
              SELECT user_id, 
                     COALESCE(SUM(amount_paise), 0) as total_comm_paise,
                     COALESCE(SUM(CASE WHEN created_at >= CURRENT_DATE THEN amount_paise ELSE 0 END), 0) as today_comm_paise
              FROM financial_ledger
              WHERE type = 'commission' AND user_id = ANY($1)
              GROUP BY user_id
            `, [userIds]);

            for (const r of commData.rows) {
              commMap[r.user_id] = {
                total_comm_paise: r.total_comm_paise,
                today_comm_paise: r.today_comm_paise
              };
            }

            const salesData = await client.query(`
              SELECT merchant_id,
                     COALESCE(SUM(amount_paise), 0) as total_sales_paise,
                     COALESCE(SUM(CASE WHEN transaction_date = CURRENT_DATE THEN amount_paise ELSE 0 END), 0) as today_sales_paise
              FROM transactions
              WHERE status != 'REVERSED' AND merchant_id = ANY($1)
              GROUP BY merchant_id
            `, [userIds]);

            for (const r of salesData.rows) {
              salesMap[r.merchant_id] = {
                total_sales_paise: r.total_sales_paise,
                today_sales_paise: r.today_sales_paise
              };
            }
          }

          let networkSalesPaise = 0n;
          let networkCommPaise = 0n;

          const partners = downlineUsers.map(u => {
            const c = commMap[u.id] || { total_comm_paise: '0', today_comm_paise: '0' };
            const s = salesMap[u.id] || { total_sales_paise: '0', today_sales_paise: '0' };
            const commRupees = Number(BigInt(c.total_comm_paise)) / 100;
            const salesRupees = Number(BigInt(s.total_sales_paise)) / 100;
            networkSalesPaise += BigInt(s.total_sales_paise);
            networkCommPaise += BigInt(c.total_comm_paise);

            return {
              ...u,
              is_direct: u.depth === 1,
              commission_earned: commRupees,
              total_sales: salesRupees,
              total_commission_paise: c.total_comm_paise,
              today_commission_paise: c.today_comm_paise,
              total_sales_paise: s.total_sales_paise,
              today_sales_paise: s.today_sales_paise
            };
          });

          return sendJson(res, 200, {
            success: true,
            creator_id: creatorId,
            partner_count: partners.length,
            partners,
            network_sales_paise: networkSalesPaise.toString(),
            network_commission_paise: networkCommPaise.toString(),
            network_sales_rupees: (Number(networkSalesPaise) / 100).toFixed(2),
            network_commission_rupees: (Number(networkCommPaise) / 100).toFixed(2)
          });
        } finally {
          client.release();
        }
      } catch (err) {
        return sendJson(res, 500, { success: false, message: err.message });
      }
    }

    // 3. Authoritative Atomic Withdrawal Execution
    if ((pathname === '/api/withdrawals/execute' || pathname === '/api/withdrawals/request-authoritative') && method === 'POST') {
      try {
        const body = await parseJsonBody(req);
        let merchantId = body.merchant_id || body.userId;
        if (!merchantId) {
          try {
            merchantId = getCaller(req).id;
          } catch (_) {}
        }
        if (!merchantId) {
          return sendJson(res, 400, { success: false, message: 'Merchant ID is required.' });
        }

        const amountPaise = body.amount_paise 
          ? BigInt(body.amount_paise) 
          : BigInt(Math.round(parseFloat(body.amount) * 100));

        const result = await withTransaction(async (client) => {
          return await processWithdrawalRequest(client, {
            merchantId,
            amountPaise,
            beneficiaryId: body.beneficiary_id,
            channel: body.channel || 'pinelabs',
            settlementType: body.settlement_type || 'T1',
            idempotencyKey: req.headers['idempotency-key'] || body.idempotency_key || null,
            createdBy: merchantId
          });
        });

        return sendJson(res, 200, { success: true, withdrawal: result });
      } catch (err) {
        const status = err.message.includes('RESERVE_VIOLATION') ? 403 : 400;
        return sendJson(res, status, { success: false, message: err.message });
      }
    }

    // 4. Authoritative Swipe / Payment Processing
    if ((pathname === '/api/transactions/process-swipe' || pathname === '/api/transactions/record-authoritative') && method === 'POST') {
      try {
        const body = await parseJsonBody(req);
        const amountPaise = body.amount_paise 
          ? BigInt(body.amount_paise) 
          : BigInt(Math.round(parseFloat(body.amount) * 100));

        const result = await withTransaction(async (client) => {
          return await processSwipeTransaction(client, {
            merchantId: body.merchant_id,
            amountPaise,
            channel: body.channel || 'pinelabs',
            refNumber: body.ref_number || body.utr_number || null,
            slipNumber: body.slip_number || null,
            notes: body.notes || null,
            idempotencyKey: req.headers['idempotency-key'] || body.idempotency_key || null,
            createdBy: body.merchant_id
          });
        });

        return sendJson(res, 200, { 
          success: true, 
          transaction: {
            ...result,
            amount_paise: result.amount_paise.toString(),
            customer_charge_paise: result.customer_charge_paise.toString(),
            net_amount_paise: result.net_amount_paise.toString(),
            distributions: result.distributions.map(d => ({
              ...d,
              amount_paise: d.amount_paise.toString()
            }))
          } 
        });
      } catch (err) {
        const status = err.message.includes('DUPLICATE_SWIPE') ? 409 : 400;
        return sendJson(res, status, { success: false, message: err.message });
      }
    }

    // 5. Authoritative Transaction Reversal
    if (pathname === '/api/transactions/reverse' && method === 'POST') {
      try {
        const body = await parseJsonBody(req);
        let callerId = 'ADMIN';
        try {
          callerId = getCaller(req).id;
        } catch (_) {}

        const result = await withTransaction(async (client) => {
          return await reverseTransaction(client, {
            txnId: body.txn_id || body.transaction_id,
            reason: body.reason || 'Reversed by admin',
            callerId
          });
        });

        return sendJson(res, 200, { success: true, reversal: result });
      } catch (err) {
        return sendJson(res, 400, { success: false, message: err.message });
      }
    }

    // 6. System Settings Read & Update (No hardcoded values)
    if (pathname === '/api/admin/settings' && method === 'GET') {
      try {
        const settings = await getAllSettings({ query: pgQuery });
        return sendJson(res, 200, { success: true, settings });
      } catch (err) {
        return sendJson(res, 500, { success: false, message: err.message });
      }
    }

    if (pathname === '/api/admin/settings/update' && method === 'POST') {
      try {
        const body = await parseJsonBody(req);
        let callerId = 'ADMIN';
        try {
          callerId = getCaller(req).id;
        } catch (_) {}

        const updated = await updateSetting(body.key, {
          value_numeric: body.value_numeric,
          value_text: body.value_text,
          value_json: body.value_json
        }, callerId, { query: pgQuery });

        return sendJson(res, 200, { success: true, setting: updated });
      } catch (err) {
        return sendJson(res, 400, { success: false, message: err.message });
      }
    }

    if (pathname === '/api/admin/system/migrate' && (method === 'POST' || method === 'GET')) {
      try {
        await pgQuery(`ALTER TABLE wallets ADD COLUMN IF NOT EXISTS withdrawn_amount NUMERIC DEFAULT 0.0`).catch(() => {});
        await pgQuery(`ALTER TABLE users ADD COLUMN IF NOT EXISTS channels JSONB DEFAULT '{}'::jsonb`).catch(() => {});
        const cols = await pgQuery(`SELECT column_name FROM information_schema.columns WHERE table_name = 'wallets'`);
        return sendJson(res, 200, { 
          success: true, 
          message: 'Database schema migration executed successfully.', 
          wallet_columns: cols.map(c => c.column_name) 
        });
      } catch (err) {
        return sendJson(res, 500, { success: false, message: err.message });
      }
    }

    // ----------------------------------------------------
    // AUTOMATIC GITHUB AUTO-DEPLOY WEBHOOK
    // ----------------------------------------------------
    if ((pathname === '/api/system/webhook-deploy' || pathname === '/api/webhook-deploy') && (method === 'POST' || method === 'GET')) {
      console.log('⚡ Received GitHub Auto-Deploy trigger! Pulling latest code and building...');
      exec('git pull origin main && npm run build && pm2 restart all', { cwd: '/var/www/ronava' }, (err, stdout) => {
        if (err) {
          console.error('❌ Auto-deploy build error:', err.message);
          return;
        }
        console.log('✅ Auto-deploy completed successfully!\n', stdout);
      });

      return sendJson(res, 200, {
        success: true,
        message: 'Auto-deploy triggered! Server is pulling latest code and building in background.',
        timestamp: new Date().toISOString()
      });
    }

    // 404 for unknown /api routes
    return sendJson(res, 404, { success: false, message: `API endpoint not found: ${pathname}` });

  } catch (err) {
    console.error('API Error:', err);
    return sendJson(res, 500, { success: false, message: err.message || 'Internal Server Error' });
  }
}
