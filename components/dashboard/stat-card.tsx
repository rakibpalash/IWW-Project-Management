import { cn } from '@/lib/utils'
import { LucideIcon } from 'lucide-react'

interface StatCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon: LucideIcon
  trend?: { value: number; label: string }
  variant?: 'default' | 'blue' | 'green' | 'yellow' | 'red' | 'purple'
  className?: string
}

const variantStyles = {
  default: {
    card:  'bg-card border border-border',
    icon:  'bg-muted text-muted-foreground',
    trend: 'text-muted-foreground',
  },
  blue: {
    card:  'bg-card border border-border',
    icon:  'bg-blue-500/10 text-blue-500',
    trend: 'text-blue-500',
  },
  green: {
    card:  'bg-card border border-border',
    icon:  'bg-emerald-500/10 text-emerald-500',
    trend: 'text-emerald-500',
  },
  yellow: {
    card:  'bg-card border border-border',
    icon:  'bg-amber-500/10 text-amber-500',
    trend: 'text-amber-500',
  },
  red: {
    card:  'bg-card border border-border',
    icon:  'bg-red-500/10 text-red-500',
    trend: 'text-red-500',
  },
  purple: {
    card:  'bg-card border border-border',
    icon:  'bg-violet-500/10 text-violet-500',
    trend: 'text-violet-500',
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
    <div className={cn('rounded-xl p-4 sm:p-5 hover:shadow-md transition-shadow', styles.card, className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-muted-foreground truncate uppercase tracking-wide">{title}</p>
          <p className="mt-1.5 text-2xl font-bold text-foreground tabular-nums leading-none">{value}</p>
          {subtitle && <p className="mt-1 text-xs text-muted-foreground truncate">{subtitle}</p>}
          {trend && (
            <p className={cn('mt-2 text-xs font-semibold', styles.trend)}>
              {trend.value >= 0 ? '+' : ''}{trend.value}% {trend.label}
            </p>
          )}
        </div>
        <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-lg', styles.icon)}>
          <Icon className="h-4.5 w-4.5" />
        </div>
      </div>
    </div>
  )
}
