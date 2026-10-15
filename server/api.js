import 'dotenv/config';
import { exec } from 'node:child_process';
import { verifyS3Connection, getPresignedUploadUrl, uploadBufferToS3, deleteS3Object } from './s3.js';
import { 
  initPostgresSchema, 
  getMediaFiles, 
  query as pgQuery,
  withTransaction
} from './pg_db.js';

import { getCaller } from './caller.js';
import { getSetting, getAllSettings, updateSetting } from './settings.js';
import { getWalletBalances, verifyWalletReconciliation } from './ledger_engine.js';
import { processSwipeTransaction } from './transaction_engine.js';
import { quoteWithdrawal, processWithdrawalRequest } from './withdrawal_engine.js';
import { reverseTransaction } from './reversal_engine.js';

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
 * Evaluates real-time swipes and withdrawals strictly in PostgreSQL.
 */
export async function calculateUserChannelBalances(userId, wallet) {
  try {
    const txns = await pgQuery(
      `SELECT id, amount, provider, status, notes, type FROM transactions WHERE UPPER(merchant_id) = UPPER($1) AND status = 'APPROVED'`, 
      [userId]
    );
    const withs = await pgQuery(
      `SELECT id, amount, channel, status FROM withdrawals WHERE UPPER(merchant_id) = UPPER($1) AND status != 'REJECTED'`, 
      [userId]
    );

    const channels = {
      pinelabs: { volume: 0, credited: 0, debited: 0, pending: 0, available_balance: 0, withdrawable_balance: 0 },
      payswiff: { volume: 0, credited: 0, debited: 0, pending: 0, available_balance: 0, withdrawable_balance: 0 },
      qr:       { volume: 0, credited: 0, debited: 0, pending: 0, available_balance: 0, withdrawable_balance: 0 },
    };

    (txns || []).forEach(t => {
      const p = (t.provider || '').toLowerCase();
      const ch = p.includes('swiff') ? 'payswiff' : (p.includes('qr') ? 'qr' : 'pinelabs');
      const gross = parseFloat(t.amount) || 0;
      let net = gross;
      if (t.notes && typeof t.notes === 'string' && t.notes.includes('[CARD_SWIPE_ENTRY]')) {
        try {
          const jsonPart = t.notes.slice(t.notes.indexOf('{'));
          const meta = JSON.parse(jsonPart);
          if (meta.net_credited !== undefined) {
            net = parseFloat(meta.net_credited) || 0;
          } else if (meta.company_fee !== undefined) {
            net = Math.max(0, gross - (parseFloat(meta.company_fee) || 0));
          }
        } catch (_) {}
      }
      channels[ch].volume += gross;
      channels[ch].credited += net;
    });

    (withs || []).forEach(w => {
      const c = (w.channel || '').toLowerCase();
      const ch = c.includes('swiff') ? 'payswiff' : (c.includes('qr') ? 'qr' : 'pinelabs');
      const amt = parseFloat(w.amount) || 0;
      if (w.status === 'APPROVED') {
        channels[ch].debited += amt;
      } else if (w.status === 'PENDING') {
        channels[ch].pending += amt;
        channels[ch].debited += amt;
      }
    });

    const dbAvail = Math.max(0, parseFloat(wallet?.available_balance || 0));

    for (const ch of Object.keys(channels)) {
      const raw = Math.max(0, parseFloat((channels[ch].credited - channels[ch].debited).toFixed(2)));
      channels[ch].available_balance = dbAvail > 0 ? (raw > 0 ? Math.min(raw, dbAvail) : dbAvail) : 0.0;
      channels[ch].withdrawable_balance = Math.max(0, parseFloat((channels[ch].available_balance - (channels[ch].available_balance > 0 ? 500 : 0)).toFixed(2)));
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
      const { adminId, txnId, txn_id, action, remark, utr } = await parseJsonBody(req);
      const targetTxnId = (txnId || txn_id || '').toString().trim();
      if (!targetTxnId || !action) {
        return sendJson(res, 400, { success: false, message: 'txnId and action are required.' });
      }

      const txns = await pgQuery(`SELECT * FROM transactions WHERE id = $1`, [targetTxnId]);
      const txn = txns[0];
      if (!txn) {
        return sendJson(res, 404, { success: false, message: 'Transaction not found.' });
      }

      if (action === 'APPROVE') {
        if (txn.status === 'REJECTED') {
          return sendJson(res, 400, { success: false, message: 'Cannot approve a rejected transaction.' });
        }

        const finalRemark = utr ? `[VERIFIED_BY_ADMIN] UTR: ${utr}` : (remark ? `[VERIFIED_BY_ADMIN] ${remark}` : '[VERIFIED_BY_ADMIN] Audited & verified against POS settlement report');

        await pgQuery(`
          UPDATE transactions 
          SET status = 'APPROVED', admin_remark = $1, verified_at = CURRENT_TIMESTAMP 
          WHERE id = $2
        `, [finalRemark, targetTxnId]);

        const updatedTxn = (await pgQuery(`SELECT * FROM transactions WHERE id = $1`, [targetTxnId]))[0];
        const updatedWallet = (await pgQuery(`SELECT * FROM wallets WHERE user_id = $1`, [txn.merchant_id]))[0];

        return sendJson(res, 200, {
          success: true,
          message: `Transaction ${targetTxnId} verified successfully!`,
          transaction: updatedTxn,
          wallet: updatedWallet
        });
      } else if (action === 'REJECT') {
        if (txn.status === 'REJECTED') {
          return sendJson(res, 400, { success: false, message: `Transaction ${targetTxnId} is already REJECTED.` });
        }
        const finalRemark = remark ? `[REVERSED_BY_ADMIN] ${remark}` : '[REVERSED_BY_ADMIN] Transaction rejected by Admin';

        // Atomic reversal with row-locked deficit tracking
        await withTransaction(async (client) => {
          // 1. Lock transaction row to prevent concurrent double-reversal
          const lockTxnRows = (await client.query(
            `SELECT * FROM transactions WHERE id = $1 FOR UPDATE`, 
            [targetTxnId]
          )).rows;
          const liveTxn = lockTxnRows[0];
          if (!liveTxn) {
            throw new Error(`Transaction ${targetTxnId} not found.`);
          }
          if (liveTxn.status === 'REJECTED') {
            throw new Error(`Transaction ${targetTxnId} is already REJECTED.`);
          }

          // Parse commission metadata snapshot
          let meta = {};
          if (liveTxn.notes && typeof liveTxn.notes === 'string' && liveTxn.notes.includes('[CARD_SWIPE_ENTRY]')) {
            try {
              const jsonPart = liveTxn.notes.slice(liveTxn.notes.indexOf('{'));
              meta = JSON.parse(jsonPart);
            } catch (_) {}
          }

          const netCredited = meta.net_credited !== undefined ? parseFloat(meta.net_credited) : parseFloat(liveTxn.amount);
          const uplineSplits = Array.isArray(meta.commission_splits) ? meta.commission_splits : [];
          const adminMargin = meta.admin_net_margin ? parseFloat(meta.admin_net_margin) : 0.0;

          // Reversal for merchant wallet
          await client.query(`
            UPDATE wallets 
            SET available_balance = GREATEST(0.0, available_balance - $1),
                received_sales = GREATEST(0.0, received_sales - $2),
                total_sales = GREATEST(0.0, total_sales - $2),
                updated_at = CURRENT_TIMESTAMP
            WHERE UPPER(user_id) = UPPER($3)
          `, [netCredited, parseFloat(liveTxn.amount), liveTxn.merchant_id]);

          // Reversal for each upline
          for (const split of uplineSplits) {
            const uId = split.user_id;
            const commAmt = parseFloat(split.amount) || 0;
            if (commAmt > 0 && uId) {
              await client.query(`
                UPDATE wallets 
                SET available_balance = GREATEST(0.0, available_balance - $1),
                    total_sales = GREATEST(0.0, total_sales - $2),
                    updated_at = CURRENT_TIMESTAMP
                WHERE UPPER(user_id) = UPPER($3)
              `, [commAmt, parseFloat(liveTxn.amount), uId]);
            }
          }

          // Admin reversal
          if (adminMargin > 0) {
            const aWallets = (await client.query(`SELECT * FROM wallets WHERE UPPER(user_id) = 'ADM001' FOR UPDATE`)).rows;
            if (aWallets.length > 0) {
              await client.query(`
                UPDATE wallets 
                SET available_balance = GREATEST(0.0, available_balance - $1),
                    total_sales = GREATEST(0.0, total_sales - $2),
                    updated_at = CURRENT_TIMESTAMP
                WHERE UPPER(user_id) = 'ADM001'
              `, [adminMargin, parseFloat(liveTxn.amount)]);
            }
          }

          // Update transaction status
          await client.query(`
            UPDATE transactions 
            SET status = 'REJECTED', admin_remark = $1, verified_at = CURRENT_TIMESTAMP 
            WHERE id = $2
          `, [finalRemark, targetTxnId]);

          // Record reversal clawback audit entry
          const revId = `REV-${Date.now().toString().slice(-6)}`;
          await client.query(`
            INSERT INTO transactions (id, merchant_id, customer_mobile, amount, type, provider, ref_number, notes, status, admin_remark, verified_at)
            VALUES ($1, $2, $3, $4, 'POS_SWIPE', $5, $6, $7, 'REJECTED', $8, CURRENT_TIMESTAMP)
          `, [
            revId,
            liveTxn.merchant_id,
            liveTxn.customer_mobile || null,
            netCredited,
            liveTxn.provider || 'Pine Labs',
            liveTxn.ref_number || `REF-${revId}`,
            `[REVERSAL_CLAWBACK] ${JSON.stringify({ original_txn_id: targetTxnId, amount_reversed: netCredited })}`,
            finalRemark
          ]);
        });

        const updatedTxn = (await pgQuery(`SELECT * FROM transactions WHERE id = $1`, [targetTxnId]))[0];
        const updatedWallet = (await pgQuery(`SELECT * FROM wallets WHERE user_id = $1`, [txn.merchant_id]))[0];

        return sendJson(res, 200, {
          success: true,
          message: `Transaction ${targetTxnId} reversed successfully. Auditable clawback applied.`,
          transaction: updatedTxn,
          wallet: updatedWallet
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

    if (pathname.startsWith('/api/users/') && method === 'GET' && pathname !== '/api/users/create') {
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
                 w.available_balance,
                 w.total_sales,
                 w.pending_balance,
                 w.received_sales,
                 w.withdrawn_amount
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

    if (pathname.startsWith('/api/wallet/') && method === 'GET') {
      const userId = decodeURIComponent(pathname.replace('/api/wallet/', '')).trim();
      try {
        const wallets = await pgQuery(`SELECT * FROM wallets WHERE UPPER(user_id) = UPPER($1)`, [userId]);
        const pos = (await pgQuery(`SELECT * FROM merchant_pos WHERE UPPER(merchant_id) = UPPER($1)`, [userId]))[0] || null;
        if (!wallets || wallets.length === 0) {
          const emptyWallet = { user_id: userId, available_balance: 0, total_sales: 0, received_sales: 0, pending_balance: 0, withdrawn_amount: 0 };
          emptyWallet.channel_balances = await calculateUserChannelBalances(userId, emptyWallet);
          return sendJson(res, 200, {
            success: true,
            wallet: emptyWallet,
            pos
          });
        }
        const activeWallet = { ...wallets[0] };
        activeWallet.channel_balances = await calculateUserChannelBalances(userId, activeWallet);
        return sendJson(res, 200, { success: true, wallet: activeWallet, pos });
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
            INSERT INTO wallets (user_id, available_balance, total_sales, received_sales, pending_balance, withdrawn_amount)
            VALUES ($1, 0.0, 0.0, 0.0, 0.0, 0.0)
            ON CONFLICT (user_id) DO NOTHING
          `, [newUserId]);

          // 3. Configure Multi-Channel Portfolio or POS Terminal
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
            } else if (swiff && swiff.enabled) {
              primaryProvider = 'Payswiff';
              primaryVendor = swiff.vendor === 'R.P. Technologies' ? 'R.P. Technologies' : 'RONAV Technologies';
              primaryRateT1 = parseFloat(swiff.rate_t1 || userData.commission_rate_t1 || 0);
              primaryRateInstant = parseFloat(swiff.rate_instant || userData.commission_rate_instant || primaryRateT1);
            } else if (qr && qr.enabled) {
              primaryProvider = 'Company QR (UPI)';
              primaryVendor = 'RONAV Technologies';
              primaryRateT1 = parseFloat(qr.rate_instant || userData.commission_rate_instant || userData.commission_rate_t1 || 0);
              primaryRateInstant = primaryRateT1;
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
        console.error('API /api/users/create error:', err);
        if (err.message && (err.message.includes('unique') || err.message.includes('duplicate'))) {
          return sendJson(res, 400, { success: false, message: 'A user with this mobile number or ID already exists.' });
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
        if (!merchant_id || !bank_name || !account_number) {
          return sendJson(res, 400, { success: false, message: 'Missing required bank details (merchant_id, bank_name, account_number).' });
        }

        const benName = (holder_name || beneficiary_name || 'Account Holder').trim();
        const benId = `BEN-${Date.now().toString().slice(-6)}`;
        const ifscClean = (ifsc || 'SBIN0001234').trim().toUpperCase();

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

        const fullTerminalStr = `[PORTFOLIO]${JSON.stringify(channels)}`;
        const pine = channels.pine_labs;
        const swiff = channels.payswiff;
        const qr = channels.qr;

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

        await pgQuery(`
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
          merchantId.trim(), primaryProvider, fullTerminalStr, primaryRateT1, adminId || 'ADM001',
          primaryVendor, primaryRateT1, primaryRateInstant
        ]);

        await pgQuery(`
          UPDATE users SET
            commission_rate_t1 = $1,
            commission_rate_instant = $2,
            updated_at = CURRENT_TIMESTAMP
          WHERE UPPER(id) = UPPER($3)
        `, [primaryRateT1, primaryRateInstant, merchantId.trim()]);

        return sendJson(res, 200, { success: true, message: 'Channels updated successfully!' });
      } catch (err) {
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

      const wallets = await pgQuery(`SELECT * FROM wallets WHERE user_id = $1`, [user.id]);
      const posList = await pgQuery(`SELECT * FROM merchant_pos WHERE merchant_id = $1`, [user.id]);
      const activeWallet = wallets[0] ? { ...wallets[0] } : { user_id: user.id, available_balance: 0, total_sales: 0, received_sales: 0, pending_balance: 0, withdrawn_amount: 0 };
      activeWallet.channel_balances = await calculateUserChannelBalances(user.id, activeWallet);

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
               w.available_balance,
               w.total_sales,
               w.pending_balance,
               w.received_sales
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
               w.available_balance,
               w.total_sales,
               w.pending_balance,
               w.received_sales
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
    // 2. LIVE WALLET & METRICS
    // ----------------------------------------------------
    if (pathname.startsWith('/api/wallet/') && method === 'GET') {
      const userId = decodeURIComponent(pathname.replace('/api/wallet/', '')).trim();
      const wallets = await pgQuery(`SELECT * FROM wallets WHERE UPPER(user_id) = UPPER($1)`, [userId]);
      const posList = await pgQuery(`SELECT * FROM merchant_pos WHERE UPPER(merchant_id) = UPPER($1)`, [userId]);
      
      if (!wallets || wallets.length === 0) {
        const emptyWallet = { user_id: userId, available_balance: 0, total_sales: 0, received_sales: 0, pending_balance: 0, withdrawn_amount: 0 };
        emptyWallet.channel_balances = await calculateUserChannelBalances(userId, emptyWallet);
        return sendJson(res, 200, { success: true, wallet: emptyWallet, pos: posList[0] || null });
      }

      const activeWallet = { ...wallets[0] };
      activeWallet.channel_balances = await calculateUserChannelBalances(userId, activeWallet);
      return sendJson(res, 200, { success: true, wallet: activeWallet, pos: posList[0] || null });
    }

    // ----------------------------------------------------
    // 3. TRANSACTIONS & AUTHORITATIVE COMMISSION RECORDING
    // ----------------------------------------------------
    if (pathname === '/api/transactions/record' && method === 'POST') {
      const { 
        merchant_id, 
        amount, 
        customer_name, 
        customer_mobile, 
        type, 
        provider: bodyProvider, 
        ref_number, 
        notes, 
        settlement_type, 
        terminal_id: bodyTerminalId 
      } = await parseJsonBody(req);

      if (!merchant_id || !amount) {
        return sendJson(res, 400, { success: false, message: 'Merchant ID and Amount are required.' });
      }

      const numAmount = parseFloat(amount);
      if (isNaN(numAmount) || numAmount <= 0) {
        return sendJson(res, 400, { success: false, message: 'Amount must be a positive number.' });
      }

      const merchants = await pgQuery(`SELECT * FROM users WHERE UPPER(id) = UPPER($1)`, [merchant_id.trim()]);
      if (!merchants || merchants.length === 0) {
        return sendJson(res, 401, { success: false, code: 'USER_NOT_FOUND', message: 'Merchant account not found. Please log in again.' });
      }
      const merchant = merchants[0];
      if (merchant.status === 'SUSPENDED') {
        return sendJson(res, 403, { success: false, code: 'USER_SUSPENDED', message: 'Merchant account has been suspended by Administrator.' });
      }

      // Transaction Reference / RRN / UTR Deduplication Check
      const cleanRef = (ref_number || '').trim().toUpperCase();
      if (cleanRef) {
        const existingTxn = await pgQuery(`
          SELECT id, amount, status FROM transactions 
          WHERE UPPER(ref_number) = UPPER($1) AND status != 'REJECTED'
        `, [cleanRef]);
        if (existingTxn.length > 0) {
          return sendJson(res, 409, {
            success: false,
            message: `Duplicate Reference: Reference/RRN "${cleanRef}" has already been recorded under transaction ${existingTxn[0].id}.`
          });
        }
      }

      const posList = await pgQuery(`SELECT * FROM merchant_pos WHERE UPPER(merchant_id) = UPPER($1)`, [merchant_id.trim()]);
      const pos = posList[0] || null;
      const isQRPayment = type === 'QR_SCAN' || (bodyProvider && bodyProvider.toLowerCase().includes('qr'));
      const provider = isQRPayment ? 'Company QR (UPI)' : (bodyProvider || (pos ? pos.provider : (type === 'BBPS_BILL' ? 'BBPS' : 'Pine Labs')));
      const activeChannelKey = isQRPayment ? 'qr' : ((provider || '').toLowerCase().includes('swiff') ? 'payswiff' : 'pinelabs');
      const isInstant = (activeChannelKey === 'qr') ? true : ((settlement_type || '').toUpperCase() === 'INSTANT');

      // Resolve Merchant Buy Rate (Zero Silent Fallbacks)
      const merchantBuyRate = resolveUserBuyRate(merchant, pos, isInstant, activeChannelKey);
      if (merchantBuyRate <= 0) {
        return sendJson(res, 400, { 
          success: false, 
          message: `POS commission rate not configured for merchant (${merchant_id}).` 
        });
      }

      const compFee = parseFloat(((numAmount * merchantBuyRate) / 100).toFixed(2));
      const netCreditAmount = parseFloat(Math.max(0, numAmount - compFee).toFixed(2));

      // Resolve Hierarchy & Upline Margin Distribution
      const allUsers = await pgQuery(`SELECT * FROM users`);
      const allPos = await pgQuery(`SELECT * FROM merchant_pos`);
      const posMap = {};
      allPos.forEach(p => { posMap[p.merchant_id.toUpperCase()] = p; });
      const userMap = {};
      allUsers.forEach(u => { userMap[u.id.toUpperCase()] = u; });

      let currentLevelRate = merchantBuyRate;
      const uplineChain = [];
      let cur = merchant;
      let safety = 0;
      while (cur && cur.creator_id && cur.creator_id.toUpperCase() !== 'ADM001' && safety < 10) {
        safety++;
        const parentUser = userMap[(cur.creator_id || '').toUpperCase()];
        if (!parentUser) break;
        uplineChain.push(parentUser);
        cur = parentUser;
      }

      let distributedUplineTotal = 0;
      const commissionSplits = [];

      for (const uplineUser of uplineChain) {
        const uPos = posMap[uplineUser.id.toUpperCase()];
        const parentBuyRate = resolveUserBuyRate(uplineUser, uPos, isInstant, activeChannelKey);

        if (parentBuyRate > 0 && parentBuyRate < currentLevelRate) {
          const marginDiff = parseFloat((currentLevelRate - parentBuyRate).toFixed(4));
          const commissionEarned = parseFloat(((numAmount * marginDiff) / 100).toFixed(2));

          if (commissionEarned > 0) {
            distributedUplineTotal += commissionEarned;
            commissionSplits.push({
              user_id: uplineUser.id,
              user_name: uplineUser.name,
              role: uplineUser.role,
              amount: commissionEarned,
              margin_diff: marginDiff,
              buy_rate: parentBuyRate
            });
            currentLevelRate = parentBuyRate;
          }
        }
      }

      // Admin Residual Platform Profit (Paisa-perfect reconciliation)
      const adminNetMargin = parseFloat(Math.max(0, compFee - distributedUplineTotal).toFixed(2));

      const txnId = `TXN-${activeChannelKey === 'qr' ? 'QR' : (activeChannelKey === 'payswiff' ? 'SW' : 'PL')}-${Date.now().toString().slice(-6)}`;
      const finalRef = cleanRef || `REF-${Math.floor(100000 + Math.random() * 900000)}`;

      const swipeMeta = {
        customer_name: customer_name ? customer_name.trim() : 'Counter Customer',
        customer_mobile: customer_mobile ? customer_mobile.trim() : '',
        rrn: finalRef,
        settlement_type: isInstant ? 'INSTANT' : (settlement_type || 'T1'),
        company_fee: compFee,
        merchant_buy_rate: merchantBuyRate,
        net_credited: netCreditAmount,
        commission_splits: commissionSplits,
        admin_net_margin: adminNetMargin,
        terminal_id: bodyTerminalId || (pos ? pos.terminal_id : 'PL-01'),
        pos_provider: provider,
        pos_vendor: pos?.vendor_entity || 'Rose Navaneetham Enterprises',
        user_notes: notes || ''
      };

      // Atomic Execution with Deficit Offset
      let createdTxn = null;
      let updatedMerchantWallet = null;

      try {
        await withTransaction(async (client) => {
          // Atomic in-transaction duplicate check to protect against race conditions & concurrent requests
          if (cleanRef) {
            const dupInTxn = (await client.query(`
              SELECT id FROM transactions 
              WHERE UPPER(ref_number) = UPPER($1) AND status != 'REJECTED'
              LIMIT 1
            `, [cleanRef])).rows;
            if (dupInTxn.length > 0) {
              const err = new Error(`Duplicate Reference: Reference/RRN "${cleanRef}" has already been recorded under transaction ${dupInTxn[0].id}.`);
              err.statusCode = 409;
              err.code = '23505';
              throw err;
            }
          }

          // Lock merchant wallet
        const mWallets = (await client.query(`SELECT * FROM wallets WHERE user_id = $1 FOR UPDATE`, [merchant.id])).rows;
        let mWallet = mWallets[0];
        if (!mWallet) {
          mWallet = (await client.query(`
            INSERT INTO wallets (user_id, available_balance, total_sales, received_sales, pending_balance, withdrawn_amount)
            VALUES ($1, 0.0, 0.0, 0.0, 0.0, 0.0) RETURNING *
          `, [merchant.id])).rows[0];
        }

        const updMWalletRes = await client.query(`
          UPDATE wallets 
          SET available_balance = available_balance + $1,
              received_sales = received_sales + $2,
              total_sales = total_sales + $2,
              updated_at = CURRENT_TIMESTAMP
          WHERE UPPER(user_id) = UPPER($3)
          RETURNING *
        `, [netCreditAmount, numAmount, merchant.id]);
        updatedMerchantWallet = updMWalletRes.rows[0];

        // Credit Uplines
        for (const split of commissionSplits) {
          const uId = split.user_id;
          const commAmt = parseFloat(split.amount) || 0;
          if (commAmt > 0) {
            const uWallets = (await client.query(`SELECT * FROM wallets WHERE UPPER(user_id) = UPPER($1) FOR UPDATE`, [uId])).rows;
            let uWallet = uWallets[0];
            if (!uWallet) {
              const insU = await client.query(`
                INSERT INTO wallets (user_id, available_balance, total_sales, received_sales, pending_balance, withdrawn_amount)
                VALUES ($1, 0.0, 0.0, 0.0, 0.0, 0.0)
                ON CONFLICT (user_id) DO UPDATE SET updated_at = CURRENT_TIMESTAMP
                RETURNING *
              `, [uId]);
              uWallet = insU.rows[0];
            }

            await client.query(`
              UPDATE wallets 
              SET available_balance = available_balance + $1,
                  total_sales = total_sales + $2,
                  updated_at = CURRENT_TIMESTAMP
              WHERE UPPER(user_id) = UPPER($3)
            `, [commAmt, numAmount, uId]);
          }
        }

        // Credit Admin Profit
        if (adminNetMargin > 0) {
          const aWallets = (await client.query(`SELECT * FROM wallets WHERE UPPER(user_id) = 'ADM001' FOR UPDATE`)).rows;
          if (aWallets.length > 0) {
            await client.query(`
              UPDATE wallets 
              SET available_balance = available_balance + $1,
                  total_sales = total_sales + $2,
                  updated_at = CURRENT_TIMESTAMP
              WHERE UPPER(user_id) = 'ADM001'
            `, [adminNetMargin, numAmount]);
          }
        }

        // Insert Transaction with APPROVED status
        const tRes = await client.query(`
          INSERT INTO transactions (id, merchant_id, customer_mobile, amount, type, provider, ref_number, notes, status, verified_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP)
          RETURNING *
        `, [
          txnId,
          merchant.id,
          customer_mobile || null,
          numAmount,
          type || 'POS_SWIPE',
          provider,
          finalRef,
          `[CARD_SWIPE_ENTRY] ${JSON.stringify(swipeMeta)}`,
          'APPROVED'
        ]);
        createdTxn = tRes.rows[0];
      });
    } catch (err) {
      if (err.statusCode === 409 || err.code === '23505' || err.message?.includes('Duplicate Reference') || err.message?.includes('uq_transactions_ref_number')) {
        return sendJson(res, 409, {
          success: false,
          message: err.message || `Duplicate Reference: Reference "${cleanRef}" has already been recorded.`
        });
      }
      return sendJson(res, 500, { success: false, message: err.message });
    }

      return sendJson(res, 201, {
        success: true,
        message: `Sale of ₹${numAmount.toLocaleString('en-IN')} recorded! ₹${netCreditAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })} credited immediately.`,
        transaction: createdTxn,
        wallet: updatedMerchantWallet
      });
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

      if (!merchant_id || !bank_name || !account_number) {
        return sendJson(res, 400, { success: false, message: 'Missing required bank details.' });
      }

      const benId = `BEN-${Date.now().toString().slice(-6)}`;
      await pgQuery(`
        INSERT INTO beneficiaries (id, merchant_id, bank_name, account_number, ifsc, holder_name, is_primary)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [benId, merchant_id, bank_name, account_number, ifsc || 'SBIN0001234', holder_name || 'Account Holder', is_primary ? 1 : 0]);

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
      const { 
        merchant_id, 
        amount, 
        bank_name, 
        account_number, 
        ifsc, 
        remarks, 
        admin_remark, 
        channel, 
        provider, 
        customer_name, 
        customer_mobile, 
        settlement_mode, 
        payout_type, 
        payout_purpose,
        utr_number,
        ref_number,
        utr
      } = await parseJsonBody(req);

      const numAmount = parseFloat(amount);
      if (!merchant_id || !numAmount || isNaN(numAmount) || numAmount <= 0 || !bank_name || !account_number) {
        return sendJson(res, 400, { success: false, message: 'Missing or invalid required withdrawal details.' });
      }

      const users = await pgQuery(`SELECT id, status FROM users WHERE UPPER(id) = UPPER($1)`, [merchant_id.trim()]);
      if (!users || users.length === 0) {
        return sendJson(res, 401, { success: false, code: 'USER_NOT_FOUND', message: 'User account not found. Please log in again.' });
      }
      if (users[0].status === 'SUSPENDED') {
        return sendJson(res, 403, { success: false, code: 'USER_SUSPENDED', message: 'Account is suspended. Please contact Admin.' });
      }

      const user = users[0];
      const isDistributor = user && ['SUPER_DISTRIBUTOR', 'DISTRICT_DISTRIBUTOR', 'DISTRIBUTOR', 'MASTER'].includes((user.role || '').toUpperCase());
      const isCommissionPayout = payout_purpose === 'COMMISSION' || isDistributor;

      // Check Admin Master Toggle for Commission Payouts
      if (isCommissionPayout) {
        const toggleRows = await pgQuery(`SELECT * FROM inquiries WHERE UPPER(id) = 'SYS-COMMISSION-PAYOUTS'`);
        const isToggleLocked = toggleRows.length > 0 && toggleRows[0].status === 'INACTIVE';
        if (isToggleLocked) {
          return sendJson(res, 403, { 
            success: false, 
            message: 'Commission & Profit Withdrawals are currently locked by Admin. Please check back when enabled.' 
          });
        }
      }

      // Universal ₹500.00 Active Reserve Hold strictly enforced across all accounts & payout purposes
      const reserveHold = 500.0;
      const wId = `WTH-${Date.now().toString().slice(-6)}`;

      let createdWth = null;
      let updatedWallet = null;

      try {
        await withTransaction(async (client) => {
          let wRows = (await client.query(`SELECT * FROM wallets WHERE UPPER(user_id) = UPPER($1) FOR UPDATE`, [merchant_id.trim()])).rows;
          let wallet = wRows[0];
          if (!wallet) {
            wallet = (await client.query(`
              INSERT INTO wallets (user_id, available_balance, total_sales, received_sales, pending_balance, withdrawn_amount)
              VALUES ($1, 0.0, 0.0, 0.0, 0.0, 0.0) RETURNING *
            `, [merchant_id.trim()])).rows[0];
          }

          const currAvail = parseFloat(wallet.available_balance || 0);

          const maxWithdrawable = Math.max(0.0, parseFloat((currAvail - reserveHold).toFixed(2)));
          if (numAmount > maxWithdrawable) {
            const errDetail = `Insufficient withdrawable balance! Available: ₹${currAvail.toFixed(2)}, Active hold: ₹500.00 required. Max withdrawable: ₹${maxWithdrawable.toFixed(2)}`;
            throw new Error(errDetail);
          }

          // Atomic deduction from available balance into pending balance
          const minRequiredBalance = parseFloat((numAmount + reserveHold).toFixed(2));
          const updRes = await client.query(`
            UPDATE wallets 
            SET available_balance = available_balance - $1,
                pending_balance = pending_balance + $1,
                updated_at = CURRENT_TIMESTAMP
            WHERE UPPER(user_id) = UPPER($2) AND available_balance >= $3
            RETURNING *
          `, [numAmount, merchant_id.trim(), minRequiredBalance]);

          if (updRes.rows.length === 0) {
            throw new Error('Insufficient withdrawable balance during atomic check.');
          }
          updatedWallet = updRes.rows[0];

          const cleanChannel = (channel || (provider?.toLowerCase().includes('swiff') ? 'payswiff' : (provider?.toLowerCase().includes('qr') ? 'qr' : 'pinelabs'))).toLowerCase();
          const cleanUtr = (utr_number || ref_number || utr || '').trim().toUpperCase();
          const resolvedPayoutPurpose = (payout_purpose || (isCommissionPayout ? 'COMMISSION' : 'REGULAR')).toUpperCase();

          const metaPayload = {
            channel: cleanChannel,
            provider: provider || 'Pine Labs',
            payout_type: payout_type || 'CUSTOMER_DISBURSAL',
            payout_purpose: resolvedPayoutPurpose,
            customer_name: customer_name || '',
            customer_mobile: customer_mobile || '',
            settlement_mode: settlement_mode || 'INSTANT',
            utr_number: cleanUtr
          };
          const finalRemark = admin_remark || remarks || `[PAYOUT_META]${JSON.stringify(metaPayload)}`;

          const insRes = await client.query(`
            INSERT INTO withdrawals (
              id, merchant_id, amount, bank_name, account_number, ifsc, 
              admin_remark, status, channel, utr_number, rrn_number, 
              customer_name, customer_mobile, settlement_mode, payout_type, payout_purpose
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
            RETURNING *
          `, [
            wId, 
            merchant_id.trim(), 
            numAmount, 
            bank_name, 
            account_number, 
            ifsc || 'SBIN0001234', 
            finalRemark, 
            'PENDING',
            cleanChannel,
            cleanUtr,
            cleanUtr,
            customer_name || '',
            customer_mobile || '',
            settlement_mode || 'INSTANT',
            payout_type || 'CUSTOMER_DISBURSAL',
            resolvedPayoutPurpose
          ]);
          createdWth = insRes.rows[0];
        });

        return sendJson(res, 201, {
          success: true,
          message: 'Withdrawal request submitted! Pending Admin payout clearance.',
          withdrawal: createdWth,
          wallet: updatedWallet,
          withdrawal_id: wId
        });
      } catch (err) {
        return sendJson(res, 400, { success: false, message: err.message });
      }
    }

    if (pathname === '/api/admin/verify-withdrawal' && method === 'POST') {
      const { withdrawal_id, withdrawalId, action, remark, utr } = await parseJsonBody(req);
      const targetWthId = (withdrawal_id || withdrawalId || '').toString().trim();
      if (!targetWthId || !action) {
        return sendJson(res, 400, { success: false, message: 'withdrawal_id and action are required.' });
      }

      try {
        let updatedWth = null;
        let updatedWallet = null;

        await withTransaction(async (client) => {
          const wRows = (await client.query(`SELECT * FROM withdrawals WHERE id = $1 FOR UPDATE`, [targetWthId])).rows;
          const wth = wRows[0];
          if (!wth) {
            throw new Error('Withdrawal record not found.');
          }

          if (wth.status !== 'PENDING') {
            throw new Error(`Withdrawal is already ${wth.status}.`);
          }

          const amount = parseFloat(wth.amount);

          if (action === 'APPROVE') {
            const cleanUtr = (utr || '').trim();
            const existingRemark = wth.admin_remark || '';
            const finalRemark = cleanUtr 
              ? (existingRemark ? `${existingRemark} • Disbursed via IMPS (UTR: ${cleanUtr})` : `Disbursed via IMPS (UTR: ${cleanUtr})`)
              : (remark || existingRemark || 'Bank payout cleared via IMPS/NEFT');
            const wRes = await client.query(`
              UPDATE withdrawals 
              SET status = 'APPROVED', 
                  admin_remark = $1, 
                  utr_number = COALESCE(NULLIF($2, ''), utr_number),
                  rrn_number = COALESCE(NULLIF($2, ''), rrn_number),
                  verified_at = CURRENT_TIMESTAMP 
              WHERE id = $3
              RETURNING *
            `, [finalRemark, cleanUtr, targetWthId]);
            updatedWth = wRes.rows[0];

            const walRes = await client.query(`
              UPDATE wallets 
              SET pending_balance = GREATEST(0.0, pending_balance - $1),
                  withdrawn_amount = withdrawn_amount + $1,
                  updated_at = CURRENT_TIMESTAMP
              WHERE user_id = $2
              RETURNING *
            `, [amount, wth.merchant_id]);
            updatedWallet = walRes.rows[0];
          } else if (action === 'REJECT') {
            const wRes = await client.query(`
              UPDATE withdrawals 
              SET status = 'REJECTED', admin_remark = $1, verified_at = CURRENT_TIMESTAMP 
              WHERE id = $2
              RETURNING *
            `, [remark || 'Bank account details mismatch / rejected', targetWthId]);
            updatedWth = wRes.rows[0];

            const walRes = await client.query(`
              UPDATE wallets 
              SET pending_balance = GREATEST(0.0, pending_balance - $1),
                  available_balance = available_balance + $1,
                  updated_at = CURRENT_TIMESTAMP
              WHERE user_id = $2
              RETURNING *
            `, [amount, wth.merchant_id]);
            updatedWallet = walRes.rows[0];
          } else {
            throw new Error('Invalid action. Allowed: APPROVE, REJECT.');
          }
        });

        return sendJson(res, 200, {
          success: true,
          message: `Withdrawal ${action === 'APPROVE' ? 'Approved' : 'Rejected'}.`,
          withdrawal: updatedWth,
          wallet: updatedWallet
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
        SELECT * FROM withdrawals 
        WHERE UPPER(merchant_id) = UPPER($1) 
        ORDER BY created_at DESC
      `, [merchantId]);
      return sendJson(res, 200, { success: true, withdrawals });
    }

    if ((pathname === '/api/admin/withdrawals' || pathname === '/api/withdrawals') && method === 'GET') {
      const withdrawals = await pgQuery(`
        SELECT w.*, u.name as merchant_name, u.mobile as merchant_mobile
        FROM withdrawals w
        LEFT JOIN users u ON w.merchant_id = u.id
        ORDER BY w.created_at DESC
      `);
      return sendJson(res, 200, { success: true, withdrawals });
    }

    if (pathname === '/api/admin/withdrawals/batch-status' && method === 'POST') {
      try {
        const { withdrawalIds, status, adminRemark, batchTag, batchNameTag, batchReference, bankName, action } = await parseJsonBody(req);
        if (!Array.isArray(withdrawalIds) || withdrawalIds.length === 0) {
          return sendJson(res, 400, { success: false, message: 'withdrawalIds array is required.' });
        }

        const idList = withdrawalIds.map(id => String(id));
        const timestamp = new Date().toISOString();

        const normalizedAction = (action || '').toUpperCase();
        if (normalizedAction === 'SUBMITTED_TO_BANK' || normalizedAction === 'SUBMIT_TO_BANK') {
          for (const wId of idList) {
            const current = (await pgQuery(`SELECT * FROM withdrawals WHERE UPPER(id) = UPPER($1)`, [wId]))[0];
            if (current) {
              const existing = (current.admin_remark || '')
                .replace(/\[SUBMITTED_TO_BANK\]\s*/g, '')
                .replace(/\[BATCH:[^\]]+\]\s*/g, '')
                .replace(/\[BATCH_NAME:[^\]]+\]\s*/g, '')
                .trim();
              const tagStr = batchTag || (batchReference ? `[BATCH:${batchReference}]` : '');
              const nameTagStr = batchNameTag || (bankName ? `[BATCH_NAME:${bankName}]` : '');
              const newRemark = `[SUBMITTED_TO_BANK] ${tagStr} ${nameTagStr} ${existing}`.trim();
              await pgQuery(`
                UPDATE withdrawals 
                SET admin_remark = $1, submitted_to_bank_at = $2
                WHERE UPPER(id) = UPPER($3)
              `, [newRemark, timestamp, wId]);
            }
          }
          return sendJson(res, 200, { success: true, message: `Successfully marked ${idList.length} payout(s) as Submitted to Bank!` });
        } else if (normalizedAction === 'REVERT_PENDING') {
          for (const wId of idList) {
            const current = (await pgQuery(`SELECT * FROM withdrawals WHERE UPPER(id) = UPPER($1)`, [wId]))[0];
            if (current) {
              const cleanRemark = (current.admin_remark || '')
                .replace(/\[SUBMITTED_TO_BANK\]\s*/g, '')
                .replace(/\[BATCH:[^\]]+\]\s*/g, '')
                .replace(/\[BATCH_NAME:[^\]]+\]\s*/g, '')
                .trim();
              await pgQuery(`
                UPDATE withdrawals 
                SET status = 'PENDING', admin_remark = $1, submitted_to_bank_at = NULL
                WHERE UPPER(id) = UPPER($2)
              `, [cleanRemark || null, wId]);
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

        const balances = await getWalletBalances({ query: pgQuery }, callerId);
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

        const quote = await quoteWithdrawal({ query: pgQuery }, {
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
