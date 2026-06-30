import { useState } from 'react'
import { format, subMonths } from 'date-fns'
import { useQuery } from '@tanstack/react-query'
import { useProfitLoss } from '../hooks/queries'
import { accountingApi } from '../api'
import { PageWrapper } from '../components/layout/PageWrapper'
import { Card, CardHeader, CardBody } from '../components/ui/Card'
import { TableSkeleton, EmptyState } from '../components/ui/Skeleton'
import { formatINR, formatDate } from '../lib/utils'

const TABS = ['Journal Entries', 'Profit & Loss', 'Balance Sheet']

export default function Accounting() {
  const [activeTab, setActiveTab] = useState('Profit & Loss')
  const [from, setFrom] = useState(format(subMonths(new Date(), 3), 'yyyy-MM-dd'))
  const [to, setTo] = useState(format(new Date(), 'yyyy-MM-dd'))

  const { data: pl, isLoading: plLoading } = useProfitLoss(from, to)

  // journals is PaginatedResponse<JournalEntry> = { data: [], meta: {} }
  const { data: journalsPaginated, isLoading: journalsLoading } = useQuery({
    queryKey: ['accounting', 'journals', from, to],
    queryFn: () => accountingApi.journalEntries({ from_date: from, to_date: to }).then((r) => r.data.data),
    enabled: activeTab === 'Journal Entries',
  })
  const journals = journalsPaginated?.data ?? []

  const { data: balanceSheet } = useQuery({
    queryKey: ['accounting', 'balance-sheet', to],
    queryFn: () => accountingApi.balanceSheet(to).then((r) => r.data.data),
    enabled: activeTab === 'Balance Sheet',
  })

  return (
    <PageWrapper>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display font-bold text-2xl" style={{ color: 'var(--text-primary)' }}>Accounting</h1>
        {/* Date range picker */}
        <div className="flex items-center gap-2">
          <input type="date" value={from} onChange={e => setFrom(e.target.value)}
            className="bg-bg-card border border-border-default rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-primary" />
          <span className="text-gray-400 text-sm">to</span>
          <input type="date" value={to} onChange={e => setTo(e.target.value)}
            className="bg-bg-card border border-border-default rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-primary" />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-bg-card border border-border-default rounded-xl p-1 w-fit">
        {TABS.map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg text-xs font-medium transition-colors ${activeTab === tab ? 'bg-primary text-white' : 'text-gray-400 hover:text-gray-200'}`}>
            {tab}
          </button>
        ))}
      </div>

      {/* Journal Entries */}
      {activeTab === 'Journal Entries' && (
        <Card>
          <CardBody className="p-0">
            {journalsLoading ? (
              <div className="p-6"><TableSkeleton rows={5} cols={5} /></div>
            ) : journals.length === 0 ? (
              <EmptyState icon="📒" title="No journal entries" description="Journal entries are created automatically when you approve invoices" />
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="text-xs text-gray-500 border-b border-border-default/50">
                    {['Date', 'Entry #', 'Description', 'Debit Account', 'Credit Account', 'Amount'].map((h) => (
                      <th key={h} className="px-5 py-3 text-left font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {journals.map((e: any) => (
                    <tr key={e.id} className="border-b border-border-default/30 hover:bg-white/3">
                      <td className="px-5 py-3 text-sm text-gray-400">{formatDate(e.entry_date)}</td>
                      <td className="px-5 py-3 text-sm font-mono text-gray-300">{e.entry_number}</td>
                      <td className="px-5 py-3 text-sm text-gray-300 max-w-xs truncate">{e.description}</td>
                      <td className="px-5 py-3 text-sm text-blue-400">{e.debit_account}</td>
                      <td className="px-5 py-3 text-sm text-emerald-400">{e.credit_account}</td>
                      <td className="px-5 py-3 text-sm font-mono text-gray-200">{formatINR(e.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardBody>
        </Card>
      )}

      {/* Profit & Loss */}
      {activeTab === 'Profit & Loss' && (
        <Card className="max-w-2xl">
          <CardHeader>
            <span className="font-semibold text-sm text-gray-200">Profit & Loss Statement</span>
            <span className="text-xs text-gray-400">{formatDate(from)} – {formatDate(to)}</span>
          </CardHeader>
          {plLoading ? (
            <CardBody><TableSkeleton rows={6} cols={2} /></CardBody>
          ) : (
            <CardBody className="space-y-1">
              {[
                { label: 'Revenue', value: pl?.revenue ?? 0, bold: false, color: 'text-gray-200' },
                { label: 'Cost of Goods Sold', value: -(pl?.cogs ?? 0), bold: false, color: 'text-red-400' },
                { label: 'Gross Profit', value: pl?.gross_profit ?? 0, bold: true, color: 'text-white', border: true },
                { label: 'Shipping Charges', value: -(pl?.expenses?.shipping ?? 0), bold: false, color: 'text-red-400' },
                { label: 'Marketplace Commission', value: -(pl?.expenses?.commission ?? 0), bold: false, color: 'text-red-400' },
                { label: 'Other Expenses', value: -(pl?.expenses?.packaging ?? 0), bold: false, color: 'text-red-400' },
                { label: 'Operating Profit', value: pl?.operating_profit ?? 0, bold: true, color: 'text-white', border: true },
                { label: 'GST Payable', value: -(pl?.gst_payable ?? 0), bold: false, color: 'text-amber-400' },
                { label: 'Net Profit', value: pl?.net_profit ?? 0, bold: true, color: 'text-emerald-400', border: true },
              ].map(({ label, value, bold, color, border }) => (
                <div key={label} className={`flex justify-between py-2 ${border ? 'border-t border-border-default/50 mt-1' : ''}`}>
                  <span className={`text-sm ${bold ? 'font-semibold text-white' : 'text-gray-400'}`}>{label}</span>
                  <span className={`text-sm font-mono ${color} ${bold ? 'font-semibold' : ''}`}>{formatINR(Math.abs(value))}</span>
                </div>
              ))}
            </CardBody>
          )}
        </Card>
      )}

      {/* Balance Sheet */}
      {activeTab === 'Balance Sheet' && (
        <div className="grid grid-cols-2 gap-6 max-w-4xl">
          {/* Assets */}
          <Card>
            <CardHeader><span className="font-semibold text-sm text-gray-200">Assets</span></CardHeader>
            <CardBody className="p-0">
              {(balanceSheet?.assets?.current ?? []).length === 0 ? (
                <div className="p-5 text-sm text-gray-500 text-center">No asset data available</div>
              ) : (
                <table className="w-full">
                  <tbody>
                    {(balanceSheet?.assets?.current ?? []).map((item: any) => (
                      <tr key={item.name} className="border-b border-border-default/30">
                        <td className="px-5 py-3 text-sm text-gray-300">{item.name}</td>
                        <td className="px-5 py-3 text-sm font-mono text-gray-200 text-right">{formatINR(item.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardBody>
          </Card>
          {/* Liabilities */}
          <Card>
            <CardHeader><span className="font-semibold text-sm text-gray-200">Liabilities & Equity</span></CardHeader>
            <CardBody className="p-0">
              {(balanceSheet?.liabilities?.current ?? []).length === 0 ? (
                <div className="p-5 text-sm text-gray-500 text-center">No liability data available</div>
              ) : (
                <table className="w-full">
                  <tbody>
                    {(balanceSheet?.liabilities?.current ?? []).map((item: any) => (
                      <tr key={item.name} className="border-b border-border-default/30">
                        <td className="px-5 py-3 text-sm text-gray-300">{item.name}</td>
                        <td className="px-5 py-3 text-sm font-mono text-gray-200 text-right">{formatINR(item.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardBody>
          </Card>
        </div>
      )}
    </PageWrapper>
  )
}
