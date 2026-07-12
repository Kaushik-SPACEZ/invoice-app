import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useDropzone, FileRejection } from 'react-dropzone'
import { Upload, FileText, Image, CheckCircle, AlertCircle, X, Percent } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { PageWrapper } from '../components/layout/PageWrapper'
import { TableSkeleton, EmptyState } from '../components/ui/Skeleton'
import { formatINR, formatDate, cn } from '../lib/utils'
import client from '../api/client'
import toast from 'react-hot-toast'

const PLATFORM_OPTIONS = [
  { value: 'amazon', label: 'Amazon', color: '#FF9900' },
  { value: 'flipkart', label: 'Flipkart', color: '#2874F0' },
  { value: 'meesho', label: 'Meesho', color: '#F43397' },
  { value: 'myntra', label: 'Myntra', color: '#FF3F6C' },
  { value: 'snapdeal', label: 'Snapdeal', color: '#E40046' },
  { value: 'ajio', label: 'AJIO', color: '#1E1E1E' },
  { value: 'jiomart', label: 'JioMart', color: '#0059A8' },
  { value: 'other', label: 'Other', color: '#6B7280' },
]

interface FileItem {
  id: string; file: File; progress: number; status: 'idle' | 'uploading' | 'done' | 'error'
}

const EMPTY_MANUAL = {
  platform: 'amazon', commission_invoice_number: '', invoice_date: '',
  gross_sales: '', commission_rate: '', commission_amount: '',
  tds_amount: '', tds_rate: '1', other_deductions: '', net_settlement: '',
  period_from: '', period_to: '', notes: '',
}

export default function CommissionInvoice() {
  const qc = useQueryClient()
  const [activeTab, setActiveTab] = useState<'list' | 'upload' | 'manual'>('list')
  const [files, setFiles] = useState<FileItem[]>([])
  const [platform, setPlatform] = useState('amazon')
  const [uploading, setUploading] = useState(false)
  const [form, setForm] = useState({ ...EMPTY_MANUAL })
  const [saving, setSaving] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['commission-invoices'],
    queryFn: () => client.get('/commission-invoices').then(r => r.data.data),
  })

  const { data: summaryData } = useQuery({
    queryKey: ['commission-invoices', 'summary'],
    queryFn: () => client.get('/commission-invoices/summary').then(r => r.data.data),
  })

  const onDrop = useCallback((accepted: File[], rejected: FileRejection[]) => {
    rejected.forEach(({ file, errors }) => toast.error(`${file.name} — ${errors[0]?.code === 'file-too-large' ? 'exceeds 10 MB' : 'unsupported type'}`))
    setFiles(prev => [...prev, ...accepted.map(f => ({ id: Math.random().toString(36).slice(2), file: f, progress: 0, status: 'idle' as const }))])
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'], 'image/jpeg': ['.jpg', '.jpeg'], 'image/png': ['.png'] },
    maxSize: 10 * 1024 * 1024,
  })

  const processAll = async () => {
    setUploading(true)
    for (const item of files.filter(f => f.status === 'idle')) {
      setFiles(prev => prev.map(f => f.id === item.id ? { ...f, status: 'uploading' } : f))
      try {
        const fd = new FormData()
        fd.append('file', item.file)
        fd.append('invoice_type', 'commission')
        fd.append('marketplace', platform)
        await client.post('/invoices/upload', fd, {
          headers: {},
          onUploadProgress: (e) => {
            const pct = e.total ? Math.round((e.loaded / e.total) * 100) : 50
            setFiles(prev => prev.map(f => f.id === item.id ? { ...f, progress: pct } : f))
          },
        })
        setFiles(prev => prev.map(f => f.id === item.id ? { ...f, status: 'done', progress: 100 } : f))
      } catch {
        setFiles(prev => prev.map(f => f.id === item.id ? { ...f, status: 'error' } : f))
        toast.error(`Failed to upload ${item.file.name}`)
      }
    }
    setUploading(false)
    qc.invalidateQueries({ queryKey: ['commission-invoices'] })
    toast.success('Commission invoice(s) uploaded!')
    setActiveTab('list')
  }

  const handleSave = async () => {
    if (!form.platform) { toast.error('Select platform'); return }
    if (!form.commission_amount) { toast.error('Commission amount required'); return }
    setSaving(true)
    try {
      await client.post('/commission-invoices', {
        ...form,
        gross_sales: Number(form.gross_sales) || 0,
        commission_rate: Number(form.commission_rate) || 0,
        commission_amount: Number(form.commission_amount),
        tds_amount: Number(form.tds_amount) || 0,
        tds_rate: Number(form.tds_rate) || 0,
        other_deductions: Number(form.other_deductions) || 0,
        net_settlement: Number(form.net_settlement) || 0,
      })
      toast.success('Commission recorded → added to Expenses')
      setForm({ ...EMPTY_MANUAL })
      qc.invalidateQueries({ queryKey: ['commission-invoices'] })
      setActiveTab('list')
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const records = data?.data ?? []
  const summary = summaryData ?? {}

  const TAB_STYLE = (t: string) => cn('px-4 py-2 text-sm font-medium border-b-2 transition-colors duration-150',
    activeTab === t ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-700')

  return (
    <PageWrapper>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">Commission Invoices</h1>
          <p className="text-sm text-slate-400 mt-0.5">Track marketplace commissions, TDS, and settlement deductions — auto-posted to Expenses.</p>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Commission Paid', value: formatINR(summary.total_commission ?? 0), accent: '#DC2626' },
          { label: 'TDS Deducted', value: formatINR(summary.total_tds ?? 0), accent: '#D97706' },
          { label: 'Other Deductions', value: formatINR(summary.total_deductions ?? 0), accent: '#6B7280' },
          { label: 'Net Settlement', value: formatINR(summary.total_net_settlement ?? 0), accent: '#16A34A' },
        ].map(s => (
          <div key={s.label} className="bg-white border border-gray-200 rounded-lg shadow-sm px-4 py-3" style={{ borderLeft: `3px solid ${s.accent}` }}>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">{s.label}</p>
            <p className="text-xl font-bold text-slate-800 font-mono">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
        <div className="flex border-b border-gray-200 px-4">
          <button className={TAB_STYLE('list')} onClick={() => setActiveTab('list')}>All Records</button>
          <button className={TAB_STYLE('upload')} onClick={() => setActiveTab('upload')}><Upload size={13} className="inline mr-1.5" />Upload</button>
          <button className={TAB_STYLE('manual')} onClick={() => setActiveTab('manual')}><Percent size={13} className="inline mr-1.5" />Manual Entry</button>
        </div>

        {activeTab === 'list' && (
          isLoading ? (
            <div className="p-6"><TableSkeleton rows={5} cols={7} /></div>
          ) : records.length === 0 ? (
            <EmptyState icon="💸" title="No commission records yet" description="Upload a commission invoice or enter manually" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    {['Date', 'Invoice #', 'Platform', 'Gross Sales', 'Commission', 'TDS', 'Net Settlement'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {records.map((r: any) => (
                    <tr key={r.id} className="border-b border-gray-100 hover:bg-blue-50/20">
                      <td className="px-4 py-3 text-sm text-slate-600">{r.invoice_date ? formatDate(r.invoice_date) : '—'}</td>
                      <td className="px-4 py-3 text-sm font-mono text-slate-800">{r.commission_invoice_number ?? '—'}</td>
                      <td className="px-4 py-3">
                        <span className="text-xs font-medium capitalize px-2 py-0.5 bg-slate-100 text-slate-700 rounded border border-slate-200">{r.platform}</span>
                      </td>
                      <td className="px-4 py-3 text-sm font-mono text-slate-800 text-right">{formatINR(r.gross_sales)}</td>
                      <td className="px-4 py-3 text-sm font-mono text-red-600 text-right">{formatINR(r.commission_amount)}</td>
                      <td className="px-4 py-3 text-sm font-mono text-amber-600 text-right">{formatINR(r.tds_amount)}</td>
                      <td className="px-4 py-3 text-sm font-mono text-emerald-700 font-semibold text-right">{formatINR(r.net_settlement)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}

        {activeTab === 'upload' && (
          <div className="p-6 max-w-lg">
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-2">Platform</label>
              <div className="flex flex-wrap gap-2">
                {PLATFORM_OPTIONS.map(p => (
                  <button key={p.value} onClick={() => setPlatform(p.value)}
                    className={cn('text-xs px-3 py-1.5 rounded border font-medium transition-colors', platform === p.value ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white border-gray-200 text-slate-600 hover:bg-gray-50')}
                    style={platform === p.value ? { borderColor: p.color, color: p.color, background: `${p.color}15` } : {}}>
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            <div {...getRootProps()} className={cn('border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all', isDragActive ? 'border-blue-400 bg-blue-50' : 'border-gray-300 hover:border-blue-400/60 hover:bg-gray-50')}>
              <input {...getInputProps()} />
              <div className="flex flex-col items-center gap-2">
                <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center"><Upload size={20} className="text-slate-400" /></div>
                <p className="text-sm font-medium text-slate-700">Drop commission invoice here</p>
                <p className="text-xs text-slate-400">PDF, JPG, PNG · max 10MB</p>
              </div>
            </div>

            <AnimatePresence>
              {files.length > 0 && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-3 space-y-2">
                  {files.map(item => (
                    <div key={item.id} className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-lg p-3">
                      <div className="w-7 h-7 rounded-md bg-gray-100 flex items-center justify-center">
                        {item.file.type === 'application/pdf' ? <FileText size={13} className="text-red-400" /> : <Image size={13} className="text-blue-400" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-slate-700 truncate">{item.file.name}</p>
                        <div className="flex-1 h-1 bg-gray-200 rounded-full mt-1 overflow-hidden">
                          <div className={cn('h-full rounded-full', item.status === 'done' ? 'bg-emerald-400' : item.status === 'error' ? 'bg-red-400' : 'bg-blue-500')} style={{ width: `${item.progress}%` }} />
                        </div>
                      </div>
                      {item.status === 'done' && <CheckCircle size={14} className="text-emerald-500" />}
                      {item.status === 'idle' && <button onClick={() => setFiles(prev => prev.filter(f => f.id !== item.id))} className="text-slate-400 hover:text-slate-600"><X size={14} /></button>}
                    </div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>

            {files.some(f => f.status === 'idle') && (
              <button onClick={processAll} disabled={uploading} className="mt-4 w-full py-2.5 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
                {uploading ? 'Uploading…' : 'Upload & Process'}
              </button>
            )}
          </div>
        )}

        {activeTab === 'manual' && (
          <div className="p-6 max-w-2xl">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-2">Platform *</label>
                <div className="flex flex-wrap gap-2">
                  {PLATFORM_OPTIONS.map(p => (
                    <button key={p.value} onClick={() => setForm(prev => ({ ...prev, platform: p.value }))}
                      className={cn('text-xs px-3 py-1.5 rounded border font-medium transition-colors', form.platform === p.value ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white border-gray-200 text-slate-600 hover:bg-gray-50')}>
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Commission Invoice #</label>
                <input type="text" placeholder="e.g. AMZ-STMT-2024-01" value={form.commission_invoice_number} onChange={e => setForm(p => ({ ...p, commission_invoice_number: e.target.value }))}
                  className="w-full px-3 py-2 text-sm font-mono bg-white border border-gray-300 rounded-md text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Invoice Date</label>
                <input type="date" value={form.invoice_date} onChange={e => setForm(p => ({ ...p, invoice_date: e.target.value }))}
                  className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-md text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Period From</label>
                <input type="date" value={form.period_from} onChange={e => setForm(p => ({ ...p, period_from: e.target.value }))}
                  className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-md text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Period To</label>
                <input type="date" value={form.period_to} onChange={e => setForm(p => ({ ...p, period_to: e.target.value }))}
                  className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-md text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Gross Sales (₹)</label>
                <input type="number" placeholder="0.00" min="0" step="0.01" value={form.gross_sales} onChange={e => setForm(p => ({ ...p, gross_sales: e.target.value }))}
                  className="w-full px-3 py-2 text-sm font-mono bg-white border border-gray-300 rounded-md text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Commission Rate (%)</label>
                <input type="number" placeholder="e.g. 15" min="0" max="100" step="0.1" value={form.commission_rate} onChange={e => setForm(p => ({ ...p, commission_rate: e.target.value }))}
                  className="w-full px-3 py-2 text-sm font-mono bg-white border border-gray-300 rounded-md text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Commission Amount (₹) *</label>
                <input type="number" placeholder="0.00" min="0" step="0.01" value={form.commission_amount} onChange={e => setForm(p => ({ ...p, commission_amount: e.target.value }))}
                  className="w-full px-3 py-2 text-sm font-mono bg-white border border-gray-300 rounded-md text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">TDS Rate (%)</label>
                <select value={form.tds_rate} onChange={e => setForm(p => ({ ...p, tds_rate: e.target.value }))}
                  className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-md text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20">
                  <option value="0">0% (Not Applicable)</option>
                  <option value="1">1% (TCS - Amazon/Flipkart)</option>
                  <option value="2">2% (TDS)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">TDS Amount (₹)</label>
                <input type="number" placeholder="0.00" min="0" step="0.01" value={form.tds_amount} onChange={e => setForm(p => ({ ...p, tds_amount: e.target.value }))}
                  className="w-full px-3 py-2 text-sm font-mono bg-white border border-gray-300 rounded-md text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Other Deductions (₹)</label>
                <input type="number" placeholder="0.00" min="0" step="0.01" value={form.other_deductions} onChange={e => setForm(p => ({ ...p, other_deductions: e.target.value }))}
                  className="w-full px-3 py-2 text-sm font-mono bg-white border border-gray-300 rounded-md text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Net Settlement (₹)</label>
                <input type="number" placeholder="0.00" min="0" step="0.01" value={form.net_settlement} onChange={e => setForm(p => ({ ...p, net_settlement: e.target.value }))}
                  className="w-full px-3 py-2 text-sm font-mono bg-white border border-gray-300 rounded-md text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Notes</label>
                <textarea placeholder="Settlement period, remarks…" rows={2} value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                  className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-md text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 resize-none" />
              </div>
            </div>
            <div className="flex gap-3 mt-6 pt-4 border-t border-gray-100">
              <button onClick={() => setForm({ ...EMPTY_MANUAL })} className="px-4 py-2 text-sm font-medium bg-white border border-gray-300 text-slate-700 rounded-md hover:bg-gray-50">Clear</button>
              <button onClick={handleSave} disabled={saving} className="px-6 py-2 text-sm font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors">
                {saving ? 'Saving…' : 'Save Commission Record'}
              </button>
            </div>
          </div>
        )}
      </div>
    </PageWrapper>
  )
}
