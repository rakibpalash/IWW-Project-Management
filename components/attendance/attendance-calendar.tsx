'use client'

import { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { CalendarDays } from 'lucide-react'
import { AttendanceRecord } from '@/types'
import { formatStatus } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, parseISO, isWeekend } from 'date-fns'

interface Props {
  monthRecords: AttendanceRecord[]
}

function getDayColor(
  record: AttendanceRecord | undefined,
  day: Date,
  today: Date
): string {
  const isToday = format(day, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd')
  const isFuture = day > today
  const weekend = isWeekend(day)

  if (weekend) return 'bg-muted text-muted-foreground/70 cursor-default'
  if (isFuture && !isToday) return 'bg-muted/30 text-gray-300 cursor-default'

  if (!record) {
    if (isToday) return 'bg-blue-100 text-blue-700 ring-2 ring-blue-400 ring-offset-1'
    return 'bg-muted/30 text-muted-foreground/70 cursor-default'
  }

  const colorMap: Record<string, string> = {
    on_time: 'bg-green-500 text-white',
    late_150: 'bg-yellow-400 text-yellow-900',
    late_250: 'bg-orange-500 text-white',
    absent: 'bg-red-500 text-white',
    advance_absence: 'bg-purple-500 text-white',
  }

  const base = colorMap[record.status] ?? 'bg-muted text-foreground/80'
  return isToday ? `${base} ring-2 ring-blue-400 ring-offset-1` : base
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function AttendanceCalendar({ monthRecords }: Props) {
  const now = new Date()
  const monthName = format(now, 'MMMM yyyy')

  const { days, startPadding } = useMemo(() => {
    const start = startOfMonth(now)
    const end = endOfMonth(now)
    const days = eachDayOfInterval({ start, end })
    const startPadding = start.getDay() // 0=Sun
    return { days, startPadding }
  }, [now.getMonth(), now.getFullYear()])

  const recordMap = useMemo(() => {
    const map: Record<string, AttendanceRecord> = {}
    for (const r of monthRecords) {
      map[r.date] = r
    }
    return map
  }, [monthRecords])

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <CalendarDays className="h-4 w-4" />
          {monthName}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Legend */}
        <div className="flex flex-wrap gap-x-3 gap-y-1 mb-4 text-xs">
          {[
            { status: 'on_time', label: 'On Time', color: 'bg-green-500' },
            { status: 'late_150', label: 'Late 150%', color: 'bg-yellow-400' },
            { status: 'late_250', label: 'Late 250%', color: 'bg-orange-500' },
            { status: 'absent', label: 'Absent', color: 'bg-red-500' },
            { status: 'advance_absence', label: 'Advance Absence', color: 'bg-purple-500' },
          ].map((item) => (
            <span key={item.status} className="flex items-center gap-1 text-muted-foreground">
              <span className={cn('h-2.5 w-2.5 rounded-sm', item.color)} />
              {item.label}
            </span>
          ))}
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 gap-1 mb-1">
          {DAY_LABELS.map((d) => (
            <div
              key={d}
              className="text-center text-xs text-muted-foreground font-medium py-1"
            >
              {d}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <TooltipProvider>
          <div className="grid grid-cols-7 gap-1">
            {/* Leading empty cells */}
            {Array.from({ length: startPadding }).map((_, i) => (
              <div key={`pad-${i}`} />
            ))}

            {days.map((day) => {
              const dateStr = format(day, 'yyyy-MM-dd')
              const record = recordMap[dateStr]
              const colorClass = getDayColor(record, day, now)
              const dayNum = format(day, 'd')

              const tooltipContent = record
                ? `${format(day, 'EEE, MMM d')} — ${formatStatus(record.status)}${record.check_in_time ? ` · In: ${record.check_in_time}` : ''}${record.check_out_time ? ` · Out: ${record.check_out_time}` : ''}`
                : format(day, 'EEE, MMM d')

              return (
                <Tooltip key={dateStr}>
                  <TooltipTrigger asChild>
                    <div
                      className={cn(
                        'aspect-square flex items-center justify-center rounded-md text-xs font-medium transition-opacity',
                        colorClass
                      )}
                    >
                      {dayNum}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs">
                    {tooltipContent}
                  </TooltipContent>
                </Tooltip>
              )
            })}
          </div>
        </TooltipProvider>
      </CardContent>
    </Card>
  )
}
