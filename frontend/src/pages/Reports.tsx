import { useState } from 'react'
import { format, subMonths } from 'date-fns'
import { Download, BarChart3, FileText, TrendingUp, Package, ShoppingBag, Users, DollarSign, Sliders } from 'lucide-react'
import { PageWrapper } from '../components/layout/PageWrapper'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Select } from '../components/ui/Input'
import { reportsApi } from '../api'
import toast from 'react-hot-toast'
import type { ReportType, ReportFormat } from '../types'

const REPORT_TYPES: Array<{ type: ReportType; icon: React.ReactNode; title: string; desc: string }> = [
  { type: 'sales',       icon: <TrendingUp size={20} />,  title: 'Sales Report',       desc: 'Revenue, orders, and sales trends' },
  { type: 'gst',         icon: <FileText size={20} />,    title: 'GST Report',          desc: 'CGST, SGST, IGST breakdown' },
  { type: 'profit',      icon: <DollarSign size={20} />,  title: 'Profit Report',       desc: 'P&L with expense breakdown' },
  { type: 'inventory',   icon: <Package size={20} />,     title: 'Inventory Report',    desc: 'Stock levels and valuation' },
  { type: 'marketplace', icon: <ShoppingBag size={20} />, title: 'Marketplace Report',  desc: 'Performance by platform' },
  { type: 'customer',    icon: <Users size={20} />,       title: 'Customer Report',     desc: 'Purchase history and revenue' },
  { type: 'expense',     icon: <BarChart3 size={20} />,   title: 'Expense Report',      desc: 'All costs and fees' },
]

export default function Reports() {
  const [generating, setGenerating] = useState<string | null>(null) // "type-format" key to avoid collisions
  const [format_, setFormat] = useState<ReportFormat>('pdf')
  const [from, setFrom] = useState(format(subMonths(new Date(), 1), 'yyyy-MM-dd'))
  const [to, setTo] = useState(format(new Date(), 'yyyy-MM-dd'))

  const handleGenerate = async (type: ReportType, fmt: ReportFormat = format_) => {
    const key = `${type}-${fmt}`
    setGenerating(key)
    try {
      const { data } = await reportsApi.generate({ type, from_date: from, to_date: to, format: fmt })
      const reportId = data.data?.report_id
      if (!reportId) { toast.error('Report generation failed — no ID returned'); return }
      toast.success('Report generated! Downloading…')
      setTimeout(() => window.open(`/api/reports/${reportId}/download`, '_blank'), 800)
    } catch {
      toast.error('Failed to generate report')
    } finally {
      setGenerating(null)
    }
  }

  return (
    <PageWrapper>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display font-bold text-2xl" style={{ color: 'var(--text-primary)' }}>Reports</h1>
        <div className="flex items-center gap-3">
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
            className="bg-bg-card border border-border-default rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-primary" />
          <span className="text-gray-400 text-sm">to</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
            className="bg-bg-card border border-border-default rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-primary" />
          <Select
            options={[{ value: 'pdf', label: 'PDF' }, { value: 'excel', label: 'Excel' }, { value: 'csv', label: 'CSV' }]}
            value={format_}
            onChange={(e) => setFormat(e.target.value as ReportFormat)}
            className="w-28"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {REPORT_TYPES.map((r) => {
          const key = `${r.type}-${format_}`
          return (
            <Card key={r.type} className="p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary-light flex items-center justify-center">
                  {r.icon}
                </div>
                <div>
                  <h3 className="font-semibold text-gray-200 text-sm">{r.title}</h3>
                  <p className="text-xs text-gray-400">{r.desc}</p>
                </div>
              </div>
              <Button variant="secondary" size="sm" fullWidth onClick={() => handleGenerate(r.type)} loading={generating === key}>
                <Download size={13} /> Generate {format_.toUpperCase()}
              </Button>
            </Card>
          )
        })}
      </div>
    </PageWrapper>
  )
}
