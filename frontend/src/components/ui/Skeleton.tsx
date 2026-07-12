import { cn } from '../../lib/utils'

export const Skeleton = ({ className }: { className?: string }) => (
  <div className={cn('animate-pulse bg-gray-200 rounded', className)} />
)

export const TableSkeleton = ({ rows = 5, cols = 5 }: { rows?: number; cols?: number }) => (
  <div className="space-y-0">
    {/* Header row */}
    <div className="flex gap-3 px-4 py-3 bg-gray-50 border-b border-gray-200">
      {Array.from({ length: cols }).map((_, j) => (
        <Skeleton key={j} className="h-3 flex-1" />
      ))}
    </div>
    {/* Data rows */}
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="flex gap-3 px-4 py-3 border-b border-gray-100 bg-white">
        {Array.from({ length: cols }).map((_, j) => (
          <Skeleton key={j} className="h-4 flex-1" />
        ))}
      </div>
    ))}
  </div>
)

export const CardSkeleton = () => (
  <div className="bg-white border border-gray-200 rounded-lg p-5 space-y-3 shadow-sm">
    <Skeleton className="h-3 w-20" />
    <Skeleton className="h-7 w-28" />
    <Skeleton className="h-3 w-16" />
  </div>
)

interface EmptyStateProps {
  icon?: string
  title: string
  description?: string
  action?: React.ReactNode
}

export const EmptyState = ({ icon = '📄', title, description, action }: EmptyStateProps) => (
  <div className="flex flex-col items-center justify-center py-16 text-center">
    <div className="text-4xl mb-3">{icon}</div>
    <h3 className="text-base font-semibold text-slate-700 mb-1">{title}</h3>
    {description && (
      <p className="text-sm text-slate-400 max-w-xs mb-6">{description}</p>
    )}
    {action}
  </div>
)
