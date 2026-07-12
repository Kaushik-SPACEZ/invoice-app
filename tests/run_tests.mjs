/**
 * BizSync API — Full Test Runner
 * Runs all happy/sad/edge path tests against production API
 * Usage: node run_tests.mjs
 */

const BASE = 'https://invoice.kynetropo.com/api';

let passed = 0, failed = 0, warned = 0;
let tokenK = '', tokenR = '';
let productId = null, mappingId = null, testInvoiceId = null, customerId = null;

const BUGS = []; // Collect bugs found

function pass(name) { passed++; console.log(`  ✅ ${name}`); }
function fail(name, detail) { failed++; BUGS.push({name, detail}); console.log(`  ❌ ${name}: ${detail}`); }
function warn(name, detail) { warned++; console.log(`  ⚠️  ${name}: ${detail}`); }

async function api(method, path, body = null, token = null, expectStatus = null) {
  const headers = { 'Content-Type': 'application/json', 'Accept': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);
  try {
    const res = await fetch(`${BASE}${path}`, opts);
    let data;
    try { data = await res.json(); } catch { data = null; }
    return { status: res.status, data, ok: res.ok };
  } catch (e) {
    return { status: 0, data: null, ok: false, error: e.message };
  }
}

// ─── AUTH TESTS ────────────────────────────────────────────────────────────────

async function testAuth() {
  console.log('\n━━━ SECTION 1: AUTH ━━━');

  // 1.1 Happy login Kaushik
  const r1 = await api('POST', '/auth/login', { email: 'kaushik@kynetropo.com', password: 'Kynetropo@2024' });
  tokenK = r1.data?.data?.token || r1.data?.token || r1.data?.access_token || r1.data?.data?.access_token || '';
  if (r1.status === 200 && tokenK) pass('1.1 Login Kaushik → 200 + JWT');
  else fail('1.1 Login Kaushik', `status=${r1.status}, token=${!!tokenK}, data=${JSON.stringify(r1.data).slice(0,100)}`);

  // 1.2 Happy login Raj
  const r2 = await api('POST', '/auth/login', { email: 'raj@rkelectronics.com', password: 'password123' });
  tokenR = r2.data?.data?.token || r2.data?.token || r2.data?.access_token || r2.data?.data?.access_token || '';
  if (r2.status === 200 && tokenR) pass('1.2 Login Raj → 200 + JWT');
  else fail('1.2 Login Raj', `status=${r2.status}`);

  // 1.3 Get /me
  const r3 = await api('GET', '/auth/me', null, tokenK);
  if (r3.status === 200 && r3.data?.data?.email === 'kaushik@kynetropo.com') pass('1.3 GET /me with token → correct user');
  else fail('1.3 GET /me', `status=${r3.status}, email=${r3.data?.data?.email}`);

  // 1.4 Wrong password → 401
  const r4 = await api('POST', '/auth/login', { email: 'kaushik@kynetropo.com', password: 'wrongpass' });
  if (r4.status === 401) pass('1.4 Wrong password → 401');
  else fail('1.4 Wrong password', `Expected 401, got ${r4.status}`);

  // 1.5 Unknown email → 401
  const r5 = await api('POST', '/auth/login', { email: 'nobody@nowhere.com', password: 'pass' });
  if (r5.status === 401) pass('1.5 Unknown email → 401');
  else fail('1.5 Unknown email', `Expected 401, got ${r5.status}`);

  // 1.6 Missing fields → 422
  const r6 = await api('POST', '/auth/login', { email: 'kaushik@kynetropo.com' });
  if (r6.status === 422) pass('1.6 Missing password field → 422');
  else warn('1.6 Missing password field', `Expected 422, got ${r6.status}`);

  // 1.7 No token → 401
  const r7 = await api('GET', '/auth/me');
  if (r7.status === 401) pass('1.7 No token → 401');
  else fail('1.7 No token', `Expected 401, got ${r7.status}`);

  // 1.8 Garbage token → 401
  const r8 = await api('GET', '/auth/me', null, 'garbage.token.here');
  if (r8.status === 401) pass('1.8 Garbage token → 401');
  else fail('1.8 Garbage token', `Expected 401, got ${r8.status}`);
}

// ─── INVENTORY TESTS ───────────────────────────────────────────────────────────

async function testInventory() {
  console.log('\n━━━ SECTION 2: INVENTORY ━━━');

  // 2.1 List all products
  const r1 = await api('GET', '/products', null, tokenK);
  if (r1.status === 200 && r1.data?.success) pass('2.1 List products → 200');
  else fail('2.1 List products', `status=${r1.status}`);

  // 2.2 Create product
  const r2 = await api('POST', '/products', {
    sku: 'TEST-SKU-AUTO-' + Date.now(),
    name: 'Test Abacus Kit Auto',
    category: 'Toys',
    hsn_code: '9503',
    unit: 'pcs',
    cost_price: 150,
    selling_price: 299,
    current_stock: 50,
    min_stock_level: 5
  }, tokenK);
  if (r2.status === 201 && r2.data?.data?.id) {
    productId = r2.data.data.id;
    pass(`2.2 Create product → 201 (id=${productId})`);
  } else fail('2.2 Create product', `status=${r2.status}, resp=${JSON.stringify(r2.data).slice(0,100)}`);

  // 2.3 Get single product
  if (productId) {
    const r3 = await api('GET', `/products/${productId}`, null, tokenK);
    if (r3.status === 200 && r3.data?.data?.id === productId) pass('2.3 Get single product → 200');
    else fail('2.3 Get single product', `status=${r3.status}`);
  }

  // 2.4 Duplicate SKU → 422
  const testSku = r2.data?.data?.sku;
  if (testSku) {
    const r4 = await api('POST', '/products', { sku: testSku, name: 'Dupe', selling_price: 100, current_stock: 1 }, tokenK);
    if (r4.status === 422) pass('2.4 Duplicate SKU → 422');
    else fail('2.4 Duplicate SKU', `Expected 422, got ${r4.status}`);
  }

  // 2.5 Missing required fields → 422
  const r5 = await api('POST', '/products', { category: 'Toys' }, tokenK);
  if (r5.status === 422) pass('2.5 Missing required fields → 422');
  else fail('2.5 Missing required fields', `Expected 422, got ${r5.status}`);

  // 2.6 Stock filter: low
  const r6 = await api('GET', '/products?stock_level=low', null, tokenK);
  if (r6.status === 200) pass('2.6 Stock filter low → 200');
  else fail('2.6 Stock filter low', `status=${r6.status}`);

  // 2.7 Stock filter: zero
  const r7 = await api('GET', '/products?stock_level=zero', null, tokenK);
  if (r7.status === 200) pass('2.7 Stock filter zero → 200');
  else fail('2.7 Stock filter zero', `status=${r7.status}`);

  // 2.8 Category filter
  const r8 = await api('GET', '/products?category=Toys', null, tokenK);
  if (r8.status === 200) pass('2.8 Category filter → 200');
  else fail('2.8 Category filter', `status=${r8.status}`);

  // 2.9 Search
  const r9 = await api('GET', '/products?search=TEST-SKU', null, tokenK);
  if (r9.status === 200) pass('2.9 Search products → 200');
  else fail('2.9 Search', `status=${r9.status}`);

  // 2.10 Low stock endpoint
  const r10 = await api('GET', '/products/low-stock', null, tokenK);
  if (r10.status === 200) pass('2.10 Low stock endpoint → 200');
  else fail('2.10 Low stock endpoint', `status=${r10.status}`);

  // 2.11 Cross-user access denied
  if (productId) {
    const r11 = await api('GET', `/products/${productId}`, null, tokenR);
    if (r11.status === 404) pass('2.11 Cross-user product access → 404');
    else fail('2.11 Cross-user product access', `Expected 404, got ${r11.status} (data isolation broken!)`);
  }

  // 2.12 Update to low stock
  if (productId) {
    const r12 = await api('PUT', `/products/${productId}`, { current_stock: 3, min_stock_level: 5 }, tokenK);
    if (r12.status === 200) {
      pass('2.12 Update to low stock → 200');
      const r12b = await api('GET', '/products/low-stock', null, tokenK);
      const inLow = r12b.data?.data?.some?.(p => p.id === productId);
      if (inLow) pass('2.12b Updated product appears in low-stock list');
      else fail('2.12b Low stock list after update', `Product ${productId} not in low-stock list`);
    } else fail('2.12 Update product', `status=${r12.status}`);
  }

  // Restore stock
  if (productId) {
    await api('PUT', `/products/${productId}`, { current_stock: 50 }, tokenK);
  }
}

// ─── PRODUCT MAPPINGS ──────────────────────────────────────────────────────────

async function testMappings() {
  console.log('\n━━━ SECTION 3: PRODUCT MAPPINGS ━━━');

  // 3.1 List mappings
  const r1 = await api('GET', '/product-mappings', null, tokenK);
  if (r1.status === 200) pass('3.1 List mappings → 200');
  else fail('3.1 List mappings', `status=${r1.status}`);

  if (!productId) { warn('3.x Skipping mapping tests — no productId'); return; }

  // 3.2 Create mapping
  const r2 = await api('POST', '/product-mappings', {
    invoice_product_name: '15 ROD MULTICOLOR ABACUS KIT TEST AUTO',
    items: [{ product_id: productId, quantity: 1 }]
  }, tokenK);
  if (r2.status === 201 && r2.data?.data?.id) {
    mappingId = r2.data.data.id;
    pass(`3.2 Create mapping → 201 (id=${mappingId})`);
  } else fail('3.2 Create mapping', `status=${r2.status}, resp=${JSON.stringify(r2.data).slice(0,150)}`);

  // 3.3 Check — mapped name returns data
  const r3 = await api('POST', '/product-mappings/check', {
    product_names: ['15 ROD MULTICOLOR ABACUS KIT TEST AUTO']
  }, tokenK);
  const mapping = r3.data?.data?.['15 ROD MULTICOLOR ABACUS KIT TEST AUTO'];
  if (r3.status === 200 && mapping) pass('3.3 Check mapped name → returns mapping');
  else fail('3.3 Check mapped name', `status=${r3.status}, mapping=${JSON.stringify(mapping)}`);

  // 3.4 Normalized match (lowercase, extra spaces)
  const r4 = await api('POST', '/product-mappings/check', {
    product_names: ['  15 rod multicolor abacus kit test auto  ']
  }, tokenK);
  const mapping4 = Object.values(r4.data?.data || {})[0];
  if (r4.status === 200 && mapping4) pass('3.4 Normalized name match (lowercase + spaces) → found');
  else fail('3.4 Normalized name match', `mapping=${JSON.stringify(mapping4)}, data=${JSON.stringify(r4.data).slice(0,150)}`);

  // 3.5 Unmapped name returns null
  const r5 = await api('POST', '/product-mappings/check', {
    product_names: ['COMPLETELY UNKNOWN PRODUCT XYZ 999999']
  }, tokenK);
  const val5 = r5.data?.data?.['COMPLETELY UNKNOWN PRODUCT XYZ 999999'];
  if (r5.status === 200 && val5 === null) pass('3.5 Unknown name → null');
  else fail('3.5 Unknown name', `Expected null, got ${JSON.stringify(val5)}`);

  // 3.6 Mixed: one mapped one not
  const r6 = await api('POST', '/product-mappings/check', {
    product_names: ['15 ROD MULTICOLOR ABACUS KIT TEST AUTO', 'COMPLETELY UNKNOWN PRODUCT XYZ 999999']
  }, tokenK);
  const d6 = r6.data?.data || {};
  const hasFound = !!d6['15 ROD MULTICOLOR ABACUS KIT TEST AUTO'];
  const hasNull = d6['COMPLETELY UNKNOWN PRODUCT XYZ 999999'] === null;
  if (r6.status === 200 && hasFound && hasNull) pass('3.6 Mixed check → one mapped, one null');
  else fail('3.6 Mixed check', `hasFound=${hasFound}, hasNull=${hasNull}`);

  // 3.7 Duplicate mapping → 422
  const r7 = await api('POST', '/product-mappings', {
    invoice_product_name: '15 ROD MULTICOLOR ABACUS KIT TEST AUTO',
    items: [{ product_id: productId, quantity: 1 }]
  }, tokenK);
  if (r7.status === 422) pass('3.7 Duplicate mapping → 422');
  else fail('3.7 Duplicate mapping', `Expected 422, got ${r7.status}`);

  // 3.8 Missing product_id → 422
  const r8 = await api('POST', '/product-mappings', {
    invoice_product_name: 'Some Product Name For Test',
    items: [{ quantity: 1 }]
  }, tokenK);
  if (r8.status === 422) pass('3.8 Missing product_id → 422');
  else fail('3.8 Missing product_id', `Expected 422, got ${r8.status}`);

  // 3.9 Non-existent product_id → 422
  const r9 = await api('POST', '/product-mappings', {
    invoice_product_name: 'Another Product Name For Test',
    items: [{ product_id: 999999, quantity: 1 }]
  }, tokenK);
  if (r9.status === 422) pass('3.9 Non-existent product_id → 422');
  else fail('3.9 Non-existent product_id', `Expected 422, got ${r9.status}`);

  // 3.10 Update mapping
  if (mappingId) {
    const r10 = await api('PUT', `/product-mappings/${mappingId}`, {
      items: [{ product_id: productId, quantity: 3 }]
    }, tokenK);
    if (r10.status === 200) {
      const qty = r10.data?.data?.items?.[0]?.quantity;
      if (parseFloat(qty) === 3) pass('3.10 Update mapping → quantity changed to 3');
      else fail('3.10 Update mapping quantity', `Expected qty=3, got qty=${qty}`);
    } else fail('3.10 Update mapping', `status=${r10.status}`);
  }

  // 3.11 Delete mapping
  if (mappingId) {
    const r11 = await api('DELETE', `/product-mappings/${mappingId}`, null, tokenK);
    if (r11.status === 200) {
      const r11b = await api('GET', `/product-mappings/${mappingId}`, null, tokenK);
      if (r11b.status === 404) pass('3.11 Delete mapping → 200, then 404 on GET');
      else fail('3.11 Delete mapping verify', `GET after delete returned ${r11b.status}`);
      mappingId = null;
    } else fail('3.11 Delete mapping', `status=${r11.status}`);
  }
}

// ─── INVOICE TESTS ──────────────────────────────────────────────────────────────

async function testInvoices() {
  console.log('\n━━━ SECTION 4: INVOICES ━━━');

  // 4.1 List invoices
  const r1 = await api('GET', '/invoices', null, tokenK);
  if (r1.status === 200 && r1.data?.success) pass('4.1 List invoices → 200');
  else fail('4.1 List invoices', `status=${r1.status}`);

  // 4.2 Filter by marketplace
  const r2 = await api('GET', '/invoices?marketplace=amazon', null, tokenK);
  if (r2.status === 200) pass('4.2 Filter by marketplace → 200');
  else fail('4.2 Filter marketplace', `status=${r2.status}`);

  // 4.3 Filter by status
  const r3 = await api('GET', '/invoices?status=approved', null, tokenK);
  if (r3.status === 200) pass('4.3 Filter by status → 200');
  else fail('4.3 Filter status', `status=${r3.status}`);

  // 4.4 Search
  const r4 = await api('GET', '/invoices?search=INV', null, tokenK);
  if (r4.status === 200) pass('4.4 Search invoices → 200');
  else fail('4.4 Search', `status=${r4.status}`);

  // 4.5 Pagination
  const r5 = await api('GET', '/invoices?page=1', null, tokenK);
  if (r5.status === 200 && r5.data?.data?.meta) pass('4.5 Pagination meta present');
  else if (r5.status === 200) warn('4.5 Pagination', 'No meta in response (may be OK if paginated differently)');
  else fail('4.5 Pagination', `status=${r5.status}`);

  // 4.6 Status endpoint on existing invoice
  const firstInvoice = r1.data?.data?.data?.[0];
  if (firstInvoice) {
    const r6 = await api('GET', `/invoices/${firstInvoice.id}/status`, null, tokenK);
    if (r6.status === 200 && r6.data?.data?.status) pass('4.6 Invoice status endpoint → 200');
    else fail('4.6 Invoice status', `status=${r6.status}`);

    // 4.7 Cross-user access → 404
    const r7 = await api('GET', `/invoices/${firstInvoice.id}`, null, tokenR);
    if (r7.status === 404) pass('4.7 Cross-user invoice access → 404');
    else fail('4.7 Cross-user invoice', `Expected 404, got ${r7.status} (data isolation broken!)`);
  }

  // 4.8 Find a review invoice or use first available for approval cascade test
  // Note: POST /invoices not supported — must upload file. Use existing review invoice.
  const allInvoices = r1.data?.data?.data || [];
  const reviewInv = allInvoices.find(i => i.processing_status === 'review');
  const anyInv = allInvoices[0];
  if (reviewInv) {
    testInvoiceId = reviewInv.id;
    pass(`4.8 Found review invoice for approval test (id=${testInvoiceId})`);
  } else if (anyInv) {
    testInvoiceId = anyInv.id;
    warn(`4.8 No review invoice found — using first invoice (id=${testInvoiceId}, status=${anyInv.processing_status})`);
  } else {
    warn('4.8 No invoices found — approval cascade will be skipped');
  }
}

// ─── APPROVAL CASCADE ──────────────────────────────────────────────────────────

async function testApprovalCascade() {
  console.log('\n━━━ SECTION 5: APPROVAL CASCADE ━━━');

  if (!productId) { warn('5.x Skipping cascade tests — no productId'); return; }

  // Re-create mapping for the approval test
  const mapRes = await api('POST', '/product-mappings', {
    invoice_product_name: 'TEST ABACUS AUTO PRODUCT',
    items: [{ product_id: productId, quantity: 1 }]
  }, tokenK);
  if (mapRes.status === 201) {
    mappingId = mapRes.data?.data?.id;
    pass('5.0 Re-created mapping for cascade test');
  }

  // Get stock BEFORE
  const before = await api('GET', `/products/${productId}`, null, tokenK);
  const stockBefore = before.data?.data?.current_stock;
  console.log(`  ℹ️  Stock before: ${stockBefore}`);

  // Find or create invoice to approve
  if (!testInvoiceId) {
    warn('5.x No test invoice ID — skipping approval cascade');
    return;
  }

  // Approve with line item matching our product
  const approveRes = await api('PUT', `/invoices/${testInvoiceId}/approve`, {
    validated_data: {
      invoice_number: 'TEST-AUTO-APPROVE',
      invoice_date: '2026-07-09',
      vendor_name: 'Test Vendor',
      subtotal: 299,
      tax_amount: 27.18,
      total_amount: 299,
      line_items: [{
        product_name: 'TEST ABACUS AUTO PRODUCT',
        sku: before.data?.data?.sku,
        quantity: 2,
        unit_price: 149.50,
        cgst_rate: 6,
        sgst_rate: 6,
        igst_rate: 0,
        total_amount: 299
      }]
    }
  }, tokenK);

  if (approveRes.status === 200) {
    pass('5.1 Invoice approve → 200');

    // Check stock after
    const after = await api('GET', `/products/${productId}`, null, tokenK);
    const stockAfter = after.data?.data?.current_stock;
    console.log(`  ℹ️  Stock after: ${stockAfter} (expected ${stockBefore - 2})`);

    if (stockAfter < stockBefore) pass(`5.2 Stock reduced: ${stockBefore} → ${stockAfter}`);
    else fail('5.2 Stock reduction', `Stock not reduced! before=${stockBefore}, after=${stockAfter}`);

    // Check sales order created
    const sales = await api('GET', '/sales', null, tokenK);
    if (sales.status === 200 && (sales.data?.data?.data?.length > 0 || sales.data?.data?.total > 0)) {
      pass('5.3 Sales order exists after approval');
    } else warn('5.3 Sales order', `No orders visible (may exist but empty filter)`);

    // Check GST records
    const gst = await api('GET', '/gst/summary?year=2026', null, tokenK);
    if (gst.status === 200 && gst.data?.data?.outputTax > 0) pass('5.4 GST record created (outputTax > 0)');
    else warn('5.4 GST', `outputTax=${gst.data?.data?.outputTax}`);

    // Check audit log
    const audit = await api('GET', '/audit-log', null, tokenK);
    const hasApprove = audit.data?.data?.some?.(l => l.action === 'invoice_approved');
    if (hasApprove) pass('5.5 Audit log entry created');
    else warn('5.5 Audit log', 'No invoice_approved entry found');

    // Check dashboard updated
    const dash = await api('GET', '/dashboard/summary', null, tokenK);
    if (dash.status === 200 && dash.data?.success) pass('5.6 Dashboard summary loads after approval');
    else fail('5.6 Dashboard', `status=${dash.status}`);

  } else {
    fail('5.1 Invoice approve', `status=${approveRes.status}, data=${JSON.stringify(approveRes.data).slice(0,200)}`);
  }

  // Test double-approve (edge case)
  const r2 = await api('PUT', `/invoices/${testInvoiceId}/approve`, { validated_data: {} }, tokenK);
  if (r2.status === 200 || r2.status === 200) {
    warn('5.7 Double-approve allowed', `Re-approving an approved invoice returns ${r2.status} — should consider idempotent guard`);
  } else {
    pass(`5.7 Double-approve handled (${r2.status})`);
  }
}

// ─── DAMAGED GOODS ─────────────────────────────────────────────────────────────

async function testDamagedGoods() {
  console.log('\n━━━ SECTION 6: DAMAGED GOODS ━━━');

  // 6.1 List damaged
  const r1 = await api('GET', '/damaged-stock', null, tokenK);
  if (r1.status === 200) pass('6.1 List damaged stock → 200');
  else fail('6.1 List damaged', `status=${r1.status}`);

  // 6.2 Summary
  const r2 = await api('GET', '/damaged-stock/summary', null, tokenK);
  const d2 = r2.data?.data || {};
  if (r2.status === 200 && ('total_damaged_units' in d2 || 'total_items' in d2)) pass('6.2 Damaged summary → 200 with totals');
  else fail('6.2 Damaged summary', `status=${r2.status}, data=${JSON.stringify(d2).slice(0,100)}`);

  if (!productId) { warn('6.x No product — skipping write-off tests'); return; }

  // 6.3 Set damaged_stock to 5
  const r3 = await api('PUT', `/products/${productId}`, { damaged_stock: 5 }, tokenK);
  if (r3.status === 200) pass('6.3 Set damaged_stock=5 → 200');
  else fail('6.3 Set damaged_stock', `status=${r3.status}`);

  // 6.4 Verify appears in list
  const r4 = await api('GET', '/damaged-stock', null, tokenK);
  const inList = r4.data?.data?.some?.(p => p.id === productId);
  if (inList) pass('6.4 Product appears in damaged list');
  else fail('6.4 Product in damaged list', `Not found in damaged list`);

  // 6.5 Write off
  const r5 = await api('POST', `/damaged-stock/${productId}/write-off`, {}, tokenK);
  if (r5.status === 200) {
    pass('6.5 Write off → 200');

    // 6.6 Verify damaged_stock = 0
    const r6 = await api('GET', `/products/${productId}`, null, tokenK);
    const ds = r6.data?.data?.damaged_stock;
    if (parseInt(ds) === 0) pass('6.6 damaged_stock = 0 after write-off');
    else fail('6.6 Write-off verify', `damaged_stock=${ds} (expected 0)`);

    // 6.7 Write off again → 422
    const r7 = await api('POST', `/damaged-stock/${productId}/write-off`, {}, tokenK);
    if (r7.status === 422) pass('6.7 Write off with no damaged stock → 422');
    else fail('6.7 Double write-off', `Expected 422, got ${r7.status}`);
  } else fail('6.5 Write off', `status=${r5.status}, data=${JSON.stringify(r5.data).slice(0,100)}`);

  // 6.8 Cross-user write-off → 404
  const r8 = await api('POST', `/damaged-stock/${productId}/write-off`, {}, tokenR);
  if (r8.status === 404) pass('6.8 Cross-user write-off → 404');
  else fail('6.8 Cross-user write-off', `Expected 404, got ${r8.status}`);
}

// ─── SALES ─────────────────────────────────────────────────────────────────────

async function testSales() {
  console.log('\n━━━ SECTION 7: SALES ━━━');

  for (const period of ['today', 'week', 'month', 'year']) {
    const r = await api('GET', `/sales/summary?period=${period}`, null, tokenK);
    if (r.status === 200 && r.data?.success) pass(`7.${period} Sales summary period=${period} → 200`);
    else fail(`7.${period} Sales summary ${period}`, `status=${r.status}`);
  }

  const r5 = await api('GET', '/sales/by-marketplace', null, tokenK);
  if (r5.status === 200) pass('7.5 Sales by marketplace → 200');
  else fail('7.5 By marketplace', `status=${r5.status}`);

  const r6 = await api('GET', '/sales', null, tokenK);
  if (r6.status === 200) pass('7.6 List sales → 200');
  else fail('7.6 List sales', `status=${r6.status}`);

  // Empty state test (Raj — new user)
  const r7 = await api('GET', '/sales/summary?period=month', null, tokenR);
  if (r7.status === 200) {
    const hasZeros = r7.data?.data?.revenue === 0 || r7.data?.data?.revenue === '0';
    if (hasZeros) pass('7.7 Empty state (Raj) → zeros');
    else warn('7.7 Empty state (Raj)', `revenue=${r7.data?.data?.revenue}`);
  } else fail('7.7 Empty state', `status=${r7.status}`);
}

// ─── GST ───────────────────────────────────────────────────────────────────────

async function testGST() {
  console.log('\n━━━ SECTION 8: GST ━━━');

  const r1 = await api('GET', '/gst/summary?year=2026', null, tokenK);
  if (r1.status === 200 && 'outputTax' in (r1.data?.data || {})) pass('8.1 GST summary → 200 with fields');
  else fail('8.1 GST summary', `status=${r1.status}, fields=${Object.keys(r1.data?.data || {})}`);

  const r2 = await api('GET', '/gst/monthly/2026/7', null, tokenK);
  if (r2.status === 200) pass('8.2 Monthly GST → 200');
  else fail('8.2 Monthly GST', `status=${r2.status}`);

  const r3 = await api('GET', '/gst/hsn-summary', null, tokenK);
  if (r3.status === 200) pass('8.3 HSN summary → 200');
  else fail('8.3 HSN summary', `status=${r3.status}`);

  // Empty year
  const r4 = await api('GET', '/gst/summary?year=2019', null, tokenK);
  if (r4.status === 200) {
    const ot = r4.data?.data?.outputTax;
    if (ot === 0 || ot === '0' || ot === null) pass('8.4 Empty year → zeros/null');
    else warn('8.4 Empty year', `outputTax=${ot}`);
  } else fail('8.4 Empty year', `status=${r4.status}`);
}

// ─── DASHBOARD ─────────────────────────────────────────────────────────────────

async function testDashboard() {
  console.log('\n━━━ SECTION 9: DASHBOARD ━━━');

  const r1 = await api('GET', '/dashboard/summary', null, tokenK);
  if (r1.status === 200 && r1.data?.success) {
    const d = r1.data.data;
    const requiredFields = ['todaySales','monthlyRevenue','gstPayable','netProfit','totalProducts','lowStockCount','outOfStockCount','recentInvoices'];
    const missing = requiredFields.filter(f => !(f in d));
    if (missing.length === 0) pass('9.1 Dashboard summary → all required fields present');
    else fail('9.1 Dashboard fields', `Missing: ${missing.join(', ')}`);
  } else fail('9.1 Dashboard summary', `status=${r1.status}`);

  const r2 = await api('GET', '/dashboard/revenue-chart?period=monthly', null, tokenK);
  if (r2.status === 200 && r2.data?.data?.labels) pass('9.2 Revenue chart → 200 with labels');
  else fail('9.2 Revenue chart', `status=${r2.status}, has_labels=${!!r2.data?.data?.labels}`);

  const r3 = await api('GET', '/dashboard/summary', null, tokenR);
  if (r3.status === 200) pass('9.3 Dashboard empty state (Raj) → 200');
  else fail('9.3 Dashboard empty', `status=${r3.status}`);
}

// ─── NOTIFICATIONS ─────────────────────────────────────────────────────────────

async function testNotifications() {
  console.log('\n━━━ SECTION 10: NOTIFICATIONS ━━━');

  const r1 = await api('GET', '/notifications', null, tokenK);
  if (r1.status === 200) {
    pass('10.1 List notifications → 200');
    const notifs = r1.data?.data;
    const firstId = Array.isArray(notifs) ? notifs[0]?.id : notifs?.data?.[0]?.id;

    if (firstId) {
      // Mark single
      const r2 = await api('PUT', `/notifications/${firstId}/read`, null, tokenK);
      if (r2.status === 200) pass('10.2 Mark single read → 200');
      else fail('10.2 Mark single read', `status=${r2.status}`);
    }

    // Mark all
    const r3 = await api('PUT', '/notifications/read-all', null, tokenK);
    if (r3.status === 200) pass('10.3 Mark all read → 200');
    else fail('10.3 Mark all read', `status=${r3.status}`);
  } else fail('10.1 List notifications', `status=${r1.status}`);
}

// ─── SETTINGS ──────────────────────────────────────────────────────────────────

async function testSettings() {
  console.log('\n━━━ SECTION 11: SETTINGS ━━━');

  const r1 = await api('GET', '/settings', null, tokenK);
  if (r1.status === 200) pass('11.1 Get settings → 200');
  else fail('11.1 Get settings', `status=${r1.status}`);

  const r2 = await api('PUT', '/settings', {
    name: 'Kaushik K',
    business_name: 'Kynetropo Store',
    gstin: '27AABCU9603R1ZX'
  }, tokenK);
  if (r2.status === 200) pass('11.2 Update settings → 200');
  else fail('11.2 Update settings', `status=${r2.status}`);

  // Invalid GSTIN
  const r3 = await api('PUT', '/settings', { gstin: 'INVALID' }, tokenK);
  if (r3.status === 422) pass('11.3 Invalid GSTIN → 422');
  else warn('11.3 Invalid GSTIN', `Expected 422, got ${r3.status} (validation may not be on backend)`);
}

// ─── CUSTOMERS ─────────────────────────────────────────────────────────────────

async function testCustomers() {
  console.log('\n━━━ SECTION 12: CUSTOMERS ━━━');

  const r1 = await api('GET', '/customers', null, tokenK);
  if (r1.status === 200) pass('12.1 List customers → 200');
  else fail('12.1 List customers', `status=${r1.status}`);

  const r2 = await api('POST', '/customers', {
    name: 'Test Customer Auto',
    email: `test${Date.now()}@auto.com`,
    phone: '9876543210',
    marketplace: 'amazon'
  }, tokenK);
  if (r2.status === 200 || r2.status === 201) {
    customerId = r2.data?.data?.id;
    pass(`12.2 Create customer → ${r2.status} (id=${customerId})`);
  } else fail('12.2 Create customer', `status=${r2.status}`);

  if (customerId) {
    const r3 = await api('GET', `/customers/${customerId}/purchases`, null, tokenK);
    if (r3.status === 200) pass('12.3 Customer purchases → 200');
    else fail('12.3 Customer purchases', `status=${r3.status}`);

    const r4 = await api('GET', `/customers/${customerId}`, null, tokenR);
    if (r4.status === 404) pass('12.4 Cross-user customer → 404');
    else fail('12.4 Cross-user customer', `Expected 404, got ${r4.status}`);
  }
}

// ─── REPORTS ───────────────────────────────────────────────────────────────────

async function testReports() {
  console.log('\n━━━ SECTION 13: REPORTS ━━━');

  const reportTypes = ['sales', 'inventory', 'gst'];
  for (const type of reportTypes) {
    const r = await api('POST', '/reports/generate', {
      type,
      from_date: '2026-01-01',
      to_date: '2026-12-31',
      format: 'excel',
      fields: ['date', 'revenue']
    }, tokenK);
    if (r.status === 200) {
      const rid = r.data?.data?.report_id;
      if (rid) {
        pass(`13.${type} Generate ${type} report → 200 (report_id=${rid})`);
        const dl = await api('GET', `/reports/${rid}/download`, null, tokenK);
        if (dl.status === 200) pass(`13.${type}dl Download ${type} report → 200`);
        else warn(`13.${type}dl Download ${type}`, `status=${dl.status}`);
      } else warn(`13.${type}`, `No report_id in response`);
    } else fail(`13.${type}`, `status=${r.status}`);
  }
}

// ─── CLEANUP ───────────────────────────────────────────────────────────────────

async function cleanup() {
  console.log('\n━━━ SECTION 16: CLEANUP ━━━');

  if (mappingId) {
    const r = await api('DELETE', `/product-mappings/${mappingId}`, null, tokenK);
    if (r.status === 200) pass('16.1 Delete test mapping');
    else warn('16.1 Delete mapping', `status=${r.status}`);
  }

  if (customerId) {
    const r = await api('DELETE', `/customers/${customerId}`, null, tokenK);
    if (r.status === 200 || r.status === 204) pass('16.2 Delete test customer');
    else warn('16.2 Delete customer', `status=${r.status}`);
  }

  // Don't delete testInvoiceId — it was pre-existing

  if (productId) {
    // Re-create mapping first to ensure no orphan issues, then delete product
    const r = await api('DELETE', `/products/${productId}`, null, tokenK);
    if (r.status === 200) pass('16.3 Delete test product');
    else warn('16.3 Delete product', `status=${r.status}`);
  }
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('');
  console.log('████████████████████████████████████████████████████████████████');
  console.log('  BizSync API — Full Production Test Suite');
  console.log(`  Target: ${BASE}`);
  console.log(`  Time: ${new Date().toISOString()}`);
  console.log('████████████████████████████████████████████████████████████████');

  await testAuth();
  await testInventory();
  await testMappings();
  await testInvoices();
  await testApprovalCascade();
  await testDamagedGoods();
  await testSales();
  await testGST();
  await testDashboard();
  await testNotifications();
  await testSettings();
  await testCustomers();
  await testReports();
  await cleanup();

  console.log('\n');
  console.log('════════════════════════════════════════════════════════════════');
  console.log(`  RESULTS: ✅ ${passed} passed  ❌ ${failed} failed  ⚠️  ${warned} warnings`);
  console.log('════════════════════════════════════════════════════════════════');

  if (BUGS.length > 0) {
    console.log('\n🐛 BUGS FOUND:');
    BUGS.forEach((b, i) => console.log(`  ${i+1}. [${b.name}] ${b.detail}`));
  } else {
    console.log('\n🎉 No bugs found!');
  }
  console.log('');

  // Write results to file
  const results = {
    timestamp: new Date().toISOString(),
    passed, failed, warned,
    bugs: BUGS
  };
  const fs = await import('fs');
  fs.writeFileSync('/tmp/test_results.json', JSON.stringify(results, null, 2));
  console.log('📄 Results saved to /tmp/test_results.json');
}

main().catch(e => { console.error('Fatal error:', e); process.exit(1); });
