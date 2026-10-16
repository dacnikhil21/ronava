# AUDIT REPORT: HIERARCHY CHAIN SHAPES & COMMISSION ENGINE AUDIT

**Branch:** `fix/phase-d2c-catch`  
**Execution Mode:** Read-Only Audit (No Code Changes Made)  
**Database Target:** `ronav_test_db` (Local Test PostgreSQL Only)  

---

## 1. Overview & Scope

This audit evaluates the server-side transaction engine (`server/transaction_engine.js` and `server/api.js`) against the core business rules:
1. Non-admin users (Master, Super Distributor, District, Area, Merchant) recording swipes; Admin blocked from recording swipes.
2. Commission calculation walking the real parent hierarchy to Admin, with each parent earning `(rate charged child) - (rate charged self)`.
3. Support for arbitrary chain shapes and lengths (e.g. `Admin > SD > Merchant`, `Admin > Master > District > Merchant`, non-merchant self-swiping).
4. Admin receiving remainder after all upline cuts.

---

## 2. Answers to Specific Audit Questions

### Question 1: Does the swipe engine walk the actual parent chain, or does it assume fixed levels? Does it work for any chain length?

* **File & Lines:** [`server/transaction_engine.js:83-117`](file:///c:/Users/dache/Desktop/ronava/server/transaction_engine.js#L83-L117)
* **Finding:**
  The swipe engine dynamically traverses the real database parent chain using a `while (currentId)` loop that inspects each ancestor's `creator_id` until reaching `u.role === 'ADMIN' || !u.creator_id`. It does **not** assume fixed levels or hardcoded role slots during hierarchy building.
* **Mechanism:**
  ```javascript
  // server/transaction_engine.js:83-117
  const hierarchy = [];
  let currentId = merchantId;

  while (currentId) {
    const userRes = await client.query(
      `SELECT id, name, role, creator_id FROM users WHERE UPPER(id) = UPPER($1)`,
      [currentId]
    );
    // ...
    hierarchy.push({ user_id: u.id, name: u.name, role: u.role, creator_id: u.creator_id, rate_bps: rateInfo.rate_bps, settlement_mode: mode });
    if (u.role === 'ADMIN' || !u.creator_id) break;
    currentId = u.creator_id;
  }
  ```
* **Chain Length Compatibility:**
  It physically builds the array for any chain length ($1, 2, 3, \dots, N$). However, the mathematical distribution formula on line 150 (`marginBps = current.rate_bps - nextParent.rate_bps`) introduces a margin calculation discrepancy whenever an intermediate tier is skipped (see Question 5).

---

### Question 2: Is a swipe by a non-merchant role (e.g. District swiping for themselves) handled? Which rate is used?

* **File & Lines:** [`server/transaction_engine.js:10-29`](file:///c:/Users/dache/Desktop/ronava/server/transaction_engine.js#L10-L29), [`server/transaction_engine.js:94-102`](file:///c:/Users/dache/Desktop/ronava/server/transaction_engine.js#L94-L102), [`server/transaction_engine.js:131-133`](file:///c:/Users/dache/Desktop/ronava/server/transaction_engine.js#L131-L133), [`server/api.js:1447-1507`](file:///c:/Users/dache/Desktop/ronava/server/api.js#L1447-L1507)
* **Finding:**
  **Yes, it is handled mechanically without error.**
  Neither `/api/transactions/record` nor `processSwipeTransaction` enforces `user.role === 'MERCHANT'`. Any valid `userId` passed as `merchant_id` is treated as the primary transaction swiper (`hierarchy[0]`).
* **Which Rate is Used:**
  Line 94 calls `getActiveRate(client, { userId: u.id, channel, settlementMode })` for the swiper. The rate configured for that user in `user_channel_rates` is applied:
  - If a District Distributor (`DIST2001`, rate: 1.20% / 120 bps) records a swipe for themselves, they are charged **1.20%** as the fee (`customer_charge_paise`), and credited with **98.80%** net to their wallet.
  - The upline chain above them (`SD1001` $\rightarrow$ `MST1001` $\rightarrow$ `ADM001`) receives commissions according to their respective margins.

---

### Question 3: Is Admin blocked from recording swipes, on the server?

* **File & Lines:** [`server/transaction_engine.js:83-117`](file:///c:/Users/dache/Desktop/ronava/server/transaction_engine.js#L83-L117), [`server/api.js:1442-1507`](file:///c:/Users/dache/Desktop/ronava/server/api.js#L1442-L1507)
* **Finding:**
  **NO. Admin is NOT blocked from recording swipes on the server.**
* **Empirical Verification:**
  Calling `processSwipeTransaction` with `merchantId: 'ADM001'` executes successfully without throwing any error.
  When Admin swipes:
  1. `hierarchy` contains a single node: `[ { user_id: 'ADM001', role: 'ADMIN', rate_bps: 60 } ]`.
  2. Admin is charged the 0.60% rate (60 bps = ₹60.00 on ₹10,000).
  3. `swipe_credit` posts **₹9,940.00** to Admin's wallet.
  4. `commission` (as admin remainder) posts **₹60.00** to Admin's wallet.
  5. The server lacks any check such as `if (caller.role === 'ADMIN' || user.role === 'ADMIN') throw new Error('ADMIN_CANNOT_SWIPE')`.

---

### Question 4: Are there any tests for short chains (Admin>SD>Merchant, Admin>Master>Merchant) or non-merchant swipers? List them.

* **Files & Lines Examined:** All 24 test scripts in `server/test_*.mjs`.
* **Findings:**
  - **Short Chains Tested:**
    - `server/test_duplicate_manual_swipes.mjs:13`: `Admin > Merchant` (2 levels)
    - `server/test_edit_swipe_reversal.mjs:15`: `Admin > Area > Merchant` (3 levels)
    - `server/test_http_admin_reversals_and_approvals.mjs:25`: `Admin > Area > Merchant` (3 levels)
    - `server/test_step7_reversals.mjs:16`: `Admin > Area > Merchant` (3 levels)
    - `server/test_phase_d2_backend_endpoints.mjs:21`: `Admin > Dist > Merchant` (3 levels)
  - **Missing Test Shapes:**
    - **Zero tests** exist for `Admin > Super Distributor > Merchant`.
    - **Zero tests** exist for `Admin > Master > Merchant`.
    - **Zero tests** exist for `Admin > Master > District > Merchant`.
    - **Zero tests** exist for non-merchant swipers (every test in the entire test suite explicitly uses a user with `role: 'MERCHANT'`).

---

### Question 5: For Admin > SD > Merchant with SD charged 1.0% and merchant charged 1.5%, Rs 10,000 swipe: what exact amounts does the code produce?

* **File & Lines:** [`server/transaction_engine.js:131-187`](file:///c:/Users/dache/Desktop/ronava/server/transaction_engine.js#L131-L187)
* **Configuration:**
  - `TEST_ADM` (`ADMIN`): Base rate = 60 bps (0.60%)
  - `TEST_SD` (`SUPER_DISTRIBUTOR`): Rate = 100 bps (1.00%), `creator_id: 'TEST_ADM'`
  - `TEST_MID` (`MERCHANT`): Rate = 150 bps (1.50%), `creator_id: 'TEST_SD'`
  - Amount: **₹10,000.00** (1,000,000 paise), Pine Labs T+1
* **Exact Amounts Produced by the Code:**

| Participant | Role | Rate in Code | Calculation Performed | Amount (Paise) | Amount (Rupees) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Merchant (`TEST_MID`)** | `MERCHANT` | 150 bps | `1,000,000 - 15,000 fee` | 985,000 | **₹9,850.00** *(Net Credit)* |
| **Super Distributor (`TEST_SD`)** | `SUPER_DISTRIBUTOR` | 40 bps margin | Line 150: `current (100) - parent (60) = 40 bps` | 4,000 | **₹40.00** *(Commission)* |
| **Super Admin (`TEST_ADM`)** | `ADMIN` | 60 bps base + 50 bps remainder | Line 176: `15,000 fee - 4,000 child = 11,000 paise` | 11,000 | **₹110.00** *(Admin Profit)* |

* **Mathematical Invariant Check in Engine:**
  $$\text{Net Credit } (9,850) + \text{SD Cut } (40) + \text{Admin Remainder } (110) = \mathbf{10,000.00} \quad (\text{Passes invariant})$$

* **Root-Cause Analysis of the Discrepancy:**
  Under the business rule:
  $$\text{SD Cut} = (\text{Rate charged to child: } 1.50\%) - (\text{Rate charged to SD: } 1.00\%) = \mathbf{0.50\%} \quad (\mathbf{₹50.00})$$
  $$\text{Admin Cut} = \text{Rate charged to SD} = \mathbf{1.00\%} \quad (\mathbf{₹100.00})$$
  However, in `server/transaction_engine.js:150`:
  ```javascript
  // Line 150:
  marginBps = current.rate_bps - nextParent.rate_bps;
  ```
  Here `current.rate_bps` is SD's rate (100 bps) and `nextParent.rate_bps` is Admin's rate (60 bps), yielding **40 bps** (₹40.00). The omitted 50 bps difference between Merchant (150 bps) and SD (100 bps) falls into line 176 (`adminRemainderPaise`), giving Admin **₹110.00** instead of ₹100.00.
