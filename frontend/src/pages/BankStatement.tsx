import { useState, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useDropzone, FileRejection } from 'react-dropzone'
import { Upload, FileText, CheckCircle, AlertCircle, X, RefreshCw, ArrowUpRight, ArrowDownLeft, CheckSquare, XSquare } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { PageWrapper } from '../components/layout/PageWrapper'
import { TableSkeleton, EmptyState } from '../components/ui/Skeleton'
import { formatINR, formatDate, cn } from '../lib/utils'
import client from '../api/client'
import toast from 'react-hot-toast'

interface FileItem {
  id: string; file: File; progress: number; status: 'idle' | 'uploading' | 'done' | 'error'
}

type StatementType = 'sales' | 'purchase' | 'all'

export default function BankStatement() {
  const qc = useQueryClient()
  const [activeTab, setActiveTab] = useState<'upload' | 'reconcile'>('upload')
  const [files, setFiles] = useState<FileItem[]>([])
  const [stmtType, setStmtType] = useState<StatementType>('sales')
  const [uploading, setUploading] = useState(false)
  const [filterStatus, setFilterStatus] = useState<'all' | 'matched' | 'unmatched' | 'partial'>('all')
  const [reconciling, setReconciling] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['bank-statements'],
    queryFn: () => client.get('/bank-statements').then(r => r.data.data),
  })

  const { data: reconData, isLoading: reconLoading, refetch: refetchRecon } = useQuery({
    queryKey: ['bank-statements', 'reconcile', filterStatus],
    queryFn: () => client.get('/bank-statements/reconcile', { params: { status: filterStatus !== 'all' ? filterStatus : undefined } }).then(r => r.data.data),
    enabled: activeTab === 'reconcile',
  })

  const onDrop = useCallback((accepted: File[], rejected: FileRejection[]) => {
    rejected.forEach(({ file, errors }) => toast.error(`${file.name} — ${errors[0]?.code === 'file-too-large' ? 'exceeds 10 MB' : 'unsupported type'}`))
    setFiles(prev => [...prev, ...accepted.map(f => ({ id: Math.random().toString(36).slice(2), file: f, progress: 0, status: 'idle' as const }))])
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'text/csv': ['.csv'],
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
    },
    maxSize: 20 * 1024 * 1024,
  })

  const processAll = async () => {
    setUploading(true)
    for (const item of files.filter(f => f.status === 'idle')) {
      setFiles(prev => prev.map(f => f.id === item.id ? { ...f, status: 'uploading' } : f))
      try {
        const fd = new FormData()
        fd.append('file', item.file)
        fd.append('statement_type', stmtType)
        await client.post('/bank-statements/upload', fd, {
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
    qc.invalidateQueries({ queryKey: ['bank-statements'] })
    toast.success('Statement uploaded — running reconciliation…')
    setActiveTab('reconcile')
  }

  const handleRunReconcile = async () => {
    setReconciling(true)
    try {
      await client.post('/bank-statements/reconcile/run')
      await refetchRecon()
      toast.success('Reconciliation complete!')
    } catch {
      toast.error('Reconciliation failed')
    } finally {
      setReconciling(false)
    }
  }

  const handleMarkMatched = async (id: number) => {
    try {
      await client.post(`/bank-statements/entries/${id}/match`)
      refetchRecon()
      toast.success('Marked as matched')
    } catch { toast.error('Failed') }
  }

  const statements = data?.data ?? []
  const reconEntries = reconData?.data ?? []
  const reconSummary = reconData?.summary ?? {}

  const TAB_STYLE = (t: string) => cn('px-4 py-2 text-sm font-medium border-b-2 transition-colors duration-150',
    activeTab === t ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-700')

  const FILTER_CHIPS = [
    { value: 'all', label: 'All' },
    { value: 'matched', label: '✓ Matched', cls: 'text-emerald-700' },
    { value: 'partial', label: '~ Partial', cls: 'text-amber-700' },
    { value: 'unmatched', label: '✗ Unmatched', cls: 'text-red-700' },
  ]

  return (
    <PageWrapper>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">Bank Statement</h1>
          <p className="text-sm text-slate-400 mt-0.5">Upload bank statements and cross-verify with sales receipts &amp; vendor payments.</p>
        </div>
        {activeTab === 'reconcile' && (
          <button onClick={handleRunReconcile} disabled={reconciling}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors">
            <RefreshCw size={14} className={reconciling ? 'animate-spin' : ''} />
            {reconciling ? 'Reconciling…' : 'Run Reconciliation'}
          </button>
        )}
      </div>

      {/* Reconciliation Summary */}
      {activeTab === 'reconcile' && (
        <div className="grid grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Total Transactions', value: reconSummary.total ?? 0, accent: '#2563EB' },
            { label: 'Matched', value: reconSummary.matched ?? 0, accent: '#16A34A' },
            { label: 'Partial', value: reconSummary.partial ?? 0, accent: '#D97706' },
            { label: 'Unmatched', value: reconSummary.unmatched ?? 0, accent: '#DC2626' },
          ].map(s => (
            <div key={s.label} className="bg-white border border-gray-200 rounded-lg shadow-sm px-4 py-3" style={{ borderLeft: `3px solid ${s.accent}` }}>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">{s.label}</p>
              <p className="text-2xl font-bold text-slate-800 font-mono">{s.value}</p>
            </div>
          ))}
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
        <div className="flex border-b border-gray-200 px-4">
          <button className={TAB_STYLE('upload')} onClick={() => setActiveTab('upload')}><Upload size={13} className="inline mr-1.5" />Upload Statement</button>
          <button className={TAB_STYLE('reconcile')} onClick={() => setActiveTab('reconcile')}><RefreshCw size={13} className="inline mr-1.5" />Reconciliation</button>
        </div>

        {/* UPLOAD TAB */}
        {activeTab === 'upload' && (
          <div className="p-6 max-w-xl">
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-2">Statement Type</label>
              <div className="flex gap-2">
                {[
                  { value: 'sales', label: '↗ Sales / Receivables', desc: 'Match with sales orders' },
                  { value: 'purchase', label: '↙ Purchase / Payables', desc: 'Match with vendor payments' },
                  { value: 'all', label: '↕ All Transactions', desc: 'Complete statement' },
                ].map(opt => (
                  <button key={opt.value} onClick={() => setStmtType(opt.value as StatementType)}
                    className={cn('flex-1 px-3 py-2.5 text-xs rounded border font-medium transition-colors text-left', stmtType === opt.value ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white border-gray-200 text-slate-600 hover:bg-gray-50')}>
                    <p className="font-semibold">{opt.label}</p>
                    <p className={cn('text-[11px] mt-0.5', stmtType === opt.value ? 'text-blue-500' : 'text-slate-400')}>{opt.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            <div {...getRootProps()} className={cn('border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all', isDragActive ? 'border-blue-400 bg-blue-50' : 'border-gray-300 hover:border-blue-400/60 hover:bg-gray-50')}>
              <input {...getInputProps()} />
              <div className="flex flex-col items-center gap-2">
                <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center"><Upload size={20} className="text-slate-400" /></div>
                <p className="text-sm font-medium text-slate-700">{isDragActive ? 'Drop to upload' : 'Drop bank statement here'}</p>
                <p className="text-xs text-slate-400">PDF, CSV, XLS, XLSX · max 20MB</p>
              </div>
            </div>

            <AnimatePresence>
              {files.length > 0 && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-3 space-y-2">
                  {files.map(item => (
                    <div key={item.id} className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-lg p-3">
                      <FileText size={14} className="text-blue-400 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-slate-700 truncate">{item.file.name}</p>
                        <div className="flex-1 h-1 bg-gray-200 rounded-full mt-1 overflow-hidden">
                          <div className={cn('h-full rounded-full', item.status === 'done' ? 'bg-emerald-400' : item.status === 'error' ? 'bg-red-400' : 'bg-blue-500')} style={{ width: `${item.progress}%` }} />
                        </div>
                      </div>
                      {item.status === 'done' && <CheckCircle size={14} className="text-emerald-500" />}
                      {item.status === 'error' && <AlertCircle size={14} className="text-red-400" />}
                      {item.status === 'idle' && <button onClick={() => setFiles(prev => prev.filter(f => f.id !== item.id))} className="text-slate-400 hover:text-slate-600"><X size={14} /></button>}
                    </div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>

            {files.some(f => f.status === 'idle') && (
              <button onClick={processAll} disabled={uploading} className="mt-4 w-full py-2.5 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
                {uploading ? 'Uploading…' : 'Upload & Start Reconciliation'}
              </button>
            )}

            {/* Previously uploaded statements */}
            {statements.length > 0 && (
              <div className="mt-6">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Previous Uploads</p>
                <div className="space-y-2">
                  {statements.slice(0, 5).map((s: any) => (
                    <div key={s.id} className="flex items-center justify-between text-sm py-2 border-b border-gray-100">
                      <span className="text-slate-700 truncate">{s.filename}</span>
                      <span className="text-xs text-slate-400 flex-shrink-0 ml-4">{formatDate(s.created_at)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* RECONCILE TAB */}
        {activeTab === 'reconcile' && (
          <div>
            {/* Filter chips */}
            <div className="px-5 py-3 border-b border-gray-100 flex gap-2">
              {FILTER_CHIPS.map(chip => (
                <button key={chip.value} onClick={() => setFilterStatus(chip.value as any)}
                  className={cn('text-xs px-3 py-1.5 rounded border font-medium transition-colors', filterStatus === chip.value ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-gray-200 text-slate-500 hover:bg-gray-50', (chip as any).cls && filterStatus === chip.value ? (chip as any).cls : '')}>
                  {chip.label}
                </button>
              ))}
            </div>

            {reconLoading ? (
              <div className="p-6"><TableSkeleton rows={6} cols={5} /></div>
            ) : reconEntries.length === 0 ? (
              <EmptyState icon="🔄" title="No reconciliation data" description="Upload a bank statement and run reconciliation to see matches" />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      {['Date', 'Description', 'Amount', 'Type', 'Match Status', 'Matched With', ''].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {reconEntries.map((entry: any) => (
                      <tr key={entry.id} className="border-b border-gray-100 hover:bg-blue-50/20">
                        <td className="px-4 py-3 text-sm text-slate-600 whitespace-nowrap">{entry.transaction_date ? formatDate(entry.transaction_date) : '—'}</td>
                        <td className="px-4 py-3 text-sm text-slate-700 max-w-xs truncate">{entry.description}</td>
                        <td className="px-4 py-3 text-sm font-mono font-semibold text-right whitespace-nowrap">
                          <span className={entry.credit_amount > 0 ? 'text-emerald-700' : 'text-red-600'}>
                            {entry.credit_amount > 0 ? <ArrowDownLeft size={12} className="inline mr-1" /> : <ArrowUpRight size={12} className="inline mr-1" />}
                            {formatINR(entry.credit_amount || entry.debit_amount)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={cn('text-xs px-2 py-0.5 rounded font-medium', entry.transaction_type === 'credit' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200')}>
                            {entry.transaction_type}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={cn('text-xs px-2 py-0.5 rounded font-medium border', entry.match_status === 'matched' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : entry.match_status === 'partial' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-red-50 text-red-600 border-red-200')}>
                            {entry.match_status ?? 'unmatched'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500">{entry.matched_reference ?? '—'}</td>
                        <td className="px-4 py-3">
                          {entry.match_status !== 'matched' && (
                            <button onClick={() => handleMarkMatched(entry.id)}
                              className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 px-2 py-1 rounded border border-blue-200 hover:bg-blue-50">
                              <CheckSquare size={11} /> Mark Matched
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </PageWrapper>
  )
}
