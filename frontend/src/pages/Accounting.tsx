import { useState } from 'react'
import { format, subMonths } from 'date-fns'
import { useQuery } from '@tanstack/react-query'
import { useProfitLoss } from '../hooks/queries'
import { accountingApi } from '../api'
import { PageWrapper } from '../components/layout/PageWrapper'
import { TableSkeleton, EmptyState } from '../components/ui/Skeleton'
import { formatINR, formatDate } from '../lib/utils'
import { cn } from '../lib/utils'

const TABS = ['Journal Entries', 'Profit & Loss', 'Balance Sheet']

export default function Accounting() {
  const [activeTab, setActiveTab] = useState('Profit & Loss')
  const [from, setFrom] = useState(format(subMonths(new Date(), 3), 'yyyy-MM-dd'))
  const [to, setTo] = useState(format(new Date(), 'yyyy-MM-dd'))

  const { data: pl, isLoading: plLoading } = useProfitLoss(from, to)

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

  const TAB_STYLE = (t: string) => cn(
    'px-4 py-2 text-sm font-medium border-b-2 transition-colors duration-150',
    activeTab === t ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-700'
  )

  return (
    <PageWrapper>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-slate-800">Accounting</h1>
        <div className="flex items-center gap-2">
          <input type="date" value={from} onChange={e => setFrom(e.target.value)}
            className="px-3 py-2 text-sm bg-white border border-gray-300 rounded-md text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" />
          <span className="text-slate-400 text-sm">to</span>
          <input type="date" value={to} onChange={e => setTo(e.target.value)}
            className="px-3 py-2 text-sm bg-white border border-gray-300 rounded-md text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-6">
        {TABS.map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} className={TAB_STYLE(tab)}>{tab}</button>
        ))}
      </div>

      {/* Journal Entries */}
      {activeTab === 'Journal Entries' && (
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
          {journalsLoading ? (
            <div className="p-6"><TableSkeleton rows={5} cols={5} /></div>
          ) : journals.length === 0 ? (
            <EmptyState icon="📒" title="No journal entries" description="Journal entries are created automatically when you approve invoices" />
          ) : (
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  {['Date', 'Entry #', 'Description', 'Debit Account', 'Credit Account', 'Amount'].map((h) => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {journals.map((e: any) => (
                  <tr key={e.id} className="border-b border-gray-100 hover:bg-blue-50/20">
                    <td className="px-5 py-3 text-sm text-slate-600">{formatDate(e.entry_date)}</td>
                    <td className="px-5 py-3 text-sm font-mono text-slate-700">{e.entry_number}</td>
                    <td className="px-5 py-3 text-sm text-slate-700 max-w-xs truncate">{e.description}</td>
                    <td className="px-5 py-3 text-sm text-blue-600">{e.debit_account}</td>
                    <td className="px-5 py-3 text-sm text-emerald-600">{e.credit_account}</td>
                    <td className="px-5 py-3 text-sm font-mono text-slate-800">{formatINR(e.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Profit & Loss */}
      {activeTab === 'Profit & Loss' && (
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden max-w-2xl">
          <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-700">Profit & Loss Statement</span>
            <span className="text-xs text-slate-400">{formatDate(from)} – {formatDate(to)}</span>
          </div>
          {plLoading ? (
            <div className="p-5"><TableSkeleton rows={6} cols={2} /></div>
          ) : (
            <div className="p-5 space-y-1">
              {[
                { label: 'Revenue',              value: pl?.revenue ?? 0,                    bold: false, color: 'text-slate-800' },
                { label: 'Cost of Goods Sold',   value: -(pl?.cogs ?? 0),                   bold: false, color: 'text-red-600',  border: false },
                { label: 'Gross Profit',         value: pl?.gross_profit ?? 0,               bold: true,  color: 'text-slate-800', border: true },
                { label: 'Shipping Charges',     value: -(pl?.expenses?.shipping ?? 0),     bold: false, color: 'text-red-600' },
                { label: 'Marketplace Commission',value: -(pl?.expenses?.commission ?? 0),  bold: false, color: 'text-red-600' },
                { label: 'Other Expenses',       value: -(pl?.expenses?.packaging ?? 0),    bold: false, color: 'text-red-600' },
                { label: 'GST Payable',          value: -(pl?.gst_payable ?? 0),            bold: false, color: 'text-amber-600', border: true },
                { label: 'Net Profit',           value: pl?.net_profit ?? 0,                bold: true,  color: 'text-emerald-600', border: true },
              ].map(({ label, value, bold, color, border }) => (
                <div key={label} className={`flex justify-between py-2 ${border ? 'border-t border-gray-200 mt-1' : ''}`}>
                  <span className={`text-sm ${bold ? 'font-semibold text-slate-800' : 'text-slate-600'}`}>{label}</span>
                  <span className={`text-sm font-mono ${color} ${bold ? 'font-semibold' : ''}`}>{formatINR(Math.abs(value))}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Balance Sheet */}
      {activeTab === 'Balance Sheet' && (
        <div className="grid grid-cols-2 gap-6 max-w-4xl">
          {[
            { title: 'Assets', items: balanceSheet?.assets?.current ?? [] },
            { title: 'Liabilities & Equity', items: balanceSheet?.liabilities?.current ?? [] },
          ].map(({ title, items }) => (
            <div key={title} className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100">
                <span className="text-sm font-semibold text-slate-700">{title}</span>
              </div>
              {items.length === 0 ? (
                <div className="p-5 text-sm text-slate-400 text-center">No data available</div>
              ) : (
                <table className="w-full">
                  <tbody>
                    {items.map((item: any) => (
                      <tr key={item.name} className="border-b border-gray-100">
                        <td className="px-5 py-3 text-sm text-slate-700">{item.name}</td>
                        <td className="px-5 py-3 text-sm font-mono text-slate-800 text-right">{formatINR(item.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          ))}
        </div>
      )}
    </PageWrapper>
  )
}
