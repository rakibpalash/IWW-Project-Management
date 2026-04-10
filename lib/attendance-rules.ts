/**
 * attendance-rules.ts
 *
 * Pure, side-effect-free helpers for the attendance rule system.
 * Safe to import on both server (actions) and client (hook/UI) sides.
 *
 * Rule priority (highest → lowest):
 *   1. Sunday          → holiday  (no attendance)
 *   2. Football assign → football (overrides Friday/General)
 *   3. Friday          → friday
 *   4. Everything else → general
 */

import { AttendanceSettings, AttendanceStatus, AppliedRule, DayType } from '@/types'

// ── Day-type detection ────────────────────────────────────────────────────────

/**
 * Returns the day type for a given date.
 * getDay() → 0 = Sunday, 5 = Friday.
 */
export function getDayType(date: Date): DayType {
  const dow = date.getDay()
  if (dow === 0) return 'sunday'
  if (dow === 5) return 'friday'
  return 'general'
}

// ── Rule resolution ───────────────────────────────────────────────────────────

/**
 * Resolves which attendance rule applies given the day type and whether the
 * football rule has been assigned to this specific user for this date.
 */
export function resolveAppliedRule(
  dayType: DayType,
  isFootballDay: boolean
): AppliedRule {
  if (dayType === 'sunday') return 'holiday'
  if (isFootballDay) return 'football'
  if (dayType === 'friday') return 'friday'
  return 'general'
}

// ── Status computation ────────────────────────────────────────────────────────

/** Parse 'HH:MM' into total minutes since midnight. */
function toMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

/**
 * Computes the attendance status from a check-in time string ('HH:MM') and the
 * resolved rule.
 *
 * Football rule after 11:00:
 *   - Returns 'advance_absence' (staff physically checked in but very late).
 *   - The distinction from 'absent' (never checked in) is made at the DB level
 *     when auto-marking: records with no check_in_time = absent.
 */
export function computeStatusForRule(
  checkInTime: string,   // 'HH:MM'
  rule: AppliedRule,
  settings: AttendanceSettings
): AttendanceStatus {
  if (rule === 'holiday') return 'absent'

  const total = toMinutes(checkInTime)

  if (rule === 'football') {
    if (total <= toMinutes(settings.football_on_time_end  ?? '09:00')) return 'on_time'
    if (total <= toMinutes(settings.football_late_150_end ?? '10:00')) return 'late_150'
    if (total <= toMinutes(settings.football_late_250_end ?? '11:00')) return 'late_250'
    return 'advance_absence'
  }

  if (rule === 'friday') {
    if (total <= toMinutes(settings.friday_on_time_end  ?? '09:00')) return 'on_time'
    if (total <= toMinutes(settings.friday_late_150_end ?? '10:00')) return 'late_150'
    if (total <= toMinutes(settings.friday_late_250_end ?? '11:00')) return 'late_250'
    return 'absent'
  }

  // general
  if (total <= toMinutes(settings.on_time_end))  return 'on_time'
  if (total <= toMinutes(settings.late_150_end)) return 'late_150'
  if (total <= toMinutes(settings.late_250_end)) return 'late_250'
  return 'absent'
}

// ── Salary-based fine calculation ────────────────────────────────────────────

/**
 * Returns the on_time_end threshold for a given rule.
 * Minutes late are measured from this point.
 */
export function getOnTimeEnd(rule: AppliedRule, settings: AttendanceSettings): string {
  if (rule === 'football') return settings.football_on_time_end ?? '09:45'
  if (rule === 'friday')   return settings.friday_on_time_end   ?? '08:30'
  return settings.on_time_end
}

/**
 * Calculates the salary-proportional fine for a late check-in.
 *
 * Formula: round( minutes_late × salary / monthly_work_minutes × multiplier )
 *   monthly_work_minutes = work_hours_per_week × 4 × 60
 *   late_150 multiplier  = 1.5  (150% penalty)
 *   late_250 multiplier  = 2.5  (250% penalty)
 *
 * Returns 0 if the person checked in on time or no salary/invalid input.
 */
export function computeSalaryFine(
  checkInTime: string,         // 'HH:MM'
  onTimeEnd: string,           // 'HH:MM'
  monthlySalary: number,
  workHoursPerWeek: number,    // e.g. 30
  multiplier: 1.5 | 2.5
): number {
  const minutesLate = Math.max(0, toMinutes(checkInTime) - toMinutes(onTimeEnd))
  if (minutesLate <= 0 || monthlySalary <= 0 || workHoursPerWeek <= 0) return 0
  const monthlyWorkMinutes = workHoursPerWeek * 4 * 60  // e.g. 30 × 4 × 60 = 7200
  return Math.round((minutesLate * monthlySalary * multiplier) / monthlyWorkMinutes)
}

/** Returns fine multiplier for a late status. */
export function getFineMultiplier(status: 'late_150' | 'late_250'): 1.5 | 2.5 {
  return status === 'late_150' ? 1.5 : 2.5
}

// ── Exit time ─────────────────────────────────────────────────────────────────

/** Returns the expected exit time ('HH:MM') for the resolved rule. */
export function getExpectedExitTime(
  rule: AppliedRule,
  settings: AttendanceSettings
): string {
  if (rule === 'football') return settings.exit_time_football ?? '14:00'
  if (rule === 'friday')   return settings.exit_time_friday   ?? '13:00'
  return settings.exit_time_general ?? '17:00'
}

/** Formats 'HH:MM' (24-h) to '2:15 PM' style. */
export function formatExitTime(hhmm: string | undefined | null): string {
  if (!hhmm) return ''
  const [h, m] = hhmm.split(':').map(Number)
  const period = h >= 12 ? 'PM' : 'AM'
  const hour12 = h % 12 === 0 ? 12 : h % 12
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`
}

// ── Human-readable rule labels ────────────────────────────────────────────────

export const RULE_LABELS: Record<AppliedRule, string> = {
  general:  'Standard Rule',
  friday:   'Friday Rule',
  football: 'Football Rule',
  holiday:  'Holiday',
}

export const RULE_EMOJI: Record<AppliedRule, string> = {
  general:  '',
  friday:   '',
  football: '⚽',
  holiday:  '🏖️',
}
