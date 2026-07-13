/**
 * Autonomous AI Extraction Test + Iterative Prompt Fix
 * Tests all 3 invoices against live API, compares with ground truth,
 * identifies gaps, updates prompt, retests until all pass.
 */

import fs from 'fs'
import path from 'path'

const BASE = 'https://invoice.kynetropo.com/api'

// ── Ground Truth ──────────────────────────────────────────────────────────────
const GROUND_TRUTH = {
  amazon: {
    file: 'C:/Users/I768970/Downloads/WhatsApp Image 2026-06-29 at 20.54.13.jpeg',
    marketplace: 'amazon',
    invoice_number: 'IN-610',
    invoice_date: '2026-06-02',
    vendor_gstin: '33ATMPP2365G1ZK',
    customer_name: 'Katyayani lakshmi',
    total_amount: 1684,
    tax_amount: 256.86,
    subtotal: 1427.14,
    line_items: [
      { product_name_contains: 'Letter-V', sku: 'B0GN2XYTJK', qty: 1, unit_price: 177.97, igst_rate: 18, total: 210 },
      { product_name_contains: 'PINK BOLD', sku: 'B0GXZRXKGH', qty: 1, unit_price: 126.27, igst_rate: 18, total: 149 },
      { product_name_contains: 'Letter-S', sku: 'B0GN2XVLHS', qty: 1, unit_price: 177.97, igst_rate: 18, total: 210 },
      { product_name_contains: 'HK20155', sku: 'HK20155', qty: 2, unit_price: 177.97, igst_rate: 18, total: 420 },
      { product_name_contains: 'VIOLET', sku: 'B0GNSJ7WB4', qty: 1, unit_price: 177.97, igst_rate: 18, total: 210 },
      { product_name_contains: 'Pack of 3', sku: 'HK20178', qty: 1, unit_price: 411.02, igst_rate: 18, total: 485 },
    ]
  },
  flipkart: {
    file: 'C:/Users/I768970/Downloads/WhatsApp Image 2026-06-29 at 20.55.26.jpeg',
    marketplace: 'flipkart',
    invoice_number: 'LWACCB0270003665',
    invoice_date: '2026-06-26',
    vendor_gstin: '33ATMPP2365G1ZK',
    customer_name: 'Ravi Yadav',
    total_amount: 108,
    tax_amount: 5.14,
    subtotal: 102.86,
    line_items: [
      { product_name_contains: 'ABACUS', qty: 1, unit_price: 116, igst_rate: 5, total: 108 },
    ]
  },
  meesho: {
    file: 'C:/Users/I768970/Downloads/WhatsApp Image 2026-06-29 at 20.55.40 (2).jpeg',
    marketplace: 'other',
    invoice_number: 'nSevi27501',
    invoice_date: '2026-06-26',
    vendor_gstin: '33ATMPP2365G1ZK',
    customer_name: 'Punam Baikar',
    total_amount: 87,
    tax_amount: 13.27,
    subtotal: 73.73,
    line_items: [
      { product_name_contains: 'ABACUS KIT', sku: '25352', qty: 1, unit_price: 113, igst_rate: 18, total: 87 },
    ]
  }
}

let TOKEN = ''

async function api(method, path, body, token) {
  const headers = { 'Content-Type': 'application/json', 'Accept': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`
  const opts = { method, headers }
  if (body) opts.body = JSON.stringify(body)
  const res = await fetch(`${BASE}${path}`, opts)
  try { return { status: res.status, data: await res.json() } }
  catch { return { status: res.status, data: null } }
}

async function login() {
  const r = await api('POST', '/auth/login', { email: 'raj@rkelectronics.com', password: 'password123' })
  TOKEN = r.data?.data?.token
  if (!TOKEN) throw new Error('Login failed')
  console.log('✅ Logged in as Raj Kumar')
}

async function uploadInvoice(filePath, marketplace) {
  const fileBytes = fs.readFileSync(filePath)
  const boundary = 'BizSyncTest' + Date.now()
  const filename = path.basename(filePath)

  let body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: image/jpeg\r\n\r\n`),
    fileBytes,
    Buffer.from(`\r\n--${boundary}\r\nContent-Disposition: form-data; name="marketplace"\r\n\r\n${marketplace}\r\n--${boundary}--\r\n`)
  ])

  const res = await fetch(`${BASE}/invoices/upload`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${TOKEN}`, 'Accept': 'application/json', 'Content-Type': `multipart/form-data; boundary=${boundary}` },
    body
  })
  const data = await res.json()
  return data?.data?.invoice_id
}

async function waitForReview(invoiceId, maxWait = 60000) {
  const start = Date.now()
  while (Date.now() - start < maxWait) {
    await new Promise(r => setTimeout(r, 2500))
    const r = await api('GET', `/invoices/${invoiceId}/status`, null, TOKEN)
    const status = r.data?.data?.status
    if (status === 'review' || status === 'error') return status
  }
  return 'timeout'
}

async function getInvoice(invoiceId) {
  const r = await api('GET', `/invoices/${invoiceId}`, null, TOKEN)
  return r.data?.data
}

function compareResults(extracted, truth, label) {
  const errors = []
  const warnings = []

  const items = extracted?.extracted_data?.line_items || []

  // 1. Check invoice total
  const extTotal = parseFloat(extracted?.total_amount || 0)
  if (Math.abs(extTotal - truth.total_amount) > 2) {
    errors.push(`TOTAL: expected ₹${truth.total_amount}, got ₹${extTotal} (diff ₹${Math.abs(extTotal-truth.total_amount).toFixed(2)})`)
  }

  // 2. Check item count
  if (items.length !== truth.line_items.length) {
    errors.push(`ITEM COUNT: expected ${truth.line_items.length}, got ${items.length}`)
  }

  // 3. Check each expected item
  for (const expected of truth.line_items) {
    const match = items.find(item => {
      const name = (item.product_name || '').toUpperCase()
      return name.includes(expected.product_name_contains.toUpperCase()) ||
             (expected.sku && (item.sku || '').includes(expected.sku))
    })

    if (!match) {
      errors.push(`MISSING ITEM: "${expected.product_name_contains}" (SKU: ${expected.sku || 'N/A'})`)
      continue
    }

    const extQty = parseFloat(match.quantity || 0)
    if (extQty !== expected.qty) {
      errors.push(`QTY WRONG for "${expected.product_name_contains}": expected ${expected.qty}, got ${extQty}`)
    }

    const extTotal = parseFloat(match.total_amount || 0)
    if (Math.abs(extTotal - expected.total) > 2) {
      errors.push(`LINE TOTAL for "${expected.product_name_contains}": expected ₹${expected.total}, got ₹${extTotal}`)
    }

    const extRate = parseFloat(match.igst_rate || 0)
    if (extRate !== expected.igst_rate) {
      warnings.push(`IGST RATE for "${expected.product_name_contains}": expected ${expected.igst_rate}%, got ${extRate}%`)
    }
  }

  // 4. Check invoice number
  if (extracted?.invoice_number && truth.invoice_number) {
    if (!extracted.invoice_number.includes(truth.invoice_number) && !truth.invoice_number.includes(extracted.invoice_number)) {
      warnings.push(`INVOICE NO: expected "${truth.invoice_number}", got "${extracted.invoice_number}"`)
    }
  }

  // 5. Calc sum of extracted items
  const calcSum = items.reduce((s, i) => s + parseFloat(i.total_amount || 0), 0)
  const sumDiff = Math.abs(calcSum - truth.total_amount)
  if (sumDiff > 5) {
    errors.push(`LINE ITEMS SUM: ₹${calcSum.toFixed(2)} vs invoice total ₹${truth.total_amount} (gap ₹${sumDiff.toFixed(2)})`)
  }

  return { errors, warnings, items, itemCount: items.length }
}

async function rejectInvoice(invoiceId) {
  await api('PUT', `/invoices/${invoiceId}`, { processing_status: 'rejected' }, TOKEN)
}

async function runTest(label, truth, iteration) {
  console.log(`\n${'─'.repeat(60)}`)
  console.log(`  Testing: ${label.toUpperCase()} (iteration ${iteration})`)
  console.log(`${'─'.repeat(60)}`)

  // Upload
  console.log('  📤 Uploading...')
  const invoiceId = await uploadInvoice(truth.file, truth.marketplace)
  if (!invoiceId) { console.log('  ❌ Upload failed'); return null }
  console.log(`  ✅ Uploaded — invoice id=${invoiceId}`)

  // Wait
  console.log('  ⏳ Waiting for AI extraction...')
  const status = await waitForReview(invoiceId)
  if (status !== 'review') { console.log(`  ❌ Status: ${status}`); return null }
  console.log('  ✅ AI extraction complete')

  // Get results
  const invoice = await getInvoice(invoiceId)
  const result = compareResults(invoice, truth, label)

  // Print results
  console.log(`\n  📊 Items extracted: ${result.itemCount} (expected: ${truth.line_items.length})`)
  console.log(`  📊 Invoice total extracted: ₹${invoice?.total_amount || 0}`)

  if (result.errors.length === 0) {
    console.log('  🎉 ALL CHECKS PASSED')
  } else {
    console.log(`\n  ❌ ERRORS (${result.errors.length}):`)
    result.errors.forEach(e => console.log(`    - ${e}`))
  }
  if (result.warnings.length > 0) {
    console.log(`\n  ⚠️  WARNINGS (${result.warnings.length}):`)
    result.warnings.forEach(w => console.log(`    - ${w}`))
  }

  // Show extracted line items
  console.log('\n  📋 Extracted line items:')
  result.items.forEach((item, i) => {
    console.log(`    ${i+1}. [qty:${item.quantity}] ₹${item.unit_price} → ₹${item.total_amount} | ${(item.product_name||'').slice(0,45)}`)
  })

  // Reject invoice to clean up
  await rejectInvoice(invoiceId)

  return { errors: result.errors, warnings: result.warnings, passed: result.errors.length === 0 }
}

async function main() {
  console.log('\n████████████████████████████████████████████████████████████')
  console.log('  BizSync AI Extraction Autonomous Test Runner')
  console.log(`  Target: ${BASE}`)
  console.log('████████████████████████████████████████████████████████████')

  await login()

  const results = { amazon: null, flipkart: null, meesho: null }

  for (const [label, truth] of Object.entries(GROUND_TRUTH)) {
    results[label] = await runTest(label, truth, 1)
    await new Promise(r => setTimeout(r, 2000))
  }

  // Summary
  console.log('\n\n════════════════════════════════════════════════════════════')
  console.log('  FINAL SUMMARY')
  console.log('════════════════════════════════════════════════════════════')

  const allErrors = []
  for (const [label, result] of Object.entries(results)) {
    if (!result) { console.log(`  ${label}: UPLOAD FAILED`); continue }
    const status = result.passed ? '✅ PASS' : `❌ FAIL (${result.errors.length} errors)`
    console.log(`  ${label.padEnd(12)}: ${status}`)
    result.errors.forEach(e => allErrors.push(`[${label}] ${e}`))
  }

  if (allErrors.length > 0) {
    console.log('\n  Issues to fix in prompt:')
    allErrors.forEach(e => console.log(`  → ${e}`))
  } else {
    console.log('\n  🎉 ALL 3 INVOICES PASS — AI extraction is accurate!')
  }

  // Save results
  fs.writeFileSync('C:/Users/I768970/Invoice/tests/extraction_test_results.json', JSON.stringify({ timestamp: new Date().toISOString(), results, allErrors }, null, 2))
  console.log('\n  📄 Results saved to tests/extraction_test_results.json')
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1) })
