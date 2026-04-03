'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { AttendanceRecord, AttendanceSettings, AttendanceStatus, AppliedRule } from '@/types'
import {
  getDayType,
  resolveAppliedRule,
  computeStatusForRule,
} from '@/lib/attendance-rules'

// ── Check in ──────────────────────────────────────────────────────────────────

export async function checkInAction(): Promise<{
  success: boolean
  record?: AttendanceRecord
  error?: string
}> {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return { success: false, error: 'Not authenticated' }
    }

    const now = new Date()
    const today = now.toISOString().slice(0, 10)

    // ── Rule priority 1: Sunday → holiday, block check-in ─────────────────
    const dayType = getDayType(now)
    if (dayType === 'sunday') {
      return { success: false, error: 'Today is a public holiday (Sunday). No attendance required.' }
    }

    // ── Prevent duplicate check-ins ───────────────────────────────────────
    const { data: existing } = await supabase
      .from('attendance_records')
      .select('id')
      .eq('user_id', user.id)
      .eq('date', today)
      .maybeSingle()

    if (existing) {
      return { success: false, error: 'Already checked in today' }
    }

    // ── Fetch settings ────────────────────────────────────────────────────
    const { data: settings } = await supabase
      .from('attendance_settings')
      .select('*')
      .single()

    if (!settings) {
      return { success: false, error: 'Attendance settings not configured' }
    }

    // ── Rule priority 2: Football assignment overrides Friday/General ─────
    const { data: footballRule } = await supabase
      .from('football_rules')
      .select('user_ids')
      .eq('date', today)
      .maybeSingle()

    const isFootballRule = footballRule?.user_ids?.includes(user.id) ?? false

    // ── Resolve applied rule (sunday already blocked above) ───────────────
    const appliedRule: AppliedRule = resolveAppliedRule(dayType, isFootballRule)

    // ── Compute status from check-in time ─────────────────────────────────
    const checkInTime = now.toTimeString().slice(0, 5) // 'HH:MM'
    const status = computeStatusForRule(
      checkInTime,
      appliedRule,
      settings as AttendanceSettings
    )

    const { data: record, error } = await supabase
      .from('attendance_records')
      .insert({
        user_id: user.id,
        date: today,
        check_in_time: checkInTime,
        status,
        applied_rule: appliedRule,
        is_football_rule: isFootballRule,
      })
      .select('*')
      .single()

    if (error || !record) {
      return { success: false, error: error?.message ?? 'Failed to check in' }
    }

    revalidatePath('/attendance')
    revalidatePath('/dashboard')

    return { success: true, record: record as AttendanceRecord }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return { success: false, error: message }
  }
}

// ── Check out ─────────────────────────────────────────────────────────────────

export async function checkOutAction(
  recordId: string
): Promise<{ success: boolean; record?: AttendanceRecord; error?: string }> {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return { success: false, error: 'Not authenticated' }
    }

    const { data: existing } = await supabase
      .from('attendance_records')
      .select('*')
      .eq('id', recordId)
      .eq('user_id', user.id)
      .single()

    if (!existing) {
      return { success: false, error: 'Attendance record not found' }
    }

    if (existing.check_out_time) {
      return { success: false, error: 'Already checked out' }
    }

    const checkOutTime = new Date().toTimeString().slice(0, 5) // 'HH:MM'

    const { data: record, error } = await supabase
      .from('attendance_records')
      .update({
        check_out_time: checkOutTime,
        updated_at: new Date().toISOString(),
      })
      .eq('id', recordId)
      .select('*')
      .single()

    if (error || !record) {
      return { success: false, error: error?.message ?? 'Failed to check out' }
    }

    revalidatePath('/attendance')
    revalidatePath('/dashboard')

    return { success: true, record: record as AttendanceRecord }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return { success: false, error: message }
  }
}

// ── Admin: set attendance ─────────────────────────────────────────────────────

export async function adminSetAttendanceAction(data: {
  user_id: string
  date: string
  status: AttendanceStatus
  applied_rule?: AppliedRule
  check_in_time?: string
  check_out_time?: string
}): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return { success: false, error: 'Not authenticated' }
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || profile.role !== 'super_admin') {
      return { success: false, error: 'Insufficient permissions' }
    }

    // Derive applied_rule from date if not supplied
    let appliedRule: AppliedRule = data.applied_rule ?? 'general'
    if (!data.applied_rule) {
      const targetDate = new Date(data.date + 'T00:00:00')
      const dayType = getDayType(targetDate)

      // Check football rule for the target date and user
      const { data: footballRule } = await supabase
        .from('football_rules')
        .select('user_ids')
        .eq('date', data.date)
        .maybeSingle()

      const isFootball = footballRule?.user_ids?.includes(data.user_id) ?? false
      appliedRule = resolveAppliedRule(dayType, isFootball)
    }

    const payload: Record<string, unknown> = {
      user_id: data.user_id,
      date: data.date,
      status: data.status,
      applied_rule: appliedRule,
      is_football_rule: appliedRule === 'football',
      check_in_time: data.check_in_time ?? null,
      check_out_time: data.check_out_time ?? null,
      updated_at: new Date().toISOString(),
    }

    const { error } = await supabase
      .from('attendance_records')
      .upsert(payload, { onConflict: 'user_id,date' })

    if (error) {
      return { success: false, error: error.message }
    }

    revalidatePath('/attendance')

    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return { success: false, error: message }
  }
}

// ── Set Football Rule ─────────────────────────────────────────────────────────

export async function setFootballRuleAction(data: {
  date: string
  user_ids: string[]
}): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return { success: false, error: 'Not authenticated' }
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || profile.role !== 'super_admin') {
      return { success: false, error: 'Insufficient permissions' }
    }

    // Block setting football rule on Sunday (holiday)
    const targetDate = new Date(data.date + 'T00:00:00')
    if (getDayType(targetDate) === 'sunday') {
      return { success: false, error: 'Cannot set football rule on a Sunday (holiday)' }
    }

    const { error } = await supabase
      .from('football_rules')
      .upsert(
        { date: data.date, user_ids: data.user_ids, created_by: user.id },
        { onConflict: 'date' }
      )

    if (error) {
      return { success: false, error: error.message }
    }

    revalidatePath('/attendance')

    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return { success: false, error: message }
  }
}

// ── Update attendance settings ────────────────────────────────────────────────

export async function updateAttendanceSettingsAction(
  data: Partial<AttendanceSettings>
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return { success: false, error: 'Not authenticated' }
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || profile.role !== 'super_admin') {
      return { success: false, error: 'Insufficient permissions' }
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id: _id, ...updatePayload } = data as AttendanceSettings

    const payload = {
      ...updatePayload,
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    }

    const { error } = await supabase
      .from('attendance_settings')
      .update(payload)
      .neq('id', '')

    if (error) {
      return { success: false, error: error.message }
    }

    revalidatePath('/attendance')
    revalidatePath('/settings')

    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return { success: false, error: message }
  }
}
