'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

async function notifyUser(
  userId: string,
  title: string,
  message: string,
  link?: string
) {
  const admin = createAdminClient()
  await admin.from('notifications').insert({
    user_id: userId,
    type: 'status_changed',
    title,
    message,
    link: link ?? null,
    is_read: false,
  })
}

export async function approveLeaveAction(
  requestId: string,
  notes: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Verify caller is super_admin
    const supabase = await createClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) return { success: false, error: 'Not authenticated' }

    const { data: caller } = await supabase
      .from('profiles').select('role').eq('id', user.id).single()
    if (!caller || caller.role !== 'super_admin') {
      return { success: false, error: 'Unauthorized' }
    }

    // Use admin client for all DB writes to bypass RLS
    const admin = createAdminClient()

    const { data: request, error: fetchError } = await admin
      .from('leave_requests').select('*').eq('id', requestId).single()
    if (fetchError || !request) return { success: false, error: 'Leave request not found' }
    if (request.status !== 'pending') return { success: false, error: 'Request is not in pending state' }

    const { error: updateError } = await admin
      .from('leave_requests')
      .update({
        status: 'approved',
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
        review_notes: notes || null,
      })
      .eq('id', requestId)

    if (updateError) return { success: false, error: updateError.message }

    // Update leave balance — upsert so missing records don't silently skip the update
    const currentYear = new Date(request.start_date).getFullYear()
    const leaveType = request.leave_type as string

    const { data: balance } = await admin
      .from('leave_balances')
      .select('*')
      .eq('user_id', request.user_id)
      .eq('year', currentYear)
      .single()

    if (balance) {
      // Record exists — increment the correct counter
      let updateData: Record<string, number> = {}
      if (leaveType === 'yearly') {
        updateData = { yearly_used: (balance.yearly_used ?? 0) + request.total_days }
      } else if (leaveType === 'work_from_home') {
        updateData = { wfh_used: (balance.wfh_used ?? 0) + request.total_days }
      } else if (leaveType === 'marriage') {
        updateData = { marriage_used: (balance.marriage_used ?? 0) + request.total_days }
      }
      if (Object.keys(updateData).length > 0) {
        await admin.from('leave_balances').update(updateData).eq('id', balance.id)
      }
    } else {
      // No balance record exists — create one with the correct used days set
      await admin.from('leave_balances').insert({
        user_id: request.user_id,
        year: currentYear,
        yearly_total: 18,
        yearly_used: leaveType === 'yearly' ? request.total_days : 0,
        wfh_total: 10,
        wfh_used: leaveType === 'work_from_home' ? request.total_days : 0,
        marriage_total: leaveType === 'marriage' ? request.total_days : 0,
        marriage_used: leaveType === 'marriage' ? request.total_days : 0,
      })
    }

    // Notify the staff member
    const leaveTypeLabel =
      request.leave_type === 'yearly' ? 'Annual Leave'
      : request.leave_type === 'work_from_home' ? 'Work From Home'
      : 'Marriage Leave'

    await notifyUser(
      request.user_id,
      'Leave Request Approved ✓',
      `Your ${leaveTypeLabel} request (${request.total_days} day${request.total_days !== 1 ? 's' : ''}) has been approved.${notes ? ` Note: ${notes}` : ''}`,
      '/leave'
    )

    revalidatePath('/leave')
    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return { success: false, error: message }
  }
}

export async function rejectLeaveAction(
  requestId: string,
  notes: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Verify caller is super_admin
    const supabase = await createClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) return { success: false, error: 'Not authenticated' }

    const { data: caller } = await supabase
      .from('profiles').select('role').eq('id', user.id).single()
    if (!caller || caller.role !== 'super_admin') {
      return { success: false, error: 'Unauthorized' }
    }

    // Use admin client for DB writes to bypass RLS
    const admin = createAdminClient()

    const { data: request } = await admin
      .from('leave_requests').select('*').eq('id', requestId).single()

    const { error: updateError } = await admin
      .from('leave_requests')
      .update({
        status: 'rejected',
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
        review_notes: notes || null,
      })
      .eq('id', requestId)
      .eq('status', 'pending')

    if (updateError) return { success: false, error: updateError.message }

    // Notify the staff member
    if (request) {
      const leaveTypeLabel =
        request.leave_type === 'yearly' ? 'Annual Leave'
        : request.leave_type === 'work_from_home' ? 'Work From Home'
        : 'Marriage Leave'

      await notifyUser(
        request.user_id,
        'Leave Request Rejected',
        `Your ${leaveTypeLabel} request (${request.total_days} day${request.total_days !== 1 ? 's' : ''}) has been rejected.${notes ? ` Reason: ${notes}` : ''}`,
        '/leave'
      )
    }

    revalidatePath('/leave')
    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return { success: false, error: message }
  }
}

export async function cancelLeaveAction(
  requestId: string
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

    const { error: updateError } = await supabase
      .from('leave_requests')
      .update({ status: 'cancelled' })
      .eq('id', requestId)
      .eq('user_id', user.id)
      .eq('status', 'pending')

    if (updateError) {
      return { success: false, error: updateError.message }
    }

    revalidatePath('/leave')
    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return { success: false, error: message }
  }
}

export async function grantMarriageLeaveAction(
  userId: string,
  days: number
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

    const { data: caller } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!caller || caller.role !== 'super_admin') {
      return { success: false, error: 'Unauthorized' }
    }

    const currentYear = new Date().getFullYear()

    // Check if balance record exists
    const { data: balance, error: balanceError } = await supabase
      .from('leave_balances')
      .select('*')
      .eq('user_id', userId)
      .eq('year', currentYear)
      .single()

    if (balanceError || !balance) {
      // Create new balance record
      const { error: insertError } = await supabase.from('leave_balances').insert({
        user_id: userId,
        year: currentYear,
        yearly_total: 18,
        yearly_used: 0,
        wfh_total: 10,
        wfh_used: 0,
        marriage_total: days,
        marriage_used: 0,
      })

      if (insertError) {
        return { success: false, error: insertError.message }
      }
    } else {
      // Update existing balance
      const { error: updateError } = await supabase
        .from('leave_balances')
        .update({ marriage_total: balance.marriage_total + days })
        .eq('id', balance.id)

      if (updateError) {
        return { success: false, error: updateError.message }
      }
    }

    revalidatePath('/leave')
    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return { success: false, error: message }
  }
}

export async function applyLeaveAction(data: {
  leave_type: string
  start_date: string
  end_date: string
  total_days: number
  reason: string
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

    const currentYear = new Date(data.start_date).getFullYear()

    // Auto-create a balance record with defaults if none exists yet
    const { data: existing } = await supabase
      .from('leave_balances')
      .select('id')
      .eq('user_id', user.id)
      .eq('year', currentYear)
      .single()

    if (!existing) {
      await supabase.from('leave_balances').insert({
        user_id: user.id,
        year: currentYear,
        yearly_total: 18,
        yearly_used: 0,
        wfh_total: 10,
        wfh_used: 0,
        marriage_total: 0,
        marriage_used: 0,
      })
    }

    const { error: insertError } = await supabase.from('leave_requests').insert({
      user_id: user.id,
      leave_type: data.leave_type,
      start_date: data.start_date,
      end_date: data.end_date,
      total_days: data.total_days,
      reason: data.reason || null,
      status: 'pending',
    })

    if (insertError) {
      return { success: false, error: insertError.message }
    }

    revalidatePath('/leave')
    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return { success: false, error: message }
  }
}

// ─── Optional Leave Actions ────────────────────────────────────────────────────

export async function createOptionalLeaveAction(data: {
  name: string
  userId: string
  totalDays: number
  notes?: string
}): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Not authenticated' }
    const { data: caller } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    if (!caller || caller.role !== 'super_admin') return { success: false, error: 'Unauthorized' }

    const admin = createAdminClient()
    const year = new Date().getFullYear()
    const { error } = await admin.from('optional_leaves').insert({
      name: data.name.trim(),
      user_id: data.userId,
      granted_by: user.id,
      total_days: data.totalDays,
      used_days: 0,
      year,
      notes: data.notes?.trim() || null,
    })
    if (error) return { success: false, error: error.message }

    await notifyUser(data.userId, 'Optional Leave Granted',
      `You've been granted ${data.totalDays} day${data.totalDays !== 1 ? 's' : ''} of "${data.name}" leave.`, '/leave')

    revalidatePath('/leave')
    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

export async function applyOptionalLeaveAction(data: {
  optionalLeaveId: string
  startDate: string
  endDate: string
  totalDays: number
  reason?: string
}): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Not authenticated' }
    const admin = createAdminClient()

    const { data: grant } = await admin.from('optional_leaves')
      .select('*').eq('id', data.optionalLeaveId).eq('user_id', user.id).single()
    if (!grant) return { success: false, error: 'Optional leave grant not found' }
    const available = grant.total_days - (grant.used_days ?? 0)
    if (data.totalDays > available) return { success: false, error: `Only ${available} day(s) available` }

    const { error } = await admin.from('leave_requests').insert({
      user_id: user.id,
      leave_type: 'optional',
      optional_leave_id: data.optionalLeaveId,
      start_date: data.startDate,
      end_date: data.endDate,
      total_days: data.totalDays,
      reason: data.reason?.trim() || null,
      status: 'pending',
    })
    if (error) return { success: false, error: error.message }

    revalidatePath('/leave')
    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

export async function approveOptionalLeaveAction(
  requestId: string, notes: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Not authenticated' }
    const { data: caller } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    if (!caller || caller.role !== 'super_admin') return { success: false, error: 'Unauthorized' }

    const admin = createAdminClient()
    const { data: request } = await admin.from('leave_requests').select('*').eq('id', requestId).single()
    if (!request || request.status !== 'pending') return { success: false, error: 'Request not found or not pending' }

    await admin.from('leave_requests').update({
      status: 'approved', reviewed_by: user.id,
      reviewed_at: new Date().toISOString(), review_notes: notes || null,
    }).eq('id', requestId)

    if (request.optional_leave_id) {
      const { data: grant } = await admin.from('optional_leaves')
        .select('used_days').eq('id', request.optional_leave_id).single()
      if (grant) {
        await admin.from('optional_leaves').update({
          used_days: (grant.used_days ?? 0) + request.total_days,
        }).eq('id', request.optional_leave_id)
      }
    }

    await notifyUser(request.user_id, 'Optional Leave Approved',
      'Your optional leave request has been approved.', '/leave')

    revalidatePath('/leave')
    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

// ─── Leave Template Actions ────────────────────────────────────────────────────

export async function getOptionalLeaveTemplatesAction(): Promise<{
  success: boolean
  data?: Array<{ id: string; name: string; default_days: number; is_builtin: boolean }>
  error?: string
}> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('optional_leave_templates')
      .select('id, name, default_days, is_builtin')
      .order('is_builtin', { ascending: false })
      .order('created_at', { ascending: true })
    if (error) return { success: false, error: error.message }
    return { success: true, data: data ?? [] }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

export async function createOptionalLeaveTemplateAction(data: {
  name: string
  default_days: number
}): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Not authenticated' }
    const admin = createAdminClient()
    const { data: caller } = await admin.from('profiles').select('role, organization_id').eq('id', user.id).single()
    if (!caller || caller.role !== 'super_admin') return { success: false, error: 'Unauthorized' }

    const { data: row, error } = await admin.from('optional_leave_templates').insert({
      name: data.name.trim(),
      default_days: data.default_days,
      is_builtin: false,
      created_by: user.id,
      organization_id: caller.organization_id,
    }).select('id').single()
    if (error) return { success: false, error: error.message }
    return { success: true, id: row.id }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

export async function updateOptionalLeaveTemplateAction(
  id: string,
  data: { name: string; default_days: number }
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Not authenticated' }
    const { data: caller } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    if (!caller || caller.role !== 'super_admin') return { success: false, error: 'Unauthorized' }

    const admin = createAdminClient()
    const { error } = await admin.from('optional_leave_templates')
      .update({ name: data.name.trim(), default_days: data.default_days, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (error) return { success: false, error: error.message }
    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

export async function checkOptionalLeaveTemplateUsageAction(
  name: string
): Promise<{ success: boolean; count?: number; error?: string }> {
  try {
    const supabase = await createClient()
    const { count, error } = await supabase
      .from('optional_leaves')
      .select('id', { count: 'exact', head: true })
      .ilike('name', name)
    if (error) return { success: false, error: error.message }
    return { success: true, count: count ?? 0 }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

export async function revokeOptionalLeaveGrantsByNameAction(
  name: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Not authenticated' }
    const { data: caller } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    if (!caller || caller.role !== 'super_admin') return { success: false, error: 'Unauthorized' }

    const admin = createAdminClient()
    const { error } = await admin.from('optional_leaves').delete().ilike('name', name)
    if (error) return { success: false, error: error.message }
    revalidatePath('/leave')
    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

export async function deleteOptionalLeaveTemplateAction(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Not authenticated' }
    const { data: caller } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    if (!caller || caller.role !== 'super_admin') return { success: false, error: 'Unauthorized' }

    const admin = createAdminClient()
    // Prevent deleting built-in templates
    const { data: tmpl } = await admin.from('optional_leave_templates').select('is_builtin').eq('id', id).single()
    if (tmpl?.is_builtin) return { success: false, error: 'Cannot delete built-in templates' }

    const { error } = await admin.from('optional_leave_templates').delete().eq('id', id)
    if (error) return { success: false, error: error.message }
    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

export async function deleteOptionalLeaveAction(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Not authenticated' }
    const { data: caller } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    if (!caller || caller.role !== 'super_admin') return { success: false, error: 'Unauthorized' }

    const admin = createAdminClient()
    const { error } = await admin.from('optional_leaves').delete().eq('id', id)
    if (error) return { success: false, error: error.message }
    revalidatePath('/leave')
    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}
