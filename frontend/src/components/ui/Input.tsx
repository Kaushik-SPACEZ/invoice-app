import { forwardRef } from 'react'
import { cn } from '../../lib/utils'

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, leftIcon, rightIcon, className, disabled, ...props }, ref) => (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-slate-700 mb-1.5">
          {label}
        </label>
      )}
      <div className="relative">
        {leftIcon && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
            {leftIcon}
          </span>
        )}
        <input
          ref={ref}
          disabled={disabled}
          className={cn(
            'w-full bg-white border border-gray-300 rounded-md px-3.5 py-2.5 text-sm text-slate-800',
            'placeholder:text-gray-400',
            'focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20',
            'transition-colors duration-150',
            disabled && 'bg-gray-50 cursor-not-allowed opacity-75',
            error && 'border-red-400 focus:border-red-400 focus:ring-red-400/20',
            leftIcon && 'pl-9',
            rightIcon && 'pr-9',
            className
          )}
          {...props}
        />
        {rightIcon && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
            {rightIcon}
          </span>
        )}
      </div>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      {hint && !error && <p className="mt-1 text-xs text-gray-400">{hint}</p>}
    </div>
  )
)
Input.displayName = 'Input'

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
  hint?: string
  options: { value: string; label: string }[]
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, hint, options, className, disabled, ...props }, ref) => (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-slate-700 mb-1.5">
          {label}
        </label>
      )}
      <div className="relative">
        <select
          ref={ref}
          disabled={disabled}
          className={cn(
            'w-full bg-white border border-gray-300 rounded-md px-3.5 py-2.5 pr-9 text-sm text-slate-800',
            'focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20',
            'transition-colors duration-150 appearance-none cursor-pointer',
            disabled && 'bg-gray-50 cursor-not-allowed opacity-75',
            error && 'border-red-400 focus:border-red-400 focus:ring-red-400/20',
            className
          )}
          {...props}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
      </div>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      {hint && !error && <p className="mt-1 text-xs text-gray-400">{hint}</p>}
    </div>
  )
)
Select.displayName = 'Select'
