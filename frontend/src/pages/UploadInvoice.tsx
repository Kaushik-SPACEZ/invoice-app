import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDropzone, FileRejection } from 'react-dropzone'
import { motion, AnimatePresence } from 'framer-motion'
import { Upload, X, FileText, Image, CheckCircle, AlertCircle, Plus } from 'lucide-react'
import toast from 'react-hot-toast'
import { invoicesApi } from '../api/invoices'
import { PageWrapper } from '../components/layout/PageWrapper'
import { Button } from '../components/ui/Button'
import { DynamicSelect } from '../components/ui/DynamicSelect'
import { cn } from '../lib/utils'

interface FileItem {
  id: string
  file: File
  progress: number
  status: 'idle' | 'uploading' | 'done' | 'error'
  invoiceId?: number
  error?: string
}

// Simplified primary marketplaces + "Other" with custom entry
const PRIMARY_MARKETPLACES = ['amazon', 'flipkart', 'meesho', 'other']
const ALL_MARKETPLACE_OPTIONS = [
  { value: 'amazon', label: 'Amazon' },
  { value: 'flipkart', label: 'Flipkart' },
  { value: 'meesho', label: 'Meesho' },
  { value: 'myntra', label: 'Myntra' },
  { value: 'snapdeal', label: 'Snapdeal' },
  { value: 'ajio', label: 'AJIO' },
  { value: 'jiomart', label: 'JioMart' },
  { value: 'paytm', label: 'Paytm Mall' },
  { value: 'glowroad', label: 'GlowRoad' },
  { value: 'shopsy', label: 'Shopsy' },
  { value: 'direct', label: 'Direct / Website' },
  { value: 'offline', label: 'Offline / Walk-in' },
  { value: 'wholesale', label: 'Wholesale' },
  { value: 'other', label: 'Other' },
]

export default function UploadInvoice() {
  const [files, setFiles] = useState<FileItem[]>([])
  const [marketplace, setMarketplace] = useState('amazon')
  const [isCreditSale, setIsCreditSale] = useState(false)
  const [creditDays, setCreditDays] = useState('30')
  const [uploading, setUploading] = useState(false)
  const navigate = useNavigate()

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
    const invoiceIds: number[] = []

    // Upload ALL files first, collect all invoice IDs
    for (const item of pending) {
      setFiles((prev) => prev.map((f) => f.id === item.id ? { ...f, status: 'uploading' } : f))
      try {
        const { data } = await invoicesApi.upload(
          item.file,
          marketplace || 'other',
          (pct) => {
            if (pct <= 100) setFiles((prev) => prev.map((f) => f.id === item.id ? { ...f, progress: pct } : f))
          },
          { is_credit_sale: isCreditSale, credit_days: isCreditSale ? parseInt(creditDays) : 0 }
        )
        const invoiceId = data.data.invoice_id
        setFiles((prev) => prev.map((f) => f.id === item.id ? { ...f, status: 'done', progress: 100, invoiceId } : f))
        invoiceIds.push(invoiceId)
      } catch {
        setFiles((prev) => prev.map((f) => f.id === item.id ? { ...f, status: 'error', error: 'Upload failed' } : f))
        toast.error(`Failed to upload ${item.file.name}`)
      }
    }
    setUploading(false)

    if (invoiceIds.length === 0) return

    if (invoiceIds.length === 1) {
      // Single invoice — go to its individual processing page
      setTimeout(() => navigate(`/invoices/${invoiceIds[0]}/processing`), 600)
    } else {
      // Multiple invoices — go straight to invoices list
      // Store IDs so the list page can highlight & poll them
      const w = window as any
      w.__bulkFileObjects = w.__bulkFileObjects ?? {}
      files.filter(f => f.invoiceId).forEach(f => {
        w.__bulkFileObjects[f.invoiceId!] = { file: f.file, marketplace }
      })
      sessionStorage.setItem('pendingInvoiceIds', invoiceIds.join(','))
      setTimeout(() => navigate('/invoices'), 600)
    }
  }

  const hasIdle = files.some((f) => f.status === 'idle')

  return (
    <PageWrapper>
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-slate-800">Upload Invoice</h1>
          <p className="text-sm text-slate-400 mt-1">PDF, JPG, or PNG — up to 10MB each. AI extracts all data automatically.</p>
        </div>

        {/* Platform selector — dynamic */}
        <div className="mb-5">
          <p className="text-sm font-medium text-slate-700 mb-2">Platform</p>
          <DynamicSelect
            value={marketplace}
            onChange={setMarketplace}
            options={ALL_MARKETPLACE_OPTIONS}
            settingsKey="custom_platforms"
            chipStyle
          />
        </div>

        {/* Credit Sale Toggle */}
        <div className="mb-5 flex items-start gap-3 p-3 border border-gray-200 rounded-lg bg-gray-50/50">
          <button
            onClick={() => setIsCreditSale(p => !p)}
            className={cn('mt-0.5 w-10 h-5 rounded-full transition-colors duration-200 flex-shrink-0', isCreditSale ? 'bg-blue-600' : 'bg-gray-300')}
          >
            <span className={cn('block w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 mx-0.5', isCreditSale ? 'translate-x-5' : 'translate-x-0')} />
          </button>
          <div className="flex-1">
            <p className="text-sm font-medium text-slate-700">Credit Sale</p>
            <p className="text-xs text-slate-400">Customer pays later — creates outstanding receivable</p>
            {isCreditSale && (
              <div className="mt-2 flex items-center gap-2">
                <label className="text-xs text-slate-600 flex-shrink-0">Credit Period:</label>
                <select value={creditDays} onChange={e => setCreditDays(e.target.value)}
                  className="text-xs px-2 py-1 border border-gray-300 rounded bg-white text-slate-800 focus:outline-none focus:border-blue-500">
                  {[7, 15, 30, 45, 60, 90].map(d => <option key={d} value={d}>{d} days</option>)}
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Drop zone */}
        <div
          {...getRootProps()}
          className={cn(
            'border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all duration-200',
            isDragActive ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
          )}
        >
          <input {...getInputProps()} />
          <div className="flex flex-col items-center gap-3">
            <div className={cn('w-14 h-14 rounded-xl flex items-center justify-center', isDragActive ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-slate-400')}>
              <Upload size={24} />
            </div>
            <div>
              <p className="font-semibold text-slate-700">{isDragActive ? 'Drop to upload' : 'Drop invoices here'}</p>
              <p className="text-sm text-slate-400 mt-1">or <span className="text-blue-600 cursor-pointer hover:underline">click to browse</span></p>
            </div>
            <div className="flex gap-2">
              {['PDF', 'JPG', 'PNG'].map((f) => (
                <span key={f} className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-slate-400 border border-gray-200">{f}</span>
              ))}
            </div>
          </div>
        </div>

        {/* File Queue */}
        <AnimatePresence>
          {files.length > 0 && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mt-4 space-y-2">
              {files.map((item) => (
                <motion.div key={item.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}
                  className="flex items-center gap-3 bg-white border border-gray-200 rounded-xl p-3">
                  <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                    {item.file.type === 'application/pdf' ? <FileText size={15} className="text-red-400" /> : <Image size={15} className="text-blue-400" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-700 truncate">{item.file.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex-1 h-1 bg-gray-100 rounded-full overflow-hidden">
                        <motion.div animate={{ width: `${item.progress}%` }}
                          className={cn('h-full rounded-full', item.status === 'done' ? 'bg-emerald-400' : item.status === 'error' ? 'bg-red-400' : 'bg-blue-500')} />
                      </div>
                      <span className="text-xs text-slate-400 font-mono">{(item.file.size / 1024).toFixed(0)}KB</span>
                    </div>
                  </div>
                  {item.status === 'done' && <CheckCircle size={16} className="text-emerald-400 flex-shrink-0" />}
                  {item.status === 'error' && <AlertCircle size={16} className="text-red-400 flex-shrink-0" />}
                  {item.status === 'idle' && (
                    <button onClick={() => removeFile(item.id)} className="text-slate-400 hover:text-slate-600 flex-shrink-0"><X size={15} /></button>
                  )}
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {hasIdle && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-6">
            <Button onClick={processAll} loading={uploading} fullWidth size="lg">
              <Upload size={16} />
              {uploading
                ? 'Uploading…'
                : `Process ${files.filter(f => f.status === 'idle').length} Invoice${files.filter(f => f.status === 'idle').length > 1 ? 's' : ''}`}
            </Button>
          </motion.div>
        )}
      </div>
    </PageWrapper>
  )
}
