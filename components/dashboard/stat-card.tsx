import { cn } from '@/lib/utils'
import { LucideIcon } from 'lucide-react'

interface StatCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon: LucideIcon
  trend?: {
    value: number
    label: string
  }
  variant?: 'default' | 'blue' | 'green' | 'yellow' | 'red' | 'purple'
  className?: string
}

const variantStyles: Record<string, { card: string; icon: string; trend: string }> = {
  default: {
    card: 'bg-white border border-gray-200',
    icon: 'bg-gray-100 text-gray-600',
    trend: 'text-gray-500',
  },
  blue: {
    card: 'bg-white border border-blue-100',
    icon: 'bg-blue-50 text-blue-600',
    trend: 'text-blue-500',
  },
  green: {
    card: 'bg-white border border-green-100',
    icon: 'bg-green-50 text-green-600',
    trend: 'text-green-500',
  },
  yellow: {
    card: 'bg-white border border-yellow-100',
    icon: 'bg-yellow-50 text-yellow-600',
    trend: 'text-yellow-500',
  },
  red: {
    card: 'bg-white border border-red-100',
    icon: 'bg-red-50 text-red-600',
    trend: 'text-red-500',
  },
  purple: {
    card: 'bg-white border border-purple-100',
    icon: 'bg-purple-50 text-purple-600',
    trend: 'text-purple-500',
  },
}

export function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  variant = 'default',
  className,
}: StatCardProps) {
  const styles = variantStyles[variant] ?? variantStyles.default

  return (
    <div
      className={cn(
        'rounded-xl p-5 shadow-sm transition-shadow hover:shadow-md',
        styles.card,
        className
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-gray-500 truncate">{title}</p>
          <p className="mt-1 text-2xl font-bold text-gray-900 tabular-nums">{value}</p>
          {subtitle && (
            <p className="mt-0.5 text-xs text-gray-400 truncate">{subtitle}</p>
          )}
          {trend && (
            <p className={cn('mt-2 text-xs font-medium', styles.trend)}>
              {trend.value >= 0 ? '+' : ''}
              {trend.value}% {trend.label}
            </p>
          )}
        </div>
        <div
          className={cn(
            'flex h-11 w-11 shrink-0 items-center justify-center rounded-lg',
            styles.icon
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  )
}
