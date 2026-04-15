'use server'

import { createAdminClient, createClient } from '@/lib/supabase/server'

export interface TimesheetRow {
  id: string
  task_id: string
  user_id: string
  description: string | null
  started_at: string
  ended_at: string | null
  duration_minutes: number | null
  is_running: boolean
  is_billable: boolean
  approval_status: 'pending' | 'approved' | 'rejected'
  approved_by: string | null
  task_title: string
  list_id: string
  list_name: string
  user_full_name: string
  user_avatar_url: string | null
  user_role: string
}

export async function getTimesheetEntriesAction(filters?: {
  dateFrom?: string
  dateTo?: string
  userIds?: string[]
}): Promise<{ success: boolean; entries?: TimesheetRow[]; error?: string }> {
  const userClient = await createClient()
  const { data: { user }, error: userError } = await userClient.auth.getUser()
  if (userError || !user) return { success: false, error: 'Not authenticated' }

  const admin = createAdminClient()
  const { data: callerProfile } = await admin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!callerProfile) return { success: false, error: 'Profile not found' }

  const role = callerProfile.role
  const isAdmin = role === 'super_admin' || role === 'account_manager'
  const isTeamLead = role === 'project_manager'

  let query = admin
    .from('time_entries')
    .select(`
      id, task_id, user_id, description, started_at, ended_at, duration_minutes,
      is_running, is_billable, approval_status, approved_by,
      task:tasks(id, title, list:lists(id, name)),
      profile:profiles!user_id(id, full_name, avatar_url, role)
    `)
    .order('started_at', { ascending: false })

  if (isAdmin) {
    // CEO / Org Admin: see all
    if (filters?.userIds && filters.userIds.length > 0) {
      query = query.in('user_id', filters.userIds)
    }
  } else if (isTeamLead) {
    // Team Lead: see their own + their direct reports
    const { data: reports } = await admin
      .from('profiles')
      .select('id')
      .eq('manager_id', user.id)
    const reportIds = (reports ?? []).map((r: any) => r.id)
    const visibleIds = [user.id, ...reportIds]
    query = query.in('user_id', visibleIds)
    if (filters?.userIds && filters.userIds.length > 0) {
      query = query.in('user_id', filters.userIds.filter((id) => visibleIds.includes(id)))
    }
  } else {
    // Staff / Client / Partner: own entries only
    query = query.eq('user_id', user.id)
  }

  if (filters?.dateFrom) {
    query = query.gte('started_at', filters.dateFrom)
  }
  if (filters?.dateTo) {
    query = query.lte('started_at', filters.dateTo)
  }

  const { data, error } = await query

  if (error) return { success: false, error: error.message }

  const rows: TimesheetRow[] = (data ?? []).map((e: any) => ({
    id: e.id,
    task_id: e.task_id,
    user_id: e.user_id,
    description: e.description,
    started_at: e.started_at,
    ended_at: e.ended_at,
    duration_minutes: e.duration_minutes,
    is_running: e.is_running,
    is_billable: e.is_billable ?? true,
    approval_status: e.approval_status ?? 'pending',
    approved_by: e.approved_by ?? null,
    task_title: e.task?.title ?? 'Deleted task',
    list_id: e.task?.list?.id ?? '',
    list_name: e.task?.list?.name ?? 'Unknown list',
    user_full_name: e.profile?.full_name ?? 'Unknown user',
    user_avatar_url: e.profile?.avatar_url ?? null,
    user_role: e.profile?.role ?? '',
  }))

  return { success: true, entries: rows }
}

export async function approveTimesheetEntryAction(
  entryId: string,
  action: 'approved' | 'rejected',
): Promise<{ success: boolean; error?: string }> {
  const userClient = await createClient()
  const { data: { user }, error: userError } = await userClient.auth.getUser()
  if (userError || !user) return { success: false, error: 'Not authenticated' }

  const admin = createAdminClient()
  const { data: callerProfile } = await admin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const role = callerProfile?.role
  const canApprove = role === 'super_admin' || role === 'account_manager' || role === 'project_manager'
  if (!canApprove) return { success: false, error: 'Unauthorized' }

  const { error } = await admin
    .from('time_entries')
    .update({
      approval_status: action,
      approved_by: user.id,
      approved_at: new Date().toISOString(),
    })
    .eq('id', entryId)

  if (error) return { success: false, error: error.message }
  return { success: true }
}

export async function deleteTimesheetEntryAction(
  entryId: string,
): Promise<{ success: boolean; error?: string }> {
  const userClient = await createClient()
  const { data: { user }, error: userError } = await userClient.auth.getUser()
  if (userError || !user) return { success: false, error: 'Not authenticated' }

  const admin = createAdminClient()
  const { data: callerProfile } = await admin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const isAdmin = callerProfile?.role === 'super_admin' || callerProfile?.role === 'account_manager'

  const deleteQuery = admin
    .from('time_entries')
    .delete()
    .eq('id', entryId)

  if (!isAdmin) {
    deleteQuery.eq('user_id', user.id)
  }

  const { error } = await deleteQuery
  if (error) return { success: false, error: error.message }
  return { success: true }
}
