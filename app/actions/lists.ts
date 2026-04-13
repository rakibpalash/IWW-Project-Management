'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { List } from '@/types'

type ListInput = {
  space_id: string
  folder_id?: string | null
  name: string
  description?: string
  client_id?: string
  start_date?: string
  due_date?: string
  status: string
  priority: string
  estimated_hours?: number
}

// ── Create list ────────────────────────────────────────────────────────────

export async function createListAction(
  data: ListInput
): Promise<{ success: boolean; list?: List; error?: string }> {
  try {
    const supabase = await createClient()
    const admin = createAdminClient()

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return { success: false, error: 'Not authenticated' }
    }

    // Use admin client to bypass RLS (DB policies still reference old table names)
    const { data: list, error } = await admin
      .from('lists')
      .insert({
        space_id: data.space_id,
        folder_id: data.folder_id ?? null,
        name: data.name,
        description: data.description ?? null,
        client_id: data.client_id ?? null,
        start_date: data.start_date ?? null,
        due_date: data.due_date ?? null,
        status: data.status,
        priority: data.priority,
        estimated_hours: data.estimated_hours ?? null,
        progress: 0,
        created_by: user.id,
      })
      .select('*')
      .single()

    if (error) {
      return { success: false, error: error.message }
    }

    revalidatePath('/lists')
    revalidatePath('/dashboard')

    return { success: true, list: list as List }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return { success: false, error: message }
  }
}

// ── Update list ────────────────────────────────────────────────────────────

export async function updateListAction(
  id: string,
  data: Partial<ListInput> & { progress?: number }
): Promise<{ success: boolean; list?: List; error?: string }> {
  try {
    const supabase = await createClient()
    const admin = createAdminClient()

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return { success: false, error: 'Not authenticated' }
    }

    const payload: Record<string, unknown> = { updated_at: new Date().toISOString() }

    if (data.name !== undefined) payload.name = data.name
    if (data.description !== undefined) payload.description = data.description
    if (data.client_id !== undefined) payload.client_id = data.client_id
    if (data.space_id !== undefined) payload.space_id = data.space_id
    if (data.start_date !== undefined) payload.start_date = data.start_date
    if (data.due_date !== undefined) payload.due_date = data.due_date
    if (data.status !== undefined) payload.status = data.status
    if (data.priority !== undefined) payload.priority = data.priority
    if (data.estimated_hours !== undefined) payload.estimated_hours = data.estimated_hours
    if (data.progress !== undefined) payload.progress = data.progress

    const { data: list, error } = await admin
      .from('lists')
      .update(payload)
      .eq('id', id)
      .select('*')
      .single()

    if (error) {
      return { success: false, error: error.message }
    }

    revalidatePath('/lists')
    revalidatePath(`/lists/${id}`)
    revalidatePath('/dashboard')

    return { success: true, list: list as List }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return { success: false, error: message }
  }
}

// ── Delete list ────────────────────────────────────────────────────────────

export async function deleteListAction(
  id: string,
  opts?: { moveTasksToListId?: string }
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient()
    const admin = createAdminClient()

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) return { success: false, error: 'Not authenticated' }

    // Fetch list name + all affected people before deleting
    const { data: list } = await admin
      .from('lists')
      .select('name, space_id')
      .eq('id', id)
      .single()

    // Collect all task assignees (all depths)
    const { data: tasks } = await admin
      .from('tasks')
      .select('id, task_assignees(user_id)')
      .eq('list_id', id)

    // Collect list team members
    const { data: listMembers } = await admin
      .from('list_members')
      .select('user_id')
      .eq('list_id', id)

    const memberIds = new Set<string>()
    for (const t of tasks ?? []) {
      for (const ta of (t as any).task_assignees ?? []) {
        if (ta.user_id !== user.id) memberIds.add(ta.user_id)
      }
    }
    for (const pm of listMembers ?? []) {
      if (pm.user_id !== user.id) memberIds.add(pm.user_id)
    }

    const { data: deleter } = await admin
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .single()

    if (opts?.moveTasksToListId && tasks && tasks.length > 0) {
      const taskIds = tasks.map((t) => t.id)
      await admin.from('tasks').update({ list_id: opts.moveTasksToListId }).in('id', taskIds)
    }

    const { error } = await supabase.from('lists').delete().eq('id', id)
    if (error) return { success: false, error: error.message }

    // Notify assignees
    if (memberIds.size > 0) {
      const notifications = Array.from(memberIds).map((uid) => ({
        user_id: uid,
        type: 'task_deleted',
        title: 'List deleted',
        message: opts?.moveTasksToListId
          ? `List "${list?.name}" was deleted by ${deleter?.full_name}. Your tasks were moved.`
          : `List "${list?.name}" and all its tasks were deleted by ${deleter?.full_name}.`,
        link: '/lists',
        is_read: false,
      }))
      await admin.from('notifications').insert(notifications)
    }

    revalidatePath('/lists')
    revalidatePath('/dashboard')
    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

// ── Clone list ─────────────────────────────────────────────────────────────

export async function cloneListAction(
  id: string
): Promise<{ success: boolean; list?: List; error?: string }> {
  try {
    const supabase = await createClient()
    const admin = createAdminClient()

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) return { success: false, error: 'Not authenticated' }

    // Fetch original list
    const { data: original, error: fetchError } = await admin
      .from('lists')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchError || !original) return { success: false, error: 'List not found' }

    // Create cloned list
    const { data: cloned, error: insertError } = await admin
      .from('lists')
      .insert({
        space_id: original.space_id,
        name: `${original.name} (Copy)`,
        description: original.description,
        client_id: original.client_id,
        start_date: original.start_date,
        due_date: original.due_date,
        status: 'planning',
        priority: original.priority,
        estimated_hours: original.estimated_hours,
        progress: 0,
        created_by: user.id,
      })
      .select('*')
      .single()

    if (insertError || !cloned) return { success: false, error: insertError?.message ?? 'Failed to clone' }

    // Copy list members
    const { data: members } = await admin
      .from('list_members')
      .select('user_id, list_role')
      .eq('list_id', id)

    if (members && members.length > 0) {
      await admin.from('list_members').insert(
        members.map((m) => ({
          list_id: cloned.id,
          user_id: m.user_id,
          list_role: m.list_role,
        }))
      )
    }

    revalidatePath('/lists')
    revalidatePath(`/spaces/${original.space_id}`)
    return { success: true, list: cloned as List }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}
