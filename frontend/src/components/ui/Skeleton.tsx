import { cn } from '../../lib/utils'

export const Skeleton = ({ className }: { className?: string }) => (
  <div className={cn('shimmer-bg rounded-lg', className)} />
)

export const TableSkeleton = ({ rows = 5, cols = 5 }: { rows?: number; cols?: number }) => (
  <div className="space-y-3">
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="flex gap-4">
        {Array.from({ length: cols }).map((_, j) => (
          <Skeleton key={j} className="h-8 flex-1" />
        ))}
      </div>
    ))}
  </div>
)

export const CardSkeleton = () => (
  <div className="bg-bg-card/80 border border-primary/10 rounded-2xl p-6 space-y-3">
    <Skeleton className="h-4 w-24" />
    <Skeleton className="h-8 w-32" />
    <Skeleton className="h-3 w-20" />
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
    <div className="text-5xl mb-4">{icon}</div>
    <h3 className="font-display font-semibold text-lg text-gray-200 mb-2">{title}</h3>
    {description && <p className="text-sm text-gray-400 max-w-xs mb-6">{description}</p>}
    {action}
  </div>
)
