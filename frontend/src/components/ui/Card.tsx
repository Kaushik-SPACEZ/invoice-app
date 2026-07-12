import { cn } from '../../lib/utils'

interface CardProps {
  children: React.ReactNode
  className?: string
  hover?: boolean
  onClick?: () => void
}

export const Card = ({ children, className, hover, onClick }: CardProps) => (
  <div
    onClick={onClick}
    className={cn(
      'bg-white border border-gray-200 rounded-lg shadow-sm',
      hover && 'hover:shadow-md transition-shadow duration-150',
      onClick && 'cursor-pointer hover:bg-blue-50/30 transition-colors duration-150',
      className
    )}
  >
    {children}
  </div>
)

export const CardHeader = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className={cn('px-5 py-3 border-b border-gray-100 flex items-center justify-between', className)}>
    {children}
  </div>
)

export const CardBody = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className={cn('p-5', className)}>{children}</div>
)
