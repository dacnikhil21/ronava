# RONAV TECHNOLOGIES — MASTER PRODUCT DESIGN & SYSTEM RULES

## Core Product Vision & Identity (Chapter 01)
- **Company**: RONAV Technologies (Established 2021)
- **Product Type**: Enterprise FinTech Merchant Financial Services Platform.
- **Scope**: Production-ready, enterprise-grade financial software. NOT a generic marketing site, NOT an e-commerce platform, NOT a retail B2C banking app.

## Integrated 3-Module Architecture
1. **Public Marketing Website**: Focus on credibility, trust, product capabilities, lead conversion, and onboarding. No financial transactions take place here.
2. **Merchant Portal**: Operational business workspace. Includes wallet management, BBPS, personal & business loans, ATM/CDM franchise operations, payment gateway, POS solutions, beneficiary management, and financial reporting.
3. **Admin Portal**: Ecosystem command & control center. Handles merchant & distributor network governance, transaction monitoring, service approvals, and audit reporting.

## Business Network & User Roles
- **Network**: Super Distributor $\rightarrow$ Distributor $\rightarrow$ Retailer $\rightarrow$ Merchant $\rightarrow$ Administrator.
- **Target Audience**: Business owners, retailers, merchants, financial partners, franchise applicants, administrators.

---

## Enterprise Design System & Responsive Strategy (Chapter 02)

### 1. Fundamental Design Principle
- **Design Software, Not Webpages**: Treat every screen as part of a unified operating system with identical spacing, typography, button variants, card elevations, border radii, icon styles, and interaction patterns.
- **Quality Benchmarks**: Polish, spacing, clarity, and precision on par with Stripe, Razorpay, Linear, Vercel, Notion, MS Fluent, and Apple HIG.

### 2. Mobile-First Architecture
- **Primary Device**: Mobile is the primary workspace for merchants. Every page, component, and flow MUST be designed mobile-first.
- **Desktop Expansion**: Desktop screens expand the layout naturally (e.g., sidebars, multi-column cards, split views) without altering core navigation logic or component design systems.

### 3. Core System Specs
- **Color Tokens**:
  - Primary: Professional Blue (`#0F52BA` / `#1E50A2` / `#0052CC`)
  - Secondary: Dark Navy (`#0A192F` / `#0B132B`)
  - Background: Pure White (`#FFFFFF`)
  - Surface: Light Gray (`#F8FAFC` / `#F1F5F9`)
  - Text: Dark Charcoal (`#0F172A` / `#1E293B`)
  - Semantic Status: Green (`#059669` / Success), Amber (`#D97706` / Warning), Red (`#DC2626` / Error)
- **Typography**: Modern sans-serif (e.g., Inter / Plus Jakarta Sans) with crisp hierarchy, high readability, strict line height, and controlled line length.
- **Spacing Scale**: Mathematical 4px/8px scale (`4px`, `8px`, `12px`, `16px`, `24px`, `32px`, `48px`, `64px`).
- **Cards & Surfaces**: Clean cards with subtle 1px border (`#E2E8F0`), smooth radius (`8px` to `16px`), subtle elevation shadow, and clear 4-level content hierarchy (Title $\rightarrow$ Key Info $\rightarrow$ Primary Action $\rightarrow$ Secondary Details).
- **Interactive Elements**: Minimum 44px–48px touch targets for mobile accessibility. Filled Primary, Outlined Secondary, Ghost Minimal, and Danger buttons.
- **Table Transformation**: On mobile, data tables automatically transform into clean, stacked information cards.

### 4. Golden UX Rule (3-Question Test)
Every single screen must instantly communicate:
1. **Where am I?** (Clear context & heading)
2. **What can I do here?** (Distinct actions & parameters)
3. **What should I do next?** (Prominent primary action)

---

## Functional Blueprint Analysis (Chapter 03)

### Preserved Workflows & Feature Inventory
1. **Public Marketing Website (`Homepageronav .png`)**:
   - Hero Branding: "SINCE 2021 | RONAV TECHNOLOGIES - Empowering Businesses. Enriching Lives."
   - Network Focus: Super Distributor | Distributor | Retailer
   - Service Grid: 1. Loans (Personal 50k-50L without payslips, Business 1L-1Cr via GST/ITR), 2. ATM & CDM Franchise (Low investment, high return), 3. BBPS (Bills, Electricity, Mobile/Postpaid), 4. Collecting Payments (PG & POS to utility bills).
   - Trust Bar: Trusted by Thousands | Secure & Reliable | High Returns Guaranteed
   - Contact Matrix: Phone (9966203053), WhatsApp (9966203053), Email (rosenavaneethamenterprises@gmail.com), Office Locations map/modal link.

2. **Merchant Login (`Merchant or vendor login .png`)**:
   - Authentication: User ID, Password (with eye toggle), Forgot Password, Login Action.
   - Onboarding Link: New Merchant? Sign Up.
   - Value Pillars: Secure & Reliable, 24x7 Support, Instant Settlements, High Returns & Growth.
   - Direct Merchant Help Desk contact options.

3. **Merchant Operational Workspace (`Merchant  dashboard.png`)**:
   - Header: Mobile Menu, RONAV Logo, Direct Support Call button, Notification Bell (with unread badge), Merchant Profile Switcher (Name & MID).
   - Virtual Wallet Card: Available Balance with privacy eye-toggle, `+ Add Money` CTA, sub-metrics (Total Sales, Received, Pending, Withdrawn).
   - Quick Operational Grid: Record Sale (Collect Payment), Withdraw (Send to Bank), Beneficiaries (Manage Accounts), Transaction History.
   - Ecosystem Services: BBPS, PG & POS, Loans, ATM & CDM, My Reports, Support.
   - Analytics Overview: Date filter, Today's Sales, Today's Received, Today's Pending, Total Txns with mini trendlines.
   - Transaction Ledger: Real-time list with Service Icons, TXN IDs, Status Pills (Success/Pending/Failed), Amount, Timestamp.
   - Beneficiary Hub: Managed Bank Cards with Account Number Mask, Name, Primary Indicator, `+ Add New Beneficiary` CTA.
   - Mobile Navigation: Home, Record Sale, **Scan & Pay (Center FAB)**, Transactions, Profile.

4. **Admin Login (`Admin login.png`)**:
   - Authentication: Admin ID, Password (toggle), Forgot Password, Secure Login.
   - Admin Value Pillars: Secure Access, Real-Time Monitoring, Efficient Management, Detailed Reports.

5. **Admin Ecosystem Command Center (`Admin dashboard .png`)**:
   - Executive Header: Super Admin Profile, System Alerts (Badge), Date Widget.
   - 7 Key Metric Cards: New Loan Applications (18), ATM & CDM Franchise Requests (12), BBPS Transactions (256), Payments via PG & POS (1,245), ATM Transactions (48), Total Merchants (2,538), Withdrawal Requests (23).
   - Application Management Table (Tabbed): Loan Applications, ATM/CDM Requests, BBPS Transactions, Payment Transactions. Columns: Applicant Name, Mobile, Loan Type, Amount, Status (New/Under Review/Approved), Date.
   - Transaction Volume Summary: Date filter, BBPS Volume (₹8.45L), PG & POS Volume (₹18.75L), ATM Volume (₹6.25L), Total Ecosystem Volume (₹33.45L).
   - Merchant Withdrawal Approvals Table: Merchant Name, Merchant ID, Amount, Bank Details (masked), Status (Pending/Approved/Rejected), Request Date, Actions.
   - Admin Mobile Bar: Dashboard, Loan Applications, Franchise Requests, Transactions, Merchants, Withdrawals, Reports.

---

## Enterprise Component Architecture & Visual Language (Chapter 04)

### 1. Architectural Mandate
- **No One-Off Screens**: Build every view exclusively using atomic, modular components from the design system.
- **Rhythm & Grid System**:
  - **Spacing**: Strict 8-point system (`8px`, `16px`, `24px`, `32px`, `48px`, `64px`).
  - **Grid**: Mobile (4-col), Tablet (8-col), Desktop (12-col). Breakpoints must reorganize content, never shrink text or stretch layouts.
- **Visual Feel**: Expensive without luxury excess, minimal without emptiness, institutional without dullness.

### 2. Component Token Specifications
- **Borders & Radii**: Soft, consistent border radius (`8px` for inputs/badges, `12px` for buttons/cards, `16px` for modals/surfaces) with 1px subtle borders (`#E2E8F0` / `#CBD5E1`).
- **Shadow Scale**: Soft elevation layers using HSL neutral shadows (`0 1px 3px rgba(15,23,42,0.08)`, `0 4px 12px rgba(15,23,42,0.06)`).
- **Typography Scale**: Strict 10-level hierarchy (Display, Page Title, Section Title, Card Title, Body, Caption, Helper, Table, Nav, Button). Controlled line height & contrast.
- **Buttons**: Primary (Filled High-Contrast), Secondary (Outlined), Tertiary (Ghost Minimal), Danger (Destructive). Full state support: Default, Hover, Focus, Pressed, Disabled, Loading (Skeleton/Spinner), Success, Error.
- **Form Inputs**: Touch targets $\ge 44\text{px}$, floating/elevated labels, validated borders, native dropdowns, date pickers, OTP fields, currency formatting, password visibility toggles.
- **Data Tables**: Clean row padding, sticky headers, multi-select, pagination, inline sorting, and auto-conversion to cards on mobile viewports.
- **Stat Cards & Widgets**: Metric value, title, stroke icon, growth pill (percentage/trendline), contextual action link.
- **Feedback & States**: Skeleton screens (no spinners for full-page loads), actionable error screens, informative non-intrusive notifications, clear empty state guidance.
- **Iconography**: Single icon set (e.g., Lucide / Feather), consistent 1.75px–2px stroke, minimal style mixing.

---

## Homepage Experience Strategy (Chapter 05)

### 1. Sequential Psychological Page Flow
1. **Hero Section**: Balanced, headline, sub-headline, Primary CTA ("Become a Merchant"), Secondary CTA ("Explore Services"), fintech visual hero badge ("SINCE 2021").
2. **Trust Indicators Bar**: Thousands of active merchants, secure platform compliance, instant processing, high reliability.
3. **Business Solutions Grid**: Solutions targeted for Merchants, Retailers, Distributors, and Franchise Seekers.
4. **Services Showcase**: Interactive cards (Personal/Business Loans 50k-1Cr, ATM/CDM Franchise, BBPS Bill Payments, Payment Gateway & POS).
5. **Business Network Architecture**: Visual storytelling of Super Distributor $\rightarrow$ Distributor $\rightarrow$ Retailer $\rightarrow$ Merchant ecosystem.
6. **Why Choose RONAV**: Instant settlements, 24/7 support, institutional reliability, high growth margins.
7. **How It Works**: Numbered 4-step onboarding/operational flow.
8. **Live Statistics Engine**: Count-up key stats (Merchants Onboarded, Daily Volume, Loan Disbursals, Franchise Outlets).
9. **Vision & Mission**: Premium corporate commitment layout.
10. **Authentic Testimonials**: Real merchant/distributor success stories.
11. **FAQ Accordion**: Structured, scannable Q&A for loans, BBPS, and franchises.
12. **Contact Matrix & Map**: Direct hotline (9966203053), WhatsApp, Email (rosenavaneethamenterprises@gmail.com), Office locator modal/link, Quick Contact Form.
13. **Enterprise Footer**: Comprehensive nav, legal disclaimer, direct Merchant Login & Admin Login gateways.

---

## Product Architecture & Screen Inventory (Chapter 06)

### Complete Screen Inventory across 3 Modules

#### 1. Public Marketing Website
- **Homepage** (13-section strategy)
- **About Us** (Company profile, leadership, since 2021 heritage)
- **Services Overview** (Loans, BBPS, POS/PG, ATM/CDM Franchise)
- **Individual Service Details** (Personal/Business Loan detail, ATM Franchise detail, BBPS detail)
- **Vision & Mission** (Financial inclusion & enterprise empowerment)
- **Contact & Office Locator** (Hyderbad/Regional offices map, direct support)
- **FAQ Knowledge Base** (Scannable category questions)
- **Merchant Login** (Authentication, onboarding CTA)
- **Admin Login** (Secure admin authentication)

#### 2. Merchant Operational Portal
- **Dashboard** (Virtual wallet, metrics, recent txns, quick grid, beneficiary quick view)
- **Wallet & Funds** (Available balance, add money, withdrawal history)
- **Record Transaction** (Collect payment, manual sale entry)
- **Transaction History / Ledger** (Filters, TXN details, export)
- **Withdraw Request** (Bank account select, payout request)
- **Beneficiary Hub** (Managed bank cards, add beneficiary form)
- **BBPS Services** (Electricity, mobile, post-paid, credit card bill pay)
- **Loan Applications** (Apply 50k-50L personal, 1L-1Cr business)
- **ATM & CDM Franchise** (Request outlet setup, franchise terms)
- **PG & POS Solutions** (QR code, POS machine request, gateway integration)
- **Notifications & Support** (Real-time updates, help desk 9966203053)
- **Merchant Settings & Profile** (MID details, KYC status, bank defaults)

#### 3. Admin Ecosystem Portal
- **Executive Dashboard** (7 KPI cards, applications table, volume summary, withdrawal approvals)
- **Merchant Management** (Merchant roster, MID lookup, status toggles)
- **Distributor Network** (Super Distributors, Distributors, Retailer hierarchy)
- **Loan Application Requests** (Review personal/business loans, status update)
- **Franchise Outlet Requests** (Review ATM/CDM franchise applications)
- **Withdrawal Approvals** (Pending merchant bank payout approvals)
- **Transactions & Ledger** (Ecosystem-wide transaction audit log)
- **Reports & Analytics** (Volume charts, commission reports, growth metrics)
- **System Settings & Roles** (Admin access levels, security controls)

### Common Atomic Component Inventory
- Navigation: Topbar, Collapsible Sidebar, Mobile Bottom Bar, Floating Action Button (Scan & Pay FAB)
- Cards & Containers: Wallet Card, Metric Stat Widget, Service Action Card, Bank Card Surface
- Form & Control Engines: Text/Currency Input, Password Eye Toggle, Native Select Dropdown, Date Range Filter, Search Bar, Tab Group
- Feedback & Data Display: Data Table with Auto-Card Transformation, Status Badge Pills, Skeleton Loaders, Empty States, Action Dialog Modals
