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
  task_title: string
  project_id: string
  project_name: string
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
  const isAdmin = callerProfile.role === 'super_admin'

  let query = admin
    .from('time_entries')
    .select(`
      id, task_id, user_id, description, started_at, ended_at, duration_minutes, is_running,
      task:tasks(id, title, project:projects(id, name)),
      profile:profiles(id, full_name, avatar_url, role)
    `)
    .order('started_at', { ascending: false })

  // Non-admin users only see their own entries
  if (!isAdmin) {
    query = query.eq('user_id', user.id)
  } else if (filters?.userIds && filters.userIds.length > 0) {
    query = query.in('user_id', filters.userIds)
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
    task_title: e.task?.title ?? 'Deleted task',
    project_id: e.task?.project?.id ?? '',
    project_name: e.task?.project?.name ?? 'Unknown project',
    user_full_name: e.profile?.full_name ?? 'Unknown user',
    user_avatar_url: e.profile?.avatar_url ?? null,
    user_role: e.profile?.role ?? '',
  }))

  return { success: true, entries: rows }
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

  const isAdmin = callerProfile?.role === 'super_admin'

  const deleteQuery = admin
    .from('time_entries')
    .delete()
    .eq('id', entryId)

  // Non-admin can only delete own entries
  if (!isAdmin) {
    deleteQuery.eq('user_id', user.id)
  }

  const { error } = await deleteQuery
  if (error) return { success: false, error: error.message }
  return { success: true }
}
