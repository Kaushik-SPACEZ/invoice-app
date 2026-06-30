import { format } from 'date-fns'
import { BarChart3, TrendingUp, Receipt, DollarSign, Package, Upload, RefreshCw } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useDashboardSummary, useRevenueChart, useLowStockProducts, useSalesByMarketplace } from '../hooks/queries'
import { useAuthStore } from '../store/authStore'
import { PageWrapper, listVariants, pageItemVariants } from '../components/layout/PageWrapper'
import { MetricCard } from '../components/dashboard/MetricCard'
import { Card, CardHeader, CardBody } from '../components/ui/Card'
import { Badge, MarketplaceBadge, StatusBadge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { CardSkeleton, EmptyState } from '../components/ui/Skeleton'
import { RevenueAreaChart, MarketplaceBarChart } from '../components/charts/Charts'
import { formatINR, formatDate } from '../lib/utils'

export default function Dashboard() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const { data: summary, isLoading } = useDashboardSummary()
  const { data: chart } = useRevenueChart('monthly')
  const { data: lowStock } = useLowStockProducts()
  const { data: marketplaceData } = useSalesByMarketplace()

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  return (
    <PageWrapper>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display font-bold text-2xl text-white">
            {greeting}, {user?.name?.split(' ')[0]} 👋
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">{format(new Date(), 'EEEE, dd MMMM yyyy')}</p>
        </div>
        <Button onClick={() => navigate('/invoices/upload')} size="lg">
          <Upload size={16} />
          Upload Invoice
        </Button>
      </div>

      {/* KPI Cards */}
      <motion.div variants={listVariants} animate="animate" className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)
        ) : (
          <>
            <motion.div variants={pageItemVariants}>
              <MetricCard label="Today's Sales" value={summary?.today_sales ?? 0} icon={<TrendingUp size={18} />} iconColor="bg-emerald-500/20 text-emerald-400" trend={8} trendLabel="vs yesterday" sparkData={[4200,5100,4800,6200,7400,8100,12450]} index={0} />
            </motion.div>
            <motion.div variants={pageItemVariants}>
              <MetricCard label="Monthly Revenue" value={summary?.monthly_revenue ?? 0} icon={<BarChart3 size={18} />} iconColor="bg-primary/20 text-primary-light" trend={12} trendLabel="vs last month" sparkData={[185000,210000,195000,240000,285000,324600]} index={1} />
            </motion.div>
            <motion.div variants={pageItemVariants}>
              <MetricCard label="GST Payable" value={summary?.gst_payable ?? 0} icon={<Receipt size={18} />} iconColor="bg-amber-500/20 text-amber-400" index={2} />
            </motion.div>
            <motion.div variants={pageItemVariants}>
              <MetricCard label="Net Profit" value={summary?.net_profit ?? 0} icon={<DollarSign size={18} />} iconColor="bg-emerald-500/20 text-emerald-400" trend={5} trendLabel="vs last month" sparkData={[42000,51000,44000,58000,72000,84903]} index={3} />
            </motion.div>
          </>
        )}
      </motion.div>

      {/* Row 2 */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-6">
        {/* Inventory Summary */}
        <Card>
          <CardHeader><span className="font-semibold text-sm text-gray-200 flex items-center gap-2"><Package size={15} /> Inventory Status</span></CardHeader>
          <CardBody className="grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="font-mono font-semibold text-xl text-white">{summary?.total_products ?? 0}</p>
              <p className="text-xs text-gray-400 mt-0.5">Total SKUs</p>
            </div>
            <div>
              <p className="font-mono font-semibold text-xl text-amber-400">{summary?.low_stock_count ?? 0}</p>
              <p className="text-xs text-gray-400 mt-0.5">Low Stock</p>
            </div>
            <div>
              <p className="font-mono font-semibold text-xl text-red-400">{summary?.out_of_stock_count ?? 0}</p>
              <p className="text-xs text-gray-400 mt-0.5">Out of Stock</p>
            </div>
          </CardBody>
        </Card>

        {/* Low Stock List */}
        <Card>
          <CardHeader><span className="font-semibold text-sm text-gray-200">Low Stock Alerts</span></CardHeader>
          <CardBody className="p-0">
            {!lowStock?.length ? (
              <div className="p-6 text-center text-sm text-gray-500">All stock levels healthy ✓</div>
            ) : (
              lowStock.slice(0, 4).map((p) => (
                <div key={p.id} className="flex items-center gap-3 px-5 py-3 border-b border-border-default/30 last:border-0">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-200 truncate">{p.name}</p>
                    <p className="text-xs text-gray-500 font-mono">{p.sku}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-mono text-amber-400">{p.current_stock}</p>
                    <p className="text-xs text-gray-500">/ {p.min_stock_level} min</p>
                  </div>
                </div>
              ))
            )}
          </CardBody>
        </Card>

        {/* Recent Uploads */}
        <Card>
          <CardHeader>
            <span className="font-semibold text-sm text-gray-200">Recent Uploads</span>
            <button onClick={() => navigate('/invoices')} className="text-xs text-primary-light hover:underline">View all</button>
          </CardHeader>
          <CardBody className="p-0">
            {!summary?.recent_invoices?.length ? (
              <EmptyState icon="📄" title="No invoices yet" description="Upload your first invoice to get started" />
            ) : (
              summary.recent_invoices.map((inv) => (
                <div key={inv.id} className="flex items-center gap-3 px-5 py-3 border-b border-border-default/30 last:border-0 cursor-pointer hover:bg-white/3 transition-colors"
                  onClick={() => navigate(`/invoices/${inv.id}`)}>
                  <MarketplaceBadge marketplace={inv.marketplace} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-mono text-gray-300 truncate">{inv.invoice_number ?? 'Processing…'}</p>
                    <p className="text-xs text-gray-500">{formatDate(inv.created_at)}</p>
                  </div>
                  <StatusBadge status={inv.processing_status} />
                </div>
              ))
            )}
          </CardBody>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Card className="xl:col-span-2">
          <CardHeader>
            <span className="font-semibold text-sm text-gray-200">Revenue & Profit Trend</span>
            <div className="flex gap-3 text-xs text-gray-400">
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-primary inline-block" />Revenue</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />Profit</span>
            </div>
          </CardHeader>
          <CardBody>
            {chart ? (
              <RevenueAreaChart data={chart.datasets} labels={chart.labels} />
            ) : (
              <div className="h-52 shimmer-bg rounded-xl" />
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader><span className="font-semibold text-sm text-gray-200">By Marketplace</span></CardHeader>
          <CardBody>
            {marketplaceData ? (
              <>
                <MarketplaceBarChart data={
                  Object.fromEntries(
                    Object.entries(marketplaceData).map(([k, v_]) => {
                      const v = v_ as { revenue: number; orders: number }
                      return [k, { revenue: v.revenue, orders: v.orders }]
                    })
                  )
                } />
                <div className="mt-3 space-y-1.5">
                  {Object.entries(marketplaceData).map(([mp, v_]) => {
                    const v = v_ as { revenue: number }
                    const color = mp === 'amazon' ? '#FF9900' : mp === 'flipkart' ? '#2874F0' : '#F43397'
                    return (
                      <div key={mp} className="flex items-center justify-between text-xs">
                        <span className="flex items-center gap-2 text-gray-400 capitalize">
                          <span className="w-2 h-2 rounded-full inline-block" style={{ background: color }} />{mp}
                        </span>
                        <span className="font-mono text-gray-200">{formatINR(v.revenue)}</span>
                      </div>
                    )
                  })}
                </div>
              </>
            ) : (
              <div className="h-44 shimmer-bg rounded-xl" />
            )}
          </CardBody>
        </Card>
      </div>
    </PageWrapper>
  )
}
