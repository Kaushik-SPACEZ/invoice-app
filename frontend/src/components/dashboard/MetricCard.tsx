import { motion } from 'framer-motion'
import { TrendingUp, TrendingDown } from 'lucide-react'
import { Card } from '../ui/Card'
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

export const MetricCard = ({ label, value, format = 'currency', trend, trendLabel, icon, iconColor, sparkData, index = 0 }: MetricCardProps) => {
  const animated = useCountUp(value)

  const display = format === 'currency'
    ? `₹${animated.toLocaleString('en-IN')}`
    : format === 'percent'
    ? `${animated}%`
    : animated.toLocaleString('en-IN')

  const trendPositive = (trend ?? 0) >= 0

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25, delay: index * 0.06 }}
    >
      <Card className="p-5 h-full">
        <div className="flex items-start justify-between mb-3">
          <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center', iconColor)}>
            {icon}
          </div>
          {trend !== undefined && (
            <span className={cn('flex items-center gap-0.5 text-xs font-medium', trendPositive ? 'text-emerald-400' : 'text-red-400')}>
              {trendPositive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              {Math.abs(trend)}%
            </span>
          )}
        </div>
        <p className="font-mono text-2xl font-semibold text-white mb-1">{display}</p>
        <p className="text-xs text-gray-400">{label}</p>
        {trendLabel && <p className="text-xs text-gray-500 mt-0.5">{trendLabel}</p>}
        {sparkData && (
          <div className="mt-3 -mx-1">
            <Sparkline data={sparkData} color={iconColor.includes('emerald') ? '#10B981' : '#6366F1'} />
          </div>
        )}
      </Card>
    </motion.div>
  )
}
