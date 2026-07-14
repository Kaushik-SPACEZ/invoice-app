import { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { CheckCircle, AlertCircle, ArrowRight, FileText, RefreshCw } from 'lucide-react'
import { invoicesApi } from '../api/invoices'

interface InvoiceProgress {
  id: number
  filename: string
  status: 'pending' | 'processing' | 'review' | 'approved' | 'error'
  stage: string
  progress: number
  label: string | null
  error?: string
  retrying?: boolean
}

export default function BulkProcessing() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const idsParam = searchParams.get('ids') ?? ''
  const filenamesParam = searchParams.get('names') ?? ''

  const ids = idsParam.split(',').map(Number).filter(Boolean)
  // URLSearchParams already decodes — do NOT call decodeURIComponent again
  const filenames = filenamesParam.split('||')

  const [invoices, setInvoices] = useState<InvoiceProgress[]>(() =>
    ids.map((id, i) => ({
      id,
      filename: filenames[i] || `Invoice #${id}`,
      status: 'pending',
      stage: 'pending',
      progress: 0,
      label: 'Queued…',
    }))
  )

  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const poll = async () => {
    const updates = await Promise.all(
      ids.map(async (id) => {
        try {
          const res = await invoicesApi.getStatus(id)
          const d = res.data.data
          return { id, status: d.status as any, stage: d.stage ?? d.status, progress: d.progress ?? 0, label: d.label ?? null, error: d.error_message ?? undefined }
        } catch { return null }
      })
    )

    setInvoices(prev => prev.map((inv, i) => {
      const u = updates[i]
      if (!u || inv.retrying) return inv
      return { ...inv, ...u }
    }))

    const allDone = updates.every(u => u && ['review', 'approved', 'error'].includes(u.status))
    if (allDone && pollingRef.current) {
      clearInterval(pollingRef.current)
      pollingRef.current = null
    }
  }

  useEffect(() => {
    if (ids.length === 0) { navigate('/invoices'); return }
    poll()
    pollingRef.current = setInterval(poll, 2500)
    return () => { if (pollingRef.current) clearInterval(pollingRef.current) }
  }, [idsParam])

  const handleRetry = async (inv: InvoiceProgress) => {
    // Get the stored file object
    const w = window as any
    const stored = w.__bulkFileObjects?.[inv.id]

    if (!stored?.file) {
      // No file in memory (page was refreshed) — navigate to upload
      navigate('/invoices/upload')
      return
    }

    setInvoices(prev => prev.map(i => i.id === inv.id ? { ...i, retrying: true, status: 'processing', progress: 0, label: 'Retrying…' } : i))

    try {
      // Delete the failed invoice
      try { await invoicesApi.delete(inv.id) } catch {}

      // Re-upload the same file
      const { data } = await invoicesApi.upload(
        stored.file,
        stored.marketplace ?? 'other',
        (pct) => {
          setInvoices(prev => prev.map(i => i.id === inv.id ? { ...i, progress: pct } : i))
        }
      )

      const newId = data.data.invoice_id

      // Store new file mapping
      if (w.__bulkFileObjects) {
        w.__bulkFileObjects[newId] = stored
        delete w.__bulkFileObjects[inv.id]
      }

      // Update the invoice entry with new ID and restart polling
      setInvoices(prev => prev.map(i => i.id === inv.id
        ? { ...i, id: newId, retrying: false, status: 'pending', progress: 0, label: 'Queued…' }
        : i
      ))

      // Restart polling to pick up new ID
      if (pollingRef.current) clearInterval(pollingRef.current)
      pollingRef.current = setInterval(poll, 2500)

    } catch {
      setInvoices(prev => prev.map(i => i.id === inv.id ? { ...i, retrying: false, status: 'error', label: 'Retry failed' } : i))
    }
  }

  const allInvoices = invoices
  const readyCount   = allInvoices.filter(i => i.status === 'review').length
  const doneCount    = allInvoices.filter(i => ['review', 'approved'].includes(i.status)).length
  const errorCount   = allInvoices.filter(i => i.status === 'error').length
  const pendingCount = allInvoices.filter(i => ['pending', 'processing'].includes(i.status) || i.retrying).length

  const statusIcon = (inv: InvoiceProgress) => {
    if (inv.status === 'review')   return <CheckCircle size={16} className="text-emerald-500 flex-shrink-0" />
    if (inv.status === 'approved') return <CheckCircle size={16} className="text-blue-500 flex-shrink-0" />
    if (inv.status === 'error' && !inv.retrying) return <AlertCircle size={16} className="text-red-500 flex-shrink-0" />
    return (
      <div className="w-4 h-4 flex-shrink-0 flex items-center justify-center">
        <div className="w-3.5 h-3.5 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
      </div>
    )
  }

  const statusText = (inv: InvoiceProgress) => {
    if (inv.retrying)               return 'Retrying upload…'
    if (inv.status === 'review')    return 'Ready to Review'
    if (inv.status === 'approved')  return 'Approved'
    if (inv.status === 'error')     return 'Extraction failed'
    if (inv.status === 'processing') return inv.label ?? 'Processing…'
    return 'Queued…'
  }

  const statusColor = (inv: InvoiceProgress) => {
    if (inv.status === 'review')    return 'text-emerald-600'
    if (inv.status === 'approved')  return 'text-blue-600'
    if (inv.status === 'error')     return 'text-red-600'
    return 'text-slate-500'
  }

  return (
    <div className="min-h-screen bg-[#F5F7FA] flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center mx-auto mb-4">
            <FileText size={22} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800">
            Processing {ids.length} Invoice{ids.length > 1 ? 's' : ''}
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            {pendingCount > 0
              ? `AI is extracting data — ${pendingCount} still processing…`
              : errorCount > 0
              ? `${readyCount} ready · ${errorCount} failed`
              : 'All done!'}
          </p>
        </div>

        {/* Overall progress bar */}
        <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4 shadow-sm">
          <div className="flex justify-between text-xs text-slate-500 mb-2">
            <span>{doneCount} of {ids.length} extracted</span>
            {errorCount > 0 && <span className="text-red-500">{errorCount} failed</span>}
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-blue-500 rounded-full"
              animate={{ width: `${(doneCount / ids.length) * 100}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
        </div>

        {/* Individual invoice cards */}
        <div className="space-y-3 mb-6">
          {allInvoices.map((inv, i) => (
            <motion.div
              key={inv.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden"
            >
              <div className="flex items-center gap-3 p-4">
                {statusIcon(inv)}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{inv.filename}</p>
                  <p className={`text-xs mt-0.5 ${statusColor(inv)}`}>{statusText(inv)}</p>
                </div>

                {inv.status === 'review' && (
                  <button
                    onClick={() => navigate(`/invoices/${inv.id}/review`)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-md hover:bg-blue-700 transition-colors flex-shrink-0"
                  >
                    Review <ArrowRight size={12} />
                  </button>
                )}

                {inv.status === 'error' && !inv.retrying && (
                  <button
                    onClick={() => handleRetry(inv)}
                    className="flex items-center gap-1.5 px-3 py-1.5 border border-red-200 text-red-600 text-xs font-medium rounded-md hover:bg-red-50 transition-colors flex-shrink-0"
                  >
                    <RefreshCw size={11} /> Retry
                  </button>
                )}

                {(inv.status === 'processing' || inv.retrying) && (
                  <div className="text-xs text-slate-400 font-mono flex-shrink-0">{inv.progress}%</div>
                )}
              </div>

              {/* Per-item progress bar */}
              {(inv.status === 'processing' || inv.retrying) && (
                <div className="h-0.5 bg-gray-100">
                  <motion.div
                    className="h-full bg-blue-400"
                    animate={{ width: `${inv.progress}%` }}
                    transition={{ duration: 0.5 }}
                  />
                </div>
              )}
            </motion.div>
          ))}
        </div>

        {/* Bottom actions */}
        <div className="flex gap-3">
          {readyCount > 0 && (
            <button
              onClick={() => {
                const first = allInvoices.find(i => i.status === 'review')
                if (first) navigate(`/invoices/${first.id}/review`)
              }}
              className="flex-1 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
            >
              Review Next <ArrowRight size={14} />
            </button>
          )}
          <button
            onClick={() => navigate('/invoices')}
            className="flex-1 py-2.5 bg-white border border-gray-300 text-slate-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
          >
            View All Invoices
          </button>
        </div>
      </div>
    </div>
  )
}
