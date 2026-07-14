import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { Search, Upload, Plus, Trash2, RefreshCw } from 'lucide-react'
import { useInvoices } from '../hooks/queries'
import { invoicesApi } from '../api/invoices'
import { PageWrapper } from '../components/layout/PageWrapper'
import { MarketplaceBadge, StatusBadge } from '../components/ui/Badge'
import { TableSkeleton, EmptyState } from '../components/ui/Skeleton'
import { Modal } from '../components/ui/Modal'
import { formatINR, formatDate, cn } from '../lib/utils'
import client from '../api/client'
import toast from 'react-hot-toast'

const MARKETPLACE_FILTERS = ['all', 'amazon', 'flipkart', 'meesho', 'other']
const STATUS_FILTERS = ['all', 'approved', 'review', 'processing', 'pending', 'error']

const MARKETPLACE_OPTIONS = [
  { value: 'amazon', label: 'Amazon' },
  { value: 'flipkart', label: 'Flipkart' },
  { value: 'meesho', label: 'Meesho' },
  { value: 'direct', label: 'Direct / Website' },
  { value: 'offline', label: 'Offline / Walk-in' },
  { value: 'other', label: 'Other' },
]

const EMPTY_MANUAL = {
  invoice_number: '', invoice_date: '', vendor_name: '',
  vendor_gstin: '', customer_name: '', marketplace: 'amazon',
  subtotal: '', tax_amount: '', total_amount: '',
}

export default function InvoiceList() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [marketplace, setMarketplace] = useState('all')
  const [status, setStatus] = useState('all')
  const [page, setPage] = useState(1)
  const [showAddModal, setShowAddModal] = useState(false)
  const [manualForm, setManualForm] = useState({ ...EMPTY_MANUAL })
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; num: string } | null>(null)

  // Track recently-uploaded invoices that are still processing
  const [processingIds, setProcessingIds] = useState<Set<number>>(() => {
    const stored = sessionStorage.getItem('pendingInvoiceIds')
    if (stored) {
      sessionStorage.removeItem('pendingInvoiceIds')
      return new Set(stored.split(',').map(Number).filter(Boolean))
    }
    return new Set()
  })
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Poll processing invoices until they reach review/error/approved
  useEffect(() => {
    if (processingIds.size === 0) return

    const poll = async () => {
      const ids = Array.from(processingIds)
      const results = await Promise.all(ids.map(async id => {
        try {
          const res = await invoicesApi.getStatus(id)
          return { id, status: res.data.data?.status }
        } catch { return { id, status: 'error' } }
      }))

      const stillPending = new Set<number>()
      let anyDone = false
      results.forEach(({ id, status }) => {
        if (status === 'pending' || status === 'processing') {
          stillPending.add(id)
        } else {
          anyDone = true
        }
      })

      if (anyDone) {
        qc.invalidateQueries({ queryKey: ['invoices'] })
      }

      setProcessingIds(stillPending)
      if (stillPending.size === 0 && pollingRef.current) {
        clearInterval(pollingRef.current)
        pollingRef.current = null
      }
    }

    poll()
    pollingRef.current = setInterval(poll, 3000)
    return () => { if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null } }
  }, [processingIds.size > 0])

  const { data, isLoading, isError } = useInvoices({
    search: search || undefined,
    marketplace: marketplace !== 'all' ? marketplace : undefined,
    status: status !== 'all' ? status : undefined,
    page,
  })

  const invoices = data?.data ?? []
  const meta = data

  const handleFilterChange = (setter: (v: string) => void, value: string) => {
    setter(value)
    setPage(1)
  }

  const handleManualSave = async () => {
    if (!manualForm.vendor_name.trim()) { toast.error('Vendor name required'); return }
    if (!manualForm.total_amount) { toast.error('Total amount required'); return }
    setSaving(true)
    try {
      const res = await client.post('/invoices/manual', {
        ...manualForm,
        subtotal: Number(manualForm.subtotal) || 0,
        tax_amount: Number(manualForm.tax_amount) || 0,
        total_amount: Number(manualForm.total_amount),
        processing_status: 'approved',
      })
      qc.invalidateQueries({ queryKey: ['invoices'] })
      toast.success('Invoice added successfully')
      setShowAddModal(false)
      setManualForm({ ...EMPTY_MANUAL })
      if (res.data?.data?.id) navigate(`/invoices/${res.data.data.id}`)
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Failed to add invoice')
    } finally {
      setSaving(false)
    }
  }

  const confirmDelete = (inv: any) => {
    setDeleteTarget({ id: inv.id, num: inv.invoice_number ?? `#${inv.id}` })
    setShowDeleteModal(true)
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeletingId(deleteTarget.id)
    try {
      await client.delete(`/invoices/${deleteTarget.id}`)
      qc.invalidateQueries({ queryKey: ['invoices'] })
      toast.success('Invoice deleted')
      setShowDeleteModal(false)
      setDeleteTarget(null)
    } catch {
      toast.error('Failed to delete invoice')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <PageWrapper>
      {/* Page Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold text-slate-800">Invoices</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 bg-white border border-gray-300 hover:bg-gray-50 text-slate-700 text-sm font-medium px-3 py-2 rounded-md transition-colors"
          >
            <Plus size={14} /> Add Manually
          </button>
          <button
            onClick={() => navigate('/invoices/upload')}
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-md transition-colors"
          >
            <Upload size={14} /> Upload
          </button>
        </div>
      </div>

      {/* Processing banner — shown while uploaded invoices are being processed by AI */}
      {processingIds.size > 0 && (
        <div className="mb-4 flex items-center gap-3 px-4 py-3 bg-blue-50 border border-blue-200 rounded-lg">
          <RefreshCw size={15} className="text-blue-600 animate-spin flex-shrink-0" />
          <p className="text-sm text-blue-700">
            <strong>{processingIds.size} invoice{processingIds.size > 1 ? 's' : ''}</strong> being processed by AI — page will update automatically when ready.
          </p>
        </div>
      )}

      {/* Table Card */}
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">

        {/* Filter Bar */}
        <div className="px-4 py-3 border-b border-gray-200 space-y-3">
          <div className="relative max-w-xs">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search invoice number, vendor…"
              value={search}
              onChange={(e) => handleFilterChange(setSearch, e.target.value)}
              className="w-full bg-white border border-gray-300 rounded-md pl-9 pr-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {MARKETPLACE_FILTERS.map((m) => (
              <button key={m} onClick={() => handleFilterChange(setMarketplace, m)}
                className={`text-xs px-3 py-1 rounded border transition-colors ${marketplace === m ? 'bg-blue-50 border-blue-300 text-blue-700 font-medium' : 'bg-gray-100 border-gray-200 text-slate-600 hover:bg-gray-200'}`}>
                {m.charAt(0).toUpperCase() + m.slice(1)}
              </button>
            ))}
            <div className="w-px h-4 bg-gray-200 mx-1" />
            {STATUS_FILTERS.map((s) => (
              <button key={s} onClick={() => handleFilterChange(setStatus, s)}
                className={`text-xs px-3 py-1 rounded border transition-colors ${status === s ? 'bg-blue-50 border-blue-300 text-blue-700 font-medium' : 'bg-gray-100 border-gray-200 text-slate-600 hover:bg-gray-200'}`}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="p-6"><TableSkeleton rows={8} cols={7} /></div>
        ) : isError ? (
          <div className="py-16 text-center"><p className="text-sm text-slate-500">Failed to load invoices</p></div>
        ) : invoices.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-sm font-medium text-slate-500">No invoices found</p>
            <button onClick={() => navigate('/invoices/upload')} className="mt-4 inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-md transition-colors">
              <Upload size={14} /> Upload Invoice
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">#</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Invoice No.</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Invoice Date</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Scanned On</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Platform</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Amount</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">GST</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv, i) => (
                  <tr key={inv.id}
                    onClick={() => navigate(inv.processing_status === 'review' ? `/invoices/${inv.id}/review` : `/invoices/${inv.id}`)}
                    className={cn(
                      'border-b border-gray-100 cursor-pointer transition-colors',
                      processingIds.has(inv.id)
                        ? 'bg-blue-50/40 hover:bg-blue-50/60'
                        : 'hover:bg-blue-50/20'
                    )}>
                    <td className="px-4 py-3 text-xs text-slate-400 font-mono">{(page - 1) * 20 + i + 1}</td>
                    <td className="px-4 py-3 text-sm font-mono text-slate-800">{inv.invoice_number ?? '—'}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{inv.invoice_date ? formatDate(inv.invoice_date) : '—'}</td>
                    <td className="px-4 py-3 text-sm text-slate-400">{inv.created_at ? formatDate(inv.created_at) : '—'}</td>
                    <td className="px-4 py-3"><MarketplaceBadge marketplace={inv.marketplace} /></td>
                    <td className="px-4 py-3 text-right text-sm font-mono text-slate-800">{formatINR(inv.total_amount)}</td>
                    <td className="px-4 py-3 text-right text-sm font-mono text-slate-500">{formatINR(inv.tax_amount)}</td>
                    <td className="px-4 py-3"><StatusBadge status={inv.processing_status} /></td>
                    <td className="px-4 py-3">
                      <button onClick={e => { e.stopPropagation(); confirmDelete(inv) }}
                        className="p-1.5 rounded text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors">
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {meta && meta.last_page > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
            <p className="text-sm text-slate-500">Showing {invoices.length} of {meta.total} invoices</p>
            <div className="flex items-center gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="text-sm px-3 py-1.5 border border-gray-300 rounded-md text-slate-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed">Previous</button>
              <span className="text-sm text-slate-500 px-2">{page} / {meta.last_page}</span>
              <button onClick={() => setPage(p => Math.min(meta.last_page, p + 1))} disabled={page === meta.last_page}
                className="text-sm px-3 py-1.5 border border-gray-300 rounded-md text-slate-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed">Next</button>
            </div>
          </div>
        )}
      </div>

      {/* Manual Add Invoice Modal */}
      <Modal open={showAddModal} onClose={() => setShowAddModal(false)} title="Add Invoice Manually" size="lg">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Invoice Number</label>
            <input type="text" placeholder="e.g. INV-2024-001" value={manualForm.invoice_number}
              onChange={e => setManualForm(p => ({ ...p, invoice_number: e.target.value }))}
              className="w-full px-3 py-2 text-sm font-mono bg-white border border-gray-300 rounded-md text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Invoice Date</label>
            <input type="date" value={manualForm.invoice_date}
              onChange={e => setManualForm(p => ({ ...p, invoice_date: e.target.value }))}
              className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-md text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Vendor Name *</label>
            <input type="text" placeholder="e.g. Sri Annai Enterprises" value={manualForm.vendor_name}
              onChange={e => setManualForm(p => ({ ...p, vendor_name: e.target.value }))}
              className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-md text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Vendor GSTIN</label>
            <input type="text" placeholder="33ATMPP2365G1ZK" value={manualForm.vendor_gstin}
              onChange={e => setManualForm(p => ({ ...p, vendor_gstin: e.target.value.toUpperCase() }))}
              className="w-full px-3 py-2 text-sm font-mono bg-white border border-gray-300 rounded-md text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Customer Name</label>
            <input type="text" value={manualForm.customer_name}
              onChange={e => setManualForm(p => ({ ...p, customer_name: e.target.value }))}
              className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-md text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Platform</label>
            <select value={manualForm.marketplace} onChange={e => setManualForm(p => ({ ...p, marketplace: e.target.value }))}
              className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-md text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20">
              {MARKETPLACE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Subtotal (₹)</label>
            <input type="number" placeholder="0.00" min="0" step="0.01" value={manualForm.subtotal}
              onChange={e => setManualForm(p => ({ ...p, subtotal: e.target.value }))}
              className="w-full px-3 py-2 text-sm font-mono bg-white border border-gray-300 rounded-md text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Tax Amount (₹)</label>
            <input type="number" placeholder="0.00" min="0" step="0.01" value={manualForm.tax_amount}
              onChange={e => setManualForm(p => ({ ...p, tax_amount: e.target.value }))}
              className="w-full px-3 py-2 text-sm font-mono bg-white border border-gray-300 rounded-md text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" />
          </div>
          <div className="col-span-2">
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Total Amount (₹) *</label>
            <input type="number" placeholder="0.00" min="0" step="0.01" value={manualForm.total_amount}
              onChange={e => setManualForm(p => ({ ...p, total_amount: e.target.value }))}
              className="w-full px-3 py-2 text-sm font-mono bg-white border border-gray-300 rounded-md text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" />
          </div>
        </div>
        <div className="flex gap-3 mt-6 pt-4 border-t border-gray-100">
          <button onClick={() => setShowAddModal(false)} className="px-4 py-2 text-sm font-medium bg-white border border-gray-300 text-slate-700 rounded-md hover:bg-gray-50">Cancel</button>
          <button onClick={handleManualSave} disabled={saving} className="px-6 py-2 text-sm font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50">
            {saving ? 'Saving…' : 'Add Invoice'}
          </button>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal open={showDeleteModal} onClose={() => setShowDeleteModal(false)} title="Delete Invoice" size="sm">
        <p className="text-sm text-slate-600">
          Are you sure you want to delete invoice <strong className="font-mono">{deleteTarget?.num}</strong>?
          This action cannot be undone.
        </p>
        <div className="flex gap-3 mt-6 pt-4 border-t border-gray-100">
          <button onClick={() => setShowDeleteModal(false)} className="flex-1 px-4 py-2 text-sm font-medium bg-white border border-gray-300 text-slate-700 rounded-md hover:bg-gray-50">Cancel</button>
          <button onClick={handleDelete} disabled={!!deletingId} className="flex-1 px-4 py-2 text-sm font-medium bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50">
            {deletingId ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </Modal>
    </PageWrapper>
  )
}
