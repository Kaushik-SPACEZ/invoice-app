# BACKEND SPECIFICATION — INVOICE ERP

**Stack**: PHP 8.2 + Laravel 11 + MySQL 8 + JWT Auth + Database Queue

---

## 1. ARCHITECTURE

```
Routes → Middleware (JWT) → Controller → Service → Model → MySQL
                                       ↓
                               Queue Job (async OCR + LLM)
```

Key services:
- `InvoiceProcessingService` — OCR + LLM extraction
- `InvoiceApprovalService` — cascading module updates on approve
- `InventoryService` — stock management
- `SalesService` — order creation
- `GSTService` — GST record management
- `AccountingService` — journal entries + P&L
- `ReportService` — PDF/Excel/CSV generation
- `NotificationService` — alerts

---

## 2. DATABASE SCHEMA

### users
```sql
CREATE TABLE users (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NULL,
  google_id VARCHAR(255) NULL,
  business_name VARCHAR(255) NULL,
  gstin VARCHAR(15) NULL,
  address TEXT NULL,
  phone VARCHAR(15) NULL,
  logo_path VARCHAR(500) NULL,
  subscription_plan ENUM('free','starter','pro') DEFAULT 'free',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

INSERT INTO users VALUES
(1,'Raj Kumar','raj@rkelectronics.com','$2y$12$hashed','NULL','RK Electronics','27AAPFU0939F1ZV','Mumbai, Maharashtra','9876543210',NULL,'starter',NOW(),NOW()),
(2,'Test User','test@example.com','$2y$12$hashed',NULL,'Test Store',NULL,NULL,NULL,NULL,'free',NOW(),NOW());
```

### invoices
```sql
CREATE TABLE invoices (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  file_type ENUM('pdf','jpg','png') NOT NULL,
  original_filename VARCHAR(255) NOT NULL,
  invoice_number VARCHAR(100) NULL,
  invoice_date DATE NULL,
  marketplace ENUM('amazon','flipkart','meesho','other') DEFAULT 'other',
  vendor_name VARCHAR(255) NULL,
  vendor_gstin VARCHAR(15) NULL,
  customer_id BIGINT UNSIGNED NULL,
  subtotal DECIMAL(12,2) DEFAULT 0,
  tax_amount DECIMAL(12,2) DEFAULT 0,
  total_amount DECIMAL(12,2) DEFAULT 0,
  processing_status ENUM('pending','processing','review','approved','rejected','error') DEFAULT 'pending',
  ai_confidence_score DECIMAL(5,2) NULL,
  extracted_data JSON NULL,
  validated_data JSON NULL,
  error_message TEXT NULL,
  processed_at TIMESTAMP NULL,
  approved_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

### invoice_line_items
```sql
CREATE TABLE invoice_line_items (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  invoice_id BIGINT UNSIGNED NOT NULL,
  product_id BIGINT UNSIGNED NULL,
  sku VARCHAR(100) NULL,
  product_name VARCHAR(255) NOT NULL,
  hsn_code VARCHAR(20) NULL,
  quantity DECIMAL(10,3) NOT NULL,
  unit_price DECIMAL(12,2) NOT NULL,
  discount DECIMAL(12,2) DEFAULT 0,
  taxable_value DECIMAL(12,2) NOT NULL,
  cgst_rate DECIMAL(5,2) DEFAULT 0,
  cgst_amount DECIMAL(12,2) DEFAULT 0,
  sgst_rate DECIMAL(5,2) DEFAULT 0,
  sgst_amount DECIMAL(12,2) DEFAULT 0,
  igst_rate DECIMAL(5,2) DEFAULT 0,
  igst_amount DECIMAL(12,2) DEFAULT 0,
  total_amount DECIMAL(12,2) NOT NULL,
  confidence_score DECIMAL(5,2) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
);
```

### products
```sql
CREATE TABLE products (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  sku VARCHAR(100) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT NULL,
  category VARCHAR(100) NULL,
  hsn_code VARCHAR(20) NULL,
  unit VARCHAR(20) DEFAULT 'pcs',
  cost_price DECIMAL(12,2) DEFAULT 0,
  selling_price DECIMAL(12,2) DEFAULT 0,
  current_stock INT DEFAULT 0,
  min_stock_level INT DEFAULT 5,
  max_stock_level INT DEFAULT 100,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY unique_user_sku (user_id, sku)
);

INSERT INTO products VALUES
(1,1,'PHC-001','Silicone Phone Case','For iPhone 15',  'Accessories','8517','pcs',  80.00, 299.00,  42, 10, 200, 1, NOW(), NOW()),
(2,1,'SCR-002','Tempered Glass Screen Protector',NULL,  'Accessories','7013','pcs',  30.00, 149.00,  6,  10, 500, 1, NOW(), NOW()),
(3,1,'USB-003','USB Type-C Cable 2m',NULL,              'Cables',     '8544','pcs',  45.00, 199.00,  88, 15, 300, 1, NOW(), NOW()),
(4,1,'PWR-004','20000mAh Power Bank',NULL,              'Electronics','8507','pcs', 650.00,1499.00,  14, 5,  100, 1, NOW(), NOW()),
(5,1,'EAR-005','Wireless Earbuds',NULL,                 'Audio',      '8518','pcs', 350.00, 999.00,  3,  8,  150, 1, NOW(), NOW());
```

### inventory_transactions
```sql
CREATE TABLE inventory_transactions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  product_id BIGINT UNSIGNED NOT NULL,
  invoice_id BIGINT UNSIGNED NULL,
  transaction_type ENUM('sale','purchase','adjustment','return') NOT NULL,
  quantity_change INT NOT NULL,
  stock_before INT NOT NULL,
  stock_after INT NOT NULL,
  notes TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (product_id) REFERENCES products(id),
  FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE SET NULL
);
```

### customers
```sql
CREATE TABLE customers (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NULL,
  phone VARCHAR(15) NULL,
  gstin VARCHAR(15) NULL,
  address_line1 VARCHAR(255) NULL,
  city VARCHAR(100) NULL,
  state VARCHAR(100) NULL,
  pincode VARCHAR(10) NULL,
  customer_type ENUM('b2b','b2c') DEFAULT 'b2c',
  total_purchases INT DEFAULT 0,
  lifetime_revenue DECIMAL(14,2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

### sales_orders
```sql
CREATE TABLE sales_orders (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  invoice_id BIGINT UNSIGNED NOT NULL,
  customer_id BIGINT UNSIGNED NULL,
  order_number VARCHAR(100) NOT NULL,
  order_date DATE NOT NULL,
  marketplace ENUM('amazon','flipkart','meesho','other') NOT NULL,
  marketplace_order_id VARCHAR(200) NULL,
  subtotal DECIMAL(12,2) NOT NULL,
  discount DECIMAL(12,2) DEFAULT 0,
  tax_amount DECIMAL(12,2) NOT NULL,
  shipping_charges DECIMAL(12,2) DEFAULT 0,
  commission_amount DECIMAL(12,2) DEFAULT 0,
  total_amount DECIMAL(12,2) NOT NULL,
  net_revenue DECIMAL(12,2) NOT NULL,
  status ENUM('completed','pending','cancelled','returned') DEFAULT 'completed',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (invoice_id) REFERENCES invoices(id)
);
```

### gst_records
```sql
CREATE TABLE gst_records (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  invoice_id BIGINT UNSIGNED NOT NULL,
  invoice_line_item_id BIGINT UNSIGNED NULL,
  gstin_supplier VARCHAR(15) NULL,
  gstin_recipient VARCHAR(15) NULL,
  hsn_code VARCHAR(20) NULL,
  taxable_value DECIMAL(12,2) NOT NULL,
  cgst_rate DECIMAL(5,2) DEFAULT 0,
  cgst_amount DECIMAL(12,2) DEFAULT 0,
  sgst_rate DECIMAL(5,2) DEFAULT 0,
  sgst_amount DECIMAL(12,2) DEFAULT 0,
  igst_rate DECIMAL(5,2) DEFAULT 0,
  igst_amount DECIMAL(12,2) DEFAULT 0,
  total_tax DECIMAL(12,2) NOT NULL,
  supply_type ENUM('b2b','b2c') DEFAULT 'b2c',
  transaction_date DATE NOT NULL,
  financial_year VARCHAR(7) NOT NULL,
  quarter TINYINT NOT NULL,
  month TINYINT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (invoice_id) REFERENCES invoices(id)
);
```

### journal_entries
```sql
CREATE TABLE journal_entries (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  invoice_id BIGINT UNSIGNED NULL,
  entry_date DATE NOT NULL,
  entry_number VARCHAR(50) NOT NULL,
  description TEXT NOT NULL,
  debit_account VARCHAR(100) NOT NULL,
  credit_account VARCHAR(100) NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

### expenses
```sql
CREATE TABLE expenses (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  invoice_id BIGINT UNSIGNED NULL,
  category VARCHAR(100) NOT NULL,
  description VARCHAR(255) NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  expense_date DATE NOT NULL,
  marketplace ENUM('amazon','flipkart','meesho','other','none') DEFAULT 'none',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

### notifications
```sql
CREATE TABLE notifications (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  type ENUM('low_stock','duplicate_invoice','gst_mismatch','invoice_error','ai_low_confidence','new_sales_record','inventory_warning','gst_due') NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  data JSON NULL,
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

### audit_logs
```sql
CREATE TABLE audit_logs (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NULL,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(100) NOT NULL,
  entity_id BIGINT UNSIGNED NULL,
  old_values JSON NULL,
  new_values JSON NULL,
  ip_address VARCHAR(45) NULL,
  user_agent TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### marketplace_settlements
```sql
CREATE TABLE marketplace_settlements (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  marketplace ENUM('amazon','flipkart','meesho') NOT NULL,
  settlement_id VARCHAR(100) NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  gross_sales DECIMAL(14,2) NOT NULL,
  returns_refunds DECIMAL(14,2) DEFAULT 0,
  marketplace_commission DECIMAL(14,2) DEFAULT 0,
  tds_deducted DECIMAL(14,2) DEFAULT 0,
  payment_received DECIMAL(14,2) DEFAULT 0,
  expected_amount DECIMAL(14,2) DEFAULT 0,
  difference DECIMAL(14,2) DEFAULT 0,
  status ENUM('pending','received','disputed') DEFAULT 'pending',
  settled_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

### settings
```sql
CREATE TABLE settings (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  `key` VARCHAR(100) NOT NULL,
  `value` TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_user_key (user_id, `key`),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

---

## 3. API ENDPOINTS

All responses follow this wrapper:
```json
{ "success": true, "data": {}, "message": "OK" }
{ "success": false, "message": "Error message", "errors": {} }
```

---

### AUTH

**POST /api/auth/register**
```json
// Request
{ "name": "Raj Kumar", "email": "raj@example.com", "password": "secret123", "password_confirmation": "secret123", "business_name": "RK Electronics" }

// 201 Response
{ "success": true, "data": { "user": { "id": 1, "name": "Raj Kumar", "email": "raj@example.com" }, "token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9..." }, "message": "Registered successfully" }

// 422 Error
{ "success": false, "errors": { "email": ["The email has already been taken."] } }
```

**POST /api/auth/login**
```json
// Request
{ "email": "raj@example.com", "password": "secret123" }

// 200 Response
{ "success": true, "data": { "user": { "id": 1, "name": "Raj Kumar", "email": "raj@example.com", "business_name": "RK Electronics", "gstin": "27AAPFU0939F1ZV" }, "token": "eyJ...", "expires_in": 3600 } }

// 401 Error
{ "success": false, "message": "Invalid credentials" }
```

**POST /api/auth/logout** — Bearer required → `{ "success": true, "message": "Logged out" }`

**GET /api/auth/me** — Bearer required → returns user object

**POST /api/auth/refresh** — Bearer required → returns new token

---

### INVOICES

**POST /api/invoices/upload**
```
Headers: Authorization: Bearer {token}, Content-Type: multipart/form-data
Body: file (required, max 10MB, pdf/jpg/png), marketplace (optional: amazon|flipkart|meesho|other)
```
```json
// 202 Response
{ "success": true, "data": { "invoice_id": 42, "status": "pending" }, "message": "Invoice queued for processing" }
```

**GET /api/invoices/{id}/status** — polling endpoint
```json
// Processing
{ "success": true, "data": { "id": 42, "status": "processing", "stage": "ocr_extraction", "progress": 30 } }

// Ready for review
{ "success": true, "data": { "id": 42, "status": "review", "stage": "completed", "progress": 100, "ai_confidence_score": 91.5 } }
```

**GET /api/invoices**
```
Query: page, per_page(default 20), marketplace, status, from_date(YYYY-MM-DD), to_date, search
```
```json
{ "success": true, "data": { "data": [ { "id": 42, "invoice_number": "AMZ-2024-001", "invoice_date": "2024-06-15", "marketplace": "amazon", "vendor_name": "Amazon Seller Services", "total_amount": 2450.00, "processing_status": "approved", "ai_confidence_score": 91.5, "created_at": "2024-06-15T10:30:00Z" } ], "meta": { "current_page": 1, "total": 48, "per_page": 20, "last_page": 3 } } }
```

**GET /api/invoices/{id}** — full invoice with line_items array

**PUT /api/invoices/{id}/approve**
```json
// Request
{
  "validated_data": {
    "invoice_number": "AMZ-2024-001",
    "invoice_date": "2024-06-15",
    "marketplace": "amazon",
    "vendor_name": "Amazon Seller Services",
    "vendor_gstin": "27AAECS4369H1ZM",
    "line_items": [
      { "sku": "PHC-001", "product_name": "Silicone Phone Case", "hsn_code": "8517", "quantity": 2, "unit_price": 299.00, "discount": 0, "taxable_value": 508.47, "cgst_rate": 9, "cgst_amount": 45.76, "sgst_rate": 9, "sgst_amount": 45.76, "igst_rate": 0, "igst_amount": 0, "total_amount": 600.00 }
    ],
    "subtotal": 508.47, "tax_amount": 91.52, "total_amount": 600.00
  }
}

// 200 Response
{ "success": true, "data": { "invoice": { "id": 42, "processing_status": "approved" }, "modules_updated": ["inventory","sales","customer","gst","accounting","expenses","notifications"] }, "message": "Invoice approved successfully" }
```

**DELETE /api/invoices/{id}** → `{ "success": true, "message": "Invoice deleted" }`

---

### PRODUCTS / INVENTORY

**GET /api/products**
```
Query: page, search, category, stock_level(normal|low|zero)
```
```json
{ "success": true, "data": { "data": [ { "id": 1, "sku": "PHC-001", "name": "Silicone Phone Case", "category": "Accessories", "current_stock": 42, "min_stock_level": 10, "cost_price": 80.00, "selling_price": 299.00, "is_active": true } ], "meta": { "current_page": 1, "total": 5 } } }
```

**POST /api/products**
```json
// Request
{ "sku": "PHC-001", "name": "Silicone Phone Case", "category": "Accessories", "hsn_code": "8517", "unit": "pcs", "cost_price": 80.00, "selling_price": 299.00, "current_stock": 50, "min_stock_level": 10 }
// 201: created product
```

**GET /api/products/low-stock**
```json
{ "success": true, "data": [ { "id": 2, "sku": "SCR-002", "name": "Tempered Glass", "current_stock": 6, "min_stock_level": 10 }, { "id": 5, "sku": "EAR-005", "name": "Wireless Earbuds", "current_stock": 3, "min_stock_level": 8 } ] }
```

---

### SALES

**GET /api/sales/summary**
```
Query: period (today|week|month|year)
```
```json
{ "success": true, "data": { "revenue": 324600.00, "orders": 142, "avg_order_value": 2285.92, "returns": 3, "by_marketplace": { "amazon": { "revenue": 145200, "orders": 62 }, "flipkart": { "revenue": 98400, "orders": 51 }, "meesho": { "revenue": 81000, "orders": 29 } } } }
```

**GET /api/sales** — paginated sales orders list

**GET /api/sales/by-marketplace**
```json
{ "success": true, "data": { "amazon": { "revenue": 145200, "orders": 62, "commission": 14520, "returns": 2 }, "flipkart": { "revenue": 98400, "orders": 51, "commission": 9840, "returns": 1 }, "meesho": { "revenue": 81000, "orders": 29, "commission": 6480, "returns": 0 } } }
```

---

### CUSTOMERS

**GET /api/customers** — paginated, query: page, search, customer_type(b2b|b2c)

**GET /api/customers/{id}/purchases**
```json
{ "success": true, "data": { "customer": { "id": 1, "name": "Priya Sharma", "gstin": null, "city": "Pune", "customer_type": "b2c", "total_purchases": 8, "lifetime_revenue": 14250.00 }, "purchases": [ { "order_date": "2024-06-15", "invoice_number": "AMZ-2024-001", "marketplace": "amazon", "total_amount": 1800.00, "products": ["Silicone Phone Case x2", "USB Cable x1"] } ] } }
```

---

### GST

**GET /api/gst/summary?year=2024**
```json
{ "success": true, "data": { "output_tax": 82450.00, "input_tax_credit": 24300.00, "net_payable": 58150.00, "by_quarter": [ { "quarter": "Q1", "output": 18200, "input": 5400, "payable": 12800 }, { "quarter": "Q2", "output": 22100, "input": 6800, "payable": 15300 } ], "by_month": [ { "month": "Jan", "taxable_value": 95000, "cgst": 4275, "sgst": 4275, "igst": 0, "total": 8550 } ] } }
```

**GET /api/gst/hsn-summary?from_date=2024-04-01&to_date=2024-06-30**
```json
{ "success": true, "data": [ { "hsn_code": "8517", "description": "Phone Cases", "taxable_value": 42500, "total_tax": 7650, "rate": "18%" } ] }
```

**POST /api/gst/generate-report**
```json
// Request
{ "type": "gstr1", "period": "2024-06", "format": "excel" }
// 200 Response
{ "success": true, "data": { "download_url": "/api/reports/12/download", "filename": "GSTR1_2024-06.xlsx" } }
```

---

### ACCOUNTING

**GET /api/accounting/profit-loss?from_date=2024-04-01&to_date=2024-06-30**
```json
{ "success": true, "data": { "revenue": 324600, "cogs": 168000, "gross_profit": 156600, "expenses": { "shipping": 12400, "commission": 32460, "packaging": 8200, "total": 53060 }, "operating_profit": 103540, "gst_payable": 18637, "net_profit": 84903 } }
```

**GET /api/accounting/journal-entries** — paginated, query: from_date, to_date, account

---

### REPORTS

**POST /api/reports/generate**
```json
// Request
{ "type": "sales", "from_date": "2024-06-01", "to_date": "2024-06-30", "format": "pdf" }
// 202 Response
{ "success": true, "data": { "report_id": 12, "status": "generating", "estimated_seconds": 10 } }
```

**GET /api/reports/{id}/download** — returns file stream with headers:
```
Content-Type: application/pdf (or xlsx/csv)
Content-Disposition: attachment; filename="sales_report_june_2024.pdf"
```

---

### MARKETPLACE ANALYTICS

**GET /api/marketplace/analytics?from_date=2024-04-01&to_date=2024-06-30**
```json
{ "success": true, "data": { "total_revenue": 324600, "total_commission": 46860, "total_returns": 3, "by_platform": { "amazon": { "revenue": 145200, "orders": 62, "commission": 14520, "commission_pct": 10, "returns": 2, "top_product": "USB Cable" }, "flipkart": { "revenue": 98400, "orders": 51, "commission": 9840, "commission_pct": 10, "returns": 1, "top_product": "Phone Case" }, "meesho": { "revenue": 81000, "orders": 29, "commission": 6480, "commission_pct": 8, "returns": 0, "top_product": "Earbuds" } } } }
```

---

### DASHBOARD

**GET /api/dashboard/summary**
```json
{ "success": true, "data": { "today_sales": 12450.00, "monthly_revenue": 324600.00, "gst_payable": 18340.00, "net_profit": 84903.00, "total_products": 45, "low_stock_count": 3, "out_of_stock_count": 1, "recent_invoices": [ { "id": 42, "invoice_number": "AMZ-2024-001", "marketplace": "amazon", "total_amount": 1800, "status": "approved", "created_at": "2024-06-15T10:30:00Z" } ], "unread_notifications": 5 } }
```

**GET /api/dashboard/revenue-chart?period=monthly**
```json
{ "success": true, "data": { "labels": ["Jan","Feb","Mar","Apr","May","Jun"], "datasets": [ { "name": "Revenue", "data": [185000,210000,195000,240000,285000,324600] }, { "name": "Profit", "data": [42000,51000,44000,58000,72000,84903] } ] } }
```

---

### NOTIFICATIONS

**GET /api/notifications** — paginated, query: is_read
```json
{ "success": true, "data": { "data": [ { "id": 1, "type": "low_stock", "title": "Low Stock Alert", "message": "Tempered Glass (SCR-002) has only 6 units left. Minimum is 10.", "is_read": false, "created_at": "2024-06-15T11:00:00Z" } ], "meta": { "total": 12, "unread": 5 } } }
```

**PUT /api/notifications/{id}/read** → marks single notification read

**PUT /api/notifications/read-all** → marks all read

---

### AUDIT LOG

**GET /api/audit-log?page=1&from_date=2024-06-01&to_date=2024-06-30**
```json
{ "success": true, "data": { "data": [ { "id": 1, "user": "Raj Kumar", "action": "invoice_approved", "entity_type": "invoice", "entity_id": 42, "new_values": { "status": "approved" }, "ip_address": "103.21.45.12", "created_at": "2024-06-15T10:35:00Z" } ] } }
```

---

### SETTINGS

**GET /api/settings** → `{ "success": true, "data": { "business_name": "RK Electronics", "gstin": "27AAPFU0939F1ZV", "low_stock_notifications": true, "email_alerts": false } }`

**PUT /api/settings** — Request: key-value object of settings to update

---

## 4. KEY SERVICE CLASSES

### InvoiceProcessingService
```php
class InvoiceProcessingService {
    public function processInvoice(Invoice $invoice): void
    // 1. updateStatus('processing')
    // 2. $text = $this->extractWithOCR($invoice->file_path)
    // 3. $data = $this->extractWithLLM($text, $invoice->marketplace)
    // 4. $validated = $this->validateExtractedData($data)
    // 5. $score = $this->calculateConfidenceScore($validated)
    // 6. $invoice->update([extracted_data, ai_confidence_score, status => 'review'])

    private function extractWithOCR(string $path): string
    // shell_exec("tesseract {$path} stdout") or Google Vision API

    private function extractWithLLM(string $text, string $marketplace): array
    // POST to OpenAI /chat/completions with extraction prompt
    // Returns decoded JSON array

    private function validateExtractedData(array $data): array
    // Validate GSTIN regex: /\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]/
    // Validate HSN codes, recalculate totals for verification

    private function calculateConfidenceScore(array $data): float
    // Average of confidence values in each field
}
```

### InvoiceApprovalService
```php
class InvoiceApprovalService {
    public function approve(Invoice $invoice, array $validatedData): void {
        DB::transaction(function() use ($invoice, $validatedData) {
            $invoice->update(['validated_data' => $validatedData, 'processing_status' => 'approved', 'approved_at' => now()]);
            $this->inventoryService->updateFromInvoice($invoice);
            $this->salesService->createOrderFromInvoice($invoice);
            $this->customerService->updateFromInvoice($invoice);
            $this->gstService->processFromInvoice($invoice);
            $this->accountingService->createJournalEntries($invoice);
            $this->expenseService->extractFromInvoice($invoice);
            $this->notificationService->checkAndNotify($invoice);
            AuditLog::record('invoice_approved', 'invoice', $invoice->id, null, ['status' => 'approved']);
        });
    }
}
```

### GSTService
```php
class GSTService {
    public function processFromInvoice(Invoice $invoice): void
    // For each line item create gst_records row
    // Determine CGST+SGST (intra-state) or IGST (inter-state)

    public function calculateTaxType(string $supplierState, string $recipientState): string
    // return $supplierState === $recipientState ? 'cgst_sgst' : 'igst'

    public function getFinancialYear(string $date): string
    // Returns '2024-25' format
    // April start: if month >= 4 → current_year . '-' . (current_year+1)[2:]
}
```

---

## 5. LLM PROMPT TEMPLATE

```
You are an expert invoice data extractor. Extract structured data from this invoice text.
Return ONLY valid JSON, no explanation.

Marketplace: {MARKETPLACE}
Invoice text:
---
{OCR_TEXT}
---

Return this exact JSON:
{
  "invoice_number": "string|null",
  "invoice_date": "YYYY-MM-DD|null",
  "vendor_name": "string|null",
  "vendor_gstin": "string|null",
  "customer_name": "string|null",
  "customer_gstin": "string|null",
  "customer_address": "string|null",
  "line_items": [{
    "sku": "string|null",
    "product_name": "string",
    "hsn_code": "string|null",
    "quantity": number,
    "unit_price": number,
    "discount": number,
    "taxable_value": number,
    "cgst_rate": number, "cgst_amount": number,
    "sgst_rate": number, "sgst_amount": number,
    "igst_rate": number, "igst_amount": number,
    "total_amount": number,
    "confidence": number
  }],
  "shipping_charges": number,
  "commission_amount": number,
  "subtotal": number,
  "tax_amount": number,
  "total_amount": number,
  "field_confidence": {
    "invoice_number": number, "invoice_date": number,
    "vendor_name": number, "vendor_gstin": number,
    "line_items": number, "totals": number
  }
}
```

---

## 6. QUEUE JOB

```php
class ProcessInvoiceJob implements ShouldQueue {
    use Dispatchable, InteractsWithQueue, Queueable;
    public $tries = 3;
    public $timeout = 120;

    public function __construct(public Invoice $invoice) {}

    public function handle(InvoiceProcessingService $service): void {
        try {
            $service->processInvoice($this->invoice);
        } catch (\Exception $e) {
            $this->invoice->update(['processing_status' => 'error', 'error_message' => $e->getMessage()]);
            throw $e;
        }
    }
}
```

Dispatch after upload:
```php
ProcessInvoiceJob::dispatch($invoice)->onQueue('invoices');
```

---

## 7. GST RULES

- **Intra-state supply**: CGST = GST/2, SGST = GST/2 (same state code in both GSTINs)
- **Inter-state supply**: IGST = full GST rate (different states)
- **B2B**: customer GSTIN present → supply_type = 'b2b'
- **B2C**: no customer GSTIN → supply_type = 'b2c'
- **GST rate tiers**: 0%, 5%, 12%, 18%, 28%
- **Financial year**: April–March. FY 2024-25 = April 2024 to March 2025
- **Quarter**: Q1=Apr-Jun, Q2=Jul-Sep, Q3=Oct-Dec, Q4=Jan-Mar
- **GSTIN format regex**: `/^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/`

---

## 8. ENVIRONMENT VARIABLES (.env)

```env
APP_NAME="Invoice ERP"
APP_ENV=production
APP_KEY=base64:GENERATE_WITH_php_artisan_key_generate
APP_DEBUG=false
APP_URL=https://yourdomain.com

DB_CONNECTION=mysql
DB_HOST=localhost
DB_PORT=3306
DB_DATABASE=invoice_erp
DB_USERNAME=invoice_erp_user
DB_PASSWORD=strong_password_here

JWT_SECRET=GENERATE_WITH_php_artisan_jwt_secret
JWT_TTL=60
JWT_REFRESH_TTL=20160

OPENAI_API_KEY=sk-proj-...
OPENAI_MODEL=gpt-4o-mini

QUEUE_CONNECTION=database

MAIL_MAILER=smtp
MAIL_HOST=smtp.hostinger.com
MAIL_PORT=587
MAIL_USERNAME=noreply@yourdomain.com
MAIL_PASSWORD=mail_password
MAIL_FROM_ADDRESS=noreply@yourdomain.com

FILESYSTEM_DISK=local
```

---

## 9. ROUTES FILE (routes/api.php)

```php
<?php
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Auth\AuthController;
use App\Http\Controllers\InvoiceController;
use App\Http\Controllers\ProductController;
use App\Http\Controllers\SalesController;
use App\Http\Controllers\CustomerController;
use App\Http\Controllers\GSTController;
use App\Http\Controllers\AccountingController;
use App\Http\Controllers\ReportController;
use App\Http\Controllers\MarketplaceController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\NotificationController;
use App\Http\Controllers\AuditLogController;
use App\Http\Controllers\SettingsController;
use App\Http\Controllers\ExpenseController;

Route::prefix('auth')->group(function () {
    Route::post('/register', [AuthController::class, 'register']);
    Route::post('/login', [AuthController::class, 'login']);
    Route::post('/google', [AuthController::class, 'google']);
    Route::post('/forgot-password', [AuthController::class, 'forgotPassword']);
    Route::post('/reset-password', [AuthController::class, 'resetPassword']);
    Route::middleware('auth:api')->group(function () {
        Route::get('/me', [AuthController::class, 'me']);
        Route::post('/logout', [AuthController::class, 'logout']);
        Route::post('/refresh', [AuthController::class, 'refresh']);
    });
});

Route::middleware('auth:api')->group(function () {
    // Dashboard
    Route::get('/dashboard/summary', [DashboardController::class, 'summary']);
    Route::get('/dashboard/revenue-chart', [DashboardController::class, 'revenueChart']);

    // Invoices
    Route::post('/invoices/upload', [InvoiceController::class, 'upload']);
    Route::get('/invoices/{id}/status', [InvoiceController::class, 'status']);
    Route::put('/invoices/{id}/approve', [InvoiceController::class, 'approve']);
    Route::apiResource('invoices', InvoiceController::class)->except(['store']);

    // Products / Inventory
    Route::get('/products/low-stock', [ProductController::class, 'lowStock']);
    Route::apiResource('products', ProductController::class);

    // Sales
    Route::get('/sales/summary', [SalesController::class, 'summary']);
    Route::get('/sales/by-marketplace', [SalesController::class, 'byMarketplace']);
    Route::apiResource('sales', SalesController::class)->only(['index', 'show']);

    // Customers
    Route::get('/customers/{id}/purchases', [CustomerController::class, 'purchases']);
    Route::apiResource('customers', CustomerController::class);

    // GST
    Route::get('/gst/summary', [GSTController::class, 'summary']);
    Route::get('/gst/monthly/{year}/{month}', [GSTController::class, 'monthly']);
    Route::get('/gst/hsn-summary', [GSTController::class, 'hsnSummary']);
    Route::post('/gst/generate-report', [GSTController::class, 'generateReport']);

    // Accounting
    Route::get('/accounting/journal-entries', [AccountingController::class, 'journalEntries']);
    Route::get('/accounting/profit-loss', [AccountingController::class, 'profitLoss']);
    Route::get('/accounting/balance-sheet', [AccountingController::class, 'balanceSheet']);
    Route::get('/accounting/accounts', [AccountingController::class, 'accounts']);

    // Expenses
    Route::get('/expenses/summary', [ExpenseController::class, 'summary']);
    Route::apiResource('expenses', ExpenseController::class);

    // Reports
    Route::post('/reports/generate', [ReportController::class, 'generate']);
    Route::get('/reports/{id}/download', [ReportController::class, 'download']);
    Route::get('/reports', [ReportController::class, 'index']);

    // Marketplace
    Route::get('/marketplace/analytics', [MarketplaceController::class, 'analytics']);
    Route::get('/marketplace/settlements', [MarketplaceController::class, 'settlements']);
    Route::get('/marketplace/{platform}/summary', [MarketplaceController::class, 'platformSummary']);

    // Notifications
    Route::put('/notifications/read-all', [NotificationController::class, 'readAll']);
    Route::put('/notifications/{id}/read', [NotificationController::class, 'markRead']);
    Route::apiResource('notifications', NotificationController::class)->only(['index', 'destroy']);

    // Audit & Settings
    Route::get('/audit-log', [AuditLogController::class, 'index']);
    Route::get('/settings', [SettingsController::class, 'index']);
    Route::put('/settings', [SettingsController::class, 'update']);
});
```

---

## 10. HOSTINGER DEPLOYMENT

### Root .htaccess (if not using subdomain for API)
```apache
<IfModule mod_rewrite.c>
    RewriteEngine On
    RewriteRule ^(.*)$ public/$1 [L]
</IfModule>
```

### public/.htaccess
```apache
<IfModule mod_rewrite.c>
    RewriteEngine On
    RewriteCond %{REQUEST_FILENAME} !-d
    RewriteCond %{REQUEST_FILENAME} !-f
    RewriteRule ^ index.php [L]
</IfModule>
```

### Cron Job (Hostinger cPanel → Cron Jobs)
```
* * * * * cd /home/username/public_html && php artisan queue:work --stop-when-empty --tries=3 >> /dev/null 2>&1
```

### Setup Steps
1. Upload Laravel project to Hostinger via FTP or Git
2. Set document root to `/public_html/public` in Hostinger hPanel
3. Create MySQL database in hPanel → Databases → MySQL Databases
4. Upload `.env` with DB credentials
5. SSH into server: `composer install --no-dev`, `php artisan migrate`, `php artisan key:generate`, `php artisan jwt:secret`
6. Set storage permissions: `chmod -R 775 storage bootstrap/cache`
7. Add cron job for queue worker
