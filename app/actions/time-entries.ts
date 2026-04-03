'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { TimeEntry } from '@/types'

// Roles that are NOT allowed to log time
const TIME_TRACKING_BLOCKED_ROLES = ['client']

export async function createTimeEntryAction(data: {
  task_id: string
  started_at: string
  ended_at: string
  duration_minutes: number
  description?: string | null
  is_running?: boolean
}): Promise<{ success: boolean; entry?: TimeEntry; error?: string }> {
  const userClient = await createClient()
  const { data: { user }, error: userError } = await userClient.auth.getUser()

  if (userError || !user) {
    return { success: false, error: 'Not authenticated' }
  }

  // Fetch role from profiles
  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile) {
    return { success: false, error: 'Profile not found' }
  }

  if (TIME_TRACKING_BLOCKED_ROLES.includes(profile.role)) {
    return { success: false, error: 'Your role does not have permission to log time' }
  }

  const { data: entry, error } = await admin
    .from('time_entries')
    .insert({
      task_id: data.task_id,
      user_id: user.id,
      started_at: data.started_at,
      ended_at: data.ended_at ?? null,
      duration_minutes: data.duration_minutes,
      description: data.description ?? null,
      is_running: data.is_running ?? false,
    })
    .select('*')
    .single()

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true, entry: entry as TimeEntry }
}

export async function startTimerAction(task_id: string): Promise<{ success: boolean; entry?: TimeEntry; error?: string }> {
  const userClient = await createClient()
  const { data: { user }, error: userError } = await userClient.auth.getUser()

  if (userError || !user) {
    return { success: false, error: 'Not authenticated' }
  }

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || TIME_TRACKING_BLOCKED_ROLES.includes(profile.role)) {
    return { success: false, error: 'Your role does not have permission to track time' }
  }

  const { data: entry, error } = await admin
    .from('time_entries')
    .insert({
      task_id,
      user_id: user.id,
      started_at: new Date().toISOString(),
      is_running: true,
      duration_minutes: 0,
    })
    .select('*')
    .single()

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true, entry: entry as TimeEntry }
}

export async function stopTimerAction(entryId: string, duration: number): Promise<{ success: boolean; entry?: TimeEntry; error?: string }> {
  const userClient = await createClient()
  const { data: { user }, error: userError } = await userClient.auth.getUser()

  if (userError || !user) {
    return { success: false, error: 'Not authenticated' }
  }

  const admin = createAdminClient()

  const { data: entry, error } = await admin
    .from('time_entries')
    .update({
      is_running: false,
      duration_minutes: duration,
      updated_at: new Date().toISOString(),
    })
    .eq('id', entryId)
    .eq('user_id', user.id) // ensure user owns this entry
    .select('*')
    .single()

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true, entry: entry as TimeEntry }
}
