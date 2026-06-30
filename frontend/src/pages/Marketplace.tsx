import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useMarketplaceAnalytics } from '../hooks/queries'
import { marketplaceApi } from '../api'
import { PageWrapper } from '../components/layout/PageWrapper'
import { Card, CardHeader, CardBody } from '../components/ui/Card'
import { MetricCard } from '../components/dashboard/MetricCard'
import { Badge } from '../components/ui/Badge'
import { MarketplaceBarChart } from '../components/charts/Charts'
import { TableSkeleton, EmptyState } from '../components/ui/Skeleton'
import { formatINR, MARKETPLACE_COLORS } from '../lib/utils'
import { TrendingUp, DollarSign, ShoppingCart, RefreshCw } from 'lucide-react'

const PLATFORMS = ['all', 'amazon', 'flipkart', 'meesho'] as const
type Platform = typeof PLATFORMS[number]

export default function Marketplace() {
  const [platform, setPlatform] = useState<Platform>('all')
  const { data: analytics } = useMarketplaceAnalytics()
  const { data: settlementsRaw, isLoading: settlementsLoading } = useQuery({
    queryKey: ['settlements', platform],
    queryFn: () => marketplaceApi.settlements({ marketplace: platform !== 'all' ? platform : undefined }).then((r) => r.data.data),
  })

  const allPlatforms = analytics?.by_platform ?? {}

  // Filter platforms by selected tab
  const filteredPlatforms = platform === 'all'
    ? allPlatforms
    : Object.fromEntries(Object.entries(allPlatforms).filter(([mp]) => mp === platform))

  // settlements is PaginatedResponse = { data: [], meta: {} }
  const settlements = settlementsRaw?.data ?? []

  // Active platform count from real data
  const activePlatformCount = Object.keys(allPlatforms).length || 3

  return (
    <PageWrapper>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display font-bold text-2xl" style={{ color: 'var(--text-primary)' }}>Marketplace Analytics</h1>
      </div>

      {/* Platform tabs */}
      <div className="flex gap-1 mb-6 bg-bg-card border border-border-default rounded-xl p-1 w-fit">
        {PLATFORMS.map((p) => (
          <button key={p} onClick={() => setPlatform(p)}
            className={`px-4 py-2 rounded-lg text-xs font-medium transition-colors capitalize ${platform === p ? 'bg-primary text-white' : 'text-gray-400 hover:text-gray-200'}`}>
            {p === 'all' ? 'All Platforms' : p.charAt(0).toUpperCase() + p.slice(1)}
          </button>
        ))}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <MetricCard label="Total Revenue" value={analytics?.total_revenue ?? 0} icon={<TrendingUp size={18} />} iconColor="bg-primary/20 text-primary-light" index={0} />
        <MetricCard label="Commission Paid" value={analytics?.total_commission ?? 0} icon={<DollarSign size={18} />} iconColor="bg-amber-500/20 text-amber-400" index={1} />
        <MetricCard label="Total Returns" value={analytics?.total_returns ?? 0} format="number" icon={<RefreshCw size={18} />} iconColor="bg-red-500/20 text-red-400" index={2} />
        <MetricCard label="Active Platforms" value={activePlatformCount} format="number" icon={<ShoppingCart size={18} />} iconColor="bg-emerald-500/20 text-emerald-400" index={3} />
      </div>

      {/* Platform cards — filtered */}
      {Object.keys(filteredPlatforms).length === 0 ? (
        <EmptyState icon="🏪" title="No data for this platform" description="Approve invoices from this marketplace to see analytics" />
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-6">
          {Object.entries(filteredPlatforms).map(([mp, d_]) => {
            const d = d_ as { revenue: number; orders: number; commission: number; commission_pct: number; returns: number; top_product: string }
            return (
              <Card key={mp} className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ background: MARKETPLACE_COLORS[mp] }} />
                    <span className="font-semibold text-gray-200 capitalize">{mp}</span>
                  </div>
                  <Badge variant="muted">{d.orders} orders</Badge>
                </div>
                <p className="font-mono font-bold text-2xl text-white mb-1">{formatINR(d.revenue)}</p>
                <div className="space-y-1.5 mt-3">
                  <div className="flex justify-between text-xs"><span className="text-gray-400">Commission</span><span className="font-mono text-amber-400">{formatINR(d.commission)} ({d.commission_pct}%)</span></div>
                  <div className="flex justify-between text-xs"><span className="text-gray-400">Returns</span><span className="font-mono text-red-400">{d.returns}</span></div>
                  <div className="flex justify-between text-xs"><span className="text-gray-400">Top Product</span><span className="text-gray-300">{d.top_product}</span></div>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {/* Revenue Chart */}
      {Object.keys(filteredPlatforms).length > 0 && (
        <Card className="mb-6">
          <CardHeader><span className="font-semibold text-sm text-gray-200">Revenue Comparison</span></CardHeader>
          <CardBody>
            <MarketplaceBarChart data={
              Object.fromEntries(Object.entries(filteredPlatforms).map(([k, v_]) => {
                const v = v_ as { revenue: number; orders: number }
                return [k, { revenue: v.revenue, orders: v.orders }]
              }))
            } />
          </CardBody>
        </Card>
      )}

      {/* Settlements */}
      <Card>
        <CardHeader><span className="font-semibold text-sm text-gray-200">Settlement Tracking</span></CardHeader>
        <CardBody className="p-0">
          {settlementsLoading ? (
            <div className="p-6"><TableSkeleton rows={4} cols={6} /></div>
          ) : settlements.length === 0 ? (
            <EmptyState icon="💰" title="No settlements yet" description="Settlement data will appear here once available" />
          ) : (
            <table className="w-full">
              <thead>
                <tr className="text-xs text-gray-500 border-b border-border-default/50">
                  {['Platform', 'Period', 'Expected', 'Received', 'Difference', 'Status'].map((h) => (
                    <th key={h} className="px-5 py-3 text-left font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {settlements.map((s: any) => (
                  <tr key={s.id} className="border-b border-border-default/30 hover:bg-white/3">
                    <td className="px-5 py-3 text-sm text-gray-200 capitalize">{s.marketplace}</td>
                    <td className="px-5 py-3 text-xs text-gray-400">{s.period_start} – {s.period_end}</td>
                    <td className="px-5 py-3 text-sm font-mono text-gray-200">{formatINR(s.expected_amount)}</td>
                    <td className="px-5 py-3 text-sm font-mono text-gray-200">{formatINR(s.payment_received)}</td>
                    <td className={`px-5 py-3 text-sm font-mono font-semibold ${(s.difference ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{formatINR(Math.abs(s.difference ?? 0))}</td>
                    <td className="px-5 py-3"><Badge variant={s.status === 'received' ? 'success' : s.status === 'disputed' ? 'danger' : 'warning'} dot>{s.status}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardBody>
      </Card>
    </PageWrapper>
  )
}
