# RONAV TECHNOLOGIES — PAISE DISPLAY & UI BLINK AUDIT REPORT

**Branch:** `fix/paise-display`  
**Date:** October 16, 2026  
**Target Database:** `ronav_test_db` (Local PostgreSQL)  
**Deliverable Status:** ALL TESTS PASSED (11/11 Suites)

---

## 1. Problem Statement & Root Cause

The PostgreSQL database stores all currency values as integer paise (`amount_paise`, `customer_charge_paise`, `net_amount_paise`, `fee_paise`, `net_payout_paise`, `balance_paise`, `held_paise`, `total_sales_paise`, `withdrawn_paise`).

Several API endpoints returned raw database rows directly. When frontend screens accessed `t.amount`, `t.customer_charge`, `t.net_amount`, or `w.fee`, these fields were `undefined`, resulting in `₹0.00` fallbacks or NaN display. Furthermore, `/api/admin/pending`, `/api/public/stats`, and `/api/hierarchy/tree` executed SQL queries referencing a non-existent column `"amount"` on the `transactions` table (e.g., `SELECT SUM(amount)`), resulting in HTTP 500 database exceptions.

---

## 2. Comprehensive Money Endpoints & Obsolete Column Fix Table

| Endpoint | HTTP Method | Obsolete Column / Query Pattern | Root Cause of Issue | Authoritative Fix & Serialized Fields |
| :--- | :--- | :--- | :--- | :--- |
| `/api/public/stats` | `GET` | `SUM(amount)` in `transactions` & `withdrawals` | Column `amount` does not exist on `transactions`; legacy on `withdrawals` | Replaced with `SUM(amount_paise)::numeric / 100.0`. Returns `totalVolume`, `disbursedAmount`. |
| `/api/admin/pending` | `GET` | `SUM(amount)` at lines 1723–1724; `parseFloat(t.amount)` at line 1694 | Query crashed with `column "amount" does not exist`; `t.amount` was undefined | Replaced queries with `SUM(amount_paise)/100.0`, read `t.amount_paise/100`, wrapped with `serializeMoneyFields()`. |
| `/api/hierarchy/tree` | `GET` | `SUM(amount)` in `transactions` at line 1302 | Grouped volume query crashed on missing `amount` column | Replaced with `SUM(amount_paise)/100.0 as total_txn_volume`. |
| `/api/transactions/merchant/:merchantId` | `GET` | Raw rows; `row.amount` at line 1580 | Lacked `amount`, `customer_charge`, `net_amount`; upline sale amount was 0 | Applied `serializeMoneyFields()`; populated `amount`, `fee`, `net`, `commission_earned`. |
| `/api/admin/transactions` & `/api/transactions` | `GET` | Raw rows returned from `transactions` | Missing `amount`, `customer_charge`, `net_amount` | Applied `serializeMoneyFields(transactions)`. |
| `/api/transactions/record` | `POST` | Raw transaction returned from ledger | `transaction` object had only `*_paise` fields | Serialized via `serializeMoneyFields(serializable)`. |
| `/api/transactions/process-swipe` | `POST` | Raw transaction returned | Distributions and transaction had only `*_paise` | Serialized via `serializeMoneyFields(transaction)`. |
| `/api/transactions/reverse` | `POST` | Raw reversal returned | Lacked rupee representations for reversal | Serialized via `serializeMoneyFields(reversal)`. |
| `/api/withdrawals/merchant/:merchantId` | `GET` | Raw rows from `withdrawals` | Lacked `fee`, `net_payout`, `amount_rupees` | Applied `serializeMoneyFields(withdrawals)`. |
| `/api/admin/withdrawals` & `/api/withdrawals` | `GET` | Raw rows from `withdrawals` | Lacked `fee`, `net_payout`, `amount_rupees` | Applied `serializeMoneyFields(enriched)`. |
| `/api/withdrawals/request` | `POST` | Raw withdrawal row returned | Only `*_paise` fields present | Serialized via `serializeMoneyFields(result)`. |
| `/api/admin/verify-withdrawal` | `POST` | Raw updated withdrawal returned | Lacked converted rupee fields | Serialized via `serializeMoneyFields(updatedWth)`. |
| `/api/withdrawals/execute` | `POST` | Raw withdrawal returned | Lacked converted rupee fields | Serialized via `serializeMoneyFields(result)`. |
| `/api/withdrawals/quote` | `POST` | Quote object | Lacked universal money fields | Serialized via `serializeMoneyFields(quote)`. |
| `/api/wallet/:userId` | `GET` | Incomplete wallet mappings | Missing universal rupee keys | Applied `serializeMoneyFields(wallet)`. |
| `/api/wallets` | `GET` | Raw rows from `wallets` | Lacked `available_balance`, `balance_rupees`, etc. | Applied `serializeMoneyFields(wallets)`. |
| `/api/wallets/balance` | `GET` | Partial balance object | Lacked universal keys | Applied `serializeMoneyFields(balances)`. |
| `/api/users/:userId/financial-summary` | `GET` | Raw ledger summary | Relied on hand-formatted numbers | Standardized with `serializeMoneyFields()`. |
| `/api/network/downstream` | `GET` | Raw partners array | Inconsistent commission key naming | Standardized with `serializeMoneyFields()`. |

---

## 3. Shared Serializer Architecture (`server/serializers.js`)

Created ONE central shared serializer:
- `paiseToRupees(paise, decimals = 2)`: Exact string division without floating-point drift.
- `paiseToRupeesNum(paise)`: Authoritative float conversion.
- `serializeMoneyFields(data)`: Universal recursive mapper that populates:
  - `amount`, `amount_rupees`, `amount_num` from `amount_paise`.
  - `customer_charge`, `fee`, `fee_rupees`, `customer_charge_num` from `customer_charge_paise`.
  - `net_amount`, `net`, `net_rupees`, `net_num` from `net_amount_paise`.
  - `fee`, `fee_rupees`, `fee_num` from `fee_paise`.
  - `net_payout`, `net_payout_rupees`, `net_payout_num` from `net_payout_paise`.
  - `commission`, `commission_rupees`, `commission_num` from `commission_paise`.
  - `available_balance`, `balance`, `balance_rupees` from `balance_paise`.
  - `held_balance`, `held_rupees` from `held_paise`.
  - `total_sales`, `total_sales_rupees` from `total_sales_paise`.
  - `withdrawn_amount`, `withdrawn_rupees` from `withdrawn_paise`.
  - Recursively maps all items in `distributions` array.

---

## 4. UI Missing Field Error Enforcement

In `src/utils/formatters.js`, `formatPaiseToRupees` and `formatNumberIndian` were updated so that `null` or `undefined` values return `'Error'` rather than masking missing fields with `₹0.00`. In `src/components/MerchantDashboardPage.jsx` (lines 1538, 3227, 3953, 5060), fallbacks were changed from `'0.00'` to `'Sync Error'`.

---

## 5. Issue 2: Screen Blinking & Auto-Refresh Remediation

### 5.1 Root Causes Identified (Read-Only Analysis)
1. **`src/services/supabase.js` (lines 281, 295, 309):** `setInterval` timers ran every **10,000ms (10s)** for `subscribeToAdminFeed`, `subscribeToWallet`, and `subscribeToTransactions`.
2. **`src/components/MerchantDashboardPage.jsx` (lines 1459–1461):** `subscribeToWallet` sent `{ type: 'WALLET_UPDATE', userId, timestamp }` and ran `setWallet(updatedWallet)`. This **overwrote `wallet` with an object containing NO balance properties**, causing `activeMachineWallet.available_balance` to become `null`/`undefined` and blanking the screen until `fetchLiveData()` returned 200ms later.
3. **`src/components/MerchantDashboardPage.jsx` (line 1109):** `fetchNetworkData()` called `setIsLoadingNetwork(true)`, resetting loading state on every cycle.
4. **`src/components/MerchantDashboardPage.jsx` (line 620):** `setInterval(checkCommissionConfig, 10000)` ran every 10 seconds.
5. **`src/components/AdminDashboardPage.jsx` (line 347 & 605):** `subscribeToAdminFeed` triggered `fetchAdminData()`, which called `fetchRentalReport()` which called `setIsLoadingRental(true)`, causing rental components to blink.

### 5.2 Before vs. After Fix

| Location | Before (Blinking) | After (Quiet & Stable) |
| :--- | :--- | :--- |
| `src/services/supabase.js:281,295,309` | `setInterval(..., 10000)` (10s polling) | `setInterval(..., 30000)` (30s max interval) |
| `src/components/MerchantDashboardPage.jsx:1459-1463` | `setWallet(updatedWallet)` wiped wallet state every 10s | Replaced with `fetchLiveData(true)` (silent background refresh) |
| `src/components/MerchantDashboardPage.jsx:1414-1425` | Replaced `wallet` state unconditionally on every response | Compares previous values; preserves state reference if balance unchanged |
| `src/components/MerchantDashboardPage.jsx:1108-1130` | `setIsLoadingNetwork(true)` called during auto-refresh | Added `isSilent = false`; skips loading state during background refresh |
| `src/components/AdminDashboardPage.jsx:346-361` | `setIsLoadingRental(true)` called during auto-refresh | Added `isSilent = false`; skips rental loading state during background refresh |
| `src/components/AdminDashboardPage.jsx:396-415` | `setMetrics(...)` created new object reference every cycle | Checks key metrics; preserves state reference if numbers have not changed |
| Immediate Event Triggers | Event refresh was inconsistent | Refreshes immediately after card swipe recording and payout request |

---

## 6. Verification Test Matrix (All Suites Passing)

1. `server/test_paise_display_verification.mjs` — **PASSED** (Rs 10,000 swipe on Pine Labs T+1 shows amount ₹10,000 / fee ₹150 / net ₹9,850; `/api/admin/pending` 200 OK; upline earnings Area 30, District 20, SD 20, Master 20, Admin 60).
2. `server/test_phase_d1_master_suite.mjs` — **PASSED** (All 7 ACID & reconciliation tests).
3. `server/test_phase_d1b_rate_model.mjs` — **PASSED** (T1/Instant/QR rate models).
4. `server/test_phase_d1b_swipe_mode.mjs` — **PASSED** (Settlement mode swipe routing).
5. `server/test_phase_d1b_hierarchy.mjs` — **PASSED** (Parent-child hierarchy constraints).
6. `server/test_phase_d1b_withdrawals_and_export.mjs` — **PASSED** (Withdrawal lifecycle & Excel batch export).
7. `server/test_phase_d2_backend_endpoints.mjs` — **PASSED** (Settings & rates endpoints).
8. `server/test_phase_d2_frontend_flow.mjs` — **PASSED** (Frontend flow & mathematical proofs).
9. `server/test_phase_d2b_verification.mjs` — **PASSED** (All 15/15 tests).
10. `server/test_phase_d2c_verification.mjs` — **PASSED** (All 10/10 catch block tests).
11. `server/test_phase_d3_chain_shapes.mjs` — **PASSED** (All 10/10 arbitrary chain shape tests).
12. `npm run build` — **PASSED** (Clean production build).
