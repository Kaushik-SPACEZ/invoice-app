import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Edit2, Check, X, AlertTriangle } from 'lucide-react'
import toast from 'react-hot-toast'
import { useInvoice, useApproveInvoice } from '../hooks/queries'
import { invoicesApi } from '../api/invoices'
import { PageWrapper } from '../components/layout/PageWrapper'
import { Button } from '../components/ui/Button'
import { ConfidenceBadge, MarketplaceBadge } from '../components/ui/Badge'
import { formatINR } from '../lib/utils'
import type { ExtractedInvoiceData, InvoiceLineItem } from '../types'

export default function InvoiceReview() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

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

  const data = editedData ?? invoice?.extracted_data ?? {}
  const confidence = invoice?.ai_confidence_score ?? 0
  const lineItems = (data.line_items ?? invoice?.line_items ?? []) as Partial<InvoiceLineItem>[]

  const updateField = (key: string, value: string) => {
    setEditedData((prev) => ({ ...(prev ?? data), [key]: value }))
    setEditingField(null)
  }

  const handleApprove = async () => {
    if (!invoice) return
    try {
      // Only send edited data if user actually changed something
      await approveMutation.mutateAsync({
        id: invoice.id,
        data: editedData ?? invoice.extracted_data ?? {},
      })
      toast.success('Invoice approved! All modules updated.')
      navigate('/dashboard')
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

  // Determine file preview
  const fileUrl = invoice ? `/api/invoices/${invoice.id}/download` : null

  if (isLoading) return <div className="flex items-center justify-center h-64 text-gray-400">Loading invoice…</div>
  if (!invoice) return <div className="flex items-center justify-center h-64 text-red-400">Invoice not found</div>

  const fieldConf = data.field_confidence ?? {}

  return (
    <PageWrapper>
      <div className="flex flex-col lg:flex-row gap-4 h-full" style={{ minHeight: 'calc(100vh - 120px)' }}>

        {/* Left: File Preview */}
        <div className="lg:w-1/2 bg-bg-card border border-primary/10 rounded-2xl overflow-hidden flex flex-col">
          <div className="px-5 py-3 border-b border-border-default/50 flex items-center justify-between">
            <span className="text-sm font-medium text-gray-300">Original Invoice</span>
            <MarketplaceBadge marketplace={invoice.marketplace} />
          </div>
          <div className="flex-1 relative overflow-hidden">
            {invoice.file_type === 'pdf' && fileUrl ? (
              <iframe
                src={fileUrl}
                className="w-full h-full min-h-[500px]"
                title="Invoice PDF"
              />
            ) : invoice.file_type && ['jpg', 'jpeg', 'png'].includes(invoice.file_type) && fileUrl ? (
              <div className="flex items-center justify-center h-full p-4 overflow-auto">
                <img
                  src={fileUrl}
                  alt="Invoice"
                  className="max-w-full max-h-full object-contain rounded-lg"
                />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                <div className="text-6xl mb-4">📄</div>
                <p className="text-sm text-gray-400 font-mono">{invoice.original_filename}</p>
                <p className="text-xs text-gray-500 mt-1">{invoice.file_type?.toUpperCase()} Document</p>
                <p className="text-xs text-gray-600 mt-3">Preview not available in development mode</p>
              </div>
            )}
          </div>
        </div>

        {/* Right: Extracted Fields */}
        <div className="lg:w-1/2 bg-bg-card border border-primary/10 rounded-2xl flex flex-col overflow-hidden">
          {/* Header */}
          <div className="px-5 py-3 border-b border-border-default/50 flex items-center justify-between flex-shrink-0">
            <span className="text-sm font-medium text-gray-300">Extracted Data</span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">Overall confidence</span>
              <ConfidenceBadge score={confidence} />
            </div>
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
            </Section>

            <Section title="Line Items">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-gray-500">
                      <th className="text-left pb-2 font-medium">Product</th>
                      <th className="text-right pb-2 font-medium">Qty</th>
                      <th className="text-right pb-2 font-medium">Price</th>
                      <th className="text-right pb-2 font-medium">Tax</th>
                      <th className="text-right pb-2 font-medium">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lineItems.length === 0 ? (
                      <tr><td colSpan={5} className="py-4 text-center text-gray-500">No line items extracted</td></tr>
                    ) : lineItems.map((item, i) => (
                      <tr key={i} className="border-t border-border-default/30">
                        <td className="py-2 pr-2">
                          <p className="text-gray-200">{item.product_name}</p>
                          {item.sku && <p className="text-gray-500 font-mono">{item.sku}</p>}
                          {item.confidence_score != null && item.confidence_score < 80 && (
                            <span className="flex items-center gap-1 text-amber-400 mt-0.5">
                              <AlertTriangle size={10} /> Low confidence
                            </span>
                          )}
                        </td>
                        <td className="py-2 text-right font-mono text-gray-300">{item.quantity}</td>
                        <td className="py-2 text-right font-mono text-gray-300">₹{item.unit_price?.toLocaleString('en-IN')}</td>
                        <td className="py-2 text-right font-mono text-gray-400 text-xs">
                          {item.igst_rate ? `IGST ${item.igst_rate}%` : `GST ${((item.cgst_rate ?? 0) * 2).toFixed(0)}%`}
                        </td>
                        <td className="py-2 text-right font-mono text-gray-200">₹{item.total_amount?.toLocaleString('en-IN')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>

            <Section title="Totals">
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between text-gray-400"><span>Subtotal</span><span className="font-mono">₹{(data.subtotal ?? 0).toLocaleString('en-IN')}</span></div>
                <div className="flex justify-between text-gray-400"><span>Tax</span><span className="font-mono">₹{(data.tax_amount ?? 0).toLocaleString('en-IN')}</span></div>
                {(data as any).shipping_charges > 0 && (
                  <div className="flex justify-between text-gray-400"><span>Shipping</span><span className="font-mono">₹{((data as any).shipping_charges).toLocaleString('en-IN')}</span></div>
                )}
                <div className="flex justify-between text-white font-semibold border-t border-border-default/50 pt-2 mt-2">
                  <span>Total</span><span className="font-mono">{formatINR(data.total_amount ?? 0)}</span>
                </div>
              </div>
            </Section>
          </div>

          {/* Footer actions */}
          <div className="flex gap-3 p-5 border-t border-border-default/50 flex-shrink-0">
            <Button variant="danger" onClick={handleReject} loading={rejectLoading} className="flex-1">
              <X size={15} /> Reject
            </Button>
            <Button variant="success" onClick={handleApprove} loading={approveMutation.isPending} className="flex-1">
              <Check size={15} /> Approve & Save
            </Button>
          </div>
        </div>
      </div>
    </PageWrapper>
  )
}

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div>
    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">{title}</h3>
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
}

const FieldRow = ({ label, value, fieldKey, confidence, editingField, setEditingField, onUpdate, mono }: FieldRowProps) => {
  const [tempVal, setTempVal] = useState(value)

  // Re-sync tempVal when value prop changes (e.g. different field edited)
  // Use a key reset pattern on the parent instead — this is handled by the fieldKey
  const isLow = confidence !== undefined && confidence < 80
  const isEditing = editingField === fieldKey

  return (
    <div className={`flex items-center gap-3 p-2.5 rounded-lg ${isLow ? 'border border-amber-500/30 bg-amber-500/5' : 'bg-bg-elevated/50'}`}>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-gray-500 mb-0.5">{label}</p>
        {isEditing ? (
          <div className="flex items-center gap-2">
            <input
              autoFocus
              value={tempVal}
              onChange={(e) => setTempVal(e.target.value)}
              className="flex-1 bg-bg-card border border-primary rounded px-2 py-1 text-sm text-white focus:outline-none"
              onKeyDown={(e) => {
                if (e.key === 'Enter') onUpdate(fieldKey, tempVal)
                if (e.key === 'Escape') setEditingField(null)
              }}
            />
            <button onClick={() => onUpdate(fieldKey, tempVal)} className="text-emerald-400 hover:text-emerald-300"><Check size={14} /></button>
            <button onClick={() => setEditingField(null)} className="text-gray-400 hover:text-gray-300"><X size={14} /></button>
          </div>
        ) : (
          <p className={`text-sm ${mono ? 'font-mono' : ''} text-gray-200 truncate`}>
            {value || <span className="text-gray-500 italic">Not detected</span>}
          </p>
        )}
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {confidence !== undefined && <ConfidenceBadge score={confidence} />}
        {!isEditing && (
          <button onClick={() => { setTempVal(value); setEditingField(fieldKey) }} className="text-gray-500 hover:text-gray-300 p-1">
            <Edit2 size={12} />
          </button>
        )}
      </div>
    </div>
  )
}
