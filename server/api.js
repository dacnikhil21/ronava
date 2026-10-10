import 'dotenv/config';
import { exec } from 'node:child_process';
import { verifyS3Connection, getPresignedUploadUrl, uploadBufferToS3, deleteS3Object } from './s3.js';
import { 
  initPostgresSchema, 
  getMediaFiles, 
  query as pgQuery 
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
      if (!adminId || !adminPassword || !targetUserId) {
        return sendJson(res, 400, { success: false, message: 'Admin ID, Admin Password, and Target User ID are required.' });
      }

      const admins = await pgQuery(`SELECT * FROM users WHERE UPPER(id) = UPPER($1)`, [adminId.trim()]);
      const admin = admins[0];
      if (!admin || (admin.role !== 'ADMIN' && admin.role !== 'MASTER')) {
        return sendJson(res, 403, { success: false, message: 'Access Denied: Only authorized Administrators can perform password resets.' });
      }

      if ((admin.password || '').trim() !== adminPassword.trim()) {
        return sendJson(res, 401, { success: false, message: 'Invalid Admin credentials.' });
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
          statusMap = JSON.parse(statusRows[0].remarks);
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
      const rateT1 = parseFloat(commissionRateT1) || 1.50;
      const rateInstant = parseFloat(commissionRateInstant) || 1.80;
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
    // 0.4 ADMIN TRANSACTION VERIFICATION & APPROVAL
    // ----------------------------------------------------
    if (pathname === '/api/admin/verify-transaction' && method === 'POST') {
      const { adminId, txnId, action, remark, utr } = await parseJsonBody(req);
      if (!txnId || !action) {
        return sendJson(res, 400, { success: false, message: 'txnId and action are required.' });
      }

      const txns = await pgQuery(`SELECT * FROM transactions WHERE id = $1`, [txnId.trim()]);
      const txn = txns[0];
      if (!txn) {
        return sendJson(res, 404, { success: false, message: 'Transaction not found.' });
      }

      const amount = parseFloat(txn.amount) || 0;
      const merchantId = txn.merchant_id;

      if (action === 'APPROVE') {
        if (utr || (txn.ref_number && !txn.ref_number.startsWith('RRN') && txn.ref_number.length >= 6)) {
          const checkRef = utr || txn.ref_number;
          const dups = await pgQuery(`
            SELECT id, amount FROM transactions 
            WHERE ref_number = $1 AND status = 'APPROVED' AND id != $2
          `, [checkRef, txnId.trim()]);
          if (dups.length > 0) {
            return sendJson(res, 400, {
              success: false,
              message: `Approval Blocked: Duplicate reference "${checkRef}" was already approved under transaction ${dups[0].id}.`
            });
          }
        }

        const finalRemark = utr ? `Approved (UTR: ${utr})` : (remark || 'Verified by Admin against settlement report');

        await pgQuery(`
          UPDATE transactions 
          SET status = 'APPROVED', admin_remark = $1, verified_at = CURRENT_TIMESTAMP 
          WHERE id = $2
        `, [finalRemark, txnId.trim()]);

        if (txn.status === 'PENDING') {
          await pgQuery(`
            UPDATE wallets 
            SET pending_balance = GREATEST(0.0, pending_balance - $1),
                received_sales = received_sales + $2,
                available_balance = available_balance + $3,
                updated_at = CURRENT_TIMESTAMP
            WHERE user_id = $4
          `, [amount, amount, amount, merchantId]);
        }

        const updatedTxn = await pgQuery(`SELECT * FROM transactions WHERE id = $1`, [txnId.trim()]);
        const updatedWallet = await pgQuery(`SELECT * FROM wallets WHERE user_id = $1`, [merchantId]);

        return sendJson(res, 200, {
          success: true,
          message: `Transaction ${txnId} approved successfully!`,
          transaction: updatedTxn[0],
          wallet: updatedWallet[0]
        });
      } else {
        const finalRemark = remark || 'Rejected by Admin';
        await pgQuery(`
          UPDATE transactions 
          SET status = 'REJECTED', admin_remark = $1, verified_at = CURRENT_TIMESTAMP 
          WHERE id = $2
        `, [finalRemark, txnId.trim()]);

        if (txn.status === 'PENDING') {
          await pgQuery(`
            UPDATE wallets 
            SET pending_balance = GREATEST(0.0, pending_balance - $1),
                updated_at = CURRENT_TIMESTAMP
            WHERE user_id = $2
          `, [amount, merchantId]);
        }

        const updatedTxn = await pgQuery(`SELECT * FROM transactions WHERE id = $1`, [txnId.trim()]);
        const updatedWallet = await pgQuery(`SELECT * FROM wallets WHERE user_id = $1`, [merchantId]);

        return sendJson(res, 200, {
          success: true,
          message: `Transaction ${txnId} rejected.`,
          transaction: updatedTxn[0],
          wallet: updatedWallet[0]
        });
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

    // ----------------------------------------------------
    // 1. AUTH & USER PROFILES (Strict 1-to-1 Verification)
    // ----------------------------------------------------
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

    // Create a new downstream user (Strict PostgreSQL)
    if (pathname === '/api/users/create' && method === 'POST') {
      const { 
        creator_id, 
        parent_id, 
        name, 
        mobile, 
        email,
        pan,
        aadhaar,
        address,
        role, 
        pos_provider, 
        pos_vendor,
        device_plan,
        monthly_rent,
        settlement_type,
        commission_rate,
        commission_rate_t1,
        commission_rate_instant,
        pos_terminal_id,
        margin_rate,
        password
      } = await parseJsonBody(req);

      if (!creator_id || !name || !mobile || !role) {
        return sendJson(res, 400, { success: false, message: 'Missing required fields (creator_id, name, mobile, role).' });
      }

      const creators = await pgQuery(`SELECT * FROM users WHERE id = $1`, [creator_id]);
      const creator = creators[0] || null;
      if (!creator) {
        return sendJson(res, 403, { success: false, message: 'Invalid creator ID.' });
      }

      const isAdmin = creator.role === 'ADMIN' || creator.role === 'MASTER';

      let assignedCreatorId = creator.id;
      if (isAdmin && parent_id && parent_id !== 'ADM001' && parent_id !== 'DIRECT') {
        const targetParents = await pgQuery(`SELECT * FROM users WHERE id = $1`, [parent_id]);
        if (targetParents[0]) {
          assignedCreatorId = targetParents[0].id;
        }
      }

      const prefixMap = {
        'MASTER': 'MST',
        'SUPER_DISTRIBUTOR': 'SD',
        'DISTRICT_DISTRIBUTOR': 'DD',
        'DIST_FRANCHISE': 'DD',
        'DISTRIBUTOR': 'DIST',
        'MERCHANT': 'MID'
      };
      const prefix = prefixMap[role] || 'USR';
      const randomNum = Math.floor(1000 + Math.random() * 9000);
      const newUserId = `${prefix}${randomNum}`;

      const effectiveMargin = parseFloat(margin_rate || commission_rate || 0.0);
      const generatedPassword = password || `Ronav@${randomNum}`;

      try {
        await pgQuery(`
          INSERT INTO users (id, name, mobile, email, pan, aadhaar, address, margin_rate, role, creator_id, password)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        `, [
          newUserId, 
          name.trim(), 
          mobile.trim(), 
          email || null, 
          pan ? pan.toUpperCase().trim() : null, 
          aadhaar ? aadhaar.trim() : null, 
          address ? address.trim() : null, 
          effectiveMargin, 
          role, 
          assignedCreatorId,
          generatedPassword
        ]);

        // Initialize user wallet
        await pgQuery(`
          INSERT INTO wallets (user_id, available_balance, total_sales, received_sales, pending_balance, withdrawn_amount)
          VALUES ($1, 0.0, 0.0, 0.0, 0.0, 0.0)
        `, [newUserId]);

        let createdPOS = null;
        if (role === 'MERCHANT') {
          let provider = 'Pine Labs';
          let vendorEntity = 'Rose Navaneetham Enterprises';
          let settlement = settlement_type === 'INSTANT' ? 'INSTANT' : 'T1';
          let plan = (device_plan === 'LIFETIME' || device_plan === 'DIRECT') ? device_plan : 'RENTAL';
          let rentFee = plan === 'RENTAL' ? (parseFloat(monthly_rent) || 0.0) : 0.0;
          let rate = parseFloat(commission_rate || commission_rate_t1) || 1.50;
          let instantFee = 0.0;
          let terminalPrefix = 'PL';

          if (pos_provider === 'Payswiff') {
            provider = 'Payswiff';
            vendorEntity = pos_vendor === 'R.P. Technologies' ? 'R.P. Technologies' : 'RONAV Technologies';
            terminalPrefix = 'SWIFF';
            if (settlement === 'INSTANT') instantFee = 0.30;
          } else if (pos_provider === 'QR' || pos_provider === 'Company QR' || pos_provider === 'Company QR (UPI)') {
            provider = 'Company QR (UPI)';
            vendorEntity = 'RONAV Technologies';
            terminalPrefix = 'QR';
            settlement = 'INSTANT';
            plan = 'DIRECT';
            rentFee = 0.0;
            rate = parseFloat(commission_rate_instant || commission_rate) || 1.50;
          } else {
            provider = 'Pine Labs';
            vendorEntity = 'Rose Navaneetham Enterprises';
            terminalPrefix = 'PL';
            if (settlement === 'INSTANT') rate = parseFloat(commission_rate_instant) || 1.80;
          }

          const terminalId = (pos_terminal_id && pos_terminal_id.trim())
            ? pos_terminal_id.trim()
            : `${terminalPrefix}-${Math.floor(1000 + Math.random() * 9000)}`;

          await pgQuery(`
            INSERT INTO merchant_pos (
              merchant_id, provider, terminal_id, commission_rate, assigned_by,
              vendor_entity, device_plan, monthly_rent, settlement_type, instant_surcharge
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          `, [
            newUserId, provider, terminalId, rate, assignedCreatorId,
            vendorEntity, plan, rentFee, settlement, instantFee
          ]);
          
          const posRes = await pgQuery(`SELECT * FROM merchant_pos WHERE merchant_id = $1`, [newUserId]);
          createdPOS = posRes[0] || null;
        }

        const createdUsers = await pgQuery(`SELECT * FROM users WHERE id = $1`, [newUserId]);
        const createdUser = createdUsers[0];
        const parentUsers = await pgQuery(`SELECT * FROM users WHERE id = $1`, [assignedCreatorId]);
        const parentUser = parentUsers[0] || null;

        return sendJson(res, 201, {
          success: true,
          message: `Successfully onboarded ${role} account (${newUserId}) under ${parentUser ? parentUser.name : 'Super Admin'}!`,
          user: createdUser,
          parent: parentUser || null,
          pos: createdPOS || null,
          credentials: {
            id: newUserId,
            name: createdUser.name,
            mobile: createdUser.mobile,
            role: createdUser.role,
            parent_name: parentUser ? parentUser.name : 'Super Admin',
            password: generatedPassword
          }
        });
      } catch (err) {
        if (err.message && (err.message.includes('unique') || err.message.includes('duplicate'))) {
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
      const wallets = await pgQuery(`SELECT * FROM wallets WHERE user_id = $1`, [userId]);
      const posList = await pgQuery(`SELECT * FROM merchant_pos WHERE merchant_id = $1`, [userId]);
      
      if (!wallets || wallets.length === 0) {
        return sendJson(res, 404, { success: false, message: 'Wallet not found.' });
      }

      return sendJson(res, 200, { success: true, wallet: wallets[0], pos: posList[0] || null });
    }

    // ----------------------------------------------------
    // 3. TRANSACTIONS & RECORDINGS
    // ----------------------------------------------------
    if (pathname === '/api/transactions/record' && method === 'POST') {
      const { merchant_id, amount, customer_mobile, type, provider: bodyProvider, ref_number, notes } = await parseJsonBody(req);

      if (!merchant_id || !amount) {
        return sendJson(res, 400, { success: false, message: 'Merchant ID and Amount are required.' });
      }

      const numAmount = parseFloat(amount);
      if (isNaN(numAmount) || numAmount <= 0) {
        return sendJson(res, 400, { success: false, message: 'Amount must be a positive number.' });
      }

      const merchants = await pgQuery(`SELECT * FROM users WHERE id = $1`, [merchant_id]);
      if (!merchants || merchants.length === 0) {
        return sendJson(res, 404, { success: false, message: 'Merchant not found.' });
      }

      const posList = await pgQuery(`SELECT * FROM merchant_pos WHERE merchant_id = $1`, [merchant_id]);
      const pos = posList[0] || null;
      const isQRPayment = type === 'QR_SCAN' || (bodyProvider && bodyProvider.toLowerCase().includes('qr'));
      const provider = isQRPayment ? 'Company QR (UPI)' : (bodyProvider || (pos ? pos.provider : (type === 'BBPS_BILL' ? 'BBPS' : 'Pine Labs')));
      const txnId = `TXN-${isQRPayment ? 'QR' : (provider === 'Payswiff' ? 'SW' : (provider === 'Pine Labs' ? 'PL' : 'GEN'))}-${Date.now().toString().slice(-6)}`;

      await pgQuery(`
        INSERT INTO transactions (id, merchant_id, customer_mobile, amount, type, provider, ref_number, notes, status)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'PENDING')
      `, [
        txnId, 
        merchant_id, 
        customer_mobile || null, 
        numAmount, 
        type || 'POS_SWIPE', 
        provider, 
        ref_number || `REF-${Math.floor(100000 + Math.random() * 900000)}`, 
        notes || 'Manual counter transaction entry'
      ]);

      await pgQuery(`
        UPDATE wallets 
        SET pending_balance = pending_balance + $1,
            total_sales = total_sales + $2,
            updated_at = CURRENT_TIMESTAMP
        WHERE user_id = $3
      `, [numAmount, numAmount, merchant_id]);

      const updatedWallets = await pgQuery(`SELECT * FROM wallets WHERE user_id = $1`, [merchant_id]);
      const createdTxns = await pgQuery(`SELECT * FROM transactions WHERE id = $1`, [txnId]);

      return sendJson(res, 201, {
        success: true,
        message: 'Transaction recorded successfully! Awaiting Admin verification.',
        transaction: createdTxns[0],
        wallet: updatedWallets[0]
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
    // 5. WITHDRAWALS
    // ----------------------------------------------------
    if (pathname === '/api/withdrawals/request' && method === 'POST') {
      const { merchant_id, amount, bank_name, account_number, ifsc, remarks, admin_remark, channel, provider, customer_name, customer_mobile, settlement_mode, payout_type, payout_purpose } = await parseJsonBody(req);
      const numAmount = parseFloat(amount);
      if (!merchant_id || !numAmount || !bank_name || !account_number) {
        return sendJson(res, 400, { success: false, message: 'Missing required withdrawal details.' });
      }

      const wallets = await pgQuery(`SELECT * FROM wallets WHERE user_id = $1`, [merchant_id]);
      const wallet = wallets[0] || null;
      const withdrawableBalance = wallet ? Math.max(0, wallet.available_balance - 500) : 0;
      if (!wallet || withdrawableBalance < numAmount) {
        return sendJson(res, 400, { 
          success: false, 
          message: `Insufficient withdrawable balance! Active hold of ₹500.00 required. Withdrawable: ₹${withdrawableBalance.toFixed(2)}` 
        });
      }

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

      const wId = `WTH-${Date.now().toString().slice(-6)}`;
      await pgQuery(`
        UPDATE wallets 
        SET available_balance = available_balance - $1,
            pending_balance = pending_balance + $2,
            updated_at = CURRENT_TIMESTAMP
        WHERE user_id = $3
      `, [numAmount, numAmount, merchant_id]);

      await pgQuery(`
        INSERT INTO withdrawals (id, merchant_id, amount, bank_name, account_number, ifsc, admin_remark, status)
        VALUES ($1, $2, $3, $4, $5, $6, $7, 'PENDING')
      `, [wId, merchant_id, numAmount, bank_name, account_number, ifsc || 'SBIN0001234', finalRemark]);

      const createdWths = await pgQuery(`SELECT * FROM withdrawals WHERE id = $1`, [wId]);

      return sendJson(res, 201, {
        success: true,
        message: 'Withdrawal request submitted! Pending Admin payout clearance.',
        withdrawal: createdWths[0],
        withdrawal_id: wId
      });
    }

    if (pathname === '/api/admin/verify-withdrawal' && method === 'POST') {
      const { withdrawal_id, action, remark, utr } = await parseJsonBody(req);
      const wths = await pgQuery(`SELECT * FROM withdrawals WHERE id = $1`, [withdrawal_id]);
      const wth = wths[0] || null;
      if (!wth) return sendJson(res, 404, { success: false, message: 'Withdrawal record not found.' });

      const amount = parseFloat(wth.amount);

      if (action === 'APPROVE') {
        const cleanUtr = (utr || '').trim();
        const finalRemark = cleanUtr ? `Disbursed via IMPS (UTR: ${cleanUtr})` : (remark || 'Bank payout cleared via IMPS/NEFT');
        await pgQuery(`
          UPDATE withdrawals 
          SET status = 'APPROVED', admin_remark = $1, verified_at = CURRENT_TIMESTAMP 
          WHERE id = $2
        `, [finalRemark, withdrawal_id]);

        await pgQuery(`
          UPDATE wallets 
          SET pending_balance = GREATEST(0.0, pending_balance - $1),
              withdrawn_amount = withdrawn_amount + $2,
              updated_at = CURRENT_TIMESTAMP
          WHERE user_id = $3
        `, [amount, amount, wth.merchant_id]);
      } else {
        await pgQuery(`
          UPDATE withdrawals 
          SET status = 'REJECTED', admin_remark = $1, verified_at = CURRENT_TIMESTAMP 
          WHERE id = $2
        `, [remark || 'Bank account details mismatch', withdrawal_id]);

        await pgQuery(`
          UPDATE wallets 
          SET pending_balance = GREATEST(0.0, pending_balance - $1),
              available_balance = available_balance + $2,
              updated_at = CURRENT_TIMESTAMP
          WHERE user_id = $3
        `, [amount, amount, wth.merchant_id]);
      }

      const updatedW = await pgQuery(`SELECT * FROM withdrawals WHERE id = $1`, [withdrawal_id]);
      const updatedWWallet = await pgQuery(`SELECT * FROM wallets WHERE user_id = $1`, [wth.merchant_id]);

      return sendJson(res, 200, {
        success: true,
        message: `Withdrawal ${action === 'APPROVE' ? 'Approved' : 'Rejected'}.`,
        withdrawal: updatedW[0],
        wallet: updatedWWallet[0]
      });
    }

    // ----------------------------------------------------
    // 6. INQUIRIES & APPLICATIONS
    // ----------------------------------------------------
    if (pathname === '/api/inquiries/submit' && method === 'POST') {
      const { type, name, phone, merchant_id, amount, category, location, remarks } = await parseJsonBody(req);
      if (!name || !phone) {
        return sendJson(res, 400, { success: false, message: 'Name and phone are required.' });
      }
      const prefix = type === 'LOAN' ? 'LN' : (type === 'FRANCHISE' ? 'FR' : 'INQ');
      const inqId = `${prefix}-${Math.floor(1000 + Math.random() * 9000)}`;
      await pgQuery(`
        INSERT INTO inquiries (id, type, name, phone, merchant_id, amount, category, location, remarks)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [inqId, type || 'LOAN', name, phone, merchant_id || null, amount || 'N/A', category || 'General', location || 'Hyderabad', remarks || '']);

      const created = await pgQuery(`SELECT * FROM inquiries WHERE id = $1`, [inqId]);
      return sendJson(res, 201, { success: true, message: 'Application submitted successfully!', inquiry: created[0] });
    }

    if (pathname === '/api/inquiries' && method === 'GET') {
      const inquiries = await pgQuery(`SELECT * FROM inquiries ORDER BY created_at DESC`);
      return sendJson(res, 200, { success: true, inquiries });
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
