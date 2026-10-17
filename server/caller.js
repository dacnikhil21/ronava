import { verifyToken } from './security.js';

/**
 * Authoritative Unified Caller Resolver
 * 
 * In strict adherence to security rules, caller identity and role come EXCLUSIVELY
 * from cryptographically verified Bearer tokens.
 * 
 * All resolution of identity from x-caller-id, x-user-id, x-caller-role, query params,
 * or request body has been permanently purged.
 */
export function getCaller(req) {
  if (!req) {
    const err = new Error('HTTP_REQUEST_REQUIRED: Request object missing.');
    err.statusCode = 401;
    err.code = 'AUTH_TOKEN_MISSING';
    throw err;
  }

  const headers = req.headers || {};
  const authHeader = headers['authorization'] || headers['Authorization'];

  if (!authHeader || typeof authHeader !== 'string' || !authHeader.trim()) {
    const err = new Error('AUTH_TOKEN_MISSING: Missing Authorization header with Bearer token.');
    err.statusCode = 401;
    err.code = 'AUTH_TOKEN_MISSING';
    throw err;
  }

  // Cryptographically verify token signature & expiration
  const payload = verifyToken(authHeader);

  return {
    id: (payload.id || '').toUpperCase(),
    role: (payload.role || '').toUpperCase(),
    name: payload.name || payload.id
  };
}
