import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSalesSummary, useSalesByMarketplace } from '../hooks/queries'
import { salesApi } from '../api'
import { PageWrapper } from '../components/layout/PageWrapper'
import { Card, CardHeader, CardBody } from '../components/ui/Card'
import { MetricCard } from '../components/dashboard/MetricCard'
import { MarketplaceBadge, StatusBadge } from '../components/ui/Badge'
import { TableSkeleton, EmptyState } from '../components/ui/Skeleton'
import { TrendingUp, ShoppingCart, DollarSign, RefreshCw, ShoppingBag } from 'lucide-react'
import { formatINR, formatDate, MARKETPLACE_COLORS } from '../lib/utils'

const PERIODS = ['today', 'week', 'month', 'year'] as const
type Period = typeof PERIODS[number]

const PERIOD_LABELS: Record<Period, string> = {
  today: 'Today',
  week: 'This Week',
  month: 'This Month',
  year: 'This Year',
}

export default function Sales() {
  const [period, setPeriod] = useState<Period>('month')
  const { data: summary, isLoading } = useSalesSummary(period)
  const { data: byMarketplace } = useSalesByMarketplace()
  const { data: salesList, isLoading: listLoading, isError } = useQuery({
    queryKey: ['sales', 'list', period],
    queryFn: () => salesApi.list({ period }).then((r) => r.data.data),
  })

  const orders = salesList?.data ?? []

  return (
    <PageWrapper>
      {/* Page Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 style={{ fontSize: 20, fontWeight: 600, color: '#0F172A', margin: 0 }}>
          Sales
        </h1>

        {/* Period Tabs — underline style */}
        <div style={{ display: 'flex', gap: 0, borderBottom: '2px solid #E2E8F0' }}>
          {PERIODS.map((p) => {
            const active = period === p
            return (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                style={{
                  padding: '8px 16px',
                  fontSize: 14,
                  fontWeight: active ? 600 : 400,
                  color: active ? '#2563EB' : '#475569',
                  background: 'none',
                  border: 'none',
                  borderBottom: active ? '2px solid #2563EB' : '2px solid transparent',
                  marginBottom: -2,
                  cursor: 'pointer',
                  transition: 'color 150ms',
                  whiteSpace: 'nowrap',
                }}
              >
                {PERIOD_LABELS[p]}
              </button>
            )
          })}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <MetricCard
          label="Revenue"
          value={Number(summary?.revenue ?? 0)}
          icon={<TrendingUp size={18} />}
          iconColor="bg-blue-50 text-blue-600"
          index={0}
        />
        <MetricCard
          label="Orders"
          value={Number(summary?.orders ?? 0)}
          format="number"
          icon={<ShoppingCart size={18} />}
          iconColor="bg-emerald-50 text-emerald-600"
          index={1}
        />
        <MetricCard
          label="Avg Order Value"
          value={Number(summary?.avgOrderValue ?? summary?.avg_order_value ?? 0)}
          icon={<DollarSign size={18} />}
          iconColor="bg-amber-50 text-amber-600"
          index={2}
        />
        <MetricCard
          label="Returns"
          value={summary?.returns ?? 0}
          format="number"
          icon={<RefreshCw size={18} />}
          iconColor="bg-red-50 text-red-600"
          index={3}
        />
      </div>

      {/* Marketplace Breakdown */}
      {byMarketplace && Object.keys(byMarketplace).length > 0 && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          {Object.entries(byMarketplace).map(([mp, d_]) => {
            const d = d_ as { revenue: number; orders: number; commission: number }
            const dotColor = (MARKETPLACE_COLORS as Record<string, string>)[mp] ?? '#6B7280'
            return (
              <div
                key={mp}
                style={{
                  background: '#FFFFFF',
                  border: '1px solid #E2E8F0',
                  borderRadius: 8,
                  padding: 20,
                  boxShadow: '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <span
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      background: dotColor,
                      flexShrink: 0,
                      display: 'inline-block',
                    }}
                  />
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: '#475569',
                      textTransform: 'capitalize',
                    }}
                  >
                    {mp}
                  </span>
                </div>
                <p
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 22,
                    fontWeight: 700,
                    color: '#0F172A',
                    margin: 0,
                  }}
                >
                  {formatINR(d.revenue)}
                </p>
                <p style={{ fontSize: 12, color: '#94A3B8', marginTop: 4 }}>
                  {d.orders} orders
                </p>
              </div>
            )
          })}
        </div>
      )}

      {/* Sales Orders Table */}
      <div
        style={{
          background: '#FFFFFF',
          border: '1px solid #E2E8F0',
          borderRadius: 8,
          boxShadow: '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)',
          overflow: 'hidden',
        }}
      >
        {/* Card Header */}
        <div
          style={{
            padding: '12px 20px',
            borderBottom: '1px solid #F1F5F9',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <span style={{ fontSize: 14, fontWeight: 600, color: '#374151' }}>
            Sales Orders
          </span>
        </div>

        {listLoading ? (
          <div style={{ padding: 20 }}>
            <TableSkeleton rows={6} cols={7} />
          </div>
        ) : isError ? (
          <div style={{ padding: '48px 20px', textAlign: 'center' }}>
            <EmptyState
              icon="⚠️"
              title="Failed to load sales"
              description="Check your connection and try again"
            />
          </div>
        ) : orders.length === 0 ? (
          <div style={{ padding: '64px 20px', textAlign: 'center' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
              <ShoppingBag size={40} style={{ color: '#CBD5E1' }} />
              <p style={{ fontSize: 15, fontWeight: 600, color: '#475569', margin: 0 }}>
                No sales yet
              </p>
              <p style={{ fontSize: 13, color: '#94A3B8', margin: 0 }}>
                Approve invoices to see sales data here
              </p>
            </div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr
                  style={{
                    background: '#F8FAFC',
                    borderBottom: '1px solid #E2E8F0',
                  }}
                >
                  {['Date', 'Order #', 'Marketplace', 'Revenue', 'Tax', 'Net Revenue', 'Status'].map((h, i) => (
                    <th
                      key={h}
                      style={{
                        padding: '12px 16px',
                        fontSize: 12,
                        fontWeight: 600,
                        color: '#64748B',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        textAlign: i >= 3 && i <= 5 ? 'right' : 'left',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {orders.map((order: any) => (
                  <tr
                    key={order.id}
                    style={{ borderBottom: '1px solid #F1F5F9', transition: 'background 150ms' }}
                    onMouseEnter={(e) => {
                      ;(e.currentTarget as HTMLTableRowElement).style.background =
                        'rgba(37,99,235,0.03)'
                    }}
                    onMouseLeave={(e) => {
                      ;(e.currentTarget as HTMLTableRowElement).style.background = ''
                    }}
                  >
                    <td style={{ padding: '12px 16px', fontSize: 14, color: '#475569', whiteSpace: 'nowrap' }}>
                      {order.order_date ? formatDate(order.order_date) : '—'}
                    </td>
                    <td
                      style={{
                        padding: '12px 16px',
                        fontSize: 13,
                        fontFamily: "'JetBrains Mono', monospace",
                        color: '#0F172A',
                        fontWeight: 500,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {order.order_number}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <MarketplaceBadge marketplace={order.marketplace} />
                    </td>
                    <td
                      style={{
                        padding: '12px 16px',
                        fontSize: 13,
                        fontFamily: "'JetBrains Mono', monospace",
                        color: '#0F172A',
                        fontWeight: 500,
                        textAlign: 'right',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {formatINR(order.total_amount)}
                    </td>
                    <td
                      style={{
                        padding: '12px 16px',
                        fontSize: 13,
                        fontFamily: "'JetBrains Mono', monospace",
                        color: '#64748B',
                        textAlign: 'right',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {formatINR(order.tax_amount)}
                    </td>
                    <td
                      style={{
                        padding: '12px 16px',
                        fontSize: 13,
                        fontFamily: "'JetBrains Mono', monospace",
                        color: '#16A34A',
                        fontWeight: 600,
                        textAlign: 'right',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {formatINR(order.net_revenue)}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <StatusBadge status={order.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </PageWrapper>
  )
}
