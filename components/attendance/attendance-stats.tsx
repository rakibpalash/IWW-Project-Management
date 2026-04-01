'use client'

import { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { BarChart3 } from 'lucide-react'
import { AttendanceRecord } from '@/types'
import {
  getDaysInMonth,
  isWeekend,
  eachDayOfInterval,
  startOfMonth,
  endOfMonth,
  parseISO,
} from 'date-fns'

interface Props {
  monthRecords: AttendanceRecord[]
}

export function AttendanceStats({ monthRecords }: Props) {
  const now = new Date()

  const stats = useMemo(() => {
    // Count working days (Mon-Fri) in month up to today
    const start = startOfMonth(now)
    const end = endOfMonth(now)
    const allDays = eachDayOfInterval({ start, end })
    const totalWorkDays = allDays.filter((d) => !isWeekend(d)).length
    const workDaysSoFar = allDays.filter((d) => !isWeekend(d) && d <= now).length

    const counts = {
      on_time: 0,
      late_150: 0,
      late_250: 0,
      absent: 0,
      advance_absence: 0,
    }
    for (const r of monthRecords) {
      if (r.status in counts) {
        counts[r.status as keyof typeof counts]++
      }
    }

    const presentDays = counts.on_time + counts.late_150 + counts.late_250 + counts.advance_absence
    const lateDays = counts.late_150 + counts.late_250
    const presentPct = workDaysSoFar > 0 ? Math.round((presentDays / workDaysSoFar) * 100) : 0

    return {
      totalWorkDays,
      workDaysSoFar,
      presentDays,
      lateDays,
      ...counts,
      presentPct,
    }
  }, [monthRecords, now.getMonth(), now.getFullYear()])

  const statItems = [
    {
      label: 'Working Days (Month)',
      value: stats.totalWorkDays,
      sub: `${stats.workDaysSoFar} days elapsed`,
      color: 'text-foreground',
    },
    {
      label: 'Present Days',
      value: stats.presentDays,
      sub: `${stats.presentPct}% attendance rate`,
      color: 'text-green-700',
      showProgress: true,
      progress: stats.presentPct,
      progressColor: 'bg-green-500',
    },
    {
      label: 'On Time',
      value: stats.on_time,
      color: 'text-green-600',
    },
    {
      label: 'Late 150%',
      value: stats.late_150,
      color: 'text-yellow-600',
    },
    {
      label: 'Late 250%',
      value: stats.late_250,
      color: 'text-orange-600',
    },
    {
      label: 'Absent',
      value: stats.absent,
      color: 'text-red-600',
    },
    ...(stats.advance_absence > 0
      ? [{ label: 'Advance Absence', value: stats.advance_absence, color: 'text-purple-600' }]
      : []),
  ]

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <BarChart3 className="h-4 w-4" />
          Monthly Breakdown
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {statItems.map((item, i) => (
          <div key={i}>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{item.label}</span>
              <span className={`font-semibold tabular-nums ${item.color}`}>{item.value}</span>
            </div>
            {item.sub && (
              <div className="text-xs text-muted-foreground mt-0.5">{item.sub}</div>
            )}
            {item.showProgress && (
              <Progress
                value={item.progress}
                className="h-1.5 mt-1.5"
              />
            )}
            {i < statItems.length - 1 && (
              <div className="border-t mt-2.5" />
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
