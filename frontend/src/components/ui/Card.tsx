import { motion } from 'framer-motion'
import { cn } from '../../lib/utils'

interface CardProps {
  children: React.ReactNode
  className?: string
  hover?: boolean
  glow?: boolean
  onClick?: () => void
}

export const Card = ({ children, className, hover, glow, onClick }: CardProps) => (
  <motion.div
    onClick={onClick}
    whileHover={hover ? { y: -2, boxShadow: '0 8px 32px rgba(99,102,241,0.2)' } : undefined}
    transition={{ type: 'spring', stiffness: 300, damping: 25 }}
    className={cn(
      'bg-bg-card/80 backdrop-blur-xl border border-primary/10 rounded-2xl',
      glow && 'shadow-glow',
      onClick && 'cursor-pointer',
      className
    )}
  >
    {children}
  </motion.div>
)

export const CardHeader = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className={cn('px-6 py-4 border-b border-border-default/50 flex items-center justify-between', className)}>
    {children}
  </div>
)

export const CardBody = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className={cn('p-6', className)}>{children}</div>
)
