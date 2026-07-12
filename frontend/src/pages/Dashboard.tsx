import { format } from 'date-fns'
import { BarChart3, TrendingUp, Receipt, DollarSign, Package, Upload, ArrowUpRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useDashboardSummary, useRevenueChart, useLowStockProducts, useSalesByMarketplace } from '../hooks/queries'
import { useAuthStore } from '../store/authStore'
import { PageWrapper } from '../components/layout/PageWrapper'
import { MetricCard } from '../components/dashboard/MetricCard'
import { Card, CardHeader, CardBody } from '../components/ui/Card'
import { MarketplaceBadge, StatusBadge } from '../components/ui/Badge'
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

  const recentInvoices = summary?.recentInvoices ?? summary?.recent_invoices ?? []

  return (
    <PageWrapper>
      {/* Page Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-semibold text-slate-800">
            {greeting}, {user?.name?.split(' ')[0] ?? 'there'}
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">
            {format(new Date(), 'EEEE, dd MMMM yyyy')}
          </p>
        </div>
        <Button onClick={() => navigate('/invoices/upload')} size="sm">
          <Upload size={14} className="mr-1.5" />
          Upload Invoice
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)
        ) : (
          <>
            <MetricCard
              label="Today's Sales"
              value={Number(summary?.todaySales ?? summary?.today_sales ?? 0)}
              icon={<TrendingUp size={16} />}
              iconColor="text-emerald-600"
              
              trend={8}
              trendLabel="vs yesterday"
              sparkData={[4200, 5100, 4800, 6200, 7400, 8100, 12450]}
              index={0}
            />
            <MetricCard
              label="Monthly Revenue"
              value={Number(summary?.monthlyRevenue ?? summary?.monthly_revenue ?? 0)}
              icon={<BarChart3 size={16} />}
              iconColor="text-blue-600"
              
              trend={12}
              trendLabel="vs last month"
              sparkData={[185000, 210000, 195000, 240000, 285000, 324600]}
              index={1}
            />
            <MetricCard
              label="GST Payable"
              value={Number(summary?.gstPayable ?? summary?.gst_payable ?? 0)}
              icon={<Receipt size={16} />}
              iconColor="text-amber-600"
              
              index={2}
            />
            <MetricCard
              label="Net Profit"
              value={Number(summary?.netProfit ?? summary?.net_profit ?? 0)}
              icon={<DollarSign size={16} />}
              iconColor="text-emerald-600"
              
              trend={5}
              trendLabel="vs last month"
              sparkData={[42000, 51000, 44000, 58000, 72000, 84903]}
              index={3}
            />
          </>
        )}
      </div>

      {/* Row 2: Inventory / Low Stock / Recent Uploads */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-6">

        {/* Inventory Status */}
        <Card>
          <CardHeader>
            <span className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <Package size={14} className="text-slate-400" />
              Inventory Status
            </span>
          </CardHeader>
          <CardBody className="grid grid-cols-3 gap-3 text-center">
            <div className="py-2">
              <p className="font-mono font-bold text-xl text-slate-800">
                {summary?.totalProducts ?? summary?.total_products ?? 0}
              </p>
              <p className="text-xs text-slate-500 mt-1 uppercase tracking-wide">Total SKUs</p>
            </div>
            <div className="py-2 border-x border-gray-100">
              <p className="font-mono font-bold text-xl text-amber-600">
                {summary?.lowStockCount ?? summary?.low_stock_count ?? 0}
              </p>
              <p className="text-xs text-slate-500 mt-1 uppercase tracking-wide">Low Stock</p>
            </div>
            <div className="py-2">
              <p className="font-mono font-bold text-xl text-red-600">
                {summary?.outOfStockCount ?? summary?.out_of_stock_count ?? 0}
              </p>
              <p className="text-xs text-slate-500 mt-1 uppercase tracking-wide">Out of Stock</p>
            </div>
          </CardBody>
        </Card>

        {/* Low Stock Alerts */}
        <Card>
          <CardHeader>
            <span className="text-sm font-semibold text-slate-700">Low Stock Alerts</span>
          </CardHeader>
          <CardBody className="p-0">
            {!lowStock?.length ? (
              <div className="px-5 py-6 text-center text-sm text-slate-500">
                All stock levels healthy
              </div>
            ) : (
              lowStock.slice(0, 4).map((p) => (
                <div
                  key={p.id}
                  className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 last:border-0"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-700 truncate">{p.name}</p>
                    <p className="text-xs text-slate-400 font-mono mt-0.5">{p.sku}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-mono font-semibold text-amber-600">{p.current_stock}</p>
                    <p className="text-xs text-slate-400">/ {p.min_stock_level} min</p>
                  </div>
                </div>
              ))
            )}
          </CardBody>
        </Card>

        {/* Recent Uploads */}
        <Card>
          <CardHeader>
            <span className="text-sm font-semibold text-slate-700">Recent Uploads</span>
            <button
              onClick={() => navigate('/invoices')}
              className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-0.5 transition-colors duration-150"
            >
              View all <ArrowUpRight size={11} />
            </button>
          </CardHeader>
          <CardBody className="p-0">
            {!recentInvoices.length ? (
              <EmptyState
                icon="📄"
                title="No invoices yet"
                description="Upload your first invoice to get started"
              />
            ) : (
              recentInvoices.map((inv: any) => (
                <div
                  key={inv.id}
                  className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 last:border-0 cursor-pointer hover:bg-blue-50/30 transition-colors duration-150"
                  onClick={() => navigate(`/invoices/${inv.id}`)}
                >
                  <MarketplaceBadge marketplace={inv.marketplace} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-mono text-slate-700 truncate">
                      {inv.invoice_number ?? 'Processing...'}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">{formatDate(inv.created_at)}</p>
                  </div>
                  <StatusBadge status={inv.processing_status} />
                </div>
              ))
            )}
          </CardBody>
        </Card>
      </div>

      {/* Revenue Trend — full width */}
      <Card className="mb-6">
        <CardHeader>
          <span className="text-sm font-semibold text-slate-700">Revenue &amp; Profit Trend</span>
          <div className="flex gap-4 text-xs text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-blue-600 inline-block" />
              Revenue
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
              Profit
            </span>
          </div>
        </CardHeader>
        <CardBody>
          {chart ? (
            <RevenueAreaChart data={chart.datasets} labels={chart.labels} />
          ) : (
            <div className="h-52 bg-gray-50 rounded-lg animate-pulse" />
          )}
        </CardBody>
      </Card>

      {/* Bottom Row: Marketplace + Recent Activity */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">

        {/* Marketplace Bar Chart */}
        <Card className="xl:col-span-2">
          <CardHeader>
            <span className="text-sm font-semibold text-slate-700">Sales by Marketplace</span>
          </CardHeader>
          <CardBody>
            {marketplaceData ? (
              <>
                <MarketplaceBarChart
                  data={Object.fromEntries(
                    Object.entries(marketplaceData).map(([k, v_]) => {
                      const v = v_ as { revenue: number; orders: number }
                      return [k, { revenue: v.revenue, orders: v.orders }]
                    })
                  )}
                />
                <div className="mt-4 space-y-2">
                  {Object.entries(marketplaceData).map(([mp, v_]) => {
                    const v = v_ as { revenue: number }
                    const color =
                      mp === 'amazon'
                        ? '#FF9900'
                        : mp === 'flipkart'
                        ? '#2874F0'
                        : mp === 'meesho'
                        ? '#F43397'
                        : '#6B7280'
                    return (
                      <div key={mp} className="flex items-center justify-between text-xs">
                        <span className="flex items-center gap-2 text-slate-500 capitalize">
                          <span
                            className="w-2 h-2 rounded-full inline-block"
                            style={{ background: color }}
                          />
                          {mp}
                        </span>
                        <span className="font-mono text-slate-700 font-medium">
                          {formatINR(v.revenue)}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </>
            ) : (
              <div className="h-44 bg-gray-50 rounded-lg animate-pulse" />
            )}
          </CardBody>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <span className="text-sm font-semibold text-slate-700">Recent Activity</span>
          </CardHeader>
          <CardBody className="p-0">
            {!recentInvoices.length ? (
              <div className="px-5 py-6 text-center text-sm text-slate-500">
                No recent activity
              </div>
            ) : (
              recentInvoices.slice(0, 6).map((inv: any) => (
                <div
                  key={inv.id}
                  className="flex items-start gap-3 px-4 py-3 border-b border-gray-100 last:border-0 cursor-pointer hover:bg-blue-50/30 transition-colors duration-150"
                  onClick={() => navigate(`/invoices/${inv.id}`)}
                >
                  <span
                    className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${
                      inv.processing_status === 'approved'
                        ? 'bg-emerald-500'
                        : inv.processing_status === 'pending'
                        ? 'bg-amber-400'
                        : inv.processing_status === 'error'
                        ? 'bg-red-500'
                        : 'bg-blue-500'
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-700 truncate">
                      Invoice {inv.invoice_number ?? 'processing...'}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {formatDate(inv.created_at)}
                    </p>
                  </div>
                  <span className="text-xs font-mono text-slate-500 capitalize whitespace-nowrap">
                    {inv.marketplace}
                  </span>
                </div>
              ))
            )}
          </CardBody>
        </Card>
      </div>
    </PageWrapper>
  )
}
