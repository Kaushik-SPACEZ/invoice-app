import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useMarketplaceAnalytics } from '../hooks/queries'
import { marketplaceApi } from '../api'
import { PageWrapper } from '../components/layout/PageWrapper'
import { MetricCard } from '../components/dashboard/MetricCard'
import { MarketplaceBarChart } from '../components/charts/Charts'
import { TableSkeleton, EmptyState } from '../components/ui/Skeleton'
import { formatINR, MARKETPLACE_COLORS, cn } from '../lib/utils'
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

  const allPlatforms = analytics?.byPlatform ?? analytics?.by_platform ?? {}
  const filteredPlatforms = platform === 'all'
    ? allPlatforms
    : Object.fromEntries(Object.entries(allPlatforms).filter(([mp]) => mp === platform))

  const settlements = settlementsRaw?.data ?? []
  const activePlatformCount = Object.keys(allPlatforms).length || 0

  const kpiRevenue = platform === 'all'
    ? Number(analytics?.totalRevenue ?? analytics?.total_revenue ?? 0)
    : Number((filteredPlatforms[platform] as any)?.revenue ?? 0)
  const kpiCommission = platform === 'all'
    ? Number(analytics?.totalCommission ?? analytics?.total_commission ?? 0)
    : Number((filteredPlatforms[platform] as any)?.commission ?? 0)
  const kpiReturns = platform === 'all'
    ? Number(analytics?.totalReturns ?? analytics?.total_returns ?? 0)
    : Number((filteredPlatforms[platform] as any)?.returns ?? 0)

  return (
    <PageWrapper>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-slate-800">Marketplace Analytics</h1>
      </div>

      {/* Platform tabs */}
      <div className="flex border-b border-gray-200 mb-6">
        {PLATFORMS.map((p) => (
          <button key={p} onClick={() => setPlatform(p)}
            className={cn(
              'px-4 py-2.5 text-sm font-medium border-b-2 transition-colors duration-150 capitalize',
              platform === p ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-700'
            )}>
            {p === 'all' ? 'All Platforms' : p.charAt(0).toUpperCase() + p.slice(1)}
          </button>
        ))}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <MetricCard label="Total Revenue"    value={kpiRevenue}          icon={<TrendingUp size={18} />}  iconColor="text-blue-600"   index={0} />
        <MetricCard label="Commission Paid"  value={kpiCommission}       icon={<DollarSign size={18} />}  iconColor="text-amber-600"  index={1} />
        <MetricCard label="Total Returns"    value={kpiReturns} format="number" icon={<RefreshCw size={18} />}   iconColor="text-red-600"    index={2} />
        <MetricCard label="Active Platforms" value={activePlatformCount} format="number" icon={<ShoppingCart size={18} />} iconColor="text-emerald-600" index={3} />
      </div>

      {/* Platform cards */}
      {Object.keys(filteredPlatforms).length === 0 ? (
        <EmptyState icon="🏪" title="No data for this platform" description="Approve invoices from this marketplace to see analytics" />
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-6">
          {Object.entries(filteredPlatforms).map(([mp, d_]) => {
            const d = d_ as { revenue: number; orders: number; commission: number; commission_pct: number; returns: number; top_product: string }
            const dotColor = (MARKETPLACE_COLORS as Record<string, string>)[mp] ?? '#6B7280'
            return (
              <div key={mp} className="bg-white border border-gray-200 rounded-lg shadow-sm p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: dotColor }} />
                    <span className="font-semibold text-slate-800 capitalize">{mp}</span>
                  </div>
                  <span className="text-xs px-2 py-0.5 bg-slate-100 text-slate-600 rounded border border-slate-200 font-medium">
                    {d.orders} orders
                  </span>
                </div>
                <p className="font-mono font-bold text-2xl text-slate-800 mb-3">{formatINR(d.revenue)}</p>
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Commission</span>
                    <span className="font-mono text-amber-600">{formatINR(d.commission)} ({d.commission_pct}%)</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Returns</span>
                    <span className="font-mono text-red-500">{d.returns}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Top Product</span>
                    <span className="text-slate-600 truncate max-w-[120px]">{d.top_product ?? '—'}</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Revenue Chart */}
      {Object.keys(filteredPlatforms).length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm mb-6">
          <div className="px-5 py-3 border-b border-gray-100">
            <span className="text-sm font-semibold text-slate-700">Revenue Comparison</span>
          </div>
          <div className="p-5">
            <MarketplaceBarChart data={
              Object.fromEntries(Object.entries(filteredPlatforms).map(([k, v_]) => {
                const v = v_ as { revenue: number; orders: number }
                return [k, { revenue: v.revenue, orders: v.orders }]
              }))
            } />
          </div>
        </div>
      )}

      {/* Settlements */}
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100">
          <span className="text-sm font-semibold text-slate-700">Settlement Tracking</span>
        </div>
        {settlementsLoading ? (
          <div className="p-6"><TableSkeleton rows={4} cols={6} /></div>
        ) : settlements.length === 0 ? (
          <EmptyState icon="💰" title="No settlements yet" description="Settlement data will appear here once available" />
        ) : (
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                {['Platform', 'Period', 'Expected', 'Received', 'Difference', 'Status'].map((h) => (
                  <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {settlements.map((s: any) => (
                <tr key={s.id} className="border-b border-gray-100 hover:bg-blue-50/20">
                  <td className="px-5 py-3 text-sm text-slate-700 capitalize">{s.marketplace}</td>
                  <td className="px-5 py-3 text-xs text-slate-500">{s.period_start} – {s.period_end}</td>
                  <td className="px-5 py-3 text-sm font-mono text-slate-700">{formatINR(s.expected_amount)}</td>
                  <td className="px-5 py-3 text-sm font-mono text-slate-700">{formatINR(s.payment_received)}</td>
                  <td className={`px-5 py-3 text-sm font-mono font-semibold ${(s.difference ?? 0) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {formatINR(Math.abs(s.difference ?? 0))}
                  </td>
                  <td className="px-5 py-3">
                    <span className={cn('text-xs px-2 py-0.5 rounded border font-medium',
                      s.status === 'received' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                      s.status === 'disputed' ? 'bg-red-50 text-red-700 border-red-200' :
                      'bg-amber-50 text-amber-700 border-amber-200'
                    )}>
                      {s.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </PageWrapper>
  )
}
