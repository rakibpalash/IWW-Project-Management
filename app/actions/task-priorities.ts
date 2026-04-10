'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { CustomTaskPriority } from '@/types'

export async function getTaskPrioritiesAction(): Promise<{ data?: CustomTaskPriority[]; error?: string }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Not authenticated' }

    const admin = createAdminClient()
    const { data: profile } = await admin.from('profiles').select('organization_id').eq('id', user.id).single()
    const orgId = profile?.organization_id

    const query = admin.from('task_priorities').select('*').order('sort_order')
    if (orgId) query.eq('organization_id', orgId)

    const { data, error } = await query
    if (error) return { error: error.message }
    return { data: data as CustomTaskPriority[] }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

export async function createTaskPriorityAction(input: {
  name: string
  slug: string
  color: string
}): Promise<{ success: boolean; priority?: CustomTaskPriority; error?: string }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Not authenticated' }

    const admin = createAdminClient()
    const { data: callerProfile } = await admin.from('profiles').select('organization_id').eq('id', user.id).single()

    const topQuery = admin
      .from('task_priorities')
      .select('sort_order')
      .order('sort_order', { ascending: false })
      .limit(1)
    if (callerProfile?.organization_id) topQuery.eq('organization_id', callerProfile.organization_id)
    const { data: top } = await topQuery.single()

    const { data, error } = await admin
      .from('task_priorities')
      .insert({
        name: input.name.trim(),
        slug: input.slug.trim(),
        color: input.color,
        sort_order: (top?.sort_order ?? 0) + 1,
        is_active: true,
        is_default: false,
        created_by: user.id,
        organization_id: callerProfile?.organization_id ?? null,
      })
      .select('*')
      .single()

    if (error) return { success: false, error: error.message }
    revalidatePath('/settings')
    return { success: true, priority: data as CustomTaskPriority }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

export async function updateTaskPriorityConfigAction(
  id: string,
  updates: Partial<Pick<CustomTaskPriority, 'name' | 'color' | 'is_active' | 'is_default'>>
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Not authenticated' }

    const admin = createAdminClient()

    if (updates.is_default === true) {
      // Unset default only within the same org — never touch other orgs
      const { data: target } = await admin.from('task_priorities').select('organization_id').eq('id', id).single()
      const orgId = target?.organization_id
      const unsetQuery = admin.from('task_priorities').update({ is_default: false }).neq('id', id)
      if (orgId) unsetQuery.eq('organization_id', orgId)
      await unsetQuery
    }

    const { error } = await admin.from('task_priorities').update(updates).eq('id', id)
    if (error) return { success: false, error: error.message }

    revalidatePath('/settings')
    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

export async function deleteTaskPriorityAction(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Not authenticated' }

    const { data: priorityData } = await supabase
      .from('task_priorities')
      .select('slug, is_default')
      .eq('id', id)
      .single()

    if (!priorityData) return { success: false, error: 'Priority not found' }
    if (priorityData.is_default) return { success: false, error: 'Cannot delete the default priority. Set another as default first.' }

    const { count } = await supabase
      .from('tasks')
      .select('*', { count: 'exact', head: true })
      .eq('priority', priorityData.slug)

    if (count && count > 0) {
      return { success: false, error: `Cannot delete: ${count} task(s) use this priority. Deactivate instead.` }
    }

    const admin = createAdminClient()
    const { error } = await admin.from('task_priorities').delete().eq('id', id)
    if (error) return { success: false, error: error.message }

    revalidatePath('/settings')
    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

export async function reorderTaskPrioritiesAction(
  orderedIds: string[]
): Promise<{ success: boolean; error?: string }> {
  try {
    const admin = createAdminClient()
    await Promise.all(
      orderedIds.map((id, index) =>
        admin.from('task_priorities').update({ sort_order: index + 1 }).eq('id', id)
      )
    )
    revalidatePath('/settings')
    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

export async function seedDefaultPrioritiesAction(): Promise<{
  success: boolean
  priorities?: CustomTaskPriority[]
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
      .from('task_priorities')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', orgId)
    if (count && count > 0) {
      const { data } = await admin.from('task_priorities').select('*').eq('organization_id', orgId).order('sort_order')
      return { success: true, priorities: (data as CustomTaskPriority[]) ?? [] }
    }

    const defaults = [
      { name: 'Low',    slug: 'low',    color: '#3b82f6', sort_order: 1, is_default: false },
      { name: 'Medium', slug: 'medium', color: '#f59e0b', sort_order: 2, is_default: true  },
      { name: 'High',   slug: 'high',   color: '#f97316', sort_order: 3, is_default: false },
      { name: 'Urgent', slug: 'urgent', color: '#ef4444', sort_order: 4, is_default: false },
    ]

    const { data, error } = await admin
      .from('task_priorities')
      .insert(defaults.map(d => ({ ...d, organization_id: orgId, is_active: true, created_by: user.id })))
      .select('*')

    if (error) return { success: false, error: error.message }
    revalidatePath('/settings')
    return { success: true, priorities: (data as CustomTaskPriority[]) ?? [] }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}
