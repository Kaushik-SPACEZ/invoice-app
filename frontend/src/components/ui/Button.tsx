import { motion, HTMLMotionProps } from 'framer-motion'
import { cn } from '../../lib/utils'
import { Loader2 } from 'lucide-react'

interface ButtonProps extends Omit<HTMLMotionProps<'button'>, 'children'> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'success'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  children: React.ReactNode
  fullWidth?: boolean
}

export const Button = ({
  variant = 'primary',
  size = 'md',
  loading,
  children,
  fullWidth,
  className,
  disabled,
  ...props
}: ButtonProps) => {
  const base = 'inline-flex items-center justify-center gap-2 font-semibold rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary/40 select-none'

  const variants = {
    primary: 'bg-gradient-primary text-white shadow-glow-sm hover:opacity-90',
    secondary: 'border border-primary text-primary hover:bg-primary/10',
    ghost: 'text-gray-300 hover:text-white hover:bg-white/5',
    danger: 'bg-danger text-white hover:bg-red-600',
    success: 'bg-gradient-success text-white',
  }

  const sizes = {
    sm: 'text-xs px-3 py-1.5',
    md: 'text-sm px-5 py-2.5',
    lg: 'text-base px-7 py-3',
  }

  return (
    <motion.button
      whileHover={disabled || loading ? {} : { scale: 1.02, boxShadow: '0 8px 25px rgba(99,102,241,0.4)' }}
      whileTap={disabled || loading ? {} : { scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 400, damping: 20 }}
      disabled={disabled || loading}
      className={cn(base, variants[variant], sizes[size], fullWidth && 'w-full', (disabled || loading) && 'opacity-60 cursor-not-allowed', className)}
      {...props}
    >
      {loading && <Loader2 size={14} className="animate-spin" />}
      {children}
    </motion.button>
  )
}
