# RONAV TECHNOLOGIES — COMPREHENSIVE PROJECT UNDERSTANDING (PHASE 0)

> **Document Type:** System Architecture, Data Model, and Business Logic Blueprint  
> **Author:** Senior Fintech Systems Engineer  
> **Status:** Phase 0 Completed (Understanding Only — Zero Code Modified)  
> **Target System:** Live Production Environment (AWS EC2 `13.201.4.145` / PostgreSQL `ronav_db`)  
> **Date:** October 15, 2026  

---

## EXECUTIVE SUMMARY & METHODOLOGY

This document represents a 100% code-verified architectural and operational breakdown of the **RONAV Technologies Platform**. Every technical assertion in this document is labeled as either:
* **[FACT]**: Directly verified by inspecting active code files, database schemas, and live PostgreSQL tables on AWS EC2.
* **[ASSUMPTION]**: Inferred from business naming conventions, UI text, or industry standard practices where explicit backend code is absent.

---

## SECTION A: TECH STACK AND INFRASTRUCTURE

### 1. Languages & Frameworks
* **[FACT] Frontend:** React 18.2.0 (`src/`), bundled using Vite 5.1.6 (`vite.config.js`). JavaScript ES Modules (`type: "module"` in `package.json`).
* **[FACT] Styling:** Vanilla CSS with custom utility styles (`src/index.css`), zero TailwindCSS runtime. Icons provided by `lucide-react` (v0.344.0).
* **[FACT] Backend:** Node.js (v20 / v22 LTS on Ubuntu). Custom native HTTP server built with Node's built-in `http.createServer` (`server/server.js`), **without Express.js**.
* **[FACT] Server API Handler:** Custom router and endpoint handler in `server/api.js` parsing JSON bodies via `parseJsonBody()` and responding with standard CORS headers (`sendJson()`).

### 2. Database & Data Access Layer
* **[FACT] Production Database:** PostgreSQL 16 running locally on the AWS EC2 instance (`localhost:5432/ronav_db`).
* **[FACT] Database Client:** Node `pg` (v8.23.0) connection pool (`Pool`) managed in `server/pg_db.js`.
* **[FACT] ORM Status:** **None.** All database queries are raw parameterized SQL statements executed via `query(sql, params)` and `withTransaction(callback)` in `server/pg_db.js`.
* **[FACT] Supabase Client Status:** While `@supabase/supabase-js` is listed in `package.json`, the active client in `src/services/supabase.js` is a **custom internal wrapper** (`TableQueryBuilder`). It routes legacy `.from('users').select('*')` calls via HTTP `fetchWithTimeout()` directly to the Node.js backend endpoints (`/api/*`), with direct database write operations explicitly locked out.
* **[FACT] SQLite Legacy File:** A SQLite database (`ronav.db`) and helper (`server/db.js`) exist in the project root, used as an earlier development prototype. The production server runs exclusively on PostgreSQL via `server/server.js` $\rightarrow$ `server/pg_db.js`.

### 3. Hosting & Deployment Setup
* **[FACT] Cloud Provider:** Amazon Web Services (AWS), Region: Mumbai (`ap-south-1`).
* **[FACT] Compute Instance:** AWS EC2 Ubuntu instance `i-0157cf2449281e925 (RONAV-Production-Server)` with Public IP `13.201.4.145`.
* **[FACT] Process Manager:** PM2 managing `ronav-api` (Process ID 0) running `server/server.js` with auto-restart on system reboot.
* **[FACT] Web Server / Reverse Proxy:** Nginx 1.24 configured on port 80 proxying all incoming traffic (`/`) to the internal Node.js backend on port 3000 (`/etc/nginx/sites-available/ronav`).
* **[FACT] Deployment Pipeline:** Automated 1-click script `npm run deploy` (`deploy_to_ec2.mjs`) triggers a Git push to GitHub (`https://github.com/dacnikhil21/ronava.git`, branch `main`), followed by an HTTP POST webhook to `http://13.201.4.145/api/system/webhook-deploy`, which automatically pulls `main`, compiles Vite production bundle (`npm run build`), and restarts PM2.

### 4. Third-Party Services Integration Audit
* **[FACT] Payment Gateways (Razorpay, Cashfree, PayU, Paytm, PhonePe PG):** **NOT INTEGRATED via API.** There are zero SDKs, API keys, or webhooks for payment aggregators. Card swipes on Pine Labs and Payswiff machines, as well as customer UPI QR payments, are recorded manually into the web interface by merchants from physical POS slips.
* **[FACT] Bank Payout APIs (Direct Bank IMPS/NEFT API):** **NOT INTEGRATED via API.** Bank withdrawals are processed via batch CSV/Excel export (`src/utils/bankExportUtils.js`). Admin downloads the batch file, uploads it manually into corporate banking portals (e.g. SBI CMS, HDFC SmartHub, ICICI Corporate), and later inputs the UTR back into the system to approve the payout.
* **[FACT] SMS / OTP Gateways (Twilio, MSG91, Fast2SMS):** **NOT INTEGRATED.** The UI displays text suggesting passwords are sent via SMS, but no network request to an SMS gateway exists. Passwords default to `Ronav@123` or are generated client-side and displayed in a modal.
* **[FACT] Object Storage & CDN:** AWS S3 (`ronav-media-storage-688927`) and AWS CloudFront CDN (`d1rqftl6szhydo.cloudfront.net`) configured in `server/s3.js` using `@aws-sdk/client-s3` for media/document uploads.

### 5. Environment Configuration
* **[FACT] Config File:** Local `.env` file containing:
  - `PORT=5000` (or `3000` on production)
  - `DATABASE_URL=postgres://ronav_admin:RonavSecure2026!Fintech@localhost:5432/ronav_db`
  - `PG_SSL=false`
  - AWS credentials (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_S3_BUCKET_NAME`, `AWS_CLOUDFRONT_DOMAIN`)

---

## SECTION B: FOLDER AND MODULE MAP

```
ronava/
├── .agents/                    # Master system rules and architectural guidelines (AGENTS.md)
├── server/                     # Backend Node.js service & Database layer
│   ├── server.js               # Entry point: HTTP server listening on port 3000/5000
│   ├── api.js                  # Master API router: all business logic, commissions & validation
│   ├── pg_db.js                # PostgreSQL connection pool, schema migrations & transaction engine
│   ├── db.js                   # Legacy SQLite prototype database connection (inactive in prod)
│   └── s3.js                   # AWS S3 client and pre-signed upload URL generator
├── src/                        # Frontend React Application
│   ├── App.jsx                 # Master controller: session guards, initial routing, modal orchestration
│   ├── main.jsx                # React DOM root entry point
│   ├── index.css               # Unified enterprise design system, animations & responsive styling
│   ├── components/             # React UI Components
│   │   ├── AdminDashboardPage.jsx    # Complete Admin Command Center (12,700+ lines): audits, queues, reports
│   │   ├── AdminLoginPage.jsx        # Admin authentication interface
│   │   ├── MerchantDashboardPage.jsx # Merchant & Partner Operational Workspace (9,700+ lines)
│   │   ├── MerchantLoginPage.jsx     # Merchant & Partner login screen
│   │   ├── Navbar.jsx                # Marketing public header & navigation
│   │   ├── Footer.jsx                # Marketing public footer & quick links
│   │   ├── Hero.jsx, TrustBar.jsx, ServicesSection.jsx, BusinessNetwork.jsx, HowItWorks.jsx,
│   │   │   VisionMission.jsx, Testimonials.jsx, FaqSection.jsx, ContactSection.jsx:
│   │   │                             # Public marketing homepage sections
│   │   ├── AboutPage.jsx, ServicesPage.jsx, ServicePosPage.jsx, ServiceAtmPage.jsx,
│   │   │   ServiceLoansPage.jsx, ServiceBbpsPage.jsx, ContactPage.jsx:
│   │   │                             # Informational landing pages & lead inquiry forms
│   │   ├── CommandPalette.jsx        # Keyboard shortcut command palette
│   │   ├── CopyToast.jsx, ErrorBoundary.jsx, SplashScreen.jsx, OfficeLocatorModal.jsx:
│   │   │                             # Utility UI helpers
│   ├── services/
│   │   ├── api.js              # Frontend client library: calls backend /api endpoints
│   │   ├── supabase.js         # In-house SQL table abstraction over backend fetch API
│   │   └── s3.js               # Browser-side direct upload helper using S3 pre-signed URLs
│   └── utils/
│       └── bankExportUtils.js  # CSV/Excel bulk payout generator for SBI, HDFC, ICICI, Axis
├── supabase/
│   └── schema.sql              # Master PostgreSQL DDL schema definition & seed data
├── dist/                       # Vite compiled production output served by Nginx
├── deploy_to_ec2.mjs           # Local deployment trigger script
└── package.json                # Project dependencies and script runner
```

---

## SECTION C: DATA MODEL

### 1. Database Architecture & Entity Relationships (PostgreSQL)

```mermaid
erDiagram
    USERS ||--o{ USERS : "creator_id (onboards)"
    USERS ||--o| MERCHANT_POS : "assigned (terminal_id JSON)"
    USERS ||--o| WALLETS : "owns virtual balance"
    USERS ||--o{ TRANSACTIONS : "records card swipe / QR"
    USERS ||--o{ WITHDRAWALS : "submits bank payout"
    USERS ||--o{ BENEFICIARIES : "registers bank accounts"
    USERS ||--o{ INQUIRIES : "submits loan/franchise lead"
    USERS ||--o{ MEDIA_FILES : "uploads KYC / documents"

    USERS {
        varchar(50) id PK "e.g. ADM001, MST1001, SD1001, DD1001, DIST1001, MID1001"
        varchar(255) name "Full name or Business Entity"
        varchar(20) mobile UK "10-digit primary phone"
        varchar(50) role "ADMIN | MASTER | SUPER_DISTRIBUTOR | DISTRICT_DISTRIBUTOR | DISTRIBUTOR | MERCHANT | RETAILER"
        varchar(50) creator_id FK "Parent upline who onboarded this user"
        varchar(255) password "Hashed or default Ronav@123"
        varchar(255) email "Contact email"
        varchar(20) pan "PAN number"
        varchar(20) aadhaar "12-digit Aadhaar"
        text address "Business address"
        numeric margin_rate "Base commission margin"
        numeric commission_rate_t1 "Default T+1 MDR %"
        numeric commission_rate_instant "Default Instant MDR %"
        varchar(50) status "ACTIVE | SUSPENDED"
        timestamptz created_at
        timestamptz updated_at
    }

    MERCHANT_POS {
        varchar(50) merchant_id PK,FK "References USERS.id"
        varchar(100) provider "Pine Labs | Payswiff | Company QR (UPI)"
        text terminal_id "JSON [PORTFOLIO] containing all 3 channels & rates"
        numeric commission_rate "Legacy primary MDR %"
        numeric commission_rate_t1 "Primary T+1 MDR %"
        numeric commission_rate_instant "Primary Instant MDR %"
        numeric admin_cut_rate "Admin minimum floor rate"
        numeric upline_override_rate "Upline network cut"
        varchar(255) vendor_entity "Rose Navaneetham Enterprises | RONAV Technologies | R.P. Technologies"
        varchar(50) device_plan "RENTAL | LIFETIME | DIRECT"
        numeric monthly_rent "Monthly machine rental (e.g. 499.00)"
        varchar(50) settlement_type "T1 | INSTANT"
        varchar(50) assigned_by "User ID who assigned the POS"
        timestamptz created_at
    }

    WALLETS {
        varchar(50) user_id PK,FK "References USERS.id"
        numeric available_balance "Current liquid withdrawable balance"
        numeric total_sales "All-time gross sales volume"
        numeric received_sales "Total net sales credited"
        numeric pending_balance "Funds locked in pending withdrawals"
        numeric withdrawn_amount "Total disbursed to bank accounts"
        timestamptz updated_at
    }

    TRANSACTIONS {
        varchar(64) id PK "TXN-PL-xxxx / TXN-SW-xxxx / TXN-QR-xxxx"
        varchar(50) merchant_id FK "References USERS.id"
        numeric amount "Gross swipe / payment amount"
        varchar(50) type "POS_SWIPE | QR_SCAN | BBPS_BILL | ADD_MONEY"
        varchar(100) provider "Pine Labs | Payswiff | Company QR (UPI)"
        varchar(100) ref_number UK "RRN / Slip Reference Number (Deduplicated)"
        varchar(50) customer_mobile "Customer phone"
        text notes "Snapshot: [CARD_SWIPE_ENTRY] {fee, net, commission_splits, admin_margin}"
        varchar(20) status "APPROVED | PENDING | REJECTED"
        text admin_remark "Verification remarks / Audit notes"
        timestamptz created_at
        timestamptz verified_at
    }

    WITHDRAWALS {
        varchar(64) id PK "WTH-xxxxxx"
        varchar(50) merchant_id FK "References USERS.id"
        numeric amount "Requested withdrawal amount"
        varchar(255) bank_name "Destination Bank"
        varchar(100) account_number "Bank Account Number"
        varchar(20) ifsc "Bank IFSC Code"
        varchar(50) status "PENDING | SUBMITTED_TO_BANK | APPROVED | REJECTED"
        varchar(50) channel "pinelabs | payswiff | qr"
        varchar(50) settlement_mode "INSTANT | T1"
        varchar(50) payout_purpose "REGULAR | COMMISSION"
        varchar(100) utr_number "Official Bank Disbursal UTR"
        varchar(100) rrn_number "Bank Reference"
        text admin_remark "Batch tag or rejection reason"
        timestamptz created_at
        timestamptz submitted_to_bank_at
        timestamptz verified_at
    }

    BENEFICIARIES {
        varchar(64) id PK "BEN-xxxx"
        varchar(50) merchant_id FK "References USERS.id"
        varchar(255) bank_name "Bank name"
        varchar(100) account_number "Account number"
        varchar(20) ifsc "IFSC code"
        varchar(255) holder_name "Account holder name"
        integer is_primary "1 if default, 0 otherwise"
        timestamptz created_at
    }

    INQUIRIES {
        varchar(64) id PK "LN-xxxx | FR-xxxx | SYS-CONFIG-xxxx"
        varchar(50) type "LOAN | FRANCHISE | SYS_CONFIG"
        varchar(255) name "Applicant name or Config Key"
        varchar(20) phone "Contact phone"
        varchar(50) status "New | Under Review | Approved | ACTIVE | INACTIVE"
        text remarks "JSON configuration or application notes"
        timestamptz created_at
    }

    MEDIA_FILES {
        varchar(64) id PK "MED-xxxx"
        varchar(50) merchant_id "User ID"
        varchar(255) file_name "Uploaded filename"
        text s3_key "AWS S3 object key"
        text s3_url "Direct S3 URL"
        text cdn_url "CloudFront CDN URL"
        varchar(100) mime_type "image/png, application/pdf"
        bigint file_size_bytes "Size in bytes"
        varchar(50) entity_type "KYC | POS_SLIP | GENERAL"
        varchar(50) status "ACTIVE"
        timestamptz created_at
    }
```

---

### 2. Specific Data Mechanics (Facts & Implementation Details)

#### A. How the Hierarchy is Stored
* **[FACT]** Stored in table `users` using column `creator_id` (`server/api.js` line 797).
* `ADM001` has `creator_id = NULL`.
* Every child record holds its direct parent's ID in `creator_id` (e.g. `MID1001` $\rightarrow$ `DIST1001` $\rightarrow$ `DD1001` $\rightarrow$ `SD1001` $\rightarrow$ `MST1001` $\rightarrow$ `ADM001`).
* Upward traversal is executed in `server/api.js` lines 1482–1490 using a `while` loop that walks `cur.creator_id` until it hits `ADM001`.

#### B. How Products Assigned to Each User are Stored
* **[FACT]** Stored in table `merchant_pos` inside the `terminal_id` column as a JSON portfolio string prefixed by `[PORTFOLIO]` (`server/api.js` line 830).
* Structure of `terminal_id`:
  ```json
  [PORTFOLIO]{
    "pine_labs": {
      "enabled": true,
      "terminal_id": "11111",
      "vendor": "Rose Navaneetham Enterprises",
      "plan": "RENTAL",
      "rent": "499",
      "rate_t1": "1.80",
      "rate_instant": "2.00"
    },
    "payswiff": {
      "enabled": true,
      "terminal_id": "11223",
      "vendor": "RONAV Technologies",
      "plan": "RENTAL",
      "rent": "499",
      "rate_t1": "1.90",
      "rate_instant": "2.10"
    },
    "qr": {
      "enabled": true,
      "vendor": "RONAV Technologies",
      "rate_instant": "1.90"
    }
  }
  ```
* If a channel is disabled, `"enabled": false` or omitted.

#### C. How Per-Product Rates / MDR are Stored
* **[FACT]** Stored inside the `[PORTFOLIO]` JSON object under keys:
  - `rate_t1`: Base MDR % for next-day settlement.
  - `rate_instant`: Base MDR % for immediate settlement.
* **[FACT] Fallback:** If `merchant_pos.terminal_id` does not contain `[PORTFOLIO]`, the resolver falls back to `merchant_pos.commission_rate_t1`, `merchant_pos.commission_rate_instant`, or `users.commission_rate_t1` (`server/api.js` lines 45–73 `resolveUserBuyRate()`).

#### D. How Wallets, Balances, Transactions, and Commissions are Stored
* **[FACT] Total Balance:** Table `wallets` stores master balance figures:
  - `available_balance`: Total unreserved funds.
  - `pending_balance`: Funds deducted from available balance, awaiting bank payout.
  - `withdrawn_amount`: Total successfully disbursed to banks.
* **[FACT] Channel Balances (Pine Labs vs Payswiff vs QR):** Calculated **authoritatively on the backend** in `server/api.js` (`calculateUserChannelBalances()`, lines 77–149). It aggregates approved transactions by provider (`Pine Labs`, `Payswiff`, `QR`) and subtracts non-rejected withdrawals by `channel`.
* **[FACT] Commissions Snapshot:** Stored in `transactions.notes` as a JSON string prefixed with `[CARD_SWIPE_ENTRY]`. It stores the merchant's net credited amount, company fee, admin residual margin, and an array `commission_splits` with every upline user ID, role, margin differential, and exact rupee amount credited (`server/api.js` lines 1524–1538).

#### E. How Machines / Devices and Ownership are Stored
* **[FACT]** Stored in `merchant_pos.terminal_id` JSON. The column `assigned_by` records which user ID assigned the terminal.
* **[FACT]** There is **no separate hardware inventory or device serial master table**. Each device serial string exists only as a field on the assigned user's POS record.

#### F. How the QR Code is Stored
* **[FACT]** Stored in table `inquiries` as a configuration record where `id = 'SYS-CONFIG-QR'` and `type = 'SYS_CONFIG'`. The base64 data URL string is stored in the `remarks` column (`server/api.js` line 2244).
* **[FACT] Frontend Cache:** Cached in the browser's `localStorage` under `ronav_company_qr_image` and `ronav_company_qr_name` (`src/services/api.js` lines 2253–2255).

---

## SECTION D: USER ROLES AND PERMISSIONS

### 1. The Role Hierarchy
1. **`ADMIN` (Super Admin - `ADM001`):** Apex platform controller.
2. **`MASTER` (Master Distributor - `MST` prefix):** Operates under Admin, manages Super Distributors.
3. **`SUPER_DISTRIBUTOR` (`SD` prefix):** Regional network head, manages District Distributors.
4. **`DISTRICT_DISTRIBUTOR` (`DD` prefix / `DIST_FRANCHISE`):** District hub, manages Area Distributors.
5. **`DISTRIBUTOR` (`DIST` prefix):** Area Distributor, onboards Retailers and Merchants.
6. **`MERCHANT` / `RETAILER` (`MID` prefix):** Terminal node. Swipes cards and collects customer payments. Cannot onboard downlines.

---

### 2. Permissions & Enforcement Matrix

| Feature / Action | Roles Allowed | Enforced Where? | Implementation Detail |
| :--- | :--- | :--- | :--- |
| **Login to Admin Portal** | `ADMIN` only | Frontend & Backend | `App.jsx` line 65; `server/api.js` line 1160 (rejects if role !== 'ADMIN') |
| **Login to Merchant Portal** | All non-admin roles (`MASTER`, `SD`, `DD`, `DIST`, `MID`) | Frontend & Backend | `MerchantLoginPage.jsx`; `server/api.js` line 1146 (rejects if role === 'ADMIN') |
| **Onboard Downline User** | `ADMIN`, `MASTER`, `SD`, `DD`, `DIST` (Everyone except `MERCHANT`/`RETAILER`) | **Frontend Only** | Enforced by hiding the Onboard tab in `MerchantDashboardPage.jsx` (`isRetail = role === 'MERCHANT' \|\| role === 'Retailer'`). Backend `/api/users/create` **does NOT** verify caller role. |
| **Record Card Swipe / QR** | `MERCHANT`, `RETAILER` (and distributors with assigned POS) | Frontend & Backend | UI in `MerchantDashboardPage.jsx`; Backend `/api/transactions/record` verifies user exists and has a configured buy rate > 0. |
| **Submit Withdrawal Request** | All roles (`MERCHANT`, `DIST`, `SD`, `MST`) | Frontend & Backend | Checked against `wallet.available_balance >= amount + 500` with PostgreSQL row lock in `server/api.js` lines 1850–1867. |
| **Approve / Disburse Withdrawal** | `ADMIN` only | **Frontend Only** | Button in `AdminDashboardPage.jsx`. Backend `/api/admin/verify-withdrawal` expects `withdrawal_id` and `action`, but does **not** validate an Admin session token. |
| **Reject / Clawback Transaction**| `ADMIN` only | **Frontend Only** | Button in `AdminDashboardPage.jsx`. Backend `/api/admin/verify-transaction` accepts `action: 'REJECT'` with zero caller token check. |
| **Configure Company QR Code** | `ADMIN` only | **Frontend Only** | `AdminDashboardPage.jsx` lines 450–473 calls `/api/settings/config`. |
| **Lock Commission Payouts** | `ADMIN` only | Frontend & Backend | Admin toggles `SYS-COMMISSION-PAYOUTS`. Backend checks inquiry status in `/api/withdrawals/request` line 1822. |

> **CRITICAL SECURITY FACT:**  
> Backend API endpoints in `server/api.js` do **NOT** inspect HTTP Bearer Tokens, JWT signatures, or session cookies. Authorization is enforced client-side via UI routing in `App.jsx` and `MerchantDashboardPage.jsx`. If a request is crafted directly to `/api/admin/verify-withdrawal` or `/api/admin/verify-transaction`, the backend executes it without verifying that the caller is an authenticated administrator.

---

## SECTION E: KEY FLOWS (STEP-BY-STEP)

### Flow 1: Onboarding a New User
* **Trigger:** Upline partner clicks `+ Onboard Partner / Merchant` in `MerchantDashboardPage.jsx` (or Admin in `AdminDashboardPage.jsx`).
* **Frontend Controller:** `handleCreateUserSubmit` in `MerchantDashboardPage.jsx` lines 1195–1295.
* **Validations:**
  - Full Name, 10-digit mobile, valid email with `@`, 12-digit Aadhaar, 10-character PAN (`ABCDE1234F`), business address.
  - Acceptance of Merchant Agreement.
  - Terminal ID mandatory if Pine Labs or Payswiff channel enabled.
  - **[FACT] Missing Validation:** The frontend does **NOT** validate that child rate $\ge$ parent rate.
* **Service Call:** `createDownstreamUser(userData)` in `src/services/api.js` line 676 $\rightarrow$ `POST /api/users/create`.
* **Backend Processing (`server/api.js` lines 724–900):**
  1. Determines ID prefix based on role (`MST`, `SD`, `DD`, `DIST`, `MID`).
  2. Queries PostgreSQL for collision-free sequential ID (`MID1001`, `MID1002`, etc.).
  3. Begins atomic transaction (`withTransaction`).
  4. Inserts row into `users` with initial password (`Ronav@<random4digits>`).
  5. Inserts zero-balance row into `wallets`.
  6. Inserts row into `merchant_pos` with `terminal_id = [PORTFOLIO]{...}` containing assigned rates and serials.
  7. Commits transaction and returns generated credentials.

---

### Flow 2: Machine Allocation & Transfer
* **Allocation:** Occurs during user creation or via `POST /api/pos/assign` (`server/api.js` lines 413–484). Updates `merchant_pos` with provider, terminal serial, and rates.
* **Transfer:** **[FACT] NOT IMPLEMENTED.** There is no machine transfer, return, or re-assignment workflow in the codebase. To move a machine, Admin must manually overwrite the terminal serial on the user's record.

---

### Flow 3: POS Swipe Transaction (Start to Finish)

```mermaid
sequenceDiagram
    autonumber
    actor Merchant as Merchant (MID1001)
    participant UI as Merchant Screen (MerchantDashboardPage.jsx)
    participant API as Backend Server (server/api.js)
    participant DB as PostgreSQL (ronav_db)
    actor Admin as Super Admin (ADM001)

    Merchant->>UI: Swipes customer card on Pine Labs POS machine
    Merchant->>UI: Enters Amount (₹10,000), Mobile, Name, Slip RRN into "Record Sale"
    UI->>API: POST /api/transactions/record {merchant_id, amount, rrn, type: 'POS_SWIPE'}
    
    API->>DB: Check duplicate RRN in transactions WHERE status != 'REJECTED'
    API->>API: resolveUserBuyRate(MID1001, pos, isInstant=false, 'pinelabs') -> 1.80%
    API->>API: Calculate compFee = (10000 * 1.80) / 100 = ₹180.00
    API->>API: Calculate netCreditAmount = 10000 - 180 = ₹9,820.00
    
    API->>DB: Walk uplineChain (DIST1001 -> DD1001 -> SD1001 -> MST1001)
    loop For each Upline Partner
        API->>API: Calculate marginDiff = (childRate - parentRate)
        API->>API: Calculate commissionEarned = (amount * marginDiff) / 100
    end
    API->>API: Calculate adminNetMargin = compFee - totalUplineCommissions
    
    rect rgb(240, 248, 255)
        Note over API,DB: ATOMIC DATABASE TRANSACTION (BEGIN ... COMMIT)
        API->>DB: UPDATE wallets SET available_balance += ₹9,820 (Merchant)
        API->>DB: UPDATE wallets SET available_balance += commission (Each Upline)
        API->>DB: UPDATE wallets SET available_balance += adminNetMargin (ADM001)
        API->>DB: INSERT INTO transactions (id, status='APPROVED', notes=JSON metadata)
    end
    
    API-->>UI: HTTP 201 {success: true, message: "Sale recorded! ₹9,820 credited"}
    UI->>UI: Display updated Pine Labs balance immediately
    Admin->>UI: Admin opens Swipes Audit Queue (AdminDashboardPage.jsx)
    Note over Admin,UI: Transaction is already APPROVED & credited. Admin audits for fraud.
    Admin->>API: (Optional) POST /api/admin/verify-transaction {action: 'REJECT'} if slip was fraudulent
    API->>DB: Atomic reversal: deducts merchant balance, uplines commissions & admin margin
```

---

### Flow 4: QR Payment (Start to Finish)
1. **Presentation:** Merchant selects the **QR** tab in `MerchantDashboardPage.jsx`. The screen displays the Company UPI QR code loaded from `inquiries` (`SYS-CONFIG-QR`).
2. **Customer Payment:** The counter customer opens PhonePe, GPay, or Paytm, scans the QR code, and transfers funds directly to RONAV's company bank account.
3. **Attribution:** Because the QR code is a static company-wide VPA, **the bank does not notify the app automatically**.
4. **Manual Entry:** Merchant views the customer's successful UPI payment screen on customer's phone, copies the 12-digit UPI Reference / UTR Number, and fills out the "Record Sale" form (`type = 'QR_SCAN'`).
5. **Credit:** Submits to `/api/transactions/record`. The backend calculates merchant net credit at `qr.rate_instant` (e.g. 1.90%), credits the merchant's wallet immediately, splits margins up the tree, and marks the transaction `APPROVED`.

---

### Flow 5: Wallet Credit, Withdrawal, T+1 vs Instant Settlement
1. **Credit:** Instantaneous upon recording the transaction in `/api/transactions/record`.
2. **Withdrawal Request:**
   - Merchant selects channel (Pine Labs, Payswiff, or QR) and clicks `Withdraw Funds` in `MerchantDashboardPage.jsx` lines 1775–1840.
   - Posts to `POST /api/withdrawals/request` (`server/api.js` line 1864).
   - Backend enforces the **₹500 Active Reserve Hold**: `maxWithdrawable = available_balance - 500`.
   - **Atomic Deduction:** Backend updates `wallets`:
     ```sql
     UPDATE wallets 
     SET available_balance = available_balance - $amount,
         pending_balance = pending_balance + $amount
     WHERE user_id = $merchant_id AND available_balance >= ($amount + 500);
     ```
   - Row inserted into `withdrawals` with `status = 'PENDING'`.
3. **Settlement Modes:**
   - **T+1 Settlement:** Standard batch mode. Admin filters requests in `AdminDashboardPage.jsx`, clicks "Export Bank Batch", uploads CSV to netbanking, and approves with UTR.
   - **Instant Settlement:** Merchant pays a higher MDR (e.g. +0.20% to +0.30% surcharge). Admin prioritizes instant disbursal via IMPS.
4. **Approval & Disbursal (`server/api.js` lines 2013–2085):**
   - Admin triggers `POST /api/admin/verify-withdrawal` with `action: 'APPROVE'` and bank UTR.
   - Backend updates `withdrawals`: `status = 'APPROVED'`, `utr_number = $utr`.
   - Backend updates `wallets`: `pending_balance -= amount`, `withdrawn_amount += amount`.

---

### Flow 6: Refund, Failure, and Chargeback Handling
* **Automated Webhooks / Customer Refunds:** **[FACT] NOT FOUND.** There are no customer refund gateways or automated chargeback webhooks.
* **Manual Admin Reversal (`server/api.js` lines 524–615):**
  - If a swipe was entered with an invalid RRN or a chargeback occurs, Admin clicks "Reject / Reverse" in `AdminDashboardPage.jsx`.
  - Backend executes atomic clawback:
    1. Reads original `commission_splits` and `admin_net_margin` from `transactions.notes`.
    2. Deducts `net_credited` from merchant's `available_balance`.
    3. Deducts respective earned commissions from each upline partner's `available_balance`.
    4. Deducts `admin_net_margin` from Admin's wallet (`ADM001`).
    5. Updates `transactions`: `status = 'REJECTED'`.

---

### Flow 7: Reports and Dashboards (What Each Role Sees)

#### A. Super Admin (`ADM001`) — `AdminDashboardPage.jsx`
* Executive KPI Cards: Total Ecosystem Volume, Today's Volume, Admin Net Profit, Total Merchants, Total Partners, Pending Withdrawals Count.
* Audit Queues:
  - **Card Swipes Audit Queue:** List of all merchant swipes across all machines with RRN, merchant MID, uplines split, company fee, and Admin net profit.
  - **Withdrawals Queue (Tabbed):** Pending Requests, Submitted to Bank, Completed Disbursals, Rejected/Failed. Includes bulk bank CSV export generator.
* Channel Portfolio Breakdown: Volume, transaction count, and fees for Pine Labs vs Payswiff vs QR.
* Full Hierarchy Roster: Table of all Master Distributors, Super Distributors, District Distributors, Area Distributors, and Merchants with active terminal serials, rental plans, and buy rates.

#### B. Distributors & Super Distributors (`MST`, `SD`, `DD`, `DIST`) — `MerchantDashboardPage.jsx`
* Virtual Wallet Card: Available commission balance, withdrawn amount, pending settlements.
* Channel Switcher Tabs: Pine Labs POS, Payswiff POS, and Company QR.
* Downline Network Hub:
  - Total downstream retailers count and direct merchants count.
  - Aggregated downline sales volume and channel-specific commission earned.
  - Partner roster with downline creator paths, assigned terminals, and commission override margins.
* Action Tools: Onboard Downline Partner/Merchant form, Commission Payout request form.

#### C. Merchants & Retailers (`MID`) — `MerchantDashboardPage.jsx`
* Cash Workspace: Available balance per machine, today's sales, pending settlements.
* Three Machine Tabs:
  - **Pine Labs:** Card swipe entry form, recent swipe ledger, Pine Labs balance.
  - **Payswiff:** Card swipe entry form, recent swipe ledger, Payswiff balance.
  - **Company QR:** QR display image, UPI collection entry form, instant balance.
* Withdrawal Engine: Registered bank accounts list (`beneficiaries`), "+ Add Bank Account" form, instant payout request form.

---

## SECTION F: COMMISSION LOGIC WALKTHROUGH

### 1. Code Walkthrough (`server/api.js` lines 1461–1520)

```javascript
// Step 1: Resolve Merchant's Rate from POS Portfolio
const merchantBuyRate = resolveUserBuyRate(merchant, pos, isInstant, activeChannelKey);

// Step 2: Calculate Total Fee charged to Merchant
const compFee = parseFloat(((numAmount * merchantBuyRate) / 100).toFixed(2));
const netCreditAmount = parseFloat(Math.max(0, numAmount - compFee).toFixed(2));

// Step 3: Walk upline parent chain (cur.creator_id) up to Admin
let currentLevelRate = merchantBuyRate;
let distributedUplineTotal = 0;
const commissionSplits = [];

for (const uplineUser of uplineChain) {
  const parentBuyRate = resolveUserBuyRate(uplineUser, uPos, isInstant, activeChannelKey);

  // Step 4: If parent has a lower rate than current level, difference is commission
  if (parentBuyRate > 0 && parentBuyRate < currentLevelRate) {
    const marginDiff = parseFloat((currentLevelRate - parentBuyRate).toFixed(4));
    const commissionEarned = parseFloat(((numAmount * marginDiff) / 100).toFixed(2));

    if (commissionEarned > 0) {
      distributedUplineTotal += commissionEarned;
      commissionSplits.push({
        user_id: uplineUser.id,
        user_name: uplineUser.name,
        role: uplineUser.role,
        amount: commissionEarned,
        margin_diff: marginDiff,
        buy_rate: parentBuyRate
      });
      // Move currentLevelRate to parent's rate for next tier calculation
      currentLevelRate = parentBuyRate;
    }
  }
}

// Step 5: Admin takes whatever is left over from compFee
const adminNetMargin = parseFloat(Math.max(0, compFee - distributedUplineTotal).toFixed(2));
```

---

### 2. Simulation vs Code Execution Comparison

#### Test Scenario
* **Swipe Amount:** ₹10,000.00
* **Rates in Hierarchy:**
  - Bank Cost: 0.40%
  - Admin to Master: 0.60%
  - Master to Super Dist: 0.80%
  - Super Dist to District: 1.00%
  - District to Area Dist: 1.20%
  - Area Dist to Merchant: 1.50%

#### Comparison Table: Expected Business Model vs Actual Code Output

| Participant | Expected Rate / Margin | Expected Payout | Code Math & Formula | Actual Code Output | Discrepancy & Reason |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Merchant** | Charges customer 1.50% | Net: **₹9,850.00** | `10000 - (10000 * 1.50%)` | **₹9,850.00** | **MATCH (100%)** |
| **Company Fee** | Total MDR deducted | Gross: **₹150.00** | `(10000 * 1.50) / 100` | **₹150.00** | **MATCH (100%)** |
| **Area Dist** | Margin: `1.50% - 1.20% = 0.30%` | **₹30.00** | `(10000 * 0.30) / 100` | **₹30.00** | **MATCH (100%)** |
| **District Dist**| Margin: `1.20% - 1.00% = 0.20%` | **₹20.00** | `(10000 * 0.20) / 100` | **₹20.00** | **MATCH (100%)** |
| **Super Dist** | Margin: `1.00% - 0.80% = 0.20%` | **₹20.00** | `(10000 * 0.20) / 100` | **₹20.00** | **MATCH (100%)** |
| **Master Dist**| Margin: `0.80% - 0.60% = 0.20%` | **₹20.00** | `(10000 * 0.20) / 100` | **₹20.00** | **MATCH (100%)** |
| **Bank Cost** | Direct settlement cost: 0.40%| **₹40.00** | *Not found in code* | **₹0.00** | **MISMATCH (-₹40.00):** Code does not track bank interchange cost. |
| **Admin** | Margin: `0.60% - 0.40% = 0.20%` | **₹20.00** | `compFee - totalUplines` (`150 - 90`) | **₹60.00** | **MISMATCH (+₹40.00):** Admin's wallet receives the entire ₹60 leftover because bank cost is unmodeled. |

> **Conclusion on Commission Logic:**  
> The commission split algorithm across the human distribution tiers (Merchant $\rightarrow$ Area $\rightarrow$ District $\rightarrow$ Super $\rightarrow$ Master) **matches the business model with mathematical perfection**.  
> However, **Bank Cost (0.40%) is not modeled in the code**. The backend treats the entire leftover fee (`₹60.00`) as Admin Net Profit (`adminNetMargin`), crediting all ₹60 directly into Admin's virtual wallet (`ADM001`).

---

## SECTION G: WHAT IS UNCLEAR OR UNDOCUMENTED

### 1. Discrepancies Between Business Model Description and Code
1. **Bank Interchange Cost:** As proven in Section F, the codebase has no field or table for "Bank Base Cost". Admin absorbs the gross residual fee rather than net profit after bank interchange.
2. **Rate Floor Validation during Onboarding:** The business model states *"A child's rate cannot be lower than the rate the parent received"*. In the code, neither `MerchantDashboardPage.jsx` nor `server/api.js` enforces this check upon form submission.
3. **Machine Transfers:** The business model describes *"Admin distributes machines downward"*. In the code, machines can only be assigned to a user upon creation or via `/api/pos/assign`. There is no feature allowing a distributor to hold a pool of unassigned devices and reassign them to child merchants.

### 2. Dead Code & Inactive Artifacts
1. **`merchants` Table in PostgreSQL:** An empty table (`public.merchants`) exists in PostgreSQL with 0 rows. Active merchants are stored strictly in `public.users` with `role = 'MERCHANT'`.
2. **`server/db.js` (SQLite):** An entire SQLite database engine (`ronav.db`) remains in the project root. It is unused by `server/server.js`.
3. **`media_files` Table:** Exists in schema with 0 rows on production. Most uploaded images (like the QR code) are converted to base64 strings and stored in `inquiries.remarks` rather than uploaded to S3.

### 3. Half-Built & Mock Features
1. **BBPS (Utility Bill Payment):** Pages `ServiceBbpsPage.jsx` and the BBPS tab in `MerchantDashboardPage.jsx` are informational UI shells. Transactions saved under type `BBPS_BILL` do not connect to the National Payments Corporation of India (NPCI) Bharat BillPay operating unit (BBPOU).
2. **Loans & ATM Franchise:** Forms on `ServiceLoansPage.jsx` and `ServiceAtmPage.jsx` insert lead inquiry records into `inquiries` table with `status = 'New'`. There is no loan underwriting, credit score check, or disbursal engine.
3. **Password Delivery:** The system claims to send passwords via SMS, but simply generates a client-side alert or modal.

---

## SECTION H: QUESTIONS FOR THE BUSINESS OWNER (ORDERED BY IMPORTANCE)

1. **Bank Interchange Cost Tracking (Critical):**  
   *Right now, Admin's wallet receives ₹60 instead of ₹20 because the 0.40% bank cost isn't deducted. Do you want the system to deduct a configurable Bank Base Cost (e.g. 0.40%) automatically before calculating Admin Net Profit?*

2. **Automated vs Manual Payout Disbursals (Critical):**  
   *Withdrawals currently generate CSV files for manual netbanking upload. Are you planning to integrate a real Payout API (such as ICICI Corporate Banking, Cashfree Payouts, or RazorpayX) for automated 1-click IMPS disbursals, or should we keep the current bank CSV batch export workflow?*

3. **POS Slip Verification Workflow (High):**  
   *When a merchant enters a card swipe, the system immediately marks it as `APPROVED` and adds money to their wallet before Admin audits the POS slip. Is this intended (trust-first), or should swipes remain in `PENDING` status until Admin verifies the RRN against the physical bank settlement report?*

4. **Strict Rate Hierarchy Validation (High):**  
   *Should we add strict blocking validation preventing an onboarder from entering a child rate lower than their own rate (e.g. throwing an error if a parent with 1.40% tries to assign 1.20% to a merchant)?*

5. **Device Inventory Management (Medium):**  
   *Do distributors need to physically hold a "stock" of machines (e.g. Super Distributor holds 50 Pine Labs terminals) and transfer them down to Area Distributors, or is entering the Terminal Serial directly on the merchant's profile sufficient?*

---

*Phase 0 Understanding completed. Written exclusively to `/audit/PROJECT_UNDERSTANDING.md`. Zero code was created, modified, or deleted.*
