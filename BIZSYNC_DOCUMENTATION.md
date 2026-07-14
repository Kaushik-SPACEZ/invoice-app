# BizSync — Complete Project Documentation

**Version:** 2.0  
**Live URL:** https://invoice.kynetropo.com  
**GitHub:** https://github.com/Kaushik-SPACEZ/invoice-app  
**Stack:** Laravel 11 (PHP) · React 18 · TypeScript · MySQL · Groq AI · Gemini AI

---

## Table of Contents

1. [What is BizSync](#1-what-is-bizsync)
2. [Login & Users](#2-login--users)
3. [Dashboard](#3-dashboard)
4. [Invoice Upload & AI Extraction](#4-invoice-upload--ai-extraction)
5. [Invoice Review & Approval](#5-invoice-review--approval)
6. [Approval Cascade — What Happens Automatically](#6-approval-cascade--what-happens-automatically)
7. [Product Mappings](#7-product-mappings)
8. [Inventory](#8-inventory)
9. [Purchases](#9-purchases)
10. [Sales](#10-sales)
11. [Customers](#11-customers)
12. [Sales Returns](#12-sales-returns)
13. [Damaged Goods](#13-damaged-goods)
14. [Outstanding & Credit](#14-outstanding--credit)
15. [Marketplace Analytics](#15-marketplace-analytics)
16. [Commission Invoices](#16-commission-invoices)
17. [Bank Statement](#17-bank-statement)
18. [GST Filing](#18-gst-filing)
19. [Accounting](#19-accounting)
20. [Reports](#20-reports)
21. [Notifications](#21-notifications)
22. [Audit Log](#22-audit-log)
23. [User Management](#23-user-management)
24. [Settings](#24-settings)
25. [Navigation Structure](#25-navigation-structure)
26. [API Reference](#26-api-reference)
27. [AI Extraction Logic](#27-ai-extraction-logic)
28. [Data Isolation & Security](#28-data-isolation--security)
29. [Deployment](#29-deployment)

---

## 1. What is BizSync

BizSync is a cloud-based Invoice ERP built for Indian marketplace sellers (Amazon, Flipkart, Meesho, etc.). It eliminates manual data entry by using AI to read invoice photos and PDFs, then automatically updating inventory, sales, GST records, customer data, and accounting in one click.

**Core value:** Upload a photo of any invoice → AI extracts all data → one click Approve → 7 modules update simultaneously.

---

## 2. Login & Users

**URL:** https://invoice.kynetropo.com/login

| User | Email | Password | Role |
|---|---|---|---|
| Raj Kumar | raj@rkelectronics.com | password123 | Owner |
| Kaushik K | kaushik@kynetropo.com | Kynetropo@2024 | Owner |

- JWT authentication, 60-minute token with refresh
- Each user's data is completely isolated — no user can see another's invoices, products, or customers
- Staff accounts can be created under User Management with per-module permissions

---

## 3. Dashboard

**Route:** `/dashboard`

Shows real-time business overview:

| Card | What it shows |
|---|---|
| Today's Sales | Revenue for current day vs yesterday |
| Monthly Revenue | Current month total vs last month |
| GST Payable | Net GST due this month |
| Net Profit | Revenue minus expenses |

Also shows:
- **Inventory Status** — Total SKUs, Low Stock count, Out of Stock count
- **Low Stock Alerts** — Products below minimum level threshold
- **Recent Uploads** — Last 5 invoices with status badges
- **Revenue & Profit Trend** — Area chart, monthly breakdown
- **Sales by Marketplace** — Bar chart per platform
- **Recent Activity** — Timeline of last 6 invoice events

---

## 4. Invoice Upload & AI Extraction

**Route:** `/invoices/upload`

### How to upload

1. Select **Platform** — chip buttons: Amazon, Flipkart, Meesho + "More" for others
2. Toggle **Credit Sale** if customer pays later (sets credit period)
3. Drop invoice file(s) or click to browse
4. Click **Process Invoice(s)**

### Supported formats
- PDF, JPG, JPEG, PNG — up to 10 MB each
- Multiple files can be queued and processed together

### Multi-file behaviour
- 1 file → navigates to that invoice's processing page
- 2+ files → all uploaded simultaneously, then goes to Invoices list

### AI Extraction (3-layer engine)

**Layer 1 — Groq Vision (llama-4-scout-17b)**
- Reads invoice image with `detail: high`
- Extracts all fields with explicit rules:
  - Every line item extracted (no skipping)
  - Qty verified: `Qty × Unit Price × (1 + Tax%) ≈ Line Total`
  - "Pack of 3" in product name ≠ quantity
  - SKUs extracted from brackets like `(B0GN2XVLHS)`

**Layer 2 — JSON Repair**
- If Groq truncates response (long invoices), repairs JSON
- Line items put first in response so they're never cut off
- Strips incomplete trailing key/value before closing braces

**Layer 3 — Gemini Fallback**
- If Groq fails entirely, Gemini 2.0 Flash processes the image
- 4096 max tokens, 60s timeout

### Validation Engine (3-pass)

**Pass 1 — Per-line check:**
- If `taxable_value ÷ unit_price` = whole number ≠ qty → correct qty
- Example: taxable=355.04, unit=177.97 → 355.04/177.97 = 2 → qty=2

**Pass 2 — Single-item fix:**
- If only 1 line item and total doesn't match → back-calculate taxable from invoice total

**Pass 3 — Grand total reconciliation:**
- If sum of line items < invoice total → find best candidate item and add missing units
- Scoring: prefers item where `taxable_value ÷ unit_price` already implies higher qty
- Tolerance: ±₹8 for rounding differences

### Processing Stages
```
pending → processing (OCR extraction 20%) → llm_extraction (50%) → validation (70%) → saving_items (85%) → review
```

---

## 5. Invoice Review & Approval

**Route:** `/invoices/:id/review`

### Left panel
- Original invoice file displayed (image or PDF)
- MarketplaceBadge shows platform

### Right panel — Extracted Data
Shows all extracted fields:
- Invoice Number, Invoice Date
- Vendor Name, Vendor GSTIN
- Customer Name, Customer GSTIN
- **Line Items table** — Product, Qty (clickable to edit), Price, Tax%, Total
- Totals — Subtotal, Tax, Grand Total

### Editing
- Any text field can be edited inline (click the pencil icon)
- **Qty is clickable** — click any quantity number to type the correct value
- Total mismatch banner appears in red if line items sum ≠ invoice total with "click Qty to fix"

### Buttons
- **Reject** — marks invoice rejected, nothing updates
- **Approve & Save** — triggers the full cascade (see Section 6)

### Mapping Popup (automatic)
Before approving, the system checks all product names against saved mappings:
- If ALL mapped → approves directly, no popup
- If ANY unmapped → shows mapping modal first

**Closing the popup** stays on the review page (does NOT navigate away)

---

## 6. Approval Cascade — What Happens Automatically

When you click **Approve & Save**, all 7 modules update in a single database transaction:

```
Invoice Approved
    ├── 1. Inventory updated (stock reduced using mappings)
    ├── 2. Customer record created/updated
    ├── 3. Sales Order created
    ├── 4. GST Record created (CGST/SGST or IGST)
    ├── 5. Journal Entries created
    ├── 6. Expenses extracted (commission, shipping)
    └── 7. Notifications sent (low stock alerts etc.)
```

### Inventory deduction logic (3-tier lookup)

**Tier 1 — Product name mapping (most reliable)**
```
"15 ROD MULTICOLOR ABACUS KIT - Free Size" 
    → saved mapping → SKU 25352 × 1
→ deduct 1 from product 25352
```

**Tier 2 — SKU exact match**
```
Line item SKU = "25352"
    → find product where sku = "25352"
→ deduct qty
```

**Tier 3 — No match**
```
→ create notification: "Product not found, please create mapping"
→ no stock change (safer than guessing)
```
*Note: HSN code fallback was removed to prevent wrong deductions when multiple products share the same HSN.*

### Idempotent approval
Re-approving an already-approved invoice returns success immediately without re-running the cascade.

---

## 7. Product Mappings

**Route:** `/mappings` (also in Invoices section of sidebar)

### Purpose
Maps invoice product names to inventory SKUs. Critical because:
- Same product listed differently per platform
- Bundle/combo products map to multiple SKUs
- Amazon appends ASINs, Flipkart adds extra text

### Example mappings

| Invoice Product Name | Maps To |
|---|---|
| `15 ROD MULTICOLOR ABACUS KIT - Free Size` | `25352 × 1` |
| `Sae Fashions 15 ROD MULTICOLOR ABACUS KIT WITH POUCH` | `25352 × 1` + `POUCH-001 × 1` |
| `SAE Elegantly Embroidered DB Heart with Letter-V...` | `KHF-V × 1` |

### Normalization
Mapping lookup normalizes names before comparing:
- Lowercase
- Collapse extra spaces
- **Remove all quote characters** (`"`, `'`, `"`, `"`) — so `Letter-"P"` matches `Letter-P`

### Combo/Bundle support
One invoice line item → multiple inventory SKUs deducted:
- "COMBO PACK × 1" → SKU-A × 1 + SKU-B × 1 + SKU-C × 1
- Mapping quantity = multiplier per invoice unit

### How to create
- **Automatic:** popup appears when approving invoice with unmapped products
- **Manual:** Mappings page → not available yet (edit only)

### Returns use mappings too
`addFromReturn` uses the same mapping lookup, so returning "FASHION KIT" correctly restores both Abacus Kit AND Pouch stock.

---

## 8. Inventory

**Route:** `/inventory`

### Summary cards
- Total SKUs, Low Stock count, Out of Stock count

### Product fields
| Field | Description |
|---|---|
| SKU | Unique identifier (cannot change after creation) |
| Name | Product name |
| Category | Dynamic — add new categories inline |
| HSN Code | For GST classification |
| Unit | pcs, kg, etc. |
| Cost Price | Purchase price |
| Selling Price | Sale price |
| Current Stock | Live count, updated on every approval |
| Min Stock Level | Triggers low stock alert |
| Input GST Rate/Amount | ITC claimable amount |
| damaged_stock | Units in damaged condition (separate from active stock) |

### Category filter
- Chips at top of table filter by category
- "Education", "Clothing" etc. added dynamically when creating products
- Stored in `localStorage` per user

### Delete product
- Custom confirmation modal (NOT browser `window.confirm`)
- Cascade: removes from product_mapping_items, nullifies FK refs in inventory_transactions and invoice_line_items

### Stock bar
- Green = healthy (> min level)
- Amber = low stock (≤ min level)
- Red = out of stock (= 0)

---

## 9. Purchases

**Route:** `/purchases`

Tracks all stock purchases from vendors. Three tabs:

### Tab 1 — All Purchases
Lists all invoices with `invoice_type=purchase`:
- Date, Invoice #, Vendor, Total, Input GST, Status
- "Approve" button for pending invoices (adds stock + records ITC)

### Tab 2 — Upload Invoice
- Select Vendor Type (Manufacturer, Distributor, etc.)
- Upload vendor's invoice → AI extracts everything
- After extraction → Review → Approve → stock added to inventory

### Tab 3 — Manual Entry
Fields:
- Vendor Name, GSTIN, Invoice #, Date, Vendor Type
- Total Amount — **GST amount auto-calculates** when you change Total or Rate
  - Formula: `GST = Total × Rate ÷ (100 + Rate)`
- Input GST Rate (0/5/12/18/28%) + GST Amount
- Credit Purchase toggle → creates Outstanding Payable

### Backend
Purchases use the standard `/invoices` endpoint with `invoice_type=purchase` filter.
Manual entry uses `POST /invoices/manual`.

---

## 10. Sales

**Route:** `/sales`

All sales orders are **auto-created** on invoice approval — no manual entry needed.

### Period selector
Tabs: Today / This Week / This Month / This Year

### KPI Cards
- Revenue, Order Count, Average Order Value, Returns Count

### Marketplace Breakdown
Revenue and order count per platform

### Sales Orders Table
Columns: Date, Order #, Marketplace, Revenue, Tax, Net Revenue, Status

---

## 11. Customers

**Route:** `/customers`

Auto-populated from approved invoices. Clickable cards open a side panel.

### Customer fields
- Name, Email, Phone, GSTIN, Address
- Customer Type: B2B (has GSTIN) or B2C (retail)
- Total Orders, Lifetime Revenue

### Filters
- Search by name, GSTIN, city
- Filter by B2B / B2C

### Customer purchases
Click customer → see all purchase history with dates and amounts

---

## 12. Sales Returns

**Route:** `/returns` (in Invoices section)

Two tabs:

### Tab 1 — Upload Return
**Fully automatic flow:**
1. Select Return Type: **Regular Return** or **Damaged Goods**
2. Select Marketplace
3. Drop return invoice photo/PDF
4. Click **Process Return Invoice**

What happens:
- AI extracts product name and quantity
- Invoice auto-approved (no manual review needed)
- **Regular Return:** `current_stock += qty` (product back in active inventory)
- **Damaged Return:** `damaged_stock += qty` (goes to Damaged Goods page)

Uses product name mappings — so "FASHION KIT" return correctly restores both Abacus Kit AND Pouch.

### Tab 2 — Returns History
Table of all return invoices with:
- Date, Invoice #, Marketplace, Type badge (Regular/Damaged), Amount, Status
- "Review →" button for any stuck in review state

---

## 13. Damaged Goods

**Route:** `/damaged-goods` (in Business section)

### Summary
- Total Damaged Items (count)
- Total Value at Cost (₹)

### List
Shows all products where `damaged_stock > 0`:
- SKU, Product Name, Category, Damaged Qty, Cost Price, Total Value
- **Write Off** button — removes from damaged stock, records loss in accounting

### Write Off flow
1. Click "Write Off" → custom confirmation modal
2. Confirm → `damaged_stock = 0`, loss recorded in audit log
3. List updates automatically

---

## 14. Outstanding & Credit

**Route:** `/outstanding` (in Business section)

Tracks credit sales and credit purchases.

### Three tabs

**Summary tab**
- Total Receivable (credit sales — customers owe you)
- Total Payable (credit purchases — you owe vendors)
- Overdue amount (90+ days)
- 5-bucket aging: Current / 1-30 / 31-60 / 61-90 / 90+ days

**Receivables tab**
- All credit sales with: Customer, Invoice #, Date, Due Date, Amount, Paid, Balance, Aging status
- "Record Payment" button → enter amount, date, notes → balance reduces

**Payables tab**
- All credit purchases with vendor details
- Same payment recording flow

### How credit entries are created
- **Credit Sale:** Upload invoice → Credit Sale toggle ON → AI extraction → Approve → outstanding_entry created
- **Credit Purchase:** Purchase manual entry → Credit Purchase toggle ON → Save → outstanding_entry created

---

## 15. Marketplace Analytics

**Route:** `/marketplace` (in Business section)

### Platform tabs
All / Amazon / Flipkart / Meesho

### KPI Cards
Total Revenue, Commission Paid, Total Returns, Active Platforms

### Platform cards
Per platform: Revenue, Order count, Commission, Returns, Top Product

### Revenue Comparison Chart
Bar chart comparing revenue across platforms

### Settlement Tracking
Table for reconciling marketplace settlements (requires manual data entry or bank statement upload)

---

## 16. Commission Invoices

**Route:** `/commission-invoices` (in Invoices section)

Track all marketplace commission statements and deductions.

### Three tabs

**All Records**
Table: Date, Invoice #, Platform, Gross Sales, Commission, TDS, Net Settlement

**Upload**
- Select Platform (Amazon, Flipkart, Meesho, Myntra, Snapdeal, AJIO, JioMart)
- Upload commission statement PDF
- AI extracts commission details

**Manual Entry**
Fields:
- Platform (chip selector — same options as invoice upload)
- Commission Invoice Number, Date, Period From/To
- Gross Sales, Commission Rate %, Commission Amount
- TDS Rate (0% / 1% / 2%), TDS Amount
- Other Deductions, Net Settlement, Notes

### Backend
All commission invoices stored as standard invoices with `invoice_type=commission`.

---

## 17. Bank Statement

**Route:** `/bank-statements` (in Finance section)

### Upload tab
- Statement Type: Sales/Receivables, Purchase/Payables, All Transactions
- Supported: PDF, CSV, XLS, XLSX (up to 20MB)

### Reconciliation tab
After upload, transactions are cross-verified against sales orders and vendor payments:
- Filter chips: All / Matched / Partial / Unmatched
- Table: Date, Description, Amount (credit/debit), Match Status, Reference
- "Mark Matched" for manual matching
- "Run Reconciliation" button re-processes all matching

---

## 18. GST Filing

**Route:** `/gst` (in Finance section)

### Financial Year selector
FY 2023-24 through FY 2026-27

### Six tabs

| Tab | Content |
|---|---|
| Overview | Output Tax, Input Tax Credit, Net Payable + Quarterly summary |
| Monthly Ledger | Month-by-month: Taxable, CGST, SGST, IGST, Total |
| B2B | Transactions where customer has GSTIN |
| B2C | Retail sales without GSTIN |
| HSN Summary | HSN-code-wise consolidated report |
| Download Reports | GSTR-1, GSTR-3B, HSN Summary — Excel download |

### Auto-created GST records
Every approved invoice creates a `gst_records` row with:
- CGST/SGST for intra-state, IGST for inter-state
- Supply type (B2B or B2C) based on customer GSTIN presence
- Financial year, quarter, month — auto-calculated

---

## 19. Accounting

**Route:** `/accounting` (in Finance section)

Date range filter at top (default: last 3 months)

### Three tabs

**Journal Entries**
All accounting entries auto-created on invoice approval:
- Revenue recognition: Debit Accounts Receivable, Credit Sales Revenue
- Tax liability: Debit Tax Receivable, Credit GST Payable
- Commission expense (if applicable)

Filterable by date range and account name.

**Profit & Loss**
- Revenue
- Cost of Goods Sold (estimate: 65% of revenue until COGS tracking added)
- Gross Profit
- Shipping, Commission, Other Expenses
- GST Payable
- **Net Profit**

**Balance Sheet**
- Assets: Accounts Receivable, Inventory, Cash & Bank
- Liabilities: GST Payable, Accounts Payable

---

## 20. Reports

**Route:** `/reports` (in Finance section)

### Field-selection download
Each report type has an expandable field chooser — select only columns needed.

### Report types

| Report | Key Fields |
|---|---|
| Sales | Date, Order #, Marketplace, Revenue, Tax, Net Revenue, Commission |
| Purchase | Date, Invoice #, Vendor, Total, Input GST, Vendor GSTIN |
| GST | Period, Output GST, Input GST, Net Payable, CGST, SGST, IGST |
| Profit | Period, Revenue, COGS, Gross Profit, Expenses, Net Profit |
| Inventory | SKU, Name, Category, Stock, Cost, Sell Price, Value |
| Marketplace | Platform, Revenue, Orders, Commission, Returns |
| Customer | Name, Orders, Revenue, Last Order, GSTIN |
| Expense | Date, Category, Amount, Platform |

### Download formats
- **Excel (.xls)** — SpreadsheetML format, opens natively in Microsoft Excel
- **PDF** — opens HTML report in new tab → click "🖨️ Print / Save as PDF"

---

## 21. Notifications

**Route:** `/notifications` (in System section)

### Notification types
- `low_stock` — product below minimum level
- `inventory_warning` — out of stock, unknown product on return
- `unmapped_product` — invoice product not found in inventory
- `inventory_update` — return processed, stock restored
- `duplicate_invoice` — same invoice number detected

### Features
- Grouped by Today / Yesterday / Earlier
- Click to mark single as read
- "Mark all read" button
- Bell icon in navbar shows unread count badge

---

## 22. Audit Log

**Route:** `/audit-log` (in System section)

Complete history of all actions:

| Action | Triggered by |
|---|---|
| invoice_approved | Clicking Approve |
| invoice_rejected | Clicking Reject |
| damaged_stock_write_off | Writing off damaged goods |
| product_updated | Editing a product |
| payment_recorded | Recording outstanding payment |

Shows: Timestamp, User, Action badge, Entity type + ID, Details JSON, IP Address

Paginated (30 per page), filterable by date range, action type, entity type.

---

## 23. User Management

**Route:** `/users` (in System section)

### Roles

| Role | Access |
|---|---|
| Admin | Full access to everything |
| Manager | Invoices, Inventory, Purchases, Sales, Reports, Customers, Commission |
| Accountant | Invoices, GST, Reports, Bank Statement, Commission |
| Staff | Invoices, Inventory, Sales only |
| Viewer | Read-only: Invoices, Sales, Reports |

### Per-module permissions
12 checkboxes — each module can be individually toggled regardless of role preset.

### Create staff
- Name, Email, Role, Password
- Permissions auto-fill based on role but can be customized
- Staff user can log in at the same URL with their email/password

---

## 24. Settings

**Route:** `/settings` (in System section)

### Profile
- Name, Phone (email cannot be changed)

### Business Information
- Business Name
- GSTIN (15-character, format-validated)

### Gmail Auto-fetch
- Connect Gmail via OAuth2
- Select which marketplace senders to monitor (Amazon, Flipkart, Meesho, etc.)
- System scans inbox every 1-2 minutes for invoice emails
- Attachments auto-extracted and queued for review

### Change Password
- Current + New + Confirm (minimum 8 characters)

---

## 25. Navigation Structure

```
BizSync
├── Dashboard

├── INVOICES
│   ├── Upload Invoice
│   ├── Invoices (+ Add Manually + Delete)
│   ├── Sales Returns
│   ├── Commission Invoices
│   └── Product Mappings

├── BUSINESS
│   ├── Inventory
│   ├── Purchases
│   ├── Sales
│   ├── Customers
│   ├── Outstanding
│   ├── Damaged Goods
│   └── Marketplace

├── FINANCE
│   ├── Bank Statement
│   ├── GST
│   ├── Accounting
│   └── Reports

└── SYSTEM
    ├── Notifications
    ├── User Management
    ├── Audit Log
    └── Settings
```

---

## 26. API Reference

**Base URL:** `https://invoice.kynetropo.com/api`  
**Auth:** `Authorization: Bearer <JWT_TOKEN>`

### Auth
```
POST /auth/login          → { email, password } → { user, token }
GET  /auth/me             → current user
POST /auth/refresh        → new token
POST /auth/logout         → invalidate token
```

### Invoices
```
POST /invoices/upload     → multipart: file, marketplace, invoice_type, is_damaged, is_credit_sale
POST /invoices/manual     → JSON: vendor_name, total_amount, invoice_type, marketplace...
GET  /invoices            → list (filters: marketplace, status, invoice_type, search, page)
GET  /invoices/:id        → single invoice with lineItems
GET  /invoices/:id/status → processing status + stage + progress
GET  /invoices/:id/download → file download (blob)
PUT  /invoices/:id/approve → { validated_data } → runs 7-module cascade
PUT  /invoices/:id        → update fields
DELETE /invoices/:id      → delete
```

### Products
```
GET    /products           → list (filters: search, category, stock_level, per_page)
POST   /products           → create
GET    /products/:id       → single
PUT    /products/:id       → update
DELETE /products/:id       → delete (cascades mapping items + nullifies FK refs)
GET    /products/low-stock → products at or below min_stock_level
```

### Product Mappings
```
GET    /product-mappings              → all mappings for user
POST   /product-mappings              → create { invoice_product_name, items: [{product_id, quantity}] }
GET    /product-mappings/:id          → single
PUT    /product-mappings/:id          → update items (replaces all)
DELETE /product-mappings/:id          → delete mapping + items
POST   /product-mappings/check        → { product_names: [] } → { name: mapping|null }
```

### Sales
```
GET /sales                → list (filters: marketplace, from_date, to_date)
GET /sales/:id            → single order
GET /sales/summary        → { revenue, orders, avgOrderValue, returns } (period: today/week/month/year)
GET /sales/by-marketplace → grouped totals per platform
```

### Customers
```
GET    /customers              → list (filters: search, customer_type)
POST   /customers              → create
GET    /customers/:id          → single
PUT    /customers/:id          → update
DELETE /customers/:id          → delete
GET    /customers/:id/purchases → purchase history
```

### GST
```
GET  /gst/summary          → { outputTax, inputTaxCredit, netPayable, byMonth, byQuarter } (?year=)
GET  /gst/monthly/:year/:month → detailed records
GET  /gst/hsn-summary      → HSN-wise totals
POST /gst/generate-report  → { type, period, format }
```

### Damaged Stock
```
GET  /damaged-stock         → list products with damaged_stock > 0
GET  /damaged-stock/summary → { total_damaged_units, total_damaged_value, product_count }
POST /damaged-stock/:id/write-off → set damaged_stock = 0, log to audit
```

### Outstanding
```
GET  /outstanding/summary      → { total_receivable, total_payable, overdue_amount, aging }
GET  /outstanding/receivables  → list (?status=pending|paid)
GET  /outstanding/payables     → list (?status=pending)
POST /outstanding/:id/payment  → { amount, payment_date, notes }
```

### Reports
```
POST /reports/generate     → { type, from_date, to_date, format, fields[] }
GET  /reports/:id/download → file stream (XLS or HTML)
GET  /reports              → list recent reports
```

### Other
```
GET  /dashboard/summary         → all dashboard KPIs
GET  /dashboard/revenue-chart   → { labels, datasets }
GET  /notifications             → paginated (?is_read=0|1)
PUT  /notifications/:id/read    → mark read
PUT  /notifications/read-all    → mark all read
GET  /audit-log                 → paginated (?action=, entity_type=, from_date=, to_date=)
GET  /settings                  → key-value settings
PUT  /settings                  → update settings
GET  /accounting/journal-entries → paginated (?from_date, to_date, account)
GET  /accounting/profit-loss    → P&L (?from_date, to_date)
GET  /marketplace/analytics     → platform breakdown (?from_date, to_date)
GET  /marketplace/settlements   → settlement records
```

---

## 27. AI Extraction Logic

### Models used
1. **Groq llama-4-scout-17b** (primary) — vision model, `detail: high`, 4000 tokens
2. **Gemini 2.0 Flash** (fallback) — if Groq fails or returns truncated JSON, 4096 tokens

### Prompt key rules
1. Extract EVERY line item — no skipping
2. Verify Qty: `Qty × Unit Price × (1 + Tax%) ≈ Line Total` — if mismatch, trust Total and recalculate
3. "Pack of 3" in product name ≠ quantity — read the Qty column
4. Amazon SKUs in brackets: `(B0GN2XVLHS)` → extract as sku
5. JSON structure: **line_items first** (prevents truncation cutting critical data)

### Validation passes (post-extraction)
1. Per-line: derive qty from `taxable_value ÷ unit_price` if cleaner
2. Single-item: back-calculate taxable from invoice total if mismatch
3. Grand total: find best candidate item to adjust quantity, scoring by taxable alignment

---

## 28. Data Isolation & Security

- All API routes require `Authorization: Bearer <token>`
- Every query scoped by `user_id` — impossible to access another user's data
- JWT tokens expire in 60 minutes, refresh tokens in 14 days
- Passwords hashed with bcrypt
- All actions logged in `audit_log` with IP address
- Server debug files uploaded temporarily then deleted immediately
- Environment files (`.env`) excluded from git

---

## 29. Deployment

### Server
- **Hosting:** Hostinger Shared Hosting
- **Domain:** invoice.kynetropo.com
- **Backend path:** `/domains/invoice.kynetropo.com/laravel-fresh/`
- **Frontend path:** `/domains/invoice.kynetropo.com/public_html/`

### Frontend deploy
```bash
cd frontend && npm run build
powershell -ExecutionPolicy Bypass -File "/tmp/deploy_front.ps1"
# Uploads all 67 files in dist/ via FTP
```

### Backend deploy
```powershell
# Upload changed PHP files via FTP
ftp://147.93.99.144/domains/invoice.kynetropo.com/laravel-fresh/
User: u952547820 | Pass: Ecosudar@80516
```

### Database
- MySQL: `u952547820_invoice_new` @ localhost
- Key tables: invoices, invoice_line_items, products, product_mappings, product_mapping_items, sales_orders, gst_records, inventory_transactions, outstanding_entries, notifications, audit_log, reports

### API Keys (in server .env)
- `GROQ_API_KEY` — llama-4-scout vision extraction
- `GEMINI_API_KEY` — Gemini 2.0 Flash fallback
- `JWT_SECRET` — authentication tokens

### Git
```
Repository: https://github.com/Kaushik-SPACEZ/invoice-app
Branch: master
Latest commit: b0adcbe (Returns & damaged goods fully working)
```

---

*Document generated: July 2026 | BizSync v2.0*
