'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { AttendanceRecord, AttendanceSettings, AttendanceStatus, AppliedRule } from '@/types'
import {
  getDayType,
  resolveAppliedRule,
  computeStatusForRule,
  getOnTimeEnd,
  computeSalaryFine,
  getFineMultiplier,
} from '@/lib/attendance-rules'
import { notify } from '@/lib/notifications'

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

    // ── Calculate fine: salary-based (per-minute) or fixed fallback ──────
    const typedSettings = settings as AttendanceSettings
    let fineAmount = 0
    let fineStatus: 'none' | 'pending' = 'none'
    let minutesLate = 0

    if (status === 'late_150' || status === 'late_250') {
      fineStatus = 'pending'

      // How many minutes late relative to on_time_end for this rule
      const onTimeEnd = getOnTimeEnd(appliedRule, typedSettings)
      const [onH, onM] = onTimeEnd.split(':').map(Number)
      const [ciH, ciM] = checkInTime.split(':').map(Number)
      minutesLate = Math.max(0, (ciH * 60 + ciM) - (onH * 60 + onM))

      // Try salary-based calculation (admin client bypasses RLS on staff_salaries)
      const admin = createAdminClient()
      const { data: salaryRecord } = await admin
        .from('staff_salaries')
        .select('monthly_salary')
        .eq('user_id', user.id)
        .maybeSingle()

      if (salaryRecord?.monthly_salary && minutesLate > 0) {
        // fine = minutes_late × (salary / monthly_work_min) × multiplier
        // multiplier: late_150 → 1.5×, late_250 → 2.5×
        const multiplier = getFineMultiplier(status)
        const workHours = typedSettings.work_hours_per_week ?? 30
        fineAmount = computeSalaryFine(checkInTime, onTimeEnd, salaryRecord.monthly_salary, workHours, multiplier)
      } else {
        // Fallback to org-configured fixed amounts
        fineAmount = status === 'late_150'
          ? (typedSettings.fine_late_1 ?? 150)
          : (typedSettings.fine_late_2 ?? 250)
      }
    }

    const { data: record, error } = await supabase
      .from('attendance_records')
      .insert({
        user_id: user.id,
        date: today,
        check_in_time: checkInTime,
        status,
        applied_rule: appliedRule,
        is_football_rule: isFootballRule,
        fine_amount: fineAmount,
        fine_status: fineStatus,
      })
      .select('*')
      .single()

    if (error || !record) {
      return { success: false, error: error?.message ?? 'Failed to check in' }
    }

    // ── Send in-app notification if a fine was imposed ────────────────────
    if (fineAmount > 0) {
      const lateDetail = minutesLate > 0
        ? ` (${minutesLate} min late)`
        : ''
      const paymentInstruction = typedSettings.org_bkash_number
        ? ` Send ৳${fineAmount} to bKash ${typedSettings.org_bkash_number} and report the TxnID in the Attendance page.`
        : ` Report your payment to your manager via the Attendance page.`

      await notify({
        userId: user.id,
        type: 'fine_imposed',
        title: `Late Fine: ৳${fineAmount}${lateDetail}`,
        message: `Check-in at ${checkInTime} on ${today}${lateDetail}. Fine: ৳${fineAmount}.${paymentInstruction}`,
        link: '/attendance',
      })
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

// ── Update fine status (admin only) ──────────────────────────────────────────

export async function updateFineStatusAction(
  recordId: string,
  fineStatus: 'paid' | 'waived',
  waivedReason?: string,
  paymentMethod?: string,
  bkashTxnId?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Not authenticated' }

    const { data: profile } = await supabase
      .from('profiles').select('role').eq('id', user.id).single()
    if (!profile || profile.role !== 'super_admin') {
      return { success: false, error: 'Unauthorized' }
    }

    const payload: Record<string, unknown> = {
      fine_status: fineStatus,
      updated_at: new Date().toISOString(),
    }
    if (fineStatus === 'paid') {
      payload.fine_paid_at = new Date().toISOString()
      payload.fine_payment_method = paymentMethod ?? 'cash'
      payload.fine_bkash_txn_id = bkashTxnId && bkashTxnId.trim() ? bkashTxnId.trim() : null
      payload.fine_waived_by = null
      payload.fine_waived_reason = null
    } else if (fineStatus === 'waived') {
      payload.fine_waived_by = user.id
      payload.fine_waived_reason = waivedReason ?? null
      payload.fine_paid_at = null
      payload.fine_payment_method = null
      payload.fine_bkash_txn_id = null
    }

    const { error } = await supabase
      .from('attendance_records')
      .update(payload)
      .eq('id', recordId)

    if (error) return { success: false, error: error.message }

    revalidatePath('/attendance')
    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

// ── Get monthly fine summary (admin) ─────────────────────────────────────────

export async function getMonthlyFinesSummaryAction(
  year: number,
  month: number   // 1-12
): Promise<{
  data?: {
    userId: string
    fullName: string
    avatarUrl: string | null
    pendingCount: number
    pendingTotal: number
    paidTotal: number
    waivedTotal: number
  }[]
  error?: string
}> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Not authenticated' }

    const { data: profile } = await supabase
      .from('profiles').select('role').eq('id', user.id).single()
    if (!profile || profile.role !== 'super_admin') return { error: 'Unauthorized' }

    const monthStr = `${year}-${String(month).padStart(2, '0')}`
    const { data: records } = await supabase
      .from('attendance_records')
      .select('user_id, fine_amount, fine_status, user:profiles!user_id(id, full_name, avatar_url)')
      .gte('date', `${monthStr}-01`)
      .lte('date', `${monthStr}-31`)
      .in('fine_status', ['pending', 'paid', 'waived'])
      .gt('fine_amount', 0)

    if (!records) return { data: [] }

    const map = new Map<string, {
      userId: string; fullName: string; avatarUrl: string | null
      pendingCount: number; pendingTotal: number; paidTotal: number; waivedTotal: number
    }>()

    for (const r of records) {
      const profile = r.user as unknown as { id: string; full_name: string; avatar_url: string | null } | null
      const uid = r.user_id
      if (!map.has(uid)) {
        map.set(uid, {
          userId: uid,
          fullName: profile?.full_name ?? 'Unknown',
          avatarUrl: profile?.avatar_url ?? null,
          pendingCount: 0, pendingTotal: 0, paidTotal: 0, waivedTotal: 0,
        })
      }
      const entry = map.get(uid)!
      if (r.fine_status === 'pending') { entry.pendingCount++; entry.pendingTotal += r.fine_amount }
      else if (r.fine_status === 'paid')   { entry.paidTotal   += r.fine_amount }
      else if (r.fine_status === 'waived') { entry.waivedTotal += r.fine_amount }
    }

    return { data: Array.from(map.values()).sort((a, b) => b.pendingTotal - a.pendingTotal) }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

// ── Staff: report bKash payment for a pending fine ───────────────────────────

export async function reportFinePaymentAction(
  recordId: string,
  bkashTxnId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Not authenticated' }

    // Verify the record belongs to this user and is pending
    const { data: record, error: recordError } = await supabase
      .from('attendance_records')
      .select('id, fine_status, fine_amount, date, user_id')
      .eq('id', recordId)
      .eq('user_id', user.id)
      .single()

    if (recordError || !record) return { success: false, error: 'Record not found' }
    if (record.fine_status !== 'pending') {
      return { success: false, error: 'This fine is no longer pending' }
    }
    if (!bkashTxnId.trim()) return { success: false, error: 'Transaction ID is required' }

    // Save the staff-submitted TxnID
    const { error } = await supabase
      .from('attendance_records')
      .update({
        fine_reported_txn_id: bkashTxnId.trim(),
        fine_reported_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', recordId)
      .eq('user_id', user.id)

    if (error) return { success: false, error: error.message }

    // Notify all super_admins in this org
    const admin = createAdminClient()
    const { data: staffProfile } = await admin
      .from('profiles')
      .select('full_name, organization_id')
      .eq('id', user.id)
      .single()

    const orgId = staffProfile?.organization_id
    if (orgId) {
      const { data: admins } = await admin
        .from('profiles')
        .select('id')
        .eq('organization_id', orgId)
        .eq('role', 'super_admin')

      if (admins && admins.length > 0) {
        await admin.from('notifications').insert(
          admins.map((a) => ({
            user_id: a.id,
            type: 'fine_imposed',
            title: `Fine Payment Reported`,
            message: `${staffProfile?.full_name ?? 'A staff member'} reported bKash payment (TxnID: ${bkashTxnId.trim()}) for ৳${record.fine_amount} fine on ${record.date}. Please verify and mark as paid.`,
            link: '/attendance',
            is_read: false,
          }))
        )
      }
    }

    revalidatePath('/attendance')
    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

// ── Staff: report monthly fine payment (one TxnID covers all fines in a month) ─

export async function reportMonthlyFinePaymentAction(
  year: number,
  month: number,
  txnId: string
): Promise<{ success: boolean; count?: number; error?: string }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Not authenticated' }
    if (!txnId.trim()) return { success: false, error: 'Transaction ID is required' }

    const monthStr = `${year}-${String(month).padStart(2, '0')}`

    // All pending fines for this user in this month (reported or not)
    const { data: records, error: fetchErr } = await supabase
      .from('attendance_records')
      .select('id, fine_amount, date')
      .eq('user_id', user.id)
      .eq('fine_status', 'pending')
      .gte('date', `${monthStr}-01`)
      .lte('date', `${monthStr}-31`)
      .gt('fine_amount', 0)

    if (fetchErr) return { success: false, error: fetchErr.message }
    if (!records || records.length === 0) return { success: false, error: 'No pending fines found for this month' }

    const { error: updateErr } = await supabase
      .from('attendance_records')
      .update({
        fine_reported_txn_id: txnId.trim(),
        fine_reported_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .in('id', records.map((r) => r.id))
      .eq('user_id', user.id)

    if (updateErr) return { success: false, error: updateErr.message }

    // Notify admins
    const admin = createAdminClient()
    const { data: staffProfile } = await admin
      .from('profiles')
      .select('full_name, organization_id')
      .eq('id', user.id)
      .single()

    const orgId = staffProfile?.organization_id
    const totalAmount = records.reduce((s, r) => s + r.fine_amount, 0)
    const monthName = new Date(year, month - 1).toLocaleString('en', { month: 'long' })

    if (orgId) {
      const { data: admins } = await admin
        .from('profiles')
        .select('id')
        .eq('organization_id', orgId)
        .eq('role', 'super_admin')

      if (admins && admins.length > 0) {
        await admin.from('notifications').insert(
          admins.map((a) => ({
            user_id: a.id,
            type: 'fine_imposed',
            title: 'Monthly Fine Payment Reported',
            message: `${staffProfile?.full_name ?? 'A staff member'} reported bKash payment (TxnID: ${txnId.trim()}) for ৳${totalAmount} covering ${records.length} late day(s) in ${monthName} ${year}. Please verify.`,
            link: '/attendance',
            is_read: false,
          }))
        )
      }
    }

    revalidatePath('/attendance')
    return { success: true, count: records.length }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

// ── Admin: verify and close all fines for a user+month in one action ──────────

export async function verifyMonthlyFinesAction(
  recordIds: string[],
  action: 'paid' | 'waived',
  txnId?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Not authenticated' }

    const { data: profile } = await supabase
      .from('profiles').select('role').eq('id', user.id).single()
    if (!profile || profile.role !== 'super_admin') {
      return { success: false, error: 'Unauthorized' }
    }

    const payload: Record<string, unknown> = {
      fine_status: action,
      updated_at: new Date().toISOString(),
    }
    if (action === 'paid') {
      payload.fine_paid_at = new Date().toISOString()
      payload.fine_payment_method = 'bkash'
      payload.fine_bkash_txn_id = txnId ?? null
      payload.fine_waived_by = null
      payload.fine_waived_reason = null
    } else {
      payload.fine_waived_by = user.id
      payload.fine_waived_reason = null
      payload.fine_paid_at = null
      payload.fine_payment_method = null
      payload.fine_bkash_txn_id = null
    }

    const { error } = await supabase
      .from('attendance_records')
      .update(payload)
      .in('id', recordIds)

    if (error) return { success: false, error: error.message }

    revalidatePath('/attendance')
    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

// ── Admin: get fines awaiting verification — grouped by staff + month ─────────

export async function getPendingVerificationFinesAction(): Promise<{
  data?: {
    userId: string
    fullName: string
    avatarUrl: string | null
    year: number
    month: number
    totalAmount: number
    count: number
    txnId: string
    reportedAt: string
    recordIds: string[]
  }[]
  error?: string
}> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Not authenticated' }

    const { data: profile } = await supabase
      .from('profiles').select('role').eq('id', user.id).single()
    if (!profile || profile.role !== 'super_admin') return { error: 'Unauthorized' }

    const admin = createAdminClient()
    const { data: records, error } = await admin
      .from('attendance_records')
      .select('id, date, fine_amount, fine_reported_txn_id, fine_reported_at, user_id, user:profiles!user_id(full_name, avatar_url)')
      .eq('fine_status', 'pending')
      .not('fine_reported_txn_id', 'is', null)
      .order('fine_reported_at', { ascending: false })

    if (error) return { error: error.message }

    // Group by user_id + year-month
    const groups = new Map<string, {
      userId: string
      fullName: string
      avatarUrl: string | null
      year: number
      month: number
      totalAmount: number
      count: number
      txnId: string
      reportedAt: string
      recordIds: string[]
    }>()

    for (const r of records ?? []) {
      const [year, month] = (r.date as string).split('-').map(Number)
      const key = `${r.user_id}-${year}-${month}`
      if (!groups.has(key)) {
        groups.set(key, {
          userId: r.user_id,
          fullName: (r as any).user?.full_name ?? 'Unknown',
          avatarUrl: (r as any).user?.avatar_url ?? null,
          year,
          month,
          totalAmount: 0,
          count: 0,
          txnId: r.fine_reported_txn_id,
          reportedAt: r.fine_reported_at,
          recordIds: [],
        })
      }
      const g = groups.get(key)!
      g.totalAmount += r.fine_amount
      g.count++
      g.recordIds.push(r.id)
      if (r.fine_reported_at > g.reportedAt) {
        g.reportedAt = r.fine_reported_at
        g.txnId = r.fine_reported_txn_id
      }
    }

    return { data: Array.from(groups.values()) }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

// ── Admin: save (insert/update) attendance record ────────────────────────────

export async function adminSaveAttendanceRecordAction(data: {
  id: string | null
  userId: string
  date: string
  checkIn: string | null
  checkOut: string | null
  status: string
  appliedRule: string
  isFootball: boolean
}): Promise<{ success: boolean; record?: AttendanceRecord; error?: string }> {
  try {
    const supabase = await createClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) return { success: false, error: 'Not authenticated' }

    const { data: profile } = await supabase
      .from('profiles').select('role').eq('id', user.id).single()
    if (!profile || profile.role !== 'super_admin') {
      return { success: false, error: 'Insufficient permissions' }
    }

    // Use admin client so this always works regardless of RLS
    const admin = createAdminClient()
    const profileSelect = 'id, full_name, avatar_url, email, role, is_temp_password, onboarding_completed, created_at, updated_at'

    const payload = {
      check_in_time: data.checkIn || null,
      check_out_time: data.checkOut || null,
      status: data.status,
      applied_rule: data.appliedRule,
      is_football_rule: data.isFootball,
      updated_at: new Date().toISOString(),
    }

    let record: AttendanceRecord

    if (data.id) {
      const { data: updated, error } = await admin
        .from('attendance_records')
        .update(payload)
        .eq('id', data.id)
        .select(`*, user:profiles!user_id(${profileSelect})`)
        .single()
      if (error) return { success: false, error: error.message }
      record = updated as unknown as AttendanceRecord
    } else {
      const { data: inserted, error } = await admin
        .from('attendance_records')
        .insert({ user_id: data.userId, date: data.date, ...payload })
        .select(`*, user:profiles!user_id(${profileSelect})`)
        .single()
      if (error) return { success: false, error: error.message }
      record = inserted as unknown as AttendanceRecord
    }

    revalidatePath('/attendance')
    return { success: true, record }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) }
  }
}

// ── Get detailed fine records for monthly report export (admin) ───────────────

export async function getMonthlyFinesDetailAction(
  year: number,
  month: number
): Promise<{
  data?: {
    fullName: string
    date: string
    checkInTime: string | null
    status: string
    fineAmount: number
    fineStatus: string
    paymentMethod: string | null
    bkashTxnId: string | null
    waivedReason: string | null
  }[]
  error?: string
}> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Not authenticated' }

    const { data: profile } = await supabase
      .from('profiles').select('role').eq('id', user.id).single()
    if (!profile || profile.role !== 'super_admin') return { error: 'Unauthorized' }

    const monthStr = `${year}-${String(month).padStart(2, '0')}`
    const { data: records } = await supabase
      .from('attendance_records')
      .select(`
        date, check_in_time, status,
        fine_amount, fine_status,
        fine_payment_method, fine_bkash_txn_id, fine_waived_reason,
        user:profiles!user_id(full_name)
      `)
      .gte('date', `${monthStr}-01`)
      .lte('date', `${monthStr}-31`)
      .gt('fine_amount', 0)
      .order('date', { ascending: true })

    if (!records) return { data: [] }

    return {
      data: records.map((r) => ({
        fullName: (r.user as unknown as { full_name: string } | null)?.full_name ?? 'Unknown',
        date: r.date,
        checkInTime: r.check_in_time,
        status: r.status,
        fineAmount: r.fine_amount,
        fineStatus: r.fine_status,
        paymentMethod: r.fine_payment_method ?? null,
        bkashTxnId: r.fine_bkash_txn_id ?? null,
        waivedReason: r.fine_waived_reason ?? null,
      })),
    }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Unknown error' }
  }
}
