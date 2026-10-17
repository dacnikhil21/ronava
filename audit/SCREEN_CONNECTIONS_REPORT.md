# SCREEN CONNECTIONS ROOT CAUSE ANALYSIS & AUDIT REPORT

## 1. Root Cause First (Task 1 Findings)

### A. Frontend Server Calls & Caller ID Header Status
Comprehensive audit of all server interactions in the frontend (`src/`):

| # | Endpoint Called | HTTP Method | Location | Sends Caller ID? | How Caller ID is Handled |
|---|-----------------|-------------|----------|------------------|--------------------------|
| 1 | `/api/auth/login` | POST | `src/services/api.js:33` | No (Public) | Public authentication endpoint |
| 2 | `/api/auth/forgot-password-request` | POST | `src/services/api.js:53` | No (Public) | Public password reset request |
| 3 | `/api/auth/change-password` | POST | `src/services/api.js:143` | Implicit | Relies on `fetchWithTimeout` wrapper |
| 4 | `/api/users/:id` | GET | `src/services/api.js:169` | Implicit | Relies on `fetchWithTimeout` wrapper |
| 5 | `/api/admin/users/reset-password` | POST | `src/services/api.js:248` | Implicit | Body contains admin ID, headers rely on wrapper |
| 6 | `/api/hierarchy/tree` | GET | `src/services/api.js:389` | Implicit | Relies on `fetchWithTimeout` wrapper |
| 7 | `/api/users/create` | POST | `src/services/api.js:684` | Implicit | Body contains `creator_id`, headers rely on wrapper |
| 8 | `/api/wallet/:id` | GET | `src/services/api.js:708` | Implicit | Relies on `fetchWithTimeout` wrapper |
| 9 | `/api/channels/update` | POST | `src/services/api.js:846` | Implicit | Relies on `fetchWithTimeout` wrapper |
| 10 | `/api/transactions/record` | POST | `src/services/api.js:1281` | Implicit | Body contains `merchantId`/`createdBy`, headers rely on wrapper |
| 11 | `/api/network/downstream` | GET | `src/services/api.js:1324` | Implicit | Query has `creatorId`, headers rely on wrapper |
| 12 | `/api/beneficiaries/create` | POST | `src/services/api.js:1453` | Implicit | Body has `merchant_id`, headers rely on wrapper |
| 13 | `/api/admin/pending` | GET | `src/services/api.js:1471` | Implicit | Relies on `fetchWithTimeout` wrapper |
| 14 | `/api/admin/verify-transaction` | POST | `src/services/api.js:1770` | Explicit | Attaches `x-caller-id` header & body `callerId` |
| 15 | `/api/withdrawals/request` | POST | `src/services/api.js:1803` | Implicit | Body has `merchant_id`, headers rely on wrapper |
| 16 | `/api/admin/verify-withdrawal` | POST | `src/services/api.js:1818` | NO (Missing) | Call site omits caller header; server had fallback |
| 17 | `/api/admin/withdrawals/batch-status` | POST | `src/services/api.js:1838` | Implicit | Relies on `fetchWithTimeout` wrapper |
| 18 | `/api/withdrawals/merchant/:id` | GET | `src/services/api.js:1877` | Implicit | Relies on `fetchWithTimeout` wrapper |
| 19 | `/api/inquiries/submit` | POST | `src/services/api.js:1950` | Implicit | Relies on `fetchWithTimeout` wrapper |
| 20 | `/api/inquiries/update-status` | POST | `src/services/api.js:1965` | Implicit | Relies on `fetchWithTimeout` wrapper |
| 21 | `/api/admin/users/toggle-status` | POST | `src/services/api.js:1980` | Implicit | Relies on `fetchWithTimeout` wrapper |
| 22 | `/api/users/update-profile` | POST | `src/services/api.js:1995` | Implicit | Relies on `fetchWithTimeout` wrapper |
| 23 | `/api/settings/config/SYS-CONFIG-QR` | GET | `src/services/api.js:2037` | Implicit | Relies on `fetchWithTimeout` wrapper |
| 24 | `/api/settings/config` | POST | `src/services/api.js:2053` | Implicit | Relies on `fetchWithTimeout` wrapper |
| 25 | `/api/settings/config/SYS-COMMISSION-PAYOUTS` | GET | `src/services/api.js:2079` | Implicit | Relies on `fetchWithTimeout` wrapper |
| 26 | `/api/settings/config` | POST | `src/services/api.js:2095` | Implicit | Relies on `fetchWithTimeout` wrapper |
| 27 | `/api/public/stats` | GET | `src/services/api.js:2125` | No (Public) | Public homepage statistics |
| 28 | `/api/settings` | GET | `src/services/api.js:2174` | NO (Bypass) | Direct `fetch()` call bypassing `fetchWithTimeout` |
| 29 | `/api/admin/users/purge-test-accounts` | POST | `src/services/api.js:2365` | NO (Bypass) | Direct `fetch()` call bypassing `fetchWithTimeout` |
| 30 | `/api/admin/users/delete` | POST | `src/services/api.js:2436` | Implicit | Relies on `fetchWithTimeout` wrapper |
| 31 | `/api/withdrawals/quote` | POST | `src/services/api.js:2483` | Implicit | Relies on `fetchWithTimeout` wrapper |
| 32 | `/api/rates/config` | GET | `src/services/api.js:2500` | Implicit | Relies on `fetchWithTimeout` wrapper |
| 33 | `/api/settings` | GET | `src/services/api.js:2510` | Implicit | Relies on `fetchWithTimeout` wrapper |
| 34 | `/api/users/:id/financial-summary` | GET | `src/services/api.js:2520` | Implicit | Relies on `fetchWithTimeout` wrapper |
| 35 | `/api/admin/withdrawals/export-excel` | POST | `src/services/api.js:2530` | Implicit | Relies on `fetchWithTimeout` wrapper |
| 36 | `/api/admin/withdrawals/batches/:id/download` | GET | `src/services/api.js:2544` | Implicit | Relies on `fetchWithTimeout` wrapper |
| 37 | `/api/s3/status` | GET | `src/services/s3.js:8` | NO (Bypass) | Direct `fetch()` call bypassing `fetchWithTimeout` |
| 38 | `/api/s3/presigned-url` | POST | `src/services/s3.js:26` | NO (Bypass) | Direct `fetch()` call bypassing `fetchWithTimeout` |
| 39 | `/api/s3/upload-base64` | POST | `src/services/s3.js:72` | NO (Bypass) | Direct `fetch()` call bypassing `fetchWithTimeout` |
| 40 | `/api/s3/delete` | POST | `src/services/s3.js:103` | NO (Bypass) | Direct `fetch()` call bypassing `fetchWithTimeout` |
| 41 | `/api/users/:id` | GET | `src/components/MerchantDashboardPage.jsx:657` | NO (Bypass) | Direct `fetch()` call in component bypassing shared wrapper |

---

### B. Why Admin Profits Reads Different Data than Overview
1. **Overview Tab Data Source**:
   Overview binds directly to the server ledger response from `GET /api/admin/pending` (`pendingRes.stats`). In `server/api.js`, the server sums authoritative `financial_ledger` rows where `type = 'commission'`. For a ₹10,000 Pine Labs swipe, it returns:
   - Sales: ₹10,000
   - Fees Collected: ₹150
   - Partner Commissions: ₹90
   - Admin Net Profit: ₹60

2. **Profits Tab Data Source**:
   The Profits tab bypasses the server summary and runs a client-side `useMemo` hook (`profitDistributionData` in `src/components/AdminDashboardPage.jsx:1546-1852`):
   - It filters the in-memory array `transactionsLedger` by `profitDateFilter` which is hardcoded to default to `'TODAY'`:
     `txns = txns.filter(t => new Date(t.created_at || Date.now()).getTime() >= startOfToday);`
     Due to client timezone offsets against ISO UTC timestamps or date boundaries, transactions fall outside `startOfToday`, resulting in an empty transaction array `[]`.
   - When the array is empty, the client-side calculator sets `totalSalesVolume = 0`, `totalFeesCollected = 0`, `totalUplinesDistributed = 0`, `companyNet = 0`, `masterTotal = 0`, `superTotal = 0`, `districtTotal = 0`, `distributorTotal = 0`.
   - The tier cards (`src/components/AdminDashboardPage.jsx:4320-4370`) and summary cards render these zeroed browser calculations, showing ₹0.00 while Overview correctly shows ₹60.
   - The Profits tab is performing manual ledger accounting in the browser rather than reading from the server's authoritative single ledger endpoint.

---

### C. Why Reject on Transaction Failed with CALLER_IDENTIFICATION_REQUIRED
1. The server `/api/admin/verify-transaction` endpoint calls `getCaller(req)`.
2. `getCaller(req)` strictly checks for `x-caller-id` / `x-user-id` header or body `callerId` / `caller_id`.
3. While `verifyTransaction` in `src/services/api.js` had custom headers added, `AdminDashboardPage.jsx` has multiple action pathways (such as `handleClawbackTransaction`, `handleTransactionAction`, and `handlePayoutAction` calling `/api/admin/verify-withdrawal`).
4. In `src/services/api.js`, `/api/admin/verify-withdrawal` (line 1818) did not attach caller headers, and if a session was restored via URL deep-linking without `ronav_session` populated or during unauthenticated testing, `getCaller(req)` threw:
   `CALLER_IDENTIFICATION_REQUIRED: No caller ID found in request headers or payload.`
