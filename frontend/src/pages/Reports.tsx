import { useState } from 'react'
import { format, subMonths } from 'date-fns'
import { Download, BarChart3, FileText, TrendingUp, Package, ShoppingBag, Users, DollarSign, ChevronDown, ChevronUp, Check } from 'lucide-react'
import { PageWrapper } from '../components/layout/PageWrapper'
import { reportsApi } from '../api'
import client from '../api/client'
import toast from 'react-hot-toast'
import type { ReportType, ReportFormat } from '../types'
import { cn } from '../lib/utils'

// Field options for each report type
const REPORT_FIELDS: Record<string, Array<{ key: string; label: string; default: boolean }>> = {
  sales: [
    { key: 'date', label: 'Date', default: true },
    { key: 'order_number', label: 'Order Number', default: true },
    { key: 'marketplace', label: 'Marketplace', default: true },
    { key: 'revenue', label: 'Revenue', default: true },
    { key: 'tax', label: 'Tax Amount', default: true },
    { key: 'net_revenue', label: 'Net Revenue', default: true },
    { key: 'commission', label: 'Commission', default: false },
    { key: 'tds', label: 'TDS', default: false },
    { key: 'customer_name', label: 'Customer Name', default: false },
    { key: 'status', label: 'Status', default: false },
  ],
  purchase: [
    { key: 'date', label: 'Date', default: true },
    { key: 'invoice_number', label: 'Invoice Number', default: true },
    { key: 'vendor_name', label: 'Vendor Name', default: true },
    { key: 'total_amount', label: 'Total Amount', default: true },
    { key: 'input_gst', label: 'Input GST (ITC)', default: true },
    { key: 'vendor_gstin', label: 'Vendor GSTIN', default: false },
    { key: 'vendor_type', label: 'Vendor Type', default: false },
    { key: 'notes', label: 'Notes', default: false },
  ],
  gst: [
    { key: 'period', label: 'Period', default: true },
    { key: 'output_gst', label: 'Output GST', default: true },
    { key: 'input_gst', label: 'Input GST (ITC)', default: true },
    { key: 'net_gst', label: 'Net GST Payable', default: true },
    { key: 'cgst', label: 'CGST', default: true },
    { key: 'sgst', label: 'SGST', default: true },
    { key: 'igst', label: 'IGST', default: true },
    { key: 'hsn_code', label: 'HSN Code', default: false },
  ],
  inventory: [
    { key: 'sku', label: 'SKU', default: true },
    { key: 'name', label: 'Product Name', default: true },
    { key: 'category', label: 'Category', default: true },
    { key: 'current_stock', label: 'Current Stock', default: true },
    { key: 'cost_price', label: 'Cost Price', default: true },
    { key: 'selling_price', label: 'Selling Price', default: true },
    { key: 'min_stock_level', label: 'Min Stock Level', default: false },
    { key: 'hsn_code', label: 'HSN Code', default: false },
    { key: 'total_value', label: 'Stock Value', default: false },
  ],
  marketplace: [
    { key: 'platform', label: 'Platform', default: true },
    { key: 'revenue', label: 'Revenue', default: true },
    { key: 'orders', label: 'Orders', default: true },
    { key: 'commission', label: 'Commission', default: true },
    { key: 'returns', label: 'Returns', default: false },
    { key: 'avg_order_value', label: 'Avg Order Value', default: false },
  ],
  profit: [
    { key: 'period', label: 'Period', default: true },
    { key: 'revenue', label: 'Revenue', default: true },
    { key: 'cogs', label: 'Cost of Goods', default: true },
    { key: 'gross_profit', label: 'Gross Profit', default: true },
    { key: 'expenses', label: 'Total Expenses', default: true },
    { key: 'net_profit', label: 'Net Profit', default: true },
    { key: 'commission', label: 'Commission Paid', default: false },
    { key: 'tax', label: 'Tax Paid', default: false },
  ],
  customer: [
    { key: 'name', label: 'Customer Name', default: true },
    { key: 'email', label: 'Email', default: false },
    { key: 'total_orders', label: 'Total Orders', default: true },
    { key: 'total_revenue', label: 'Total Revenue', default: true },
    { key: 'marketplace', label: 'Marketplace', default: true },
    { key: 'last_order', label: 'Last Order Date', default: false },
    { key: 'gstin', label: 'GSTIN', default: false },
  ],
  expense: [
    { key: 'date', label: 'Date', default: true },
    { key: 'category', label: 'Category', default: true },
    { key: 'amount', label: 'Amount', default: true },
    { key: 'platform', label: 'Platform', default: true },
    { key: 'description', label: 'Description', default: false },
  ],
}

const REPORT_TYPES: Array<{ type: string; icon: React.ReactNode; title: string; desc: string; color: string }> = [
  { type: 'sales', icon: <TrendingUp size={18} />, title: 'Sales Report', desc: 'Revenue, orders, marketplace trends', color: 'text-blue-600 bg-blue-50' },
  { type: 'purchase', icon: <ShoppingBag size={18} />, title: 'Purchase Report', desc: 'Vendor purchases & Input GST (ITC)', color: 'text-indigo-600 bg-indigo-50' },
  { type: 'gst', icon: <FileText size={18} />, title: 'GST Report', desc: 'CGST, SGST, IGST with ITC', color: 'text-amber-600 bg-amber-50' },
  { type: 'profit', icon: <DollarSign size={18} />, title: 'Profit Report', desc: 'P&L with expense breakdown', color: 'text-emerald-600 bg-emerald-50' },
  { type: 'inventory', icon: <Package size={18} />, title: 'Inventory Report', desc: 'Stock levels and valuation', color: 'text-purple-600 bg-purple-50' },
  { type: 'marketplace', icon: <BarChart3 size={18} />, title: 'Marketplace Report', desc: 'Performance by platform', color: 'text-orange-600 bg-orange-50' },
  { type: 'customer', icon: <Users size={18} />, title: 'Customer Report', desc: 'Purchase history by customer', color: 'text-pink-600 bg-pink-50' },
  { type: 'expense', icon: <BarChart3 size={18} />, title: 'Expense Report', desc: 'Commission, fees, and costs', color: 'text-red-600 bg-red-50' },
]

export default function Reports() {
  const [generating, setGenerating] = useState<string | null>(null)
  const [from, setFrom] = useState(format(subMonths(new Date(), 1), 'yyyy-MM-dd'))
  const [to, setTo] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [expandedType, setExpandedType] = useState<string | null>(null)
  const [selectedFields, setSelectedFields] = useState<Record<string, string[]>>(() =>
    Object.fromEntries(
      Object.entries(REPORT_FIELDS).map(([type, fields]) => [type, fields.filter(f => f.default).map(f => f.key)])
    )
  )

  const toggleField = (type: string, key: string) => {
    setSelectedFields(prev => {
      const current = prev[type] ?? []
      return {
        ...prev,
        [type]: current.includes(key) ? current.filter(k => k !== key) : [...current, key],
      }
    })
  }

  const selectAll = (type: string) => setSelectedFields(prev => ({ ...prev, [type]: REPORT_FIELDS[type].map(f => f.key) }))
  const resetDefault = (type: string) => setSelectedFields(prev => ({ ...prev, [type]: REPORT_FIELDS[type].filter(f => f.default).map(f => f.key) }))

  const handleDownload = async (type: string, fmt: 'excel' | 'pdf' = 'excel') => {
    const key = `${type}-${fmt}`
    setGenerating(key)
    try {
      const fields = selectedFields[type] ?? []
      const res = await client.post('/reports/generate', {
        type,
        from_date: from,
        to_date: to,
        format: fmt,
        fields,
      })
      const reportId = res.data.data?.report_id
      if (!reportId) { toast.error('Report generation failed'); return }
      toast.success('Generating…')
      setTimeout(async () => {
        try {
          const dlRes = await reportsApi.download(reportId)

          if (fmt === 'pdf') {
            // PDF: open HTML in new tab so user can Print → Save as PDF
            const html = dlRes.data
            const blob = new Blob([html], { type: 'text/html; charset=UTF-8' })
            const url = URL.createObjectURL(blob)
            window.open(url, '_blank')
            toast.success('Click "Print / Save as PDF" in the opened tab')
          } else {
            // Excel: download as .xls (SpreadsheetML — opens natively in Excel)
            const blob = new Blob([dlRes.data], { type: 'application/vnd.ms-excel' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `${type}_report_${from}_${to}.xls`
            document.body.appendChild(a); a.click(); document.body.removeChild(a)
            URL.revokeObjectURL(url)
            toast.success('Excel downloaded!')
          }
        } catch { toast.error('Download failed') }
      }, 800)
    } catch {
      toast.error('Failed to generate report')
    } finally {
      setGenerating(null)
    }
  }

  return (
    <PageWrapper>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">Reports</h1>
          <p className="text-sm text-slate-400 mt-0.5">Select fields you need — download only what matters</p>
        </div>
        {/* Global Date Range */}
        <div className="flex items-center gap-2">
          <input type="date" value={from} onChange={e => setFrom(e.target.value)}
            className="px-3 py-2 text-sm bg-white border border-gray-300 rounded-md text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" />
          <span className="text-slate-400 text-sm">—</span>
          <input type="date" value={to} onChange={e => setTo(e.target.value)}
            className="px-3 py-2 text-sm bg-white border border-gray-300 rounded-md text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" />
        </div>
      </div>

      <div className="space-y-3">
        {REPORT_TYPES.map((r) => {
          const fields = REPORT_FIELDS[r.type] ?? []
          const selected = selectedFields[r.type] ?? []
          const isExpanded = expandedType === r.type

          return (
            <div key={r.type} className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
              {/* Header row */}
              <div className="flex items-center justify-between px-5 py-4">
                <div className="flex items-center gap-3">
                  <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0', r.color)}>
                    {r.icon}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{r.title}</p>
                    <p className="text-xs text-slate-400">{r.desc}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400 hidden sm:block">
                    {selected.length}/{fields.length} fields
                  </span>
                  <button
                    onClick={() => handleDownload(r.type, 'excel')}
                    disabled={generating === `${r.type}-excel` || selected.length === 0}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors">
                    <Download size={12} />
                    {generating === `${r.type}-excel` ? 'Generating…' : 'Excel'}
                  </button>
                  <button
                    onClick={() => handleDownload(r.type, 'pdf')}
                    disabled={generating === `${r.type}-pdf` || selected.length === 0}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white border border-gray-300 text-slate-700 rounded-md hover:bg-gray-50 disabled:opacity-50 transition-colors">
                    <Download size={12} />
                    {generating === `${r.type}-pdf` ? '…' : 'PDF'}
                  </button>
                  <button
                    onClick={() => setExpandedType(isExpanded ? null : r.type)}
                    className="p-1.5 rounded text-slate-400 hover:text-slate-600 hover:bg-gray-100 transition-colors">
                    {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                  </button>
                </div>
              </div>

              {/* Field selector — expanded */}
              {isExpanded && (
                <div className="px-5 pb-4 border-t border-gray-100 pt-3">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Choose columns to include</p>
                    <div className="flex gap-2">
                      <button onClick={() => selectAll(r.type)} className="text-xs text-blue-600 hover:text-blue-700">Select All</button>
                      <span className="text-slate-300">·</span>
                      <button onClick={() => resetDefault(r.type)} className="text-xs text-slate-500 hover:text-slate-700">Reset Default</button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {fields.map(field => {
                      const isSelected = selected.includes(field.key)
                      return (
                        <button
                          key={field.key}
                          onClick={() => toggleField(r.type, field.key)}
                          className={cn(
                            'flex items-center gap-1.5 text-xs px-3 py-1.5 rounded border font-medium transition-colors',
                            isSelected
                              ? 'bg-blue-50 border-blue-300 text-blue-700'
                              : 'bg-white border-gray-200 text-slate-500 hover:bg-gray-50 hover:text-slate-700'
                          )}>
                          {isSelected && <Check size={10} />}
                          {field.label}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </PageWrapper>
  )
}
