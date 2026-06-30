import { cn } from '../../lib/utils'
import { MARKETPLACE_COLORS, MARKETPLACE_LABELS, getConfidenceColor } from '../../lib/utils'
import type { NotificationType } from '../../types'

interface BadgeProps {
  children: React.ReactNode
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'muted'
  size?: 'sm' | 'md'
  dot?: boolean
}

export const Badge = ({ children, variant = 'default', size = 'sm', dot }: BadgeProps) => {
  const variants = {
    default: 'bg-primary/15 text-primary-light border-primary/20',
    success: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
    warning: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
    danger: 'bg-red-500/15 text-red-400 border-red-500/20',
    info: 'bg-blue-500/15 text-blue-400 border-blue-500/20',
    muted: 'bg-gray-500/15 text-gray-400 border-gray-500/20',
  }
  const sizes = { sm: 'text-xs px-2 py-0.5', md: 'text-sm px-2.5 py-1' }

  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full border font-medium', variants[variant], sizes[size])}>
      {dot && <span className="w-1.5 h-1.5 rounded-full bg-current" />}
      {children}
    </span>
  )
}

export const MarketplaceBadge = ({ marketplace }: { marketplace: string }) => (
  <span
    className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border"
    style={{
      color: MARKETPLACE_COLORS[marketplace] ?? '#6B7280',
      backgroundColor: `${MARKETPLACE_COLORS[marketplace] ?? '#6B7280'}18`,
      borderColor: `${MARKETPLACE_COLORS[marketplace] ?? '#6B7280'}30`,
    }}
  >
    {MARKETPLACE_LABELS[marketplace] ?? marketplace}
  </span>
)

export const StatusBadge = ({ status }: { status: string }) => {
  const map: Record<string, BadgeProps['variant']> = {
    approved: 'success',
    review: 'info',
    processing: 'default',
    pending: 'warning',
    error: 'danger',
    rejected: 'danger',
    duplicate: 'muted',
    completed: 'success',
    returned: 'warning',
    cancelled: 'muted',
  }
  return <Badge variant={map[status] ?? 'muted'} dot>{status.charAt(0).toUpperCase() + status.slice(1)}</Badge>
}

export const ConfidenceBadge = ({ score }: { score: number }) => {
  const { bg, text } = getConfidenceColor(score)
  return (
    <span className={cn('inline-flex items-center text-xs font-mono font-medium px-2 py-0.5 rounded-full border', bg, text, 'border-current/30')}>
      {score.toFixed(0)}%
    </span>
  )
}

export const NotificationIcon = ({ type }: { type: NotificationType }) => {
  const map: Record<NotificationType, { icon: string; color: string }> = {
    low_stock: { icon: '📦', color: 'text-amber-400 bg-amber-500/10' },
    duplicate_invoice: { icon: '📋', color: 'text-blue-400 bg-blue-500/10' },
    gst_mismatch: { icon: '⚠️', color: 'text-red-400 bg-red-500/10' },
    invoice_error: { icon: '❌', color: 'text-red-400 bg-red-500/10' },
    ai_low_confidence: { icon: '🤖', color: 'text-purple-400 bg-purple-500/10' },
    new_sales_record: { icon: '🎉', color: 'text-emerald-400 bg-emerald-500/10' },
    inventory_warning: { icon: '⚠️', color: 'text-amber-400 bg-amber-500/10' },
    gst_due: { icon: '📅', color: 'text-red-400 bg-red-500/10' },
  }
  const { icon, color } = map[type] ?? { icon: '🔔', color: 'text-gray-400 bg-gray-500/10' }
  return <span className={cn('w-8 h-8 rounded-full flex items-center justify-center text-sm flex-shrink-0', color)}>{icon}</span>
}
