import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
import { cn } from '../../lib/utils'

interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
}

export const Modal = ({ open, onClose, title, children, size = 'md' }: ModalProps) => {
  const sizes = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' }

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 12 }}
            transition={{ type: 'spring', stiffness: 380, damping: 28 }}
            className={cn('relative w-full bg-bg-card border border-primary/10 rounded-2xl shadow-2xl z-10', sizes[size])}
          >
            {title && (
              <div className="flex items-center justify-between px-6 py-4 border-b border-border-default/50">
                <h2 className="font-display font-700 text-lg text-gray-100">{title}</h2>
                <button onClick={onClose} className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors">
                  <X size={18} />
                </button>
              </div>
            )}
            <div className="p-6">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}

interface DrawerProps {
  open: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  side?: 'left' | 'right'
  width?: string
}

export const Drawer = ({ open, onClose, title, children, side = 'right', width = '400px' }: DrawerProps) => (
  <AnimatePresence>
    {open && (
      <div className="fixed inset-0 z-50">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          onClick={onClose}
        />
        <motion.div
          initial={{ x: side === 'right' ? '100%' : '-100%' }}
          animate={{ x: 0 }}
          exit={{ x: side === 'right' ? '100%' : '-100%' }}
          transition={{ type: 'spring', stiffness: 350, damping: 35 }}
          style={{ width }}
          className={cn(
            'absolute top-0 bottom-0 bg-bg-surface border-l border-border-default overflow-y-auto',
            side === 'right' ? 'right-0' : 'left-0'
          )}
        >
          {title && (
            <div className="flex items-center justify-between px-6 py-4 border-b border-border-default/50 sticky top-0 bg-bg-surface z-10">
              <h2 className="font-display font-semibold text-base text-gray-100">{title}</h2>
              <button onClick={onClose} className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors">
                <X size={18} />
              </button>
            </div>
          )}
          <div className="p-6">{children}</div>
        </motion.div>
      </div>
    )}
  </AnimatePresence>
)
