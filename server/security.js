import crypto from 'node:crypto';

// Secret key for HMAC token signing (falls back to a default high-entropy key for dev/test)
const JWT_SECRET = process.env.JWT_SECRET || 'ronav-enterprise-fintech-jwt-secret-2026-strict-key-secure';

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

// Token lifetime: configurable via TOKEN_EXPIRY_SECONDS, defaults to 8 hours (28,800 seconds)
const DEFAULT_TOKEN_EXPIRY_SECONDS = Number(process.env.TOKEN_EXPIRY_SECONDS) || 28800;

/**
 * Generate a cryptographically signed expiring bearer token (HMAC-SHA256)
 */
export function generateToken(user, expiresInSeconds = DEFAULT_TOKEN_EXPIRY_SECONDS) {
  if (!user || !user.id || !user.role) {
    throw new Error('CANNOT_GENERATE_TOKEN: Valid user with id and role is required.');
  }
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'HS256', typ: 'JWT' };
  const payload = {
    id: user.id.toUpperCase(),
    role: user.role.toUpperCase(),
    name: user.name || user.id,
    iat: now,
    exp: now + expiresInSeconds
  };

  const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', JWT_SECRET)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest('base64url');

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

/**
 * Verify and decode signed bearer token
 */
export function verifyToken(token) {
  if (!token || typeof token !== 'string') {
    const err = new Error('AUTH_TOKEN_MISSING: Authorization header Bearer token is required.');
    err.code = 'AUTH_TOKEN_MISSING';
    err.statusCode = 401;
    throw err;
  }

  const cleanToken = token.startsWith('Bearer ') ? token.slice(7).trim() : token.trim();
  const parts = cleanToken.split('.');
  if (parts.length !== 3) {
    const err = new Error('AUTH_TOKEN_INVALID: Malformed authorization token.');
    err.code = 'AUTH_TOKEN_INVALID';
    err.statusCode = 401;
    throw err;
  }

  const [encodedHeader, encodedPayload, signature] = parts;
  const expectedSig = crypto.createHmac('sha256', JWT_SECRET)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest('base64url');

  if (signature !== expectedSig) {
    const err = new Error('AUTH_TOKEN_INVALID: Token signature verification failed.');
    err.code = 'AUTH_TOKEN_INVALID';
    err.statusCode = 401;
    throw err;
  }

  let payload;
  try {
    payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));
  } catch (_) {
    const err = new Error('AUTH_TOKEN_INVALID: Failed to parse token payload.');
    err.code = 'AUTH_TOKEN_INVALID';
    err.statusCode = 401;
    throw err;
  }

  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && payload.exp < now) {
    const err = new Error('AUTH_TOKEN_EXPIRED: Token has expired. Please log in again.');
    err.code = 'AUTH_TOKEN_EXPIRED';
    err.statusCode = 401;
    throw err;
  }

  return payload;
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
