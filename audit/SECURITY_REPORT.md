# RONAV TECHNOLOGIES — Core Security Audit & Implementation Report

> **Branch**: `fix/security-core`  
> **Environment**: Local PostgreSQL (`localhost:5432/ronav_test_db`)  
> **Date**: October 17, 2026  
> **Status**: Verified & Enforced across all server routes, auth layers, and client request handlers.

---

## 1. Executive Summary

This report documents the architectural overhaul of the authentication, authorization, and data-protection layers in the RONAV Technologies platform. All approved core security requirements (All Part A items + Part B signed expiring tokens + Part B downline hierarchy access enforcement) have been fully implemented, verified with automated HTTP/guardrail suites, and reconciled across all 32 core business workflows with 100% ledger consistency.

### Key Security Achievements
1. **Cryptographic Password Hashing**: Converted 100% of plain-text passwords in the PostgreSQL database to secure `scrypt` key derivation with unique per-password random salts (`scrypt:salt:key`). Zero plain-text credentials remain in the database.
2. **Cryptographic Bearer Tokens**: Implemented HMAC-SHA256 signed bearer tokens with 24-hour expiration (`exp`), subject identifier (`sub`), role (`role`), and signature verification (`sig`). Tokens are validated against tampering, tampering invalidates signatures, and expired tokens return a clean HTTP 401.
3. **Strict Zero-Spoof Identity Extraction**: Completely removed `x-caller-id`, `x-user-id`, `x-caller-role`, query parameter `userId`, and request body `userId` as identity sources. The server now accepts identity **exclusively** from verified `Authorization: Bearer <token>` headers.
4. **Hierarchical Downline Access Control**: Downline traversal is enforced via recursive Common Table Expressions (CTE). Logged-in users can only read or mutate records belonging to themselves or active accounts in their downline tree. Out-of-tree requests return an explicit HTTP 403 Forbidden.
5. **Admin Access Segregation**: All admin routes require a verified token with `role: 'ADMIN'`. Merely having a valid token as a merchant or distributor calling an admin route triggers an immediate HTTP 403 Forbidden.
6. **Zero Credential Leakage**: Serializers strip `password`, `password_hash`, and `salt` from all user objects before network transmission.
7. **Public Rate Limiting**: In-memory rate limiting shields `/api/auth/login`, `/api/auth/forgot-password-request`, and `/api/inquiries/submit` against brute-force abuse (returning HTTP 429 Too Many Requests).
8. **Deployment Webhook Shield**: `/api/system/webhook-deploy` requires a secret token matching `process.env.WEBHOOK_DEPLOY_SECRET`. Unauthenticated callers receive HTTP 401 Unauthorized.
9. **Automated Guardrail Enforcer**: Added an automated route inspector test (`server/test_security_core.mjs`) that inspects Express route definitions and halts the build if any new endpoint is declared without an authorization gate or public door exemption.

---

## 2. Complete Server Endpoint Audit (Before vs. After)

| Method | Endpoint Path | Description | Access Policy | Protected Before? | Protected Now? |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/login` | Authenticate user with credentials | **Public** (Rate Limited) | Open (Plaintext) | Rate-Limited + `scrypt` verify + Bearer token |
| `POST` | `/api/auth/forgot-password-request` | Submit password reset request | **Public** (Rate Limited) | Open | Rate-Limited + Sanitized response |
| `GET` | `/api/health` | Service health status | **Public** (Healthcheck) | Open | Open (No sensitive data) |
| `GET` | `/api/public/stats` | Aggregated marketing counter metrics | **Public** (Marketing) | Open | Open (No user PII or sensitive data) |
| `POST` | `/api/inquiries/submit` | Public loan & franchise inquiry form | **Public** (Rate Limited) | Open | Rate-Limited + Input sanitized |
| `POST` | `/api/system/webhook-deploy` | Trigger git pull & pm2 reload | **Secret Key Protected** | Open (RCE risk) | Requires `WEBHOOK_DEPLOY_SECRET` (401 on missing/mismatch) |
| `GET` | `/api/users` | List users | **Admin Only** | Spoofable Header | `requireAdmin` (401/403 enforced) |
| `POST` | `/api/users` | Create new user account | **Admin Only** | Spoofable Header | `requireAdmin` + Password hashed via `scrypt` |
| `GET` | `/api/users/:id` | Fetch specific user details | **Self, Downline, or Admin** | Spoofable Header | `assertCanAccessUser` (403 if out of downline) |
| `PUT` | `/api/users/:id` | Update profile information | **Self, Downline, or Admin** | Spoofable Header | `assertCanAccessUser` + Credentials stripped |
| `POST` | `/api/admin/users/:id/reset-password` | Admin profile password reset | **Admin Only** | Spoofable Header | `requireAdmin` (Token check enforced) |
| `POST` | `/api/admin/system/migrate` | Run database migrations | **Admin Only** | Open | `requireAdmin` (401/403 enforced) |
| `POST` | `/api/admin/cleanup-test-accounts` | Clean test database records | **Admin Only** | Open | `requireAdmin` (401/403 enforced) |
| `GET` | `/api/swipes` | List card transactions | **Self, Downline, or Admin** | Spoofable Header | `assertCanAccessUser` (Filters to accessible IDs) |
| `POST` | `/api/swipes` | Record new card swipe transaction | **Caller / Downline** | Spoofable Header | Identity from token (`caller.userId`) |
| `POST` | `/api/admin/swipes/:id/review` | Admin review (approve/reject) swipe | **Admin Only** | Spoofable Header | `requireAdmin` (401/403 enforced) |
| `POST` | `/api/admin/swipes/:id/edit` | Admin edit swipe parameters | **Admin Only** | Spoofable Header | `requireAdmin` (401/403 enforced) |
| `GET` | `/api/withdrawals` | List withdrawal requests | **Self, Downline, or Admin** | Spoofable Header | `assertCanAccessUser` (Enforces tree boundary) |
| `POST` | `/api/withdrawals` | Create merchant payout request | **Caller / Own Account** | Spoofable Header | Identity from token (`caller.userId`) |
| `POST` | `/api/admin/withdrawals/:id/review` | Admin review payout request | **Admin Only** | Spoofable Header | `requireAdmin` (401/403 enforced) |
| `POST` | `/api/admin/withdrawals/:id/complete` | Admin record UTR settlement | **Admin Only** | Spoofable Header | `requireAdmin` (401/403 enforced) |
| `GET` | `/api/beneficiaries` | List saved bank accounts | **Caller / Own Account** | Spoofable Header | Identity from token (`caller.userId`) |
| `POST` | `/api/beneficiaries` | Register bank beneficiary | **Caller / Own Account** | Spoofable Header | Identity from token (`caller.userId`) |
| `DELETE` | `/api/beneficiaries/:id` | Remove bank beneficiary | **Caller / Own Account** | Spoofable Header | Identity from token (`caller.userId`) |
| `GET` | `/api/settings` | Retrieve user channel rates | **Self, Downline, or Admin** | Spoofable Header | `assertCanAccessUser` (403 on foreign user) |
| `POST` | `/api/settings` | Configure user channel rates | **Admin or Parent Dist** | Spoofable Header | `assertCanAccessUser` (Admin or parent check) |
| `GET` | `/api/reports/reconciliation` | Financial reconciliation export | **Admin Only** | Spoofable Header | `requireAdmin` (401/403 enforced) |
| `GET` | `/api/inquiries` | Review submitted inquiries | **Admin Only** | Spoofable Header | `requireAdmin` (401/403 enforced) |
| `POST` | `/api/inquiries/:id/status` | Update inquiry status | **Admin Only** | Spoofable Header | `requireAdmin` (401/403 enforced) |
| `GET` | `/api/admin/export-withdrawals` | CSV export of payouts | **Admin Only** | Spoofable Header | `requireAdmin` (401/403 enforced) |

---

## 3. Honest List of Unprotected Endpoints & Justification

The following endpoints do not require a verified Bearer token by deliberate design. Each is justified and bounded by strict security constraints:

1. **`POST /api/auth/login`**:
   - *Why Public*: Entry point for users to provide credentials and obtain an authenticated session token.
   - *Protections*: In-memory rate limiting (max 10 attempts per minute per IP), `scrypt` constant-time comparison, passwords sanitized from payload.
2. **`POST /api/auth/forgot-password-request`**:
   - *Why Public*: Legitimate users who cannot log in must be able to submit a reset request.
   - *Protections*: In-memory rate limiting (max 5 requests per 5 minutes per IP), generic response messages to prevent account enumeration.
3. **`POST /api/inquiries/submit`**:
   - *Why Public*: Public landing page lead generation for prospective merchants and ATM/CDM franchise applicants who do not yet possess credentials.
   - *Protections*: In-memory rate limiting (max 10 submissions per 5 minutes per IP), strict schema validation and sanitization.
4. **`GET /api/health`**:
   - *Why Public*: Required by load balancers, container orchestrators, and uptime monitors.
   - *Protections*: Zero business logic, returns only static timestamp and status string; no sensitive information.
5. **`GET /api/public/stats`**:
   - *Why Public*: Displays aggregate hero counters (e.g., total active merchants, gross network volume) on the public marketing homepage.
   - *Protections*: Pre-aggregated SQL count/sum queries with zero user identifiers, personal information, or private transaction records.

---

## 4. Verification & Test Evidence

### Suite 1: Automated Security Guardrail & Functional Suite (`server/test_security_core.mjs`)
- **Guardrail Route Audit**: Passed. All registered endpoints are audited and mapped to either verified token gates or authorized public doors.
- **Password Hashing**: 100% of rows in `users` verified to have `scrypt:salt:key` format. Plaintext password attempts fail; correct password passes `verifyPassword`.
- **Token Signature & Tampering**:
  - Valid token generates 200 OK.
  - Tampered payload or signature triggers immediate 401 Unauthorized.
  - Expired token triggers immediate 401 Unauthorized (`Token expired`).
- **Identity Spoofing Defenses**:
  - Unauthenticated request with `x-caller-id: ADM001` returns 401 Unauthorized.
  - Unauthenticated request without headers returns 401 Unauthorized.
  - Merchant token calling `/api/admin/swipes/1/review` returns 403 Forbidden (`Admin access required`).
  - Distributor token querying a user outside their downline tree returns 403 Forbidden (`Access denied: target user is not in your downline`).
  - Distributor token querying a user inside their downline tree succeeds with 200 OK.
- **Zero Credential Leakage**: Inspecting all user JSON responses confirmed zero instances of `password`, `password_hash`, or `salt`.
- **Public Rate Limiter**: Verified that burst attempts exceeding threshold return HTTP 429 Too Many Requests (`Too many requests, please try again later.`).
- **Browser Playwright Verification**:
  - Automated headless browser performed real UI login with `ADM001` / `Ronav@123`.
  - Stored token verified in `sessionStorage.getItem('ronav_auth_token')`.
  - When token is cleared/corrupted, subsequent API calls fire `ronav_auth_expired`, automatically redirecting the browser to `/login` with an expiration toast.

### Suite 2: Regression Suites & 32-Scenario Master Runner
- `server/test_step1_settings_and_caller.mjs`: **PASSED**.
- `server/test_reject_caller_auth.mjs`: **PASSED**.
- `server/test_http_admin_reversals_and_approvals.mjs`: **PASSED**.
- `server/test_phase_d2b_verification.mjs`: **16/16 PASSED**.
- `npm run test:phase-b`: **ALL 9 SUITES PASSED** (100% mathematical ledger reconciliation).
- `npm test` (`server/scenario_runner.mjs`): **32/32 SCENARIOS PASSED WITH ZERO DISCREPANCIES**.
- `server/verify_phase_b_scenarios.mjs` (Consistency Checker): **PASSED**.

---

## 5. Compliance & Architectural Sign-Off

The security perimeter on branch `fix/security-core` strictly complies with:
- **Rule 1**: Zero shortcuts, no client-side money math, no hardcoded bypasses.
- **Rule 2**: 100% mathematical double-entry balance and downline ledger consistency preserved.
- **Rule 3**: Zero modifications to production servers or production databases (`localhost:5432/ronav_test_db` only).
- **Rule 4**: Identity sourced solely from verified cryptographic Bearer tokens.
