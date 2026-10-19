# RONAV TECHNOLOGIES — SENIOR ARCHITECTURAL REVIEW & AUDIT REPORT
**Target Audience**: Non-technical Founders, Business Stakeholders, and Engineering Leadership  
**Review Status**: Pre-Production Audit (Before 50 Real Users Handle Real Money)  
**Governing Standard**: [RULES.md](file:///c:/Users/dache/Desktop/ronava/RULES.md) (Zero Client Math, Single Source of Truth, ACID Invariants)

---

## Executive Summary
This system was built rapidly using generative AI without an initial unified architecture blueprint. As a result, critical business rules, money math, and state logic were repeatedly invented, scattered, and duplicated between the browser screens and backend code.

While recent hardening work has stabilized the core ledger calculations, **several architectural traps still exist that could cause financial loss, double payouts, or server crashes once 50 real merchants start transacting simultaneously**.

This document breaks down the system today, highlights every violation of enterprise financial standards, explains what could go wrong in plain English, and provides a clear, ranked roadmap to make the platform bulletproof before launch.

---

## 1. The Architecture as It Is Today

### Plain English Overview
Today, the platform consists of three main parts:
1. **The Browser Screens (The Frontend)**: A single React web application running in the user's browser. It contains massive screen files (over 10,000 lines each) that try to do too many jobs at once: validating inputs, calculating numbers, formatting banking files, and storing session states in browser cookies and local storage.
2. **The Server (The Backend)**: A Node.js web server (`server/api.js`) that handles incoming requests. Over time, multiple developers/prompts added duplicate endpoints for the same action (e.g., two different ways to record a card swipe, two different ways to request a withdrawal).
3. **The Database (The Storage)**: A PostgreSQL database (`ronav_test_db`) that holds user accounts, financial transactions, and immutable audit ledgers. Next to it sits an abandoned SQLite database file (`ronav.db`) from early prototyping.

### Current Architecture Diagram

```
+-----------------------------------------------------------------------------------+
|                              THE USER'S BROWSER                                    |
|                                                                                   |
|  [ MerchantDashboardPage.jsx ]             [ AdminDashboardPage.jsx ]             |
|   - 10,184 lines of code                    - 16,000+ lines of code               |
|   - Multiplies amounts by 100               - Calculates totals with .reduce()    |
|   - Guesses 'T1' settlement mode            - Guesses machine IDs (e.g. 'PL-01')  |
|   - Generates random ref numbers            - Caches data with flawed equality    |
|                                                                                   |
|             \                                   /                                 |
|              \                                 /                                  |
|         [ src/services/api.js ]    [ src/services/supabase.js (Legacy Shim) ]     |
|          - Stores tokens in 4 keys  - Intercepts fake DB calls                     |
|          - Fallback session logic   - Translates to REST calls                     |
+-----------------------------------------------------------------------------------+
                                       |
                           (HTTP / REST API Requests)
                                       v
+-----------------------------------------------------------------------------------+
|                                 THE NODE.JS SERVER                                |
|                                                                                   |
|  [ server/api.js ] (4,153 lines)                                                  |
|   * DUPLICATE ROUTES:                                                             |
|     - /api/transactions/record  VS  /api/transactions/process-swipe               |
|     - /api/withdrawals/request  VS  /api/withdrawals/execute                      |
|                                                                                   |
|   * ENGINES:                                                                      |
|     - transaction_engine.js (Climbs distributor hierarchy, distributes commission)|
|     - withdrawal_engine.js (Row locks wallet, checks Rs 500 reserve)              |
|     - ledger_engine.js (Calculates live balances from financial_ledger)          |
|     - reversal_engine.js (Reverses swipes, checks 5-min withdrawal window)        |
+-----------------------------------------------------------------------------------+
                                       |
                             (PostgreSQL Connection)
                                       v
+-----------------------------------------------------------------------------------+
|                              THE LIVE DATABASE                                    |
|                                                                                   |
|  [ PostgreSQL: ronav_test_db ]                 [ Dead SQLite: ronav.db ]          |
|   - users (merchants, distributors, admins)     - Unused prototype file           |
|   - wallets (cached balance summary)            - Still referenced in db.js       |
|   - transactions (raw card swipes & payments)                                     |
|   - withdrawals (payout requests & batches)                                       |
|   - financial_ledger (signed double-entry math)                                   |
|   - user_channel_rates (Pine Labs / Swiff rates)                                  |
+-----------------------------------------------------------------------------------+
```

---

## 2. Today vs. The Standard Enterprise Financial Design

In enterprise banking and payments (like Stripe or Razorpay), a financial system must follow 5 non-negotiable laws:
1. **Screens Only Display**: The browser is untrusted. It never calculates money, never invents defaults, and never generates financial identifiers.
2. **Server Owns All Logic**: The server validates permissions, calculates exact fees down to the single paise (₹0.01), and enforces business rules.
3. **Database Is Single Source of Truth**: There is only one place where a user's balance lives. Wallets are never split across disconnected tables.
4. **All Actions Are All-or-Nothing (Atomic Transactions)**: A payment and its ledger entries either succeed together 100% or fail completely. There is no partial state.
5. **Single Definition of Terms**: One status name, one rate model, one endpoint per business action.

### Every Place Today That Breaks This Standard

```
+-------------------------------------------------------------------------------------------------------------------------+
| Area              | File & Line Number                            | Defect Description                                  |
+-------------------------------------------------------------------------------------------------------------------------+
| 1. Swipes         | server/api.js:1807 & 3955                     | Two competing endpoints for recording card swipes   |
| 1. Swipes         | MerchantDashboardPage.jsx:2006                | Browser multiplies money: Math.round(amountVal*100) |
| 1. Swipes         | MerchantDashboardPage.jsx:2000                | Browser defaults missing settlement mode to 'T1'    |
| 1. Swipes         | MerchantDashboardPage.jsx:2289-2307           | BBPS bill payment generates fake mock ref numbers   |
| 1. Swipes         | transaction_engine.js:223                     | Nested BEGIN transaction warning in PostgreSQL      |
| 1. Swipes         | server/api.js:1839                            | Fallback caller ID allows unauthenticated spoofing  |
| 2. Withdrawals    | server/api.js:2267 & 3914                     | Two competing endpoints for withdrawal requests     |
| 2. Withdrawals    | withdrawal_engine.js:210-216                  | Balance check reads from TWO different sources     |
| 2. Withdrawals    | MerchantDashboardPage.jsx:2289                | Browser performs client-side balance checks         |
| 3. Payouts/Excel  | bankExportUtils.js:60                         | Browser math: netAmt = grossAmt - feeAmt            |
| 3. Payouts/Excel  | bankExportUtils.js:47-50                      | Beneficiary name guessed via regex & fallback       |
| 3. Payouts/Excel  | server/api.js:2605-2613                       | SQL subquery guesses swipe mode from latest txn     |
| 3. Payouts/Excel  | server/api.js:2616                            | Multi-terminal merchant picks arbitrary machine ID  |
| 4. Reversals      | reversal_engine.js:46                         | Reversal only checks 5-minute withdrawal window     |
| 4. Reversals      | reversal_engine.js:120-135                    | Reversal forces negative balance without lockout    |
| 5. Admin Screens  | AdminDashboardPage.jsx:5442-5457              | Hardcoded terminal fallbacks ('PL-01', 'SWIFF-01')  |
| 5. Admin Screens  | AdminDashboardPage.jsx:5283                   | Fallback treats wallet balance as earned commission |
| 5. Admin Screens  | AdminDashboardPage.jsx:6793                   | Browser accumulates batch totals with .reduce()     |
| 5. Admin Screens  | server/api.js:1538 & 2227                     | Unpaginated queries fetch all records into memory   |
| 6. Login & Auth   | src/services/api.js:120-131                   | Tokens duplicated across 4 local/session keys       |
| 6. Login & Auth   | src/services/supabase.js:105-300              | Fake Supabase query builder emulation shim remains  |
| 6. Login & Auth   | server/db.js:1-156                            | Abandoned SQLite database file sits in codebase      |
+-------------------------------------------------------------------------------------------------------------------------+
```

---

## 3. Real-World Risk Breakdown (What Can Go Wrong)

### Area 1: Swipes & Card Payments
* **Issue 1: Two competing endpoints for recording card swipes**
  * *File/Line*: [server/api.js:1807](file:///c:/Users/dache/Desktop/ronava/server/api.js#L1807) & [server/api.js:3955](file:///c:/Users/dache/Desktop/ronava/server/api.js#L3955)
  * *What can go wrong*: Endpoint `/api/transactions/record` enforces channel and settlement modes, while `/api/transactions/process-swipe` bypasses mode checks. A merchant or script calling the secondary route can bypass rate rules.
  * *Realistic Example*: Merchant swipes a ₹50,000 card transaction. One endpoint charges 1.83% (Instant fee), but the other records it at 1.53% (T1 fee). The merchant gets ₹150 more than they should, and the platform pays the bank out of pocket.
  * *Severity*: 🔴 **CAN LOSE MONEY**

* **Issue 2: Unauthenticated Caller ID Fallback**
  * *File/Line*: [server/api.js:1839](file:///c:/Users/dache/Desktop/ronava/server/api.js#L1839)
  * *What can go wrong*: If an HTTP request has no valid login token, the server falls back to reading `merchant_id` from the request body (`createdBy = caller?.id || merchantId`).
  * *Realistic Example*: A malicious actor sends an API call with `merchant_id = 'MID1001'` without logging in. The server records the transaction as created by `MID1001` instead of rejecting it with an unauthorized error.
  * *Severity*: 🔴 **CAN LOSE MONEY**

* **Issue 3: Browser multiplying money (`Math.round(amountVal * 100)`)**
  * *File/Line*: [src/components/MerchantDashboardPage.jsx:2006](file:///c:/Users/dache/Desktop/ronava/src/components/MerchantDashboardPage.jsx#L2006)
  * *What can go wrong*: JavaScript floating-point math can result in rounding inaccuracies (e.g., `19.99 * 100 = 1998.9999999999998`).
  * *Realistic Example*: A customer pays ₹1,199.99. The browser converts it to 119998 paise instead of 119999 paise. Over lakhs of transactions, accounting will never reconcile with bank settlements.
  * *Severity*: 🟠 **SHOWS WRONG NUMBERS**

---

### Area 2: Withdrawals
* **Issue 1: Split Sources of Truth for Wallet Balances**
  * *File/Line*: [server/withdrawal_engine.js:210-216](file:///c:/Users/dache/Desktop/ronava/server/withdrawal_engine.js#L210-L216)
  * *What can go wrong*: The withdrawal engine checks the total balance against `wallets.balance_paise`, but it checks channel balances by summing rows in `financial_ledger`. If the cached wallet row drifts from the ledger, transactions freeze or permit overdrafts.
  * *Realistic Example*: A merchant's ledger has ₹10,000 in Pine Labs, but the `wallets` table shows ₹2,000 because an earlier write was interrupted. The merchant attempts to withdraw ₹5,000. The system rejects it with an error saying "Insufficient balance", even though the merchant has the money in the ledger.
  * *Severity*: 🟠 **SHOWS WRONG NUMBERS**

* **Issue 2: Two Competing Withdrawal Endpoints**
  * *File/Line*: [server/api.js:2267](file:///c:/Users/dache/Desktop/ronava/server/api.js#L2267) & [server/api.js:3914](file:///c:/Users/dache/Desktop/ronava/server/api.js#L3914)
  * *What can go wrong*: `/api/withdrawals/request` has reserve and negative balance checks. `/api/withdrawals/execute` is an older endpoint that does not validate caller identity against downlines.
  * *Realistic Example*: An automated retry or integration hits `/api/withdrawals/execute` and bypasses caller verification.
  * *Severity*: 🔴 **CAN LOSE MONEY**

---

### Area 3: Payouts and Excel Export
* **Issue 1: Client-side Math on Missing Export Values**
  * *File/Line*: [src/utils/bankExportUtils.js:60](file:///c:/Users/dache/Desktop/ronava/src/utils/bankExportUtils.js#L60)
  * *What can go wrong*: If the server returns a withdrawal row where `net_payout` is undefined, the browser executes `grossAmt - feeAmt` using standard floating-point numbers.
  * *Realistic Example*: Admin clicks "Download Sheet" on a batch of 40 withdrawals. One withdrawal has a fee calculation error on the server. The browser guesses the net payout. The generated sheet is uploaded to the bank portal, sending the wrong amount to the merchant's bank account.
  * *Severity*: 🔴 **CAN LOSE MONEY**

* **Issue 2: Beneficiary Name Guessed via Regex and Fallbacks**
  * *File/Line*: [src/utils/bankExportUtils.js:47-50](file:///c:/Users/dache/Desktop/ronava/src/utils/bankExportUtils.js#L47-L50)
  * *What can go wrong*: The bank export utility checks `item.admin_remark` using a regex pattern `Name:\s*([^|•\r\n]+)` to find the beneficiary name, and if that fails, it falls back to the word `"Beneficiary"`.
  * *Realistic Example*: A merchant requests a payout to his partner's bank account ("Rajesh Sharma"). The export utility fails to find the name in the remark and outputs "Beneficiary" or the merchant's business name. The bank's automated NEFT/RTGS validation rejects the payment, or the bank manual checker flags it as a suspicious transfer.
  * *Severity*: 🔴 **CAN LOSE MONEY / HIGH RISK**

* **Issue 3: Correlated SQL Subquery Guesses Swipe Mode**
  * *File/Line*: [server/api.js:2605-2613](file:///c:/Users/dache/Desktop/ronava/server/api.js#L2605-L2613)
  * *What can go wrong*: When generating the bank batch, the server runs a subquery that looks up the *latest card swipe* the merchant ever performed and assumes the withdrawal matches that mode.
  * *Realistic Example*: Merchant swiped ₹2,000 on T1 mode yesterday. Today they swipe ₹5,000 on Instant mode and immediately request a T1 withdrawal. The export sheet tags the withdrawal as "Instant" because of the latest swipe, creating confusion on whether instant fees apply.
  * *Severity*: 🟠 **SHOWS WRONG NUMBERS**

---

### Area 4: Reversals
* **Issue 1: The Arbitrary 5-Minute Time Window Flaw**
  * *File/Line*: [server/reversal_engine.js:46](file:///c:/Users/dache/Desktop/ronava/server/reversal_engine.js#L46)
  * *What can go wrong*: When an Admin reverses a fraudulent card swipe, the engine looks for related withdrawals created within a 5-minute window (`created_at >= ($2::timestamptz - INTERVAL '5 minutes')`). If a merchant requested a withdrawal 10 minutes or 2 hours after the swipe, the reversal engine completely misses it.
  * *Realistic Example*: A fraudulent merchant swipes a fake card for ₹1,00,000 at 9:00 AM. At 9:15 AM, they request a withdrawal. At 11:00 AM, the Admin realizes the swipe is fraud and clicks "Reverse Swipe". Because the withdrawal was requested 15 minutes after the swipe (greater than 5 minutes), the reversal engine **does not flag the payout**. The Admin later downloads the bank sheet, submits it, and ₹1,00,000 is sent to the fraudster.
  * *Severity*: 🔴 **CAN LOSE MONEY**

* **Issue 2: Reversal Leaves Negative Balance Without Account Freeze**
  * *File/Line*: [server/reversal_engine.js:120-135](file:///c:/Users/dache/Desktop/ronava/server/reversal_engine.js#L120-L135)
  * *What can go wrong*: Reversing a swipe correctly deducts the money from the ledger, which may plunge the merchant's wallet into negative (e.g. `-₹2,000`). However, the reversal does not automatically suspend or flag the merchant account in the `users` table.
  * *Realistic Example*: A merchant whose account is `-₹50,000` continues logging in, submitting support tickets, or attempting transactions without a prominent administrative hold.
  * *Severity*: 🟡 **ANNOYING / OPERATIONAL CONFUSION**

---

### Area 5: Admin Screens
* **Issue 1: Hardcoded Machine Fallbacks in UI**
  * *File/Line*: [src/components/AdminDashboardPage.jsx:5442, 5641, 5835](file:///c:/Users/dache/Desktop/ronava/src/components/AdminDashboardPage.jsx#L5442)
  * *What can go wrong*: If a merchant's terminal ID is missing from the database, the Admin screen displays `'PL-01'` or `'SWIFF-01'`.
  * *Realistic Example*: An Admin reviewing merchant hardware settings assumes the merchant has active terminal `PL-01` installed, when in reality the terminal was never provisioned in the database.
  * *Severity*: 🟠 **SHOWS WRONG NUMBERS**

* **Issue 2: Unpaginated Database Queries**
  * *File/Line*: [server/api.js:1538 & 2227](file:///c:/Users/dache/Desktop/ronava/server/api.js#L1538)
  * *What can go wrong*: Endpoints like `GET /api/users` and `GET /api/admin/transactions` run `SELECT * FROM ...` without a `LIMIT` clause.
  * *Realistic Example*: Once 50 merchants record 200 swipes a day for a month (300,000 records), an Admin opening the dashboard will trigger a query fetching all 300,000 rows into Node.js memory. The Node process will run out of RAM and crash (HTTP 502 Bad Gateway) for all active users.
  * *Severity*: 🟡 **SYSTEM INSTABILITY / CRASH**

---

### Area 6: Login and Identity
* **Issue 1: Session Token Sprawl**
  * *File/Line*: [src/services/api.js:120-131](file:///c:/Users/dache/Desktop/ronava/src/services/api.js#L120-L131)
  * *What can go wrong*: When logging in, the token and user data are written to `sessionStorage.ronav_session`, `sessionStorage.ronav_admin_user`, `sessionStorage.ronav_merchant_user`, and `localStorage.ronav_token`.
  * *Realistic Example*: If an Admin logs into the merchant portal to test a merchant account, one storage key updates while another retains the Admin role, causing cross-role collision or unexpected logouts.
  * *Severity*: 🟡 **ANNOYING / SESSION CONFUSION**

* **Issue 2: Dead SQLite Database File Still in Codebase**
  * *File/Line*: [server/db.js:1-156](file:///c:/Users/dache/Desktop/ronava/server/db.js#L1) & `ronav.db`
  * *What can go wrong*: An old `node:sqlite` database file from early development is still present. A developer or script importing `db.js` could write data to SQLite instead of PostgreSQL, resulting in lost data.
  * *Severity*: 🟠 **SHOWS WRONG NUMBERS**

---

## 4. The Target Architecture (Smallest Number of Changes)

To solve these problems without rewriting the platform, we make 4 surgical moves:

```
+---------------------------------------------------------------------------------------------------+
| TARGET ARCHITECTURE PRINCIPLES                                                                     |
+---------------------------------------------------------------------------------------------------+
| 1. CONSOLIDATE SERVER ENDPOINTS:                                                                  |
|    - Delete secondary endpoints (/api/transactions/process-swipe, /api/withdrawals/execute).      |
|    - Every action has exactly ONE canonical server route that requires a verified token.          |
|                                                                                                   |
| 2. PURE DISPLAY CLIENT:                                                                           |
|    - Remove all client-side money math (gross - fee, amount * 100).                               |
|    - The client sends raw strings/integers and displays formatted strings returned by the server. |
|                                                                                                   |
| 3. REMOVE OBSOLETE SHIMS:                                                                         |
|    - Purge src/services/supabase.js (replace with direct fetchWithTimeout calls).                 |
|    - Delete server/db.js and ronav.db SQLite files.                                               |
|                                                                                                   |
| 4. HARDEN REVERSAL & EXPORT LOGIC:                                                                |
|    - Fix the 5-minute window bug: Reversals must check ALL non-rejected payouts for that merchant. |
|    - Bank export must read beneficiary names directly from the beneficiaries table.               |
+---------------------------------------------------------------------------------------------------+
```

### Module Ownership Table

```
+-----------------------+-----------------------------+------------------------------------------------------+
| Core Action           | Single Owning Server Module | What It Owns Exclusively                             |
+-----------------------+-----------------------------+------------------------------------------------------+
| Card Swipes & QR      | server/transaction_engine.js| Rate hierarchy traversal, net calculation, ledger log|
| Withdrawal Requests   | server/withdrawal_engine.js | Wallet locking, Rs 500 reserve check, fee quotation  |
| Bank Payout Batches   | server/api.js (Admin Payout)| Batch ID creation, UTF-8 BOM CSV generation          |
| Ledger & Balances     | server/ledger_engine.js     | Summing financial_ledger, reserve rules              |
| Swipe Reversals       | server/reversal_engine.js   | Reversing credit, upline clawbacks, fraud alerts     |
| Auth & Permissions    | server/security.js          | Bearer JWT signing, role validation, rate limits     |
+-----------------------+-----------------------------+------------------------------------------------------+
```

---

## 5. Ranked Implementation Order

This roadmap is ordered strictly to **never break existing data** and ensure zero downtime:

### MUST DO BEFORE 50 USERS HANDLE REAL MONEY
1. **Fix the Reversal 5-Minute Window Bug ([server/reversal_engine.js:46](file:///c:/Users/dache/Desktop/ronava/server/reversal_engine.js#L46))**:
   - Change the query to check *all* pending or in-transit withdrawals for that merchant, not just those within 5 minutes. This prevents paying out fraudulent withdrawals.
2. **Eliminate Duplicate API Endpoints**:
   - Remove lines 3914–3993 in `server/api.js` (`/api/transactions/process-swipe` and `/api/withdrawals/execute`). Ensure all callers route through the strict, token-validated endpoints.
3. **Plug the Unauthenticated Caller Fallback ([server/api.js:1839](file:///c:/Users/dache/Desktop/ronava/server/api.js#L1839))**:
   - Require a verified JWT Bearer token on `/api/transactions/record`. Reject any call without a valid token.
4. **Enforce Database Row-Level Locking on All Payout Status Changes**:
   - Ensure `POST /api/admin/withdrawals/export-excel` and `POST /api/admin/withdrawals/confirm-utr` always use `SELECT ... FOR UPDATE` inside `withTransaction`.
5. **Add Pagination to Admin Queries**:
   - Add `LIMIT 50 OFFSET X` to `/api/admin/transactions` and `/api/users` so 50 active merchants do not crash the Node.js server.

### CAN WAIT UNTIL AFTER LAUNCH (PHASE 2)
1. **Purge Fake Supabase Shim ([src/services/supabase.js](file:///c:/Users/dache/Desktop/ronava/src/services/supabase.js))**:
   - Replace legacy `.from('wallets').select()` calls with standard `getWallet()` functions.
2. **Delete Abandoned SQLite File ([server/db.js](file:///c:/Users/dache/Desktop/ronava/server/db.js))**:
   - Remove `ronav.db` and `server/db.js` so only `server/pg_db.js` exists.
3. **Split Monolithic Screen Files**:
   - Refactor `AdminDashboardPage.jsx` (16,000 lines) and `MerchantDashboardPage.jsx` (10,000 lines) into focused, smaller tab components (e.g., `PayoutsTab.jsx`, `LedgerTab.jsx`, `HardwareTab.jsx`).
4. **Clean up Session Storage Keys**:
   - Standardize on a single `ronav_token` and `ronav_session` key across all browser views.

---
*Report prepared in accordance with [RULES.md](file:///c:/Users/dache/Desktop/ronava/RULES.md). System is ready for hardening per the ranked order.*
