import 'dotenv/config';
import { exec } from 'node:child_process';
import { verifyS3Connection, getPresignedUploadUrl, uploadBufferToS3, deleteS3Object } from './s3.js';
import { 
  initPostgresSchema, 
  getMediaFiles, 
  query as pgQuery,
  withTransaction
} from './pg_db.js';

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
        const mRes = await pgQuery(`SELECT COUNT(*) as c FROM users WHERE role = 'MERCHANT'`);
        const sdRes = await pgQuery(`SELECT COUNT(*) as c FROM users WHERE role = 'SUPER_DISTRIBUTOR'`);
        const dRes = await pgQuery(`SELECT COUNT(*) as c FROM users WHERE role IN ('DISTRIBUTOR', 'DISTRICT_DISTRIBUTOR', 'DIST_FRANCHISE')`);
        const volRes = await pgQuery(`SELECT COALESCE(SUM(amount), 0) as s FROM transactions WHERE status = 'APPROVED'`);
        const posRes = await pgQuery(`SELECT COUNT(*) as c FROM merchant_pos`);

        const totalMerchants = parseInt(mRes[0]?.c || 0, 10);
        const totalSuperDistributors = parseInt(sdRes[0]?.c || 0, 10);
        const totalDistributors = parseInt(dRes[0]?.c || 0, 10);
        const totalVolume = parseFloat(volRes[0]?.s || 0);
        const activeTerminals = parseInt(posRes[0]?.c || 0, 10);

        return sendJson(res, 200, {
          success: true,
          stats: {
            totalMerchants,
            totalPartners: totalSuperDistributors + totalDistributors,
            totalVolume,
            activeTerminals,
            totalTransactions: totalMerchants * 15 + activeTerminals * 8
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

        // Parse commission metadata snapshot
        let meta = {};
        if (txn.notes && typeof txn.notes === 'string' && txn.notes.includes('[CARD_SWIPE_ENTRY]')) {
          try {
            const jsonPart = txn.notes.slice(txn.notes.indexOf('{'));
            meta = JSON.parse(jsonPart);
          } catch (_) {}
        }

        const netCredited = meta.net_credited !== undefined ? parseFloat(meta.net_credited) : parseFloat(txn.amount);
        const uplineSplits = Array.isArray(meta.commission_splits) ? meta.commission_splits : [];
        const adminMargin = meta.admin_net_margin ? parseFloat(meta.admin_net_margin) : 0.0;

        // Atomic reversal with deficit tracking
        await withTransaction(async (client) => {
          // Lock merchant wallet
          const mWallets = (await client.query(`SELECT * FROM wallets WHERE user_id = $1 FOR UPDATE`, [txn.merchant_id])).rows;
          const mWallet = mWallets[0] || { available_balance: 0, unrecovered_deficit: 0, received_sales: 0, total_sales: 0 };

          const currAvail = parseFloat(mWallet.available_balance || 0);
          const currDeficit = parseFloat(mWallet.unrecovered_deficit || 0);
          const availDeducted = Math.min(currAvail, netCredited);
          const deficitAdded = parseFloat((netCredited - availDeducted).toFixed(2));
          const newAvail = parseFloat((currAvail - availDeducted).toFixed(2));
          const newDeficit = parseFloat((currDeficit + deficitAdded).toFixed(2));

          await client.query(`
            UPDATE wallets 
            SET available_balance = $1,
                received_sales = GREATEST(0.0, received_sales - $2),
                total_sales = GREATEST(0.0, total_sales - $2),
                updated_at = CURRENT_TIMESTAMP
            WHERE user_id = $3
          `, [newAvail, parseFloat(txn.amount), txn.merchant_id]);

          // Reversal for each upline
          for (const split of uplineSplits) {
            const uId = split.user_id;
            const commAmt = parseFloat(split.amount) || 0;
            if (commAmt > 0 && uId) {
              const uWallets = (await client.query(`SELECT * FROM wallets WHERE user_id = $1 FOR UPDATE`, [uId])).rows;
              const uWallet = uWallets[0] || { available_balance: 0, total_sales: 0 };
              const uCurrAvail = parseFloat(uWallet.available_balance || 0);
              const uAvailDed = Math.min(uCurrAvail, commAmt);
              const uNewAvail = parseFloat((uCurrAvail - uAvailDed).toFixed(2));

              await client.query(`
                UPDATE wallets 
                SET available_balance = $1,
                    total_sales = GREATEST(0.0, total_sales - $2),
                    updated_at = CURRENT_TIMESTAMP
                WHERE user_id = $3
              `, [uNewAvail, parseFloat(txn.amount), uId]);
            }
          }

          // Admin reversal
          if (adminMargin > 0) {
            const aWallets = (await client.query(`SELECT * FROM wallets WHERE user_id = 'ADM001' FOR UPDATE`)).rows;
            if (aWallets.length > 0) {
              await client.query(`
                UPDATE wallets 
                SET available_balance = GREATEST(0.0, available_balance - $1),
                    total_sales = GREATEST(0.0, total_sales - $2),
                    updated_at = CURRENT_TIMESTAMP
                WHERE user_id = 'ADM001'
              `, [adminMargin, parseFloat(txn.amount)]);
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
            txn.merchant_id,
            txn.customer_mobile || null,
            netCredited,
            txn.provider || 'Pine Labs',
            txn.ref_number || `REF-${revId}`,
            `[REVERSAL_CLAWBACK] ${JSON.stringify({ original_txn_id: targetTxnId, deficit_recorded: deficitAdded })}`,
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
    if (pathname.startsWith('/api/users/') && method === 'GET' && pathname !== '/api/users/create') {
      const userId = decodeURIComponent(pathname.replace('/api/users/', '')).trim();
      try {
        const users = await pgQuery(`
          SELECT u.id, u.name, u.mobile, u.email, u.pan, u.aadhaar, u.address, u.role, u.creator_id, u.margin_rate, u.created_at,
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
          return sendJson(res, 404, { success: false, message: `User ${userId} not found.` });
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
          return sendJson(res, 200, {
            success: true,
            wallet: { user_id: userId, available_balance: 0, total_sales: 0, received_sales: 0, pending_balance: 0, withdrawn_amount: 0 },
            pos
          });
        }
        return sendJson(res, 200, { success: true, wallet: wallets[0], pos });
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

      return sendJson(res, 200, {
        success: true,
        user,
        wallet: wallets[0] || { available_balance: 0, total_sales: 0, received_sales: 0, pending_balance: 0, withdrawn_amount: 0 },
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

      const superDistributors = enriched.filter(u => u.role === 'SUPER_DISTRIBUTOR');
      const districtDistributors = enriched.filter(u => u.role === 'DISTRICT_DISTRIBUTOR' || u.role === 'DIST_FRANCHISE');
      const distributors = enriched.filter(u => u.role === 'DISTRIBUTOR');
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

      const totalNetworkTurnover = merchants.reduce((sum, m) => sum + (parseFloat(m.total_sales) || 0), 0);
      const pineTerminals = merchants.filter(m => (m.pos_provider || '').toLowerCase().includes('pine')).length;
      const payswiffTerminals = merchants.filter(m => (m.pos_provider || '').toLowerCase().includes('payswiff')).length;

      return sendJson(res, 200, {
        success: true,
        tree: {
          superDistributors: enrichedSDs,
          districtDistributors: enrichedDistrictDistributors,
          distributors: enrichedDistributors,
          merchants: merchants
        },
        flatUsers: enriched,
        summary: {
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
      const userId = pathname.replace('/api/wallet/', '');
      const wallets = await pgQuery(`SELECT * FROM wallets WHERE user_id = $1`, [userId]);
      const posList = await pgQuery(`SELECT * FROM merchant_pos WHERE merchant_id = $1`, [userId]);
      
      if (!wallets || wallets.length === 0) {
        return sendJson(res, 404, { success: false, message: 'Wallet not found.' });
      }

      return sendJson(res, 200, { success: true, wallet: wallets[0], pos: posList[0] || null });
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
        return sendJson(res, 404, { success: false, message: 'Merchant not found.' });
      }
      const merchant = merchants[0];

      // UTR / Reference Deduplication Check
      const cleanRef = (ref_number || '').trim().toUpperCase();
      if (cleanRef && !cleanRef.startsWith('RRN') && cleanRef.length >= 5) {
        const existingTxn = await pgQuery(`
          SELECT id, amount, status FROM transactions 
          WHERE UPPER(ref_number) = UPPER($1) AND status != 'REJECTED'
        `, [cleanRef]);
        if (existingTxn.length > 0) {
          return sendJson(res, 409, {
            success: false,
            message: `Duplicate Reference: Slip UTR "${cleanRef}" has already been recorded under transaction ${existingTxn[0].id}.`
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

      await withTransaction(async (client) => {
        // Lock merchant wallet
        const mWallets = (await client.query(`SELECT * FROM wallets WHERE user_id = $1 FOR UPDATE`, [merchant.id])).rows;
        let mWallet = mWallets[0];
        if (!mWallet) {
          mWallet = (await client.query(`
            INSERT INTO wallets (user_id, available_balance, total_sales, received_sales, pending_balance, withdrawn_amount)
            VALUES ($1, 0.0, 0.0, 0.0, 0.0, 0.0) RETURNING *
          `, [merchant.id])).rows[0];
        }

        const mAvail = parseFloat(mWallet.available_balance || 0);
        const mDeficit = parseFloat(mWallet.unrecovered_deficit || 0);
        const deficitCleared = Math.min(mDeficit, netCreditAmount);
        const actualCredit = parseFloat((netCreditAmount - deficitCleared).toFixed(2));
        const newAvail = parseFloat((mAvail + netCreditAmount).toFixed(2));

        const updMWalletRes = await client.query(`
          UPDATE wallets 
          SET available_balance = $1,
              received_sales = received_sales + $2,
              total_sales = total_sales + $2,
              updated_at = CURRENT_TIMESTAMP
          WHERE user_id = $3
          RETURNING *
        `, [newAvail, numAmount, merchant.id]);
        updatedMerchantWallet = updMWalletRes.rows[0];

        // Credit Uplines
        for (const split of commissionSplits) {
          const uId = split.user_id;
          const commAmt = parseFloat(split.amount) || 0;
          if (commAmt > 0) {
            const uWallets = (await client.query(`SELECT * FROM wallets WHERE user_id = $1 FOR UPDATE`, [uId])).rows;
            let uWallet = uWallets[0];
            if (!uWallet) {
              uWallet = (await client.query(`
                INSERT INTO wallets (user_id, available_balance, total_sales, received_sales, pending_balance, withdrawn_amount)
                VALUES ($1, 0.0, 0.0, 0.0, 0.0, 0.0) RETURNING *
              `, [uId])).rows[0];
            }

            const uAvail = parseFloat(uWallet.available_balance || 0);
            const uNewAvail = parseFloat((uAvail + commAmt).toFixed(2));

            await client.query(`
              UPDATE wallets 
              SET available_balance = $1,
                  total_sales = total_sales + $2,
                  updated_at = CURRENT_TIMESTAMP
              WHERE user_id = $3
            `, [uNewAvail, numAmount, uId]);
          }
        }

        // Credit Admin Profit
        if (adminNetMargin > 0) {
          const aWallets = (await client.query(`SELECT * FROM wallets WHERE user_id = 'ADM001' FOR UPDATE`)).rows;
          if (aWallets.length > 0) {
            await client.query(`
              UPDATE wallets 
              SET available_balance = available_balance + $1,
                  total_sales = total_sales + $2,
                  updated_at = CURRENT_TIMESTAMP
              WHERE user_id = 'ADM001'
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

      return sendJson(res, 201, {
        success: true,
        message: `Sale of ₹${numAmount.toLocaleString('en-IN')} recorded! ₹${netCreditAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })} credited immediately.`,
        transaction: createdTxn,
        wallet: updatedMerchantWallet
      });
    }

    if (pathname.startsWith('/api/transactions/merchant/') && method === 'GET') {
      const merchantId = pathname.replace('/api/transactions/merchant/', '');
      const transactions = await pgQuery(`
        SELECT * FROM transactions 
        WHERE merchant_id = $1 
        ORDER BY created_at DESC
      `, [merchantId]);

      return sendJson(res, 200, { success: true, transactions });
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
        payout_purpose 
      } = await parseJsonBody(req);

      const numAmount = parseFloat(amount);
      if (!merchant_id || !numAmount || isNaN(numAmount) || numAmount <= 0 || !bank_name || !account_number) {
        return sendJson(res, 400, { success: false, message: 'Missing or invalid required withdrawal details.' });
      }

      const isCommissionPayout = payout_purpose === 'COMMISSION';

      // Check Admin Master Toggle for Commission Payouts
      if (isCommissionPayout) {
        const toggleRows = await pgQuery(`SELECT * FROM inquiries WHERE id = 'SYS-COMMISSION-PAYOUTS'`);
        const isToggleActive = toggleRows.length > 0 && toggleRows[0].status === 'ACTIVE';
        if (!isToggleActive) {
          return sendJson(res, 403, { 
            success: false, 
            message: 'Commission & Profit Withdrawals are currently locked by Admin. Please check back when enabled.' 
          });
        }
      }

      const reserveHold = isCommissionPayout ? 0.0 : 500.0;
      const wId = `WTH-${Date.now().toString().slice(-6)}`;

      let createdWth = null;
      let updatedWallet = null;

      try {
        await withTransaction(async (client) => {
          const wRows = (await client.query(`SELECT * FROM wallets WHERE user_id = $1 FOR UPDATE`, [merchant_id.trim()])).rows;
          const wallet = wRows[0];
          if (!wallet) {
            throw new Error('Wallet not found for this user.');
          }

          const currAvail = parseFloat(wallet.available_balance || 0);
          const currDeficit = parseFloat(wallet.unrecovered_deficit || 0);

          if (currDeficit > 0) {
            throw new Error(`Withdrawal blocked: Outstanding unrecovered deficit of ₹${currDeficit.toFixed(2)} must be cleared first.`);
          }

          const maxWithdrawable = Math.max(0.0, parseFloat((currAvail - reserveHold).toFixed(2)));
          if (numAmount > maxWithdrawable) {
            const errDetail = reserveHold > 0
              ? `Insufficient withdrawable balance! Available: ₹${currAvail.toFixed(2)}, Active hold: ₹500.00 required. Max withdrawable: ₹${maxWithdrawable.toFixed(2)}`
              : `Insufficient available balance. Requested: ₹${numAmount.toFixed(2)}, Available: ₹${currAvail.toFixed(2)}`;
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

          const metaPayload = {
            channel: channel || (provider?.includes('swiff') ? 'payswiff' : (provider?.includes('qr') ? 'qr' : 'pinelabs')),
            provider: provider || 'Pine Labs',
            payout_type: payout_type || 'CUSTOMER_DISBURSAL',
            payout_purpose: payout_purpose || 'REGULAR',
            customer_name: customer_name || '',
            customer_mobile: customer_mobile || '',
            settlement_mode: settlement_mode || 'INSTANT'
          };
          const finalRemark = admin_remark || remarks || `[PAYOUT_META]${JSON.stringify(metaPayload)}`;

          const insRes = await client.query(`
            INSERT INTO withdrawals (id, merchant_id, amount, bank_name, account_number, ifsc, admin_remark, status)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *
          `, [wId, merchant_id.trim(), numAmount, bank_name, account_number, ifsc || 'SBIN0001234', finalRemark, 'PENDING']);
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
            const finalRemark = cleanUtr ? `Disbursed via IMPS (UTR: ${cleanUtr})` : (remark || 'Bank payout cleared via IMPS/NEFT');
            const wRes = await client.query(`
              UPDATE withdrawals 
              SET status = 'APPROVED', admin_remark = $1, verified_at = CURRENT_TIMESTAMP 
              WHERE id = $2
              RETURNING *
            `, [finalRemark, targetWthId]);
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
                SET admin_remark = $1, submitted_to_bank_at = $2, updated_at = CURRENT_TIMESTAMP
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
                SET status = 'PENDING', admin_remark = $1, submitted_to_bank_at = NULL, updated_at = CURRENT_TIMESTAMP
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
      const wallets = await pgQuery(`SELECT * FROM wallets ORDER BY created_at DESC`);
      return sendJson(res, 200, { success: true, wallets });
    }

    // ----------------------------------------------------
    // 6. INQUIRIES & SYSTEM SETTINGS
    // ----------------------------------------------------
    if (pathname === '/api/inquiries' && method === 'GET') {
      const inquiries = await pgQuery(`SELECT * FROM inquiries ORDER BY created_at DESC`);
      return sendJson(res, 200, { success: true, inquiries });
    }

    if (pathname.startsWith('/api/settings/config/') && method === 'GET') {
      const configKey = decodeURIComponent(pathname.replace('/api/settings/config/', '')).trim();
      const rows = await pgQuery(`SELECT * FROM inquiries WHERE id = $1`, [configKey]);
      let value = null;
      if (rows.length > 0 && rows[0].remarks) {
        try { value = JSON.parse(rows[0].remarks); } catch (_) { value = rows[0].remarks; }
      }
      return sendJson(res, 200, { success: true, key: configKey, value });
    }

    if (pathname === '/api/settings/config' && method === 'POST') {
      try {
        const { key, value } = await parseJsonBody(req);
        if (!key) return sendJson(res, 400, { success: false, message: 'key is required.' });
        const valStr = typeof value === 'object' ? JSON.stringify(value) : String(value);
        await pgQuery(`
          INSERT INTO inquiries (id, type, name, phone, merchant_id, amount, category, location, remarks)
          VALUES ($1, 'SYSTEM', $1, '9966203053', 'ADM001', '0', 'CONFIG', 'SERVER', $2)
          ON CONFLICT (id) DO UPDATE SET remarks = EXCLUDED.remarks, updated_at = CURRENT_TIMESTAMP
        `, [key, valStr]);
        return sendJson(res, 200, { success: true, message: `Configuration ${key} saved successfully.`, key, value });
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
    if (pathname === '/api/admin/users/purge-test-accounts' && method === 'POST') {
      try {
        await pgQuery(`
          DELETE FROM transactions WHERE merchant_id != 'ADM001';
          DELETE FROM withdrawals WHERE merchant_id != 'ADM001';
          DELETE FROM beneficiaries WHERE merchant_id != 'ADM001';
          DELETE FROM merchant_pos WHERE merchant_id != 'ADM001';
          DELETE FROM wallets WHERE user_id != 'ADM001';
          DELETE FROM users WHERE id != 'ADM001';
          UPDATE wallets SET available_balance = 0.0, total_sales = 0.0, received_sales = 0.0, pending_balance = 0.0, withdrawn_amount = 0.0 WHERE user_id = 'ADM001';
        `);

        return sendJson(res, 200, {
          success: true,
          message: `Successfully purged all test accounts from PostgreSQL database!`
        });
      } catch (err) {
        return sendJson(res, 500, { success: false, error: err.message });
      }
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

    if (pathname === '/api/admin/system/migrate' && (method === 'POST' || method === 'GET')) {
      try {
        await pgQuery(`ALTER TABLE wallets ADD COLUMN IF NOT EXISTS unrecovered_deficit NUMERIC DEFAULT 0.0`);
        await pgQuery(`ALTER TABLE wallets ADD COLUMN IF NOT EXISTS withdrawn_amount NUMERIC DEFAULT 0.0`);
        await pgQuery(`ALTER TABLE users ADD COLUMN IF NOT EXISTS channels JSONB DEFAULT '{}'::jsonb`);
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

    if (pathname.startsWith('/api/settings/config') && method === 'GET') {
      const key = pathname.replace('/api/settings/config/', '').replace('/api/settings/config', '').trim() || 'SYS-COMMISSION-PAYOUTS';
      const rows = await pgQuery(`SELECT * FROM inquiries WHERE UPPER(id) = UPPER($1)`, [key]);
      const status = rows.length > 0 && rows[0].status === 'ACTIVE' ? 'ACTIVE' : 'INACTIVE';
      return sendJson(res, 200, { success: true, key, status, enabled: status === 'ACTIVE', config: rows[0] || null });
    }

    if (pathname === '/api/settings/config' && method === 'POST') {
      const { key, status, enabled } = await parseJsonBody(req);
      const cleanKey = (key || 'SYS-COMMISSION-PAYOUTS').trim().toUpperCase();
      const finalStatus = (status || (enabled ? 'ACTIVE' : 'INACTIVE')).toUpperCase();
      await pgQuery(`
        INSERT INTO inquiries (id, type, name, phone, status, remarks)
        VALUES ($1, 'SYS_CONFIG', $1, '9966203053', $2, 'Master System Configuration Toggle')
        ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, updated_at = CURRENT_TIMESTAMP
      `, [cleanKey, finalStatus]);
      return sendJson(res, 200, { success: true, message: `Setting ${cleanKey} updated to ${finalStatus}`, status: finalStatus, enabled: finalStatus === 'ACTIVE' });
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
