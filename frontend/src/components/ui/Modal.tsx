import { useEffect } from 'react'
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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="absolute inset-0 bg-black/40"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className={cn(
              'relative w-full bg-white border border-gray-200 rounded-xl z-10',
              'shadow-[0_20px_60px_rgba(0,0,0,0.2)]',
              sizes[size]
            )}
          >
            {title && (
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                <h2 className="text-base font-semibold text-slate-800">{title}</h2>
                <button
                  onClick={onClose}
                  className="p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors duration-150"
                >
                  <X size={18} />
                </button>
              </div>
            )}
            <div className="p-5">{children}</div>
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

export const Drawer = ({ open, onClose, title, children, side = 'right', width = '400px' }: DrawerProps) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="absolute inset-0 bg-black/40"
            onClick={onClose}
          />
          <motion.div
            initial={{ x: side === 'right' ? '100%' : '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: side === 'right' ? '100%' : '-100%' }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            style={{ width }}
            className={cn(
              'absolute top-0 bottom-0 bg-white border-gray-200 overflow-y-auto',
              side === 'right' ? 'right-0 border-l' : 'left-0 border-r'
            )}
          >
            {title && (
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
                <h2 className="text-base font-semibold text-slate-800">{title}</h2>
                <button
                  onClick={onClose}
                  className="p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors duration-150"
                >
                  <X size={18} />
                </button>
              </div>
            )}
            <div className="p-5">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
