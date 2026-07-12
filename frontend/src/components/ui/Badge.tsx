import { Package, Copy, AlertTriangle, XCircle, Bot, TrendingUp, AlertCircle, Calendar } from 'lucide-react'
import { cn } from '../../lib/utils'
import { MARKETPLACE_COLORS, MARKETPLACE_LABELS, getConfidenceColor } from '../../lib/utils'
import type { NotificationType } from '../../types'

export { getConfidenceColor }

interface BadgeProps {
  children: React.ReactNode
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'muted'
  size?: 'sm' | 'md'
  dot?: boolean
}

export const Badge = ({ children, variant = 'default', size = 'sm', dot }: BadgeProps) => {
  const variants = {
    default: 'bg-blue-50 text-blue-700 border-blue-200',
    success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    warning: 'bg-amber-50 text-amber-700 border-amber-200',
    danger: 'bg-red-50 text-red-700 border-red-200',
    info: 'bg-sky-50 text-sky-700 border-sky-200',
    muted: 'bg-gray-100 text-gray-600 border-gray-200',
  }
  const sizes = { sm: 'text-xs px-2 py-0.5', md: 'text-sm px-2.5 py-1' }

  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded border font-medium', variants[variant], sizes[size])}>
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
      backgroundColor: `${MARKETPLACE_COLORS[marketplace] ?? '#6B7280'}14`,
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
  return (
    <Badge variant={map[status] ?? 'muted'} dot>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </Badge>
  )
}

interface NotificationIconEntry {
  icon: React.ElementType
  iconClass: string
  wrapperClass: string
}

export const NotificationIcon = ({ type }: { type: NotificationType }) => {
  const map: Record<NotificationType, NotificationIconEntry> = {
    low_stock:          { icon: Package,       iconClass: 'text-amber-600',   wrapperClass: 'bg-amber-50' },
    duplicate_invoice:  { icon: Copy,          iconClass: 'text-blue-600',    wrapperClass: 'bg-blue-50' },
    gst_mismatch:       { icon: AlertTriangle, iconClass: 'text-red-600',     wrapperClass: 'bg-red-50' },
    invoice_error:      { icon: XCircle,       iconClass: 'text-red-600',     wrapperClass: 'bg-red-50' },
    ai_low_confidence:  { icon: Bot,           iconClass: 'text-purple-600',  wrapperClass: 'bg-purple-50' },
    new_sales_record:   { icon: TrendingUp,    iconClass: 'text-emerald-600', wrapperClass: 'bg-emerald-50' },
    inventory_warning:  { icon: AlertCircle,   iconClass: 'text-amber-600',   wrapperClass: 'bg-amber-50' },
    gst_due:            { icon: Calendar,      iconClass: 'text-red-600',     wrapperClass: 'bg-red-50' },
  }
  const entry = map[type] ?? { icon: AlertCircle, iconClass: 'text-gray-500', wrapperClass: 'bg-gray-100' }
  const Icon = entry.icon
  return (
    <span className={cn('w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0', entry.wrapperClass)}>
      <Icon size={16} className={entry.iconClass} />
    </span>
  )
}
