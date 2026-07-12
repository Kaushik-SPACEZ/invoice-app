# BizSync API Test Plan
## Production: https://invoice.kynetropo.com/api

### Test Users
- Raj Kumar: raj@rkelectronics.com / password123
- Kaushik K: kaushik@kynetropo.com / Kynetropo@2024

---

## WORKFLOW COVERAGE

### 1. AUTH
- Happy: valid login → JWT token
- Sad: wrong password → 401
- Sad: unknown email → 401
- Edge: missing fields → 422
- Edge: get /me with token → user data
- Edge: get /me without token → 401

### 2. PRODUCTS / INVENTORY
- Happy: create product → 201
- Sad: duplicate SKU → 422
- Sad: missing required fields → 422
- Edge: stock_level filter (low/zero/normal)
- Edge: category filter
- Edge: search by SKU and name
- Edge: other user cannot see this user's products

### 3. INVOICE UPLOAD
- Happy: upload PDF → 202 + invoice_id
- Sad: invalid file type (txt) → 422
- Sad: file too large → 422
- Edge: marketplace validation
- Edge: status polling returns correct stages

### 4. INVOICE APPROVAL CASCADE
- Happy: approve invoice with mapped product → all 7 modules update
- Verify: stock reduced
- Verify: sales order created
- Verify: GST record created
- Verify: audit log entry created
- Sad: approve already-approved invoice → should handle gracefully
- Edge: approve invoice with unmapped product → notification created

### 5. PRODUCT MAPPINGS
- Happy: create mapping → 201
- Happy: check existing name → returns mapping
- Happy: check unknown name → returns null
- Sad: duplicate mapping → 422
- Happy: update mapping items → items replaced
- Happy: delete mapping → 200
- Edge: normalized name matching (case-insensitive, extra spaces)

### 6. SALES RETURNS
- Happy: upload return invoice → stock added back
- Happy: damaged return → goes to damaged_stock, not current_stock
- Verify: damaged_stock incremented, current_stock unchanged

### 7. DAMAGED GOODS
- Happy: list damaged products
- Happy: summary with total value
- Happy: write-off → damaged_stock = 0, audit log created
- Sad: write-off product with no damaged stock → 422
- Sad: write-off another user's product → 404

### 8. GST
- Happy: summary returns output_tax, input_tax_credit, net_payable
- Happy: monthly ledger broken down by month
- Happy: quarterly summary grouped by quarter

### 9. DASHBOARD
- Happy: summary returns all 8 fields
- Happy: revenue chart returns labels + datasets
- Edge: empty state (new user, no data) returns zeros

### 10. SALES
- Happy: summary for period today/week/month/year
- Happy: list returns paginated orders
- Happy: byMarketplace groups correctly

### 11. NOTIFICATIONS
- Happy: list shows unread first
- Happy: mark single as read
- Happy: mark all as read

### 12. AUDIT LOG
- Happy: actions logged after invoice approve

### 13. SETTINGS
- Happy: get settings
- Happy: update name/business_name/gstin
- Sad: invalid GSTIN format
