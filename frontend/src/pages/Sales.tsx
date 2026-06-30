import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useSalesSummary, useSalesByMarketplace } from '../hooks/queries'
import { salesApi } from '../api'
import { PageWrapper } from '../components/layout/PageWrapper'
import { Card, CardHeader, CardBody } from '../components/ui/Card'
import { MetricCard } from '../components/dashboard/MetricCard'
import { MarketplaceBadge, StatusBadge } from '../components/ui/Badge'
import { RevenueAreaChart } from '../components/charts/Charts'
import { TableSkeleton, EmptyState } from '../components/ui/Skeleton'
import { TrendingUp, ShoppingCart, DollarSign, RefreshCw } from 'lucide-react'
import { formatINR, formatDate, MARKETPLACE_COLORS } from '../lib/utils'

const PERIODS = ['today', 'week', 'month', 'year'] as const
type Period = typeof PERIODS[number]

export default function Sales() {
  const [period, setPeriod] = useState<Period>('month')
  const { data: summary, isLoading } = useSalesSummary(period)
  const { data: byMarketplace } = useSalesByMarketplace()
  const { data: salesList, isLoading: listLoading, isError } = useQuery({
    queryKey: ['sales', 'list', period],
    queryFn: () => salesApi.list({ period }).then((r) => r.data.data),
  })

  // salesList is already unwrapped to PaginatedResponse shape
  const orders = salesList?.data ?? []

  return (
    <PageWrapper>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display font-bold text-2xl" style={{ color: 'var(--text-primary)' }}>Sales</h1>
        <div className="flex gap-1 bg-bg-card border border-border-default rounded-xl p-1">
          {PERIODS.map((p) => (
            <button key={p} onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors capitalize ${period === p ? 'bg-primary text-white' : 'text-gray-400 hover:text-gray-200'}`}>
              {p === 'today' ? 'Today' : p === 'week' ? 'This Week' : p === 'month' ? 'This Month' : 'This Year'}
            </button>
          ))}
        </div>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <MetricCard label="Revenue" value={summary?.revenue ?? 0} icon={<TrendingUp size={18} />} iconColor="bg-primary/20 text-primary-light" index={0} />
        <MetricCard label="Orders" value={summary?.orders ?? 0} format="number" icon={<ShoppingCart size={18} />} iconColor="bg-emerald-500/20 text-emerald-400" index={1} />
        <MetricCard label="Avg Order Value" value={summary?.avg_order_value ?? 0} icon={<DollarSign size={18} />} iconColor="bg-amber-500/20 text-amber-400" index={2} />
        <MetricCard label="Returns" value={summary?.returns ?? 0} format="number" icon={<RefreshCw size={18} />} iconColor="bg-red-500/20 text-red-400" index={3} />
      </div>

      {/* Marketplace breakdown — from real API */}
      {byMarketplace && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          {Object.entries(byMarketplace).map(([mp, d_]) => {
            const d = d_ as { revenue: number; orders: number; commission: number }
            return (
              <Card key={mp} className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-3 h-3 rounded-full" style={{ background: MARKETPLACE_COLORS[mp] }} />
                  <span className="text-sm font-medium text-gray-200 capitalize">{mp}</span>
                </div>
                <p className="font-mono font-semibold text-xl text-white">{formatINR(d.revenue)}</p>
                <p className="text-xs text-gray-400 mt-1">{d.orders} orders</p>
              </Card>
            )
          })}
        </div>
      )}

      {/* Sales Table */}
      <Card>
        <CardHeader><span className="font-semibold text-sm text-gray-200">Sales Orders</span></CardHeader>
        {listLoading ? (
          <CardBody><TableSkeleton rows={6} cols={6} /></CardBody>
        ) : isError ? (
          <EmptyState icon="⚠️" title="Failed to load sales" description="Check your connection and try again" />
        ) : orders.length === 0 ? (
          <EmptyState icon="🛒" title="No sales yet" description="Approve invoices to see sales data here" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-xs text-gray-500 border-b border-border-default/50">
                  {['Date', 'Order #', 'Marketplace', 'Revenue', 'Tax', 'Net Revenue', 'Status'].map((h) => (
                    <th key={h} className="px-5 py-3 text-left font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {orders.map((order: any) => (
                  <tr key={order.id} className="border-b border-border-default/30 hover:bg-white/3 transition-colors">
                    <td className="px-5 py-3 text-sm text-gray-400">{order.order_date ? formatDate(order.order_date) : '—'}</td>
                    <td className="px-5 py-3 text-sm font-mono text-gray-200">{order.order_number}</td>
                    <td className="px-5 py-3"><MarketplaceBadge marketplace={order.marketplace} /></td>
                    <td className="px-5 py-3 text-sm font-mono text-gray-200">{formatINR(order.total_amount)}</td>
                    <td className="px-5 py-3 text-sm font-mono text-gray-400">{formatINR(order.tax_amount)}</td>
                    <td className="px-5 py-3 text-sm font-mono text-emerald-400">{formatINR(order.net_revenue)}</td>
                    <td className="px-5 py-3"><StatusBadge status={order.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </PageWrapper>
  )
}
