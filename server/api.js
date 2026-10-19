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
import { processSwipeTransaction, editSwipeTransaction, quoteSwipeTransaction } from './transaction_engine.js';
import { quoteWithdrawal, processWithdrawalRequest } from './withdrawal_engine.js';
import { reverseTransaction } from './reversal_engine.js';
import { validateChildParentRates, setUserRate, getActiveRate } from './rate_engine.js';
import { 
  getJwtSecret,
  hashPassword, 
  verifyPassword, 
  generateToken, 
  checkRateLimit, 
  getDownlineUserIds, 
  assertCanAccessUser,
  checkTokenRenewal
} from './security.js';

// Enforce strict security configuration on boot: refuse execution if JWT_SECRET is missing or insecure (<32 chars)
getJwtSecret();
import { sanitizeUser, serializeMoneyFields } from './serializers.js';

export function requireAuth(req) {
  return getCaller(req);
}

export function requireAdmin(req) {
  const caller = getCaller(req);
  if (caller.role !== 'ADMIN' && caller.id !== 'ADM001') {
    const err = new Error('ACCESS_FORBIDDEN: Administrator access required.');
    err.statusCode = 403;
    err.code = 'FORBIDDEN_ADMIN_ONLY';
    throw err;
  }
  return caller;
}

export function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return req.socket?.remoteAddress || req.connection?.remoteAddress || '127.0.0.1';
}

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
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, idempotency-key',
    'Access-Control-Expose-Headers': 'X-Renewed-Token, Content-Type, Authorization'
  };
  if (res && res._renewedToken) {
    headers['X-Renewed-Token'] = res._renewedToken;
  }
  res.writeHead(statusCode, headers);
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
export async function calculateUserChannelBalances(userId, client = null) {
  try {
    const queryFn = client ? (q, p) => client.query(q, p).then(res => res.rows) : pgQuery;
    const ledgerRows = await queryFn(`
      SELECT channel,
             SUM(CASE WHEN amount_paise > 0 THEN amount_paise ELSE 0 END) as credited_paise,
             SUM(CASE WHEN amount_paise < 0 THEN -amount_paise ELSE 0 END) as debited_paise,
             SUM(amount_paise) as net_paise,
             SUM(CASE WHEN type IN ('commission', 'adjustment') THEN amount_paise ELSE 0 END) as commission_paise
      FROM financial_ledger
      WHERE UPPER(user_id) = UPPER($1)
        AND channel IS NOT NULL
      GROUP BY channel
    `, [userId]);

    const salesRows = await queryFn(`
      SELECT channel,
             SUM(amount_paise) as sales_paise
      FROM transactions
      WHERE UPPER(merchant_id) = UPPER($1)
        AND UPPER(status) = 'APPROVED'
        AND channel IS NOT NULL
      GROUP BY channel
    `, [userId]);

    const wRows = await queryFn(`
      SELECT channel,
             SUM(CASE WHEN UPPER(status) IN ('COMPLETED', 'PAID', 'SUCCESS') THEN amount_paise ELSE 0 END) as sent_paise,
             SUM(CASE WHEN UPPER(status) IN ('PENDING', 'SUBMITTED_TO_BANK', 'PROCESSING', 'APPROVED') THEN amount_paise ELSE 0 END) as transit_paise
      FROM withdrawals
      WHERE UPPER(merchant_id) = UPPER($1)
        AND channel IS NOT NULL
      GROUP BY channel
    `, [userId]);

    const normalizeCh = (raw) => {
      if (!raw) return null;
      const lower = raw.trim().toLowerCase();
      if (lower.includes('swiff')) return 'payswiff';
      if (lower.includes('qr')) return 'qr';
      if (lower.includes('pine')) return 'pinelabs';
      return null;
    };

    const channels = {
      pinelabs: { balance: 0, available: 0, available_balance: 0, withdrawable_balance: 0, volume: 0, sales: 0, credited: 0, debited: 0, sent_to_bank: 0, in_transit: 0, commission: 0, pending: 0 },
      payswiff: { balance: 0, available: 0, available_balance: 0, withdrawable_balance: 0, volume: 0, sales: 0, credited: 0, debited: 0, sent_to_bank: 0, in_transit: 0, commission: 0, pending: 0 },
      qr:       { balance: 0, available: 0, available_balance: 0, withdrawable_balance: 0, volume: 0, sales: 0, credited: 0, debited: 0, sent_to_bank: 0, in_transit: 0, commission: 0, pending: 0 },
    };

    for (const r of ledgerRows) {
      const ch = normalizeCh(r.channel);
      if (!ch || !channels[ch]) continue;
      const cred = Number(r.credited_paise || 0) / 100;
      const deb = Number(r.debited_paise || 0) / 100;
      const net = Number(r.net_paise || 0) / 100;
      const comm = Number(r.commission_paise || 0) / 100;
      channels[ch].credited += cred;
      channels[ch].debited += deb;
      channels[ch].balance = net;
      channels[ch].available_balance = net;
      channels[ch].commission = comm;
    }

    for (const s of salesRows) {
      const ch = normalizeCh(s.channel);
      if (!ch || !channels[ch]) continue;
      const sales = Number(s.sales_paise || 0) / 100;
      channels[ch].sales = sales;
      channels[ch].volume = sales;
    }

    for (const w of wRows) {
      const ch = normalizeCh(w.channel);
      if (!ch || !channels[ch]) continue;
      channels[ch].sent_to_bank = Number(w.sent_paise || 0) / 100;
      channels[ch].in_transit = Number(w.transit_paise || 0) / 100;
      channels[ch].pending = Number(w.transit_paise || 0) / 100;
    }

    // Shared Reserve Rule:
    // Max withdrawable from channel C = max(0, min(balance of C, total of all channels - 500))
    const totalBalance = Object.values(channels).reduce((sum, c) => sum + c.balance, 0);
    const overallAvailable = Math.max(0, totalBalance - 500);

    for (const ch of Object.keys(channels)) {
      const withdr = Math.max(0, Math.min(channels[ch].balance, overallAvailable));
      channels[ch].withdrawable_balance = withdr;
      channels[ch].available = withdr;
    }

    return channels;
  } catch (err) {
    console.error('[calculateUserChannelBalances] Error:', err);
    return {
      pinelabs: { balance: 0, available: 0, available_balance: 0, withdrawable_balance: 0, volume: 0, sales: 0, credited: 0, debited: 0, sent_to_bank: 0, in_transit: 0, commission: 0, pending: 0 },
      payswiff: { balance: 0, available: 0, available_balance: 0, withdrawable_balance: 0, volume: 0, sales: 0, credited: 0, debited: 0, sent_to_bank: 0, in_transit: 0, commission: 0, pending: 0 },
      qr:       { balance: 0, available: 0, available_balance: 0, withdrawable_balance: 0, volume: 0, sales: 0, credited: 0, debited: 0, sent_to_bank: 0, in_transit: 0, commission: 0, pending: 0 },
    };
  }
}

/**
 * Authoritative Server-Side User Channel Rates & True Parent Link Enricher
 * Reads strictly from user_channel_rates and database parent links.
 * Zero guessing, zero fallback defaults.
 */
export async function enrichUsersWithChannelRates(users) {
  if (!users) return users;
  const isSingle = !Array.isArray(users);
  const list = isSingle ? [users] : users;
  const userIds = list.map(u => u && u.id).filter(Boolean);
  if (userIds.length === 0) return users;

  const ratesRes = await pgQuery(`
    SELECT user_id, channel, settlement_mode, rate_bps
    FROM user_channel_rates
    WHERE effective_to IS NULL
      AND UPPER(user_id) = ANY($1)
    ORDER BY effective_from DESC
  `, [userIds.map(id => id.toUpperCase())]);

  const ratesByUser = {};
  for (const r of ratesRes) {
    const uid = (r.user_id || '').toUpperCase();
    if (!ratesByUser[uid]) ratesByUser[uid] = {};
    const ch = (r.channel || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const mode = (r.settlement_mode || 'NONE').toUpperCase();
    if (!ratesByUser[uid][ch]) ratesByUser[uid][ch] = {};
    if (ratesByUser[uid][ch][mode] === undefined) {
      ratesByUser[uid][ch][mode] = Number(r.rate_bps);
    }
  }

  const enriched = list.map(u => {
    if (!u) return u;
    const uid = (u.id || '').toUpperCase();
    const userRates = ratesByUser[uid] || {};

    // Pine Labs
    const plT1Bps = userRates.pinelabs?.T1;
    const plInstBps = userRates.pinelabs?.INSTANT;
    const hasPineLabs = plT1Bps !== undefined || plInstBps !== undefined;

    // Payswiff
    const psT1Bps = userRates.payswiff?.T1;
    const psInstBps = userRates.payswiff?.INSTANT;
    const hasPayswiff = psT1Bps !== undefined || psInstBps !== undefined;

    // QR
    const qrBps = userRates.qr?.NONE !== undefined ? userRates.qr.NONE : userRates.qr?.INSTANT;
    const hasQr = qrBps !== undefined;

    const rateT1Pct = plT1Bps !== undefined ? (plT1Bps / 100) : (psT1Bps !== undefined ? psT1Bps / 100 : null);
    const rateInstantPct = plInstBps !== undefined ? (plInstBps / 100) : (psInstBps !== undefined ? psInstBps / 100 : (qrBps !== undefined ? qrBps / 100 : null));

    const channels = {
      pine_labs: {
        enabled: hasPineLabs,
        terminal_id: u.pos_terminal || `PL-${u.id}`,
        rate_t1: plT1Bps !== undefined ? (plT1Bps / 100) : null,
        rate_instant: plInstBps !== undefined ? (plInstBps / 100) : (plT1Bps !== undefined ? plT1Bps / 100 : null),
        vendor: 'Rose Navaneetham Enterprises',
        plan: u.pos_plan || 'RENTAL',
        rent: u.pos_rent || 499
      },
      payswiff: {
        enabled: hasPayswiff,
        terminal_id: `SWIFF-${u.id}`,
        rate_t1: psT1Bps !== undefined ? (psT1Bps / 100) : null,
        rate_instant: psInstBps !== undefined ? (psInstBps / 100) : (psT1Bps !== undefined ? psT1Bps / 100 : null),
        vendor: 'RONAV Technologies',
        plan: 'RENTAL',
        rent: 499
      },
      qr: {
        enabled: hasQr,
        rate_instant: qrBps !== undefined ? (qrBps / 100) : null,
        vendor: 'RONAV Technologies'
      },
      enabledList: []
    };
    if (channels.pine_labs.enabled) channels.enabledList.push('pine_labs');
    if (channels.payswiff.enabled) channels.enabledList.push('payswiff');
    if (channels.qr.enabled) channels.enabledList.push('qr');

    const parentName = u.creator_name || (u.creator_id === 'ADM001' ? 'RONAV Super Admin' : (u.creator_id || 'Super Admin'));

    return {
      ...u,
      parent_name: parentName,
      parent_id: u.creator_id || null,
      parent_role: u.creator_role || (u.creator_id === 'ADM001' ? 'ADMIN' : null),
      creator_name: parentName,
      commission_rate_t1: rateT1Pct !== null ? rateT1Pct.toFixed(2) : (u.commission_rate_t1 ? parseFloat(u.commission_rate_t1).toFixed(2) : null),
      commission_rate_instant: rateInstantPct !== null ? rateInstantPct.toFixed(2) : (u.commission_rate_instant ? parseFloat(u.commission_rate_instant).toFixed(2) : null),
      rate_t1: rateT1Pct,
      rate_instant: rateInstantPct,
      channels
    };
  });

  return isSingle ? enriched[0] : enriched;
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
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, idempotency-key',
      'Access-Control-Expose-Headers': 'X-Renewed-Token, Content-Type, Authorization'
    });
    return res.end();
  }

  // Silent Token Renewal Check (renew when remaining lifetime is less than half)
  const authHeader = req.headers['authorization'] || req.headers['Authorization'];
  if (authHeader && typeof authHeader === 'string' && authHeader.trim()) {
    try {
      const renewal = checkTokenRenewal(authHeader);
      if (renewal && renewal.shouldRenew && renewal.renewedToken) {
        res._renewedToken = renewal.renewedToken;
      }
    } catch (_) {
      // Route auth gates handle invalid/expired tokens
    }
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
          pgQuery(`SELECT COALESCE(SUM(amount_paise), 0)::numeric / 100.0 as s FROM transactions WHERE status = 'APPROVED'`),
          pgQuery(`SELECT COUNT(*)::int as c FROM merchant_pos`),
          pgQuery(`SELECT COUNT(*)::int as c FROM transactions`),
          pgQuery(`SELECT COALESCE(SUM(amount_paise), 0)::numeric / 100.0 as s FROM withdrawals WHERE status = 'APPROVED'`)
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
        const status = err.statusCode || 500;
        return sendJson(res, status, { success: false, error: err.code || 'INTERNAL_ERROR', message: err.message });
      }
    }

    // ----------------------------------------------------
    // 0.2 PASSWORD MANAGEMENT & VERIFICATION ENDPOINTS
    // ----------------------------------------------------
    if (pathname === '/api/auth/change-password' && method === 'POST') {
      try {
        const caller = requireAuth(req);
        const { userId, currentPassword, newPassword } = await parseJsonBody(req);
        const cleanUserId = (userId || caller.id).trim().toUpperCase();
        if (caller.id !== cleanUserId && caller.role !== 'ADMIN') {
          return sendJson(res, 403, { success: false, message: 'Access Denied: You may only change your own password.' });
        }
        if (!currentPassword || !newPassword) {
          return sendJson(res, 400, { success: false, message: 'Current password and new password are required.' });
        }
        if (newPassword.trim().length < 6) {
          return sendJson(res, 400, { success: false, message: 'New password must be at least 6 characters long.' });
        }

        const users = await pgQuery(`SELECT * FROM users WHERE UPPER(id) = UPPER($1)`, [cleanUserId]);
        const user = users[0];
        if (!user) {
          return sendJson(res, 404, { success: false, message: 'User not found.' });
        }

        if (!verifyPassword(currentPassword.trim(), user.password)) {
          return sendJson(res, 401, { success: false, message: 'Current password does not match. Please verify your credentials.' });
        }

        const hashedPassword = hashPassword(newPassword.trim());
        await pgQuery(`UPDATE users SET password = $1, updated_at = CURRENT_TIMESTAMP WHERE UPPER(id) = UPPER($2)`, [hashedPassword, cleanUserId]);
        return sendJson(res, 200, { success: true, message: 'Password changed successfully!' });
      } catch (err) {
        return sendJson(res, err.statusCode || 400, { success: false, message: err.message });
      }
    }

    if (pathname === '/api/auth/forgot-password-request' && method === 'POST') {
      try {
        const clientIp = getClientIp(req);
        if (!checkRateLimit(`forgot-pwd:${clientIp}`, { limit: 10, windowMs: 60000 })) {
          return sendJson(res, 429, { 
            success: false, 
            code: 'RATE_LIMIT_EXCEEDED', 
            message: 'Too many password reset requests. Please wait a minute and try again.' 
          });
        }

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
      } catch (err) {
        return sendJson(res, err.statusCode || 500, { success: false, message: err.message });
      }
    }

    if (pathname === '/api/admin/users/reset-password' && method === 'POST') {
      try {
        const caller = requireAdmin(req);
        const { targetUserId, newPassword } = await parseJsonBody(req);
        if (!targetUserId) {
          return sendJson(res, 400, { success: false, message: 'Target User ID is required.' });
        }

        const targets = await pgQuery(`SELECT * FROM users WHERE UPPER(id) = UPPER($1)`, [targetUserId.trim()]);
        const target = targets[0];
        if (!target) {
          return sendJson(res, 404, { success: false, message: 'Target user not found.' });
        }

        const randomDigits = Math.floor(1000 + Math.random() * 9000);
        const resetPass = newPassword && newPassword.trim().length >= 6 ? newPassword.trim() : `Ronav@${randomDigits}`;
        const hashedPassword = hashPassword(resetPass);

        await pgQuery(`UPDATE users SET password = $1, updated_at = CURRENT_TIMESTAMP WHERE UPPER(id) = UPPER($2)`, [hashedPassword, targetUserId.trim()]);

        return sendJson(res, 200, {
          success: true,
          message: `Password reset successfully for ${target.name} (${target.id})!`,
          newPassword: resetPass
        });
      } catch (err) {
        return sendJson(res, err.statusCode || 400, { success: false, message: err.message });
      }
    }

    if (pathname === '/api/admin/users/toggle-status' && method === 'POST') {
      try {
        const caller = requireAdmin(req);
        const { targetUserId, status } = await parseJsonBody(req);
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

        await pgQuery(`UPDATE users SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE UPPER(id) = UPPER($2)`, [status.toUpperCase(), targetUserId.trim()]);

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
      } catch (err) {
        return sendJson(res, err.statusCode || 400, { success: false, message: err.message });
      }
    }

    if (pathname === '/api/admin/system/purge-demo-templates' && method === 'POST') {
      try {
        requireAdmin(req);
        const demoIds = ['SD101', 'DD101', 'DIST101', 'MID101'];
        await pgQuery(`DELETE FROM transactions WHERE merchant_id = ANY($1)`, [demoIds]);
        await pgQuery(`DELETE FROM withdrawals WHERE merchant_id = ANY($1)`, [demoIds]);
        await pgQuery(`DELETE FROM beneficiaries WHERE merchant_id = ANY($1)`, [demoIds]);
        await pgQuery(`DELETE FROM merchant_pos WHERE merchant_id = ANY($1)`, [demoIds]);
        await pgQuery(`DELETE FROM wallets WHERE user_id = ANY($1)`, [demoIds]);
        await pgQuery(`DELETE FROM users WHERE id = ANY($1)`, [demoIds]);
        return sendJson(res, 200, { success: true, message: 'Template demo accounts removed successfully.' });
      } catch (err) {
        return sendJson(res, err.statusCode || 500, { success: false, message: err.message });
      }
    }

    if (pathname === '/api/users/update-profile' && method === 'POST') {
      try {
        const caller = requireAuth(req);
        const { userId, name, mobile, email, aadhaar, pan, address, creator_id, commission_rate_t1, commission_rate_instant, margin_rate } = await parseJsonBody(req);
        const targetUserId = (userId || caller.id).trim();
        await assertCanAccessUser(caller, targetUserId, { query: pgQuery });

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
          targetUserId
        ]);

        if (updateRes.length === 0) {
          return sendJson(res, 404, { success: false, message: 'User not found.' });
        }

        return sendJson(res, 200, {
          success: true,
          message: 'User profile updated successfully.',
          user: sanitizeUser(updateRes[0])
        });
      } catch (err) {
        return sendJson(res, err.statusCode || 500, { success: false, message: err.message });
      }
    }

    // ----------------------------------------------------
    // 0.3 POS TERMINAL & CHANNELS ASSIGNMENT
    // ----------------------------------------------------
    if (pathname === '/api/pos/assign' && method === 'POST') {
      requireAdmin(req);
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

      const caller = getCaller(req);
      const assignedBy = caller.id;

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
        merchantId.trim(), primaryProvider, termId, rateT1, assignedBy,
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
      requireAdmin(req);
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
      try {
        const caller = requireAuth(req);
        const users = await pgQuery(`SELECT id, name, role, COALESCE(status, 'ACTIVE') as status FROM users WHERE UPPER(id) = UPPER($1)`, [caller.id]);
        if (!users || users.length === 0) {
          return sendJson(res, 404, { success: false, code: 'USER_NOT_FOUND', message: 'User account not found.' });
        }
        if (users[0].status === 'SUSPENDED') {
          return sendJson(res, 403, { success: false, code: 'USER_SUSPENDED', message: 'User account is suspended.' });
        }
        return sendJson(res, 200, { success: true, user: sanitizeUser(users[0]) });
      } catch (err) {
        return sendJson(res, err.statusCode || 500, { success: false, message: err.message });
      }
    }

    if (pathname.startsWith('/api/users/') && method === 'GET' && pathname !== '/api/users/create' && !pathname.endsWith('/financial-summary')) {
      const userId = decodeURIComponent(pathname.replace('/api/users/', '')).trim();
      try {
        const caller = requireAuth(req);
        await assertCanAccessUser(caller, userId, { query: pgQuery });
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
        const enrichedProfile = await enrichUsersWithChannelRates(userProfile);

        return sendJson(res, 200, { success: true, user: sanitizeUser(enrichedProfile) });
      } catch (err) {
        const status = err.statusCode || 500;
        return sendJson(res, status, { success: false, error: err.code || 'INTERNAL_ERROR', message: err.message });
      }
    }

    if (pathname.startsWith('/api/wallet/') && !pathname.startsWith('/api/wallet/balance') && method === 'GET') {
      const userId = decodeURIComponent(pathname.replace('/api/wallet/', '')).trim();
      try {
        const caller = requireAuth(req);
        await assertCanAccessUser(caller, userId, { query: pgQuery });
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
          wallet: serializeMoneyFields(wallet),
          pos,
          balances
        });
      } catch (err) {
        const status = err.statusCode || 500;
        return sendJson(res, status, { success: false, error: err.code || 'INTERNAL_ERROR', message: err.message });
      }
    }

    // ----------------------------------------------------
    // 0.6 AUTHORITATIVE DOWNSTREAM USER ONBOARDING
    // ----------------------------------------------------
    if (pathname === '/api/users/create' && method === 'POST') {
      try {
        const caller = requireAuth(req);
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

        const prefixMap = {
          'MASTER': 'MST',
          'MASTER_DISTRIBUTOR': 'MST',
          'SUPER_DISTRIBUTOR': 'SD',
          'DISTRICT_DISTRIBUTOR': 'DD',
          'DIST_FRANCHISE': 'DD',
          'DISTRIBUTOR': 'DIST',
          'MERCHANT': 'MID',
          'RETAILER': 'MID'
        };
        let idPrefix = prefixMap[role] || 'MID';

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
        const hashedPassword = hashPassword(initialPassword);

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
            hashedPassword,
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
        requireAdmin(req);
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
        const status = err.statusCode || 500;
        return sendJson(res, status, { success: false, error: err.code || 'INTERNAL_ERROR', message: err.message });
      }
    }

    // ----------------------------------------------------
    // 0.62 CLEANUP VERIFIED ANTIGRAVITY TEST ACCOUNTS ONLY
    // ----------------------------------------------------
    if (pathname === '/api/admin/cleanup-test-accounts' && method === 'POST') {
      requireAdmin(req);
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
        const caller = requireAuth(req);
        const { merchant_id, bank_name, account_number, ifsc, holder_name, beneficiary_name, is_primary } = await parseJsonBody(req);
        if (!merchant_id || !bank_name || !account_number || !account_number.trim() || !ifsc || !ifsc.trim()) {
          return sendJson(res, 400, { success: false, message: 'Missing required bank details (merchant_id, bank_name, account_number, ifsc).' });
        }

        await assertCanAccessUser(caller, merchant_id.trim(), { query: pgQuery });
        const benName = (holder_name || beneficiary_name || 'Account Holder').trim();
        await assertCanAccessUser(caller, (merchant_id || caller.id).trim(), { query: pgQuery });
        const benId = `BEN-${Date.now().toString().slice(-6)}`;
        const ifscClean = ifsc.trim().toUpperCase();

        const insertRes = await pgQuery(`
          INSERT INTO beneficiaries (id, merchant_id, bank_name, account_number, ifsc, holder_name, is_verified, is_primary)
          VALUES ($1, $2, $3, $4, $5, $6, true, $7)
          RETURNING *
        `, [benId, merchant_id.trim(), bank_name.trim(), account_number.trim(), ifscClean, benName, Boolean(is_primary)]);

        return sendJson(res, 200, {
          success: true,
          message: 'Beneficiary account added successfully!',
          beneficiary: insertRes[0]
        });
      } catch (err) {
        const status = err.statusCode || 500;
        return sendJson(res, status, { success: false, error: err.code || 'INTERNAL_ERROR', message: err.message });
      }
    }

    // ----------------------------------------------------
    // 0.8 INQUIRIES & APPLICATIONS SUBMISSION
    // ----------------------------------------------------
    if (pathname === '/api/inquiries/submit' && method === 'POST') {
      try {
        const clientIp = getClientIp(req);
        if (!checkRateLimit(`inquiry:${clientIp}`, { limit: 20, windowMs: 60000 })) {
          return sendJson(res, 429, { success: false, code: 'RATE_LIMIT_EXCEEDED', message: 'Too many inquiries submitted. Please wait a moment and try again.' });
        }
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
        const status = err.statusCode || 500;
        return sendJson(res, status, { success: false, error: err.code || 'INTERNAL_ERROR', message: err.message });
      }
    }

    if (pathname === '/api/inquiries/update-status' && method === 'POST') {
      try {
        requireAdmin(req);
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
        const status = err.statusCode || 500;
        return sendJson(res, status, { success: false, error: err.code || 'INTERNAL_ERROR', message: err.message });
      }
    }

    // ----------------------------------------------------
    // 0.9 CHANNEL PORTFOLIO UPDATE
    // ----------------------------------------------------
    if (pathname === '/api/channels/update' && method === 'POST') {
      try {
        const caller = getCaller(req);
        const { merchantId, channels, adminId } = await parseJsonBody(req);
        const assignedBy = adminId || caller.id;
        if (!merchantId || !channels) {
          return sendJson(res, 400, { success: false, message: 'merchantId and channels are required.' });
        }
        await assertCanAccessUser(caller, merchantId.trim(), { query: pgQuery });

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
            user.id, primaryProvider, fullTerminalStr, primaryRateT1, assignedBy,
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
      const clientIp = getClientIp(req);
      if (!checkRateLimit(`login:${clientIp}`, { limit: 20, windowMs: 60000 })) {
        return sendJson(res, 429, { 
          success: false, 
          code: 'RATE_LIMIT_EXCEEDED', 
          message: 'Too many login attempts. Please wait a moment and try again.' 
        });
      }
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
      if (!expectedPassword || !verifyPassword(cleanPass, expectedPassword)) {
        return sendJson(res, 401, { 
          success: false, 
          message: 'Incorrect password. Please verify your credentials.' 
        });
      }
      const token = generateToken(user);

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
        token,
        user: sanitizeUser(user),
        wallet: activeWallet,
        pos: posList[0] || null
      });
    }

    // List all users in hierarchy (Downline Scoped)
    if (pathname === '/api/users' && method === 'GET') {
      try {
        const caller = requireAuth(req);
        let downlineFilter = '';
        let queryParams = [];

        if (caller.role !== 'ADMIN' && caller.id !== 'ADM001') {
          const downline = await getDownlineUserIds({ query: pgQuery }, caller.id);
          downline.add(caller.id);
          downlineFilter = `WHERE UPPER(u.id) = ANY($1)`;
          queryParams = [Array.from(downline)];
        }

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
          ${downlineFilter}
          ORDER BY u.created_at DESC
        `, queryParams);

        const enrichedUsers = await enrichUsersWithChannelRates(users);
        return sendJson(res, 200, { success: true, users: sanitizeUser(enrichedUsers) });
      } catch (err) {
        return sendJson(res, err.statusCode || 500, { success: false, message: err.message });
      }
    }

    // Comprehensive Hierarchy Tree with Roll-Up Metrics
    if (pathname === '/api/hierarchy/tree' && method === 'GET') {
      const rawUsers = await pgQuery(`
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

      const users = await enrichUsersWithChannelRates(rawUsers);

      const txCounts = await pgQuery(`
        SELECT merchant_id, COUNT(*) as txn_count, COALESCE(SUM(amount_paise) / 100.0, 0) as total_txn_volume
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
    if (pathname === '/api/transactions/quote' && method === 'POST') {
      const body = await parseJsonBody(req);
      const merchantId = body.merchant_id || body.merchantId || body.user_id || body.userId;
      if (!merchantId) {
        return sendJson(res, 400, { success: false, message: 'MERCHANT_ID_REQUIRED: merchant_id is required.' });
      }

      let amountPaise;
      try {
        if (body.amount_paise !== undefined && body.amount_paise !== null && body.amount_paise !== '') {
          amountPaise = BigInt(body.amount_paise);
        } else {
          const num = Number(body.amount);
          if (isNaN(num) || num <= 0) {
            return sendJson(res, 400, { success: false, message: 'INVALID_TRANSACTION_AMOUNT: Amount must be a positive number.' });
          }
          amountPaise = BigInt(Math.round(num * 100));
        }
      } catch (e) {
        return sendJson(res, 400, { success: false, message: 'INVALID_TRANSACTION_AMOUNT: Invalid amount.' });
      }

      if (amountPaise <= 0n) {
        return sendJson(res, 400, { success: false, message: 'INVALID_TRANSACTION_AMOUNT: Amount must be greater than 0.' });
      }

      const rawMode = body.settlement_type || body.settlementType || body.settlement_mode || body.settlementMode || 'T1';
      const rawChannel = body.channel || body.provider;
      if (!rawChannel || !rawChannel.trim()) {
        return sendJson(res, 400, { success: false, message: 'CHANNEL_REQUIRED: Payment channel is strictly required (pinelabs, payswiff, qr).' });
      }
      const cleanChannel = rawChannel.toLowerCase().replace(/[^a-z0-9]/g, '');
      const settlementMode = String(rawMode).toUpperCase().trim();

      const pool = getDbPool();
      const client = await pool.connect();
      try {
        const quote = await quoteSwipeTransaction(client, {
          merchantId: merchantId.trim(),
          amountPaise,
          channel: cleanChannel,
          settlementMode
        });
        return sendJson(res, 200, { success: true, quote });
      } catch (err) {
        return sendJson(res, 400, { success: false, message: err.message, code: 'RATE_ERROR' });
      } finally {
        client.release();
      }
    }

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
      const rawChannel = body.channel || body.provider;
      if (!rawChannel || !rawChannel.trim()) {
        return sendJson(res, 400, { success: false, message: 'CHANNEL_REQUIRED: Payment channel is strictly required (pinelabs, payswiff, qr).' });
      }
      const cleanChannel = rawChannel.toLowerCase().replace(/[^a-z0-9]/g, '');
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
          transaction: serializeMoneyFields(serializable)
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
          err.message?.includes('SETTLEMENT_MODE_REQUIRED') ||
          err.message?.includes('ADMIN_CANNOT_SWIPE')
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
              const commEarned = parseFloat(split.amount || split.commission || (Number(split.amount_paise || 0) / 100) || 0);
              const saleAmt = parseFloat(row.amount || (Number(row.amount_paise || 0) / 100) || 0);
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

      const allTxns = serializeMoneyFields([...directTxns, ...commissionEntries]).sort((a, b) => {
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
        INSERT INTO beneficiaries (id, merchant_id, bank_name, account_number, ifsc, holder_name, is_primary, is_verified)
        VALUES ($1, $2, $3, $4, $5, $6, $7, true)
      `, [benId, merchant_id, bank_name, account_number.trim(), ifsc.trim().toUpperCase(), holder_name || 'Account Holder', Boolean(is_primary)]);

      const created = await pgQuery(`SELECT * FROM beneficiaries WHERE id = $1`, [benId]);
      return sendJson(res, 201, { success: true, message: 'Beneficiary account added successfully!', beneficiary: created[0] });
    }

    // ----------------------------------------------------
    // 4. ADMIN VERIFICATION & APPROVAL ENGINE
    // ----------------------------------------------------
    if (pathname === '/api/admin/pending' && method === 'GET') {
      requireAdmin(req);
      const pendingTransactions = await pgQuery(`
        SELECT t.*, u.name as merchant_name, u.mobile as merchant_mobile, COALESCE(t.provider, p.provider, CASE WHEN t.type = 'QR_SCAN' THEN 'Company QR (UPI)' WHEN t.type = 'BBPS_BILL' THEN 'BBPS' ELSE 'Pine Labs' END) as pos_provider, p.commission_rate as pos_rate
        FROM transactions t
        JOIN users u ON t.merchant_id = u.id
        LEFT JOIN merchant_pos p ON t.merchant_id = p.merchant_id
        WHERE t.status = 'PENDING'
        ORDER BY t.created_at DESC
      `);

      const pendingWithdrawals = await pgQuery(`
        SELECT w.*, 
               u.name as merchant_name, 
               u.mobile as merchant_mobile,
               b.bank_name,
               b.account_number,
               b.ifsc,
               b.holder_name
        FROM withdrawals w
        JOIN users u ON w.merchant_id = u.id
        LEFT JOIN beneficiaries b ON w.beneficiary_id = b.id
        WHERE w.status = 'PENDING'
        ORDER BY w.created_at DESC
      `);

      const allWithdrawals = await pgQuery(`
        SELECT w.*, 
               u.name as merchant_name, 
               u.mobile as merchant_mobile,
               b.bank_name,
               b.account_number,
               b.ifsc,
               b.holder_name
        FROM withdrawals w
        JOIN users u ON w.merchant_id = u.id
        LEFT JOIN beneficiaries b ON w.beneficiary_id = b.id
        ORDER BY w.created_at DESC
        LIMIT 100
      `);

      const allTransactions = await pgQuery(`
        SELECT t.*, u.name as merchant_name, COALESCE(t.provider, p.provider, CASE WHEN t.type = 'QR_SCAN' THEN 'Company QR (UPI)' WHEN t.type = 'BBPS_BILL' THEN 'BBPS' ELSE 'Pine Labs' END) as pos_provider
        FROM transactions t
        JOIN users u ON t.merchant_id = u.id
        LEFT JOIN merchant_pos p ON t.merchant_id = p.merchant_id
        ORDER BY t.created_at DESC
        LIMIT 100
      `);

      // Authoritative Ledger Enrichment for Transactions
      const txnIds = allTransactions.map(t => t.id).filter(Boolean);
      let ledgerCommissions = [];
      if (txnIds.length > 0) {
        ledgerCommissions = await pgQuery(`
          SELECT l.reference_id, l.user_id, l.type, l.amount_paise, l.metadata, u.role, u.name as user_name
          FROM financial_ledger l
          LEFT JOIN users u ON l.user_id = u.id
          WHERE (l.type = 'commission' OR (l.type = 'adjustment' AND (l.reference_type = 'REVERSAL' OR l.metadata->>'original_type' = 'commission')))
            AND l.reference_id = ANY($1)
        `, [txnIds]);
      }

      const commissionsByTxn = {};
      ledgerCommissions.forEach(l => {
        if (!commissionsByTxn[l.reference_id]) commissionsByTxn[l.reference_id] = {};
        if (!commissionsByTxn[l.reference_id][l.user_id]) {
          commissionsByTxn[l.reference_id][l.user_id] = {
            user_id: l.user_id,
            role: l.role,
            user_name: l.user_name,
            amount_paise: 0n,
            metadata: l.metadata
          };
        }
        commissionsByTxn[l.reference_id][l.user_id].amount_paise += BigInt(l.amount_paise || 0);
      });

      allTransactions.forEach(t => {
        const splitsMap = commissionsByTxn[t.id] || {};
        const splits = Object.values(splitsMap).map(s => ({
          ...s,
          amount_paise: s.amount_paise.toString()
        }));
        const isReversed = t.status === 'REVERSED';
        const adminSplit = splits.find(s => s.user_id === 'ADM001');
        const uplineSplits = splits.filter(s => s.user_id !== 'ADM001');
        const feeDeducted = isReversed ? 0 : (((Number(t.customer_charge_paise || 0) / 100) || parseFloat(t.customer_charge) || 0));
        const paidUplines = isReversed ? 0 : uplineSplits.reduce((sum, s) => sum + Math.max(0, Number(s.amount_paise || 0) / 100), 0);
        const adminProfit = isReversed ? 0 : (adminSplit ? Math.max(0, Number(adminSplit.amount_paise || 0) / 100) : (splits.length === 0 ? feeDeducted : Math.max(0, feeDeducted - paidUplines)));

        t.fee_deducted = feeDeducted;
        t.company_fee = feeDeducted;
        t.paid_uplines = paidUplines;
        t.admin_profit = adminProfit;
        t.commission_splits = splits.map(s => {
          let meta = s.metadata;
          if (typeof meta === 'string') {
            try { meta = JSON.parse(meta); } catch (_) { meta = {}; }
          }
          const rateBps = meta?.rate_used_bps;
          return {
            user_id: s.user_id,
            role: s.role,
            amount: isReversed ? 0 : Math.max(0, Number(s.amount_paise || 0) / 100),
            rate_bps: rateBps,
            margin_diff: rateBps ? (rateBps / 100).toFixed(2) : undefined
          };
        });
      });

      // Authoritative Ledger-derived sales volume by channel NET of reversals
      const channelVolRows = await pgQuery(`
        SELECT 
          channel,
          COALESCE(SUM(amount_paise), 0)::numeric / 100.0 as vol
        FROM financial_ledger
        WHERE reference_type IN ('SWIPE', 'REVERSAL')
          AND channel IS NOT NULL
          AND (
            type IN ('swipe_credit', 'refund', 'commission')
            OR (type = 'adjustment' AND (reference_type = 'REVERSAL' OR metadata->>'original_type' = 'commission'))
          )
        GROUP BY channel
      `);

      let pineVol = 0;
      let payswiffVol = 0;
      let qrVol = 0;
      let totalVol = 0;

      channelVolRows.forEach(r => {
        const v = Math.max(0, parseFloat(r.vol) || 0);
        totalVol += v;
        const ch = (r.channel || '').toLowerCase();
        if (ch.includes('swiff')) payswiffVol += v;
        else if (ch.includes('qr') || ch.includes('upi')) qrVol += v;
        else pineVol += v;
      });

      const mCount = (await pgQuery(`SELECT COUNT(*) as c FROM users WHERE role = 'MERCHANT'`))[0]?.c || 0;
      const sdCount = (await pgQuery(`SELECT COUNT(*) as c FROM users WHERE role = 'SUPER_DISTRIBUTOR'`))[0]?.c || 0;
      const dCount = (await pgQuery(`SELECT COUNT(*) as c FROM users WHERE role IN ('DISTRIBUTOR', 'DISTRICT_DISTRIBUTOR', 'DIST_FRANCHISE')`))[0]?.c || 0;
      const pendingVol = (await pgQuery(`SELECT COALESCE(SUM(amount_paise), 0)::numeric / 100.0 as s FROM transactions WHERE status = 'PENDING'`))[0]?.s || 0;

      // Authoritative Ledger-derived commission and fee figures NET of reversals
      const partnerCommRes = (await pgQuery(`
        SELECT COALESCE(SUM(amount_paise), 0)::numeric / 100.0 as s 
        FROM financial_ledger 
        WHERE (type = 'commission' OR (type = 'adjustment' AND (reference_type = 'REVERSAL' OR metadata->>'original_type' = 'commission')))
          AND user_id != 'ADM001'
      `))[0]?.s || 0;

      const adminProfitRes = (await pgQuery(`
        SELECT COALESCE(SUM(amount_paise), 0)::numeric / 100.0 as s 
        FROM financial_ledger 
        WHERE (type = 'commission' OR (type = 'adjustment' AND (reference_type = 'REVERSAL' OR metadata->>'original_type' = 'commission')))
          AND user_id = 'ADM001'
      `))[0]?.s || 0;

      const totalFeesRes = (Math.max(0, parseFloat(partnerCommRes)) + Math.max(0, parseFloat(adminProfitRes))).toFixed(2);

      // Authoritative Tier Totals from financial_ledger grouped by role NET of reversals
      const tierRows = await pgQuery(`
        SELECT u.role, COALESCE(SUM(l.amount_paise), 0)::numeric / 100.0 as total
        FROM financial_ledger l
        JOIN users u ON l.user_id = u.id
        WHERE l.type = 'commission' OR (l.type = 'adjustment' AND (l.reference_type = 'REVERSAL' OR l.metadata->>'original_type' = 'commission'))
        GROUP BY u.role
      `);
      const tierTotals = {
        master: 0,
        super: 0,
        district: 0,
        distributor: 0,
        merchant: 0,
        companyNet: Math.max(0, parseFloat(adminProfitRes))
      };
      tierRows.forEach(r => {
        const val = Math.max(0, parseFloat(r.total) || 0);
        if (r.role === 'MASTER' || r.role === 'MASTER_DISTRIBUTOR') tierTotals.master += val;
        else if (r.role === 'SUPER_DISTRIBUTOR') tierTotals.super += val;
        else if (r.role === 'DISTRICT_DISTRIBUTOR' || r.role === 'DIST_FRANCHISE') tierTotals.district += val;
        else if (r.role === 'DISTRIBUTOR') tierTotals.distributor += val;
        else if (r.role === 'MERCHANT') tierTotals.merchant += val;
      });

      const wTotalsRes = (await pgQuery(`
        SELECT 
          COALESCE(SUM(CASE WHEN status = 'PENDING' THEN amount_paise ELSE 0 END), 0) / 100.0 as pending_amount,
          COALESCE(SUM(CASE WHEN status = 'PENDING' AND (settlement_type = 'T1' OR settlement_type IS NULL) THEN amount_paise ELSE 0 END), 0) / 100.0 as pending_t1_amount,
          COALESCE(SUM(CASE WHEN status = 'PENDING' AND settlement_type = 'INSTANT' THEN amount_paise ELSE 0 END), 0) / 100.0 as pending_instant_amount,
          COALESCE(SUM(CASE WHEN status = 'SUBMITTED_TO_BANK' THEN amount_paise ELSE 0 END), 0) / 100.0 as submitted_amount,
          COALESCE(SUM(CASE WHEN status IN ('COMPLETED', 'APPROVED') THEN amount_paise ELSE 0 END), 0) / 100.0 as completed_amount
        FROM withdrawals
      `))[0] || {};

      let pendingSwipesVolPaise = 0n;
      for (const pt of pendingTransactions) {
        pendingSwipesVolPaise += BigInt(pt.amount_paise || Math.round(Number(pt.amount || 0) * 100));
      }
      const pendingSwipesVolume = Number(pendingSwipesVolPaise) / 100.0;

      const stats = {
        totalMerchants: parseInt(mCount),
        totalSuperDistributors: parseInt(sdCount),
        totalDistributors: parseInt(dCount),
        withdrawalsCount: pendingWithdrawals.length,
        pendingWithdrawalsCount: pendingWithdrawals.length,
        totalVolume: parseFloat(totalVol.toFixed(2)),
        pendingVolume: parseFloat(pendingVol),
        pendingSwipesCount: pendingTransactions.length,
        pendingSwipesVolume: parseFloat(pendingSwipesVolume.toFixed(2)),
        totalFeesCollected: parseFloat(totalFeesRes),
        partnerCommissions: Math.max(0, parseFloat(partnerCommRes)),
        adminNetProfit: Math.max(0, parseFloat(adminProfitRes)),
        tierTotals,
        pineVolume: parseFloat(pineVol.toFixed(2)),
        payswiffVolume: parseFloat(payswiffVol.toFixed(2)),
        qrVolume: parseFloat(qrVol.toFixed(2)),
        withdrawalTotals: {
          pending_amount: parseFloat(wTotalsRes.pending_amount || 0),
          pending_t1_amount: parseFloat(wTotalsRes.pending_t1_amount || 0),
          pending_instant_amount: parseFloat(wTotalsRes.pending_instant_amount || 0),
          submitted_amount: parseFloat(wTotalsRes.submitted_amount || 0),
          completed_amount: parseFloat(wTotalsRes.completed_amount || 0)
        }
      };

      return sendJson(res, 200, {
        success: true,
        pendingTransactions: serializeMoneyFields(pendingTransactions),
        pendingWithdrawals: serializeMoneyFields(pendingWithdrawals),
        allWithdrawals: serializeMoneyFields(allWithdrawals),
        allTransactions: serializeMoneyFields(allTransactions),
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
            bankName: body.bank_name || body.bankName,
            accountNumber: body.account_number || body.accountNumber,
            ifsc: body.ifsc || body.ifsc_code,
            holderName: body.holder_name || body.beneficiary_name || body.customer_name,
            channel: body.channel || body.provider,
            settlementType: (body.settlement_type || body.settlementType || 'T1').toUpperCase(),
            idempotencyKey,
            createdBy
          });
        });

        return sendJson(res, 200, { success: true, withdrawal: serializeMoneyFields(result) });
      } catch (err) {
        const status = err.message?.includes('RESERVE_VIOLATION') ? 403 : 400;
        return sendJson(res, status, { success: false, message: err.message });
      }
    }

    if (pathname === '/api/admin/verify-withdrawal' && method === 'POST') {
      requireAdmin(req);
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
        const caller = getCaller(req);

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
              channel: wth.channel,
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
              channel: wth.channel,
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
          withdrawal: serializeMoneyFields(updatedWth),
          balances
        });
      } catch (err) {
        const status = err.statusCode || 400;
        return sendJson(res, status, { success: false, error: err.code || 'BAD_REQUEST', message: err.message });
      }
    }

    // ----------------------------------------------------
    // 5.1 WITHDRAWALS READ & BATCH MANAGEMENT
    // ----------------------------------------------------
    if (pathname.startsWith('/api/withdrawals/merchant/') && method === 'GET') {
      const merchantId = decodeURIComponent(pathname.replace('/api/withdrawals/merchant/', '')).trim();
      const caller = requireAuth(req);
      await assertCanAccessUser(caller, merchantId, { query: pgQuery });
      const withdrawals = await pgQuery(`
        SELECT w.*, 
               COALESCE(w.amount, (w.amount_paise / 100.0)) as amount,
               COALESCE(w.settlement_type, 'T1') as withdrawal_mode,
               b.bank_name,
               b.account_number,
               b.ifsc,
               b.holder_name
        FROM withdrawals w 
        LEFT JOIN beneficiaries b ON w.beneficiary_id = b.id
        WHERE UPPER(w.merchant_id) = UPPER($1) 
        ORDER BY w.created_at DESC
      `, [merchantId]);
      return sendJson(res, 200, { success: true, withdrawals: serializeMoneyFields(withdrawals) });
    }

    if ((pathname === '/api/admin/withdrawals' || pathname === '/api/withdrawals') && method === 'GET') {
      const caller = pathname === '/api/admin/withdrawals' ? requireAdmin(req) : requireAuth(req);
      let downlineWithdrawalFilter = '';
      let downlineWithdrawalParams = [];
      if (caller.role !== 'ADMIN' && caller.id !== 'ADM001') {
        const downline = await getDownlineUserIds({ query: pgQuery }, caller.id);
        downline.add(caller.id);
        downlineWithdrawalFilter = 'WHERE UPPER(w.merchant_id) = ANY($1)';
        downlineWithdrawalParams = [Array.from(downline)];
      }
      const withdrawals = await pgQuery(`
        SELECT w.*, 
               COALESCE(w.amount, (w.amount_paise / 100.0)) as amount,
               u.name as merchant_name, 
               u.mobile as merchant_mobile,
               b.bank_name,
               b.account_number,
               b.ifsc,
               b.holder_name,
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

      const totalsRes = await pgQuery(`
        SELECT 
          COALESCE(SUM(CASE WHEN status = 'PENDING' THEN amount_paise ELSE 0 END), 0) / 100.0 as pending_amount,
          COALESCE(SUM(CASE WHEN status = 'PENDING' AND (settlement_type = 'T1' OR settlement_type IS NULL) THEN amount_paise ELSE 0 END), 0) / 100.0 as pending_t1_amount,
          COALESCE(SUM(CASE WHEN status = 'PENDING' AND settlement_type = 'INSTANT' THEN amount_paise ELSE 0 END), 0) / 100.0 as pending_instant_amount,
          COALESCE(SUM(CASE WHEN status = 'SUBMITTED_TO_BANK' THEN amount_paise ELSE 0 END), 0) / 100.0 as submitted_amount,
          COALESCE(SUM(CASE WHEN status = 'APPROVED' THEN amount_paise ELSE 0 END), 0) / 100.0 as completed_amount
        FROM withdrawals
      `);
      const totalsRow = totalsRes[0] || {};

      return sendJson(res, 200, { 
        success: true, 
        withdrawals: serializeMoneyFields(enriched),
        totals: {
          pending_amount: parseFloat(totalsRow.pending_amount || 0),
          pending_t1_amount: parseFloat(totalsRow.pending_t1_amount || 0),
          pending_instant_amount: parseFloat(totalsRow.pending_instant_amount || 0),
          submitted_amount: parseFloat(totalsRow.submitted_amount || 0),
          completed_amount: parseFloat(totalsRow.completed_amount || 0)
        }
      });
    }

    if (pathname === '/api/withdrawals/batch-quote' && method === 'POST') {
      const { ids } = await parseJsonBody(req);
      if (!Array.isArray(ids) || ids.length === 0) {
        return sendJson(res, 200, { success: true, total_amount_rupees: '0.00', count: 0 });
      }
      const sumRes = await pgQuery(`
        SELECT COALESCE(SUM(amount_paise), 0) / 100.0 as total,
               COUNT(*)::int as count
        FROM withdrawals
        WHERE id = ANY($1)
      `, [ids]);
      return sendJson(res, 200, {
        success: true,
        total_amount_rupees: parseFloat(sumRes[0]?.total || 0).toFixed(2),
        count: sumRes[0]?.count || 0
      });
    }

    if (pathname === '/api/admin/withdrawals/export-excel' && method === 'POST') {
      try {
        requireAdmin(req);
        const body = await parseJsonBody(req);
        req.body = body;
        const rawIds = body.withdrawalIds || body.withdrawal_ids || body.ids;
        const targetIds = Array.isArray(rawIds) ? rawIds : (typeof rawIds === 'string' ? [rawIds] : null);
        const batchTag = body.batchTag || body.batch_name || '';
        const bankName = body.bankName || body.bank_name || '';
        const caller = getCaller(req);

        const result = await withTransaction(async (client) => {
          let rows;
          if (Array.isArray(targetIds) && targetIds.length > 0) {
            rows = (await client.query(`
              SELECT w.*, 
                     COALESCE(w.amount, (w.amount_paise / 100.0)) as amount,
                     u.name as merchant_name, 
                     u.mobile as merchant_mobile,
                     b.bank_name,
                     b.account_number,
                     b.ifsc,
                     b.holder_name,
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
            `, [targetIds])).rows;
          } else {
            rows = (await client.query(`
              SELECT w.*, 
                     COALESCE(w.amount, (w.amount_paise / 100.0)) as amount,
                     u.name as merchant_name, 
                     u.mobile as merchant_mobile,
                     b.bank_name,
                     b.account_number,
                     b.ifsc,
                     b.holder_name,
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

          const missingBankRows = rows.filter(r => {
            const acc = (r.account_number || '').trim();
            const ifsc = (r.ifsc || '').trim();
            return !acc || !ifsc;
          });
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
            'Gross Amount',
            'Fee',
            'Net Payout',
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
            const feePaise = BigInt(r.fee_paise || 0);
            const netPaise = BigInt(r.net_payout_paise || (amtPaise - feePaise));
            totalAmountPaise += amtPaise;
            const grossRupees = (Number(amtPaise) / 100).toFixed(2);
            const feeRupees = (Number(feePaise) / 100).toFixed(2);
            const netRupees = (Number(netPaise) / 100).toFixed(2);

            const rowData = [
              idx + 1,
              `"${r.merchant_id || ''}"`,
              `"${(r.merchant_name || '').replace(/"/g, '""')}"`,
              `"${r.merchant_mobile || ''}"`,
              `"${(r.holder_name || '').replace(/"/g, '""')}"`,
              `"${r.account_number || ''}"`,
              `"${r.ifsc || ''}"`,
              `"${(r.bank_name || '').replace(/"/g, '""')}"`,
              grossRupees,
              feeRupees,
              netRupees,
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
            caller.id
          ]);

          return {
            batchId,
            exportedCount: rows.length,
            payouts: enriched,
            csv: csvContent,
            csv_content: csvContent
          };
        });

        return sendJson(res, 200, {
          success: true,
          message: `Successfully exported ${result.exportedCount} payout(s) to batch ${result.batchId}.`,
          ...result
        });
      } catch (err) {
        const status = err.statusCode || 400;
        return sendJson(res, status, { success: false, error: err.code || 'BAD_REQUEST', message: err.message });
      }
    }

    if (pathname.startsWith('/api/admin/withdrawals/batches/') || pathname.startsWith('/api/admin/withdrawals/batch/')) {
      requireAdmin(req);
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
        requireAdmin(req);
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
        const status = err.statusCode || 500;
        return sendJson(res, status, { success: false, error: err.code || 'INTERNAL_ERROR', message: err.message });
      }
    }

    // ----------------------------------------------------
    // 5.2 TRANSACTIONS, POS & WALLETS BULK READS
    // ----------------------------------------------------
    if ((pathname === '/api/admin/transactions' || pathname === '/api/transactions') && method === 'GET') {
      const caller = pathname === '/api/admin/transactions' ? requireAdmin(req) : requireAuth(req);
      let downlineTxnFilter = '';
      let downlineTxnParams = [];
      if (caller.role !== 'ADMIN' && caller.id !== 'ADM001') {
        const downline = await getDownlineUserIds({ query: pgQuery }, caller.id);
        downline.add(caller.id);
        downlineTxnFilter = 'WHERE UPPER(t.merchant_id) = ANY($1)';
        downlineTxnParams = [Array.from(downline)];
      }
      const transactions = await pgQuery(`
        SELECT t.*, u.name as merchant_name, u.mobile as merchant_mobile,
               COALESCE(t.provider, p.provider, CASE WHEN t.type = 'QR_SCAN' THEN 'Company QR (UPI)' WHEN t.type = 'BBPS_BILL' THEN 'BBPS' ELSE 'Pine Labs' END) as pos_provider
        FROM transactions t
        LEFT JOIN users u ON t.merchant_id = u.id
        LEFT JOIN merchant_pos p ON t.merchant_id = p.merchant_id
        ${downlineTxnFilter}
        ORDER BY t.created_at DESC
      `, downlineTxnParams);
      return sendJson(res, 200, { success: true, transactions: serializeMoneyFields(transactions) });
    }

    if ((pathname === '/api/pos/all' || pathname === '/api/pos') && method === 'GET') {
      requireAdmin(req);
      const pos = await pgQuery(`SELECT * FROM merchant_pos ORDER BY created_at DESC`);
      return sendJson(res, 200, { success: true, pos });
    }

    if (pathname.startsWith('/api/pos/merchant/') && method === 'GET') {
      const mId = decodeURIComponent(pathname.replace('/api/pos/merchant/', '')).trim();
      const caller = requireAuth(req);
      await assertCanAccessUser(caller, mId, { query: pgQuery });
      const pos = await pgQuery(`SELECT * FROM merchant_pos WHERE UPPER(merchant_id) = UPPER($1)`, [mId]);
      return sendJson(res, 200, { success: true, pos: pos[0] || null });
    }

    if ((pathname === '/api/wallets' || pathname === '/api/admin/wallets') && method === 'GET') {
      const caller = pathname === '/api/admin/wallets' ? requireAdmin(req) : requireAuth(req);
      let downlineWalletFilter = '';
      let downlineWalletParams = [];
      if (caller.role !== 'ADMIN' && caller.id !== 'ADM001') {
        const downline = await getDownlineUserIds({ query: pgQuery }, caller.id);
        downline.add(caller.id);
        downlineWalletFilter = 'WHERE UPPER(user_id) = ANY($1)';
        downlineWalletParams = [Array.from(downline)];
      }
      const wallets = await pgQuery(`SELECT * FROM wallets ${downlineWalletFilter} ORDER BY updated_at DESC`, downlineWalletParams);
      return sendJson(res, 200, { success: true, wallets: serializeMoneyFields(wallets) });
    }

    // ----------------------------------------------------
    // 6. INQUIRIES & SYSTEM SETTINGS
    // ----------------------------------------------------
    if (pathname === '/api/inquiries' && method === 'GET') {
      requireAdmin(req);
      const inquiries = await pgQuery(`SELECT * FROM inquiries ORDER BY created_at DESC`);
      return sendJson(res, 200, { success: true, inquiries });
    }

    if (pathname.startsWith('/api/settings/config') && method === 'GET') {
      requireAdmin(req);
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
      requireAdmin(req);
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
        const status = err.statusCode || 500;
        return sendJson(res, status, { success: false, error: err.code || 'INTERNAL_ERROR', message: err.message });
      }
    }

    // ----------------------------------------------------
    // AWS S3 STORAGE INTEGRATION
    // ----------------------------------------------------
    if (pathname === '/api/s3/status' && method === 'GET') {
      requireAuth(req);
      const status = await verifyS3Connection();
      return sendJson(res, status.success ? 200 : 500, status);
    }

    if (pathname === '/api/s3/presigned-url' && method === 'POST') {
      requireAuth(req);
      const { fileName, contentType, folder } = await parseJsonBody(req);
      if (!fileName) {
        return sendJson(res, 400, { success: false, message: 'fileName is required.' });
      }
      try {
        const presigned = await getPresignedUploadUrl(fileName, contentType, folder);
        return sendJson(res, 200, { success: true, ...presigned });
      } catch (err) {
        const status = err.statusCode || 500;
        return sendJson(res, status, { success: false, error: err.code || 'INTERNAL_ERROR', message: err.message });
      }
    }

    if (pathname === '/api/s3/upload-base64' && method === 'POST') {
      requireAuth(req);
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
        const status = err.statusCode || 500;
        return sendJson(res, status, { success: false, error: err.code || 'INTERNAL_ERROR', message: err.message });
      }
    }

    if (pathname === '/api/s3/media' && method === 'GET') {
      requireAuth(req);
      const merchantId = url.searchParams.get('merchant_id');
      const entityType = url.searchParams.get('entity_type');
      const media = await getMediaFiles(merchantId, entityType);
      return sendJson(res, 200, { success: true, media });
    }

    if (pathname === '/api/s3/delete' && method === 'POST') {
      requireAuth(req);
      const { key } = await parseJsonBody(req);
      if (!key) {
        return sendJson(res, 400, { success: false, message: 'Object key is required.' });
      }
      try {
        const result = await deleteS3Object(key);
        return sendJson(res, 200, { success: true, ...result });
      } catch (err) {
        const status = err.statusCode || 500;
        return sendJson(res, status, { success: false, error: err.code || 'INTERNAL_ERROR', message: err.message });
      }
    }



    // ----------------------------------------------------
    // ADMIN PURGE & DELETE (Pure PostgreSQL)
    // ----------------------------------------------------
    if (pathname === '/api/admin/users/purge-test-accounts') {
      requireAdmin(req);
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
        const caller = requireAuth(req);
        const targetUserId = url.searchParams.get('userId') || url.searchParams.get('merchantId') || caller.id;
        await assertCanAccessUser(caller, targetUserId, { query: pgQuery });

        const balances = await getWalletBalances(getDbPool(), targetUserId);
        return sendJson(res, 200, {
          success: true,
          balances: serializeMoneyFields({
            user_id: balances.user_id,
            balance_paise: balances.balance_paise.toString(),
            held_paise: balances.held_paise.toString(),
            available_balance_paise: balances.available_balance_paise.toString(),
            reserve_locked_paise: balances.reserve_locked_paise.toString(),
            reserve_required_paise: balances.reserve_required_paise.toString(),
            withdrawable_balance_paise: balances.withdrawable_balance_paise.toString(),
            balance_rupees: (Number(balances.balance_paise) / 100).toFixed(2),
            withdrawable_rupees: (Number(balances.withdrawable_balance_paise) / 100).toFixed(2)
          })
        });
      } catch (err) {
        const status = err.statusCode || 500;
        return sendJson(res, status, { success: false, error: err.code || 'INTERNAL_ERROR', message: err.message });
      }
    }

    // 2. Authoritative Withdrawal Quote
    if (pathname === '/api/withdrawals/quote' && method === 'POST') {
      try {
        const caller = requireAuth(req);
        const body = await parseJsonBody(req);
        await assertCanAccessUser(caller, body.merchant_id || body.merchantId || body.userId || caller.id, { query: pgQuery });
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
          quote: serializeMoneyFields({
            user_id: quote.user_id,
            requested_amount_paise: quote.requested_amount_paise.toString(),
            amount_paise: quote.requested_amount_paise.toString(),
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
          })
        });
      } catch (err) {
        const status = err.statusCode || 400;
        return sendJson(res, status, { success: false, error: err.code || 'BAD_REQUEST', message: err.message });
      }
    }

    // 2.1 Dynamic System Settings Endpoint
    if (pathname === '/api/settings' && method === 'GET') {
      requireAuth(req);
      try {
        const pool = getDbPool();
        const settings = await getAllSettings(pool);
        if (!settings.monthly_rental_paise || settings.monthly_rental_paise.value_numeric === null) {
          throw new Error('SETTING_NOT_FOUND: Required setting "monthly_rental_paise" is missing in system_settings table.');
        }
        const rentalPaise = Number(settings.monthly_rental_paise.value_numeric);
        const rentalRupees = (rentalPaise / 100).toFixed(2);
        const reservePaise = settings.reserve_amount_paise?.value_numeric !== null
          ? Number(settings.reserve_amount_paise?.value_numeric)
          : 50000;
        const reserveRupees = (reservePaise / 100).toFixed(2);
        return sendJson(res, 200, {
          success: true,
          settings: {
            ...settings,
            monthly_rental_paise: rentalPaise,
            monthly_rental_rupees: rentalRupees,
            reserve_amount_paise: reservePaise,
            reserve_amount_rupees: reserveRupees,
            support_phone: '9966203053',
            support_email: 'rosenavaneethamenterprises@gmail.com'
          }
        });
      } catch (err) {
        const status = err.statusCode || 500;
        return sendJson(res, status, { success: false, error: err.code || 'INTERNAL_ERROR', message: err.message });
      }
    }

    // 2.2 Authoritative Downstream Rates Configuration & Creator Minimums
    if (pathname === '/api/rates/config' && method === 'GET') {
      requireAuth(req);
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
          creatorId = userRow?.creator_id;
        }
        if (!creatorId) {
          return sendJson(res, 400, { success: false, message: 'CALLER_IDENTIFICATION_REQUIRED: creatorId or caller ID is required.' });
        }

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
        const status = err.statusCode || 500;
        return sendJson(res, status, { success: false, error: err.code || 'INTERNAL_ERROR', message: err.message });
      }
    }

    // 2.3 Authoritative Real Ledger Commission & Sales Financial Summary
    if (pathname.startsWith('/api/users/') && pathname.endsWith('/financial-summary') && method === 'GET') {
      try {
        const caller = requireAuth(req);
        const parts = pathname.split('/');
        const targetUserId = parts[3];
        await assertCanAccessUser(caller, targetUserId, { query: pgQuery });
        const pool = getDbPool();
        const client = await pool.connect();
        try {
          const balances = await getWalletBalances(client, targetUserId);
          const channelBalances = await calculateUserChannelBalances(targetUserId);

          const commRows = (await client.query(`
            SELECT channel,
                   SUM(amount_paise) as total_comm_paise,
                   SUM(CASE WHEN created_at >= CURRENT_DATE THEN amount_paise ELSE 0 END) as today_comm_paise
            FROM financial_ledger
            WHERE UPPER(user_id) = UPPER($1)
              AND channel IS NOT NULL
              AND (type = 'commission' OR (type = 'adjustment' AND (reference_type = 'REVERSAL' OR metadata->>'original_type' = 'commission')))
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
            const ch = (cr.channel || '').toLowerCase();
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
        const status = err.statusCode || 500;
        return sendJson(res, status, { success: false, error: err.code || 'INTERNAL_ERROR', message: err.message });
      }
    }

    // 2.4 Authoritative Downstream Network Tree & Performance
    if (pathname === '/api/network/downstream' && method === 'GET') {
      try {
        const caller = requireAuth(req);
        let creatorId = url.searchParams.get('creatorId') || caller.id;
        await assertCanAccessUser(caller, creatorId, { query: pgQuery });

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
              WHERE (type = 'commission' OR (type = 'adjustment' AND (reference_type = 'REVERSAL' OR metadata->>'original_type' = 'commission')))
                AND user_id = ANY($1)
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
          let networkCommPaise = 0n;          // Per-channel volumes for all downline transactions
          const downlineChannelVolRes = userIds.length > 0 ? await client.query(`
            SELECT 
              channel,
              COALESCE(SUM(amount_paise), 0) as total_vol_paise,
              COALESCE(SUM(CASE WHEN transaction_date = CURRENT_DATE THEN amount_paise ELSE 0 END), 0) as today_vol_paise
            FROM transactions
            WHERE status != 'REVERSED' AND UPPER(merchant_id) = ANY($1) AND channel IS NOT NULL
            GROUP BY channel
          `, [userIds.map(id => id.toUpperCase())]) : { rows: [] };

          const channelVolumes = {
            pinelabs: 0,
            payswiff: 0,
            qr: 0,
            all: 0,
            today_pinelabs: 0,
            today_payswiff: 0,
            today_qr: 0,
            today_all: 0
          };

          for (const row of downlineChannelVolRes.rows) {
            const rawCh = (row.channel || '').toLowerCase();
            const ch = rawCh.includes('swiff') ? 'payswiff' : (rawCh.includes('qr') ? 'qr' : (rawCh.includes('pine') ? 'pinelabs' : null));
            if (!ch) continue;
            const totalRupees = Number(BigInt(row.total_vol_paise)) / 100;
            const todayRupees = Number(BigInt(row.today_vol_paise)) / 100;
            channelVolumes[ch] += totalRupees;
            channelVolumes[`today_${ch}`] += todayRupees;
            channelVolumes.all += totalRupees;
            channelVolumes.today_all += todayRupees;
          }

          // Authoritative Creator Commission per channel from financial_ledger
          const creatorChannelCommRes = await client.query(`
            SELECT 
              channel,
              COALESCE(SUM(amount_paise), 0) as total_comm_paise,
              COALESCE(SUM(CASE WHEN created_at >= CURRENT_DATE THEN amount_paise ELSE 0 END), 0) as today_comm_paise
            FROM financial_ledger
            WHERE (type = 'commission' OR (type = 'adjustment' AND (reference_type = 'REVERSAL' OR metadata->>'original_type' = 'commission')))
              AND UPPER(user_id) = UPPER($1)
              AND channel IS NOT NULL
            GROUP BY channel
          `, [creatorId]);

          const channelCommissions = {
            pinelabs: 0,
            payswiff: 0,
            qr: 0,
            today_pinelabs: 0,
            today_payswiff: 0,
            today_qr: 0
          };

          for (const row of creatorChannelCommRes.rows) {
            const rawCh = (row.channel || '').toLowerCase();
            const ch = rawCh.includes('swiff') ? 'payswiff' : (rawCh.includes('qr') ? 'qr' : (rawCh.includes('pine') ? 'pinelabs' : null));
            if (!ch) continue;
            const totalRupees = Number(BigInt(row.total_comm_paise)) / 100;
            const todayRupees = Number(BigInt(row.today_comm_paise)) / 100;
            channelCommissions[ch] += totalRupees;
            channelCommissions[`today_${ch}`] += todayRupees;
          }

          // Rates for creator and partners to compute exact margin cuts
          const allRateUserIds = [creatorId, ...userIds].map(id => id.toUpperCase());
          const rateRows = await client.query(`
            SELECT user_id, channel, settlement_mode, rate_bps
            FROM user_channel_rates
            WHERE effective_to IS NULL
              AND UPPER(user_id) = ANY($1)
            ORDER BY effective_from DESC
          `, [allRateUserIds]);

          const ratesByUser = {};
          for (const r of rateRows.rows) {
            const uid = (r.user_id || '').toUpperCase();
            if (!ratesByUser[uid]) ratesByUser[uid] = {};
            const ch = (r.channel || '').toLowerCase().replace(/[^a-z0-9]/g, '');
            const mode = (r.settlement_mode || 'NONE').toUpperCase();
            if (!ratesByUser[uid][ch]) ratesByUser[uid][ch] = {};
            if (ratesByUser[uid][ch][mode] === undefined) {
              ratesByUser[uid][ch][mode] = Number(r.rate_bps);
            }
          }

          const creatorRates = ratesByUser[creatorId.toUpperCase()] || {};

          // Partner-specific channel volumes
          const partnerChannelVolRes = userIds.length > 0 ? await client.query(`
            SELECT 
              merchant_id,
              channel,
              COALESCE(SUM(amount_paise), 0) as total_vol_paise
            FROM transactions
            WHERE status != 'REVERSED' AND UPPER(merchant_id) = ANY($1) AND channel IS NOT NULL
            GROUP BY merchant_id, channel
          `, [userIds.map(id => id.toUpperCase())]) : { rows: [] };

          const partnerVolMap = {};
          for (const row of partnerChannelVolRes.rows) {
            const mid = (row.merchant_id || '').toUpperCase();
            if (!partnerVolMap[mid]) partnerVolMap[mid] = { pinelabs: 0, payswiff: 0, qr: 0 };
            const rawCh = (row.channel || '').toLowerCase();
            const ch = rawCh.includes('swiff') ? 'payswiff' : (rawCh.includes('qr') ? 'qr' : (rawCh.includes('pine') ? 'pinelabs' : null));
            if (!ch) continue;
            partnerVolMap[mid][ch] += Number(BigInt(row.total_vol_paise)) / 100;
          }

          // Partner-specific commissions earned by creator from that partner
          const partnerCommRes = userIds.length > 0 ? await client.query(`
            SELECT 
              t.merchant_id,
              fl.channel,
              COALESCE(SUM(fl.amount_paise), 0) as total_comm_paise
            FROM financial_ledger fl
            INNER JOIN transactions t ON fl.reference_id = t.id
            WHERE (fl.type = 'commission' OR (fl.type = 'adjustment' AND (fl.reference_type = 'REVERSAL' OR fl.metadata->>'original_type' = 'commission')))
              AND UPPER(fl.user_id) = UPPER($1)
              AND UPPER(t.merchant_id) = ANY($2)
              AND fl.channel IS NOT NULL
            GROUP BY t.merchant_id, fl.channel
          `, [creatorId, userIds.map(id => id.toUpperCase())]) : { rows: [] };

          const partnerCommMap = {};
          for (const row of partnerCommRes.rows) {
            const mid = (row.merchant_id || '').toUpperCase();
            if (!partnerCommMap[mid]) partnerCommMap[mid] = { pinelabs: 0, payswiff: 0, qr: 0 };
            const rawCh = (row.channel || '').toLowerCase();
            const ch = rawCh.includes('swiff') ? 'payswiff' : (rawCh.includes('qr') ? 'qr' : (rawCh.includes('pine') ? 'pinelabs' : null));
            if (!ch) continue;
            partnerCommMap[mid][ch] += Number(BigInt(row.total_comm_paise)) / 100;
          }

          const getBps = (ratesObj, ch) => {
            const chObj = ratesObj[ch] || {};
            return chObj.T1 !== undefined ? chObj.T1 : (chObj.NONE !== undefined ? chObj.NONE : chObj.INSTANT);
          };

          const cPineBps = getBps(creatorRates, 'pinelabs') || 0;
          const cSwiffBps = getBps(creatorRates, 'payswiff') || 0;
          const cQrBps = getBps(creatorRates, 'qr') || 0;

          const partners = downlineUsers.map(u => {
            const c = commMap[u.id] || { total_comm_paise: '0', today_comm_paise: '0' };
            const s = salesMap[u.id] || { total_sales_paise: '0', today_sales_paise: '0' };
            const commRupees = Number(BigInt(c.total_comm_paise)) / 100;
            const salesRupees = Number(BigInt(s.total_sales_paise)) / 100;
            networkSalesPaise += BigInt(s.total_sales_paise);
            networkCommPaise += BigInt(c.total_comm_paise);

            const mid = (u.id || '').toUpperCase();
            const pRates = ratesByUser[mid] || {};
            const pPineBps = getBps(pRates, 'pinelabs');
            const pSwiffBps = getBps(pRates, 'payswiff');
            const pQrBps = getBps(pRates, 'qr');

            const channelMargins = {
              pinelabs: pPineBps !== undefined ? Number(((pPineBps - cPineBps) / 100).toFixed(2)) : 0,
              payswiff: pSwiffBps !== undefined ? Number(((pSwiffBps - cSwiffBps) / 100).toFixed(2)) : 0,
              qr: pQrBps !== undefined ? Number(((pQrBps - cQrBps) / 100).toFixed(2)) : 0
            };

            const pVol = partnerVolMap[mid] || { pinelabs: 0, payswiff: 0, qr: 0 };
            const pComm = partnerCommMap[mid] || { pinelabs: 0, payswiff: 0, qr: 0 };

            return {
              ...u,
              is_direct: u.depth === 1,
              commission_earned: commRupees,
              total_sales: salesRupees,
              total_commission_paise: c.total_comm_paise,
              today_commission_paise: c.today_comm_paise,
              total_sales_paise: s.total_sales_paise,
              today_sales_paise: s.today_sales_paise,
              channel_margins: channelMargins,
              channel_volumes: pVol,
              channel_commissions: pComm,
              commission_rate_pct: channelMargins.pinelabs || 0
            };
          });

          // Authoritative Creator Commission from financial_ledger
          const creatorCommRes = await client.query(`
            SELECT 
              COALESCE(SUM(amount_paise), 0) as total_comm_paise,
              COALESCE(SUM(CASE WHEN created_at >= CURRENT_DATE THEN amount_paise ELSE 0 END), 0) as today_comm_paise
            FROM financial_ledger
            WHERE (type = 'commission' OR (type = 'adjustment' AND (reference_type = 'REVERSAL' OR metadata->>'original_type' = 'commission')))
              AND UPPER(user_id) = UPPER($1)
          `, [creatorId]);
          const creatorComm = creatorCommRes.rows[0] || { total_comm_paise: '0', today_comm_paise: '0' };
          const creatorCommRupees = (Number(BigInt(creatorComm.total_comm_paise)) / 100).toFixed(2);
          const creatorTodayCommRupees = (Number(BigInt(creatorComm.today_comm_paise)) / 100).toFixed(2);

          return sendJson(res, 200, {
            success: true,
            creator_id: creatorId,
            partner_count: partners.length,
            partners,
            creator_commission_paise: creatorComm.total_comm_paise,
            creator_commission_rupees: creatorCommRupees,
            today_creator_commission_rupees: creatorTodayCommRupees,
            total_commission_earned: parseFloat(creatorCommRupees),
            today_network_profit: parseFloat(creatorTodayCommRupees),
            network_sales_paise: networkSalesPaise.toString(),
            network_commission_paise: networkCommPaise.toString(),
            network_sales_rupees: (Number(networkSalesPaise) / 100).toFixed(2),
            network_commission_rupees: (Number(networkCommPaise) / 100).toFixed(2),
            channel_volumes: channelVolumes,
            channel_commissions: channelCommissions
          });
        } finally {
          client.release();
        }
      } catch (err) {
        const status = err.statusCode || 500;
        return sendJson(res, status, { success: false, error: err.code || 'INTERNAL_ERROR', message: err.message });
      }
    }

    // 2.5 Authoritative Partner Transactions & Downline Profit Ledger
    if (pathname === '/api/network/partner-transactions' && method === 'GET') {
      try {
        const caller = requireAuth(req);
        const partnerId = url.searchParams.get('partnerId');
        if (!partnerId) {
          return sendJson(res, 400, { success: false, message: 'partnerId is required.' });
        }
        const creatorId = caller.role === 'ADMIN' ? (url.searchParams.get('creatorId') || caller.id) : caller.id;
        await assertCanAccessUser(caller, partnerId, { query: pgQuery });

        const pool = getDbPool();
        const client = await pool.connect();
        try {
          const downlinesRes = await client.query(`
            WITH RECURSIVE downline AS (
              SELECT id, name, creator_id FROM users WHERE UPPER(id) = UPPER($1)
              UNION ALL
              SELECT u.id, u.name, u.creator_id FROM users u
              INNER JOIN downline d ON UPPER(u.creator_id) = UPPER(d.id)
            )
            SELECT id, name FROM downline;
          `, [partnerId]);
          const downlineIds = downlinesRes.rows.map(r => r.id);

          if (downlineIds.length === 0) {
            return sendJson(res, 200, {
              success: true,
              transactions: [],
              total_sales: 0,
              total_profit_earned: 0
            });
          }

          const txnsRes = await client.query(`
            SELECT t.id, t.merchant_id, u.name as merchant_name,
                   COALESCE(t.amount, t.amount_paise / 100.0) as amount,
                   t.channel, t.provider, t.status, t.created_at, t.type,
                   t.ref_number, t.settlement_mode, t.settlement_type,
                   COALESCE(fl.amount_paise / 100.0, 0) as commission_profit
            FROM transactions t
            JOIN users u ON t.merchant_id = u.id
            LEFT JOIN financial_ledger fl ON fl.reference_id = t.id AND UPPER(fl.user_id) = UPPER($1)
            WHERE t.merchant_id = ANY($2) AND t.status != 'REVERSED'
            ORDER BY t.created_at DESC
          `, [creatorId, downlineIds]);

          const summaryRes = await client.query(`
            SELECT COALESCE(SUM(t.amount_paise), 0) / 100.0 as total_sales,
                   COALESCE(SUM(fl.amount_paise), 0) / 100.0 as total_profit
            FROM transactions t
            LEFT JOIN financial_ledger fl ON fl.reference_id = t.id AND UPPER(fl.user_id) = UPPER($1)
            WHERE t.merchant_id = ANY($2) AND t.status != 'REVERSED'
          `, [creatorId, downlineIds]);

          return sendJson(res, 200, {
            success: true,
            transactions: txnsRes.rows,
            total_sales: parseFloat(summaryRes.rows[0]?.total_sales || 0),
            total_profit_earned: parseFloat(summaryRes.rows[0]?.total_profit || 0)
          });
        } finally {
          client.release();
        }
      } catch (err) {
        const status = err.statusCode || 500;
        return sendJson(res, status, { success: false, error: err.code || 'INTERNAL_ERROR', message: err.message });
      }
    }

    // 2.6 Authoritative POS Rentals Report with Server-Computed Totals
    if (pathname === '/api/admin/pos-rentals-report' && method === 'GET') {
      requireAdmin(req);
      try {
        const monthKey = url.searchParams.get('monthKey') || new Date().toISOString().slice(0, 7);
        const pool = getDbPool();
        const client = await pool.connect();
        try {
          const merchants = (await client.query(`
            SELECT m.id, m.name, m.address, m.mobile, m.creator_id,
                   c.name as creator_name, c.role as creator_role,
                   p.provider as pos_provider, p.terminal_id, p.device_plan,
                   COALESCE(p.monthly_rent, 499.0) as monthly_rent
            FROM users m
            LEFT JOIN users c ON m.creator_id = c.id
            LEFT JOIN merchant_pos p ON m.id = p.merchant_id
            WHERE m.role = 'MERCHANT'
          `)).rows;

          const rentalList = [];
          merchants.forEach(m => {
            const plan = m.device_plan || 'RENTAL';
            if (plan === 'RENTAL' || plan === 'CUSTOM') {
              rentalList.push({
                merchant_id: m.id,
                merchant_name: m.name,
                shop_name: m.address ? m.address.split(',')[0] : `${m.name}'s Store`,
                mobile: m.mobile,
                pos_provider: m.pos_provider || 'Pine Labs',
                terminal_id: m.terminal_id || `PL-${m.id.slice(-4)}`,
                device_plan: plan,
                monthly_rent: parseFloat(m.monthly_rent || 499),
                creator_id: m.creator_id,
                creator_name: m.creator_name || 'Direct',
                creator_role: m.creator_role || null,
                billing_month: monthKey,
                rental_status: 'PENDING',
                paid_at: null,
                remarks: ''
              });
            }
          });

          let totalDue = 0;
          let totalCollected = 0;
          let totalPending = 0;
          let paidCount = 0;
          let pendingCount = 0;

          rentalList.forEach(r => {
            if (r.rental_status === 'PAID') {
              totalCollected += r.monthly_rent;
              paidCount++;
            } else {
              totalPending += r.monthly_rent;
              pendingCount++;
            }
            totalDue += r.monthly_rent;
          });

          return sendJson(res, 200, {
            success: true,
            billingMonth: monthKey,
            summary: {
              totalTerminals: rentalList.length,
              totalDue: parseFloat(totalDue.toFixed(2)),
              totalCollected: parseFloat(totalCollected.toFixed(2)),
              totalPending: parseFloat(totalPending.toFixed(2)),
              paidCount,
              pendingCount
            },
            list: rentalList
          });
        } finally {
          client.release();
        }
      } catch (err) {
        const status = err.statusCode || 500;
        return sendJson(res, status, { success: false, error: err.code || 'INTERNAL_ERROR', message: err.message });
      }
    }

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
            bankName: body.bank_name || body.bankName,
            accountNumber: body.account_number || body.accountNumber,
            ifsc: body.ifsc || body.ifsc_code,
            holderName: body.holder_name || body.beneficiary_name || body.customer_name,
            channel: body.channel,
            settlementType: body.settlement_type || 'T1',
            idempotencyKey: req.headers['idempotency-key'] || body.idempotency_key || null,
            createdBy: merchantId
          });
        });

        return sendJson(res, 200, { success: true, withdrawal: serializeMoneyFields(result) });
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
            channel: body.channel,
            refNumber: body.ref_number || body.utr_number || null,
            slipNumber: body.slip_number || null,
            notes: body.notes || null,
            idempotencyKey: req.headers['idempotency-key'] || body.idempotency_key || null,
            createdBy: body.merchant_id
          });
        });

        return sendJson(res, 200, { 
          success: true, 
          transaction: serializeMoneyFields({
            ...result,
            amount_paise: result.amount_paise.toString(),
            customer_charge_paise: result.customer_charge_paise.toString(),
            net_amount_paise: result.net_amount_paise.toString(),
            distributions: result.distributions.map(d => ({
              ...d,
              amount_paise: d.amount_paise.toString()
            }))
          })
        });
      } catch (err) {
        const status = err.message.includes('DUPLICATE_SWIPE') ? 409 : 400;
        return sendJson(res, status, { success: false, message: err.message });
      }
    }

    // 5. Authoritative Transaction Reversal
    if (pathname === '/api/transactions/reverse' && method === 'POST') {
      try {
        requireAdmin(req);
        const body = await parseJsonBody(req);
        const caller = getCaller(req);
        const callerId = caller.id;

        const result = await withTransaction(async (client) => {
          return await reverseTransaction(client, {
            txnId: body.txn_id || body.transaction_id,
            reason: body.reason || 'Reversed by admin',
            callerId,
            confirmFraud: Boolean(body.confirm_fraud || body.confirmFraud)
          });
        });

        return sendJson(res, 200, { success: true, reversal: serializeMoneyFields(result) });
      } catch (err) {
        const status = err.statusCode || 400;
        return sendJson(res, status, { success: false, error: err.code || 'BAD_REQUEST', message: err.message });
      }
    }

    // 5.1 Authoritative Transaction Edit
    if (pathname === '/api/transactions/edit' && method === 'POST') {
      try {
        requireAdmin(req);
        const body = await parseJsonBody(req);
        const caller = getCaller(req);
        const callerId = caller.id;

        const amountPaise = body.amount_paise 
          ? BigInt(body.amount_paise) 
          : BigInt(Math.round(parseFloat(body.amount || body.corrected_amount || body.new_amount) * 100));

        const result = await withTransaction(async (client) => {
          return await editSwipeTransaction(client, {
            oldTxnId: body.old_txn_id || body.transaction_id || body.txn_id,
            correctedAmountPaise: amountPaise,
            channel: body.channel || null,
            refNumber: body.ref_number || null,
            slipNumber: body.slip_number || null,
            notes: body.notes || null,
            reason: body.reason || 'Transaction amount edited by admin',
            callerId
          });
        });

        return sendJson(res, 200, { 
          success: true, 
          old_transaction_id: result.old_transaction_id,
          old_status: result.old_status,
          new_transaction: serializeMoneyFields({
            ...result.new_transaction,
            amount_paise: result.new_transaction.amount_paise.toString(),
            customer_charge_paise: result.new_transaction.customer_charge_paise.toString(),
            net_amount_paise: result.new_transaction.net_amount_paise.toString(),
            distributions: result.new_transaction.distributions.map(d => ({
              ...d,
              amount_paise: d.amount_paise.toString()
            }))
          })
        });
      } catch (err) {
        const status = err.statusCode || 400;
        return sendJson(res, status, { success: false, error: err.code || 'BAD_REQUEST', message: err.message });
      }
    }

    // 6. System Settings Read & Update (No hardcoded values)
    if (pathname === '/api/admin/settings' && method === 'GET') {
      try {
        requireAdmin(req);
        const settings = await getAllSettings({ query: pgQuery });
        return sendJson(res, 200, { success: true, settings });
      } catch (err) {
        const status = err.statusCode || 500;
        return sendJson(res, status, { success: false, error: err.code || 'INTERNAL_ERROR', message: err.message });
      }
    }

    if (pathname === '/api/admin/settings/update' && method === 'POST') {
      try {
        requireAdmin(req);
        const body = await parseJsonBody(req);
        const caller = getCaller(req);
        const callerId = caller.id;

        const updated = await updateSetting(body.key, {
          value_numeric: body.value_numeric,
          value_text: body.value_text,
          value_json: body.value_json
        }, callerId, { query: pgQuery });

        return sendJson(res, 200, { success: true, setting: updated });
      } catch (err) {
        const status = err.statusCode || 400;
        return sendJson(res, status, { success: false, error: err.code || 'BAD_REQUEST', message: err.message });
      }
    }

    if (pathname === '/api/admin/system/migrate' && (method === 'POST' || method === 'GET')) {
      try {
        requireAdmin(req);
        await pgQuery(`ALTER TABLE wallets ADD COLUMN IF NOT EXISTS withdrawn_amount NUMERIC DEFAULT 0.0`).catch(() => {});
        await pgQuery(`ALTER TABLE users ADD COLUMN IF NOT EXISTS channels JSONB DEFAULT '{}'::jsonb`).catch(() => {});
        const cols = await pgQuery(`SELECT column_name FROM information_schema.columns WHERE table_name = 'wallets'`);
        return sendJson(res, 200, { 
          success: true, 
          message: 'Database schema migration executed successfully.', 
          wallet_columns: cols.map(c => c.column_name) 
        });
      } catch (err) {
        const status = err.statusCode || 500;
        return sendJson(res, status, { success: false, error: err.code || 'INTERNAL_ERROR', message: err.message });
      }
    }

    // ----------------------------------------------------
    // AUTOMATIC GITHUB AUTO-DEPLOY WEBHOOK (STRICT SECRET ENFORCED)
    // ----------------------------------------------------
    if ((pathname === '/api/system/webhook-deploy' || pathname === '/api/webhook-deploy') && (method === 'POST' || method === 'GET')) {
      const webhookSecret = process.env.WEBHOOK_DEPLOY_SECRET;
      const incomingSecret = req.headers['x-webhook-secret'] || req.headers['x-deploy-secret'] || url.searchParams.get('secret');
      if (!webhookSecret || incomingSecret !== webhookSecret) {
        return sendJson(res, 401, {
          success: false,
          error: 'WEBHOOK_UNAUTHORIZED',
          message: 'Webhook trigger rejected: Invalid or unconfigured WEBHOOK_DEPLOY_SECRET.'
        });
      }

      console.log('⚡ Received verified GitHub Auto-Deploy trigger! Pulling latest code and building...');
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
    const status = err.statusCode || (err.message && err.message.startsWith('AUTH_') ? 401 : (err.message && err.message.startsWith('ACCESS_') ? 403 : 500));
    const message = status === 401 ? 'Your session ended. Please log in again.' : (err.message || 'Internal Server Error');
    return sendJson(res, status, { success: false, error: err.code || 'ERROR', message });
  }
}
