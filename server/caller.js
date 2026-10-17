/**
 * Unified Caller Resolver
 * 
 * Authentication is deliberately deferred. All routes and services get the "current user"
 * strictly through this function so that when JWT or session auth is introduced,
 * only this file needs to be updated.
 */
export function getCaller(req) {
  if (!req) {
    throw new Error('CALLER_IDENTIFICATION_REQUIRED: HTTP request object is missing.');
  }

  const headers = req.headers || {};
  const body = req.body || {};
  const query = req.query || {};

  // Resolve ID from headers, query, or body
  const callerId = (
    headers['x-caller-id'] ||
    headers['x-user-id'] ||
    query.callerId ||
    query.userId ||
    body.callerId ||
    body.userId ||
    body.merchant_id ||
    body.merchantId ||
    ''
  ).toString().trim();

  // Resolve Role
  const callerRole = (
    headers['x-caller-role'] ||
    headers['x-user-role'] ||
    query.callerRole ||
    query.role ||
    body.callerRole ||
    body.role ||
    ''
  ).toString().trim().toUpperCase();

  if (!callerId) {
    throw new Error('CALLER_IDENTIFICATION_REQUIRED: No caller ID found in request headers or payload.');
  }

  if (!callerRole) {
    throw new Error('CALLER_ROLE_REQUIRED: No caller role found in request headers or payload.');
  }

  return {
    id: callerId,
    role: callerRole,
    rawHeaders: headers
  };
}
