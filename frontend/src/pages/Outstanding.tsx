import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { CreditCard, TrendingUp, TrendingDown, AlertTriangle, Plus, X, Check, History, ChevronDown, ChevronUp } from 'lucide-react'
import { PageWrapper } from '../components/layout/PageWrapper'
import { TableSkeleton, EmptyState } from '../components/ui/Skeleton'
import { Modal } from '../components/ui/Modal'
import { formatINR, formatDate, cn } from '../lib/utils'
import client from '../api/client'
import toast from 'react-hot-toast'

type TabType = 'receivables' | 'payables' | 'summary'

const AGING_BUCKETS = [
  { key: 'current', label: 'Current (Not Due)', color: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
  { key: 'due_30',  label: '1–30 Days',         color: 'text-blue-700 bg-blue-50 border-blue-200' },
  { key: 'due_60',  label: '31–60 Days',         color: 'text-amber-700 bg-amber-50 border-amber-200' },
  { key: 'due_90',  label: '61–90 Days',         color: 'text-orange-700 bg-orange-50 border-orange-200' },
  { key: 'overdue', label: '90+ Days',           color: 'text-red-700 bg-red-50 border-red-200' },
]

const PAYMENT_METHODS = [
  { value: 'cash',         label: 'Cash' },
  { value: 'bank_transfer',label: 'Bank Transfer / NEFT / RTGS' },
  { value: 'upi',          label: 'UPI' },
  { value: 'cheque',       label: 'Cheque' },
  { value: 'card',         label: 'Card' },
  { value: 'advance',      label: 'Advance' },
  { value: 'other',        label: 'Other' },
]

export default function Outstanding() {
  const qc = useQueryClient()
  const [activeTab, setActiveTab] = useState<TabType>('summary')
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [selectedEntry, setSelectedEntry] = useState<any>(null)
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10))
  const [paymentNotes, setPaymentNotes] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('bank_transfer')
  const [savingPayment, setSavingPayment] = useState(false)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [paymentHistory, setPaymentHistory] = useState<Record<number, any[]>>({})

  const { data: summaryData } = useQuery({
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
  const payables    = payablesData?.data ?? []
  const summary     = summaryData ?? {}

  const loadHistory = async (entryId: number) => {
    if (expandedId === entryId) { setExpandedId(null); return }
    setExpandedId(entryId)
    if (paymentHistory[entryId]) return
    try {
      const r = await client.get(`/outstanding/${entryId}/payments`)
      setPaymentHistory(prev => ({ ...prev, [entryId]: r.data.data?.payments ?? [] }))
    } catch {}
  }

  const openPayment = (entry: any) => {
    setSelectedEntry(entry)
    setPaymentAmount('')
    setPaymentDate(new Date().toISOString().slice(0, 10))
    setPaymentNotes('')
    setPaymentMethod('bank_transfer')
    setShowPaymentModal(true)
  }

  const handleRecordPayment = async () => {
    const amt = parseFloat(paymentAmount)
    if (!amt || amt <= 0) { toast.error('Enter valid amount'); return }
    if (amt > selectedEntry.balance_amount) {
      toast.error(`Amount (₹${amt}) exceeds balance (₹${selectedEntry.balance_amount})`)
      return
    }
    setSavingPayment(true)
    try {
      await client.post(`/outstanding/${selectedEntry.id}/payment`, {
        amount: amt, payment_date: paymentDate,
        notes: paymentNotes, payment_method: paymentMethod,
        type: selectedEntry.type,
      })
      toast.success(amt >= selectedEntry.balance_amount
        ? 'Fully settled!'
        : `₹${amt} recorded. Remaining: ₹${(selectedEntry.balance_amount - amt).toFixed(2)}`)
      qc.invalidateQueries({ queryKey: ['outstanding'] })
      // Refresh history if expanded
      if (expandedId === selectedEntry.id) {
        const r = await client.get(`/outstanding/${selectedEntry.id}/payments`)
        setPaymentHistory(prev => ({ ...prev, [selectedEntry.id]: r.data.data?.payments ?? [] }))
      }
      setShowPaymentModal(false)
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Failed to record payment')
    } finally {
      setSavingPayment(false)
    }
  }

  const agingBucket = (entry: any) => {
    const dueDate = entry.due_date ? new Date(entry.due_date) : null
    if (!dueDate) return 'current'
    const diff = Math.floor((new Date().getTime() - dueDate.getTime()) / 86400000)
    if (diff <= 0) return 'current'
    if (diff <= 30) return 'due_30'
    if (diff <= 60) return 'due_60'
    if (diff <= 90) return 'due_90'
    return 'overdue'
  }

  const TAB = (t: TabType) => cn('px-4 py-2.5 text-sm font-medium border-b-2 transition-colors',
    activeTab === t ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-700')

  const EntryTable = ({ entries, type }: { entries: any[], type: string }) => (
    entries.length === 0
      ? <EmptyState icon={type === 'receivable' ? '📥' : '📤'} title={`No ${type === 'receivable' ? 'receivables' : 'payables'}`} description="Created when you approve credit invoices" />
      : <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                {[type === 'receivable' ? 'Customer' : 'Vendor', 'Invoice #', 'Date', 'Due Date', 'Total', 'Advance', 'Balance', 'Status', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {entries.map((e: any) => {
                const bucket = AGING_BUCKETS.find(b => b.key === agingBucket(e))
                const isExpanded = expandedId === e.id
                const history = paymentHistory[e.id] ?? []
                return (
                  <>
                    <tr key={e.id} className="border-b border-gray-100 hover:bg-blue-50/20">
                      <td className="px-4 py-3 text-sm font-medium text-slate-800">
                        {type === 'receivable' ? (e.customer_name ?? '—') : (e.vendor_name ?? '—')}
                      </td>
                      <td className="px-4 py-3 text-sm font-mono text-slate-700">{e.invoice_number ?? '—'}</td>
                      <td className="px-4 py-3 text-sm text-slate-600">{e.invoice_date ? formatDate(e.invoice_date) : '—'}</td>
                      <td className="px-4 py-3 text-sm text-slate-600">{e.due_date ? formatDate(e.due_date) : '—'}</td>
                      <td className="px-4 py-3 text-sm font-mono text-slate-800 text-right">{formatINR(e.total_amount)}</td>
                      <td className="px-4 py-3 text-sm font-mono text-blue-600 text-right">
                        {e.advance_amount > 0 ? formatINR(e.advance_amount) : '—'}
                      </td>
                      <td className="px-4 py-3 text-sm font-mono font-semibold text-right">
                        <span className={e.balance_amount > 0 ? 'text-red-600' : 'text-emerald-600'}>{formatINR(e.balance_amount)}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn('text-xs px-2 py-0.5 rounded border font-medium', bucket?.color ?? 'bg-gray-50 text-gray-600 border-gray-200')}>
                          {e.balance_amount <= 0 ? '✓ Paid' : bucket?.label ?? '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          {e.balance_amount > 0 && (
                            <button onClick={() => openPayment({...e, type})}
                              className="text-xs px-2.5 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors">
                              + Payment
                            </button>
                          )}
                          <button onClick={() => loadHistory(e.id)}
                            className="p-1 text-slate-400 hover:text-slate-600 transition-colors" title="Payment history">
                            {isExpanded ? <ChevronUp size={14} /> : <History size={14} />}
                          </button>
                        </div>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr key={`${e.id}-history`}>
                        <td colSpan={9} className="bg-slate-50 px-6 py-3 border-b border-gray-200">
                          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Payment History</p>
                          {history.length === 0
                            ? <p className="text-xs text-slate-400 italic">No payments recorded yet</p>
                            : <div className="space-y-1">
                                {history.map((p: any, i: number) => (
                                  <div key={i} className="flex items-center gap-4 text-xs text-slate-600">
                                    <span className="font-mono font-semibold text-emerald-600">+{formatINR(p.amount)}</span>
                                    <span>{formatDate(p.payment_date)}</span>
                                    <span className="capitalize text-slate-500">{p.payment_method ?? 'payment'}</span>
                                    {p.notes && <span className="text-slate-400 italic">"{p.notes}"</span>}
                                  </div>
                                ))}
                                <div className="pt-1 border-t border-gray-200 flex gap-4 text-xs font-semibold">
                                  <span className="text-slate-600">Total Paid: <span className="text-emerald-600 font-mono">{formatINR(history.reduce((s: number, p: any) => s + Number(p.amount), 0))}</span></span>
                                  <span className="text-slate-600">Balance: <span className={cn('font-mono', e.balance_amount > 0 ? 'text-red-600' : 'text-emerald-600')}>{formatINR(e.balance_amount)}</span></span>
                                </div>
                              </div>
                          }
                        </td>
                      </tr>
                    )}
                  </>
                )
              })}
            </tbody>
          </table>
        </div>
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
          { label: 'Total Receivable',    value: summary.total_receivable ?? 0,  accent: '#16A34A', icon: <TrendingUp size={18} className="text-emerald-600" />,  desc: 'Customers owe you' },
          { label: 'Total Payable',       value: summary.total_payable ?? 0,    accent: '#DC2626', icon: <TrendingDown size={18} className="text-red-600" />,    desc: 'You owe vendors' },
          { label: 'Overdue (90+ days)',  value: summary.overdue_amount ?? 0,   accent: '#D97706', icon: <AlertTriangle size={18} className="text-amber-600" />, desc: 'Needs attention' },
          { label: 'Net Receivable',      value: (summary.total_receivable ?? 0) - (summary.total_payable ?? 0), accent: '#2563EB', icon: <CreditCard size={18} className="text-blue-600" />, desc: 'Net position' },
        ].map(s => (
          <div key={s.label} className="bg-white border border-gray-200 rounded-lg shadow-sm p-5" style={{ borderLeft: `3px solid ${s.accent}` }}>
            <div className="flex items-center gap-2 mb-2">{s.icon}<p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{s.label}</p></div>
            <p className={cn('text-2xl font-bold font-mono', s.value < 0 ? 'text-red-600' : 'text-slate-800')}>{formatINR(Math.abs(s.value))}</p>
            <p className="text-xs text-slate-400 mt-1">{s.desc}</p>
          </div>
        ))}
      </div>

      {/* Aging */}
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
          <button className={TAB('summary')}     onClick={() => setActiveTab('summary')}>Summary</button>
          <button className={TAB('receivables')} onClick={() => setActiveTab('receivables')}>
            Receivables {summary.receivable_count > 0 && <span className="ml-2 text-xs bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded">{summary.receivable_count}</span>}
          </button>
          <button className={TAB('payables')} onClick={() => setActiveTab('payables')}>
            Payables {summary.payable_count > 0 && <span className="ml-2 text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded">{summary.payable_count}</span>}
          </button>
        </div>

        {activeTab === 'summary' && (
          <div className="p-6 space-y-4">
            <p className="text-sm text-slate-600">This page tracks all credit transactions. Click <strong>Receivables</strong> or <strong>Payables</strong> to see details and record payments.</p>
            <div className="grid grid-cols-2 gap-4 mt-4">
              <div className="border border-emerald-200 rounded-lg p-4 bg-emerald-50/50">
                <p className="text-sm font-semibold text-emerald-800 mb-2">📥 Receivables (Credit Sales)</p>
                <p className="text-xs text-emerald-700">Created when you approve a credit sale invoice. Advance reduces the balance immediately.</p>
                <button onClick={() => setActiveTab('receivables')} className="mt-3 text-xs text-emerald-700 font-medium hover:underline">View Receivables →</button>
              </div>
              <div className="border border-red-200 rounded-lg p-4 bg-red-50/50">
                <p className="text-sm font-semibold text-red-800 mb-2">📤 Payables (Credit Purchases)</p>
                <p className="text-xs text-red-700">Created when you approve a credit purchase. Track what you owe vendors.</p>
                <button onClick={() => setActiveTab('payables')} className="mt-3 text-xs text-red-700 font-medium hover:underline">View Payables →</button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'receivables' && (recLoading ? <div className="p-6"><TableSkeleton rows={5} cols={8} /></div> : <EntryTable entries={receivables} type="receivable" />)}
        {activeTab === 'payables'   && (payLoading  ? <div className="p-6"><TableSkeleton rows={5} cols={8} /></div> : <EntryTable entries={payables}   type="payable"    />)}
      </div>

      {/* Record Payment Modal */}
      <Modal open={showPaymentModal} onClose={() => setShowPaymentModal(false)}
        title={selectedEntry?.type === 'receivable' ? 'Record Payment Received' : 'Record Payment Made'}>
        <div className="space-y-4">
          {/* Outstanding summary */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm space-y-1">
            <div className="flex justify-between"><span className="text-slate-500">{selectedEntry?.type === 'receivable' ? 'Customer' : 'Vendor'}:</span><span className="font-medium text-slate-800">{selectedEntry?.customer_name ?? selectedEntry?.vendor_name ?? '—'}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Invoice:</span><span className="font-mono text-slate-700">{selectedEntry?.invoice_number ?? '—'}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Total:</span><span className="font-mono text-slate-700">{formatINR(selectedEntry?.total_amount ?? 0)}</span></div>
            {selectedEntry?.advance_amount > 0 && <div className="flex justify-between"><span className="text-slate-500">Advance paid:</span><span className="font-mono text-blue-600">{formatINR(selectedEntry.advance_amount)}</span></div>}
            <div className="flex justify-between border-t border-slate-200 pt-1"><span className="text-slate-600 font-medium">Outstanding Balance:</span><span className="font-mono font-semibold text-red-600">{formatINR(selectedEntry?.balance_amount ?? 0)}</span></div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Payment Amount (₹) *</label>
            <div className="flex gap-2">
              <input type="number" min="0.01" step="0.01" value={paymentAmount}
                onChange={e => setPaymentAmount(e.target.value)}
                className="flex-1 px-3 py-2 text-sm font-mono bg-white border border-gray-300 rounded-md text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" />
              <button onClick={() => setPaymentAmount(String(selectedEntry?.balance_amount ?? ''))}
                className="text-xs px-2.5 py-1.5 bg-slate-100 text-slate-600 rounded border border-slate-200 hover:bg-slate-200">Full</button>
            </div>
            <p className="text-xs text-slate-400 mt-1">Enter partial or full amount — can record multiple payments over time</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Payment Method</label>
            <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-md text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20">
              {PAYMENT_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Payment Date</label>
              <input type="date" value={paymentDate} onChange={e => setPaymentDate(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-md text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Notes (optional)</label>
              <input type="text" placeholder="Ref no., remarks…" value={paymentNotes} onChange={e => setPaymentNotes(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-md text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" />
            </div>
          </div>
        </div>

        <div className="flex gap-3 mt-6 pt-4 border-t border-gray-100">
          <button onClick={() => setShowPaymentModal(false)} className="px-4 py-2 text-sm font-medium bg-white border border-gray-300 text-slate-700 rounded-md hover:bg-gray-50">Cancel</button>
          <button onClick={handleRecordPayment} disabled={savingPayment}
            className="flex-1 px-6 py-2 text-sm font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors">
            {savingPayment ? 'Saving…' : 'Record Payment'}
          </button>
        </div>
      </Modal>
    </PageWrapper>
  )
}
