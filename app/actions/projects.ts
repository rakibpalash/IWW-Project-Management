'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { List } from '@/types'

type ProjectInput = {
  workspace_id: string
  name: string
  description?: string
  client_id?: string
  start_date?: string
  due_date?: string
  status: string
  priority: string
  estimated_hours?: number
}

// ── Create project ────────────────────────────────────────────────────────────

export async function createProjectAction(
  data: ProjectInput
): Promise<{ success: boolean; project?: List; error?: string }> {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return { success: false, error: 'Not authenticated' }
    }

    const { data: project, error } = await supabase
      .from('projects')
      .insert({
        workspace_id: data.workspace_id,
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

    return { success: true, project: project as List }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return { success: false, error: message }
  }
}

// ── Update project ────────────────────────────────────────────────────────────

export async function updateProjectAction(
  id: string,
  data: Partial<ProjectInput> & { progress?: number }
): Promise<{ success: boolean; project?: List; error?: string }> {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return { success: false, error: 'Not authenticated' }
    }

    // Build update payload – only include keys that were provided
    const payload: Record<string, unknown> = { updated_at: new Date().toISOString() }

    if (data.name !== undefined) payload.name = data.name
    if (data.description !== undefined) payload.description = data.description
    if (data.client_id !== undefined) payload.client_id = data.client_id
    if (data.workspace_id !== undefined) payload.workspace_id = data.workspace_id
    if (data.start_date !== undefined) payload.start_date = data.start_date
    if (data.due_date !== undefined) payload.due_date = data.due_date
    if (data.status !== undefined) payload.status = data.status
    if (data.priority !== undefined) payload.priority = data.priority
    if (data.estimated_hours !== undefined) payload.estimated_hours = data.estimated_hours
    if (data.progress !== undefined) payload.progress = data.progress

    const { data: project, error } = await supabase
      .from('projects')
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

    return { success: true, project: project as List }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return { success: false, error: message }
  }
}

// ── Delete project ────────────────────────────────────────────────────────────

export async function deleteProjectAction(
  id: string,
  opts?: { moveTasksToProjectId?: string }
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient()
    const admin = createAdminClient()

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) return { success: false, error: 'Not authenticated' }

    // Fetch project name + all affected people before deleting
    const { data: project } = await admin
      .from('projects')
      .select('name, workspace_id')
      .eq('id', id)
      .single()

    // Collect all task assignees (all depths)
    const { data: tasks } = await admin
      .from('tasks')
      .select('id, task_assignees(user_id)')
      .eq('project_id', id)

    // Collect project team members
    const { data: projectMembers } = await admin
      .from('project_members')
      .select('user_id')
      .eq('project_id', id)

    const memberIds = new Set<string>()
    for (const t of tasks ?? []) {
      for (const ta of (t as any).task_assignees ?? []) {
        if (ta.user_id !== user.id) memberIds.add(ta.user_id)
      }
    }
    for (const pm of projectMembers ?? []) {
      if (pm.user_id !== user.id) memberIds.add(pm.user_id)
    }

    const { data: deleter } = await admin
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .single()

    if (opts?.moveTasksToProjectId && tasks && tasks.length > 0) {
      const taskIds = tasks.map((t) => t.id)
      await admin.from('tasks').update({ project_id: opts.moveTasksToProjectId }).in('id', taskIds)
    }

    const { error } = await supabase.from('projects').delete().eq('id', id)
    if (error) return { success: false, error: error.message }

    // Notify assignees
    if (memberIds.size > 0) {
      const notifications = Array.from(memberIds).map((uid) => ({
        user_id: uid,
        type: 'task_deleted',
        title: 'Project deleted',
        message: opts?.moveTasksToProjectId
          ? `Project "${project?.name}" was deleted by ${deleter?.full_name}. Your tasks were moved.`
          : `Project "${project?.name}" and all its tasks were deleted by ${deleter?.full_name}.`,
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

// ── Clone project ─────────────────────────────────────────────────────────────

export async function cloneProjectAction(
  id: string
): Promise<{ success: boolean; project?: List; error?: string }> {
  try {
    const supabase = await createClient()
    const admin = createAdminClient()

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) return { success: false, error: 'Not authenticated' }

    // Fetch original project
    const { data: original, error: fetchError } = await admin
      .from('projects')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchError || !original) return { success: false, error: 'Project not found' }

    // Create cloned project
    const { data: cloned, error: insertError } = await admin
      .from('projects')
      .insert({
        workspace_id: original.workspace_id,
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

    // Copy project members
    const { data: members } = await admin
      .from('project_members')
      .select('user_id, project_role')
      .eq('project_id', id)

    if (members && members.length > 0) {
      await admin.from('project_members').insert(
        members.map((m) => ({
          project_id: cloned.id,
          user_id: m.user_id,
          project_role: m.project_role,
        }))
      )
    }

    revalidatePath('/lists')
    revalidatePath(`/spaces/${original.workspace_id}`)
    return { success: true, project: cloned as List }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}
