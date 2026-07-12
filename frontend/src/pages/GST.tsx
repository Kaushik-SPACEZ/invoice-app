import { useState } from 'react'
import { format } from 'date-fns'
import { Download, Receipt, TrendingDown, DollarSign } from 'lucide-react'
import { useGSTSummary } from '../hooks/queries'
import { reportsApi } from '../api'
import type { ReportFormat, ReportType } from '../types'
import { PageWrapper } from '../components/layout/PageWrapper'
import { Button } from '../components/ui/Button'
import { MetricCard } from '../components/dashboard/MetricCard'
import { TableSkeleton, EmptyState } from '../components/ui/Skeleton'
import { formatINR } from '../lib/utils'
import toast from 'react-hot-toast'

const TABS = ['Overview', 'Monthly Ledger', 'B2B', 'B2C', 'HSN Summary', 'Download Reports']

const YEAR_OPTIONS = [2023, 2024, 2025, 2026].map((y) => ({
  value: y,
  label: `FY ${y}-${String(y + 1).slice(2)}`,
}))

export default function GST() {
  const [activeTab, setActiveTab] = useState('Overview')
  const [year, setYear] = useState(new Date().getFullYear())
  const { data: summary, isLoading } = useGSTSummary(year)

  const handleDownload = async (type: string, fmt: ReportFormat) => {
    const toastId = toast.loading('Generating report…')
    try {
      const from = format(new Date(new Date().getFullYear(), 3, 1), 'yyyy-MM-dd')
      const to = format(new Date(), 'yyyy-MM-dd')
      const genRes = await reportsApi.generate({ type: type as ReportType, from_date: from, to_date: to, format: fmt })
      const reportId = genRes.data.data?.report_id
      if (!reportId) { toast.dismiss(toastId); toast.error('Failed to generate'); return }
      toast.dismiss(toastId)
      toast.success('Downloading…')
      const dlRes = await reportsApi.download(reportId)
      const blob = new Blob([dlRes.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${type}_report.xlsx`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch {
      toast.dismiss(toastId)
      toast.error('Failed to generate report')
    }
  }

  return (
    <PageWrapper>
      {/* Page Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-slate-800">GST Filing</h1>
        <select
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          className="w-36 h-9 px-3 text-sm text-slate-800 bg-white border border-gray-300 rounded-md
                     focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20
                     transition-colors duration-150"
        >
          {YEAR_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      {/* Underline Tab Bar */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex gap-0 overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={[
                'px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors duration-150',
                activeTab === tab
                  ? 'text-blue-600 border-blue-600'
                  : 'text-slate-500 border-transparent hover:text-slate-700 hover:border-slate-300',
              ].join(' ')}
            >
              {tab}
            </button>
          ))}
        </nav>
      </div>

      {/* Overview Tab */}
      {activeTab === 'Overview' && (
        <div className="space-y-6">
          {/* KPI Cards */}
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-28 bg-gray-100 animate-pulse rounded-lg" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <MetricCard
                label="Output Tax Collected"
                value={Number(summary?.outputTax ?? summary?.output_tax ?? 0)}
                icon={<Receipt size={16} />}
                iconColor="text-red-500"
                index={0}
              />
              <MetricCard
                label="Input Tax Credit"
                value={Number(summary?.inputTaxCredit ?? summary?.input_tax_credit ?? 0)}
                icon={<TrendingDown size={16} />}
                iconColor="text-emerald-600"
                index={1}
              />
              <MetricCard
                label="Net GST Payable"
                value={Number(summary?.netPayable ?? summary?.net_payable ?? 0)}
                icon={<DollarSign size={16} />}
                iconColor="text-amber-600"
                index={2}
              />
            </div>
          )}

          {/* Quarterly Summary Table */}
          <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden"
               style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)' }}>
            <div className="px-5 py-3 border-b border-gray-100">
              <span className="text-sm font-semibold text-slate-700">Quarterly Summary</span>
            </div>
            {isLoading ? (
              <div className="p-6"><TableSkeleton rows={4} cols={4} /></div>
            ) : (summary?.byQuarter ?? summary?.by_quarter ?? []).length === 0 ? (
              <EmptyState
                icon="📊"
                title="No GST data yet"
                description="GST records are created automatically when you approve invoices"
              />
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    {['Quarter', 'Output Tax', 'Input Credit', 'Net Payable'].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(summary?.byQuarter ?? summary?.by_quarter ?? []).map(
                    (q: { quarter: string; output: number; input: number; payable: number }) => (
                      <tr key={q.quarter} className="border-b border-gray-100 hover:bg-blue-50/30 transition-colors duration-100">
                        <td className="px-4 py-3 text-sm font-semibold text-slate-700">{q.quarter}</td>
                        <td className="px-4 py-3 text-sm text-slate-700 font-mono">{formatINR(q.output)}</td>
                        <td className="px-4 py-3 text-sm font-mono text-emerald-700">{formatINR(q.input)}</td>
                        <td className="px-4 py-3 text-sm font-mono font-semibold text-amber-700">{formatINR(q.payable)}</td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Monthly Ledger Tab */}
      {activeTab === 'Monthly Ledger' && (
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden"
             style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)' }}>
          <div className="px-5 py-3 border-b border-gray-100">
            <span className="text-sm font-semibold text-slate-700">Monthly GST Ledger</span>
          </div>
          {isLoading ? (
            <div className="p-6"><TableSkeleton rows={6} cols={6} /></div>
          ) : (summary?.byMonth ?? summary?.by_month ?? []).length === 0 ? (
            <EmptyState
              icon="📅"
              title="No monthly data"
              description="Monthly GST ledger will populate as you approve invoices"
            />
          ) : (
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  {['Month', 'Taxable Value', 'CGST', 'SGST', 'IGST', 'Total Tax'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(summary?.byMonth ?? summary?.by_month ?? []).map(
                  (m: { month: string; taxable_value: number; cgst: number; sgst: number; igst: number; total: number }) => (
                    <tr key={m.month} className="border-b border-gray-100 hover:bg-blue-50/30 transition-colors duration-100">
                      <td className="px-4 py-3 text-sm font-medium text-slate-700">{m.month}</td>
                      <td className="px-4 py-3 text-sm font-mono text-slate-700">{formatINR(m.taxable_value)}</td>
                      <td className="px-4 py-3 text-sm font-mono text-slate-700">{formatINR(m.cgst)}</td>
                      <td className="px-4 py-3 text-sm font-mono text-slate-700">{formatINR(m.sgst)}</td>
                      <td className="px-4 py-3 text-sm font-mono text-slate-700">{formatINR(m.igst)}</td>
                      <td className="px-4 py-3 text-sm font-mono font-semibold text-amber-700">{formatINR(m.total)}</td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* B2B Tab */}
      {activeTab === 'B2B' && (
        <EmptyState
          icon="🏢"
          title="B2B Transactions"
          description="B2B GST report (where customer has a GSTIN) will appear here after approving B2B invoices"
        />
      )}

      {/* B2C Tab */}
      {activeTab === 'B2C' && (
        <EmptyState
          icon="👤"
          title="B2C Transactions"
          description="B2C GST report (retail sales without GSTIN) will appear here after approving invoices"
        />
      )}

      {/* HSN Summary Tab */}
      {activeTab === 'HSN Summary' && (
        <EmptyState
          icon="🏷️"
          title="HSN Summary"
          description="HSN-wise consolidated report will appear here. Coming soon."
        />
      )}

      {/* Download Reports Tab */}
      {activeTab === 'Download Reports' && (
        <div className="space-y-4">
          <p className="text-sm text-slate-500">
            Download GST reports for the selected financial year in Excel format.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              {
                type: 'gstr1',
                title: 'GSTR-1',
                desc: 'Outward supplies — all sales with customer & HSN details',
              },
              {
                type: 'gstr3b',
                title: 'GSTR-3B',
                desc: 'Summary return — total taxable value & tax payable',
              },
              {
                type: 'hsn',
                title: 'HSN Summary',
                desc: 'HSN-wise consolidated sales report',
              },
            ].map((r) => (
              <div
                key={r.type}
                className="bg-white border border-gray-200 rounded-lg p-5"
                style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)' }}
              >
                <h3 className="text-sm font-semibold text-slate-800 mb-1">{r.title}</h3>
                <p className="text-xs text-slate-500 mb-4 leading-relaxed">{r.desc}</p>
                <Button
                  variant="secondary"
                  size="sm"
                  fullWidth
                  onClick={() => handleDownload(r.type, 'csv' as ReportFormat)}
                >
                  <Download size={13} className="mr-1.5" />
                  Download Excel
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </PageWrapper>
  )
}
