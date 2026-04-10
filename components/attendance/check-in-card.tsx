'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Clock, LogIn, LogOut, CheckCircle2, Sunset, Timer } from 'lucide-react'
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
  isAdmin?: boolean
}

const RULE_BADGE_CLASS: Record<string, string> = {
  general:  'bg-muted text-foreground/80 border-border',
  friday:   'bg-emerald-100 text-emerald-700 border-emerald-200',
  football: 'bg-blue-100 text-blue-700 border-blue-200',
  holiday:  'bg-rose-100 text-rose-700 border-rose-200',
}

function timeToSeconds(timeStr: string): number {
  const [h, m, s] = timeStr.split(':').map(Number)
  return h * 3600 + m * 60 + (s ?? 0)
}

function formatElapsed(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function formatTime12(t: string | null | undefined): string {
  if (!t) return '—'
  const [h, m] = t.split(':').map(Number)
  const period = h >= 12 ? 'PM' : 'AM'
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${String(h12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${period}`
}

export function CheckInCard({ userId, settings: initialSettings, isAdmin = false }: Props) {
  const [currentTime, setCurrentTime] = useState('')
  const [currentDate, setCurrentDate] = useState('')
  const [elapsedSeconds, setElapsedSeconds] = useState(0)

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

  // Live clock + elapsed timer
  useEffect(() => {
    const update = () => {
      const now = new Date()
      setCurrentTime(
        now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      )
      setCurrentDate(
        now.toLocaleDateString('en-US', {
          weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
        })
      )
      // Elapsed since check-in
      if (todayRecord?.check_in_time && !hasCheckedOut) {
        const nowSec = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds()
        const ciSec = timeToSeconds(todayRecord.check_in_time)
        setElapsedSeconds(Math.max(0, nowSec - ciSec))
      }
    }
    update()
    const interval = setInterval(update, 1000)
    return () => clearInterval(interval)
  }, [todayRecord?.check_in_time, hasCheckedOut])

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
      <CardContent className="space-y-4">

        {/* Timer (elapsed) when checked in, else live clock */}
        <div className="text-center py-1">
          {hasCheckedIn && !hasCheckedOut ? (
            <>
              <div className="flex items-center justify-center gap-2">
                <Timer className="h-5 w-5 text-blue-500" />
                <span className="text-xs font-medium text-blue-500 uppercase tracking-wide">Time at work</span>
              </div>
              <div className="text-4xl font-mono font-bold tabular-nums tracking-tight mt-1 text-blue-600">
                {formatElapsed(elapsedSeconds)}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                Since {formatTime12(todayRecord?.check_in_time)}
              </div>
            </>
          ) : (
            <>
              <div className="text-4xl font-mono font-bold tabular-nums tracking-tight">
                {currentTime}
              </div>
              <div className="text-sm text-muted-foreground mt-1">{currentDate}</div>
            </>
          )}
        </div>

        {/* Rule badge — admin only */}
        {isAdmin && (
          <div className="flex flex-col items-center gap-1">
            <span className={cn(
              'inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border',
              ruleBadgeClass
            )}>
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
        )}

        {/* Holiday */}
        {isHoliday && (
          <div className="flex flex-col items-center gap-1 py-1 text-center">
            <p className="text-2xl">🏖️</p>
            <p className="text-sm font-medium text-rose-700">Today is a Holiday</p>
            <p className="text-xs text-muted-foreground">No attendance required on Sundays.</p>
          </div>
        )}

        {/* Normal flow */}
        {!isHoliday && (
          <>
            {loading && (
              <div className="flex justify-center py-2">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            )}

            {!hasCheckedIn && !loading && (
              <div className="flex flex-col items-center gap-2">
                <p className="text-sm text-muted-foreground">You haven&apos;t checked in yet</p>
                <Button onClick={checkIn} className="w-full gap-2">
                  <LogIn className="h-4 w-4" />
                  Check In
                </Button>
              </div>
            )}

            {hasCheckedIn && !hasCheckedOut && (
              <div className="flex items-center gap-2">
                <div className="flex-1 rounded-lg border bg-muted/40 px-3 py-2 flex items-center justify-between">
                  <div>
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Checked In</div>
                    <div className="text-sm font-semibold tabular-nums">
                      {formatTime12(todayRecord?.check_in_time)}
                    </div>
                  </div>
                  <Badge className={cn('text-xs', getAttendanceColor(todayRecord?.status ?? ''))}>
                    {formatStatus(todayRecord?.status ?? '')}
                  </Badge>
                </div>
                <Button onClick={checkOut} variant="outline" size="sm" className="gap-1.5 shrink-0">
                  <LogOut className="h-3.5 w-3.5" />
                  Check Out
                </Button>
              </div>
            )}

            {hasCheckedIn && hasCheckedOut && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-green-600 justify-center">
                  <CheckCircle2 className="h-4 w-4" />
                  <span className="text-sm font-medium">Attendance complete</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-lg border bg-muted/40 px-3 py-2 text-center">
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">In</div>
                    <div className="font-semibold tabular-nums text-sm">{formatTime12(todayRecord?.check_in_time)}</div>
                  </div>
                  <div className="rounded-lg border bg-muted/40 px-3 py-2 text-center">
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">Out</div>
                    <div className="font-semibold tabular-nums text-sm">{formatTime12(todayRecord?.check_out_time)}</div>
                  </div>
                </div>
                <div className="flex justify-center">
                  <Badge className={cn('text-xs', getAttendanceColor(todayRecord?.status ?? ''))}>
                    {formatStatus(todayRecord?.status ?? '')}
                  </Badge>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
