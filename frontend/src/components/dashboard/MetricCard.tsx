import { TrendingUp, TrendingDown } from 'lucide-react'
import { useCountUp } from '../../hooks/useCountUp'
import { Sparkline } from '../charts/Charts'
import { cn } from '../../lib/utils'

interface MetricCardProps {
  label: string
  value: number
  format?: 'currency' | 'number' | 'percent'
  trend?: number
  trendLabel?: string
  icon: React.ReactNode
  iconColor: string
  sparkData?: number[]
  index?: number
}

function getAccentBorder(iconColor: string): string {
  if (iconColor.includes('emerald')) return 'border-l-emerald-500'
  if (iconColor.includes('amber')) return 'border-l-amber-500'
  if (iconColor.includes('red')) return 'border-l-red-500'
  // default: blue / primary
  return 'border-l-blue-500'
}

function getIconTextColor(iconColor: string): string {
  if (iconColor.includes('emerald')) return 'text-emerald-500'
  if (iconColor.includes('amber')) return 'text-amber-500'
  if (iconColor.includes('red')) return 'text-red-500'
  return 'text-blue-600'
}

function getSparklineColor(iconColor: string): string {
  if (iconColor.includes('emerald')) return '#16A34A'
  if (iconColor.includes('amber')) return '#D97706'
  if (iconColor.includes('red')) return '#DC2626'
  return '#2563EB'
}

export const MetricCard = ({
  label,
  value,
  format = 'currency',
  trend,
  trendLabel,
  icon,
  iconColor,
  sparkData,
}: MetricCardProps) => {
  const animated = useCountUp(value)

  const display =
    format === 'currency'
      ? `₹${animated.toLocaleString('en-IN')}`
      : format === 'percent'
      ? `${animated}%`
      : animated.toLocaleString('en-IN')

  const trendPositive = (trend ?? 0) >= 0

  return (
    <div
      className={cn(
        'bg-white border border-gray-200 rounded-lg shadow-sm p-5 h-full',
        'border-l-[3px]',
        getAccentBorder(iconColor)
      )}
    >
      {/* Label row with inline icon */}
      <div className="flex items-center gap-1.5 mb-3">
        <span className={cn('flex-shrink-0', getIconTextColor(iconColor))}>
          {icon}
        </span>
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
          {label}
        </p>
      </div>

      {/* Value */}
      <p className="font-mono text-2xl font-bold text-slate-800 leading-none mb-2">
        {display}
      </p>

      {/* Trend row */}
      {(trend !== undefined || trendLabel) && (
        <div className="flex items-center gap-1.5">
          {trend !== undefined && (
            <span
              className={cn(
                'flex items-center gap-0.5 text-xs font-medium',
                trendPositive ? 'text-emerald-600' : 'text-red-600'
              )}
            >
              {trendPositive ? (
                <TrendingUp size={12} />
              ) : (
                <TrendingDown size={12} />
              )}
              {Math.abs(trend)}%
            </span>
          )}
          {trendLabel && (
            <span className="text-xs text-slate-400">{trendLabel}</span>
          )}
        </div>
      )}

      {/* Sparkline */}
      {sparkData && (
        <div className="mt-3 -mx-1">
          <Sparkline data={sparkData} color={getSparklineColor(iconColor)} />
        </div>
      )}
    </div>
  )
}
