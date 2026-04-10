'use client'

import { useState, useMemo, useEffect } from 'react'
import { Profile, AttendanceRecord, AttendanceSettings } from '@/types'
import { CheckInCard } from './check-in-card'
import { cn } from '@/lib/utils'
import {
  ChevronLeft, ChevronRight, CalendarDays, List, LayoutGrid, Clock,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

// ─── Helpers ───────────────────────────────────────────────────────────────────

type ViewMode = 'week' | 'list' | 'month'

const DAY_ABBR = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December']

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}
function minutesToPct(minutes: number): number {
  return (Math.min(Math.max(minutes, 0), 24 * 60) / (24 * 60)) * 100
}
function timeToPercent(time: string): number {
  return minutesToPct(timeToMinutes(time))
}
function formatMins(minutes: number): string {
  const h = Math.floor(Math.abs(minutes) / 60)
  const m = Math.abs(minutes) % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}
function formatTime12(time: string | null | undefined): string {
  if (!time) return '—'
  const [h, m] = time.split(':').map(Number)
  const period = h >= 12 ? 'PM' : 'AM'
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${String(h12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${period}`
}
function getHoursWorked(ci: string, co: string | null, isToday: boolean): string {
  if (!co) {
    if (!isToday) return '--'
    const now = new Date()
    const diff = now.getHours() * 60 + now.getMinutes() - timeToMinutes(ci)
    return diff > 0 ? formatMins(diff) : '--'
  }
  let diff = timeToMinutes(co) - timeToMinutes(ci)
  if (diff < 0) diff += 24 * 60
  return formatMins(diff)
}
function getThreshold(rule: string, s: AttendanceSettings | null): string {
  if (!s) return '09:00'
  if (rule === 'friday') return s.friday_on_time_end
  if (rule === 'football') return s.football_on_time_end
  return s.on_time_end
}
function lateMinutes(ci: string, rule: string, s: AttendanceSettings | null): number {
  return timeToMinutes(ci) - timeToMinutes(getThreshold(rule, s))
}
function isSunday(d: string): boolean { return new Date(d + 'T12:00:00').getDay() === 0 }
function getWeekStart(date: Date): Date {
  const d = new Date(date); d.setDate(d.getDate() - d.getDay()); d.setHours(0, 0, 0, 0); return d
}
function localDateStr(d: Date): string { return d.toLocaleDateString('en-CA') }
function getWeekDates(ws: Date): string[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(ws); d.setDate(ws.getDate() + i); return localDateStr(d)
  })
}
function formatWeekRange(ws: Date): string {
  const we = new Date(ws); we.setDate(ws.getDate() + 6)
  const fmt = (d: Date) => d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
  return `${fmt(ws)} – ${fmt(we)}`
}

// Status config
const STATUS_CFG: Record<string, { bar: string; dot: string; bg: string; text: string; label: string }> = {
  on_time:         { bar: 'bg-green-400',  dot: 'bg-green-500',  bg: 'bg-green-50',  text: 'text-green-700',  label: 'Present' },
  late_150:        { bar: 'bg-yellow-400', dot: 'bg-yellow-500', bg: 'bg-yellow-50', text: 'text-yellow-700', label: 'Late' },
  late_250:        { bar: 'bg-orange-400', dot: 'bg-orange-500', bg: 'bg-orange-50', text: 'text-orange-700', label: 'Late' },
  absent:          { bar: 'bg-red-400',    dot: 'bg-red-500',    bg: 'bg-red-50',    text: 'text-red-700',    label: 'Absent' },
  advance_absence: { bar: 'bg-purple-400', dot: 'bg-purple-500', bg: 'bg-purple-50', text: 'text-purple-700', label: 'Absent' },
}

const TIMELINE_MARKS = [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22]

// ─── Timeline Row ──────────────────────────────────────────────────────────────

function TimelineRow({ date, record, settings, isToday }: {
  date: string; record: AttendanceRecord | null
  settings: AttendanceSettings | null; isToday: boolean
}) {
  const [nowPct, setNowPct] = useState<number>(() => {
    const n = new Date(); return minutesToPct(n.getHours() * 60 + n.getMinutes())
  })
  useEffect(() => {
    if (!isToday) return
    const id = setInterval(() => {
      const n = new Date(); setNowPct(minutesToPct(n.getHours() * 60 + n.getMinutes()))
    }, 30000)
    return () => clearInterval(id)
  }, [isToday])

  const sun = isSunday(date)
  const cfg = record?.status ? STATUS_CFG[record.status] : null
  const ci = record?.check_in_time
  const co = record?.check_out_time

  if (sun) {
    return (
      <div className="relative h-7 flex items-center">
        <div className="absolute left-0 h-2 w-2 rounded-full bg-gray-200 top-1/2 -translate-y-1/2" />
        <div className="absolute inset-x-3 border-t border-dashed border-border/70 top-1/2" />
        <span className="relative z-10 mx-auto bg-amber-50 px-3 text-[11px] font-medium text-amber-600/80 rounded-full border border-amber-200/60">
          Weekend
        </span>
        <div className="absolute right-0 h-2 w-2 rounded-full bg-gray-200 top-1/2 -translate-y-1/2" />
      </div>
    )
  }
  if (!ci) {
    return (
      <div className="relative h-7 flex items-center">
        <div className="absolute left-0 h-2.5 w-2.5 rounded-full bg-gray-200 top-1/2 -translate-y-1/2" />
        <div className="absolute inset-x-3 border-t border-border/50 top-1/2" />
        <div className="absolute right-0 h-2.5 w-2.5 rounded-full bg-gray-200 top-1/2 -translate-y-1/2" />
      </div>
    )
  }

  const ciPct = timeToPercent(ci)
  const coPct = co ? timeToPercent(co) : isToday ? nowPct : ciPct

  return (
    <div className="relative h-7 flex items-center">
      {/* base line */}
      <div className="absolute inset-x-0 border-t border-border/50 top-1/2" />
      {/* endpoint dots */}
      <div className="absolute left-0 h-2 w-2 rounded-full bg-gray-300 top-1/2 -translate-y-1/2 z-10" />
      <div className="absolute right-0 h-2 w-2 rounded-full bg-gray-300 top-1/2 -translate-y-1/2 z-10" />
      {/* worked segment */}
      {cfg && (
        <div
          className={cn('absolute h-[3px] top-1/2 -translate-y-1/2 rounded-full', cfg.bar)}
          style={{ left: `${ciPct}%`, width: `${Math.max(0, coPct - ciPct)}%` }}
        />
      )}
      {/* check-in dot */}
      {cfg && (
        <div
          className={cn('absolute h-3 w-3 rounded-full border-2 border-white top-1/2 -translate-y-1/2 -translate-x-1/2 shadow-sm', cfg.dot)}
          style={{ left: `${ciPct}%` }}
        />
      )}
      {/* check-out dot */}
      {co && (
        <div
          className="absolute h-3 w-3 rounded-full border-2 border-white bg-red-400 top-1/2 -translate-y-1/2 -translate-x-1/2 shadow-sm"
          style={{ left: `${coPct}%` }}
        />
      )}
      {/* now line */}
      {isToday && !co && (
        <div
          className="absolute top-0 bottom-0 w-[2px] bg-blue-400 rounded-full"
          style={{ left: `${nowPct}%` }}
        />
      )}
    </div>
  )
}

// ─── Weekly Timeline View ──────────────────────────────────────────────────────

function WeeklyView({ weekDates, recordByDate, settings, profile, today }: {
  weekDates: string[]; recordByDate: Record<string, AttendanceRecord>
  settings: AttendanceSettings | null; profile: Profile; today: string
}) {
  const workingDays = weekDates.filter(d => !isSunday(d)).length
  const presentDays = weekDates.filter(d => recordByDate[d]?.check_in_time).length
  const weekendDays = weekDates.filter(d => isSunday(d)).length
  const absentDays = weekDates.filter(d => !isSunday(d) && d <= today && !recordByDate[d]?.check_in_time).length

  return (
    <div className="space-y-4">
      {/* Check-in card */}
      <CheckInCard userId={profile.id} settings={settings} isAdmin={profile.role === 'super_admin' || profile.role === 'account_manager'} />

      {/* Timeline table */}
      <div className="bg-card rounded-xl border border-border overflow-hidden shadow-sm">
        {weekDates.map((date) => {
          const record = recordByDate[date] ?? null
          const sun = isSunday(date)
          const isToday = date === today
          const isFuture = date > today
          const d = new Date(date + 'T12:00:00')
          const dayNum = d.getDate()
          const dayAbbr = DAY_ABBR[d.getDay()]
          const ci = record?.check_in_time
          const co = record?.check_out_time
          const rule = record?.applied_rule ?? 'general'
          const lateMin = ci ? lateMinutes(ci, rule, settings) : 0
          const hoursWorked = ci ? getHoursWorked(ci, co, isToday) : null

          return (
            <div
              key={date}
              className={cn(
                'border-b border-border/60 last:border-0 transition-colors',
                isToday && 'bg-blue-50/40',
                sun && 'bg-muted/30/60',
                isFuture && !sun && 'opacity-40',
              )}
            >
              <div className="flex items-center gap-3 px-4 py-3 min-h-[64px]">
                {/* Day */}
                <div className={cn('w-12 shrink-0 text-center', isToday && 'font-bold')}>
                  <p className={cn('text-[11px] font-medium uppercase', isToday ? 'text-blue-500' : 'text-muted-foreground/70')}>
                    {isToday ? 'Today' : dayAbbr}
                  </p>
                  <p className={cn('text-lg font-bold leading-none mt-0.5',
                    isToday ? 'text-blue-600' : 'text-foreground/80')}>
                    {dayNum}
                  </p>
                </div>

                {/* Check-in + late */}
                <div className="w-28 shrink-0">
                  {ci ? (
                    <>
                      <p className="text-sm font-semibold text-foreground">{formatTime12(ci)}</p>
                      {lateMin > 0 ? (
                        <p className="text-[11px] font-medium text-orange-500">Late by {formatMins(lateMin)}</p>
                      ) : (
                        <p className="text-[11px] font-medium text-green-600">On time</p>
                      )}
                    </>
                  ) : (
                    <p className="text-xs text-gray-300">{sun ? '' : isFuture ? '' : 'No record'}</p>
                  )}
                </div>

                {/* Timeline */}
                <div className="flex-1">
                  <TimelineRow date={date} record={record} settings={settings} isToday={isToday} />
                </div>

                {/* Check-out */}
                <div className="w-24 shrink-0 text-right">
                  {co ? (
                    <p className="text-sm font-semibold text-foreground">{formatTime12(co)}</p>
                  ) : (
                    <p className="text-xs text-gray-300">—</p>
                  )}
                </div>

                {/* Hours worked */}
                <div className="w-20 shrink-0 text-right">
                  {hoursWorked && hoursWorked !== '--' ? (
                    <>
                      <p className="text-sm font-bold text-foreground">{hoursWorked}</p>
                      <p className="text-[10px] text-muted-foreground/70">Hrs worked</p>
                    </>
                  ) : ci ? (
                    <>
                      <p className="text-sm text-muted-foreground/70">Live</p>
                      <p className="text-[10px] text-gray-300">Hrs</p>
                    </>
                  ) : null}
                </div>
              </div>
            </div>
          )
        })}

        {/* Hour axis */}
        <div className="flex items-center px-4 py-2 bg-muted/30 border-t border-border/60">
          <div className="w-12 shrink-0" />
          <div className="w-28 shrink-0" />
          <div className="flex-1 relative h-4 ml-3">
            {TIMELINE_MARKS.map(h => {
              const pct = (h / 24) * 100
              const label = h === 0 ? '12AM' : h === 12 ? '12PM' : h < 12 ? `${String(h).padStart(2,'0')}AM` : `${String(h-12).padStart(2,'0')}PM`
              return (
                <span key={h} className="absolute text-[9px] text-muted-foreground/70 -translate-x-1/2 select-none"
                  style={{ left: `${pct}%` }}>
                  {label}
                </span>
              )
            })}
          </div>
          <div className="w-24 shrink-0" />
          <div className="w-20 shrink-0" />
        </div>
      </div>

      {/* Stats bar — matches reference layout */}
      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        <div className="flex divide-x divide-border flex-wrap">
          {[
            { color: 'bg-blue-400',   label: 'Payable Days', value: presentDays,  unit: 'Days' },
            { color: 'bg-green-500',  label: 'Present',      value: presentDays,  unit: 'Days' },
            { color: 'bg-violet-400', label: 'On Duty',       value: 0,            unit: 'Day'  },
            { color: 'bg-cyan-400',   label: 'Paid leave',   value: 0,            unit: 'Day'  },
            { color: 'bg-amber-400',  label: 'Holidays',     value: 0,            unit: 'Day'  },
            { color: 'bg-gray-300',   label: 'Weekend',      value: weekendDays,  unit: 'Days' },
          ].map(item => (
            <div key={item.label} className="flex-1 min-w-[100px] px-4 py-3 flex items-start gap-2.5">
              <span className={cn('h-3 w-[3px] rounded-full mt-1 shrink-0', item.color)} />
              <div>
                <p className="text-xs font-semibold text-foreground/80">{item.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  <span className="font-bold text-foreground text-sm">{item.value}</span>{' '}
                  {item.value === 1 ? item.unit.replace('s','') : item.unit}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── List View ─────────────────────────────────────────────────────────────────

function ListView({ monthDates, recordByDate, settings, today }: {
  monthDates: string[]; recordByDate: Record<string, AttendanceRecord>
  settings: AttendanceSettings | null; today: string
}) {
  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden shadow-sm">
      {/* Header */}
      <div className="grid grid-cols-[100px_1fr_1fr_1fr_120px_100px] gap-4 px-4 py-2.5 bg-muted/30 border-b border-border/60">
        {['Date', 'Check In', 'Check Out', 'Status', 'Rule', 'Hrs Worked'].map(h => (
          <span key={h} className="text-[11px] font-semibold text-muted-foreground/70 uppercase tracking-wide">{h}</span>
        ))}
      </div>
      <div className="divide-y divide-gray-50 max-h-[520px] overflow-y-auto">
        {monthDates.filter(d => !isSunday(d)).map(date => {
          const r = recordByDate[date]
          const isToday = date === today
          const isFuture = date > today
          const d = new Date(date + 'T12:00:00')
          const cfg = r?.status ? STATUS_CFG[r.status] : null
          const ci = r?.check_in_time
          const co = r?.check_out_time
          const rule = r?.applied_rule ?? 'general'
          const lateMin = ci ? lateMinutes(ci, rule, settings) : 0
          const hw = ci ? getHoursWorked(ci, co, isToday) : null

          return (
            <div
              key={date}
              className={cn(
                'grid grid-cols-[100px_1fr_1fr_1fr_120px_100px] gap-4 px-4 py-2.5 items-center',
                isToday && 'bg-blue-50/30',
                isFuture && 'opacity-40',
              )}
            >
              <div>
                <p className={cn('text-sm font-medium', isToday ? 'text-blue-600' : 'text-foreground/80')}>
                  {d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                </p>
                <p className="text-xs text-muted-foreground/70">{DAY_ABBR[d.getDay()]}</p>
              </div>
              <div>
                {ci ? (
                  <>
                    <p className="text-sm font-medium text-foreground">{formatTime12(ci)}</p>
                    {lateMin > 0 && <p className="text-xs text-orange-500">Late {formatMins(lateMin)}</p>}
                  </>
                ) : <p className="text-xs text-gray-300">—</p>}
              </div>
              <div>
                {co ? (
                  <p className="text-sm font-medium text-foreground">{formatTime12(co)}</p>
                ) : <p className="text-xs text-gray-300">—</p>}
              </div>
              <div>
                {cfg ? (
                  <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium', cfg.bg, cfg.text)}>
                    <span className={cn('h-1.5 w-1.5 rounded-full', cfg.dot)} />
                    {cfg.label}
                  </span>
                ) : isFuture ? null : (
                  <span className="text-xs text-gray-300">No record</span>
                )}
              </div>
              <div>
                {r?.applied_rule ? (
                  <span className="text-xs text-muted-foreground capitalize">{r.applied_rule}</span>
                ) : null}
              </div>
              <div>
                {hw && hw !== '--' ? (
                  <p className="text-sm font-semibold text-foreground">{hw}</p>
                ) : null}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Monthly Calendar View ─────────────────────────────────────────────────────

function MonthCalendarView({ year, month, recordByDate, today }: {
  year: number; month: number
  recordByDate: Record<string, AttendanceRecord>; today: string
}) {
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const cells: (string | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => {
      const d = new Date(year, month, i + 1)
      return localDateStr(d)
    }),
  ]
  while (cells.length % 7 !== 0) cells.push(null)

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden shadow-sm">
      {/* Weekday headers */}
      <div className="grid grid-cols-7 border-b border-border/60">
        {DAY_ABBR.map(d => (
          <div key={d} className={cn(
            'py-2.5 text-center text-xs font-semibold',
            d === 'Sun' ? 'text-red-400 bg-red-50/30' : 'text-muted-foreground',
          )}>
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7">
        {cells.map((date, idx) => {
          if (!date) return <div key={idx} className="min-h-[90px] border-b border-r border-border/50 last:border-r-0 bg-muted/30/20" />

          const sun = isSunday(date)
          const isToday = date === today
          const isFuture = date > today
          const d = new Date(date + 'T12:00:00')
          const dayNum = d.getDate()
          const record = recordByDate[date]
          const cfg = record?.status ? STATUS_CFG[record.status] : null
          const ci = record?.check_in_time
          const co = record?.check_out_time
          const hw = ci ? getHoursWorked(ci, co, false) : null

          return (
            <div
              key={date}
              className={cn(
                'min-h-[100px] p-2 border-b border-r border-border/60',
                (idx + 1) % 7 === 0 && 'border-r-0',
                sun && 'bg-amber-50/40',
                isToday && 'bg-blue-50/30 ring-1 ring-inset ring-blue-200',
              )}
            >
              {/* Day number */}
              <div className={cn(
                'text-xs font-bold mb-2 h-6 w-6 flex items-center justify-center rounded-full',
                isToday ? 'bg-blue-600 text-white' : sun ? 'text-red-400' : 'text-muted-foreground/80',
              )}>
                {dayNum}
              </div>

              {sun ? (
                <div className="text-[10px] text-muted-foreground/40 font-medium">Weekend</div>
              ) : isFuture ? null : record && cfg ? (
                <div className={cn(
                  'rounded-lg px-2 py-2 border',
                  cfg.bg,
                  record.status === 'on_time'  ? 'border-green-200' :
                  record.status === 'late_150' ? 'border-yellow-200' :
                  record.status === 'late_250' ? 'border-orange-200' :
                  record.status === 'absent'   ? 'border-red-200'   : 'border-purple-200'
                )}>
                  <p className={cn('text-[11px] font-bold leading-none', cfg.text)}>{cfg.label}</p>
                  {hw && hw !== '--' && (
                    <p className={cn('text-[10px] font-medium mt-1', cfg.text)}>{hw} Hrs</p>
                  )}
                </div>
              ) : (
                <div className="text-[10px] text-muted-foreground/30">No record</div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Summary Stats Card ────────────────────────────────────────────────────────

function MonthStats({ records, year, month }: {
  records: AttendanceRecord[]; year: number; month: number
}) {
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const weekendDays = Array.from({ length: daysInMonth }, (_, i) =>
    new Date(year, month, i + 1).getDay() === 0
  ).filter(Boolean).length
  const workingDays = daysInMonth - weekendDays

  const present = records.filter(r => r.check_in_time).length
  const late    = records.filter(r => r.status === 'late_150' || r.status === 'late_250').length

  return (
    <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
      <div className="flex divide-x divide-border flex-wrap">
        {[
          { color: 'bg-blue-400',   label: 'Payable Days', value: present,      unit: 'Days' },
          { color: 'bg-green-500',  label: 'Present',      value: present,      unit: 'Days' },
          { color: 'bg-yellow-400', label: 'Late',         value: late,         unit: 'Days' },
          { color: 'bg-violet-400', label: 'On Duty',      value: 0,            unit: 'Day'  },
          { color: 'bg-cyan-400',   label: 'Paid leave',   value: 0,            unit: 'Day'  },
          { color: 'bg-gray-300',   label: 'Weekend',      value: weekendDays,  unit: 'Days' },
        ].map(item => (
          <div key={item.label} className="flex-1 min-w-[100px] px-4 py-3 flex items-start gap-2.5">
            <span className={cn('h-3 w-[3px] rounded-full mt-1 shrink-0', item.color)} />
            <div>
              <p className="text-xs font-semibold text-foreground/80">{item.label}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                <span className="font-bold text-foreground text-sm">{item.value}</span>{' '}
                {item.value === 1 ? item.unit.replace('s','') : item.unit}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Main Component ────────────────────────────────────────────────────────────

interface Props {
  profile: Profile
  settings: AttendanceSettings | null
  allRecords: AttendanceRecord[]
}

export function AttendanceSummaryPage({ profile, settings, allRecords }: Props) {
  const today = localDateStr(new Date())
  const [view, setView] = useState<ViewMode>('week')
  const [weekStart, setWeekStart] = useState<Date>(() => getWeekStart(new Date()))
  const [monthDate, setMonthDate] = useState<Date>(() => {
    const d = new Date(); d.setDate(1); return d
  })

  const recordByDate = useMemo(() =>
    Object.fromEntries(allRecords.map(r => [r.date, r])),
    [allRecords]
  )

  const weekDates = useMemo(() => getWeekDates(weekStart), [weekStart])

  const year = monthDate.getFullYear()
  const month = monthDate.getMonth()

  const monthRecords = useMemo(() =>
    allRecords.filter(r => {
      const d = new Date(r.date + 'T12:00:00')
      return d.getFullYear() === year && d.getMonth() === month
    }),
    [allRecords, year, month]
  )

  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const monthDates = useMemo(() =>
    Array.from({ length: daysInMonth }, (_, i) =>
      localDateStr(new Date(year, month, i + 1))
    ),
    [year, month, daysInMonth]
  )

  const prevWeek = () => { const d = new Date(weekStart); d.setDate(d.getDate() - 7); setWeekStart(d) }
  const nextWeek = () => { const d = new Date(weekStart); d.setDate(d.getDate() + 7); setWeekStart(d) }
  const prevMonth = () => { const d = new Date(monthDate); d.setMonth(d.getMonth() - 1); setMonthDate(d) }
  const nextMonth = () => { const d = new Date(monthDate); d.setMonth(d.getMonth() + 1); setMonthDate(d) }

  return (
    <div className="space-y-5">
      {/* Page header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground">Attendance Summary</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Track your daily attendance and working hours</p>
        </div>

        <div className="flex items-center gap-2">
          {/* Navigator */}
          {view === 'week' ? (
            <div className="flex items-center gap-1 bg-card border border-border rounded-lg px-3 py-1.5 shadow-sm">
              <button onClick={prevWeek} className="p-0.5 hover:text-blue-600 text-muted-foreground transition-colors">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <div className="flex items-center gap-1.5 px-2">
                <CalendarDays className="h-3.5 w-3.5 text-muted-foreground/70" />
                <span className="text-xs font-medium text-foreground/80 whitespace-nowrap">{formatWeekRange(weekStart)}</span>
              </div>
              <button onClick={nextWeek} className="p-0.5 hover:text-blue-600 text-muted-foreground transition-colors">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1 bg-card border border-border rounded-lg px-3 py-1.5 shadow-sm">
              <button onClick={prevMonth} className="p-0.5 hover:text-blue-600 text-muted-foreground transition-colors">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <div className="flex items-center gap-1.5 px-2">
                <CalendarDays className="h-3.5 w-3.5 text-muted-foreground/70" />
                <span className="text-xs font-medium text-foreground/80">{MONTH_NAMES[month]} {year}</span>
              </div>
              <button onClick={nextMonth} className="p-0.5 hover:text-blue-600 text-muted-foreground transition-colors">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* View toggle */}
          <div className="flex items-center bg-card border border-border rounded-lg overflow-hidden shadow-sm">
            {([
              { id: 'week', icon: LayoutGrid, tip: 'Weekly timeline' },
              { id: 'list', icon: List, tip: 'List view' },
              { id: 'month', icon: CalendarDays, tip: 'Monthly calendar' },
            ] as const).map(({ id, icon: Icon, tip }) => (
              <button
                key={id}
                title={tip}
                onClick={() => setView(id)}
                className={cn(
                  'p-2 transition-colors',
                  view === id
                    ? 'bg-blue-600 text-white'
                    : 'text-muted-foreground/70 hover:text-foreground/80 hover:bg-muted/30',
                )}
              >
                <Icon className="h-4 w-4" />
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Week view ── */}
      {view === 'week' && (
        <WeeklyView
          weekDates={weekDates}
          recordByDate={recordByDate}
          settings={settings}
          profile={profile}
          today={today}
        />
      )}

      {/* ── List view ── */}
      {view === 'list' && (
        <div className="space-y-4">
          <CheckInCard userId={profile.id} settings={settings} isAdmin={profile.role === 'super_admin' || profile.role === 'account_manager'} />
          <MonthStats records={monthRecords} year={year} month={month} />
          <ListView
            monthDates={monthDates}
            recordByDate={recordByDate}
            settings={settings}
            today={today}
          />
        </div>
      )}

      {/* ── Month view ── */}
      {view === 'month' && (
        <div className="space-y-4">
          <CheckInCard userId={profile.id} settings={settings} isAdmin={profile.role === 'super_admin' || profile.role === 'account_manager'} />
          <MonthStats records={monthRecords} year={year} month={month} />
          <MonthCalendarView
            year={year}
            month={month}
            recordByDate={recordByDate}
            today={today}
          />
        </div>
      )}
    </div>
  )
}
