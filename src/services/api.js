import { supabase, getApiUrl, fetchWithTimeout } from './supabase.js';
import { getPlainErrorMessage } from '../utils/errorMessages.js';
export { getPlainErrorMessage };

/**
 * RONAV TECHNOLOGIES — Master API & Hierarchy Engine
 * Pure Direct-to-Backend Implementation
 * All operations execute live against PostgreSQL via validated server endpoints.
 */

// ----------------------------------------------------
// 1. AUTH & USER PROFILES
// ----------------------------------------------------
export async function loginUser(credentials) {
  try {
    const { id, role, password } = credentials || {};
    let cleanId = (id || '').trim().toUpperCase();
    if (!cleanId) {
      return { success: false, message: 'Please enter your User ID.' };
    }

    // Normalize admin ID
    if (cleanId === 'ADMIN' || cleanId === 'ADM001') {
      cleanId = 'ADM001';
    }

    // Explicitly reject 10-digit mobile numbers
    if (/^\d{10}$/.test(cleanId)) {
      return { 
        success: false, 
        message: 'Access Denied: Mobile number login is disabled. Please login using your assigned User ID (e.g. ADM001, MST..., SD..., DIST..., MID...).' 
      };
    }

    const res = await fetchWithTimeout(getApiUrl('/api/auth/login'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: cleanId, password, role })
    });
    const data = await res.json();
    if (data && data.success && data.token && typeof window !== 'undefined') {
      sessionStorage.setItem('ronav_token', data.token);
      localStorage.setItem('ronav_token', data.token);
    }
    return data;
  } catch (err) {
    console.error('loginUser error:', err);
    return { success: false, message: err.message || 'Login failed. Please check network connection.' };
  }
}

/**
 * Request password reset ticket via Help Desk (No direct password overwrite)
 */
export async function resetUserPassword(query) {
  try {
    if (!query || !query.trim()) {
      return { success: false, message: 'Please enter your registered User ID or Mobile Number.' };
    }
    const res = await fetchWithTimeout(getApiUrl('/api/auth/forgot-password-request'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: query.trim() })
    });
    return await res.json();
  } catch (err) {
    console.error('resetUserPassword error:', err);
    return { success: false, message: err.message || 'Failed to request password reset.' };
  }
}

/**
 * UNIFIED SESSION LIFECYCLE MANAGEMENT
 * Guarantees consistent session preservation across page reloads without role collision.
 */
export function getAuthSession() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem('ronav_session');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.user) return parsed;
    }
  } catch (err) { console.warn('Session parse error:', err); }

  // Fallback / legacy compatibility
  const rawMerchant = sessionStorage.getItem('ronav_merchant_user');
  if (rawMerchant) {
    try {
      const u = JSON.parse(rawMerchant);
      if (u && u.id) return { role: u.role, user: u };
    } catch (err) {
      console.warn('[api] Failed to parse merchant session:', err);
    }
  }
  const rawAdmin = sessionStorage.getItem('ronav_admin_user');
  if (rawAdmin) {
    try {
      const a = JSON.parse(rawAdmin);
      if (a && a.id) return { role: a.role, user: a };
    } catch (err) {
      console.warn('[api] Failed to parse admin session:', err);
    }
  }
  return null;
}

export function setAuthSession(sessionData) {
  if (typeof window === 'undefined') return;
  if (!sessionData || !sessionData.user) {
    clearAuthSession();
    return;
  }
  const payload = {
    role: sessionData.role || sessionData.user.role,
    user: sessionData.user,
    token: sessionData.token || (typeof window !== 'undefined' ? sessionStorage.getItem('ronav_token') : null),
    timestamp: Date.now()
  };
  sessionStorage.setItem('ronav_session', JSON.stringify(payload));
  if (sessionData.token) {
    sessionStorage.setItem('ronav_token', sessionData.token);
    localStorage.setItem('ronav_token', sessionData.token);
  }
  if (payload.role === 'ADMIN' || payload.user.id === 'ADM001') {
    sessionStorage.setItem('ronav_admin_user', JSON.stringify(payload.user));
    sessionStorage.removeItem('ronav_merchant_user');
  } else {
    sessionStorage.setItem('ronav_merchant_user', JSON.stringify(payload.user));
    sessionStorage.removeItem('ronav_admin_user');
  }
}

export function clearAuthSession() {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem('ronav_session');
  sessionStorage.removeItem('ronav_admin_session');
  sessionStorage.removeItem('ronav_merchant_user');
  sessionStorage.removeItem('ronav_current_view');
  sessionStorage.removeItem('ronav_merchant_active_tab');
  sessionStorage.removeItem('ronav_user_pos');
  sessionStorage.removeItem('ronav_merchant_selected_machine');
  sessionStorage.removeItem('ronav_token');
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem('ronav_user');
    localStorage.removeItem('ronav_user_details_overrides');
    localStorage.removeItem('ronav_token');
  }
}

/**
 * Update user password with current password verification
 */
export async function updateUserPassword(userId, currentPassword, newPassword) {
  try {
    if (!userId || !currentPassword || !newPassword) {
      return { success: false, message: 'All password fields are required.' };
    }
    if (newPassword.trim().length < 6) {
      return { success: false, message: 'New password must be at least 6 characters long.' };
    }

    const res = await fetchWithTimeout(getApiUrl('/api/auth/change-password'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: userId.trim(), currentPassword: currentPassword.trim(), newPassword: newPassword.trim() })
    });
    return await res.json();
  } catch (err) {
    console.error('updateUserPassword error:', err);
    return { success: false, message: err.message || 'Failed to update password.' };
  }
}

export async function verifySponsor(query) {
  try {
    if (!query || !query.trim()) {
      return { success: false, message: 'Please enter a Sponsor ID or Mobile Number.' };
    }
    const clean = query.trim();

    if (clean.toUpperCase() === 'ADM001' || clean.toLowerCase() === 'admin') {
      return {
        success: true,
        sponsor: { id: 'ADM001', name: 'RONAV Super Admin', role: 'ADMIN', mobile: '9966203038' }
      };
    }

    const res = await fetchWithTimeout(getApiUrl(`/api/users/${encodeURIComponent(clean)}`));
    const json = await res.json();

    if (!json.success || !json.user) {
      return { 
        success: false, 
        message: 'Invalid Sponsor ID. In the RONAV ecosystem, you can only register if referred by an authorized partner.' 
      };
    }

    const sponsor = json.user;
    return {
      success: true,
      sponsor: {
        id: sponsor.id,
        name: sponsor.name,
        role: sponsor.role,
        mobile: sponsor.mobile
      }
    };
  } catch (err) {
    console.error('verifySponsor error:', err);
    return { success: false, message: err.message };
  }
}

export async function registerWithReferral(data) {
  try {
    const { sponsor_id, name, mobile, role = 'MERCHANT', pos_provider = 'Pine Labs', notes } = data;

    if (!sponsor_id || !name || !mobile) {
      return { success: false, message: 'Sponsor ID, Name, and Mobile are strictly required.' };
    }

    // 1. Verify sponsor exists
    const sponsorRes = await verifySponsor(sponsor_id);
    if (!sponsorRes.success || !sponsorRes.sponsor) {
      return { success: false, message: sponsorRes.message || 'Invalid sponsor referral.' };
    }

    const sponsor = sponsorRes.sponsor;

    const targetRole = role || data.role;
    if (!targetRole) {
      return { success: false, message: 'Role is required for registration.' };
    }

    // 2. Delegate to createDownstreamUser with sponsor as creator_id
    const payload = {
      creator_id: sponsor.id,
      parent_id: sponsor.id,
      name: name.trim(),
      mobile: mobile.trim(),
      role: targetRole.toUpperCase(),
      pos_provider: pos_provider || 'Pine Labs',
      pos_vendor: pos_provider === 'Pine Labs' ? 'Rose Navaneetham Enterprises' : 'RONAV Technologies',
      device_plan: 'RENTAL',
      monthly_rent: data.monthly_rent || data.rent || '',
      settlement_type: 'T1'
    };

    const res = await createDownstreamUser(payload);
    if (!res.success) {
      return res;
    }

    return {
      success: true,
      message: `✓ Successfully registered under ${sponsor.name}!`,
      credentials: res.credentials,
      sponsor
    };
  } catch (err) {
    console.error('registerWithReferral error:', err);
    return { success: false, message: err.message };
  }
}

export async function adminResetUserPassword(userId, newPassword, adminId = 'ADM001', adminPassword = '') {
  try {
    if (!userId || !newPassword || !newPassword.trim()) {
      return { success: false, message: 'User ID and a new password are required.' };
    }

    const res = await fetchWithTimeout(getApiUrl('/api/admin/users/reset-password'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        adminId,
        adminPassword,
        targetUserId: userId.trim(),
        newPassword: newPassword.trim()
      })
    });
    return await res.json();
  } catch (err) {
    console.error('adminResetUserPassword error:', err);
    return { success: false, message: err.message };
  }
}

// ----------------------------------------------------
// 2. USER ROSTER & HIERARCHY TREE
// ----------------------------------------------------
export async function getAllUsers() {
  try {
    const [usersRes, walletsRes, posRes, statusRes] = await Promise.all([
      supabase.from('users').select('*').order('created_at', { ascending: false }),
      supabase.from('wallets').select('*'),
      supabase.from('merchant_pos').select('*'),
      supabase.from('inquiries').select('*').eq('id', 'SYS-USER-STATUSES').maybeSingle()
    ]);

    if (usersRes.error) {
      return { success: false, message: usersRes.error.message || 'Failed to load users from database.', users: [] };
    }

    const users = usersRes.data || [];
    const wallets = walletsRes.data || [];
    const posList = posRes.data || [];

    let cloudStatusMap = {};
    if (statusRes?.data?.remarks) {
      try { cloudStatusMap = JSON.parse(statusRes.data.remarks); } catch (err) { console.warn('cloudStatusMap parse error:', err); }
    }

    const walletMap = {};
    wallets.forEach(w => {
      const uid = (w.user_id || '').toUpperCase();
      if (!walletMap[uid]) {
        walletMap[uid] = w;
      }
    });

    const posMap = {};
    posList.forEach(p => { posMap[p.merchant_id] = p; });

    const userMap = {};
    users.forEach(u => { userMap[u.id] = u; });

    // Helper to trace full upline chain for any user
    const getUplineMeta = (u) => {
      const upline = [];
      let currId = u.creator_id;
      let safety = 0;
      while (currId && currId !== 'ADM001' && safety < 10) {
        safety++;
        const parent = userMap[currId];
        if (!parent) break;
        upline.unshift(parent);
        currId = parent.creator_id;
      }

      const directParent = userMap[u.creator_id] || null;
      const creator_name = directParent ? directParent.name : (u.creator_id === 'ADM001' ? 'RONAV Super Admin' : (u.creator_id || 'RONAV Super Admin'));
      const creator_role = directParent ? directParent.role : 'ADMIN';

      const sdAncestor = upline.find(a => a.role === 'SUPER_DISTRIBUTOR');
      const distAncestor = upline.find(a => a.role === 'DISTRIBUTOR');

      const parent_sd_name = sdAncestor ? sdAncestor.name : (directParent?.role === 'SUPER_DISTRIBUTOR' ? directParent.name : 'Direct');
      const parent_sd_id = sdAncestor ? sdAncestor.id : (directParent?.role === 'SUPER_DISTRIBUTOR' ? directParent.id : 'ADM001');

      const parent_dist_name = distAncestor ? distAncestor.name : (directParent?.role === 'DISTRIBUTOR' ? directParent.name : null);
      const parent_dist_id = distAncestor ? distAncestor.id : (directParent?.role === 'DISTRIBUTOR' ? directParent.id : null);

      let pathParts = ['Direct'];
      upline.forEach(a => {
        const roleIcon = a.role === 'SUPER_DISTRIBUTOR' ? '⚡' : (a.role === 'DISTRICT_DISTRIBUTOR' || a.role === 'DIST_FRANCHISE') ? '🏛️' : '📦';
        pathParts.push(`${roleIcon} ${a.name}`);
      });
      const upline_path_str = pathParts.join(' ➔ ');

      return {
        creator_name,
        creator_role,
        parent_sd_name,
        parent_sd_id,
        parent_dist_name,
        parent_dist_id,
        upline_chain: upline,
        upline_path_str
      };
    };

    const enriched = users.map(u => {
      const w = walletMap[u.id] || {};
      const p = posMap[u.id] || {};
      const meta = getUplineMeta(u);
      const userStatus = cloudStatusMap[u.id] || u.status || 'ACTIVE';

      return {
        ...u,
        status: userStatus,
        pos_raw: p || null,
        channels: u.channels || parseMerchantChannels(p),
        pos_provider: p.provider || null,
        pos_terminal: p.terminal_id ? p.terminal_id.split('|')[0] : null,
        pos_rate: p.commission_rate || null,
        pos_vendor: p.vendor_entity || 'Rose Navaneetham Enterprises',
        pos_plan: p.device_plan || 'RENTAL',
        pos_rent: parseFloat(p.monthly_rent || 0.0),
        pos_settlement: p.settlement_type || 'T1',
        pos_instant_fee: p.instant_surcharge || 0.0,
        parent_name: u.parent_name || meta.creator_name,
        creator_name: u.creator_name || meta.creator_name,
        creator_role: u.creator_role || meta.creator_role,
        commission_rate_t1: u.commission_rate_t1 !== undefined && u.commission_rate_t1 !== null ? u.commission_rate_t1 : (u.rate_t1 !== undefined && u.rate_t1 !== null ? u.rate_t1 : null),
        commission_rate_instant: u.commission_rate_instant !== undefined && u.commission_rate_instant !== null ? u.commission_rate_instant : (u.rate_instant !== undefined && u.rate_instant !== null ? u.rate_instant : null),
        rate_t1: u.rate_t1 !== undefined && u.rate_t1 !== null ? u.rate_t1 : (u.commission_rate_t1 ? parseFloat(u.commission_rate_t1) : null),
        rate_instant: u.rate_instant !== undefined && u.rate_instant !== null ? u.rate_instant : (u.commission_rate_instant ? parseFloat(u.commission_rate_instant) : null),
        parent_sd_name: meta.parent_sd_name,
        parent_sd_id: meta.parent_sd_id,
        parent_dist_name: meta.parent_dist_name,
        parent_dist_id: meta.parent_dist_id,
        upline_chain: meta.upline_chain,
        upline_path_str: meta.upline_path_str,
        channel_balances: w.channel_balances || {
          pinelabs: { balance: 0, available_balance: 0 },
          payswiff: { balance: 0, available_balance: 0 },
          qr: { balance: 0, available_balance: 0 }
        },
        available_balance: w.available_balance !== undefined ? w.available_balance : (u.available_balance || 0),
        total_sales: w.total_sales || u.total_sales || 0,
        pending_balance: w.pending_balance || u.pending_balance || 0,
        received_sales: w.received_sales || u.received_sales || 0,
        withdrawn_amount: w.withdrawn_amount || u.withdrawn_amount || 0
      };
    });

    return { success: true, users: enriched };
  } catch (err) {
    console.error('getAllUsers error:', err);
    return { success: false, message: err.message, users: [] };
  }
}

export async function getHierarchyTree() {
  try {
    const liveRes = await fetchWithTimeout(getApiUrl('/api/hierarchy/tree'));
    const liveJson = await liveRes.json();
    if (liveJson && liveJson.success && liveJson.tree) {
      return liveJson;
    }
    return { success: false, message: liveJson?.error || liveJson?.message || 'Failed to fetch hierarchy tree from server' };
  } catch (err) {
    console.error('getHierarchyTree error:', err);
    return { success: false, message: err.message };
  }
}

export async function createDownstreamUser(userData) {
  try {
    const res = await fetchWithTimeout(getApiUrl('/api/users/create'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData)
    });
    const data = await res.json();
    return data;
  } catch (err) {
    console.error('createDownstreamUser error:', err);
    return { success: false, message: err.message || 'Failed to create user on server.' };
  }
}

// ----------------------------------------------------
// ----------------------------------------------------
// 3. LIVE WALLET & METRICS
// ----------------------------------------------------
export async function getWallet(userId) {
  try {
    const cleanId = String(userId || '').trim();
    if (!cleanId) {
      return { success: false, message: 'User ID is required to fetch wallet.', wallet: null };
    }

    const res = await fetchWithTimeout(getApiUrl(`/api/wallet/${encodeURIComponent(cleanId)}`));
    const data = await res.json();
    if (!data.success || !data.wallet) {
      return { 
        success: false, 
        message: data.message || 'Wallet not found or error loading balance.', 
        wallet: null, 
        balances: null,
        pos: data.pos ? { ...data.pos, channels: parseMerchantChannels(data.pos) } : null
      };
    }

    const enrichedPos = data.pos ? {
      ...data.pos,
      channels: parseMerchantChannels(data.pos)
    } : null;

    return { 
      success: true, 
      wallet: data.wallet, 
      balances: data.balances, 
      pos: enrichedPos 
    };
  } catch (err) {
    console.error('getWallet error:', err);
    return { success: false, message: err.message || 'Network error fetching wallet balance.', wallet: null };
  }
}

// ----------------------------------------------------
// 4. POS TERMINAL DYNAMIC RATES & PORTFOLIO PARSER
// ----------------------------------------------------
export function parseMerchantChannels(posRecord) {
  const defaultObj = {
    pine_labs: { enabled: false, terminal_id: '', rate_t1: 0, rate_instant: 0, vendor: 'Rose Navaneetham Enterprises', plan: 'RENTAL', rent: 0 },
    payswiff: { enabled: false, terminal_id: '', rate_t1: 0, rate_instant: 0, vendor: 'RONAV Technologies', plan: 'RENTAL', rent: 0 },
    qr: { enabled: false, rate_instant: 0, vendor: 'RONAV Technologies' },
    enabledList: []
  };

  if (!posRecord) return defaultObj;

  const tid = posRecord.terminal_id || '';
  if (tid.startsWith('[PORTFOLIO]')) {
    try {
      const jsonStr = tid.replace('[PORTFOLIO]', '').trim();
      const parsed = JSON.parse(jsonStr);
      const enabledList = [];
      if (parsed.pine_labs?.enabled) enabledList.push('pine_labs');
      if (parsed.payswiff?.enabled) enabledList.push('payswiff');
      if (parsed.qr?.enabled) enabledList.push('qr');
      return {
        pine_labs: { ...defaultObj.pine_labs, ...(parsed.pine_labs || {}) },
        payswiff: { ...defaultObj.payswiff, ...(parsed.payswiff || {}) },
        qr: { ...defaultObj.qr, ...(parsed.qr || {}) },
        enabledList
      };
    } catch (err) {
      console.warn('[api] Failed to parse merchant channel notes:', err);
      return {
        ...defaultObj,
        hasError: true,
        error: 'Could not load rates, try again'
      };
    }
  }

  // Legacy single machine parsing
  const rates = parsePosTerminalRates(tid, posRecord.commission_rate || 0);
  const prov = (posRecord.provider || '').toLowerCase();
  const isQR = prov.includes('qr') || prov.includes('upi');
  const isSwiff = prov.includes('swiff');
  const isPine = prov.includes('pine') || (!isSwiff && !isQR);

  const enabledList = [];
  if (isPine) enabledList.push('pine_labs');
  if (isSwiff) enabledList.push('payswiff');
  if (isQR) enabledList.push('qr');

  return {
    pine_labs: {
      enabled: isPine,
      terminal_id: isPine ? (rates.terminal_id || 'PL-01') : '',
      rate_t1: parseFloat(posRecord.commission_rate_t1 || rates.rateT1 || 0),
      rate_instant: parseFloat(posRecord.commission_rate_instant || rates.rateInstant || 0),
      vendor: 'Rose Navaneetham Enterprises',
      plan: posRecord.device_plan || 'RENTAL',
      rent: parseFloat(posRecord.monthly_rent || 0)
    },
    payswiff: {
      enabled: isSwiff,
      terminal_id: isSwiff ? (rates.terminal_id || 'SWIFF-01') : '',
      rate_t1: parseFloat(posRecord.commission_rate_t1 || rates.rateT1 || 0),
      rate_instant: parseFloat(posRecord.commission_rate_instant || rates.rateInstant || 0),
      vendor: posRecord.vendor_entity || 'RONAV Technologies',
      plan: posRecord.device_plan || 'RENTAL',
      rent: parseFloat(posRecord.monthly_rent || 0)
    },
    qr: {
      enabled: isQR,
      rate_instant: parseFloat(posRecord.commission_rate_instant || rates.rateInstant || 0),
      vendor: 'RONAV Technologies'
    },
    enabledList
  };
}

export function serializeMerchantChannels(channels) {
  const payload = {
    pine_labs: channels?.pine_labs ? {
      enabled: Boolean(channels.pine_labs.enabled),
      terminal_id: (channels.pine_labs.terminal_id || '').trim(),
      vendor: 'Rose Navaneetham Enterprises',
      rate_t1: parseFloat(channels.pine_labs.rate_t1) || 0,
      rate_instant: parseFloat(channels.pine_labs.rate_instant || channels.pine_labs.rate_t1) || 0,
      plan: channels.pine_labs.plan || 'RENTAL',
      rent: parseFloat(channels.pine_labs.rent) || 0.0
    } : { enabled: false },
    payswiff: channels?.payswiff ? {
      enabled: Boolean(channels.payswiff.enabled),
      terminal_id: (channels.payswiff.terminal_id || '').trim(),
      vendor: channels.payswiff.vendor === 'R.P. Technologies' ? 'R.P. Technologies' : 'RONAV Technologies',
      rate_t1: parseFloat(channels.payswiff.rate_t1) || 0,
      rate_instant: parseFloat(channels.payswiff.rate_instant || channels.payswiff.rate_t1) || 0,
      plan: channels.payswiff.plan || 'RENTAL',
      rent: parseFloat(channels.payswiff.rent) || 0.0
    } : { enabled: false },
    qr: channels?.qr ? {
      enabled: Boolean(channels.qr.enabled),
      vendor: 'RONAV Technologies',
      rate_instant: parseFloat(channels.qr.rate_instant) || 0
    } : { enabled: false }
  };
  return `[PORTFOLIO] ${JSON.stringify(payload)}`;
}

export async function updateMerchantChannels(merchantId, channels) {
  try {
    const res = await fetchWithTimeout(getApiUrl('/api/channels/update'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ merchantId, channels, adminId: 'ADM001' })
    });
    const data = await res.json();
    return data;
  } catch (err) {
    console.error('updateMerchantChannels error:', err);
    return { success: false, message: err.message || 'Failed to update channels on server.' };
  }
}

export function formatTerminalDisplay(terminalStr, defaultProvider = 'Pine Labs') {
  if (!terminalStr) return defaultProvider || 'POS Pending';
  if (terminalStr.startsWith('[PORTFOLIO]')) {
    try {
      const jsonStr = terminalStr.replace('[PORTFOLIO]', '').trim();
      const obj = JSON.parse(jsonStr);
      const parts = [];
      if (obj.pine_labs?.enabled) {
        parts.push(`Pine Labs (${obj.pine_labs.terminal_id || 'Active'})`);
      }
      if (obj.payswiff?.enabled) {
        parts.push(`Payswiff (${obj.payswiff.terminal_id || 'Active'})`);
      }
      if (obj.qr?.enabled) {
        parts.push(`Company QR`);
      }
      return parts.length > 0 ? parts.join(' • ') : defaultProvider;
    } catch (_) {
      return defaultProvider;
    }
  }
  return `${defaultProvider} (${terminalStr.split('|')[0]})`;
}

export function parsePosTerminalRates(terminalStr, baseRate = 0.0) {
  const str = terminalStr || '';
  let cleanId = str;
  let rateT1 = typeof baseRate === 'number' ? baseRate : (parseFloat(baseRate) || 0);
  let rateInstant = rateT1;
  let adminCut = 0.0;
  let uplineCut = 0.0;

  const channels = {
    pinelabs: { enabled: false, terminal_id: '', rateT1, rateInstant },
    payswiff: { enabled: false, terminal_id: '', rateT1, rateInstant },
    qr: { enabled: false, terminal_id: 'RONAV-UPI-HQ', rateInstant: 0 }
  };

  if (str.startsWith('[PORTFOLIO]')) {
    try {
      const jsonStr = str.replace('[PORTFOLIO]', '').trim();
      const p = JSON.parse(jsonStr);
      if (p.pine_labs?.enabled) {
        channels.pinelabs = {
          enabled: true,
          terminal_id: p.pine_labs.terminal_id || 'PL-01',
          rateT1: parseFloat(p.pine_labs.rate_t1) || 0,
          rateInstant: parseFloat(p.pine_labs.rate_instant || p.pine_labs.rate_t1) || 0
        };
      }
      if (p.payswiff?.enabled) {
        channels.payswiff = {
          enabled: true,
          terminal_id: p.payswiff.terminal_id || 'SWIFF-01',
          rateT1: parseFloat(p.payswiff.rate_t1) || 0,
          rateInstant: parseFloat(p.payswiff.rate_instant || p.payswiff.rate_t1) || 0
        };
      }
      if (p.qr?.enabled) {
        channels.qr = {
          enabled: true,
          terminal_id: 'RONAV-UPI-HQ',
          rateInstant: parseFloat(p.qr.rate_instant) || 0
        };
      }
      const primary = channels.pinelabs.enabled ? channels.pinelabs : (channels.payswiff.enabled ? channels.payswiff : channels.qr);
      return {
        terminal_id: primary.terminal_id,
        raw_terminal: str,
        rateT1: primary.rateT1 || 0,
        rateInstant: primary.rateInstant || primary.rateT1 || 0,
        adminCut: 0,
        uplineCut: 0,
        channels
      };
    } catch (err) {
      console.warn('[api] Failed to parse legacy machine notes for rate/commission:', err);
      return {
        terminal_id: 'ERR',
        raw_terminal: str,
        rateT1: null,
        rateInstant: null,
        adminCut: null,
        uplineCut: null,
        channels: {},
        hasError: true,
        error: 'Could not load rates, try again'
      };
    }
  }

  if (str.includes('|')) {
    const parts = str.split('|');
    cleanId = parts[0];
    parts.slice(1).forEach(part => {
      const [k, v] = part.split(':');
      const num = parseFloat(v);
      if (!isNaN(num)) {
        if (k === 'T1') rateT1 = num;
        if (k === 'INS') rateInstant = num;
        if (k === 'ADM') adminCut = num;
        if (k === 'UPL') uplineCut = num;
      }
    });
  }

  return {
    terminal_id: cleanId,
    raw_terminal: str,
    rateT1,
    rateInstant,
    adminCut,
    uplineCut,
    channels
  };
}

// ----------------------------------------------------
// 4.1 TRANSACTIONS & MULTI-TIER COMMISSION ROLL-UP
// ----------------------------------------------------
// REMARK METADATA PARSER (EXTRACTS ACTUAL POS / CHANNEL / VENDOR)
// ----------------------------------------------------
export function parseRemarkMetadata(remarkStr, fallbackPos = {}) {
  const fallbackProv = fallbackPos?.provider || 'Pine Labs';
  const fallbackVend = fallbackPos?.vendor_entity || ((fallbackProv === 'Pine Labs') ? 'Rose Navaneetham Enterprises' : 'RONAV Technologies');
  const fallbackTerm = fallbackPos?.terminal_id || '';

  if (!remarkStr || typeof remarkStr !== 'string') {
    const ch = normalizeChannelKey(fallbackProv);
    return {
      channel: ch,
      pos_provider: fallbackProv,
      pos_vendor: fallbackVend,
      pos_terminal: fallbackTerm
    };
  }

  const r = remarkStr;
  const matchPos = r.match(/POS:\s*([^|•\r\n]+)/i);
  const matchChannel = r.match(/Channel:\s*([^|•\r\n]+)/i);
  const matchVendor = r.match(/Vendor:\s*([^|•\r\n]+)/i);
  const matchTerminal = r.match(/Terminal:\s*([^|•\r\n]+)/i);

  let extractedChannel = matchChannel ? matchChannel[1].trim().toLowerCase() : '';
  let extractedPos = matchPos ? matchPos[1].trim() : '';
  let extractedVendor = matchVendor ? matchVendor[1].trim() : '';
  let extractedTerminal = matchTerminal ? matchTerminal[1].trim() : fallbackTerm;

  const rLow = r.toLowerCase();
  if (!extractedChannel) {
    if (rLow.includes('pos: payswiff') || rLow.includes('channel: payswiff') || rLow.includes('payswiff') || rLow.includes('swiff')) {
      extractedChannel = 'payswiff';
    } else if (rLow.includes('pos: company qr') || rLow.includes('channel: qr') || rLow.includes('qr_scan') || rLow.includes('qr_payout') || rLow.includes('company qr')) {
      extractedChannel = 'qr';
    } else if (rLow.includes('pos: pine labs') || rLow.includes('channel: pinelabs') || rLow.includes('pine labs') || rLow.includes('pinelabs')) {
      extractedChannel = 'pinelabs';
    }
  }

  if (extractedChannel === 'payswiff' || rLow.includes('swiff') || rLow.includes('payswiff')) {
    extractedChannel = 'payswiff';
    if (!extractedPos || extractedPos.toLowerCase().includes('pine')) extractedPos = 'Payswiff';
    if (!extractedVendor || extractedVendor.toLowerCase().includes('rose')) {
      const isRp = extractedVendor.toLowerCase().includes('rp') || rLow.includes('rp tech') || rLow.includes('r.p.');
      extractedVendor = isRp ? 'R.P. Technologies' : 'RONAV Technologies';
    }
  } else if (extractedChannel === 'qr' || rLow.includes('qr') || rLow.includes('company qr')) {
    extractedChannel = 'qr';
    if (!extractedPos || extractedPos.toLowerCase().includes('pine')) extractedPos = 'Company QR (UPI)';
    if (!extractedVendor) extractedVendor = 'RONAV Technologies';
  } else if (extractedChannel === 'pinelabs' || rLow.includes('pine')) {
    extractedChannel = 'pinelabs';
    if (!extractedPos) extractedPos = 'Pine Labs';
    if (!extractedVendor) extractedVendor = 'Rose Navaneetham Enterprises';
  } else {
    extractedPos = extractedPos || fallbackProv;
    extractedChannel = normalizeChannelKey(extractedPos);
    extractedVendor = extractedVendor || fallbackVend;
  }

  return {
    channel: extractedChannel || null,
    pos_provider: extractedPos || null,
    pos_vendor: extractedVendor || null,
    pos_terminal: extractedTerminal
  };
}

// ----------------------------------------------------
// TRANSACTION CHANNEL CLASSIFIER (CENTRAL SOURCE OF TRUTH)
// ----------------------------------------------------
export function classifyTransactionChannel(item) {
  if (!item) return 'pinelabs';

  // 0. Direct channel property
  if (item.channel) {
    const ch = String(item.channel).toLowerCase();
    if (ch.includes('swiff')) return 'payswiff';
    if (ch.includes('qr') || ch.includes('upi')) return 'qr';
    if (ch.includes('pine')) return 'pinelabs';
  }

  // 1. Check notes / parsed card swipe metadata
  if (item.notes && typeof item.notes === 'string') {
    if (item.notes.includes('[CARD_SWIPE_ENTRY]')) {
      try {
        const jsonPart = item.notes.slice(item.notes.indexOf('{'));
        const meta = JSON.parse(jsonPart);
        const metaProv = (meta.pos_provider || '').toLowerCase();
        if (metaProv.includes('swiff')) return 'payswiff';
        if (metaProv.includes('qr') || metaProv.includes('upi')) return 'qr';
        if (metaProv.includes('pine')) return 'pinelabs';

        const userNotes = (meta.user_notes || '').toLowerCase();
        if (userNotes.includes('swiff') || userNotes.includes('payswiff')) return 'payswiff';
        if (userNotes.includes('qr') || userNotes.includes('upi')) return 'qr';
        if (userNotes.includes('pine')) return 'pinelabs';
      } catch (err) {
        console.warn('[api] Failed to classify user notes channel:', err);
      }
    } else {
      const n = item.notes.toLowerCase();
      if (n.includes('swiff') || n.includes('payswiff')) return 'payswiff';
      if (n.includes('qr') || n.includes('upi')) return 'qr';
      if (n.includes('pine')) return 'pinelabs';
    }
  }

  // 2. Check admin_remark (explicit POS / Channel tag for withdrawals & audits)
  if (item.admin_remark && typeof item.admin_remark === 'string') {
    const r = item.admin_remark.toLowerCase();
    if (r.includes('pos: payswiff') || r.includes('channel: payswiff') || r.includes('payswiff') || r.includes('swiff')) return 'payswiff';
    if (r.includes('pos: company qr') || r.includes('channel: qr') || r.includes('qr_scan') || r.includes('qr_payout') || r.includes('qr') || r.includes('upi')) return 'qr';
    if (r.includes('pos: pine labs') || r.includes('channel: pinelabs') || r.includes('pine labs') || r.includes('pinelabs')) return 'pinelabs';
  }

  const type = (item.type || '').toUpperCase();
  const provider = (item.pos_provider || item.provider || '').toLowerCase();
  const id = (item.id || '').toUpperCase();

  // 3. Explicit QR Scan / QR payment type
  if (type === 'QR_SCAN' || type === 'QR' || type === 'QR_PAYMENT' || type === 'QR_PAYOUT') return 'qr';

  // 4. Provider or ID indicates QR/UPI (excluding hardware swipe providers)
  if ((provider.includes('qr') || provider.includes('upi') || id.startsWith('TXN-QR-')) && !provider.includes('swiff') && !provider.includes('pine')) {
    return 'qr';
  }

  // 5. Provider or ID indicates Payswiff
  if (provider.includes('swiff') || id.startsWith('TXN-SW-') || id.includes('SWIFF')) {
    return 'payswiff';
  }

  // 6. Provider or ID indicates Pine Labs
  if (provider.includes('pine') || id.startsWith('TXN-PL-') || id.includes('PINE')) {
    return 'pinelabs';
  }

  return 'pinelabs';
}

export function normalizeChannelKey(key) {
  if (!key) return 'pinelabs';
  const k = String(key).toLowerCase().replace(/[-_]/g, '');
  if (k.includes('swiff')) return 'payswiff';
  if (k.includes('qr') || k.includes('upi')) return 'qr';
  return 'pinelabs';
}

// Central Dynamic User Rate Resolver (Zero Hardcoded Percentages & Channel-Isolated)
export function getUserBuyRate(user, pos, isInstant = false, targetChannel = null) {
  const chKey = targetChannel ? normalizeChannelKey(targetChannel) : null;
  const role = (user?.role || '').toUpperCase();
  const uid = (user?.id || '').toUpperCase();

  if (pos) {
    const parsed = parsePosTerminalRates(pos.terminal_id, pos.commission_rate);
    if (chKey && parsed.channels) {
      const ch = parsed.channels[chKey] || (chKey === 'pinelabs' ? parsed.channels.pine_labs : null);
      if (ch && ch.enabled) {
        if (chKey === 'qr') {
          const qrRate = parseFloat(ch.rateInstant || ch.rate_instant);
          if (!isNaN(qrRate) && qrRate > 0) return qrRate;
        } else {
          const rateVal = isInstant ? parseFloat(ch.rateInstant || ch.rate_instant) : parseFloat(ch.rateT1 || ch.rate_t1);
          if (!isNaN(rateVal) && rateVal > 0) return rateVal;
        }
      }
    } else if (!chKey) {
      const r = isInstant ? (pos.commission_rate_instant || parsed.rateInstant) : (pos.commission_rate_t1 || parsed.rateT1);
      if (r !== undefined && r !== null && !isNaN(parseFloat(r)) && parseFloat(r) > 0) {
        return parseFloat(r);
      }
    }
  }

  if (user) {
    const uRate = isInstant ? (user.commission_rate_instant || user.commission_rate_t1 || user.margin_rate) : (user.commission_rate_t1 || user.margin_rate);
    if (uRate !== undefined && uRate !== null && !isNaN(parseFloat(uRate)) && parseFloat(uRate) > 0) {
      return parseFloat(uRate);
    }
  }

  return 0.0;
}

export async function validateUtrUniqueness(utr, excludeTxnId = null, excludeWithdrawalId = null, scope = 'ALL') {
  if (!utr) return { isUnique: true };
  const clean = String(utr).trim().toUpperCase();
  if (clean.length < 5 || clean.startsWith('RRN') || clean.startsWith('TXN-') || clean.startsWith('BBPS-') || clean.startsWith('CMS-') || clean.startsWith('CMS_') || clean.startsWith('BATCH-')) {
    return { isUnique: true };
  }

  try {
    // 1. Check in transactions table (ref_number and notes) if scope is 'ALL' or 'SALE'
    if (scope === 'ALL' || scope === 'SALE') {
      const { data: txns } = await supabase
        .from('transactions')
        .select('id, ref_number, notes, amount, status, created_at');

      if (txns && txns.length > 0) {
        const dupTxn = txns.find(t => {
          if (excludeTxnId && t.id === excludeTxnId) return false;
          const ref = (t.ref_number || '').trim().toUpperCase();
          if (ref === clean) return true;
          const notes = (t.notes || '').toUpperCase();
          if (notes.includes(`UTR: ${clean}`) || notes.includes(`UTR:${clean}`) || notes.includes(`SLIP: ${clean}`)) {
            return true;
          }
          return false;
        });

        if (dupTxn) {
          return {
            isUnique: false,
            message: `⚠️ Duplicate Slip UTR / Ref Number: "${clean}" has already been used in sale transaction ${dupTxn.id} (Status: ${dupTxn.status}, Amount: ₹${dupTxn.amount}). Each swipe sale requires a unique Slip UTR.`
          };
        }
      }
    }

    // 2. Check in withdrawals table (admin_remark containing UTR) if scope is 'ALL' or 'WITHDRAWAL'
    if (scope === 'ALL' || scope === 'WITHDRAWAL') {
      const { data: withs } = await supabase
        .from('withdrawals')
        .select('id, amount, status, admin_remark, created_at');

      if (withs && withs.length > 0) {
        const dupWith = withs.find(w => {
          if (excludeWithdrawalId && w.id === excludeWithdrawalId) return false;
          const remark = (w.admin_remark || '').toUpperCase();
          if (remark.includes(`UTR: ${clean}`) || remark.includes(`UTR:${clean}`)) return true;
          const m = remark.match(/(?:UTR:?\s*)+([A-Za-z0-9_-]+)/i);
          if (m && m[1].toUpperCase() === clean) return true;
          return false;
        });

        if (dupWith) {
          return {
            isUnique: false,
            message: `⚠️ Duplicate UTR: "${clean}" has already been submitted for payout request ${dupWith.id} (Status: ${dupWith.status}, Amount: ₹${dupWith.amount}). A Slip UTR can only be withdrawn once.`
          };
        }
      }
    }
  } catch (err) {
    console.error('validateUtrUniqueness notice:', err);
  }

  return { isUnique: true };
}

/**
 * Server-authoritative card swipe / QR collection quote
 * Computes exact fees and net payout from user_channel_rates. Zero browser math.
 */
export async function quoteTransaction(params) {
  try {
    const res = await fetchWithTimeout(getApiUrl('/api/transactions/quote'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });
    return await res.json();
  } catch (err) {
    console.error('quoteTransaction error:', err);
    return { success: false, message: err.message || 'Quote service unavailable.' };
  }
}

export async function recordMerchantSale(saleData) {
  try {
    const { 
      merchant_id, 
      amount, 
      customer_name, 
      customer_mobile, 
      type, 
      provider, 
      channel,
      ref_number, 
      rrn_number,
      settlement_type,
      terminal_id,
      notes,
      idempotency_key
    } = saleData;

    if (!merchant_id || !amount) {
      return { success: false, message: 'Merchant ID and Amount are required.' };
    }

    const rawCh = (channel || provider || '').toLowerCase();
    if (!rawCh) {
      return { success: false, message: 'CHANNEL_REQUIRED: Payment channel (Pine Labs, Payswiff, or QR) is required.' };
    }
    const cleanChannel = rawCh.includes('swiff') 
      ? 'payswiff' 
      : (rawCh.includes('qr') ? 'qr' : (rawCh.includes('pine') ? 'pinelabs' : null));
    if (!cleanChannel) {
      return { success: false, message: 'INVALID_CHANNEL: Allowed channels are Pine Labs, Payswiff, and QR.' };
    }

    // Rule: Pine Labs & Payswiff require T1 or INSTANT; QR must be NONE
    let mode = (settlement_type || 'T1').toUpperCase();
    if (cleanChannel === 'qr') {
      mode = 'NONE';
    } else if (mode !== 'T1' && mode !== 'INSTANT') {
      mode = 'T1';
    }

    const idempKey = idempotency_key || `IDEMP-SWIPE-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    const payload = {
      merchant_id,
      amount: parseFloat(amount),
      customer_name: customer_name || 'Counter Customer',
      customer_mobile: customer_mobile || '',
      type: type || 'POS_SWIPE',
      channel: cleanChannel,
      provider: cleanChannel === 'payswiff' ? 'Payswiff' : (cleanChannel === 'qr' ? 'RONAV QR' : 'Pine Labs'),
      ref_number: rrn_number || ref_number || '',
      settlement_type: mode,
      terminal_id: terminal_id || '',
      notes: notes || ''
    };

    const res = await fetchWithTimeout(getApiUrl('/api/transactions/record'), {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'idempotency-key': idempKey
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    return data;
  } catch (err) {
    console.error('recordMerchantSale error:', err);
    return { success: false, message: err.message || 'Failed to record transaction on server.' };
  }
}

export async function getMerchantTransactions(merchantId) {
  try {
    const { data: transactions, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('merchant_id', merchantId)
      .order('created_at', { ascending: false });

    if (error) return { success: false, message: error.message, transactions: [] };
    return { success: true, transactions: transactions || [] };
  } catch (err) {
    console.error('getMerchantTransactions error:', err);
    return { success: false, message: err.message, transactions: [] };
  }
}

// ----------------------------------------------------
// 5. DOWNSTREAM NETWORK ENGINE
// ----------------------------------------------------
export async function getDownstreamNetwork(creatorId) {
  try {
    const cleanId = String(creatorId || '').trim();
    if (!cleanId) {
      return { success: false, message: 'Creator ID is required.', partners: [] };
    }

    const res = await fetchWithTimeout(getApiUrl(`/api/network/downstream?creatorId=${encodeURIComponent(cleanId)}`));
    const data = await res.json();
    if (!data.success) {
      return { success: false, message: data.message || 'Failed to fetch downstream network.', partners: [] };
    }

    return {
      success: true,
      creator_id: data.creator_id,
      partners: data.partners || [],
      partner_count: data.partner_count || 0,
      total_commission_earned: parseFloat(data.network_commission_rupees || data.total_commission_earned || 0),
      total_downline_volume: parseFloat(data.network_sales_rupees || 0),
      today_network_profit: parseFloat(data.today_network_profit || 0),
      network_sales_paise: data.network_sales_paise,
      network_commission_paise: data.network_commission_paise,
      channel_volumes: data.channel_volumes || {
        pinelabs: 0,
        payswiff: 0,
        qr: 0,
        all: 0,
        today_pinelabs: 0,
        today_payswiff: 0,
        today_qr: 0,
        today_all: 0
      },
      channel_commissions: data.channel_commissions || {
        pinelabs: 0,
        payswiff: 0,
        qr: 0,
        today_pinelabs: 0,
        today_payswiff: 0,
        today_qr: 0
      }
    };
  } catch (err) {
    console.error('getDownstreamNetwork error:', err);
    return { success: false, message: err.message || 'Network error fetching downstream network.', partners: [] };
  }
}

export async function getPartnerTransactions(creatorId, partnerId) {
  try {
    const res = await fetchWithTimeout(getApiUrl(`/api/network/partner-transactions?creatorId=${encodeURIComponent(creatorId)}&partnerId=${encodeURIComponent(partnerId)}`));
    const data = await res.json();
    return data;
  } catch (err) {
    console.error('getPartnerTransactions error:', err);
    return { success: false, message: err.message, transactions: [] };
  }
}

// ----------------------------------------------------
// 6. BENEFICIARY BANK ACCOUNTS
// ----------------------------------------------------
export async function getBeneficiaries(merchantId) {
  try {
    const { data: beneficiaries, error } = await supabase
      .from('beneficiaries')
      .select('*')
      .eq('merchant_id', merchantId)
      .order('is_primary', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) return { success: false, message: error.message, beneficiaries: [] };
    return { success: true, beneficiaries: beneficiaries || [] };
  } catch (err) {
    console.error('getBeneficiaries error:', err);
    return { success: false, message: err.message, beneficiaries: [] };
  }
}

export async function addBeneficiary(data) {
  try {
    const res = await fetchWithTimeout(getApiUrl('/api/beneficiaries/create'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const resData = await res.json();
    return resData;
  } catch (err) {
    console.error('addBeneficiary error:', err);
    return { success: false, message: err.message || 'Failed to add beneficiary on server.' };
  }
}

// ----------------------------------------------------
// 7. ADMIN VERIFICATION & APPROVAL ENGINE
// ----------------------------------------------------
export async function getAdminPending() {
  try {
    const apiRes = await fetchWithTimeout(getApiUrl('/api/admin/pending'));
    const apiData = await apiRes.json();
    if (apiData && apiData.success) {
      return apiData;
    }
    return { success: false, message: apiData?.message || 'Failed to fetch admin pending data' };
  } catch (apiErr) {
    console.error('[getAdminPending] Error:', apiErr);
    return { success: false, message: apiErr.message || 'Failed to load admin pending data' };
  }
}

export async function verifyTransaction(txnId, action, remark = '', utr = '') {
  try {
    const session = getAuthSession();
    const callerId = session?.user?.id;
    const callerRole = session?.role || session?.user?.role;
    const res = await fetchWithTimeout(getApiUrl('/api/admin/verify-transaction'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ txn_id: txnId, action, remark, utr, callerId })
    });
    const data = await res.json();
    return data;
  } catch (err) {
    console.error('verifyTransaction error:', err);
    return { success: false, message: err.message || 'Failed to verify transaction on server.' };
  }
}

export async function clawbackTransaction(txnId, adminReason = 'Payment Cancelled by Admin') {
  return verifyTransaction(txnId, 'REJECT', adminReason);
}

// ----------------------------------------------------
// 8. WITHDRAWALS (CUSTOMER DISBURSAL & MERCHANT SETTLEMENT)
// ----------------------------------------------------
export async function requestWithdrawal(withdrawalData) {
  try {
    const headers = { 'Content-Type': 'application/json' };
    const idem = withdrawalData.idempotency_key || withdrawalData.idempotencyKey;
    if (idem) {
      headers['idempotency-key'] = idem;
    }
    const res = await fetchWithTimeout(getApiUrl('/api/withdrawals/request'), {
      method: 'POST',
      headers,
      body: JSON.stringify(withdrawalData)
    });
    const data = await res.json();
    return data;
  } catch (err) {
    console.error('requestWithdrawal error:', err);
    return { success: false, message: err.message || 'Failed to submit withdrawal request.' };
  }
}

export async function verifyWithdrawal(withdrawalId, action, remark = '', utrNumber = '') {
  try {
    const res = await fetchWithTimeout(getApiUrl('/api/admin/verify-withdrawal'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ withdrawal_id: withdrawalId, action, remark, utr: utrNumber })
    });
    const data = await res.json();
    return data;
  } catch (err) {
    console.error('verifyWithdrawal error:', err);
    return { success: false, message: err.message || 'Failed to verify withdrawal on server.' };
  }
}


// ----------------------------------------------------
// 8.1 DIRECT DATABASE PERSISTENCE FOR BANK SUBMISSIONS (ZERO LOCALSTORAGE)
// ----------------------------------------------------
export async function markWithdrawalsSubmittedToBank(withdrawalIds, batchMeta = {}) {
  try {
    if (!withdrawalIds || withdrawalIds.length === 0) return { success: true };
    const res = await fetchWithTimeout(getApiUrl('/api/admin/withdrawals/batch-status'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        withdrawalIds,
        action: 'SUBMITTED_TO_BANK',
        batchTag: batchMeta.batchId ? `[BATCH:${batchMeta.batchId}]` : '',
        batchNameTag: batchMeta.batchName ? `[BATCH_NAME:${batchMeta.batchName}]` : ''
      })
    });
    const data = await res.json();
    return data;
  } catch (err) {
    console.error('markWithdrawalsSubmittedToBank error:', err);
    return { success: false, message: err.message };
  }
}

export async function revertWithdrawalsToPending(withdrawalIds) {
  try {
    if (!withdrawalIds || withdrawalIds.length === 0) return { success: true };
    const res = await fetchWithTimeout(getApiUrl('/api/admin/withdrawals/batch-status'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        withdrawalIds,
        action: 'REVERT_PENDING'
      })
    });
    const data = await res.json();
    return data;
  } catch (err) {
    console.error('revertWithdrawalsToPending error:', err);
    return { success: false, message: err.message };
  }
}

export async function getMerchantWithdrawals(merchantId) {
  try {
    const res = await fetchWithTimeout(getApiUrl(`/api/withdrawals/merchant/${encodeURIComponent(merchantId)}`));
    const data = await res.json();
    if (!data.success) {
      return { success: false, message: data.message || 'Failed to fetch withdrawals from server.', withdrawals: [] };
    }
    const withdrawals = data.withdrawals || [];
    
    const enriched = (withdrawals || []).map(w => {
      let utrNumber = '';
      let isCustomerDisbursal = false;
      let isCommission = (w.admin_remark || '').includes('[COMMISSION_PAYOUT]') || (w.admin_remark || '').includes('"payout_purpose":"COMMISSION"');
      let customerName = '';
      let customerMobile = '';
      let settlementMode = 'INSTANT';
      let merchantNote = '';

      const isPendingToDisburse = (w.admin_remark || '').includes('[PENDING_TO_DISBURSE]');
      const isSubmittedToBank = (w.admin_remark || '').includes('[SUBMITTED_TO_BANK]') || Boolean(w.submitted_to_bank_at);

      if (w.admin_remark) {
        const utrMatch = w.admin_remark.match(/UTR:\s*([A-Z0-9_-]+)/i);
        if (utrMatch) {
          utrNumber = utrMatch[1].trim();
        }

        const matchNote = w.admin_remark.match(/Note:\s*([^|•\r\n]+)/i);
        if (matchNote) merchantNote = matchNote[1].trim();

        if (w.admin_remark.includes('[CUSTOMER_PAYOUT]') || w.admin_remark.includes('[COMMISSION_PAYOUT]') || w.admin_remark.includes('[REGULAR_SETTLEMENT]')) {
          const matchName = w.admin_remark.match(/Name:\s*([^|]+)/i);
          const matchMob = w.admin_remark.match(/Mob:\s*([^|]+)/i);
          const matchMode = w.admin_remark.match(/Mode:\s*([^|]+)/i);
          if (matchName) customerName = matchName[1].trim();
          if (matchMob) customerMobile = matchMob[1].trim();
          if (matchMode) settlementMode = matchMode[1].trim();
          isCustomerDisbursal = w.admin_remark.includes('[CUSTOMER_PAYOUT]');
        }
      }

      const metaParsed = parseRemarkMetadata(w.admin_remark);

      return {
        ...w,
        utr_number: utrNumber,
        is_customer_disbursal: isCustomerDisbursal,
        is_commission_payout: isCommission,
        payout_purpose: isCommission ? 'COMMISSION' : 'REGULAR',
        merchant_remarks: merchantNote,
        customer_name: customerName,
        customer_mobile: customerMobile,
        settlement_mode: settlementMode,
        is_pending_to_disburse: isPendingToDisburse,
        is_submitted_to_bank: isSubmittedToBank,
        channel: metaParsed.channel,
        pos_provider: metaParsed.pos_provider,
        pos_vendor: metaParsed.pos_vendor,
        pos_terminal: metaParsed.pos_terminal
      };
    });

    return { success: true, withdrawals: enriched };
  } catch (err) {
    console.error('getMerchantWithdrawals error:', err);
    return { success: false, message: err.message, withdrawals: [] };
  }
}


// ----------------------------------------------------
// 9. INQUIRIES & APPLICATIONS (LOANS, FRANCHISES)
// ----------------------------------------------------
export async function submitInquiry(inquiryData) {
  try {
    const res = await fetchWithTimeout(getApiUrl('/api/inquiries/submit'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(inquiryData)
    });
    const data = await res.json();
    return data;
  } catch (err) {
    console.error('submitInquiry error:', err);
    return { success: false, message: err.message || 'Failed to submit inquiry on server.' };
  }
}

export async function updateInquiryStatus(inquiryId, status, remarks = '') {
  try {
    const res = await fetchWithTimeout(getApiUrl('/api/inquiries/update-status'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ inquiryId, status, remarks })
    });
    const data = await res.json();
    return data;
  } catch (err) {
    console.error('updateInquiryStatus error:', err);
    return { success: false, message: err.message || 'Failed to update inquiry status on server.' };
  }
}

export async function updateUserStatus(userId, status) {
  try {
    const res = await fetchWithTimeout(getApiUrl('/api/admin/users/toggle-status'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetUserId: userId, status, adminId: 'ADM001' })
    });
    const data = await res.json();
    return data;
  } catch (err) {
    console.error('updateUserStatus error:', err);
    return { success: false, message: err.message || 'Failed to update user status on server.' };
  }
}

export async function updateUserDetails(userId, updates) {
  try {
    const res = await fetchWithTimeout(getApiUrl('/api/users/update-profile'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, ...updates })
    });
    const data = await res.json();
    return data;
  } catch (err) {
    console.error('updateUserDetails error:', err);
    return { success: false, message: err.message || 'Failed to update user details on server.' };
  }
}

export async function getInquiries() {
  try {
    const { data: inquiries, error } = await supabase
      .from('inquiries')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('getInquiries notice:', error.message);
      return { success: false, message: error.message, inquiries: [] };
    }

    // Filter out internal system configuration rows
    const realInquiries = (inquiries || []).filter(i => 
      i && !i.id.startsWith('SYS-') && i.category !== 'PLATFORM_SETTINGS'
    );

    return { success: true, inquiries: realInquiries };
  } catch (err) {
    console.error('getInquiries error:', err);
    return { success: false, message: err.message, inquiries: [] };
  }
}

// ----------------------------------------------------
// 10. MULTI-DEVICE PLATFORM QR & PAYEE CONFIG ENGINE (SUPABASE DIRECT)
// ----------------------------------------------------
export async function getPlatformQrConfig() {
  try {
    const res = await fetchWithTimeout(getApiUrl('/api/settings/config/SYS-CONFIG-QR'));
    const data = await res.json();
    if (data.success && data.value) {
      const cfg = typeof data.value === 'object' ? data.value : { image: data.value, name: 'RONAV TECHNOLOGIES' };
      return { success: true, image: cfg.image || null, name: cfg.name || 'RONAV TECHNOLOGIES' };
    }
    return { success: false, message: data.message || 'Failed to load QR configuration from server.', image: null, name: 'RONAV TECHNOLOGIES' };
  } catch (e) {
    console.warn('Could not fetch QR config from server:', e);
    return { success: false, message: e.message || 'Network error fetching QR configuration.', image: null, name: 'RONAV TECHNOLOGIES' };
  }
}

export async function savePlatformQrConfig({ image, name }) {
  const payeeName = (name || 'RONAV TECHNOLOGIES').trim();
  try {
    const res = await fetchWithTimeout(getApiUrl('/api/settings/config'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        key: 'SYS-CONFIG-QR',
        value: { image: image || '', name: payeeName }
      })
    });
    const data = await res.json();
    if (!data.success) {
      return { success: false, message: data.message || 'Failed to save QR configuration on server.' };
    }
    if (typeof localStorage !== 'undefined') {
      if (image) localStorage.setItem('ronav_company_qr_image', image);
      else localStorage.removeItem('ronav_company_qr_image');
      localStorage.setItem('ronav_company_qr_name', payeeName);
    }
    return { success: true, image, name: payeeName };
  } catch (err) {
    console.error('savePlatformQrConfig server error:', err);
    return { success: false, message: err.message || 'Network error updating QR configuration.' };
  }
}

export async function getCommissionPayoutConfig() {
  try {
    const res = await fetchWithTimeout(getApiUrl('/api/settings/config/SYS-COMMISSION-PAYOUTS'));
    const data = await res.json();
    if (data.success) {
      const isEnabled = data.enabled !== undefined ? Boolean(data.enabled) : (data.status === 'ACTIVE' || data.value === true || data.value === 'true' || data.value === 'ACTIVE');
      return { success: true, enabled: isEnabled };
    }
    return { success: false, message: data.message || 'Failed to fetch commission payout setting from server.', enabled: false };
  } catch (err) {
    console.warn('getCommissionPayoutConfig error:', err);
    return { success: false, message: err.message || 'Network error fetching commission payout setting.', enabled: false };
  }
}

export async function saveCommissionPayoutConfig(enabled) {
  const isEnabled = Boolean(enabled);
  try {
    const res = await fetchWithTimeout(getApiUrl('/api/settings/config'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        key: 'SYS-COMMISSION-PAYOUTS',
        enabled: isEnabled,
        status: isEnabled ? 'ACTIVE' : 'INACTIVE',
        value: isEnabled
      })
    });
    const data = await res.json();
    if (!data.success) {
      return { success: false, message: data.message || 'Failed to update commission payout lock on server.' };
    }
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('ronav_commission_payout_active', isEnabled ? 'true' : 'false');
      if (typeof window !== 'undefined') window.dispatchEvent(new Event('storage'));
    }
    return { success: true, enabled: isEnabled };
  } catch (err) {
    console.error('saveCommissionPayoutConfig error:', err);
    return { success: false, message: err.message || 'Network error updating commission payout lock.' };
  }
}

// ----------------------------------------------------
// 11. PLATFORM PUBLIC STATS TELEMETRY (SUPABASE CONNECTED)
// ----------------------------------------------------
export async function getPlatformPublicStats() {
  try {
    const res = await fetchWithTimeout(getApiUrl('/api/public/stats'));
    const json = await res.json();
    if (json.success && json.stats) {
      return {
        success: true,
        merchants: parseInt(json.stats.totalMerchants || 0, 10),
        partners: parseInt(json.stats.totalPartners || 0, 10),
        volume: parseFloat(((json.stats.totalVolume || 0) / 100000).toFixed(2)),
        disbursed: parseFloat(((json.stats.disbursedAmount || 0) / 100000).toFixed(2)),
        outlets: parseInt(json.stats.activeTerminals || 0, 10),
        transactions: parseInt(json.stats.totalTransactions || 0, 10)
      };
    }
    return {
      success: false,
      message: json.message || 'Failed to retrieve live statistics from server.',
      merchants: 0,
      partners: 0,
      volume: 0,
      disbursed: 0,
      outlets: 0,
      transactions: 0
    };
  } catch (err) {
    console.error('getPlatformPublicStats error:', err);
    return {
      success: false,
      message: err.message || 'Network error retrieving live statistics.',
      merchants: 0,
      partners: 0,
      volume: 0,
      disbursed: 0,
      outlets: 0,
      transactions: 0
    };
  }
}

// ----------------------------------------------------
// 12. MONTHLY POS TERMINAL RENTAL REPORT & LEDGER (ITEMS #22 & #23)
// ----------------------------------------------------
export async function getMonthlyRentalReport(targetMonth = '') {
  try {
    const query = targetMonth ? `?monthKey=${encodeURIComponent(targetMonth)}` : '';
    const res = await fetchWithTimeout(getApiUrl(`/api/admin/pos-rentals-report${query}`));
    const data = await res.json();
    return data;
  } catch (err) {
    console.error('getMonthlyRentalReport error:', err);
    return {
      success: false,
      message: err.message,
      summary: { totalTerminals: 0, totalDue: 0, totalCollected: 0, totalPending: 0, paidCount: 0, pendingCount: 0 },
      list: []
    };
  }
}

export async function updatePosRentalStatus({ merchant_id, terminal_id, billing_month, status, remarks = '' }) {
  try {
    const monthKey = billing_month || new Date().toISOString().slice(0, 7);
    const lookupKey = `${merchant_id}_${terminal_id}`;
    const cleanStatus = status === 'PAID' ? 'PAID' : 'PENDING';
    const paidAt = cleanStatus === 'PAID' ? new Date().toISOString() : null;
    const recordId = `RENT-${monthKey}-${merchant_id}-${terminal_id}`.replace(/[^A-Za-z0-9_-]/g, '_');

    // 1. Persist to Supabase inquiries (polymorphic metadata table)
    try {
      await supabase
        .from('inquiries')
        .upsert({
          id: recordId,
          type: 'RENTAL_STATUS',
          name: merchant_id,
          phone: terminal_id,
          merchant_id: merchant_id,
          category: `RENTAL_LEDGER_${monthKey}`,
          location: lookupKey,
          amount: paidAt || '',
          status: cleanStatus,
          remarks: remarks || ''
        });
    } catch (e) {
      console.warn('Could not persist rental status to Supabase:', e);
    }

    // Offline localStorage update removed per Phase D2b mandate

    return {
      success: true,
      merchant_id,
      terminal_id,
      billing_month: monthKey,
      status: cleanStatus,
      paid_at: paidAt
    };
  } catch (err) {
    console.error('updatePosRentalStatus error:', err);
    return { success: false, message: err.message };
  }
}

// ----------------------------------------------------
// PURGE TEST ACCOUNTS & SINGLE USER DELETION
// ----------------------------------------------------
export async function purgeAllTestAccounts() {
  try {
    // 1. Call backend API if available
    try {
      const res = await fetchWithTimeout(getApiUrl('/api/admin/users/purge-test-accounts'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      if (res.ok) {
        const json = await res.json();
        if (json && json.success) {
          cleanLocalTestStorage();
          return { success: true, message: json.message, purgedCount: json.purgedCount };
        }
      }
    } catch (err) {
      console.warn('[api] Live purge test accounts endpoint failed:', err);
    }

    // 2. Direct Supabase / PostgreSQL Client Cleanup
    const testIds = ['SD1003', 'SD1004', 'SD1005', 'SD1006', 'SD1008'];
    const { data: allUsers } = await supabase.from('users').select('*');
    const matchingTestUsers = (allUsers || []).filter(u => 
      (u.name || '').toLowerCase().includes('test') || 
      (u.id || '').toLowerCase().includes('test') ||
      testIds.includes(u.id)
    );

    for (const u of matchingTestUsers) {
      await supabase.from('users').eq('id', u.id).delete();
      await supabase.from('wallets').eq('user_id', u.id).delete();
      await supabase.from('merchant_pos').eq('merchant_id', u.id).delete();
    }

    cleanLocalTestStorage();
    return { success: true, message: `Successfully purged ${matchingTestUsers.length} test accounts from system.` };
  } catch (err) {
    console.error('purgeAllTestAccounts error:', err);
    return { success: false, message: err.message };
  }
}

function cleanLocalTestStorage() {
  if (typeof window === 'undefined') return;
  const testIds = new Set(['SD1003', 'SD1004', 'SD1005', 'SD1006', 'SD1008']);
  const tables = ['users', 'wallets', 'merchant_pos', 'transactions', 'withdrawals', 'beneficiaries'];
  tables.forEach(tbl => {
    const key = `ronav_db_${tbl}`;
    const raw = localStorage.getItem(key);
    if (raw) {
      try {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) {
          const filtered = arr.filter(item => {
            const name = (item.name || '').toLowerCase();
            const id = (item.id || item.user_id || item.merchant_id || '');
            if (name.includes('test') || id.toLowerCase().includes('test') || testIds.has(id)) {
              return false;
            }
            return true;
          });
          localStorage.setItem(key, JSON.stringify(filtered));
        }
      } catch (err) {
        console.warn('[api] Failed to clean localStorage cache key:', err);
      }
    }
  });
}

export async function deleteUserAccount(userId) {
  if (!userId || userId === 'ADM001') {
    return { success: false, message: 'Cannot delete Super Admin (ADM001).' };
  }
  try {
    const res = await fetchWithTimeout(getApiUrl('/api/admin/users/delete'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId })
    });
    const json = await res.json();
    cleanSingleUserFromLocalStorage(userId);
    return json;
  } catch (err) {
    console.error('deleteUserAccount error:', err);
    return { success: false, message: err.message };
  }
}

function cleanSingleUserFromLocalStorage(userId) {
  if (typeof window === 'undefined') return;
  const tables = ['users', 'wallets', 'merchant_pos', 'transactions', 'withdrawals', 'beneficiaries'];
  tables.forEach(tbl => {
    const key = `ronav_db_${tbl}`;
    const raw = localStorage.getItem(key);
    if (raw) {
      try {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) {
          const filtered = arr.filter(item => {
            const id = (item.id || item.user_id || item.merchant_id || '');
            return id !== userId;
          });
          localStorage.setItem(key, JSON.stringify(filtered));
        }
      } catch (err) {
        console.warn('[api] Failed to clean localStorage cache key:', err);
      }
    }
  });
}





// ----------------------------------------------------
// 12. PHASE D2 AUTHORITATIVE SUPPORTING CLIENT HELPERS
// ----------------------------------------------------

export async function fetchWithdrawalQuote({ userId, amount, channel = 'pinelabs', settlement_type = 'T1' }) {
  try {
    const res = await fetchWithTimeout(getApiUrl('/api/withdrawals/quote'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, amount, channel, settlement_type })
    });
    return await res.json();
  } catch (err) {
    console.error('fetchWithdrawalQuote error:', err);
    return { success: false, message: err.message || 'Failed to fetch withdrawal quote.' };
  }
}

export async function getRatesConfig(userId, creatorId) {
  try {
    const params = new URLSearchParams();
    if (userId) params.append('userId', userId);
    if (creatorId) params.append('creatorId', creatorId);
    const res = await fetchWithTimeout(getApiUrl('/api/rates/config?' + params.toString()));
    return await res.json();
  } catch (err) {
    console.error('getRatesConfig error:', err);
    return { success: false, message: err.message || 'Failed to fetch rate configuration.' };
  }
}

export async function getSystemSettings() {
  try {
    const res = await fetchWithTimeout(getApiUrl('/api/settings'));
    return await res.json();
  } catch (err) {
    console.error('getSystemSettings error:', err);
    return { success: false, message: err.message || 'Failed to fetch system settings.' };
  }
}

export async function getUserFinancialSummary(userId) {
  try {
    const res = await fetchWithTimeout(getApiUrl('/api/users/' + encodeURIComponent(userId) + '/financial-summary'));
    return await res.json();
  } catch (err) {
    console.error('getUserFinancialSummary error:', err);
    return { success: false, message: err.message || 'Failed to fetch financial summary.' };
  }
}

export async function exportWithdrawalsExcel(withdrawalIds, batchTag = '', bankName = '') {
  let ids = withdrawalIds;
  let tag = batchTag;
  let bName = bankName;
  if (withdrawalIds && !Array.isArray(withdrawalIds) && typeof withdrawalIds === 'object') {
    ids = withdrawalIds.withdrawal_ids || withdrawalIds.withdrawalIds || withdrawalIds.ids || [];
    tag = withdrawalIds.batch_name || withdrawalIds.batchTag || batchTag;
    bName = withdrawalIds.bank_name || withdrawalIds.bankName || bankName;
  }
  try {
    const res = await fetchWithTimeout(getApiUrl('/api/admin/withdrawals/export-excel'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ withdrawalIds: ids, batchTag: tag, bankName: bName })
    });
    return await res.json();
  } catch (err) {
    console.error('exportWithdrawalsExcel error:', err);
    return { success: false, message: err.message || 'Failed to export withdrawals.' };
  }
}

export async function getBatchDownload(batchId) {
  try {
    const res = await fetchWithTimeout(getApiUrl('/api/admin/withdrawals/batches/' + encodeURIComponent(batchId) + '/download'));
    return await res.json();
  } catch (err) {
    console.error('getBatchDownload error:', err);
    return { success: false, message: err.message || 'Failed to download batch.' };
  }
}
