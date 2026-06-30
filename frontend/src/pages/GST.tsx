import { useState } from 'react'
import { format, subMonths } from 'date-fns'
import { Download, Receipt, TrendingDown, DollarSign } from 'lucide-react'
import { useGSTSummary } from '../hooks/queries'
import { gstApi } from '../api'
import { PageWrapper } from '../components/layout/PageWrapper'
import { Card, CardHeader, CardBody } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Select } from '../components/ui/Input'
import { MetricCard } from '../components/dashboard/MetricCard'
import { TableSkeleton, EmptyState } from '../components/ui/Skeleton'
import { formatINR } from '../lib/utils'
import toast from 'react-hot-toast'
import type { ReportFormat } from '../types'

const TABS = ['Overview', 'Monthly Ledger', 'B2B', 'B2C', 'HSN Summary', 'Download Reports']

export default function GST() {
  const [activeTab, setActiveTab] = useState('Overview')
  const [year, setYear] = useState(new Date().getFullYear())
  const { data: summary, isLoading } = useGSTSummary(year)

  const handleDownload = async (type: string, fmt: ReportFormat) => {
    const toastId = toast.loading('Generating report…')
    try {
      const currentMonth = format(new Date(), 'yyyy-MM')
      const { data } = await gstApi.generateReport({ type, period: currentMonth, format: fmt })
      toast.dismiss(toastId)
      toast.success('Report generated!')
      if (data.data?.download_url) {
        window.open(data.data.download_url, '_blank')
      } else {
        toast.error('Download URL not available')
      }
    } catch {
      toast.dismiss(toastId)
      toast.error('Failed to generate report')
    }
  }

  return (
    <PageWrapper>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display font-bold text-2xl" style={{ color: 'var(--text-primary)' }}>GST</h1>
        <Select
          options={[2023, 2024, 2025, 2026].map((y) => ({ value: String(y), label: `FY ${y}-${String(y + 1).slice(2)}` }))}
          value={String(year)}
          onChange={(e) => setYear(Number(e.target.value))}
          className="w-36"
        />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-bg-card border border-border-default rounded-xl p-1 w-fit overflow-x-auto">
        {TABS.map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${activeTab === tab ? 'bg-primary text-white' : 'text-gray-400 hover:text-gray-200'}`}>
            {tab}
          </button>
        ))}
      </div>

      {/* Overview */}
      {activeTab === 'Overview' && (
        <div className="space-y-6">
          {isLoading ? (
            <div className="grid grid-cols-3 gap-4">
              {[0,1,2].map(i => <div key={i} className="h-32 shimmer-bg rounded-2xl" />)}
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-4">
              <MetricCard label="Output Tax Collected" value={summary?.output_tax ?? 0} icon={<Receipt size={18} />} iconColor="bg-red-500/20 text-red-400" index={0} />
              <MetricCard label="Input Tax Credit" value={summary?.input_tax_credit ?? 0} icon={<TrendingDown size={18} />} iconColor="bg-emerald-500/20 text-emerald-400" index={1} />
              <MetricCard label="Net GST Payable" value={summary?.net_payable ?? 0} icon={<DollarSign size={18} />} iconColor="bg-amber-500/20 text-amber-400" index={2} />
            </div>
          )}

          <Card>
            <CardHeader><span className="font-semibold text-sm text-gray-200">Quarterly Summary</span></CardHeader>
            <CardBody className="p-0">
              {isLoading ? (
                <div className="p-6"><TableSkeleton rows={4} cols={4} /></div>
              ) : (summary?.by_quarter ?? []).length === 0 ? (
                <EmptyState icon="📊" title="No GST data yet" description="GST records are created automatically when you approve invoices" />
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="text-xs text-gray-500 border-b border-border-default/50">
                      {['Quarter', 'Output Tax', 'Input Credit', 'Net Payable'].map((h) => (
                        <th key={h} className="px-5 py-3 text-left font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(summary?.by_quarter ?? []).map((q: { quarter: string; output: number; input: number; payable: number }) => (
                      <tr key={q.quarter} className="border-b border-border-default/30">
                        <td className="px-5 py-3 text-sm font-semibold text-gray-200">{q.quarter}</td>
                        <td className="px-5 py-3 text-sm font-mono text-gray-300">{formatINR(q.output)}</td>
                        <td className="px-5 py-3 text-sm font-mono text-emerald-400">{formatINR(q.input)}</td>
                        <td className="px-5 py-3 text-sm font-mono text-amber-400 font-semibold">{formatINR(q.payable)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardBody>
          </Card>
        </div>
      )}

      {/* Monthly Ledger */}
      {activeTab === 'Monthly Ledger' && (
        <Card>
          <CardBody className="p-0">
            {isLoading ? (
              <div className="p-6"><TableSkeleton rows={6} cols={6} /></div>
            ) : (summary?.by_month ?? []).length === 0 ? (
              <EmptyState icon="📅" title="No monthly data" description="Monthly GST ledger will populate as you approve invoices" />
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="text-xs text-gray-500 border-b border-border-default/50">
                    {['Month', 'Taxable Value', 'CGST', 'SGST', 'IGST', 'Total Tax'].map((h) => (
                      <th key={h} className="px-5 py-3 text-left font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(summary?.by_month ?? []).map((m: { month: string; taxable_value: number; cgst: number; sgst: number; igst: number; total: number }) => (
                    <tr key={m.month} className="border-b border-border-default/30 hover:bg-white/3">
                      <td className="px-5 py-3 text-sm font-medium text-gray-200">{m.month}</td>
                      <td className="px-5 py-3 text-sm font-mono text-gray-300">{formatINR(m.taxable_value)}</td>
                      <td className="px-5 py-3 text-sm font-mono text-gray-300">{formatINR(m.cgst)}</td>
                      <td className="px-5 py-3 text-sm font-mono text-gray-300">{formatINR(m.sgst)}</td>
                      <td className="px-5 py-3 text-sm font-mono text-gray-300">{formatINR(m.igst)}</td>
                      <td className="px-5 py-3 text-sm font-mono text-amber-400 font-semibold">{formatINR(m.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardBody>
        </Card>
      )}

      {/* B2B */}
      {activeTab === 'B2B' && (
        <EmptyState icon="🏢" title="B2B Transactions" description="B2B GST report (where customer has a GSTIN) will appear here after approving B2B invoices" />
      )}

      {/* B2C */}
      {activeTab === 'B2C' && (
        <EmptyState icon="👤" title="B2C Transactions" description="B2C GST report (retail sales without GSTIN) will appear here after approving invoices" />
      )}

      {/* HSN Summary */}
      {activeTab === 'HSN Summary' && (
        <EmptyState icon="🏷️" title="HSN Summary" description="HSN-wise consolidated report will appear here. Coming soon." />
      )}

      {/* Download Reports */}
      {activeTab === 'Download Reports' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { type: 'gstr1', title: 'GSTR-1', desc: 'Outward supplies return' },
            { type: 'gstr3b', title: 'GSTR-3B', desc: 'Summary return' },
            { type: 'hsn', title: 'HSN Summary', desc: 'HSN-wise consolidated report' },
          ].map((r) => (
            <Card key={r.type} className="p-5">
              <h3 className="font-semibold text-gray-200 mb-1">{r.title}</h3>
              <p className="text-xs text-gray-400 mb-4">{r.desc}</p>
              <div className="flex gap-2 flex-wrap">
                {(['pdf', 'excel', 'csv'] as ReportFormat[]).map((fmt) => (
                  <Button key={fmt} variant="secondary" size="sm"
                    onClick={() => handleDownload(r.type, fmt)}>
                    <Download size={12} /> {fmt.toUpperCase()}
                  </Button>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}
    </PageWrapper>
  )
}
