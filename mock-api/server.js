require('dotenv').config()
const express = require('express')
const cors = require('cors')
const multer = require('multer')
const path = require('path')
const fs = require('fs')
const pdfParse = require('pdf-parse')
const Groq = require('groq-sdk')

const app = express()
const PORT = process.env.PORT || 8000
const upload = multer({ dest: 'uploads/' })

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

// ─── Invoice extraction ────────────────────────────────────────────────────────

const IMAGE_MIMES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']

function isImageFile(mimeType, filePath) {
  if (IMAGE_MIMES.includes(mimeType)) return true
  const ext = (filePath || '').toLowerCase()
  return ext.endsWith('.jpg') || ext.endsWith('.jpeg') || ext.endsWith('.png') || ext.endsWith('.webp')
}

async function extractFromPDF(filePath) {
  try {
    const buffer = fs.readFileSync(filePath)
    const data = await pdfParse(buffer)
    return data.text?.trim() || ''
  } catch (e) {
    console.error('PDF parse error:', e.message)
    return ''
  }
}

// Vision model: send image directly to Groq — no OCR step needed
async function extractFromImageWithVision(filePath, mimeType, marketplace) {
  const buffer = fs.readFileSync(filePath)
  const base64 = buffer.toString('base64')
  const imgMime = mimeType || 'image/jpeg'

  const marketplaceHint = {
    amazon: 'Amazon India', flipkart: 'Flipkart', meesho: 'Meesho',
  }[marketplace] || 'Indian e-commerce'

  const systemPrompt = 'You are an expert Indian invoice data extractor. Look carefully at this invoice image. Return ONLY valid JSON, no markdown, no explanation.'

  const userPrompt = `This is a ${marketplaceHint} seller invoice image.

Extract ALL data you can see. Return ONLY this JSON (use null for missing fields, 0 for missing numbers):
{
  "invoice_number": null,
  "invoice_date": "YYYY-MM-DD or null",
  "vendor_name": null,
  "vendor_gstin": null,
  "customer_name": null,
  "customer_gstin": null,
  "customer_address": null,
  "line_items": [
    {
      "sku": null,
      "product_name": "string",
      "hsn_code": null,
      "quantity": 1,
      "unit_price": 0.00,
      "discount": 0.00,
      "taxable_value": 0.00,
      "cgst_rate": 0, "cgst_amount": 0.00,
      "sgst_rate": 0, "sgst_amount": 0.00,
      "igst_rate": 0, "igst_amount": 0.00,
      "total_amount": 0.00,
      "confidence_score": 85
    }
  ],
  "shipping_charges": 0.00,
  "commission_amount": 0.00,
  "subtotal": 0.00,
  "tax_amount": 0.00,
  "total_amount": 0.00,
  "field_confidence": {
    "invoice_number": 80,
    "invoice_date": 80,
    "vendor_name": 80,
    "vendor_gstin": 80,
    "customer_name": 80,
    "line_items": 80,
    "totals": 80
  }
}`

  // Vision models on Groq
  const VISION_MODELS = ['meta-llama/llama-4-scout-17b-16e-instruct', 'llama-3.2-11b-vision-preview', 'llama-3.2-90b-vision-preview']

  let lastErr = null
  for (const model of VISION_MODELS) {
    try {
      console.log(`[Groq Vision] Trying ${model}...`)
      const completion = await groq.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: [
              { type: 'image_url', image_url: { url: `data:${imgMime};base64,${base64}` } },
              { type: 'text', text: userPrompt },
            ],
          },
        ],
        temperature: 0.0,
        max_tokens: 2500,
      })
      const raw = completion.choices[0]?.message?.content || '{}'
      const cleaned = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/, '').trim()
      const parsed = JSON.parse(cleaned)
      console.log(`[Groq Vision] ✅ ${model}: invoice=${parsed.invoice_number}, items=${parsed.line_items?.length}`)
      return parsed
    } catch (e) {
      lastErr = e
      const isRateLimit = e.message?.includes('rate_limit') || e.message?.includes('429')
      console.warn(`[Groq Vision] ${model} failed (${isRateLimit ? 'rate limited' : e.message?.slice(0, 60)})`)
      if (!isRateLimit) throw e
    }
  }
  throw new Error(`All Groq vision models rate-limited. ${lastErr?.message?.slice(0, 100)}`)
}


async function extractInvoiceWithGroq(text, marketplace) {
  const marketplaceHint = {
    amazon:   'Amazon India seller invoice. Invoice numbers often start with IN- or contain alphanumeric codes.',
    flipkart: 'Flipkart seller invoice.',
    meesho:   'Meesho seller invoice.',
  }[marketplace] || 'Indian e-commerce invoice.'

  const prompt = `${marketplaceHint}

Extract ALL structured data from this invoice text. Return ONLY a valid JSON object, no markdown.

Assign confidence scores (0-100) to each field:
95-100 = clearly visible | 80-94 = likely correct | 50-79 = uncertain | 0-49 = missing

Invoice text:
---
${text.slice(0, 5000)}
---

Return ONLY this JSON:
{
  "invoice_number": null,
  "invoice_date": "YYYY-MM-DD or null",
  "vendor_name": null,
  "vendor_gstin": null,
  "customer_name": null,
  "customer_gstin": null,
  "customer_address": null,
  "line_items": [
    {
      "sku": null,
      "product_name": "string",
      "hsn_code": null,
      "quantity": 1,
      "unit_price": 0.00,
      "discount": 0.00,
      "taxable_value": 0.00,
      "cgst_rate": 0, "cgst_amount": 0.00,
      "sgst_rate": 0, "sgst_amount": 0.00,
      "igst_rate": 0, "igst_amount": 0.00,
      "total_amount": 0.00,
      "confidence_score": 85
    }
  ],
  "shipping_charges": 0.00,
  "commission_amount": 0.00,
  "subtotal": 0.00,
  "tax_amount": 0.00,
  "total_amount": 0.00,
  "field_confidence": {
    "invoice_number": 0,
    "invoice_date": 0,
    "vendor_name": 0,
    "vendor_gstin": 0,
    "customer_name": 0,
    "line_items": 0,
    "totals": 0
  }
}`

  // Try models in order — each has its own separate daily token pool on Groq free tier
  const MODELS = [
    'llama-3.1-8b-instant',     // 500k TPD — fast
    'gemma2-9b-it',             // 500k TPD
    'llama-3.3-70b-versatile',  // 100k TPD — most accurate
  ]

  let lastError = null
  for (const model of MODELS) {
    try {
      console.log(`[Groq] Trying model: ${model}`)
      const completion = await groq.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: 'You are an expert Indian invoice data extractor. Return ONLY valid JSON, no markdown.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.0,
        max_tokens: 2500,
      })

      const raw = completion.choices[0]?.message?.content || '{}'
      const cleaned = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/, '').trim()
      const parsed = JSON.parse(cleaned)
      console.log(`[Groq] ✅ Success with ${model}: invoice=${parsed.invoice_number}, items=${parsed.line_items?.length}`)
      return parsed
    } catch (e) {
      lastError = e
      const isRateLimit = e.message?.includes('rate_limit') || e.message?.includes('429')
      console.warn(`[Groq] ${model} failed (${isRateLimit ? 'rate limited' : 'error'}): ${e.message?.slice(0, 80)}`)
      if (!isRateLimit) throw e // non-rate-limit error → stop immediately
    }
  }

  throw new Error(`All Groq models rate-limited. Wait a few minutes.\nDetails: ${lastError?.message?.slice(0, 150)}`)
}

function calcConfidence(extracted) {
  const scores = Object.values(extracted.field_confidence || {}).map(Number).filter(n => !isNaN(n))
  if (!scores.length) return 70
  // Normalize: if all scores are <= 1, model returned 0-1 scale → multiply by 100
  const normalised = scores.every(s => s <= 1) ? scores.map(s => s * 100) : scores
  // Also normalise field_confidence in-place so the frontend shows correct %
  if (scores.every(s => s <= 1)) {
    Object.keys(extracted.field_confidence || {}).forEach(k => {
      extracted.field_confidence[k] = Math.round(extracted.field_confidence[k] * 100)
    })
    ;(extracted.line_items || []).forEach(item => {
      if (item.confidence_score != null && item.confidence_score <= 1) {
        item.confidence_score = Math.round(item.confidence_score * 100)
      }
    })
  }
  return Math.round(normalised.reduce((a, b) => a + b, 0) / normalised.length * 10) / 10
}

function setStage(invoice, stage, progress, label) {
  invoice.processing_status = 'processing'
  invoice._stage = stage
  invoice._progress = progress
  invoice._label = label
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

function validateExtracted(data) {
  // Normalize GSTIN to uppercase
  if (data.vendor_gstin) data.vendor_gstin = data.vendor_gstin.toUpperCase().trim()
  if (data.customer_gstin) data.customer_gstin = data.customer_gstin.toUpperCase().trim()

  // Validate GSTIN format, zero confidence if wrong
  const gstinRe = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/
  if (data.vendor_gstin && !gstinRe.test(data.vendor_gstin)) {
    if (data.field_confidence) data.field_confidence.vendor_gstin = Math.min(data.field_confidence.vendor_gstin || 80, 45)
  }

  // Recalculate line item totals for accuracy
  let recalcSubtotal = 0, recalcTax = 0
  ;(data.line_items || []).forEach(item => {
    item.quantity   = Math.max(0, parseFloat(item.quantity)   || 0)
    item.unit_price = Math.max(0, parseFloat(item.unit_price) || 0)
    item.discount   = Math.max(0, parseFloat(item.discount)   || 0)

    if (!item.taxable_value) {
      item.taxable_value = Math.round((item.quantity * item.unit_price - item.discount) * 100) / 100
    }

    // If both cgst+sgst are 0 but igst > 0, it's inter-state — leave as is
    const cgst = parseFloat(item.cgst_amount) || 0
    const sgst = parseFloat(item.sgst_amount) || 0
    const igst = parseFloat(item.igst_amount) || 0
    const itemTax = cgst + sgst + igst
    item.total_amount = Math.round((item.taxable_value + itemTax) * 100) / 100
    recalcSubtotal += item.taxable_value
    recalcTax += itemTax
  })

  // Use recalculated totals if LLM totals are missing or wildly off
  if (!data.subtotal && recalcSubtotal > 0) data.subtotal = Math.round(recalcSubtotal * 100) / 100
  if (!data.tax_amount && recalcTax > 0) data.tax_amount = Math.round(recalcTax * 100) / 100
  if (!data.total_amount && (data.subtotal || data.tax_amount)) {
    data.total_amount = Math.round(((data.subtotal || 0) + (data.tax_amount || 0)) * 100) / 100
  }

  return data
}


// Allow any localhost port — handles Vite auto-incrementing (5173, 5174, etc.)
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || /^http:\/\/localhost(:\d+)?$/.test(origin)) return cb(null, true)
    cb(new Error('CORS not allowed'))
  },
  credentials: false
}))
app.use(express.json())

// ─── Mock data ───────────────────────────────────────────────────────────────

const MOCK_USER = { id: 1, name: 'Raj Kumar', email: 'raj@rkelectronics.com', business_name: 'RK Electronics', gstin: '27AAPFU0939F1ZV', phone: '9876543210', subscription_plan: 'starter' }
const MOCK_TOKEN = 'mock_jwt_token_dev_only'

const mockProducts = [
  { id: 1, sku: 'PHC-001', name: 'Silicone Phone Case', category: 'Accessories', hsn_code: '8517', cost_price: 80, selling_price: 299, current_stock: 42, min_stock_level: 10, is_active: true, created_at: new Date().toISOString() },
  { id: 2, sku: 'SCR-002', name: 'Tempered Glass Screen Protector', category: 'Accessories', hsn_code: '7013', cost_price: 30, selling_price: 149, current_stock: 6, min_stock_level: 10, is_active: true, created_at: new Date().toISOString() },
  { id: 3, sku: 'USB-003', name: 'USB Type-C Cable 2m', category: 'Cables', hsn_code: '8544', cost_price: 45, selling_price: 199, current_stock: 88, min_stock_level: 15, is_active: true, created_at: new Date().toISOString() },
  { id: 4, sku: 'PWR-004', name: '20000mAh Power Bank', category: 'Electronics', hsn_code: '8507', cost_price: 650, selling_price: 1499, current_stock: 14, min_stock_level: 5, is_active: true, created_at: new Date().toISOString() },
  { id: 5, sku: 'EAR-005', name: 'Wireless Earbuds', category: 'Audio', hsn_code: '8518', cost_price: 350, selling_price: 999, current_stock: 3, min_stock_level: 8, is_active: true, created_at: new Date().toISOString() },
]

let mockInvoices = []
let nextInvoiceId = 1

const ok = (data, msg = 'OK') => ({ success: true, data, message: msg })
const paginate = (items, page = 1, perPage = 20) => ({
  data: items.slice((page - 1) * perPage, page * perPage),
  meta: { current_page: page, total: items.length, per_page: perPage, last_page: Math.max(1, Math.ceil(items.length / perPage)) }
})

// ─── Auth ─────────────────────────────────────────────────────────────────────

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body
  if (email === 'raj@rkelectronics.com' && password === 'password123') {
    return res.json(ok({ user: MOCK_USER, token: MOCK_TOKEN, expires_in: 3600 }))
  }
  res.status(401).json({ success: false, message: 'Invalid credentials' })
})

app.post('/api/auth/register', (req, res) => {
  res.status(201).json(ok({ user: { ...MOCK_USER, ...req.body }, token: MOCK_TOKEN }))
})

app.post('/api/auth/logout', (req, res) => res.json(ok(null, 'Logged out')))
app.post('/api/auth/refresh', (req, res) => res.json(ok({ token: MOCK_TOKEN, expires_in: 3600 })))
app.get('/api/auth/me', (req, res) => res.json(ok(MOCK_USER)))

// ─── Dashboard ────────────────────────────────────────────────────────────────

app.get('/api/dashboard/summary', (req, res) => {
  res.json(ok({
    today_sales: 12450,
    monthly_revenue: 324600,
    gst_payable: 18340,
    net_profit: 84903,
    total_products: mockProducts.length,
    low_stock_count: mockProducts.filter(p => p.current_stock <= p.min_stock_level && p.current_stock > 0).length,
    out_of_stock_count: mockProducts.filter(p => p.current_stock === 0).length,
    recent_invoices: mockInvoices.slice(0, 5),
    unread_notifications: 3,
  }))
})

app.get('/api/dashboard/revenue-chart', (req, res) => {
  res.json(ok({
    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    datasets: [
      { name: 'Revenue', data: [185000, 210000, 195000, 240000, 285000, 324600, 0, 0, 0, 0, 0, 0] },
      { name: 'Profit', data: [42000, 51000, 44000, 58000, 72000, 84903, 0, 0, 0, 0, 0, 0] },
    ]
  }))
})

app.get('/api/dashboard/recent-activity', (req, res) => res.json(ok([])))

// ─── Invoices ─────────────────────────────────────────────────────────────────

app.post('/api/invoices/upload', upload.single('file'), async (req, res) => {
  const marketplace = req.body.marketplace || 'amazon'
  const invoice = {
    id: nextInvoiceId++,
    user_id: 1,
    file_path: req.file ? req.file.path : null,
    file_type: req.file ? (req.file.mimetype === 'application/pdf' ? 'pdf' : 'jpg') : 'pdf',
    original_filename: req.file ? req.file.originalname : 'invoice.pdf',
    invoice_number: null, invoice_date: null, marketplace,
    vendor_name: null, vendor_gstin: null,
    subtotal: 0, tax_amount: 0, total_amount: 0,
    processing_status: 'pending',
    ai_confidence_score: null, extracted_data: null,
    _stage: 'uploading', _progress: 5, _label: 'Uploading',
    created_at: new Date().toISOString(),
  }
  mockInvoices.unshift(invoice)

  // Respond immediately — processing is async
  res.status(202).json(ok({ invoice_id: invoice.id, status: 'pending' }, 'Invoice queued for processing'))

  // ── Async pipeline ──────────────────────────────────────────────────────────
  try {
    const mimeType = req.file?.mimetype || 'application/pdf'
    const filePath = invoice.file_path
    const isImage = isImageFile(mimeType, req.file?.originalname || '')

    let extracted
    if (isImage) {
      // Image: send directly to Groq Vision — no OCR needed
      setStage(invoice, 'ocr_extraction', 20, 'Reading Invoice')
      console.log(`[${invoice.id}] Image (${mimeType}) — using Groq Vision...`)
      setStage(invoice, 'llm_extraction', 50, 'Extracting Data')
      extracted = await extractFromImageWithVision(filePath, mimeType, marketplace)
      console.log(`[${invoice.id}] Vision: invoice=${extracted.invoice_number}, items=${extracted.line_items?.length}`)
    } else {
      // PDF: extract text, then text LLM
      setStage(invoice, 'ocr_extraction', 20, 'Reading Invoice')
      console.log(`[${invoice.id}] PDF — extracting text...`)
      const text = await extractFromPDF(filePath)
      console.log(`[${invoice.id}] Extracted ${text.length} chars`)
      setStage(invoice, 'llm_extraction', 50, 'Extracting Data')
      extracted = await extractInvoiceWithGroq(text || `Invoice from ${marketplace}`, marketplace)
      console.log(`[${invoice.id}] Text LLM: invoice=${extracted.invoice_number}, items=${extracted.line_items?.length}`)
    }

    // Stage 3: Validation
    setStage(invoice, 'validation', 70, 'Checking GST')
    const validated = validateExtracted(extracted)
    const score = calcConfidence(validated)
    console.log(`[${invoice.id}] Confidence score: ${score}%`)

    // Stage 4: Save
    setStage(invoice, 'saving_items', 85, 'Saving Line Items')
    await sleep(400) // small delay so frontend sees this stage

    // Stage 5: Done — update invoice with real data
    invoice.processing_status = 'review'
    invoice._stage = 'completed'
    invoice._progress = 100
    invoice._label = 'Done'
    invoice.ai_confidence_score = score
    invoice.invoice_number = validated.invoice_number
    invoice.invoice_date = validated.invoice_date
    invoice.vendor_name = validated.vendor_name
    invoice.vendor_gstin = validated.vendor_gstin
    invoice.subtotal = validated.subtotal || 0
    invoice.tax_amount = validated.tax_amount || 0
    invoice.total_amount = validated.total_amount || 0
    // Attach ids so InvoiceReview line items render correctly
    invoice.extracted_data = {
      ...validated,
      line_items: (validated.line_items || []).map((item, i) => ({
        ...item, id: i + 1, invoice_id: invoice.id
      }))
    }
    console.log(`[${invoice.id}] ✅ Ready for review`)

    // Cleanup uploaded file — in its own try-catch so an ENOENT doesn't crash the pipeline
    if (invoice.file_path) {
      try {
        if (fs.existsSync(invoice.file_path)) fs.unlinkSync(invoice.file_path)
      } catch (cleanupErr) {
        console.warn(`[${invoice.id}] File cleanup failed (non-fatal):`, cleanupErr.message)
      }
    }

  } catch (err) {
    console.error(`[${invoice.id}] ❌ Processing error:`, err.message)
    invoice.processing_status = 'error'
    invoice._stage = 'error'
    invoice._progress = 0
    invoice._label = 'Error'
    invoice._error = err.message
    // Also try to clean up the file on error
    if (invoice.file_path) {
      try { if (fs.existsSync(invoice.file_path)) fs.unlinkSync(invoice.file_path) } catch {}
    }
  }
})

app.get('/api/invoices/:id/status', (req, res) => {
  const inv = mockInvoices.find(i => i.id === parseInt(req.params.id))
  if (!inv) return res.status(404).json({ success: false, message: 'Not found' })

  res.json(ok({
    id: inv.id,
    status: inv.processing_status,
    stage: inv._stage || 'uploading',
    progress: inv._progress ?? 5,  // use ?? not || so 0 (error state) is preserved
    label: inv._label || 'Uploading',
    ai_confidence_score: inv.ai_confidence_score,
    error_message: inv.processing_status === 'error' ? inv._error : null,
  }))
})

app.get('/api/invoices', (req, res) => {
  let items = [...mockInvoices]
  if (req.query.marketplace && req.query.marketplace !== 'all') items = items.filter(i => i.marketplace === req.query.marketplace)
  if (req.query.status && req.query.status !== 'all') items = items.filter(i => i.processing_status === req.query.status)
  if (req.query.search) items = items.filter(i => (i.invoice_number || '').includes(req.query.search) || (i.vendor_name || '').toLowerCase().includes(req.query.search.toLowerCase()))
  res.json(ok(paginate(items, parseInt(req.query.page) || 1)))
})

app.get('/api/invoices/:id', (req, res) => {
  const inv = mockInvoices.find(i => i.id === parseInt(req.params.id))
  if (!inv) return res.status(404).json({ success: false, message: 'Not found' })
  res.json(ok({ ...inv, line_items: inv.extracted_data?.line_items?.map((item, i) => ({ ...item, id: i + 1, invoice_id: inv.id })) || [] }))
})

app.put('/api/invoices/:id/approve', (req, res) => {
  const inv = mockInvoices.find(i => i.id === parseInt(req.params.id))
  if (!inv) return res.status(404).json({ success: false, message: 'Not found' })
  inv.processing_status = 'approved'
  inv.approved_at = new Date().toISOString()
  inv.validated_data = req.body.validated_data

  // Simulate inventory deduction
  const lineItems = req.body.validated_data?.line_items || inv.extracted_data?.line_items || []
  lineItems.forEach(item => {
    if (item.sku) {
      const product = mockProducts.find(p => p.sku === item.sku)
      if (product) product.current_stock = Math.max(0, product.current_stock - Math.floor(item.quantity))
    }
  })

  res.json(ok({ invoice: inv, modules_updated: ['inventory', 'sales', 'customer', 'gst', 'accounting', 'expenses', 'notifications'] }, 'Invoice approved successfully'))
})

app.put('/api/invoices/:id', (req, res) => {
  const inv = mockInvoices.find(i => i.id === parseInt(req.params.id))
  if (!inv) return res.status(404).json({ success: false, message: 'Not found' })
  Object.assign(inv, req.body)
  res.json(ok(inv))
})

app.get('/api/invoices/:id/download', (req, res) => {
  const inv = mockInvoices.find(i => i.id === parseInt(req.params.id))
  if (!inv) return res.status(404).json({ success: false, message: 'Not found' })
  // In dev: return a placeholder response
  res.set({ 'Content-Type': 'text/plain', 'Content-Disposition': `attachment; filename="invoice_${inv.id}.txt"` })
  res.send(`Invoice: ${inv.invoice_number || inv.id}\nTotal: ${inv.total_amount}\nFile: ${inv.original_filename}`)
})

app.delete('/api/invoices/:id', (req, res) => {
  mockInvoices = mockInvoices.filter(i => i.id !== parseInt(req.params.id))
  res.json(ok(null, 'Invoice deleted'))
})

// ─── Products ─────────────────────────────────────────────────────────────────

app.get('/api/products/low-stock', (req, res) => {
  res.json(ok(mockProducts.filter(p => p.current_stock <= p.min_stock_level)))
})

app.get('/api/products', (req, res) => {
  let items = [...mockProducts]
  if (req.query.search) items = items.filter(p => p.name.toLowerCase().includes(req.query.search.toLowerCase()) || p.sku.toLowerCase().includes(req.query.search.toLowerCase()))
  if (req.query.stock_level === 'low') items = items.filter(p => p.current_stock > 0 && p.current_stock <= p.min_stock_level)
  if (req.query.stock_level === 'zero') items = items.filter(p => p.current_stock === 0)
  res.json(ok(paginate(items, parseInt(req.query.page) || 1)))
})

app.get('/api/products/:id', (req, res) => {
  const p = mockProducts.find(p => p.id === parseInt(req.params.id))
  if (!p) return res.status(404).json({ success: false, message: 'Not found' })
  res.json(ok(p))
})

app.post('/api/products', (req, res) => {
  // Use max existing ID + 1 to avoid collisions after deletions
  const maxId = mockProducts.reduce((m, p) => Math.max(m, p.id), 0)
  const p = { id: maxId + 1, user_id: 1, ...req.body, created_at: new Date().toISOString() }
  mockProducts.push(p)
  res.status(201).json(ok(p))
})

app.put('/api/products/:id', (req, res) => {
  const idx = mockProducts.findIndex(p => p.id === parseInt(req.params.id))
  if (idx === -1) return res.status(404).json({ success: false, message: 'Not found' })
  mockProducts[idx] = { ...mockProducts[idx], ...req.body }
  res.json(ok(mockProducts[idx]))
})

app.delete('/api/products/:id', (req, res) => {
  const idx = mockProducts.findIndex(p => p.id === parseInt(req.params.id))
  if (idx !== -1) mockProducts.splice(idx, 1)
  res.json(ok(null, 'Deleted'))
})

// ─── Sales ────────────────────────────────────────────────────────────────────

app.get('/api/sales/summary', (req, res) => {
  res.json(ok({
    revenue: 324600, orders: 142, avg_order_value: 2285.92, returns: 3,
    by_marketplace: {
      amazon: { revenue: 145200, orders: 62, commission: 14520 },
      flipkart: { revenue: 98400, orders: 51, commission: 9840 },
      meesho: { revenue: 81000, orders: 29, commission: 6480 },
    }
  }))
})

app.get('/api/sales/by-marketplace', (req, res) => {
  res.json(ok({
    amazon: { revenue: 145200, orders: 62, commission: 14520 },
    flipkart: { revenue: 98400, orders: 51, commission: 9840 },
    meesho: { revenue: 81000, orders: 29, commission: 6480 },
  }))
})

app.get('/api/sales', (req, res) => {
  const orders = mockInvoices.filter(i => i.processing_status === 'approved').map(i => ({
    id: i.id, order_number: 'ORD-' + i.id, order_date: i.invoice_date || new Date().toISOString().split('T')[0],
    marketplace: i.marketplace, total_amount: i.total_amount, tax_amount: i.tax_amount, net_revenue: i.total_amount * 0.85, status: 'completed',
  }))
  res.json(ok(paginate(orders, parseInt(req.query.page) || 1)))
})

app.get('/api/sales/:id', (req, res) => res.json(ok({})))

// ─── Customers ────────────────────────────────────────────────────────────────

const mockCustomers = [
  { id: 1, name: 'Priya Sharma', email: 'priya@gmail.com', phone: '9988776655', gstin: null, city: 'Pune', state: 'Maharashtra', customer_type: 'b2c', total_purchases: 8, lifetime_revenue: 14250, created_at: new Date().toISOString() },
  { id: 2, name: 'Tech Solutions Pvt. Ltd.', email: 'purchase@techsol.in', phone: '9876543000', gstin: '27AACTS1234Z1Z5', city: 'Mumbai', state: 'Maharashtra', customer_type: 'b2b', total_purchases: 15, lifetime_revenue: 89500, created_at: new Date().toISOString() },
  { id: 3, name: 'Rahul Verma', email: 'rahul@gmail.com', phone: '8765432109', gstin: null, city: 'Delhi', state: 'Delhi', customer_type: 'b2c', total_purchases: 3, lifetime_revenue: 4200, created_at: new Date().toISOString() },
]

app.get('/api/customers', (req, res) => {
  let items = [...mockCustomers]
  if (req.query.search) items = items.filter(c => c.name.toLowerCase().includes(req.query.search.toLowerCase()) || (c.gstin || '').includes(req.query.search))
  if (req.query.customer_type) items = items.filter(c => c.customer_type === req.query.customer_type)
  res.json(ok(paginate(items)))
})

app.get('/api/customers/:id', (req, res) => {
  const c = mockCustomers.find(c => c.id === parseInt(req.params.id))
  if (!c) return res.status(404).json({ success: false, message: 'Not found' })
  res.json(ok(c))
})

app.post('/api/customers', (req, res) => {
  const c = { id: mockCustomers.length + 1, ...req.body, created_at: new Date().toISOString() }
  mockCustomers.push(c)
  res.status(201).json(ok(c))
})

app.put('/api/customers/:id', (req, res) => {
  const idx = mockCustomers.findIndex(c => c.id === parseInt(req.params.id))
  if (idx === -1) return res.status(404).json({ success: false, message: 'Customer not found' })
  mockCustomers[idx] = { ...mockCustomers[idx], ...req.body }
  res.json(ok(mockCustomers[idx]))
})

app.get('/api/customers/:id/purchases', (req, res) => {
  const c = mockCustomers.find(c => c.id === parseInt(req.params.id))
  res.json(ok({ customer: c, purchases: [] }))
})

// ─── GST ─────────────────────────────────────────────────────────────────────

app.get('/api/gst/summary', (req, res) => {
  res.json(ok({
    output_tax: 82450, input_tax_credit: 24300, net_payable: 58150,
    by_quarter: [
      { quarter: 'Q1 (Apr–Jun)', output: 18200, input: 5400, payable: 12800 },
      { quarter: 'Q2 (Jul–Sep)', output: 22100, input: 6800, payable: 15300 },
      { quarter: 'Q3 (Oct–Dec)', output: 19850, input: 6200, payable: 13650 },
      { quarter: 'Q4 (Jan–Mar)', output: 22300, input: 5900, payable: 16400 },
    ],
    by_month: [
      { month: 'Apr', taxable_value: 85000, cgst: 3825, sgst: 3825, igst: 0, total: 7650 },
      { month: 'May', taxable_value: 95000, cgst: 4275, sgst: 4275, igst: 0, total: 8550 },
      { month: 'Jun', taxable_value: 110000, cgst: 4950, sgst: 4950, igst: 0, total: 9900 },
    ]
  }))
})

app.get('/api/gst/monthly/:year/:month', (req, res) => res.json(ok([])))
app.get('/api/gst/hsn-summary', (req, res) => res.json(ok([{ hsn_code: '8517', description: 'Phone Cases', taxable_value: 42500, total_tax: 7650, rate: '18%' }])))
app.post('/api/gst/generate-report', (req, res) => res.json(ok({ download_url: '/api/reports/1/download', filename: `GST_report.${req.body.format || 'pdf'}` })))

// ─── Accounting ───────────────────────────────────────────────────────────────

app.get('/api/accounting/journal-entries', (req, res) => res.json(ok(paginate([]))))
app.get('/api/accounting/profit-loss', (req, res) => {
  res.json(ok({ revenue: 324600, cogs: 168000, gross_profit: 156600, expenses: { shipping: 12400, commission: 32460, packaging: 8200, total: 53060 }, operating_profit: 103540, gst_payable: 18637, net_profit: 84903 }))
})
app.get('/api/accounting/balance-sheet', (req, res) => res.json(ok({ assets: [], liabilities: [] })))
app.get('/api/accounting/accounts', (req, res) => res.json(ok([])))

// ─── Expenses ─────────────────────────────────────────────────────────────────

app.get('/api/expenses', (req, res) => res.json(ok(paginate([]))))
app.post('/api/expenses', (req, res) => res.status(201).json(ok({ id: 1, ...req.body })))
app.put('/api/expenses/:id', (req, res) => res.json(ok({ id: parseInt(req.params.id), ...req.body })))
app.delete('/api/expenses/:id', (req, res) => res.json(ok(null)))
app.get('/api/expenses/summary', (req, res) => res.json(ok({ total: 53060, by_category: { Shipping: 12400, 'Marketplace Commission': 32460, Packaging: 8200 } })))

// ─── Reports ─────────────────────────────────────────────────────────────────

app.get('/api/reports', (req, res) => res.json(ok([])))
app.post('/api/reports/generate', (req, res) => res.status(202).json(ok({ report_id: Math.floor(Math.random() * 999) + 1, status: 'generating' })))
app.get('/api/reports/:id/download', (req, res) => {
  res.set({ 'Content-Type': 'text/csv', 'Content-Disposition': `attachment; filename="report_${req.params.id}.csv"` })
  res.send('Date,Amount\n' + new Date().toISOString().split('T')[0] + ',0\n')
})

// ─── Marketplace ─────────────────────────────────────────────────────────────

app.get('/api/marketplace/analytics', (req, res) => {
  res.json(ok({
    total_revenue: 324600, total_commission: 46860, total_returns: 3,
    by_platform: {
      amazon: { revenue: 145200, orders: 62, commission: 14520, commission_pct: 10, returns: 2, top_product: 'USB Cable' },
      flipkart: { revenue: 98400, orders: 51, commission: 9840, commission_pct: 10, returns: 1, top_product: 'Phone Case' },
      meesho: { revenue: 81000, orders: 29, commission: 6480, commission_pct: 8, returns: 0, top_product: 'Earbuds' },
    }
  }))
})
app.get('/api/marketplace/settlements', (req, res) => res.json(ok(paginate([]))))
app.get('/api/marketplace/:platform/summary', (req, res) => res.json(ok({ revenue: 0, orders: 0, commission: 0 })))

// ─── Notifications ────────────────────────────────────────────────────────────

const mockNotifications = [
  { id: 1, type: 'low_stock', title: 'Low Stock Alert', message: 'Tempered Glass (SCR-002) has only 6 units left. Minimum is 10.', is_read: false, created_at: new Date().toISOString() },
  { id: 2, type: 'ai_low_confidence', title: 'Low AI Confidence', message: 'Invoice #AMZ-001 was extracted with 72% confidence. Please verify.', is_read: false, created_at: new Date(Date.now() - 3600000).toISOString() },
  { id: 3, type: 'inventory_warning', title: 'Out of Stock', message: 'Wireless Earbuds (EAR-005) stock is critically low (3 units).', is_read: true, read_at: new Date().toISOString(), created_at: new Date(Date.now() - 86400000).toISOString() },
]

app.get('/api/notifications', (req, res) => {
  const unread = mockNotifications.filter(n => !n.is_read).length
  const result = paginate(mockNotifications)
  result.meta.unread = unread
  res.json(ok(result))
})

app.put('/api/notifications/read-all', (req, res) => {
  mockNotifications.forEach(n => { n.is_read = true; n.read_at = new Date().toISOString() })
  res.json(ok(null, 'All marked as read'))
})

app.put('/api/notifications/:id/read', (req, res) => {
  const n = mockNotifications.find(n => n.id === parseInt(req.params.id))
  if (n) { n.is_read = true; n.read_at = new Date().toISOString() }
  res.json(ok(null))
})

app.delete('/api/notifications/:id', (req, res) => res.json(ok(null)))

// ─── Audit Log ────────────────────────────────────────────────────────────────

app.get('/api/audit-log', (req, res) => {
  const logs = mockInvoices.filter(i => i.processing_status === 'approved').map(i => ({
    id: i.id, user: MOCK_USER.name, action: 'invoice_approved',
    entity_type: 'invoice', entity_id: i.id,
    new_values: { status: 'approved', total: i.total_amount },
    ip_address: '127.0.0.1', created_at: i.approved_at || new Date().toISOString()
  }))
  res.json(ok(paginate(logs)))
})

// ─── Settings ─────────────────────────────────────────────────────────────────

app.get('/api/settings', (req, res) => res.json(ok({ business_name: 'RK Electronics', gstin: '27AAPFU0939F1ZV', low_stock_notifications: true })))
app.put('/api/settings', (req, res) => res.json(ok(req.body, 'Settings updated')))

// ─── Start ────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`\n🚀 Mock API running at http://localhost:${PORT}`)
  console.log(`   Login: raj@rkelectronics.com / password123\n`)
})
