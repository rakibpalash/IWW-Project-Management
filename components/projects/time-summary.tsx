'use client'

import { cn, formatHours } from '@/lib/utils'
import { Progress } from '@/components/ui/progress'
import { Clock, AlertTriangle, CheckCircle2, TrendingUp } from 'lucide-react'

interface TimeSummaryProps {
  estimatedHours: number | null
  actualHours: number
  showProgressBar?: boolean
  compact?: boolean
}

export function TimeSummary({
  estimatedHours,
  actualHours,
  showProgressBar = true,
  compact = false,
}: TimeSummaryProps) {
  const hasEstimate = estimatedHours !== null && estimatedHours > 0

  const remainingHours = hasEstimate ? estimatedHours! - actualHours : null
  const isExceeded = remainingHours !== null && remainingHours < 0
  const exceededBy = isExceeded ? Math.abs(remainingHours!) : 0

  // Progress percentage (capped at 100 for bar display, but we show real %)
  const progressPct = hasEstimate
    ? Math.min(Math.round((actualHours / estimatedHours!) * 100), 100)
    : 0
  const realPct = hasEstimate
    ? Math.round((actualHours / estimatedHours!) * 100)
    : 0

  const barColor = isExceeded
    ? 'bg-red-500'
    : realPct >= 80
    ? 'bg-orange-500'
    : 'bg-emerald-500'

  if (compact) {
    return (
      <div className="flex items-center gap-2 text-sm">
        <Clock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        <span className="text-muted-foreground">
          {formatHours(actualHours)} actual
        </span>
        {hasEstimate && (
          <>
            <span className="text-muted-foreground">/</span>
            <span className="text-muted-foreground">
              {formatHours(estimatedHours)} est.
            </span>
          </>
        )}
        {isExceeded && (
          <span className="text-red-600 font-semibold flex items-center gap-1">
            <AlertTriangle className="h-3.5 w-3.5" />
            +{formatHours(exceededBy)} over
          </span>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {/* Estimated */}
        <div className="rounded-lg border bg-card p-3">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
            <Clock className="h-3.5 w-3.5" />
            Estimated
          </div>
          <p className="text-lg font-semibold">
            {hasEstimate ? formatHours(estimatedHours) : '—'}
          </p>
        </div>

        {/* Actual */}
        <div className="rounded-lg border bg-card p-3">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
            <TrendingUp className="h-3.5 w-3.5" />
            Actual
          </div>
          <p className="text-lg font-semibold">{formatHours(actualHours)}</p>
        </div>

        {/* Remaining or Exceeded */}
        {hasEstimate && (
          <div
            className={cn(
              'rounded-lg border bg-card p-3 col-span-2',
              isExceeded && 'border-red-300 bg-red-50/40 dark:bg-red-950/10'
            )}
          >
            {isExceeded ? (
              <>
                <div className="flex items-center gap-1.5 text-xs text-red-600 mb-1">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Exceeded
                </div>
                <p className="text-lg font-bold text-red-600">
                  +{formatHours(exceededBy)} over budget
                </p>
              </>
            ) : (
              <>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Remaining
                </div>
                <p className="text-lg font-semibold text-emerald-600">
                  {formatHours(remainingHours!)}
                </p>
              </>
            )}
          </div>
        )}
      </div>

      {/* Progress bar */}
      {showProgressBar && hasEstimate && (
        <div>
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
            <span>Time used</span>
            <span
              className={cn(
                'font-medium',
                isExceeded
                  ? 'text-red-600'
                  : realPct >= 80
                  ? 'text-orange-600'
                  : 'text-emerald-600'
              )}
            >
              {realPct}%{isExceeded && ' (exceeded)'}
            </span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={cn('h-full rounded-full transition-all', barColor)}
              style={{ width: `${progressPct}%` }}
            />
          </div>
          {isExceeded && (
            <p className="mt-1.5 text-xs text-red-600 flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              This project has exceeded its estimated time by {formatHours(exceededBy)}.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
