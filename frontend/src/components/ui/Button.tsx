import { ButtonHTMLAttributes } from 'react'
import { cn } from '../../lib/utils'
import { Loader2 } from 'lucide-react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
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
  const base =
    'inline-flex items-center justify-center gap-2 font-medium rounded-md transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:ring-offset-1 select-none'

  const variants = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700',
    secondary: 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50',
    ghost: 'text-gray-600 hover:text-gray-900 hover:bg-gray-100 border border-transparent',
    danger: 'bg-red-600 text-white hover:bg-red-700',
    success: 'bg-emerald-600 text-white hover:bg-emerald-700',
  }

  const sizes = {
    sm: 'text-xs px-3 py-1.5',
    md: 'text-sm px-4 py-2',
    lg: 'text-sm px-6 py-2.5',
  }

  return (
    <button
      disabled={disabled || loading}
      className={cn(
        base,
        variants[variant],
        sizes[size],
        fullWidth && 'w-full',
        (disabled || loading) && 'opacity-50 cursor-not-allowed',
        className
      )}
      {...props}
    >
      {loading && <Loader2 size={14} className="animate-spin" />}
      {children}
    </button>
  )
}
