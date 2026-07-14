import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Edit2, Check, X, AlertTriangle } from 'lucide-react'
import toast from 'react-hot-toast'
import { useInvoice, useApproveInvoice, useProducts } from '../hooks/queries'
import { invoicesApi } from '../api/invoices'
import client from '../api/client'
import { PageWrapper } from '../components/layout/PageWrapper'
import { Button } from '../components/ui/Button'
import { MarketplaceBadge } from '../components/ui/Badge'
import { formatINR } from '../lib/utils'
import { ProductMappingModal } from '../components/invoice/ProductMappingModal'
import type { ExtractedInvoiceData, InvoiceLineItem } from '../types'

export default function InvoiceReview() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()

  // Validate id is numeric before proceeding
  const invoiceId = id ? parseInt(id, 10) : NaN
  if (isNaN(invoiceId)) {
    navigate('/invoices')
    return null
  }

  const { data: invoice, isLoading } = useInvoice(invoiceId)
  const approveMutation = useApproveInvoice()
  const [rejectLoading, setRejectLoading] = useState(false)
  const [editedData, setEditedData] = useState<ExtractedInvoiceData | null>(null)
  const [editingField, setEditingField] = useState<string | null>(null)

  // Mapping modal state
  const [showMappingModal, setShowMappingModal] = useState(false)
  const [unmappedItems, setUnmappedItems] = useState<Array<{ product_name: string; quantity: number; invoice_line_item_id: number }>>([])
  const { data: productsData } = useProducts({})
  const availableProducts = productsData?.data ?? []

  const data = editedData ?? invoice?.extracted_data ?? {}
  const confidence = invoice?.ai_confidence_score ?? 0
  const lineItems = (data.line_items ?? invoice?.line_items ?? []) as Partial<InvoiceLineItem>[]
  const r2 = (n: number) => Math.round(n * 100) / 100

  const updateField = (key: string, value: any) => {
    setEditedData((prev) => ({ ...(prev ?? data), [key]: value }))
    setEditingField(null)
  }

  const handleApprove = async () => {
    if (!invoice) return

    // Correct qty on all line items before checking mappings / approving
    const currentData = editedData ?? invoice.extracted_data ?? {}
    const rawLineItems = (currentData.line_items ?? []) as any[]

    // Check if line items sum matches invoice total — flag discrepancy
    const invoiceTotal = currentData.total_amount ?? 0
    if (invoiceTotal > 0) {
      const calcTotal = rawLineItems.reduce((sum: number, item: any) => sum + (item.total_amount ?? 0), 0)
      const gap = Math.abs(invoiceTotal - calcTotal)
      if (gap > 5) {
        const ok = window.confirm(
          `⚠️ Total mismatch detected!\n\n` +
          `Invoice total: ₹${invoiceTotal.toLocaleString('en-IN')}\n` +
          `Sum of line items: ₹${Math.round(calcTotal).toLocaleString('en-IN')}\n` +
          `Difference: ₹${Math.round(gap).toLocaleString('en-IN')}\n\n` +
          `This usually means a product quantity was misread.\n` +
          `Please edit the correct item's Qty before approving.\n\n` +
          `Press OK to approve anyway, or Cancel to go back and fix.`
        )
        if (!ok) return
      }
    }

    const lineItems = rawLineItems
    const productNames = lineItems.map((i: any) => i.product_name).filter(Boolean)

    if (productNames.length > 0) {
      try {
        const res = await client.post('/product-mappings/check', { product_names: productNames })
        const mappings = res.data.data ?? {}
        const unmapped = lineItems
          .filter((i: any) => i.product_name && !mappings[i.product_name])
          .map((i: any, idx: number) => ({
            product_name: i.product_name,
            quantity: i.quantity ?? 1,
            invoice_line_item_id: i.id ?? idx,
          }))

        if (unmapped.length > 0) {
          // Show mapping modal BEFORE approving
          setUnmappedItems(unmapped)
          setShowMappingModal(true)
          return // Wait for user to map, then approveAfterMapping() will be called
        }
      } catch {
        // If check fails, proceed with approval
      }
    }

    // No unmapped products — approve directly
    await doApprove()
  }

  const approveAfterMapping = async (mappings: any[]) => {
    // Save mappings first
    let savedCount = 0
    for (const mapping of mappings) {
      try {
        await client.post('/product-mappings', mapping)
        savedCount++
      } catch (err: any) {
        if (err?.response?.status === 422) {
          // 422 = duplicate mapping (already exists) — that's fine, continue
        } else {
          toast.error(`Failed to save mapping for "${mapping.invoice_product_name}"`)
        }
      }
    }
    if (savedCount > 0) {
      toast.success(`${savedCount} mapping${savedCount > 1 ? 's' : ''} saved — stock will update automatically next time!`)
      qc.invalidateQueries({ queryKey: ['product-mappings'] })
    }
    setShowMappingModal(false)

    // Wait briefly to ensure all mappings are committed to DB before approval runs
    await new Promise(resolve => setTimeout(resolve, 800))

    // Now approve — inventory deduction will use the saved mappings
    await doApprove()
  }

  const doApprove = async () => {
    if (!invoice) return
    try {
      // Apply qty corrections and keep all edited fields (SKU, HSN, product_name, etc.)
      const baseData = editedData ?? invoice.extracted_data ?? {}
      const correctedData = {
        ...baseData,
        line_items: ((baseData.line_items ?? []) as any[]).map((item: any) => {
          // Correct qty if taxable_value implies different quantity
          if (item.unit_price > 0 && item.taxable_value > 0) {
            const derived = Math.round(item.taxable_value / item.unit_price)
            if (derived >= 1 && derived <= 50 && Math.abs(derived * item.unit_price - item.taxable_value) < 1) {
              return { ...item, quantity: derived }
            }
          }
          return item
        })
      }

      await approveMutation.mutateAsync({ id: invoice.id, data: correctedData })

      // After approval: if user edited SKU/HSN on any line item, update the product record
      // so future approvals use the corrected values
      const lineItemsWithEdits = (correctedData.line_items ?? []) as any[]
      for (const item of lineItemsWithEdits) {
        if (item.product_id && (item.sku || item.hsn_code)) {
          try {
            await client.patch(`/products/${item.product_id}`, {
              ...(item.sku ? { sku: item.sku } : {}),
              ...(item.hsn_code ? { hsn_code: item.hsn_code } : {}),
            })
          } catch {
            // Non-critical — don't block approval
          }
        }
      }

      toast.success('Invoice approved! All modules updated.')
      navigate('/invoices')
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Failed to approve invoice')
    }
  }

  const handleReject = async () => {
    if (!invoice) return
    setRejectLoading(true)
    try {
      await invoicesApi.update(invoice.id, { processing_status: 'rejected' } as any)
      toast.success('Invoice rejected')
      navigate('/invoices')
    } catch {
      // Even if API fails, navigate away — invoice stays in review state
      navigate('/invoices')
    } finally {
      setRejectLoading(false)
    }
  }

  // Load image as blob URL so JWT token is sent in the request
  const [imageBlobUrl, setImageBlobUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!invoice) return
    const isImage = invoice.file_type && ['jpg', 'jpeg', 'png'].includes(invoice.file_type)
    if (!isImage) return

    invoicesApi.download(invoice.id).then((res) => {
      const blob = new Blob([res.data], { type: String(res.headers['content-type'] || 'image/jpeg') })
      setImageBlobUrl(URL.createObjectURL(blob))
    }).catch(() => {})

    return () => { if (imageBlobUrl) URL.revokeObjectURL(imageBlobUrl) }
  }, [invoice?.id])

  // Determine file preview
  const fileUrl = invoice ? `/api/invoices/${invoice.id}/download` : null

  if (isLoading) return <div className="flex items-center justify-center h-64 text-slate-400">Loading invoice…</div>
  if (!invoice) return <div className="flex items-center justify-center h-64 text-red-400">Invoice not found</div>

  const fieldConf = data.field_confidence ?? {}

  return (
    <PageWrapper>
      <div className="flex flex-col lg:flex-row gap-4 h-full" style={{ minHeight: 'calc(100vh - 120px)' }}>

        {/* Left: File Preview */}
        <div className="lg:w-1/2 bg-white border border-gray-200 rounded-2xl overflow-hidden flex flex-col">
          <div className="px-5 py-3 border-b border-gray-200/50 flex items-center justify-between">
            <span className="text-sm font-medium text-slate-600">Original Invoice</span>
            <MarketplaceBadge marketplace={invoice.marketplace} />
          </div>
          <div className="flex-1 relative overflow-hidden">
            {invoice.file_type === 'pdf' && fileUrl ? (
              <iframe
                src={fileUrl}
                className="w-full h-full min-h-[500px]"
                title="Invoice PDF"
              />
            ) : invoice.file_type && ['jpg', 'jpeg', 'png'].includes(invoice.file_type) ? (
              <div className="flex items-center justify-center h-full p-4 overflow-auto">
                {imageBlobUrl ? (
                  <img
                    src={imageBlobUrl}
                    alt="Invoice"
                    className="max-w-full max-h-full object-contain rounded-lg"
                  />
                ) : (
                  <div className="flex flex-col items-center gap-3 text-slate-400">
                    <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    <p className="text-sm">Loading image…</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                <div className="text-6xl mb-4">📄</div>
                <p className="text-sm text-slate-400 font-mono">{invoice.original_filename}</p>
                <p className="text-xs text-slate-500 mt-1">{invoice.file_type?.toUpperCase()} Document</p>
                <p className="text-xs text-gray-600 mt-3">Preview not available in development mode</p>
              </div>
            )}
          </div>
        </div>

        {/* Right: Extracted Fields */}
        <div className="lg:w-1/2 bg-white border border-gray-200 rounded-2xl flex flex-col overflow-hidden">
          {/* Header */}
          <div className="px-5 py-3 border-b border-gray-200/50 flex items-center justify-between flex-shrink-0">
            <span className="text-sm font-medium text-slate-600">Extracted Data</span>
          </div>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto p-5 space-y-5">

            <Section title="Invoice Details">
              <FieldRow label="Invoice Number" value={data.invoice_number ?? ''} fieldKey="invoice_number" confidence={fieldConf.invoice_number} editingField={editingField} setEditingField={setEditingField} onUpdate={updateField} mono />
              <FieldRow label="Invoice Date" value={data.invoice_date ?? ''} fieldKey="invoice_date" confidence={fieldConf.invoice_date} editingField={editingField} setEditingField={setEditingField} onUpdate={updateField} />
            </Section>

            <Section title="Vendor Details">
              <FieldRow label="Vendor Name" value={data.vendor_name ?? ''} fieldKey="vendor_name" confidence={fieldConf.vendor_name} editingField={editingField} setEditingField={setEditingField} onUpdate={updateField} />
              <FieldRow label="Vendor GSTIN" value={data.vendor_gstin ?? ''} fieldKey="vendor_gstin" confidence={fieldConf.vendor_gstin} editingField={editingField} setEditingField={setEditingField} onUpdate={updateField} mono />
            </Section>

            <Section title="Customer Details">
              <FieldRow label="Customer Name" value={data.customer_name ?? ''} fieldKey="customer_name" confidence={fieldConf.customer_name} editingField={editingField} setEditingField={setEditingField} onUpdate={updateField} />
              <FieldRow label="Customer GSTIN" value={data.customer_gstin ?? ''} fieldKey="customer_gstin" confidence={fieldConf.customer_gstin} editingField={editingField} setEditingField={setEditingField} onUpdate={updateField} mono />
              <FieldRow label="Customer Address" value={(data as any).customer_address ?? ''} fieldKey="customer_address" editingField={editingField} setEditingField={setEditingField} onUpdate={updateField} multiline />
            </Section>

            <Section title="Line Items">
              {/* Total mismatch warning */}
              {(() => {
                const invTotal = data.total_amount ?? 0
                const calcTotal = lineItems.reduce((s: number, i: any) => s + (i.total_amount ?? 0), 0)
                const gap = invTotal > 0 ? Math.abs(invTotal - calcTotal) : 0
                if (gap > 5) return (
                  <div className="mb-3 p-2.5 bg-red-50 border border-red-300 rounded-lg flex items-start gap-2">
                    <AlertTriangle size={14} className="text-red-500 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-red-700">
                      <strong>Total mismatch: ₹{Math.round(gap)} difference.</strong> Invoice total is ₹{invTotal.toLocaleString('en-IN')} but line items sum to ₹{Math.round(calcTotal).toLocaleString('en-IN')}.
                      Click any field below to correct it.
                    </p>
                  </div>
                )
                return null
              })()}

              <p className="text-[10px] text-slate-400 mb-2">Click any value to edit it inline.</p>

              <div className="space-y-3">
                {lineItems.length === 0 ? (
                  <p className="py-4 text-center text-slate-500 text-xs">No line items extracted</p>
                ) : lineItems.map((item, i) => {
                  let displayQty = item.quantity ?? 1
                  if (item.unit_price && item.unit_price > 0 && item.taxable_value && item.taxable_value > 0) {
                    const derived = Math.round((item.taxable_value as number) / (item.unit_price as number))
                    if (derived >= 1 && derived <= 50 && Math.abs(derived * (item.unit_price as number) - (item.taxable_value as number)) < 1) {
                      displayQty = derived
                    }
                  }
                  const qtyMismatch = displayQty !== (item.quantity ?? 1)

                  const updateLineItem = (field: string, value: any) => {
                    const items = ((editedData ?? data).line_items ?? []) as any[]
                    const updated = items.map((li: any, idx: number) => {
                      if (idx !== i) return li
                      const next = { ...li, [field]: value }
                      // Recalc total when qty or price changes
                      if (field === 'quantity' || field === 'unit_price') {
                        const q = field === 'quantity' ? Number(value) : Number(li.quantity ?? 1)
                        const p = field === 'unit_price' ? Number(value) : Number(li.unit_price ?? 0)
                        const discount = Number(li.discount ?? 0)
                        const taxable = r2(q * p - discount)
                        const igstAmt = r2(taxable * (Number(li.igst_rate ?? 0)) / 100)
                        const cgstAmt = r2(taxable * (Number(li.cgst_rate ?? 0)) / 100)
                        const sgstAmt = r2(taxable * (Number(li.sgst_rate ?? 0)) / 100)
                        next.taxable_value = taxable
                        next.igst_amount = igstAmt
                        next.cgst_amount = cgstAmt
                        next.sgst_amount = sgstAmt
                        next.total_amount = r2(taxable + igstAmt + cgstAmt + sgstAmt)
                      }
                      return next
                    })
                    updateField('line_items', updated)
                  }

                  return (
                    <div key={i} className="bg-gray-50 rounded-lg p-3 border border-gray-200 text-xs space-y-2">
                      {/* Row 1: Product Name */}
                      <LineItemField
                        label="Product"
                        value={String(item.product_name ?? '')}
                        onSave={v => updateLineItem('product_name', v)}
                        wide
                        warn={qtyMismatch || (item.confidence_score != null && (item.confidence_score as number) < 80)}
                        warnText={qtyMismatch ? `Qty auto-corrected to ${displayQty}` : 'Low confidence'}
                      />

                      {/* Row 2: SKU + HSN side by side */}
                      <div className="grid grid-cols-2 gap-2">
                        <LineItemField
                          label="SKU"
                          value={String(item.sku ?? '')}
                          placeholder="e.g. B0GN2XYTJK"
                          mono
                          onSave={v => updateLineItem('sku', v)}
                        />
                        <LineItemField
                          label="HSN Code"
                          value={String((item as any).hsn_code ?? '')}
                          placeholder="e.g. 610910"
                          mono
                          onSave={v => updateLineItem('hsn_code', v)}
                        />
                      </div>

                      {/* Row 3: Qty + Price + Tax + Total */}
                      <div className="grid grid-cols-4 gap-2">
                        <LineItemField
                          label="Qty"
                          value={String(displayQty)}
                          type="number"
                          mono
                          onSave={v => updateLineItem('quantity', Number(v))}
                        />
                        <LineItemField
                          label="Unit Price"
                          value={String(item.unit_price ?? 0)}
                          type="number"
                          prefix="₹"
                          mono
                          onSave={v => updateLineItem('unit_price', Number(v))}
                        />
                        <LineItemField
                          label="Tax"
                          value={item.igst_rate ? `IGST ${item.igst_rate}%` : `GST ${((item.cgst_rate ?? 0) as number * 2).toFixed(0)}%`}
                          readOnly
                        />
                        <LineItemField
                          label="Total"
                          value={String(item.total_amount ?? 0)}
                          prefix="₹"
                          mono
                          readOnly
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </Section>

            <Section title="Totals">
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between text-slate-400"><span>Subtotal</span><span className="font-mono">₹{(data.subtotal ?? 0).toLocaleString('en-IN')}</span></div>
                <div className="flex justify-between text-slate-400"><span>Tax</span><span className="font-mono">₹{(data.tax_amount ?? 0).toLocaleString('en-IN')}</span></div>
                {(data as any).shipping_charges > 0 && (
                  <div className="flex justify-between text-slate-400"><span>Shipping</span><span className="font-mono">₹{((data as any).shipping_charges).toLocaleString('en-IN')}</span></div>
                )}
                <div className="flex justify-between text-slate-800 font-semibold border-t border-gray-200/50 pt-2 mt-2">
                  <span>Total</span><span className="font-mono">{formatINR(data.total_amount ?? 0)}</span>
                </div>
              </div>
            </Section>
          </div>

          {/* Footer actions */}
          <div className="flex gap-3 p-5 border-t border-gray-200/50 flex-shrink-0">
            <Button variant="danger" onClick={handleReject} loading={rejectLoading} className="flex-1">
              <X size={15} /> Reject
            </Button>
            <Button variant="success" onClick={handleApprove} loading={approveMutation.isPending} className="flex-1">
              <Check size={15} /> Approve & Save
            </Button>
          </div>
        </div>
      </div>

      {/* SKU Mapping Modal */}
      <ProductMappingModal
        open={showMappingModal}
        onClose={() => setShowMappingModal(false)}
        onSave={approveAfterMapping}
        unmappedItems={unmappedItems}
        availableProducts={availableProducts}
      />
    </PageWrapper>
  )
}

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div>
    <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">{title}</h3>
    <div className="space-y-2">{children}</div>
  </div>
)

interface FieldRowProps {
  label: string
  value: string
  fieldKey: string
  confidence?: number
  editingField: string | null
  setEditingField: (k: string | null) => void
  onUpdate: (key: string, value: string) => void
  mono?: boolean
  multiline?: boolean
}

const FieldRow = ({ label, value, fieldKey, confidence, editingField, setEditingField, onUpdate, mono, multiline }: FieldRowProps) => {
  const [tempVal, setTempVal] = useState(value)

  const isLow = confidence !== undefined && confidence < 80
  const isEditing = editingField === fieldKey

  return (
    <div className={`flex items-start gap-3 p-2.5 rounded-lg ${isLow ? 'border border-amber-500/30 bg-amber-500/5' : 'bg-gray-100/50'}`}>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-slate-500 mb-0.5">{label}</p>
        {isEditing ? (
          <div className="flex items-start gap-2">
            {multiline ? (
              <textarea
                autoFocus
                rows={3}
                value={tempVal}
                onChange={(e) => setTempVal(e.target.value)}
                className="flex-1 bg-white border border-blue-400 rounded px-2 py-1 text-sm text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-400 resize-none"
                onKeyDown={(e) => {
                  if (e.key === 'Escape') setEditingField(null)
                }}
              />
            ) : (
              <input
                autoFocus
                value={tempVal}
                onChange={(e) => setTempVal(e.target.value)}
                className="flex-1 bg-white border border-blue-400 rounded px-2 py-1 text-sm text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-400"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') onUpdate(fieldKey, tempVal)
                  if (e.key === 'Escape') setEditingField(null)
                }}
              />
            )}
            <div className="flex flex-col gap-1 flex-shrink-0">
              <button onClick={() => onUpdate(fieldKey, tempVal)} className="text-emerald-500 hover:text-emerald-600"><Check size={14} /></button>
              <button onClick={() => setEditingField(null)} className="text-slate-400 hover:text-slate-600"><X size={14} /></button>
            </div>
          </div>
        ) : (
          <p className={`text-sm ${mono ? 'font-mono' : ''} text-slate-700 ${multiline ? 'whitespace-pre-wrap break-words' : 'truncate'}`}>
            {value || <span className="text-slate-500 italic">Not detected</span>}
          </p>
        )}
      </div>
      <div className="flex items-center gap-2 flex-shrink-0 mt-0.5">
        {!isEditing && (
          <button onClick={() => { setTempVal(value); setEditingField(fieldKey) }} className="text-slate-500 hover:text-slate-600 p-1">
            <Edit2 size={12} />
          </button>
        )}
      </div>
    </div>
  )
}

// ── Inline-editable line item field ─────────────────────────────────────────
interface LineItemFieldProps {
  label: string
  value: string
  onSave?: (v: string) => void
  type?: 'text' | 'number'
  mono?: boolean
  wide?: boolean
  prefix?: string
  placeholder?: string
  readOnly?: boolean
  warn?: boolean
  warnText?: string
}

const LineItemField = ({ label, value, onSave, type = 'text', mono, wide, prefix, placeholder, readOnly, warn, warnText }: LineItemFieldProps) => {
  const [editing, setEditing] = useState(false)
  const [tempVal, setTempVal] = useState(value)

  const handleSave = () => {
    if (onSave && tempVal !== value) onSave(tempVal)
    setEditing(false)
  }

  const displayValue = prefix && value && value !== '0' ? `${prefix}${Number(value).toLocaleString('en-IN')}` : (value || '')

  if (readOnly) {
    return (
      <div>
        <p className="text-[10px] text-slate-400 mb-0.5">{label}</p>
        <p className={`text-xs ${mono ? 'font-mono' : ''} text-slate-600`}>{displayValue || '—'}</p>
      </div>
    )
  }

  return (
    <div className={wide ? 'col-span-2' : ''}>
      <p className="text-[10px] text-slate-400 mb-0.5">{label}</p>
      {editing ? (
        <div className="flex items-center gap-1">
          <input
            autoFocus
            type={type}
            value={tempVal}
            onChange={e => setTempVal(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setEditing(false) }}
            onBlur={handleSave}
            placeholder={placeholder}
            className={`flex-1 bg-white border border-blue-400 rounded px-1.5 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 ${mono ? 'font-mono' : ''}`}
          />
        </div>
      ) : (
        <button
          onClick={() => { setTempVal(value); setEditing(true) }}
          className={`text-left w-full text-xs underline decoration-dotted hover:decoration-solid hover:text-blue-600 transition-colors ${mono ? 'font-mono' : ''} ${warn ? 'text-amber-600 font-semibold' : 'text-slate-700'}`}
          title="Click to edit"
        >
          {displayValue || <span className="text-slate-400 italic no-underline">{placeholder ?? 'Not detected'}</span>}
          {warn && warnText && <span className="ml-1 text-[10px] text-amber-500 not-italic font-normal">({warnText})</span>}
        </button>
      )}
    </div>
  )
}
