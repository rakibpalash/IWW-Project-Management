'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { CustomTaskStatus } from '@/types'

export async function getTaskStatusesAction(): Promise<{ data?: CustomTaskStatus[]; error?: string }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Not authenticated' }

    const admin = createAdminClient()
    const { data: profile } = await admin.from('profiles').select('organization_id').eq('id', user.id).single()
    const orgId = profile?.organization_id

    const query = admin.from('task_statuses').select('*').order('sort_order')
    if (orgId) query.eq('organization_id', orgId)

    const { data, error } = await query
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

    const topQuery = admin
      .from('task_statuses')
      .select('sort_order')
      .order('sort_order', { ascending: false })
      .limit(1)
    if (callerProfile?.organization_id) topQuery.eq('organization_id', callerProfile.organization_id)
    const { data: top } = await topQuery.single()

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
      // Unset default only within the same org — never touch other orgs
      const { data: target } = await admin.from('task_statuses').select('organization_id').eq('id', id).single()
      const orgId = target?.organization_id
      const unsetQuery = admin.from('task_statuses').update({ is_default: false }).neq('id', id)
      if (orgId) unsetQuery.eq('organization_id', orgId)
      await unsetQuery
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

export async function seedDefaultStatusesAction(): Promise<{
  success: boolean
  statuses?: CustomTaskStatus[]
  error?: string
}> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Not authenticated' }

    const admin = createAdminClient()
    const { data: profile } = await admin.from('profiles').select('role, organization_id').eq('id', user.id).single()
    if (!profile || profile.role !== 'super_admin') return { success: false, error: 'Unauthorized' }

    const orgId = profile.organization_id
    if (!orgId) return { success: false, error: 'No organization found' }

    // Only seed if truly empty
    const { count } = await admin
      .from('task_statuses')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', orgId)
    if (count && count > 0) {
      const { data } = await admin.from('task_statuses').select('*').eq('organization_id', orgId).order('sort_order')
      return { success: true, statuses: (data as CustomTaskStatus[]) ?? [] }
    }

    const defaults = [
      { name: 'To Do',       slug: 'todo',        color: '#94a3b8', sort_order: 1, is_default: true,  is_completed_status: false, counts_toward_progress: true  },
      { name: 'In Progress', slug: 'in_progress',  color: '#f59e0b', sort_order: 2, is_default: false, is_completed_status: false, counts_toward_progress: true  },
      { name: 'In Review',   slug: 'in_review',    color: '#3b82f6', sort_order: 3, is_default: false, is_completed_status: false, counts_toward_progress: true  },
      { name: 'Done',        slug: 'done',         color: '#22c55e', sort_order: 4, is_default: false, is_completed_status: true,  counts_toward_progress: true  },
      { name: 'Cancelled',   slug: 'cancelled',    color: '#ef4444', sort_order: 5, is_default: false, is_completed_status: true,  counts_toward_progress: false },
    ]

    const { data, error } = await admin
      .from('task_statuses')
      .insert(defaults.map(d => ({ ...d, organization_id: orgId, is_active: true, created_by: user.id })))
      .select('*')

    if (error) return { success: false, error: error.message }
    revalidatePath('/settings')
    return { success: true, statuses: (data as CustomTaskStatus[]) ?? [] }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}
