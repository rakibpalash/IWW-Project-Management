'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { CustomTaskStatus } from '@/types'

export async function getTaskStatusesAction(): Promise<{ data?: CustomTaskStatus[]; error?: string }> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('task_statuses')
      .select('*')
      .order('sort_order')
    if (error) return { error: error.message }
    return { data: data as CustomTaskStatus[] }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

export async function createTaskStatusAction(input: {
  name: string
  slug: string
  color: string
  is_completed_status: boolean
  counts_toward_progress: boolean
}): Promise<{ success: boolean; status?: CustomTaskStatus; error?: string }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Not authenticated' }

    const admin = createAdminClient()

    // Get caller's org_id
    const { data: callerProfile } = await admin.from('profiles').select('organization_id').eq('id', user.id).single()

    const { data: top } = await supabase
      .from('task_statuses')
      .select('sort_order')
      .order('sort_order', { ascending: false })
      .limit(1)
      .single()

    const { data, error } = await admin
      .from('task_statuses')
      .insert({
        name: input.name.trim(),
        slug: input.slug.trim(),
        color: input.color,
        sort_order: (top?.sort_order ?? 0) + 1,
        is_active: true,
        is_default: false,
        is_completed_status: input.is_completed_status,
        counts_toward_progress: input.counts_toward_progress,
        created_by: user.id,
        organization_id: callerProfile?.organization_id ?? null,
      })
      .select('*')
      .single()

    if (error) return { success: false, error: error.message }
    revalidatePath('/settings')
    return { success: true, status: data as CustomTaskStatus }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

export async function updateTaskStatusConfigAction(
  id: string,
  updates: Partial<Pick<CustomTaskStatus, 'name' | 'color' | 'is_active' | 'is_default' | 'is_completed_status' | 'counts_toward_progress'>>
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Not authenticated' }

    const admin = createAdminClient()

    if (updates.is_default === true) {
      await admin.from('task_statuses').update({ is_default: false }).neq('id', id)
    }

    const { error } = await admin.from('task_statuses').update(updates).eq('id', id)
    if (error) return { success: false, error: error.message }

    revalidatePath('/settings')
    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

export async function deleteTaskStatusAction(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Not authenticated' }

    const { data: statusData } = await supabase
      .from('task_statuses')
      .select('slug, is_default')
      .eq('id', id)
      .single()

    if (!statusData) return { success: false, error: 'Status not found' }
    if (statusData.is_default) return { success: false, error: 'Cannot delete the default status. Set another status as default first.' }

    const { count } = await supabase
      .from('tasks')
      .select('*', { count: 'exact', head: true })
      .eq('status', statusData.slug)

    if (count && count > 0) {
      return { success: false, error: `Cannot delete: ${count} task(s) currently use this status. Reassign or deactivate instead.` }
    }

    const admin = createAdminClient()
    const { error } = await admin.from('task_statuses').delete().eq('id', id)
    if (error) return { success: false, error: error.message }

    revalidatePath('/settings')
    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

export async function reorderTaskStatusesAction(
  orderedIds: string[]
): Promise<{ success: boolean; error?: string }> {
  try {
    const admin = createAdminClient()
    await Promise.all(
      orderedIds.map((id, index) =>
        admin.from('task_statuses').update({ sort_order: index + 1 }).eq('id', id)
      )
    )
    revalidatePath('/settings')
    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}
