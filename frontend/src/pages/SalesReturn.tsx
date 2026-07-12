import { useState, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useDropzone, FileRejection } from 'react-dropzone'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Upload, X, FileText, Image, CheckCircle, AlertCircle,
  RotateCcw, AlertTriangle, Info, History, ArrowRight,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { invoicesApi } from '../api/invoices'
import client from '../api/client'
import { PageWrapper } from '../components/layout/PageWrapper'
import { Button } from '../components/ui/Button'
import { Select } from '../components/ui/Input'
import { StatusBadge, MarketplaceBadge } from '../components/ui/Badge'
import { TableSkeleton, EmptyState } from '../components/ui/Skeleton'
import { formatINR, formatDate, cn } from '../lib/utils'

interface FileItem {
  id: string
  file: File
  progress: number
  status: 'idle' | 'uploading' | 'done' | 'error'
  invoiceId?: number
  error?: string
}

type ReturnType = 'regular' | 'damaged'
type TabType = 'upload' | 'history'

const MARKETPLACE_OPTIONS = [
  { value: 'amazon', label: 'Amazon' },
  { value: 'flipkart', label: 'Flipkart' },
  { value: 'meesho', label: 'Meesho' },
  { value: 'myntra', label: 'Myntra' },
  { value: 'other', label: 'Other' },
]

export default function SalesReturn() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<TabType>('upload')
  const [files, setFiles] = useState<FileItem[]>([])
  const [marketplace, setMarketplace] = useState('amazon')
  const [returnType, setReturnType] = useState<ReturnType>('regular')
  const [uploading, setUploading] = useState(false)

  // Returns history
  const { data: returnsData, isLoading: historyLoading } = useQuery({
    queryKey: ['returns-history'],
    queryFn: () => client.get('/invoices', { params: { invoice_type: 'return', per_page: 50 } }).then(r => r.data.data),
    enabled: activeTab === 'history',
  })
  const returns = returnsData?.data ?? []

  const onDrop = useCallback((accepted: File[], rejected: FileRejection[]) => {
    rejected.forEach(({ file, errors }) => {
      const reason = errors[0]?.code === 'file-too-large' ? 'exceeds 10 MB limit' : 'unsupported file type'
      toast.error(`${file.name} — ${reason}`)
    })
    setFiles((prev) => [...prev, ...accepted.map((f) => ({
      id: Math.random().toString(36).slice(2),
      file: f, progress: 0, status: 'idle' as const,
    }))])
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'], 'image/jpeg': ['.jpg', '.jpeg'], 'image/png': ['.png'] },
    maxSize: 10 * 1024 * 1024,
  })

  const removeFile = (id: string) => setFiles((prev) => prev.filter((f) => f.id !== id))

  const processAll = async () => {
    setUploading(true)
    const pending = files.filter((f) => f.status === 'idle')

    for (const item of pending) {
      setFiles((prev) => prev.map((f) => f.id === item.id ? { ...f, status: 'uploading' } : f))
      try {
        // Step 1: Upload the return invoice
        const { data } = await invoicesApi.uploadReturn(
          item.file,
          marketplace,
          returnType === 'damaged',
          (pct) => {
            if (pct <= 100)
              setFiles((prev) => prev.map((f) => f.id === item.id ? { ...f, progress: pct } : f))
          }
        )
        const invoiceId = data.data.invoice_id

        // Step 2: Poll until AI extraction completes (status becomes 'review')
        let attempts = 0
        let status = 'pending'
        while (attempts < 30 && status !== 'review' && status !== 'error') {
          await new Promise(r => setTimeout(r, 2000))
          try {
            const statusRes = await invoicesApi.getStatus(invoiceId)
            status = statusRes.data.data.status
          } catch {}
          attempts++
        }

        if (status === 'error') {
          setFiles((prev) => prev.map((f) => f.id === item.id ? { ...f, status: 'error', error: 'AI extraction failed' } : f))
          toast.error(`AI extraction failed for ${item.file.name}`)
          continue
        }

        // Step 3: Auto-approve — triggers addFromReturn() in backend
        // Delay briefly to ensure mappings are ready
        await new Promise(r => setTimeout(r, 800))
        await client.put(`/invoices/${invoiceId}/approve`, { validated_data: {} })

        setFiles((prev) => prev.map((f) => f.id === item.id ? { ...f, status: 'done', progress: 100, invoiceId } : f))

        toast.success(
          returnType === 'damaged'
            ? `✅ Processed — ${item.file.name.slice(0, 20)} added to Damaged Goods`
            : `✅ Processed — Stock restored for ${item.file.name.slice(0, 20)}`
        )
      } catch {
        setFiles((prev) => prev.map((f) => f.id === item.id ? { ...f, status: 'error', error: 'Processing failed' } : f))
        toast.error(`Failed to process ${item.file.name}`)
      }
    }
    setUploading(false)
  }

  const hasIdle = files.some((f) => f.status === 'idle')

  const TAB_STYLE = (t: TabType) => cn(
    'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors duration-150',
    activeTab === t ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-700'
  )

  return (
    <PageWrapper>
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-slate-800">Sales Returns</h1>
          <p className="text-sm text-slate-500 mt-1">
            Upload return invoices to update inventory. Approve the invoice to apply changes.
          </p>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 mb-6">
          <button className={TAB_STYLE('upload')} onClick={() => setActiveTab('upload')}>
            <Upload size={14} /> Upload Return
          </button>
          <button className={TAB_STYLE('history')} onClick={() => setActiveTab('history')}>
            <History size={14} /> Returns History
          </button>
        </div>

        {/* ── UPLOAD TAB ── */}
        {activeTab === 'upload' && (
          <>
            {/* Return type toggle */}
            <div className="mb-5">
              <p className="text-sm font-medium text-slate-700 mb-2">Return Type</p>
              <div className="inline-flex items-center bg-gray-100 rounded-lg p-1 gap-1">
                <button
                  onClick={() => setReturnType('regular')}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all duration-150',
                    returnType === 'regular'
                      ? 'bg-white text-slate-800 shadow-sm border border-gray-200'
                      : 'text-slate-500 hover:text-slate-700'
                  )}
                >
                  <RotateCcw size={14} />
                  Regular Return
                </button>
                <button
                  onClick={() => setReturnType('damaged')}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all duration-150',
                    returnType === 'damaged'
                      ? 'bg-white text-slate-800 shadow-sm border border-gray-200'
                      : 'text-slate-500 hover:text-slate-700'
                  )}
                >
                  <AlertTriangle size={14} className={returnType === 'damaged' ? 'text-amber-500' : ''} />
                  Damaged Goods
                </button>
              </div>

              {/* What happens explanation */}
              <div className={cn(
                'mt-3 p-3 rounded-lg border text-xs flex items-start gap-2',
                returnType === 'regular'
                  ? 'bg-blue-50 border-blue-200 text-blue-700'
                  : 'bg-amber-50 border-amber-200 text-amber-700'
              )}>
                <Info size={13} className="flex-shrink-0 mt-0.5" />
                <span>
                  {returnType === 'regular'
                    ? 'Product will be added back to active stock after you review and approve the invoice.'
                    : 'Product will be moved to Damaged Goods (separate from active stock). You can write it off from the Damaged Goods page.'}
                </span>
              </div>
            </div>

            {/* Marketplace selector */}
            <Select
              label="Marketplace"
              options={MARKETPLACE_OPTIONS}
              value={marketplace}
              onChange={(e) => setMarketplace(e.target.value)}
              className="mb-4"
            />

            {/* Drop zone */}
            <div
              {...getRootProps()}
              style={{ transform: isDragActive ? 'scale(1.01)' : 'scale(1)', transition: 'all 0.2s ease' }}
              className={cn(
                'border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all duration-200',
                returnType === 'damaged'
                  ? isDragActive ? 'border-amber-400 bg-amber-50' : 'border-amber-200 hover:border-amber-400 hover:bg-amber-50/40'
                  : isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50/30'
              )}
            >
              <input {...getInputProps()} />
              <motion.div animate={isDragActive ? { y: -4 } : { y: 0 }} className="flex flex-col items-center gap-3">
                <div className={cn('w-14 h-14 rounded-xl flex items-center justify-center',
                  returnType === 'damaged'
                    ? isDragActive ? 'bg-amber-100 text-amber-500' : 'bg-amber-50 text-amber-400'
                    : isDragActive ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-400'
                )}>
                  <Upload size={24} />
                </div>
                <div>
                  <p className="font-semibold text-slate-700">{isDragActive ? 'Drop to upload' : 'Drop return invoices here'}</p>
                  <p className="text-sm text-slate-400 mt-1">or <span className="text-blue-600 cursor-pointer hover:underline">click to browse</span></p>
                </div>
                <div className="flex gap-2">
                  {['PDF', 'JPG', 'PNG'].map((fmt) => (
                    <span key={fmt} className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 border border-gray-200">{fmt}</span>
                  ))}
                </div>
              </motion.div>
            </div>

            {/* File queue */}
            <AnimatePresence>
              {files.length > 0 && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mt-4 space-y-2">
                  {files.map((item) => (
                    <motion.div key={item.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}
                      className="flex items-center gap-3 bg-white border border-gray-200 rounded-xl p-3 shadow-sm">
                      <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center flex-shrink-0">
                        {item.file.type === 'application/pdf' ? <FileText size={15} className="text-red-400" /> : <Image size={15} className="text-blue-400" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-slate-700 truncate">{item.file.name}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <div className="flex-1 h-1 bg-gray-100 rounded-full overflow-hidden">
                            <motion.div animate={{ width: `${item.progress}%` }}
                              className={cn('h-full rounded-full', item.status === 'done' ? 'bg-emerald-400' : item.status === 'error' ? 'bg-red-400' : 'bg-blue-500')} />
                          </div>
                          <span className="text-xs text-gray-400 font-mono">{(item.file.size / 1024).toFixed(0)}KB</span>
                        </div>
                      </div>
                      {item.status === 'done' && <CheckCircle size={16} className="text-emerald-400 flex-shrink-0" />}
                      {item.status === 'error' && <AlertCircle size={16} className="text-red-400 flex-shrink-0" />}
                      {item.status === 'idle' && (
                        <button onClick={() => removeFile(item.id)} className="text-gray-400 hover:text-gray-600 flex-shrink-0"><X size={15} /></button>
                      )}
                    </motion.div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Process button */}
            {hasIdle && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-6">
                <Button onClick={processAll} loading={uploading} fullWidth size="lg"
                  variant={returnType === 'damaged' ? 'secondary' : 'primary'}
                  className={returnType === 'damaged' ? 'border-amber-300 text-amber-700 hover:bg-amber-50' : ''}>
                  <Upload size={16} />
                  {uploading
                    ? 'Processing — AI extracting & updating inventory…'
                    : `Process ${files.filter(f => f.status === 'idle').length} Return Invoice${files.filter(f => f.status === 'idle').length > 1 ? 's' : ''}`}
                </Button>
              </motion.div>
            )}

            {/* What happens — automatic flow */}
            <div className="mt-6 p-4 bg-slate-50 border border-slate-200 rounded-lg">
              <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">What happens automatically</p>
              <div className="flex items-center gap-3 text-xs text-slate-500 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-[10px] flex-shrink-0">1</span>
                  Upload invoice
                </div>
                <ArrowRight size={10} className="text-slate-300 flex-shrink-0" />
                <div className="flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-[10px] flex-shrink-0">2</span>
                  AI reads product &amp; qty
                </div>
                <ArrowRight size={10} className="text-slate-300 flex-shrink-0" />
                <div className="flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-[10px] flex-shrink-0">3</span>
                  {returnType === 'damaged'
                    ? 'Moved to Damaged Goods page'
                    : 'Stock added back to Inventory'}
                </div>
              </div>
              <p className="text-xs text-slate-400 mt-2 italic">No manual steps needed — fully automatic.</p>
            </div>
          </>
        )}

        {/* ── HISTORY TAB ── */}
        {activeTab === 'history' && (
          <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
            {historyLoading ? (
              <div className="p-6"><TableSkeleton rows={5} cols={5} /></div>
            ) : returns.length === 0 ? (
              <EmptyState
                icon="🔄"
                title="No returns yet"
                description="Return invoices will appear here after you upload them"
                action={
                  <button onClick={() => setActiveTab('upload')}
                    className="mt-2 px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700">
                    Upload Return Invoice
                  </button>
                }
              />
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    {['Date', 'Invoice #', 'Marketplace', 'Type', 'Amount', 'Status', ''].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {returns.map((r: any) => (
                    <tr key={r.id} className="border-b border-gray-100 hover:bg-blue-50/20 cursor-pointer transition-colors"
                      onClick={() => navigate(r.processing_status === 'review' ? `/invoices/${r.id}/review` : `/invoices/${r.id}`)}>
                      <td className="px-4 py-3 text-sm text-slate-600">{r.invoice_date ? formatDate(r.invoice_date) : formatDate(r.created_at)}</td>
                      <td className="px-4 py-3 text-sm font-mono text-slate-800">{r.invoice_number ?? '—'}</td>
                      <td className="px-4 py-3"><MarketplaceBadge marketplace={r.marketplace} /></td>
                      <td className="px-4 py-3">
                        <span className={cn('text-xs px-2 py-0.5 rounded border font-medium',
                          r.is_damaged
                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                            : 'bg-blue-50 text-blue-700 border-blue-200'
                        )}>
                          {r.is_damaged ? '⚠ Damaged' : '↩ Regular'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm font-mono text-slate-800">{formatINR(r.total_amount)}</td>
                      <td className="px-4 py-3"><StatusBadge status={r.processing_status} /></td>
                      <td className="px-4 py-3">
                        {r.processing_status === 'review' && (
                          <button onClick={e => { e.stopPropagation(); navigate(`/invoices/${r.id}/review`) }}
                            className="text-xs px-2.5 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors">
                            Review →
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </PageWrapper>
  )
}
