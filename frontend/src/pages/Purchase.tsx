import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useDropzone, FileRejection } from 'react-dropzone'
import { Upload, FileText, Image, CheckCircle, AlertCircle, X, Plus, ShoppingBag, Eye, Check } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { PageWrapper } from '../components/layout/PageWrapper'
import { Modal } from '../components/ui/Modal'
import { TableSkeleton, EmptyState } from '../components/ui/Skeleton'
import { StatusBadge } from '../components/ui/Badge'
import { formatINR, formatDate, cn } from '../lib/utils'
import client from '../api/client'
import toast from 'react-hot-toast'

interface PurchaseInvoice {
  id: number
  invoice_number: string | null
  invoice_date: string | null
  vendor_name: string | null
  total_amount: number
  tax_amount: number
  input_gst: number
  processing_status: string
  marketplace: string
  created_at: string
}

const VENDOR_TYPES = [
  { value: 'manufacturer', label: 'Manufacturer' },
  { value: 'distributor', label: 'Distributor' },
  { value: 'wholesaler', label: 'Wholesaler' },
  { value: 'retailer', label: 'Retail Supplier' },
  { value: 'importer', label: 'Importer' },
  { value: 'other', label: 'Other' },
]

interface FileItem {
  id: string
  file: File
  progress: number
  status: 'idle' | 'uploading' | 'done' | 'error'
  invoiceId?: number
}

// Manual purchase entry form
const EMPTY_MANUAL = {
  vendor_name: '', vendor_gstin: '', invoice_number: '', invoice_date: '',
  total_amount: '', tax_amount: '', input_gst_rate: '18', input_gst_amount: '',
  vendor_type: 'distributor', notes: '',
  is_credit_purchase: false, credit_days: '30',
}

export default function Purchase() {
  const qc = useQueryClient()
  const [activeTab, setActiveTab] = useState<'list' | 'upload' | 'manual'>('list')
  const [files, setFiles] = useState<FileItem[]>([])
  const [vendor, setVendor] = useState('other')
  const [uploading, setUploading] = useState(false)
  const [manualForm, setManualForm] = useState({ ...EMPTY_MANUAL })
  const [savingManual, setSavingManual] = useState(false)
  const [previewId, setPreviewId] = useState<number | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['purchases'],
    queryFn: () => client.get('/purchases').then(r => r.data.data),
  })

  const { data: summaryData } = useQuery({
    queryKey: ['purchases', 'summary'],
    queryFn: () => client.get('/purchases/summary').then(r => r.data.data),
  })

  const approveMutation = useMutation({
    mutationFn: (id: number) => client.post(`/purchases/${id}/approve`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['purchases'] })
      qc.invalidateQueries({ queryKey: ['products'] })
      toast.success('Purchase approved — stock updated!')
    },
    onError: () => toast.error('Failed to approve purchase'),
  })

  const onDrop = useCallback((accepted: File[], rejected: FileRejection[]) => {
    rejected.forEach(({ file, errors }) => {
      const reason = errors[0]?.code === 'file-too-large' ? 'exceeds 10 MB limit' : 'unsupported file type'
      toast.error(`${file.name} — ${reason}`)
    })
    setFiles(prev => [...prev, ...accepted.map(f => ({ id: Math.random().toString(36).slice(2), file: f, progress: 0, status: 'idle' as const }))])
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'], 'image/jpeg': ['.jpg', '.jpeg'], 'image/png': ['.png'] },
    maxSize: 10 * 1024 * 1024,
  })

  const processAll = async () => {
    setUploading(true)
    const pending = files.filter(f => f.status === 'idle')
    for (const item of pending) {
      setFiles(prev => prev.map(f => f.id === item.id ? { ...f, status: 'uploading' } : f))
      try {
        const fd = new FormData()
        fd.append('file', item.file)
        fd.append('invoice_type', 'purchase')
        fd.append('marketplace', vendor)
        const { data } = await client.post('/invoices/upload', fd, {
          headers: {},
          onUploadProgress: (e) => {
            const pct = e.total ? Math.round((e.loaded / e.total) * 100) : 50
            setFiles(prev => prev.map(f => f.id === item.id ? { ...f, progress: pct } : f))
          },
        })
        const invoiceId = data.data.invoice_id
        setFiles(prev => prev.map(f => f.id === item.id ? { ...f, status: 'done', progress: 100, invoiceId } : f))
        qc.invalidateQueries({ queryKey: ['purchases'] })
      } catch {
        setFiles(prev => prev.map(f => f.id === item.id ? { ...f, status: 'error' } : f))
        toast.error(`Failed to upload ${item.file.name}`)
      }
    }
    setUploading(false)
    toast.success('Purchase invoice(s) uploaded for AI extraction!')
    setActiveTab('list')
  }

  const handleManualSave = async () => {
    if (!manualForm.vendor_name.trim()) { toast.error('Vendor name required'); return }
    if (!manualForm.total_amount) { toast.error('Total amount required'); return }
    setSavingManual(true)
    try {
      await client.post('/purchases', {
        ...manualForm,
        total_amount: Number(manualForm.total_amount),
        tax_amount: Number(manualForm.tax_amount) || 0,
        input_gst_amount: Number(manualForm.input_gst_amount) || 0,
        input_gst_rate: Number(manualForm.input_gst_rate) || 0,
        invoice_type: 'purchase',
        is_credit_purchase: manualForm.is_credit_purchase,
        credit_days: manualForm.is_credit_purchase ? Number(manualForm.credit_days) : 0,
      })
      toast.success('Purchase recorded!')
      setManualForm({ ...EMPTY_MANUAL })
      qc.invalidateQueries({ queryKey: ['purchases'] })
      setActiveTab('list')
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Failed to save purchase')
    } finally {
      setSavingManual(false)
    }
  }

  const purchases: PurchaseInvoice[] = data?.data ?? []
  const summary = summaryData ?? {}

  const TAB_STYLE = (t: string) => cn(
    'px-4 py-2 text-sm font-medium border-b-2 transition-colors duration-150',
    activeTab === t ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-700'
  )

  return (
    <PageWrapper>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">Purchases</h1>
          <p className="text-sm text-slate-400 mt-0.5">Track stock purchases from vendors. Approving adds stock & records Input GST (ITC).</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Total Purchases', value: formatINR(summary.total_purchases ?? 0), accent: '#2563EB' },
          { label: 'Input GST (ITC)', value: formatINR(summary.total_input_gst ?? 0), accent: '#16A34A' },
          { label: 'Pending Approval', value: summary.pending_count ?? 0, accent: '#D97706' },
        ].map(s => (
          <div key={s.label} className="bg-white border border-gray-200 rounded-lg shadow-sm px-5 py-4" style={{ borderLeft: `3px solid ${s.accent}` }}>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">{s.label}</p>
            <p className="text-2xl font-bold text-slate-800 font-mono">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
        <div className="flex border-b border-gray-200 px-4">
          <button className={TAB_STYLE('list')} onClick={() => setActiveTab('list')}>All Purchases</button>
          <button className={TAB_STYLE('upload')} onClick={() => setActiveTab('upload')}>
            <Upload size={13} className="inline mr-1.5" />Upload Invoice
          </button>
          <button className={TAB_STYLE('manual')} onClick={() => setActiveTab('manual')}>
            <Plus size={13} className="inline mr-1.5" />Manual Entry
          </button>
        </div>

        {/* LIST TAB */}
        {activeTab === 'list' && (
          isLoading ? (
            <div className="p-6"><TableSkeleton rows={6} cols={6} /></div>
          ) : purchases.length === 0 ? (
            <EmptyState icon="🛒" title="No purchases yet" description="Upload a vendor invoice or add manually" action={<button onClick={() => setActiveTab('upload')} className="mt-2 px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700">Upload Invoice</button>} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    {['Date', 'Invoice #', 'Vendor', 'Total', 'Input GST', 'Status', ''].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {purchases.map((p) => (
                    <tr key={p.id} className="border-b border-gray-100 hover:bg-blue-50/20 transition-colors">
                      <td className="px-4 py-3 text-sm text-slate-600">{p.invoice_date ? formatDate(p.invoice_date) : '—'}</td>
                      <td className="px-4 py-3 text-sm font-mono text-slate-800">{p.invoice_number ?? '—'}</td>
                      <td className="px-4 py-3 text-sm text-slate-700">{p.vendor_name ?? '—'}</td>
                      <td className="px-4 py-3 text-sm font-mono text-slate-800 text-right">{formatINR(p.total_amount)}</td>
                      <td className="px-4 py-3 text-sm font-mono text-emerald-700 text-right">{formatINR(p.input_gst ?? p.tax_amount)}</td>
                      <td className="px-4 py-3"><StatusBadge status={p.processing_status} /></td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          {(p.processing_status === 'review' || p.processing_status === 'pending') && (
                            <button onClick={() => approveMutation.mutate(p.id)}
                              className="flex items-center gap-1 text-xs px-2.5 py-1 bg-emerald-600 text-white rounded hover:bg-emerald-700 transition-colors">
                              <Check size={11} /> Approve
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}

        {/* UPLOAD TAB */}
        {activeTab === 'upload' && (
          <div className="p-6 max-w-xl">
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Vendor / Supplier Type</label>
              <select value={vendor} onChange={e => setVendor(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-md text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20">
                {VENDOR_TYPES.map(v => <option key={v.value} value={v.value}>{v.label}</option>)}
              </select>
            </div>

            <div {...getRootProps()} className={cn('border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all duration-200',
              isDragActive ? 'border-blue-400 bg-blue-50' : 'border-gray-300 hover:border-blue-400/60 hover:bg-gray-50')}>
              <input {...getInputProps()} />
              <div className="flex flex-col items-center gap-3">
                <div className={cn('w-12 h-12 rounded-xl flex items-center justify-center', isDragActive ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-slate-400')}>
                  <Upload size={22} />
                </div>
                <p className="text-sm font-medium text-slate-700">{isDragActive ? 'Drop to upload' : 'Drop vendor invoices here'}</p>
                <p className="text-xs text-slate-400">or <span className="text-blue-600">click to browse</span> · PDF, JPG, PNG · max 10MB</p>
              </div>
            </div>

            <AnimatePresence>
              {files.length > 0 && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-3 space-y-2">
                  {files.map(item => (
                    <div key={item.id} className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-lg p-3">
                      <div className="w-7 h-7 rounded-md bg-gray-100 flex items-center justify-center flex-shrink-0">
                        {item.file.type === 'application/pdf' ? <FileText size={13} className="text-red-400" /> : <Image size={13} className="text-blue-400" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-slate-700 truncate">{item.file.name}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <div className="flex-1 h-1 bg-gray-200 rounded-full overflow-hidden">
                            <div className={cn('h-full rounded-full', item.status === 'done' ? 'bg-emerald-400' : item.status === 'error' ? 'bg-red-400' : 'bg-blue-500')} style={{ width: `${item.progress}%` }} />
                          </div>
                        </div>
                      </div>
                      {item.status === 'done' && <CheckCircle size={15} className="text-emerald-500 flex-shrink-0" />}
                      {item.status === 'error' && <AlertCircle size={15} className="text-red-400 flex-shrink-0" />}
                      {item.status === 'idle' && <button onClick={() => setFiles(prev => prev.filter(f => f.id !== item.id))} className="text-slate-400 hover:text-slate-600"><X size={14} /></button>}
                    </div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>

            {files.some(f => f.status === 'idle') && (
              <button onClick={processAll} disabled={uploading}
                className="mt-4 w-full py-2.5 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
                <Upload size={15} />
                {uploading ? 'Uploading…' : `Process ${files.filter(f => f.status === 'idle').length} Invoice(s)`}
              </button>
            )}
          </div>
        )}

        {/* MANUAL ENTRY TAB */}
        {activeTab === 'manual' && (
          <div className="p-6 max-w-2xl">
            <p className="text-sm text-slate-500 mb-5">For purchases made outside the system (cash purchases, small vendors without invoice etc.)</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Vendor Name *</label>
                <input type="text" placeholder="e.g. ABC Electronics Pvt Ltd" value={manualForm.vendor_name}
                  onChange={e => setManualForm(p => ({ ...p, vendor_name: e.target.value }))}
                  className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-md text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Vendor GSTIN</label>
                <input type="text" placeholder="27AABCU9603R1ZX" value={manualForm.vendor_gstin}
                  onChange={e => setManualForm(p => ({ ...p, vendor_gstin: e.target.value.toUpperCase() }))}
                  className="w-full px-3 py-2 text-sm font-mono bg-white border border-gray-300 rounded-md text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Invoice Number</label>
                <input type="text" placeholder="e.g. INV-2024-001" value={manualForm.invoice_number}
                  onChange={e => setManualForm(p => ({ ...p, invoice_number: e.target.value }))}
                  className="w-full px-3 py-2 text-sm font-mono bg-white border border-gray-300 rounded-md text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Invoice Date</label>
                <input type="date" value={manualForm.invoice_date}
                  onChange={e => setManualForm(p => ({ ...p, invoice_date: e.target.value }))}
                  className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-md text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Vendor Type</label>
                <select value={manualForm.vendor_type} onChange={e => setManualForm(p => ({ ...p, vendor_type: e.target.value }))}
                  className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-md text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20">
                  {VENDOR_TYPES.map(v => <option key={v.value} value={v.value}>{v.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Total Amount (₹) *</label>
                <input type="number" placeholder="0.00" min="0" step="0.01" value={manualForm.total_amount}
                  onChange={e => setManualForm(p => ({ ...p, total_amount: e.target.value }))}
                  className="w-full px-3 py-2 text-sm font-mono bg-white border border-gray-300 rounded-md text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" />
              </div>

              {/* Input GST */}
              <div className="col-span-2 border-t border-gray-100 pt-4">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Input GST (ITC Claim)</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">GST Rate (%)</label>
                    <select value={manualForm.input_gst_rate} onChange={e => setManualForm(p => ({ ...p, input_gst_rate: e.target.value }))}
                      className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-md text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20">
                      {[0, 5, 12, 18, 28].map(r => <option key={r} value={r}>{r}%</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">GST Amount (₹)</label>
                    <input type="number" placeholder="0.00" min="0" step="0.01" value={manualForm.input_gst_amount}
                      onChange={e => setManualForm(p => ({ ...p, input_gst_amount: e.target.value }))}
                      className="w-full px-3 py-2 text-sm font-mono bg-white border border-gray-300 rounded-md text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" />
                    <p className="mt-1 text-xs text-slate-400">Claimable as ITC on your GST return</p>
                  </div>
                </div>
              </div>

              <div className="col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Notes</label>
                <textarea placeholder="Payment method, remarks, etc." rows={2} value={manualForm.notes}
                  onChange={e => setManualForm(p => ({ ...p, notes: e.target.value }))}
                  className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-md text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 resize-none" />
              </div>

              {/* Credit Purchase toggle */}
              <div className="col-span-2">
                <div className="flex items-start gap-3 p-3 border border-gray-200 rounded-lg bg-gray-50/50">
                  <button
                    onClick={() => setManualForm(p => ({ ...p, is_credit_purchase: !p.is_credit_purchase }))}
                    className={`mt-0.5 w-10 h-5 rounded-full transition-colors duration-200 flex-shrink-0 ${manualForm.is_credit_purchase ? 'bg-blue-600' : 'bg-gray-300'}`}
                  >
                    <span className={`block w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 mx-0.5 ${manualForm.is_credit_purchase ? 'translate-x-5' : 'translate-x-0'}`} />
                  </button>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-700">Credit Purchase</p>
                    <p className="text-xs text-slate-400">You pay vendor later — creates outstanding payable</p>
                    {manualForm.is_credit_purchase && (
                      <div className="mt-2 flex items-center gap-2">
                        <label className="text-xs text-slate-600 flex-shrink-0">Credit Period:</label>
                        <select value={manualForm.credit_days}
                          onChange={e => setManualForm(p => ({ ...p, credit_days: e.target.value }))}
                          className="text-xs px-2 py-1 border border-gray-300 rounded bg-white text-slate-800 focus:outline-none focus:border-blue-500">
                          {[7, 15, 30, 45, 60, 90].map(d => <option key={d} value={d}>{d} days</option>)}
                        </select>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6 pt-4 border-t border-gray-100">
              <button onClick={() => setManualForm({ ...EMPTY_MANUAL })}
                className="px-4 py-2 text-sm font-medium bg-white border border-gray-300 text-slate-700 rounded-md hover:bg-gray-50 transition-colors">Clear</button>
              <button onClick={handleManualSave} disabled={savingManual}
                className="px-6 py-2 text-sm font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors">
                {savingManual ? 'Saving…' : 'Save Purchase'}
              </button>
            </div>
          </div>
        )}
      </div>
    </PageWrapper>
  )
}
