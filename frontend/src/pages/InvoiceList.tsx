import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Upload } from 'lucide-react'
import { useInvoices } from '../hooks/queries'
import { PageWrapper } from '../components/layout/PageWrapper'
import { MarketplaceBadge, StatusBadge } from '../components/ui/Badge'
import { TableSkeleton, EmptyState } from '../components/ui/Skeleton'
import { formatINR, formatDate } from '../lib/utils'

const MARKETPLACE_FILTERS = ['all', 'amazon', 'flipkart', 'meesho', 'other']
const STATUS_FILTERS = ['all', 'approved', 'review', 'processing', 'pending', 'error']

export default function InvoiceList() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [marketplace, setMarketplace] = useState('all')
  const [status, setStatus] = useState('all')
  const [page, setPage] = useState(1)

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

  return (
    <PageWrapper>
      {/* Page Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-slate-800">Invoices</h1>
        <button
          onClick={() => navigate('/invoices/upload')}
          className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-md transition-colors duration-150"
        >
          <Upload size={15} />
          Upload
        </button>
      </div>

      {/* Table Card */}
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)' }}>

        {/* Filter Bar */}
        <div className="px-4 py-3 border-b border-gray-200 space-y-3">
          {/* Search */}
          <div className="relative max-w-xs">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search invoice number, vendor…"
              value={search}
              onChange={(e) => handleFilterChange(setSearch, e.target.value)}
              className="w-full bg-white border border-gray-300 rounded-md pl-9 pr-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-colors duration-150"
            />
          </div>

          {/* Filter Chips */}
          <div className="flex flex-wrap items-center gap-2">
            {MARKETPLACE_FILTERS.map((m) => (
              <button
                key={m}
                onClick={() => handleFilterChange(setMarketplace, m)}
                className={`text-xs px-3 py-1 rounded border transition-colors duration-150 ${
                  marketplace === m
                    ? 'bg-blue-50 border-blue-300 text-blue-700 font-medium'
                    : 'bg-gray-100 border-gray-200 text-slate-600 hover:bg-gray-200 hover:border-gray-300'
                }`}
              >
                {m.charAt(0).toUpperCase() + m.slice(1)}
              </button>
            ))}
            <div className="w-px h-4 bg-gray-200 mx-1" />
            {STATUS_FILTERS.map((s) => (
              <button
                key={s}
                onClick={() => handleFilterChange(setStatus, s)}
                className={`text-xs px-3 py-1 rounded border transition-colors duration-150 ${
                  status === s
                    ? 'bg-blue-50 border-blue-300 text-blue-700 font-medium'
                    : 'bg-gray-100 border-gray-200 text-slate-600 hover:bg-gray-200 hover:border-gray-300'
                }`}
              >
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Table Body */}
        {isLoading ? (
          <div className="p-6">
            <TableSkeleton rows={8} cols={7} />
          </div>
        ) : isError ? (
          <div className="py-16 text-center">
            <p className="text-sm font-medium text-slate-500">Failed to load invoices</p>
            <p className="text-xs text-slate-400 mt-1">Check your connection and try again</p>
          </div>
        ) : invoices.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-sm font-medium text-slate-500">No invoices found</p>
            <p className="text-xs text-slate-400 mt-1">Try adjusting your filters or upload a new invoice</p>
            <button
              onClick={() => navigate('/invoices/upload')}
              className="mt-4 inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-md transition-colors duration-150"
            >
              <Upload size={14} />
              Upload Invoice
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
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Marketplace</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Amount</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">GST</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv, i) => (
                  <tr
                    key={inv.id}
                    onClick={() =>
                      navigate(
                        inv.processing_status === 'review'
                          ? `/invoices/${inv.id}/review`
                          : `/invoices/${inv.id}`
                      )
                    }
                    className="border-b border-gray-100 hover:bg-blue-50/20 cursor-pointer transition-colors duration-150"
                  >
                    <td className="px-4 py-3 text-xs text-slate-400 font-mono">
                      {(page - 1) * 20 + i + 1}
                    </td>
                    <td className="px-4 py-3 text-sm font-mono text-slate-800">
                      {inv.invoice_number ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {inv.invoice_date ? formatDate(inv.invoice_date) : '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-400">
                      {inv.created_at ? formatDate(inv.created_at) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <MarketplaceBadge marketplace={inv.marketplace} />
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-mono text-slate-800">
                      {formatINR(inv.total_amount)}
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-mono text-slate-500">
                      {formatINR(inv.tax_amount)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={inv.processing_status} />
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
            <p className="text-sm text-slate-500">
              Showing {invoices.length} of {meta.total} invoices
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="text-sm px-3 py-1.5 border border-gray-300 rounded-md text-slate-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-150"
              >
                Previous
              </button>
              <span className="text-sm text-slate-500 px-2">
                {page} / {meta.last_page}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(meta.last_page, p + 1))}
                disabled={page === meta.last_page}
                className="text-sm px-3 py-1.5 border border-gray-300 rounded-md text-slate-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-150"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </PageWrapper>
  )
}
