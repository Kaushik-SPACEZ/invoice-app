import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { CreditCard, TrendingUp, TrendingDown, Clock, CheckCircle, AlertTriangle, Plus, X, Check } from 'lucide-react'
import { PageWrapper } from '../components/layout/PageWrapper'
import { TableSkeleton, EmptyState } from '../components/ui/Skeleton'
import { Modal } from '../components/ui/Modal'
import { formatINR, formatDate, cn } from '../lib/utils'
import client from '../api/client'
import toast from 'react-hot-toast'

type TabType = 'receivables' | 'payables' | 'summary'

const AGING_BUCKETS = [
  { key: 'current', label: 'Current (Not Due)', color: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
  { key: 'due_30', label: '1–30 Days', color: 'text-blue-700 bg-blue-50 border-blue-200' },
  { key: 'due_60', label: '31–60 Days', color: 'text-amber-700 bg-amber-50 border-amber-200' },
  { key: 'due_90', label: '61–90 Days', color: 'text-orange-700 bg-orange-50 border-orange-200' },
  { key: 'overdue', label: '90+ Days', color: 'text-red-700 bg-red-50 border-red-200' },
]

export default function Outstanding() {
  const qc = useQueryClient()
  const [activeTab, setActiveTab] = useState<TabType>('summary')
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [selectedEntry, setSelectedEntry] = useState<any>(null)
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10))
  const [paymentNotes, setPaymentNotes] = useState('')
  const [savingPayment, setSavingPayment] = useState(false)

  const { data: summaryData, isLoading: summaryLoading } = useQuery({
    queryKey: ['outstanding', 'summary'],
    queryFn: () => client.get('/outstanding/summary').then(r => r.data.data),
  })

  const { data: receivablesData, isLoading: recLoading } = useQuery({
    queryKey: ['outstanding', 'receivables'],
    queryFn: () => client.get('/outstanding/receivables').then(r => r.data.data),
    enabled: activeTab === 'receivables',
  })

  const { data: payablesData, isLoading: payLoading } = useQuery({
    queryKey: ['outstanding', 'payables'],
    queryFn: () => client.get('/outstanding/payables').then(r => r.data.data),
    enabled: activeTab === 'payables',
  })

  const receivables = receivablesData?.data ?? []
  const payables = payablesData?.data ?? []
  const summary = summaryData ?? {}

  const openPayment = (entry: any) => {
    setSelectedEntry(entry)
    setPaymentAmount(String(entry.balance_amount ?? entry.amount))
    setPaymentDate(new Date().toISOString().slice(0, 10))
    setPaymentNotes('')
    setShowPaymentModal(true)
  }

  const handleRecordPayment = async () => {
    if (!paymentAmount || parseFloat(paymentAmount) <= 0) { toast.error('Enter valid amount'); return }
    setSavingPayment(true)
    try {
      await client.post(`/outstanding/${selectedEntry.id}/payment`, {
        amount: parseFloat(paymentAmount),
        payment_date: paymentDate,
        notes: paymentNotes,
        type: selectedEntry.type,
      })
      toast.success('Payment recorded!')
      qc.invalidateQueries({ queryKey: ['outstanding'] })
      setShowPaymentModal(false)
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Failed to record payment')
    } finally {
      setSavingPayment(false)
    }
  }

  const agingBucketForEntry = (entry: any) => {
    const dueDate = entry.due_date ? new Date(entry.due_date) : null
    if (!dueDate) return 'current'
    const today = new Date()
    const diff = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))
    if (diff <= 0) return 'current'
    if (diff <= 30) return 'due_30'
    if (diff <= 60) return 'due_60'
    if (diff <= 90) return 'due_90'
    return 'overdue'
  }

  const TAB_STYLE = (t: string) => cn(
    'px-4 py-2.5 text-sm font-medium border-b-2 transition-colors duration-150',
    activeTab === t ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-700'
  )

  return (
    <PageWrapper>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">Outstanding &amp; Credit</h1>
          <p className="text-sm text-slate-400 mt-0.5">Track credit sales (receivables) and credit purchases (payables)</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Receivable', value: summary.total_receivable ?? 0, accent: '#16A34A', icon: <TrendingUp size={18} className="text-emerald-600" />, desc: 'Credit sales — customers owe you' },
          { label: 'Total Payable', value: summary.total_payable ?? 0, accent: '#DC2626', icon: <TrendingDown size={18} className="text-red-600" />, desc: 'Credit purchases — you owe vendors' },
          { label: 'Overdue (90+ days)', value: summary.overdue_amount ?? 0, accent: '#D97706', icon: <AlertTriangle size={18} className="text-amber-600" />, desc: 'Needs immediate attention' },
          { label: 'Net Receivable', value: (summary.total_receivable ?? 0) - (summary.total_payable ?? 0), accent: '#2563EB', icon: <CreditCard size={18} className="text-blue-600" />, desc: 'Receivable minus Payable' },
        ].map(s => (
          <div key={s.label} className="bg-white border border-gray-200 rounded-lg shadow-sm p-5" style={{ borderLeft: `3px solid ${s.accent}` }}>
            <div className="flex items-center gap-2 mb-2">
              {s.icon}
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{s.label}</p>
            </div>
            <p className={cn('text-2xl font-bold font-mono', s.value < 0 ? 'text-red-600' : 'text-slate-800')}>
              {formatINR(Math.abs(s.value))}
            </p>
            <p className="text-xs text-slate-400 mt-1">{s.desc}</p>
          </div>
        ))}
      </div>

      {/* Aging Analysis */}
      {summary.aging && (
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-5 mb-6">
          <p className="text-sm font-semibold text-slate-700 mb-4">Aging Analysis — Receivables</p>
          <div className="grid grid-cols-5 gap-3">
            {AGING_BUCKETS.map(bucket => (
              <div key={bucket.key} className={cn('rounded border px-3 py-2 text-center', bucket.color)}>
                <p className="text-xs font-medium mb-1">{bucket.label}</p>
                <p className="text-base font-bold font-mono">{formatINR(summary.aging?.[bucket.key] ?? 0)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
        <div className="flex border-b border-gray-200 px-4">
          <button className={TAB_STYLE('summary')} onClick={() => setActiveTab('summary')}>Summary</button>
          <button className={TAB_STYLE('receivables')} onClick={() => setActiveTab('receivables')}>
            Receivables
            {summary.receivable_count > 0 && <span className="ml-2 text-xs bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded">{summary.receivable_count}</span>}
          </button>
          <button className={TAB_STYLE('payables')} onClick={() => setActiveTab('payables')}>
            Payables
            {summary.payable_count > 0 && <span className="ml-2 text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded">{summary.payable_count}</span>}
          </button>
        </div>

        {/* SUMMARY TAB */}
        {activeTab === 'summary' && (
          <div className="p-6">
            {summaryLoading ? (
              <TableSkeleton rows={4} cols={3} />
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-slate-600">
                  This page tracks all credit transactions. When you sell on credit (customer pays later) the amount appears as a <strong>Receivable</strong>. When you buy from a vendor on credit (you pay later) it appears as a <strong>Payable</strong>.
                </p>
                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div className="border border-emerald-200 rounded-lg p-4 bg-emerald-50/50">
                    <p className="text-sm font-semibold text-emerald-800 mb-2">📥 Receivables (Credit Sales)</p>
                    <p className="text-xs text-emerald-700">Created when you approve an invoice marked as credit sale. Track who owes you money and record payments when received.</p>
                    <button onClick={() => setActiveTab('receivables')} className="mt-3 text-xs text-emerald-700 font-medium hover:underline">View Receivables →</button>
                  </div>
                  <div className="border border-red-200 rounded-lg p-4 bg-red-50/50">
                    <p className="text-sm font-semibold text-red-800 mb-2">📤 Payables (Credit Purchases)</p>
                    <p className="text-xs text-red-700">Created when you approve a vendor purchase on credit. Track what you owe vendors and record payments when made.</p>
                    <button onClick={() => setActiveTab('payables')} className="mt-3 text-xs text-red-700 font-medium hover:underline">View Payables →</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* RECEIVABLES TAB */}
        {activeTab === 'receivables' && (
          recLoading ? (
            <div className="p-6"><TableSkeleton rows={5} cols={6} /></div>
          ) : receivables.length === 0 ? (
            <EmptyState icon="📥" title="No outstanding receivables" description="Receivables are created when you approve credit sales invoices" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    {['Customer', 'Invoice #', 'Invoice Date', 'Due Date', 'Amount', 'Paid', 'Balance', 'Status', ''].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {receivables.map((r: any) => {
                    const bucket = agingBucketForEntry(r)
                    const bucketConfig = AGING_BUCKETS.find(b => b.key === bucket)
                    return (
                      <tr key={r.id} className="border-b border-gray-100 hover:bg-blue-50/20">
                        <td className="px-4 py-3 text-sm text-slate-800 font-medium">{r.customer_name ?? r.customer?.name ?? '—'}</td>
                        <td className="px-4 py-3 text-sm font-mono text-slate-700">{r.invoice_number ?? '—'}</td>
                        <td className="px-4 py-3 text-sm text-slate-600">{r.invoice_date ? formatDate(r.invoice_date) : '—'}</td>
                        <td className="px-4 py-3 text-sm text-slate-600">{r.due_date ? formatDate(r.due_date) : '—'}</td>
                        <td className="px-4 py-3 text-sm font-mono text-slate-800 text-right">{formatINR(r.total_amount)}</td>
                        <td className="px-4 py-3 text-sm font-mono text-emerald-700 text-right">{formatINR(r.paid_amount ?? 0)}</td>
                        <td className="px-4 py-3 text-sm font-mono font-semibold text-right">
                          <span className={r.balance_amount > 0 ? 'text-red-600' : 'text-emerald-600'}>{formatINR(r.balance_amount ?? 0)}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={cn('text-xs px-2 py-0.5 rounded border font-medium', bucketConfig?.color)}>
                            {r.balance_amount <= 0 ? '✓ Paid' : bucketConfig?.label}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {r.balance_amount > 0 && (
                            <button onClick={() => openPayment({...r, type:'receivable'})}
                              className="text-xs px-2.5 py-1 bg-emerald-600 text-white rounded hover:bg-emerald-700 transition-colors">
                              Record Payment
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )
        )}

        {/* PAYABLES TAB */}
        {activeTab === 'payables' && (
          payLoading ? (
            <div className="p-6"><TableSkeleton rows={5} cols={6} /></div>
          ) : payables.length === 0 ? (
            <EmptyState icon="📤" title="No outstanding payables" description="Payables are created when you approve credit purchase invoices" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    {['Vendor', 'Invoice #', 'Invoice Date', 'Due Date', 'Amount', 'Paid', 'Balance', 'Status', ''].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {payables.map((p: any) => {
                    const bucket = agingBucketForEntry(p)
                    const bucketConfig = AGING_BUCKETS.find(b => b.key === bucket)
                    return (
                      <tr key={p.id} className="border-b border-gray-100 hover:bg-blue-50/20">
                        <td className="px-4 py-3 text-sm text-slate-800 font-medium">{p.vendor_name ?? '—'}</td>
                        <td className="px-4 py-3 text-sm font-mono text-slate-700">{p.invoice_number ?? '—'}</td>
                        <td className="px-4 py-3 text-sm text-slate-600">{p.invoice_date ? formatDate(p.invoice_date) : '—'}</td>
                        <td className="px-4 py-3 text-sm text-slate-600">{p.due_date ? formatDate(p.due_date) : '—'}</td>
                        <td className="px-4 py-3 text-sm font-mono text-slate-800 text-right">{formatINR(p.total_amount)}</td>
                        <td className="px-4 py-3 text-sm font-mono text-emerald-700 text-right">{formatINR(p.paid_amount ?? 0)}</td>
                        <td className="px-4 py-3 text-sm font-mono font-semibold text-right">
                          <span className={p.balance_amount > 0 ? 'text-red-600' : 'text-emerald-600'}>{formatINR(p.balance_amount ?? 0)}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={cn('text-xs px-2 py-0.5 rounded border font-medium', bucketConfig?.color)}>
                            {p.balance_amount <= 0 ? '✓ Paid' : bucketConfig?.label}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {p.balance_amount > 0 && (
                            <button onClick={() => openPayment({...p, type:'payable'})}
                              className="text-xs px-2.5 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors">
                              Record Payment
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>

      {/* Record Payment Modal */}
      <Modal open={showPaymentModal} onClose={() => setShowPaymentModal(false)}
        title={selectedEntry?.type === 'receivable' ? 'Record Payment Received' : 'Record Payment Made'}>
        <div className="space-y-4">
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-600">{selectedEntry?.type === 'receivable' ? 'Customer' : 'Vendor'}:</span>
              <span className="font-medium text-slate-800">{selectedEntry?.customer_name ?? selectedEntry?.vendor_name ?? '—'}</span>
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-slate-600">Invoice:</span>
              <span className="font-mono text-slate-700">{selectedEntry?.invoice_number ?? '—'}</span>
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-slate-600">Outstanding Balance:</span>
              <span className="font-mono font-semibold text-red-600">{formatINR(selectedEntry?.balance_amount ?? 0)}</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Payment Amount (₹) *</label>
            <input type="number" min="0.01" step="0.01" value={paymentAmount}
              onChange={e => setPaymentAmount(e.target.value)}
              className="w-full px-3 py-2 text-sm font-mono bg-white border border-gray-300 rounded-md text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" />
            <p className="text-xs text-slate-400 mt-1">Enter partial or full amount</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Payment Date</label>
            <input type="date" value={paymentDate} onChange={e => setPaymentDate(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-md text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Notes (optional)</label>
            <input type="text" placeholder="Payment mode, reference no., etc." value={paymentNotes}
              onChange={e => setPaymentNotes(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-md text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" />
          </div>
        </div>

        <div className="flex gap-3 mt-6 pt-4 border-t border-gray-100">
          <button onClick={() => setShowPaymentModal(false)} className="px-4 py-2 text-sm font-medium bg-white border border-gray-300 text-slate-700 rounded-md hover:bg-gray-50">Cancel</button>
          <button onClick={handleRecordPayment} disabled={savingPayment}
            className="px-6 py-2 text-sm font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors">
            {savingPayment ? 'Saving…' : 'Record Payment'}
          </button>
        </div>
      </Modal>
    </PageWrapper>
  )
}
