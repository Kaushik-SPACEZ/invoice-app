import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search } from 'lucide-react'
import { useInvoices } from '../hooks/queries'
import { PageWrapper } from '../components/layout/PageWrapper'
import { Card } from '../components/ui/Card'
import { Input } from '../components/ui/Input'
import { MarketplaceBadge, StatusBadge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
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

  // data is PaginatedResponse<Invoice> = { data: Invoice[], meta: {...} }
  const invoices = data?.data ?? []
  const meta = data?.meta

  const handleFilterChange = (setter: (v: string) => void, value: string) => {
    setter(value)
    setPage(1) // reset to page 1 on any filter change
  }

  return (
    <PageWrapper>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display font-bold text-2xl" style={{ color: 'var(--text-primary)' }}>Invoices</h1>
        <Button onClick={() => navigate('/invoices/upload')} size="sm">+ Upload</Button>
      </div>

      <Card>
        {/* Filters */}
        <div className="p-4 border-b border-border-default/50 space-y-3">
          <Input
            placeholder="Search invoice number, vendor…"
            value={search}
            onChange={(e) => { handleFilterChange(setSearch, e.target.value) }}
            leftIcon={<Search size={14} />}
            className="max-w-xs"
          />
          <div className="flex flex-wrap gap-2">
            {MARKETPLACE_FILTERS.map((m) => (
              <button
                key={m}
                onClick={() => handleFilterChange(setMarketplace, m)}
                className={`text-xs px-3 py-1 rounded-full border transition-colors ${marketplace === m ? 'bg-primary/20 border-primary/40 text-primary-light' : 'border-border-default text-gray-400 hover:text-gray-200'}`}
              >
                {m.charAt(0).toUpperCase() + m.slice(1)}
              </button>
            ))}
            <div className="w-px h-5 bg-border-default self-center mx-1" />
            {STATUS_FILTERS.map((s) => (
              <button
                key={s}
                onClick={() => handleFilterChange(setStatus, s)}
                className={`text-xs px-3 py-1 rounded-full border transition-colors ${status === s ? 'bg-primary/20 border-primary/40 text-primary-light' : 'border-border-default text-gray-400 hover:text-gray-200'}`}
              >
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="p-6"><TableSkeleton rows={8} cols={7} /></div>
        ) : isError ? (
          <EmptyState icon="⚠️" title="Failed to load invoices" description="Check your connection and try again" />
        ) : invoices.length === 0 ? (
          <EmptyState icon="📋" title="No invoices found" description="Try adjusting your filters or upload a new invoice"
            action={<Button onClick={() => navigate('/invoices/upload')}>Upload Invoice</Button>} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-xs text-gray-500 border-b border-border-default/50">
                  <th className="text-left px-5 py-3 font-medium">#</th>
                  <th className="text-left px-5 py-3 font-medium">Invoice No.</th>
                  <th className="text-left px-5 py-3 font-medium">Date</th>
                  <th className="text-left px-5 py-3 font-medium">Marketplace</th>
                  <th className="text-right px-5 py-3 font-medium">Amount</th>
                  <th className="text-right px-5 py-3 font-medium">GST</th>
                  <th className="text-left px-5 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv, i) => (
                  <tr
                    key={inv.id}
                    onClick={() => navigate(inv.processing_status === 'review' ? `/invoices/${inv.id}/review` : `/invoices/${inv.id}`)}
                    className="border-b border-border-default/30 hover:bg-white/3 cursor-pointer transition-colors"
                  >
                    <td className="px-5 py-3 text-xs text-gray-500 font-mono">{((page - 1) * 20) + i + 1}</td>
                    <td className="px-5 py-3 text-sm text-gray-200 font-mono">{inv.invoice_number ?? '—'}</td>
                    <td className="px-5 py-3 text-sm text-gray-400">{inv.invoice_date ? formatDate(inv.invoice_date) : '—'}</td>
                    <td className="px-5 py-3"><MarketplaceBadge marketplace={inv.marketplace} /></td>
                    <td className="px-5 py-3 text-right text-sm font-mono text-gray-200">{formatINR(inv.total_amount)}</td>
                    <td className="px-5 py-3 text-right text-sm font-mono text-gray-400">{formatINR(inv.tax_amount)}</td>
                    <td className="px-5 py-3"><StatusBadge status={inv.processing_status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {meta && meta.last_page > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-border-default/50">
            <p className="text-xs text-gray-500">Showing {invoices.length} of {meta.total}</p>
            <div className="flex gap-2">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                className="text-xs px-3 py-1.5 rounded-lg border border-border-default text-gray-400 hover:text-gray-200 disabled:opacity-40 transition-colors">Previous</button>
              <span className="text-xs px-3 py-1.5 text-gray-400">{page} / {meta.last_page}</span>
              <button onClick={() => setPage((p) => Math.min(meta.last_page, p + 1))} disabled={page === meta.last_page}
                className="text-xs px-3 py-1.5 rounded-lg border border-border-default text-gray-400 hover:text-gray-200 disabled:opacity-40 transition-colors">Next</button>
            </div>
          </div>
        )}
      </Card>
    </PageWrapper>
  )
}
