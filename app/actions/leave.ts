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

    // Update leave balance
    const currentYear = new Date(request.start_date).getFullYear()
    const { data: balance } = await admin
      .from('leave_balances')
      .select('*')
      .eq('user_id', request.user_id)
      .eq('year', currentYear)
      .single()

    if (balance) {
      const leaveType = request.leave_type as string
      let updateData: Record<string, number> = {}
      if (leaveType === 'yearly') updateData = { yearly_used: balance.yearly_used + request.total_days }
      else if (leaveType === 'work_from_home') updateData = { wfh_used: balance.wfh_used + request.total_days }
      else if (leaveType === 'marriage') updateData = { marriage_used: balance.marriage_used + request.total_days }
      if (Object.keys(updateData).length > 0) {
        await admin.from('leave_balances').update(updateData).eq('id', balance.id)
      }
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
