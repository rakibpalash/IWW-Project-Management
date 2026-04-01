'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function approveLeaveAction(
  requestId: string,
  notes: string
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

    // Fetch the leave request first
    const { data: request, error: fetchError } = await supabase
      .from('leave_requests')
      .select('*')
      .eq('id', requestId)
      .single()

    if (fetchError || !request) {
      return { success: false, error: 'Leave request not found' }
    }

    if (request.status !== 'pending') {
      return { success: false, error: 'Request is not in pending state' }
    }

    // Update status to approved
    const { error: updateError } = await supabase
      .from('leave_requests')
      .update({
        status: 'approved',
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
        review_notes: notes || null,
      })
      .eq('id', requestId)

    if (updateError) {
      return { success: false, error: updateError.message }
    }

    // Update leave balance - increment used days
    const currentYear = new Date(request.start_date).getFullYear()

    const { data: balance, error: balanceError } = await supabase
      .from('leave_balances')
      .select('*')
      .eq('user_id', request.user_id)
      .eq('year', currentYear)
      .single()

    if (!balanceError && balance) {
      const leaveType = request.leave_type as string
      let updateData: Record<string, number> = {}

      if (leaveType === 'yearly') {
        updateData = { yearly_used: balance.yearly_used + request.total_days }
      } else if (leaveType === 'work_from_home') {
        updateData = { wfh_used: balance.wfh_used + request.total_days }
      } else if (leaveType === 'marriage') {
        updateData = { marriage_used: balance.marriage_used + request.total_days }
      }

      if (Object.keys(updateData).length > 0) {
        await supabase
          .from('leave_balances')
          .update(updateData)
          .eq('id', balance.id)
      }
    }

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
      .update({
        status: 'rejected',
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
        review_notes: notes || null,
      })
      .eq('id', requestId)
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
