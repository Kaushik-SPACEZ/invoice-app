import { useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, CheckCircle, Clock, XCircle, AlertCircle, Download, Edit } from 'lucide-react'
import { useInvoice } from '../hooks/queries'
import { invoicesApi } from '../api/invoices'
import toast from 'react-hot-toast'
import { PageWrapper } from '../components/layout/PageWrapper'
import { Card, CardHeader, CardBody } from '../components/ui/Card'
import { Badge, MarketplaceBadge, StatusBadge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { TableSkeleton } from '../components/ui/Skeleton'
import { formatINR, formatDate, formatDateTime, getConfidenceColor } from '../lib/utils'
import { Navigate } from 'react-router-dom'

export default function InvoiceDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const invoiceId = id ? parseInt(id, 10) : NaN
  if (isNaN(invoiceId)) return <Navigate to="/invoices" replace />

  const { data: invoice, isLoading } = useInvoice(invoiceId)

  if (isLoading) {
    return (
      <PageWrapper>
        <div className="max-w-4xl mx-auto">
          <div className="h-8 w-48 bg-gray-100 rounded-lg mb-6 animate-pulse" />
          <TableSkeleton rows={6} cols={4} />
        </div>
      </PageWrapper>
    )
  }

  if (!invoice) {
    return (
      <PageWrapper>
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <AlertCircle size={40} className="text-red-400" />
          <p className="text-slate-500">Invoice not found</p>
          <Button variant="secondary" onClick={() => navigate('/invoices')}>Back to Invoices</Button>
        </div>
      </PageWrapper>
    )
  }

  const data = invoice.validated_data ?? invoice.extracted_data ?? {}
  const lineItems = invoice.line_items ?? (data.line_items as any[]) ?? []
  const isReview = invoice.processing_status === 'review'

  return (
    <PageWrapper>
      <div className="max-w-4xl mx-auto">

        {/* Back + Header */}
        <div className="flex items-center gap-4 mb-6">
          <button onClick={() => navigate('/invoices')} className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-gray-100 transition-colors">
            <ArrowLeft size={18} />
          </button>
          <div className="flex-1">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl font-semibold text-slate-800">{invoice.invoice_number ?? `Invoice #${invoice.id}`}</h1>
              <StatusBadge status={invoice.processing_status} />
            </div>
            {invoice.invoice_date && <p className="text-sm text-slate-400 mt-1">{formatDate(invoice.invoice_date)}</p>}
          </div>
          <div className="flex gap-2">
            {isReview && (
              <Button onClick={() => navigate(`/invoices/${invoice.id}/review`)} size="sm">
                <Edit size={14} /> Review & Approve
              </Button>
            )}
            <Button variant="secondary" size="sm" onClick={async () => {
              try {
                const res = await invoicesApi.download(invoice.id)
                const blob = new Blob([res.data], { type: String(res.headers['content-type'] || 'application/octet-stream') })
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url; a.download = invoice.original_filename || `invoice_${invoice.id}`
                document.body.appendChild(a); a.click(); document.body.removeChild(a)
                URL.revokeObjectURL(url)
              } catch { toast.error('Download failed') }
            }}>
              <Download size={14} /> Download
            </Button>
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Subtotal', value: formatINR(invoice.subtotal) },
            { label: 'Tax', value: formatINR(invoice.tax_amount) },
            { label: 'Total Amount', value: formatINR(invoice.total_amount) },
            { label: 'Uploaded', value: formatDate(invoice.created_at) },
          ].map(({ label, value }) => (
            <div key={label} className="bg-white border border-gray-200 rounded-lg shadow-sm p-4">
              <p className="text-xs text-slate-500 mb-1">{label}</p>
              <p className="font-mono font-semibold text-slate-800">{value}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
          <Card>
            <CardHeader><span className="font-semibold text-sm text-slate-700">Invoice Details</span></CardHeader>
            <CardBody className="space-y-3">
              <InfoRow label="Invoice Number" value={invoice.invoice_number} mono />
              <InfoRow label="Invoice Date" value={invoice.invoice_date ? formatDate(invoice.invoice_date) : null} />
              <InfoRow label="Marketplace" value={<MarketplaceBadge marketplace={invoice.marketplace} />} />
              <InfoRow label="File" value={invoice.original_filename} mono />
              {invoice.approved_at && <InfoRow label="Approved At" value={formatDateTime(invoice.approved_at)} />}
            </CardBody>
          </Card>

          <Card>
            <CardHeader><span className="font-semibold text-sm text-slate-700">Vendor & Customer</span></CardHeader>
            <CardBody className="space-y-3">
              <InfoRow label="Vendor" value={invoice.vendor_name} />
              <InfoRow label="Vendor GSTIN" value={invoice.vendor_gstin} mono />
              <InfoRow label="Customer" value={(data as any).customer_name} />
              <InfoRow label="Customer GSTIN" value={(data as any).customer_gstin} mono />
              {(data as any).customer_address && <InfoRow label="Address" value={(data as any).customer_address} />}
            </CardBody>
          </Card>
        </div>

        {/* Line Items */}
        <Card className="mb-6">
          <CardHeader>
            <span className="font-semibold text-sm text-slate-700">Line Items</span>
            <Badge variant="muted">{lineItems.length} item{lineItems.length !== 1 ? 's' : ''}</Badge>
          </CardHeader>
          <CardBody className="p-0">
            {lineItems.length === 0 ? (
              <div className="p-6 text-center text-sm text-slate-500">No line items extracted</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      {['Product', 'SKU', 'HSN', 'Qty', 'Unit Price', 'Taxable Value', 'Tax', 'Total'].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {lineItems.map((item: any, i: number) => (
                      <tr key={i} className="border-b border-gray-100 hover:bg-blue-50/20">
                        <td className="px-4 py-3"><p className="text-sm text-slate-700">{item.product_name}</p></td>
                        <td className="px-4 py-3 text-xs font-mono text-blue-600">{item.sku ?? '—'}</td>
                        <td className="px-4 py-3 text-xs font-mono text-slate-500">{item.hsn_code ?? '—'}</td>
                        <td className="px-4 py-3 text-sm font-mono text-slate-700">{item.quantity}</td>
                        <td className="px-4 py-3 text-sm font-mono text-slate-700">{formatINR(item.unit_price)}</td>
                        <td className="px-4 py-3 text-sm font-mono text-slate-700">{formatINR(item.taxable_value)}</td>
                        <td className="px-4 py-3 text-xs text-slate-500">
                          {item.igst_rate ? `IGST ${item.igst_rate}%` : `${((item.cgst_rate ?? 0) * 2).toFixed(0)}%`}
                        </td>
                        <td className="px-4 py-3 text-sm font-mono font-semibold text-slate-800">{formatINR(item.total_amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-gray-200 bg-gray-50">
                      <td colSpan={5} className="px-4 py-3 text-sm text-slate-500 font-medium">Totals</td>
                      <td className="px-4 py-3 text-sm font-mono text-slate-700">{formatINR(invoice.subtotal)}</td>
                      <td className="px-4 py-3 text-sm font-mono text-slate-700">{formatINR(invoice.tax_amount)}</td>
                      <td className="px-4 py-3 text-sm font-mono font-bold text-slate-800">{formatINR(invoice.total_amount)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </CardBody>
        </Card>

        {((data as any).shipping_charges > 0 || (data as any).commission_amount > 0) && (
          <Card>
            <CardHeader><span className="font-semibold text-sm text-slate-700">Additional Charges</span></CardHeader>
            <CardBody className="space-y-2">
              {(data as any).shipping_charges > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Shipping Charges</span>
                  <span className="font-mono text-slate-700">{formatINR((data as any).shipping_charges)}</span>
                </div>
              )}
              {(data as any).commission_amount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Marketplace Commission</span>
                  <span className="font-mono text-amber-600">{formatINR((data as any).commission_amount)}</span>
                </div>
              )}
            </CardBody>
          </Card>
        )}
      </div>
    </PageWrapper>
  )
}

const InfoRow = ({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) => (
  <div className="flex items-start justify-between gap-4">
    <span className="text-xs text-slate-500 flex-shrink-0 mt-0.5">{label}</span>
    {typeof value === 'string' || value == null ? (
      <span className={`text-sm text-right ${mono ? 'font-mono' : ''} ${value ? 'text-slate-700' : 'text-slate-400 italic'}`}>
        {value || 'Not available'}
      </span>
    ) : (
      <div>{value}</div>
    )}
  </div>
)
