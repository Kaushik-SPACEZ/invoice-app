import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle, AlertCircle, ArrowLeft } from 'lucide-react'
import { useInvoiceStatus } from '../hooks/useInvoiceStatus'
import { Button } from '../components/ui/Button'

const STAGES = [
  { key: 'uploading',        label: 'Uploading' },
  { key: 'ocr_extraction',   label: 'Reading Invoice' },
  { key: 'llm_extraction',   label: 'Extracting Data' },
  { key: 'validation',       label: 'Checking GST' },
  { key: 'saving_items',     label: 'Updating Inventory' },
  { key: 'completed',        label: 'Done' },
]

const STAGE_INDEX: Record<string, number> = Object.fromEntries(STAGES.map((s, i) => [s.key, i]))

export default function InvoiceProcessing() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const status = useInvoiceStatus(id ? parseInt(id) : null)

  const currentIdx = STAGE_INDEX[status?.stage ?? 'uploading'] ?? 0
  const progress = status?.progress ?? 5
  const isError = status?.status === 'error'
  const isDone = status?.status === 'review'
  const circumference = 2 * Math.PI * 50

  return (
    <div className="min-h-screen bg-bg-base flex flex-col items-center justify-center relative overflow-hidden">
      {/* Ambient glows */}
      <div className="absolute top-1/4 left-1/3 w-96 h-96 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/3 right-1/4 w-64 h-64 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 flex flex-col items-center gap-10 px-6 max-w-lg w-full">

        {/* Circular progress ring */}
        <div className="relative w-36 h-36">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
            {/* Track */}
            <circle cx="60" cy="60" r="50" fill="none" stroke="rgba(99,102,241,0.12)" strokeWidth="8" />
            {/* Progress arc */}
            <motion.circle
              cx="60" cy="60" r="50"
              fill="none"
              stroke={isError ? '#EF4444' : isDone ? '#10B981' : '#6366F1'}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={circumference}
              animate={{ strokeDashoffset: circumference - (circumference * progress) / 100 }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
            />
          </svg>
          {/* Center content */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            {isError ? (
              <AlertCircle size={28} className="text-danger" />
            ) : isDone ? (
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 400, damping: 20 }}>
                <CheckCircle size={28} className="text-success" />
              </motion.div>
            ) : (
              <>
                <motion.span
                  key={progress}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="font-mono font-bold text-2xl text-white"
                >
                  {progress}%
                </motion.span>
              </>
            )}
          </div>
        </div>

        {/* Stage label */}
        <div className="text-center">
          <AnimatePresence mode="wait">
            <motion.h2
              key={status?.stage ?? 'waiting'}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
              className={`font-display font-bold text-2xl mb-2 ${isError ? 'text-danger' : 'text-white'}`}
            >
              {isError
                ? 'Processing Failed'
                : isDone
                ? 'Ready for Review!'
                : (status?.label ?? STAGES[currentIdx]?.label ?? 'Processing…')}
            </motion.h2>
          </AnimatePresence>
          <p className="text-sm text-gray-400">
            {isError
              ? 'Something went wrong. Please try uploading again.'
              : isDone
              ? 'Redirecting to review screen…'
              : 'AI is analyzing your invoice — this takes about 10–30 seconds'}
          </p>
        </div>

        {/* Step pill row */}
        <div className="flex flex-wrap justify-center gap-2 w-full">
          {STAGES.map((stage, i) => {
            const done   = i < currentIdx || isDone
            const active = i === currentIdx && !isDone && !isError
            const error  = isError && i === currentIdx

            return (
              <motion.div
                key={stage.key}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.06, type: 'spring', stiffness: 400, damping: 20 }}
              >
                <motion.div
                  animate={active
                    ? { boxShadow: ['0 0 0 0 rgba(99,102,241,0.5)', '0 0 0 8px rgba(99,102,241,0)', '0 0 0 0 rgba(99,102,241,0.5)'] }
                    : {}}
                  transition={active ? { repeat: Infinity, duration: 1.5 } : {}}
                  className={`
                    flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium
                    transition-all duration-300
                    ${done  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : ''}
                    ${active ? 'bg-primary/20 text-primary-light border border-primary/40' : ''}
                    ${error  ? 'bg-red-500/20 text-red-400 border border-red-500/30' : ''}
                    ${!done && !active && !error ? 'bg-bg-card text-gray-500 border border-border-default' : ''}
                  `}
                >
                  {done && <CheckCircle size={11} />}
                  {error && <AlertCircle size={11} />}
                  {stage.label}
                </motion.div>
              </motion.div>
            )
          })}
        </div>

        {/* Error action */}
        {isError && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <Button variant="secondary" onClick={() => navigate('/invoices/upload')}>
              <ArrowLeft size={14} /> Try Again
            </Button>
          </motion.div>
        )}
      </div>
    </div>
  )
}
