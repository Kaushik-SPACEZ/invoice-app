import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDropzone, FileRejection } from 'react-dropzone'
import { motion, AnimatePresence } from 'framer-motion'
import { Upload, X, FileText, Image, CheckCircle, AlertCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { invoicesApi } from '../api/invoices'
import { PageWrapper } from '../components/layout/PageWrapper'
import { Button } from '../components/ui/Button'
import { Select } from '../components/ui/Input'
import { cn } from '../lib/utils'

interface FileItem {
  id: string
  file: File
  progress: number
  status: 'idle' | 'uploading' | 'done' | 'error'
  invoiceId?: number
  error?: string
}

const MARKETPLACE_OPTIONS = [
  { value: '', label: 'Auto-detect marketplace' },
  { value: 'amazon', label: 'Amazon' },
  { value: 'flipkart', label: 'Flipkart' },
  { value: 'meesho', label: 'Meesho' },
  { value: 'other', label: 'Other' },
]

export default function UploadInvoice() {
  const [files, setFiles] = useState<FileItem[]>([])
  const [marketplace, setMarketplace] = useState('')
  const [uploading, setUploading] = useState(false)
  const navigate = useNavigate()

  const onDrop = useCallback((accepted: File[], rejected: FileRejection[]) => {
    // Show error for rejected files (too large, wrong type)
    rejected.forEach(({ file, errors }) => {
      const reason = errors[0]?.code === 'file-too-large' ? 'exceeds 10 MB limit' : 'unsupported file type'
      toast.error(`${file.name} — ${reason}`)
    })
    const newFiles: FileItem[] = accepted.map((f) => ({
      id: Math.random().toString(36).slice(2),
      file: f,
      progress: 0,
      status: 'idle',
    }))
    setFiles((prev) => [...prev, ...newFiles])
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
    // Track results locally to avoid stale-closure issue with `files` state
    let firstInvoiceId: number | undefined

    for (const item of pending) {
      setFiles((prev) => prev.map((f) => f.id === item.id ? { ...f, status: 'uploading' } : f))
      try {
        const { data } = await invoicesApi.upload(
          item.file,
          marketplace || 'other', // send 'other' when auto-detect (backend handles it)
          (pct) => {
            // Only update if total is known — avoids 100% jump on indeterminate upload
            if (pct <= 100) setFiles((prev) => prev.map((f) => f.id === item.id ? { ...f, progress: pct } : f))
          }
        )
        const invoiceId = data.data.invoice_id
        setFiles((prev) => prev.map((f) => f.id === item.id ? { ...f, status: 'done', progress: 100, invoiceId } : f))
        if (!firstInvoiceId) firstInvoiceId = invoiceId
      } catch {
        setFiles((prev) => prev.map((f) => f.id === item.id ? { ...f, status: 'error', error: 'Upload failed' } : f))
        toast.error(`Failed to upload ${item.file.name}`)
      }
    }
    setUploading(false)

    // Navigate to processing page for the first successfully uploaded invoice
    if (firstInvoiceId) {
      setTimeout(() => navigate(`/invoices/${firstInvoiceId}/processing`), 600)
    }
  }

  const hasIdle = files.some((f) => f.status === 'idle')

  return (
    <PageWrapper>
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <h1 className="font-display font-bold text-2xl mb-1" style={{ color: 'var(--text-primary)' }}>Upload Invoices</h1>
          <p className="text-sm text-gray-400">PDF, JPG, or PNG — up to 10MB each. AI will extract all data automatically.</p>
        </div>

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
            'border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all duration-200',
            isDragActive
              ? 'border-primary bg-primary/5'
              : 'border-border-default hover:border-primary/50 hover:bg-primary/3'
          )}
        >
          <input {...getInputProps()} />
          <motion.div
            animate={isDragActive ? { y: -4 } : { y: 0 }}
            className="flex flex-col items-center gap-3"
          >
            <div className={cn('w-14 h-14 rounded-2xl flex items-center justify-center', isDragActive ? 'bg-primary/20 text-primary-light' : 'bg-bg-elevated text-gray-400')}>
              <Upload size={24} />
            </div>
            <div>
              <p className="font-semibold text-gray-200">{isDragActive ? 'Drop to upload' : 'Drop invoices here'}</p>
              <p className="text-sm text-gray-400 mt-1">or <span className="text-primary-light cursor-pointer hover:underline">click to browse</span></p>
            </div>
            <div className="flex gap-2">
              {['PDF', 'JPG', 'PNG'].map((f) => (
                <span key={f} className="text-xs px-2 py-0.5 rounded-full bg-bg-elevated text-gray-400 border border-border-default">{f}</span>
              ))}
            </div>
          </motion.div>
        </div>

        {/* File Queue */}
        <AnimatePresence>
          {files.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-4 space-y-2"
            >
              {files.map((item) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  className="flex items-center gap-3 bg-bg-card border border-border-default rounded-xl p-3"
                >
                  <div className="w-8 h-8 rounded-lg bg-bg-elevated flex items-center justify-center flex-shrink-0">
                    {item.file.type === 'application/pdf' ? <FileText size={15} className="text-red-400" /> : <Image size={15} className="text-blue-400" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-200 truncate">{item.file.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex-1 h-1 bg-bg-elevated rounded-full overflow-hidden">
                        <motion.div
                          animate={{ width: `${item.progress}%` }}
                          className={cn('h-full rounded-full', item.status === 'done' ? 'bg-emerald-400' : item.status === 'error' ? 'bg-red-400' : 'bg-primary')}
                        />
                      </div>
                      <span className="text-xs text-gray-500 font-mono">{(item.file.size / 1024).toFixed(0)}KB</span>
                    </div>
                  </div>
                  {item.status === 'done' && <CheckCircle size={16} className="text-emerald-400 flex-shrink-0" />}
                  {item.status === 'error' && <AlertCircle size={16} className="text-red-400 flex-shrink-0" />}
                  {item.status === 'idle' && (
                    <button onClick={() => removeFile(item.id)} className="text-gray-500 hover:text-gray-300 flex-shrink-0">
                      <X size={15} />
                    </button>
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
              {uploading ? 'Uploading…' : `Process ${files.filter((f) => f.status === 'idle').length} Invoice${files.filter((f) => f.status === 'idle').length > 1 ? 's' : ''}`}
            </Button>
          </motion.div>
        )}
      </div>
    </PageWrapper>
  )
}
