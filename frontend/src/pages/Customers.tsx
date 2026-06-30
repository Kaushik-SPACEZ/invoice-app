import { useState } from 'react'
import { Search } from 'lucide-react'
import { useCustomers } from '../hooks/queries'
import { PageWrapper } from '../components/layout/PageWrapper'
import { Card } from '../components/ui/Card'
import { Input } from '../components/ui/Input'
import { Badge } from '../components/ui/Badge'
import { Drawer } from '../components/ui/Modal'
import { TableSkeleton, EmptyState } from '../components/ui/Skeleton'
import { formatINR, formatDate } from '../lib/utils'
import type { Customer } from '../types'

export default function Customers() {
  const [search, setSearch] = useState('')
  const [type, setType] = useState('all')
  const [selected, setSelected] = useState<Customer | null>(null)

  const { data, isLoading } = useCustomers({ search: search || undefined, customer_type: type !== 'all' ? type : undefined })
  const customers = data?.data ?? []

  const initials = (name: string) => name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
  const avatarColor = (name: string) => {
    const colors = ['bg-primary/30', 'bg-emerald-500/30', 'bg-amber-500/30', 'bg-pink-500/30', 'bg-purple-500/30']
    return colors[name.charCodeAt(0) % colors.length]
  }

  return (
    <PageWrapper>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display font-bold text-2xl text-white">Customers</h1>
        <p className="text-sm text-gray-400">{data?.meta?.total ?? 0} total</p>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-6">
        <Input placeholder="Search name, GSTIN, city…" value={search} onChange={(e) => setSearch(e.target.value)} leftIcon={<Search size={14} />} className="max-w-xs" />
        {['all', 'b2b', 'b2c'].map((t) => (
          <button key={t} onClick={() => setType(t)}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${type === t ? 'bg-primary/20 border-primary/40 text-primary-light' : 'border-border-default text-gray-400 hover:text-gray-200'}`}>
            {t === 'all' ? 'All' : t.toUpperCase()}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-36 shimmer-bg rounded-2xl" />)}
        </div>
      ) : customers.length === 0 ? (
        <EmptyState icon="👥" title="No customers found" description="Customers are auto-created when you approve invoices" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {customers.map((c: Customer) => (
            <Card key={c.id} hover onClick={() => setSelected(c)} className="p-5 cursor-pointer">
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-10 h-10 rounded-full ${avatarColor(c.name)} flex items-center justify-center font-semibold text-sm text-white flex-shrink-0`}>
                  {initials(c.name)}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-200 truncate">{c.name}</p>
                  {c.gstin && <p className="text-xs font-mono text-gray-500 truncate">{c.gstin}</p>}
                </div>
                <Badge variant={c.customer_type === 'b2b' ? 'info' : 'default'} size="sm">{c.customer_type.toUpperCase()}</Badge>
              </div>
              {c.city && <p className="text-xs text-gray-400 mb-3">📍 {c.city}{c.state ? `, ${c.state}` : ''}</p>}
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-500">{c.total_purchases} orders</span>
                <span className="font-mono font-medium text-emerald-400">{formatINR(c.lifetime_revenue)}</span>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Detail Drawer */}
      <Drawer open={!!selected} onClose={() => setSelected(null)} title={selected?.name ?? ''} width="420px">
        {selected && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Type', value: selected.customer_type.toUpperCase() },
                { label: 'City', value: selected.city ?? '—' },
                { label: 'Phone', value: selected.phone ?? '—' },
                { label: 'Email', value: selected.email ?? '—' },
                { label: 'GSTIN', value: selected.gstin ?? '—', mono: true },
                { label: 'Pincode', value: selected.pincode ?? '—', mono: true },
              ].map(({ label, value, mono }) => (
                <div key={label}>
                  <p className="text-xs text-gray-500 mb-0.5">{label}</p>
                  <p className={`text-sm text-gray-200 ${mono ? 'font-mono' : ''}`}>{value}</p>
                </div>
              ))}
            </div>
            <div className="border-t border-border-default/50 pt-4">
              <div className="flex justify-between mb-3">
                <div>
                  <p className="text-xs text-gray-500">Total Purchases</p>
                  <p className="font-mono text-lg font-semibold text-white">{selected.total_purchases}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500">Lifetime Revenue</p>
                  <p className="font-mono text-lg font-semibold text-emerald-400">{formatINR(selected.lifetime_revenue)}</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </Drawer>
    </PageWrapper>
  )
}
