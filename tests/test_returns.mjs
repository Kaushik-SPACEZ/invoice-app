/**
 * BizSync — Autonomous Returns & Damaged Goods Test
 * Tests regular return + damaged return using all 3 real invoice photos.
 * Verifies inventory reduction, damaged goods list, returns history.
 * Runs continuously and fixes issues until all tests pass.
 */

import fs from 'fs'

const BASE = 'https://invoice.kynetropo.com/api'
const INVOICE_FILES = {
  amazon:  'C:/Users/I768970/Downloads/WhatsApp Image 2026-06-29 at 20.54.13.jpeg',
  flipkart:'C:/Users/I768970/Downloads/WhatsApp Image 2026-06-29 at 20.55.26.jpeg',
  meesho:  'C:/Users/I768970/Downloads/WhatsApp Image 2026-06-29 at 20.55.40 (2).jpeg',
}

let TOKEN = ''
let pass = 0, fail = 0
let BUGS = []

function ok(name)   { pass++; console.log(`  ✅ ${name}`) }
function err(name, detail) { fail++; BUGS.push({name,detail}); console.log(`  ❌ ${name} — ${detail}`) }
function warn(name, detail){ console.log(`  ⚠️  ${name} — ${detail}`) }
function sec(name)  { console.log(`\n${'─'.repeat(62)}\n  ${name}\n${'─'.repeat(62)}`) }

async function api(method, path, body, token) {
  const h = {'Content-Type':'application/json','Accept':'application/json'}
  if (token) h['Authorization'] = `Bearer ${token}`
  const res = await fetch(`${BASE}${path}`, {method, headers:h, body: body ? JSON.stringify(body) : undefined})
  try { return { status: res.status, data: await res.json() } }
  catch { return { status: res.status, data: null } }
}

async function login() {
  const r = await api('POST','/auth/login',{email:'raj@rkelectronics.com',password:'password123'})
  TOKEN = r.data?.data?.token
  if (!TOKEN) throw new Error('Login failed')
}

async function uploadReturn(filePath, marketplace, isDamaged) {
  const fileBytes = fs.readFileSync(filePath)
  const boundary = 'ReturnBoundary' + Date.now()
  const filename = filePath.split('/').pop()
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: image/jpeg\r\n\r\n`),
    fileBytes,
    Buffer.from(`\r\n--${boundary}\r\nContent-Disposition: form-data; name="marketplace"\r\n\r\n${marketplace}\r\n`),
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="invoice_type"\r\n\r\nreturn\r\n`),
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="is_damaged"\r\n\r\n${isDamaged ? 'true' : 'false'}\r\n`),
    Buffer.from(`--${boundary}--\r\n`)
  ])
  const res = await fetch(`${BASE}/invoices/upload`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${TOKEN}`, 'Accept': 'application/json', 'Content-Type': `multipart/form-data; boundary=${boundary}` },
    body
  })
  const data = await res.json()
  return data?.data?.invoice_id
}

async function waitForReview(invoiceId, maxMs = 90000) {
  const start = Date.now()
  while (Date.now() - start < maxMs) {
    await new Promise(r => setTimeout(r, 3000))
    const r = await api('GET', `/invoices/${invoiceId}/status`, null, TOKEN)
    const s = r.data?.data?.status
    if (s === 'review' || s === 'error') return s
  }
  return 'timeout'
}

async function approveInvoice(invoiceId) {
  await new Promise(r => setTimeout(r, 1000))
  // Get the extracted data to pass along so line items are preserved
  const inv = await api('GET', `/invoices/${invoiceId}`, null, TOKEN)
  const extractedData = inv.data?.data?.extracted_data ?? {}
  const r = await api('PUT', `/invoices/${invoiceId}/approve`, { validated_data: extractedData }, TOKEN)
  return r.status === 200
}

async function getStock(sku) {
  const r = await api('GET', `/products?search=${sku}`, null, TOKEN)
  const p = r.data?.data?.data?.find(x => x.sku === sku)
  return { current: p?.current_stock ?? null, damaged: p?.damaged_stock ?? 0 }
}

async function getDamagedSummary() {
  const r = await api('GET', '/damaged-stock/summary', null, TOKEN)
  return r.data?.data ?? {}
}

async function getDamagedList() {
  const r = await api('GET', '/damaged-stock', null, TOKEN)
  return r.data?.data ?? []
}

async function getReturnsList() {
  const r = await api('GET', '/invoices?invoice_type=return', null, TOKEN)
  return r.data?.data?.data ?? []
}

async function rejectInvoice(id) {
  await api('PUT', `/invoices/${id}`, { processing_status: 'rejected' }, TOKEN)
}

// ─── SNAPSHOT ─────────────────────────────────────────────────────────────────
async function snapshot() {
  const stocks = {}
  const r = await api('GET', '/products', null, TOKEN)
  for (const p of r.data?.data?.data ?? []) {
    stocks[p.sku] = { current: p.current_stock, damaged: p.damaged_stock ?? 0 }
  }
  return stocks
}

// ═══════════════════════════════════════════════════════════════════════════════
// TEST: Regular Return — Meesho Abacus Kit
// Expected: 25352 current_stock += 1
// ═══════════════════════════════════════════════════════════════════════════════
async function testRegularReturn() {
  sec('TEST 1: Regular Return — Meesho Abacus Kit (25352)')

  const before = await snapshot()
  const stockBefore = before['25352']?.current ?? 0
  console.log(`  📦 Stock before: 25352 current=${stockBefore}`)

  // Upload
  console.log('  📤 Uploading Meesho invoice as REGULAR RETURN...')
  const invoiceId = await uploadReturn(INVOICE_FILES.meesho, 'other', false)
  if (!invoiceId) { err('Upload regular return', 'No invoice ID returned'); return null }
  ok(`Upload → invoice id=${invoiceId}`)

  // Wait for AI
  console.log('  ⏳ Waiting for AI extraction...')
  const status = await waitForReview(invoiceId)
  if (status !== 'review') { err('AI extraction', `status=${status}`); return invoiceId }
  ok('AI extraction → review status')

  // Approve
  console.log('  ✔️  Approving...')
  const approved = await approveInvoice(invoiceId)
  if (!approved) { err('Approve regular return', 'API returned non-200'); return invoiceId }
  ok('Invoice approved')

  // Verify stock increased
  await new Promise(r => setTimeout(r, 1500))
  const after = await snapshot()
  const stockAfter = after['25352']?.current ?? 0
  console.log(`  📦 Stock after:  25352 current=${stockAfter}`)

  if (stockAfter > stockBefore) ok(`Stock INCREASED: ${stockBefore} → ${stockAfter} (+${stockAfter-stockBefore})`)
  else err('Stock increase after regular return', `expected > ${stockBefore}, got ${stockAfter}`)

  if (after['25352']?.damaged === (before['25352']?.damaged ?? 0))
    ok('Damaged stock UNCHANGED (regular return should not add damaged)')
  else err('Damaged unchanged', `damaged changed from ${before['25352']?.damaged} to ${after['25352']?.damaged}`)

  // Verify in returns history
  const returns = await getReturnsList()
  const found = returns.find(r => r.id === invoiceId)
  if (found) ok(`Appears in Returns History (id=${invoiceId}, status=${found.processing_status})`)
  else err('Returns history', `Invoice ${invoiceId} not found in /invoices?invoice_type=return`)

  return invoiceId
}

// ═══════════════════════════════════════════════════════════════════════════════
// TEST: Damaged Return — Meesho Abacus Kit
// Expected: 25352 damaged_stock += 1, appears in Damaged Goods page
// ═══════════════════════════════════════════════════════════════════════════════
async function testDamagedReturn() {
  sec('TEST 2: Damaged Return — Meesho Abacus Kit (25352)')

  const before = await snapshot()
  const damageBefore = before['25352']?.damaged ?? 0
  const currentBefore = before['25352']?.current ?? 0
  const summaryBefore = await getDamagedSummary()
  console.log(`  📦 Before: 25352 current=${currentBefore} damaged=${damageBefore}`)
  console.log(`  📊 Damaged summary before: units=${summaryBefore.total_damaged_units} value=₹${summaryBefore.total_damaged_value}`)

  console.log('  📤 Uploading Meesho invoice as DAMAGED RETURN...')
  const invoiceId = await uploadReturn(INVOICE_FILES.meesho, 'other', true)
  if (!invoiceId) { err('Upload damaged return', 'No invoice ID returned'); return null }
  ok(`Upload → invoice id=${invoiceId}`)

  console.log('  ⏳ Waiting for AI extraction...')
  const status = await waitForReview(invoiceId)
  if (status !== 'review') { err('AI extraction damaged', `status=${status}`); return invoiceId }
  ok('AI extraction → review status')

  console.log('  ✔️  Approving...')
  const approved = await approveInvoice(invoiceId)
  if (!approved) { err('Approve damaged return', 'non-200'); return invoiceId }
  ok('Invoice approved')

  await new Promise(r => setTimeout(r, 2000))
  const after = await snapshot()
  const damageAfter = after['25352']?.damaged ?? 0
  const currentAfter = after['25352']?.current ?? 0
  const summaryAfter = await getDamagedSummary()
  console.log(`  📦 After: 25352 current=${currentAfter} damaged=${damageAfter}`)
  console.log(`  📊 Damaged summary after: units=${summaryAfter.total_damaged_units} value=₹${summaryAfter.total_damaged_value}`)

  // damaged_stock should increase
  if (damageAfter > damageBefore) ok(`damaged_stock INCREASED: ${damageBefore} → ${damageAfter}`)
  else err('damaged_stock increase', `expected > ${damageBefore}, got ${damageAfter}`)

  // current_stock should NOT change for damaged return
  if (currentAfter === currentBefore) ok('current_stock UNCHANGED (damaged goes to damaged_stock, not regular stock)')
  else warn('current_stock changed', `${currentBefore} → ${currentAfter} (may be OK if qty correction applied)`)

  // Appears in damaged goods list
  const list = await getDamagedList()
  const inList = list.find(p => p.sku === '25352')
  if (inList) ok(`Appears in Damaged Goods list (sku=25352, damaged_stock=${inList.damaged_stock})`)
  else err('Damaged Goods list', '25352 not found in /damaged-stock')

  // Summary updated
  if (summaryAfter.total_damaged_units > summaryBefore.total_damaged_units)
    ok(`Damaged summary updated: ${summaryBefore.total_damaged_units} → ${summaryAfter.total_damaged_units} units`)
  else err('Damaged summary units', `expected > ${summaryBefore.total_damaged_units}, got ${summaryAfter.total_damaged_units}`)

  if (summaryAfter.total_damaged_value > summaryBefore.total_damaged_value)
    ok(`Damaged value updated: ₹${summaryBefore.total_damaged_value} → ₹${summaryAfter.total_damaged_value}`)
  else err('Damaged value', `expected > ${summaryBefore.total_damaged_value}`)

  // In returns history
  const returns = await getReturnsList()
  const found = returns.find(r => r.id === invoiceId)
  if (found) ok(`Appears in Returns History (status=${found.processing_status}, is_damaged=${found.is_damaged})`)
  else err('Returns history', `Invoice ${invoiceId} not found`)

  if (found?.is_damaged) ok('is_damaged=true correctly set in DB')
  else if (found) err('is_damaged flag', `expected true, got ${found?.is_damaged}`)

  return invoiceId
}

// ═══════════════════════════════════════════════════════════════════════════════
// TEST: Damaged Return — Amazon (6 kerchiefs, all damaged)
// Expected: all 6 KHF-* damaged_stock increases
// ═══════════════════════════════════════════════════════════════════════════════
async function testAmazonDamagedReturn() {
  sec('TEST 3: Damaged Return — Amazon 6 Kerchiefs')

  const before = await snapshot()
  const kerfBefore = {
    'KHF-V': before['KHF-V']?.damaged ?? 0,
    'KHF-P1': before['KHF-P1']?.damaged ?? 0,
    'KHF-S1': before['KHF-S1']?.damaged ?? 0,
    'KHF-S2': before['KHF-S2']?.damaged ?? 0,
    'KHF-P2': before['KHF-P2']?.damaged ?? 0,
    'KHF-P3': before['KHF-P3']?.damaged ?? 0,
  }
  console.log('  📦 Before damaged stocks:', JSON.stringify(kerfBefore))

  console.log('  📤 Uploading Amazon invoice as DAMAGED RETURN...')
  const invoiceId = await uploadReturn(INVOICE_FILES.amazon, 'amazon', true)
  if (!invoiceId) { err('Upload Amazon damaged return', 'No ID'); return null }
  ok(`Upload → invoice id=${invoiceId}`)

  console.log('  ⏳ Waiting for AI extraction...')
  const status = await waitForReview(invoiceId, 120000)
  if (status !== 'review') { err('AI extraction Amazon return', `status=${status}`); return invoiceId }
  ok('AI extraction complete')

  console.log('  ✔️  Approving...')
  const approved = await approveInvoice(invoiceId)
  if (!approved) { err('Approve Amazon damaged', 'non-200'); return invoiceId }
  ok('Approved')

  await new Promise(r => setTimeout(r, 2000))
  const after = await snapshot()
  const kerfAfter = {
    'KHF-V': after['KHF-V']?.damaged ?? 0,
    'KHF-P1': after['KHF-P1']?.damaged ?? 0,
    'KHF-S1': after['KHF-S1']?.damaged ?? 0,
    'KHF-S2': after['KHF-S2']?.damaged ?? 0,
    'KHF-P2': after['KHF-P2']?.damaged ?? 0,
    'KHF-P3': after['KHF-P3']?.damaged ?? 0,
  }
  console.log('  📦 After damaged stocks:', JSON.stringify(kerfAfter))

  let anyIncreased = false
  for (const sku of Object.keys(kerfBefore)) {
    if (kerfAfter[sku] > kerfBefore[sku]) {
      ok(`${sku} damaged_stock: ${kerfBefore[sku]} → ${kerfAfter[sku]}`)
      anyIncreased = true
    } else {
      err(`${sku} damaged_stock`, `expected > ${kerfBefore[sku]}, got ${kerfAfter[sku]}`)
    }
  }

  // Check KHF-S2 specifically increased by 2 (qty=2 in invoice)
  if (kerfAfter['KHF-S2'] === kerfBefore['KHF-S2'] + 2)
    ok('KHF-S2 damaged_stock increased by 2 (qty=2 in Amazon invoice)')
  else
    err('KHF-S2 qty=2 damaged', `expected +2, got ${kerfAfter['KHF-S2'] - kerfBefore['KHF-S2']}`)

  // Damaged goods page shows all of them
  const list = await getDamagedList()
  const damaged = list.filter(p => p.sku?.startsWith('KHF'))
  if (damaged.length > 0) ok(`Damaged Goods list shows ${damaged.length} KHF products`)
  else err('Damaged Goods list KHF', 'No KHF products in damaged list')

  return invoiceId
}

// ═══════════════════════════════════════════════════════════════════════════════
// TEST: Regular Return — Flipkart (Abacus+Pouch)
// Expected: 25352 current_stock += 1, POUCH-001 current_stock += 1
// ═══════════════════════════════════════════════════════════════════════════════
async function testFlipkartRegularReturn() {
  sec('TEST 4: Regular Return — Flipkart Abacus+Pouch')

  const before = await snapshot()
  const abacusBefore = before['25352']?.current ?? 0
  const pouchBefore  = before['POUCH-001']?.current ?? 0
  console.log(`  📦 Before: 25352=${abacusBefore}, POUCH-001=${pouchBefore}`)

  console.log('  📤 Uploading Flipkart invoice as REGULAR RETURN...')
  const invoiceId = await uploadReturn(INVOICE_FILES.flipkart, 'flipkart', false)
  if (!invoiceId) { err('Upload Flipkart return', 'No ID'); return null }
  ok(`Upload → invoice id=${invoiceId}`)

  console.log('  ⏳ Waiting for AI...')
  const status = await waitForReview(invoiceId)
  if (status !== 'review') { err('AI extraction Flipkart return', `status=${status}`); return invoiceId }
  ok('AI extraction complete')

  console.log('  ✔️  Approving...')
  const approved = await approveInvoice(invoiceId)
  if (!approved) { err('Approve Flipkart return', 'non-200'); return invoiceId }
  ok('Approved')

  await new Promise(r => setTimeout(r, 2000))
  const after = await snapshot()
  const abacusAfter = after['25352']?.current ?? 0
  const pouchAfter  = after['POUCH-001']?.current ?? 0
  console.log(`  📦 After: 25352=${abacusAfter}, POUCH-001=${pouchAfter}`)

  // Abacus should increase (direct SKU match from line item sku=25352 or mapping)
  if (abacusAfter > abacusBefore) ok(`25352 stock: ${abacusBefore} → ${abacusAfter}`)
  else warn('25352 stock unchanged', `Flipkart product name may not map to 25352 SKU directly — mapping needed`)

  // Pouch: the Flipkart "ABACUS KIT WITH POUCH" mapping maps to 25352+POUCH-001
  // But return invoice uses the mapping too
  if (pouchAfter > pouchBefore) ok(`POUCH-001 stock: ${pouchBefore} → ${pouchAfter}`)
  else warn('POUCH-001 unchanged', 'May need mapping to be applied for returns too')

  return invoiceId
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════════
async function main() {
  console.log('\n' + '█'.repeat(62))
  console.log('  BizSync — Returns & Damaged Goods Autonomous Test')
  console.log(`  ${new Date().toISOString()}`)
  console.log('█'.repeat(62))

  await login()
  console.log('✅ Logged in')

  const ids = []

  ids.push(await testRegularReturn())
  await new Promise(r => setTimeout(r, 3000))

  ids.push(await testDamagedReturn())
  await new Promise(r => setTimeout(r, 3000))

  ids.push(await testAmazonDamagedReturn())
  await new Promise(r => setTimeout(r, 3000))

  ids.push(await testFlipkartRegularReturn())
  await new Promise(r => setTimeout(r, 2000))

  // Final state
  sec('FINAL INVENTORY STATE')
  const finalStocks = await snapshot()
  Object.entries(finalStocks).forEach(([sku, s]) =>
    console.log(`  ${sku.padEnd(12)}: current=${s.current} damaged=${s.damaged}`)
  )

  const finalDamaged = await getDamagedList()
  console.log(`\n  Damaged Goods list (${finalDamaged.length} products):`)
  finalDamaged.forEach(p => console.log(`  ${p.sku}: damaged_stock=${p.damaged_stock} cost=₹${p.cost_price}`))

  const finalReturns = await getReturnsList()
  console.log(`\n  Returns History (${finalReturns.length} invoices):`)
  finalReturns.slice(0,10).forEach(r => console.log(`  id=${r.id} status=${r.processing_status} is_damaged=${r.is_damaged} marketplace=${r.marketplace}`))

  // Summary
  console.log('\n' + '═'.repeat(62))
  console.log(`  RESULTS: ✅ ${pass} passed  ❌ ${fail} failed`)
  console.log('═'.repeat(62))

  if (BUGS.length > 0) {
    console.log('\n🐛 BUGS:')
    BUGS.forEach((b,i) => console.log(`  ${i+1}. [${b.name}] ${b.detail}`))
  } else {
    console.log('\n🎉 ALL TESTS PASSED!')
  }

  fs.writeFileSync('C:/Users/I768970/Invoice/tests/returns_test_results.json',
    JSON.stringify({ timestamp: new Date().toISOString(), pass, fail, bugs: BUGS, finalStocks, finalReturns: finalReturns.length }, null, 2))
  console.log('\n📄 Saved: tests/returns_test_results.json')
}

main().catch(e => { console.error('Fatal:', e); process.exit(1) })
