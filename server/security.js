import crypto from 'node:crypto';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Authoritative JWT_SECRET getter & validator.
 * Refuses execution if JWT_SECRET is missing or shorter than 32 characters.
 * Zero development fallbacks in code or git.
 */
export function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || typeof secret !== 'string' || secret.trim().length < 32) {
    throw new Error('SECURITY_CONFIG_ERROR: JWT_SECRET environment variable is missing or shorter than 32 characters. Refusing to start.');
  }
  return secret.trim();
}

/**
 * Hash plain-text password using crypto.scrypt
 */
export function hashPassword(plainText) {
  if (!plainText || typeof plainText !== 'string') {
    throw new Error('PASSWORD_REQUIRED: Plain text password is required for hashing.');
  }
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(plainText, salt, 64).toString('hex');
  return `scrypt:${salt}:${hash}`;
}

/**
 * Verify plain-text password against stored scrypt hash
 */
export function verifyPassword(plainText, storedHash) {
  if (!plainText || !storedHash || typeof storedHash !== 'string') {
    return false;
  }
  if (!storedHash.startsWith('scrypt:')) {
    return false;
  }
  const parts = storedHash.split(':');
  if (parts.length !== 3) {
    return false;
  }
  const [, salt, originalHash] = parts;
  try {
    const hash = crypto.scryptSync(plainText, salt, 64).toString('hex');
    const hashBuf = Buffer.from(hash, 'hex');
    const origBuf = Buffer.from(originalHash, 'hex');
    if (hashBuf.length !== origBuf.length) {
      return false;
    }
    return crypto.timingSafeEqual(hashBuf, origBuf);
  } catch (_) {
    return false;
  }
}

/**
 * Read token lifetime settings from environment variables.
 * Admin default: 2 days (172,800 seconds)
 * All other roles default: 30 days (2,592,000 seconds)
 */
export function getTokenExpiryForRole(role) {
  const cleanRole = (role || '').toUpperCase();
  if (cleanRole === 'ADMIN' || cleanRole === 'SUPER_ADMIN') {
    return Number(process.env.ADMIN_TOKEN_EXPIRY_SECONDS) || 172800; // 2 days
  }
  return Number(process.env.USER_TOKEN_EXPIRY_SECONDS) || 2592000; // 30 days
}

/**
 * Generate a cryptographically signed expiring bearer token (HMAC-SHA256)
 * Supports controllable clock via options.currentTime
 */
export function generateToken(user, expiresInSeconds = null, options = {}) {
  if (!user || !user.id || !user.role) {
    throw new Error('CANNOT_GENERATE_TOKEN: Valid user with id and role is required.');
  }
  const role = user.role.toUpperCase();
  const expiry = expiresInSeconds !== null && expiresInSeconds !== undefined
    ? Number(expiresInSeconds)
    : getTokenExpiryForRole(role);

  const now = options.currentTime !== undefined ? options.currentTime : Math.floor(Date.now() / 1000);
  const header = { alg: 'HS256', typ: 'JWT' };
  const payload = {
    id: user.id.toUpperCase(),
    role: role,
    name: user.name || user.id,
    iat: options.iat !== undefined ? options.iat : now,
    exp: now + expiry
  };

  const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', getJwtSecret())
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest('base64url');

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

/**
 * Verify and decode signed bearer token
 * Supports controllable clock via options.currentTime
 */
export function verifyToken(token, options = {}) {
  if (!token || typeof token !== 'string') {
    const err = new Error('Your session ended. Please log in again.');
    err.code = 'AUTH_TOKEN_MISSING';
    err.statusCode = 401;
    throw err;
  }

  const cleanToken = token.startsWith('Bearer ') ? token.slice(7).trim() : token.trim();
  const parts = cleanToken.split('.');
  if (parts.length !== 3) {
    const err = new Error('Your session ended. Please log in again.');
    err.code = 'AUTH_TOKEN_INVALID';
    err.statusCode = 401;
    throw err;
  }

  const [encodedHeader, encodedPayload, signature] = parts;
  const expectedSig = crypto.createHmac('sha256', getJwtSecret())
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest('base64url');

  if (signature !== expectedSig) {
    const err = new Error('Your session ended. Please log in again.');
    err.code = 'AUTH_TOKEN_INVALID';
    err.statusCode = 401;
    throw err;
  }

  let payload;
  try {
    payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));
  } catch (_) {
    const err = new Error('Your session ended. Please log in again.');
    err.code = 'AUTH_TOKEN_INVALID';
    err.statusCode = 401;
    throw err;
  }

  const now = options.currentTime !== undefined ? options.currentTime : Math.floor(Date.now() / 1000);
  if (payload.exp && payload.exp < now) {
    const err = new Error('Your session ended. Please log in again.');
    err.code = 'AUTH_TOKEN_EXPIRED';
    err.statusCode = 401;
    throw err;
  }

  return payload;
}

/**
 * Check if a token has less than half its life left.
 * If eligible and valid, generates a fresh replacement token.
 * Returns { shouldRenew: boolean, payload: object, renewedToken?: string }
 */
export function checkTokenRenewal(token, options = {}) {
  if (!token || typeof token !== 'string') return null;
  const cleanToken = token.startsWith('Bearer ') ? token.slice(7).trim() : token.trim();
  const parts = cleanToken.split('.');
  if (parts.length !== 3) return null;

  let secret;
  try {
    secret = getJwtSecret();
  } catch (_) {
    return null;
  }

  const [encodedHeader, encodedPayload, signature] = parts;
  const expectedSig = crypto.createHmac('sha256', secret)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest('base64url');

  if (signature !== expectedSig) return null;

  let payload;
  try {
    payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));
  } catch (_) {
    return null;
  }

  const now = options.currentTime !== undefined ? options.currentTime : Math.floor(Date.now() / 1000);
  if (payload.exp && payload.exp < now) {
    return null; // Expired tokens cannot be silently renewed
  }

  const totalLifetime = (payload.exp || 0) - (payload.iat || 0);
  const remainingLifetime = (payload.exp || 0) - now;

  // Less than half its life left:
  const shouldRenew = totalLifetime > 0 && remainingLifetime <= (totalLifetime / 2);

  let renewedToken = null;
  if (shouldRenew) {
    renewedToken = generateToken({
      id: payload.id,
      role: payload.role,
      name: payload.name
    }, null, { currentTime: now });
  }

  return {
    shouldRenew,
    payload,
    renewedToken
  };
}

/**
 * In-memory sliding window rate limiter for public endpoints
 */
const rateLimitBuckets = new Map();

export function checkRateLimit(ipOrKey, { limit = 20, windowMs = 60000 } = {}) {
  const now = Date.now();
  let record = rateLimitBuckets.get(ipOrKey);
  if (!record || (now - record.resetTime) > windowMs) {
    record = { count: 1, resetTime: now };
    rateLimitBuckets.set(ipOrKey, record);
    return true;
  }
  record.count++;
  if (record.count > limit) {
    return false;
  }
  return true;
}

/**
 * Fetch all downstream user IDs for a given user ID (recursive CTE)
 */
export async function getDownlineUserIds(db, userId) {
  if (!userId) return new Set();
  const cleanId = userId.toString().trim().toUpperCase();
  const res = await db.query(`
    WITH RECURSIVE downline AS (
      SELECT id, 1 as depth
      FROM users
      WHERE UPPER(creator_id) = UPPER($1)
      UNION ALL
      SELECT u.id, d.depth + 1
      FROM users u
      INNER JOIN downline d ON UPPER(u.creator_id) = UPPER(d.id)
    )
    SELECT UPPER(id) as id FROM downline;
  `, [cleanId]);
  
  const rows = Array.isArray(res) ? res : (res && Array.isArray(res.rows) ? res.rows : []);
  const set = new Set(rows.map(r => (r.id || '').toString().trim().toUpperCase()));
  return set;
}

/**
 * Enforce that caller is either Admin, the target user themselves, or the target user is in caller's downline.
 * Throws 403 error if access is not permitted.
 */
export async function assertCanAccessUser(caller, targetUserId, db) {
  if (!caller || !caller.id) {
    const err = new Error('AUTH_TOKEN_REQUIRED: Authenticated caller required.');
    err.statusCode = 401;
    throw err;
  }
  const callerId = caller.id.toString().trim().toUpperCase();
  const targetId = (targetUserId || '').toString().trim().toUpperCase();

  // Admin has global ecosystem access
  if (caller.role === 'ADMIN' || callerId === 'ADM001') {
    return true;
  }

  // Accessing self
  if (callerId === targetId) {
    return true;
  }

  // Check if target is in downline
  const downline = await getDownlineUserIds(db, callerId);
  if (downline.has(targetId)) {
    return true;
  }

  const err = new Error(`ACCESS_FORBIDDEN: User ${callerId} is not authorized to access user ${targetId} outside their downline.`);
  err.statusCode = 403;
  throw err;
}
