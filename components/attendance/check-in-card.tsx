'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Clock, LogIn, LogOut, CheckCircle2, Sunset } from 'lucide-react'
import { useAttendance } from '@/hooks/use-attendance'
import { AttendanceSettings } from '@/types'
import { getAttendanceColor, formatStatus } from '@/lib/utils'
import {
  getExpectedExitTime,
  formatExitTime,
  RULE_LABELS,
  RULE_EMOJI,
} from '@/lib/attendance-rules'
import { cn } from '@/lib/utils'

interface Props {
  userId: string
  settings: AttendanceSettings | null
}

const RULE_BADGE_CLASS: Record<string, string> = {
  general:  'bg-gray-100 text-gray-700 border-gray-200',
  friday:   'bg-emerald-100 text-emerald-700 border-emerald-200',
  football: 'bg-blue-100 text-blue-700 border-blue-200',
  holiday:  'bg-rose-100 text-rose-700 border-rose-200',
}

export function CheckInCard({ userId, settings: initialSettings }: Props) {
  const [currentTime, setCurrentTime] = useState('')
  const [currentDate, setCurrentDate] = useState('')

  const {
    todayRecord,
    hasCheckedIn,
    hasCheckedOut,
    dayType,
    appliedRule,
    loading,
    settings,
    checkIn,
    checkOut,
  } = useAttendance(userId)

  const activeSettings = settings ?? initialSettings

  // Live clock
  useEffect(() => {
    const update = () => {
      const now = new Date()
      setCurrentTime(
        now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      )
      setCurrentDate(
        now.toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })
      )
    }
    update()
    const interval = setInterval(update, 1000)
    return () => clearInterval(interval)
  }, [])

  const isHoliday = dayType === 'sunday'
  const ruleLabel = RULE_LABELS[appliedRule]
  const ruleEmoji = RULE_EMOJI[appliedRule]
  const ruleBadgeClass = RULE_BADGE_CLASS[appliedRule] ?? RULE_BADGE_CLASS.general
  const exitTime = activeSettings ? formatExitTime(getExpectedExitTime(appliedRule, activeSettings)) : null

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Clock className="h-4 w-4" />
          Today&apos;s Attendance
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Live Clock */}
        <div className="text-center py-2">
          <div className="text-4xl font-mono font-bold tabular-nums tracking-tight">
            {currentTime}
          </div>
          <div className="text-sm text-muted-foreground mt-1">{currentDate}</div>
        </div>

        {/* Rule indicator */}
        <div className="flex flex-col items-center gap-1.5">
          <span
            className={cn(
              'inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border',
              ruleBadgeClass
            )}
          >
            {ruleEmoji && <span>{ruleEmoji}</span>}
            {ruleLabel} applies today
          </span>
          {exitTime && !isHoliday && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Sunset className="h-3 w-3" />
              Expected exit: <strong className="ml-0.5">{exitTime}</strong>
            </span>
          )}
        </div>

        {/* ── Holiday: no attendance ── */}
        {isHoliday && (
          <div className="flex flex-col items-center gap-2 py-2 text-center">
            <p className="text-2xl">🏖️</p>
            <p className="text-sm font-medium text-rose-700">Today is a Holiday</p>
            <p className="text-xs text-muted-foreground">No attendance required on Sundays.</p>
          </div>
        )}

        {/* ── Normal flow ── */}
        {!isHoliday && (
          <>
            {!hasCheckedIn && !loading && (
              <div className="flex flex-col items-center gap-3">
                <p className="text-sm text-muted-foreground">You haven&apos;t checked in yet</p>
                <Button onClick={checkIn} size="lg" className="w-full gap-2">
                  <LogIn className="h-4 w-4" />
                  Check In
                </Button>
              </div>
            )}

            {hasCheckedIn && !hasCheckedOut && (
              <div className="space-y-3">
                <div className="flex items-center justify-between rounded-lg border bg-muted/40 px-4 py-3">
                  <div>
                    <div className="text-xs text-muted-foreground mb-0.5">Checked In</div>
                    <div className="text-lg font-semibold tabular-nums">
                      {todayRecord?.check_in_time}
                    </div>
                  </div>
                  <Badge
                    className={cn(
                      'text-xs font-medium',
                      getAttendanceColor(todayRecord?.status ?? '')
                    )}
                  >
                    {formatStatus(todayRecord?.status ?? '')}
                  </Badge>
                </div>
                <Button
                  onClick={checkOut}
                  size="lg"
                  variant="outline"
                  className="w-full gap-2"
                >
                  <LogOut className="h-4 w-4" />
                  Check Out
                </Button>
              </div>
            )}

            {hasCheckedIn && hasCheckedOut && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-green-600 justify-center">
                  <CheckCircle2 className="h-4 w-4" />
                  <span className="text-sm font-medium">Attendance complete for today</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border bg-muted/40 px-3 py-2 text-center">
                    <div className="text-xs text-muted-foreground mb-0.5">Check In</div>
                    <div className="font-semibold tabular-nums text-sm">
                      {todayRecord?.check_in_time}
                    </div>
                  </div>
                  <div className="rounded-lg border bg-muted/40 px-3 py-2 text-center">
                    <div className="text-xs text-muted-foreground mb-0.5">Check Out</div>
                    <div className="font-semibold tabular-nums text-sm">
                      {todayRecord?.check_out_time}
                    </div>
                  </div>
                </div>
                <div className="flex justify-center">
                  <Badge
                    className={cn(
                      'text-xs font-medium',
                      getAttendanceColor(todayRecord?.status ?? '')
                    )}
                  >
                    {formatStatus(todayRecord?.status ?? '')}
                  </Badge>
                </div>
              </div>
            )}

            {loading && (
              <div className="flex justify-center py-4">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
