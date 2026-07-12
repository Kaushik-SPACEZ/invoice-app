import { useState } from 'react'
import { Search } from 'lucide-react'
import { useCustomers } from '../hooks/queries'
import { PageWrapper } from '../components/layout/PageWrapper'
import { Badge } from '../components/ui/Badge'
import { TableSkeleton, EmptyState } from '../components/ui/Skeleton'
import { formatINR } from '../lib/utils'
import { cn } from '../lib/utils'
import type { Customer } from '../types'

export default function Customers() {
  const [search, setSearch] = useState('')
  const [type, setType] = useState('all')
  const [selected, setSelected] = useState<Customer | null>(null)

  const { data, isLoading } = useCustomers({ search: search || undefined, customer_type: type !== 'all' ? type : undefined })
  const customers = data?.data ?? []

  const initials = (name: string) => name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
  const AVATAR_COLORS = ['bg-blue-100 text-blue-700', 'bg-emerald-100 text-emerald-700', 'bg-amber-100 text-amber-700', 'bg-pink-100 text-pink-700', 'bg-purple-100 text-purple-700']
  const avatarColor = (name: string) => AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length]

  return (
    <PageWrapper>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-slate-800">Customers</h1>
        <p className="text-sm text-slate-400">{data?.total ?? data?.meta?.total ?? 0} total</p>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-6 flex-wrap">
        <div className="relative max-w-xs w-full">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search name, GSTIN, city…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-2 text-sm bg-white border border-gray-300 rounded-md text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
          />
        </div>
        {['all', 'b2b', 'b2c'].map((t) => (
          <button key={t} onClick={() => setType(t)}
            className={cn('text-xs px-4 py-2 rounded-full border font-medium transition-colors',
              type === t ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white border-gray-200 text-slate-600 hover:bg-gray-50'
            )}>
            {t === 'all' ? 'All' : t.toUpperCase()}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-36 bg-gray-100 rounded-lg animate-pulse" />)}
        </div>
      ) : customers.length === 0 ? (
        <EmptyState icon="👥" title="No customers found" description="Customers are auto-created when you approve invoices" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {customers.map((c: Customer) => (
            <div key={c.id} onClick={() => setSelected(c)}
              className="bg-white border border-gray-200 rounded-lg shadow-sm p-5 cursor-pointer hover:shadow-md hover:border-blue-200 transition-all duration-150">
              <div className="flex items-center gap-3 mb-3">
                <div className={cn('w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm flex-shrink-0', avatarColor(c.name))}>
                  {initials(c.name)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-800 truncate">{c.name}</p>
                  {c.gstin && <p className="text-xs font-mono text-slate-400 truncate">{c.gstin}</p>}
                </div>
                <span className={cn('text-xs px-2 py-0.5 rounded border font-medium flex-shrink-0',
                  c.customer_type === 'b2b' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-slate-50 text-slate-600 border-slate-200'
                )}>
                  {c.customer_type?.toUpperCase() ?? 'B2C'}
                </span>
              </div>
              {c.city && <p className="text-xs text-slate-500 mb-3">📍 {c.city}{c.state ? `, ${c.state}` : ''}</p>}
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">{c.total_purchases} orders</span>
                <span className="font-mono font-semibold text-emerald-600">{formatINR(c.lifetime_revenue)}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Detail side panel */}
      {selected && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/30" onClick={() => setSelected(null)} />
          <div className="w-96 bg-white shadow-2xl flex flex-col">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-800">{selected.name}</h2>
              <button onClick={() => setSelected(null)} className="text-slate-400 hover:text-slate-600 text-xl leading-none">×</button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: 'Type', value: selected.customer_type?.toUpperCase() ?? '—' },
                  { label: 'City', value: selected.city ?? '—' },
                  { label: 'Phone', value: selected.phone ?? '—' },
                  { label: 'Email', value: selected.email ?? '—' },
                  { label: 'GSTIN', value: selected.gstin ?? '—', mono: true },
                  { label: 'Pincode', value: selected.pincode ?? '—', mono: true },
                ].map(({ label, value, mono }) => (
                  <div key={label}>
                    <p className="text-xs text-slate-400 mb-0.5">{label}</p>
                    <p className={cn('text-sm text-slate-800', mono && 'font-mono')}>{value}</p>
                  </div>
                ))}
              </div>
              <div className="border-t border-gray-100 pt-4 flex justify-between">
                <div>
                  <p className="text-xs text-slate-400">Total Purchases</p>
                  <p className="font-mono text-lg font-semibold text-slate-800">{selected.total_purchases}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-400">Lifetime Revenue</p>
                  <p className="font-mono text-lg font-semibold text-emerald-600">{formatINR(selected.lifetime_revenue)}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </PageWrapper>
  )
}
