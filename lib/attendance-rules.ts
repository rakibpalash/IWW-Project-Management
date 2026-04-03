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
    if (total <= toMinutes(settings.football_on_time_end))  return 'on_time'
    if (total <= toMinutes(settings.football_late_150_end)) return 'late_150'
    if (total <= toMinutes(settings.football_late_250_end)) return 'late_250'
    return 'advance_absence'
  }

  if (rule === 'friday') {
    if (total <= toMinutes(settings.friday_on_time_end))  return 'on_time'
    if (total <= toMinutes(settings.friday_late_150_end)) return 'late_150'
    if (total <= toMinutes(settings.friday_late_250_end)) return 'late_250'
    return 'absent'
  }

  // general
  if (total <= toMinutes(settings.on_time_end))  return 'on_time'
  if (total <= toMinutes(settings.late_150_end)) return 'late_150'
  if (total <= toMinutes(settings.late_250_end)) return 'late_250'
  return 'absent'
}

// ── Exit time ─────────────────────────────────────────────────────────────────

/** Returns the expected exit time ('HH:MM') for the resolved rule. */
export function getExpectedExitTime(
  rule: AppliedRule,
  settings: AttendanceSettings
): string {
  if (rule === 'football') return settings.exit_time_football
  if (rule === 'friday')   return settings.exit_time_friday
  return settings.exit_time_general
}

/** Formats 'HH:MM' (24-h) to '2:15 PM' style. */
export function formatExitTime(hhmm: string): string {
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
