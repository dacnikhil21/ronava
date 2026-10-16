# PHASE D2c AUDIT REPORT: CATCH BLOCK ERROR STATES & ZERO GUESSED NUMBERS

**Branch:** `fix/phase-d2c-catch`  
**Base Branch:** `fix/phase-d2b-fallbacks`  
**Target Environment:** Local Test Database (`ronav_test_db`) Only  
**Production / Main / EC2 Policy:** Strictest isolation observed. Zero writes or deployments to production, `main`, or EC2 (`13.201.4.145`).

---

## 1. Executive Summary

Phase D2c addressed all money, payout, rate, balance, and fee adjacent catch blocks identified in Section 6 of `/audit/PHASE_D2B_REPORT.md`. 
Every block that previously masked failures with default values, guessed rates (`0%`, `₹0.00`, `'PL-01'`), or partial sums was remediated to present an explicit, prominent error state:
```
Could not load rates, try again
```
Zero guessed numbers or fabricated rates remain in the application under any error or partial failure conditions.

---

## 2. Catch Block Remediation: Before vs. After Comparison Table

The following table details all money/rate/balance-adjacent catch blocks remediated in Phase D2c:

| # | File & Line | Context | What the User Saw Before (Masked / Guessed) | What the User Sees Now (Explicit Error State) |
| :--- | :--- | :--- | :--- | :--- |
| 1 | `src/components/AdminDashboardPage.jsx:1187` | Member Dossier upline commission cut calculation (`getUserTotalCommissionEarned`) | If a transaction notes JSON parse failed, split calculation skipped it and displayed partial/incomplete cut or `+ ₹0.00` | Displays visible error state: `<strong style={{ color: '#DC2626' }}>Could not load rates, try again</strong>` across Master, Super, District, and Area roster cuts. |
| 2 | `src/components/AdminDashboardPage.jsx:1440` | Admin Dashboard Card 2 ("Admin Net Profit") fee parser (`getTxnCompanyFee`) | If fee metadata failed to parse, `compFee` defaulted to `0`, displaying guessed or partial company profit in Card 2 | If any transaction fee metadata fails to parse, Card 2 displays `<h3 style={{ color: '#DC2626' }}>Could not load rates, try again</h3>` instead of guessed numbers. |
| 3 | `src/components/AdminDashboardPage.jsx:1584` | MDR Commission Breakdown calculation (`calculateMdrCommissionBreakdown`) | If metadata failed to parse, fell back to `merchantComm: 0.00`, `0% margin`, and `+₹0.00` in MDR breakdown table/mobile cards | Sets `metaError = true`. Both table and mobile receipt cards display `<strong style={{ color: '#DC2626' }}>Could not load rates, try again</strong>`. Commission amount is `null`. |
| 4 | `src/components/AdminDashboardPage.jsx:2796` | Ledger Dossier Gross MDR Summary | If swipe notes JSON parse failed, fell back to `0.00` gross MDR and guessed `adminCut = 0` | If fee metadata fails to parse, Dossier summary card displays `<strong style={{ color: '#DC2626' }}>Could not load rates, try again</strong>` for Gross MDR and Admin Net Profit. |
| 5 | `src/components/AdminDashboardPage.jsx:2968` | Dossier Card Swipe Transaction List & Modal (`selectedDossierTxn`) | If notes JSON parse failed, displayed `Gross MDR: ₹0.00`, `Uplines Cut: ₹0.00`, `Net Admin: +₹0.00` | Flags `feeError = true`. Transaction card financial strip and modal display red error banner `<strong style={{ color: '#DC2626' }}>Could not load rates, try again</strong>`. |
| 6 | `src/components/MerchantDashboardPage.jsx:784` | Merchant Transaction Detail Modal (`parseTxnDisplay`) | If notes JSON parse failed, fell back to `companyFee = 0`, displaying `-₹0.00` company fee and full gross amount as net credited | Flags `parseError = true`. Transaction detail modal displays `<div style={{ color: '#DC2626' }}>Could not load rates, try again</div>`. Never displays `₹0.00` or guessed net credit. |
| 7 | `src/services/api.js:766` | Multi-channel POS configuration notes parser (`parseMerchantChannels`) | If `[PORTFOLIO]` JSON failed to parse, fell back to legacy single machine (`PL-01`) with guessed default `0` rates | Returns `{ hasError: true, error: 'Could not load rates, try again' }`. Enabled list is empty (`[]`). Zero guessed machine channels or fallback rates. |
| 8 | `src/services/api.js:930` | Legacy machine notes parser for rates & upline cut (`parsePosTerminalRates`) | If `[PORTFOLIO]` JSON failed to parse, fell through to delimiter parser and returned default `rateT1: 0, rateInstant: 0` | Returns `{ terminal_id: 'ERR', rateT1: null, rateInstant: null, hasError: true, error: 'Could not load rates, try again' }`. |
| 9 | `src/components/MerchantDashboardPage.jsx:450, 2555, 3261, 3634` | Merchant Dashboard Active Machine & Record Sale Rate Integration | If channels or rates returned an error, fell back to static template rates (`base.rateInstant`) | If `merchantChannels.hasError` or `userPosRates.hasError`, sets `activeMachine.hasRateError = true`. Terminal pill, QR badge, and Sale Form render `"Could not load rates, try again"`. Sale submission button is strictly disabled. |

---

## 3. Harmless Cosmetic / Infrastructure Catch Blocks Kept as Logging

The following catch blocks located outside rate calculation logic only omit a cosmetic badge or perform cleanup. They were reviewed and confirmed harmless:

1. **`src/components/AdminDashboardPage.jsx:372` & `MerchantDashboardPage.jsx:534`** — `getPlatformQrConfig().catch()`
   - **Rationale:** Loads optional dynamic QR payee name and QR image URL. On failure, falls back cleanly to corporate static platform QR SVG ("RONAV Technologies"). No rate, margin, or money amount is guessed or affected.
2. **`src/components/AdminDashboardPage.jsx:578`** — `(window.URL || window.webkitURL).revokeObjectURL(url)`
   - **Rationale:** Browser DOM memory cleanup after initiating bank batch CSV download. The download has already been dispatched.
3. **`src/components/MerchantDashboardPage.jsx:252`** — `document.body.removeChild(textArea)`
   - **Rationale:** Fallback clipboard helper DOM cleanup after copy command. User toast has already been triggered.
4. **`src/components/MerchantDashboardPage.jsx:286`** — `sessionStorage.getItem('ronav_user_pos')`
   - **Rationale:** Client storage cache read. On failure, returns `null` which immediately triggers `isLoadingPos: true` and renders the live terminal skeleton loader while `fetchLiveData()` fetches fresh configuration from the server.
5. **`src/components/MerchantDashboardPage.jsx:603`** — `getCommissionPayoutConfig().catch()`
   - **Rationale:** Background polling helper for commission payout toggle. On failure, maintains current button toggle state without visual disruption or guessing financial data.
6. **`src/components/MerchantDashboardPage.jsx:677`** — Profile background sync
   - **Rationale:** Background fetch keeping user session alive; failure keeps current active session in memory without forcing logout.
7. **`src/components/MerchantDashboardPage.jsx:1395`** — `sessionStorage.setItem('ronav_user_pos')`
   - **Rationale:** Non-blocking storage cache write. Live in-memory state remains authoritative.
8. **`src/services/api.js:77, 86`** — Session parsing
   - **Rationale:** Unauthenticated session directing cleanly to login.
9. **`src/services/api.js:287, 411`** — Cloud remarks parsing in `getAllUsers()` / `getHierarchyTree()`
   - **Rationale:** Status remarks fall back to reading the authoritative PostgreSQL `users.status` column (`ACTIVE` / `SUSPENDED`).
10. **`src/services/api.js:1061`** — Channel classification from transaction notes
    - **Rationale:** Falls back directly to reading the PostgreSQL `channel` column on the transaction row.
11. **`src/services/api.js:2342, 2390, 2432`** — LocalStorage purge operations
    - **Rationale:** Internal development maintenance utility.
12. **`src/services/supabase.js:285, 299, 313`** — Heartbeat, wallet, and transaction subscription polling
    - **Rationale:** Background interval ticks; next 10-second polling interval re-executes automatically. No guessed numbers or default balances are injected into state.
13. **`src/utils/bankExportUtils.js:179, 198, 433, 529`** — DOM blob URL revocation
    - **Rationale:** Browser garbage collection cleanup after file download is handed over to user agent.

---

## 4. Test Verification Results

### 4.1 Phase D2c Automated Verification Suite (`server/test_phase_d2c_verification.mjs`)
| Test # | Description | Result |
| :--- | :--- | :--- |
| Test 1 | API `parseMerchantChannels` returns error object on corrupt `[PORTFOLIO]` JSON | `✅ PASSED` |
| Test 2 | API `parsePosTerminalRates` returns `null` rates and error state on corrupt `[PORTFOLIO]` | `✅ PASSED` |
| Test 3 | `AdminDashboardPage`: Member commission returns error state when notes JSON corrupt | `✅ PASSED` |
| Test 4 | `AdminDashboardPage`: Card 2 displays error state when transaction fee metadata is corrupt | `✅ PASSED` |
| Test 5 | `AdminDashboardPage`: MDR breakdown renders error state when meta JSON is corrupt | `✅ PASSED` |
| Test 6 | `AdminDashboardPage`: Ledger summary displays error state on fee parse failure | `✅ PASSED` |
| Test 7 | `AdminDashboardPage`: Card swipe drawer shows error state when notes JSON corrupt | `✅ PASSED` |
| Test 8 | `MerchantDashboardPage`: Transaction modal displays error state on corrupt notes JSON | `✅ PASSED` |
| Test 9 | `MerchantDashboardPage`: Active machine and Sale form show error state on rate failure | `✅ PASSED` |
| Test 10 | Zero remaining fallback to guessed rates or company fees in remediated blocks | `✅ PASSED` |

### 4.2 Comprehensive Regression Suite Results
| Test Suite | Purpose | Result |
| :--- | :--- | :--- |
| `server/test_phase_d1_master_suite.mjs` | D1 Reference Chain, Idempotency, Immutability, Rollback, 50 Concurrent Withdrawals, Ledger Reconciliation | `✅ ALL 7 TESTS PASSED` |
| `server/test_phase_d1b_rate_model.mjs` | T+1/Instant/NONE Settlement Modes, Migration, Legacy Rate Fallbacks | `✅ ALL TESTS PASSED` |
| `server/test_phase_d1b_swipe_mode.mjs` | Swipe Mode Enforcement, Upline Mode Resolution, QR Restriction | `✅ ALL TESTS PASSED` |
| `server/test_phase_d1b_hierarchy.mjs` | Hierarchy Rule Enforcement (`child_rate >= parent_rate`) across User Creation & Updates | `✅ ALL TESTS PASSED` |
| `server/test_phase_d1b_withdrawals_and_export.mjs` | 4-Status Machine, Batch Export, UTR Uniqueness, Terminal State Locks, Mode Mismatch | `✅ ALL 10 TESTS PASSED` |
| `server/test_phase_d2_backend_endpoints.mjs` | Dynamic Settings, Creator Rate Config, Real Ledger Commissions, Downstream Network | `✅ ALL TESTS PASSED` |
| `server/test_phase_d2_frontend_flow.mjs` | Frontend Rate Loading, Math Elimination, Reference Swipe Distribution, Idempotency | `✅ ALL TESTS PASSED` |
| `server/test_phase_d2b_verification.mjs` | Fake Bank Details Removal, Home Wallet Error Banner, Offline Cache Purge | `✅ ALL 15 TESTS PASSED` |
| `server/test_phase_d2c_verification.mjs` | Catch Block Error States, Zero Guessed Numbers, Visible Error Displays | `✅ ALL 10 TESTS PASSED` |

---

## 5. Git Commit History on `fix/phase-d2c-catch`

```
f449c75 test(phase-d2c): add automated test suite verifying error states for all remediated catch blocks
f2e2c30 fix(phase-d2c): return explicit error state on channel and rate parse failures in api service and merchant dashboard
002696a fix(phase-d2c): show error state in merchant transaction details when rate metadata fails to parse
f7249e0 fix(phase-d2c): show error state in card swipe drawer when fee metadata is corrupt
cce0ccc fix(phase-d2c): show visible error state for company fee and MDR splits on parse failure
ced8446 fix(phase-d2c): show visible error state instead of 0 when member commission calculation fails
```
