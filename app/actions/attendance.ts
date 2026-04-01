'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { AttendanceRecord, AttendanceSettings, AttendanceStatus } from '@/types'

// ── Helpers ───────────────────────────────────────────────────────────────────

function getAttendanceStatus(
  checkInTime: string,
  settings: AttendanceSettings,
  isFootballRule: boolean
): AttendanceStatus {
  const timePart = checkInTime.substring(11, 16) // 'HH:MM' from ISO string

  const onTimeEnd = isFootballRule
    ? settings.football_on_time_end
    : settings.on_time_end

  const late150End = isFootballRule
    ? settings.football_late_150_end
    : settings.late_150_end

  const late250End = isFootballRule
    ? settings.football_late_250_end
    : settings.late_250_end

  if (timePart <= onTimeEnd) return 'on_time'
  if (timePart <= late150End) return 'late_150'
  if (timePart <= late250End) return 'late_250'
  return 'absent'
}

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

    const today = new Date().toISOString().slice(0, 10)
    const now = new Date().toISOString()

    // Prevent duplicate check-ins
    const { data: existing } = await supabase
      .from('attendance_records')
      .select('id')
      .eq('user_id', user.id)
      .eq('date', today)
      .maybeSingle()

    if (existing) {
      return { success: false, error: 'Already checked in today' }
    }

    // Fetch attendance settings
    const { data: settings } = await supabase
      .from('attendance_settings')
      .select('*')
      .single()

    // Check if Football Rule applies today for this user
    const { data: footballRule } = await supabase
      .from('football_rules')
      .select('user_ids')
      .eq('date', today)
      .maybeSingle()

    const isFootballRule =
      footballRule?.user_ids?.includes(user.id) ?? false

    const status = settings
      ? getAttendanceStatus(now, settings as AttendanceSettings, isFootballRule)
      : 'on_time'

    const { data: record, error } = await supabase
      .from('attendance_records')
      .insert({
        user_id: user.id,
        date: today,
        check_in_time: now,
        status,
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

    const { data: record, error } = await supabase
      .from('attendance_records')
      .update({
        check_out_time: new Date().toISOString(),
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

    // Verify admin role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || profile.role !== 'super_admin') {
      return { success: false, error: 'Insufficient permissions' }
    }

    const payload: Record<string, unknown> = {
      user_id: data.user_id,
      date: data.date,
      status: data.status,
      check_in_time: data.check_in_time ?? null,
      check_out_time: data.check_out_time ?? null,
      updated_at: new Date().toISOString(),
    }

    // Upsert – create or overwrite
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

    // Upsert football rule for the given date
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

    // Remove id from payload to avoid overwriting PK
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
      .neq('id', '') // update the single settings row

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
