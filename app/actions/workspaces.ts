'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// ── Auth + admin guard ────────────────────────────────────────────────────────

async function requireAdmin() {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) throw new Error('Not authenticated')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'super_admin') throw new Error('Insufficient permissions')

  return { supabase, userId: user.id }
}

// ── Rename ────────────────────────────────────────────────────────────────────

export async function renameWorkspaceAction(
  workspaceId: string,
  name: string,
  description?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { supabase } = await requireAdmin()

    const { error } = await supabase
      .from('workspaces')
      .update({
        name: name.trim(),
        description: description?.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', workspaceId)

    if (error) return { success: false, error: error.message }

    revalidatePath('/workspaces')
    revalidatePath(`/workspaces/${workspaceId}`)
    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

// ── Delete ────────────────────────────────────────────────────────────────────

export async function deleteWorkspaceAction(
  workspaceId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { supabase } = await requireAdmin()

    // Delete task assignees for all tasks in this workspace's projects
    const { data: projectIds } = await supabase
      .from('projects')
      .select('id')
      .eq('workspace_id', workspaceId)

    if (projectIds && projectIds.length > 0) {
      const ids = projectIds.map((p) => p.id)

      const { data: taskIds } = await supabase
        .from('tasks')
        .select('id')
        .in('project_id', ids)

      if (taskIds && taskIds.length > 0) {
        const tids = taskIds.map((t) => t.id)
        await supabase.from('task_assignees').delete().in('task_id', tids)
        await supabase.from('task_watchers').delete().in('task_id', tids)
        await supabase.from('time_entries').delete().in('task_id', tids)
        await supabase.from('activity_logs').delete().in('task_id', tids)
        await supabase.from('comments').delete().in('task_id', tids)
        await supabase.from('tasks').delete().in('project_id', ids)
      }

      await supabase.from('projects').delete().in('id', ids)
    }

    await supabase.from('workspace_assignments').delete().eq('workspace_id', workspaceId)
    const { error } = await supabase.from('workspaces').delete().eq('id', workspaceId)

    if (error) return { success: false, error: error.message }

    revalidatePath('/workspaces')
    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

// ── Clone ─────────────────────────────────────────────────────────────────────

export async function cloneWorkspaceAction(
  workspaceId: string
): Promise<{ success: boolean; newWorkspaceId?: string; error?: string }> {
  try {
    const { supabase, userId } = await requireAdmin()

    // 1. Fetch source workspace
    const { data: source, error: srcErr } = await supabase
      .from('workspaces')
      .select('*')
      .eq('id', workspaceId)
      .single()

    if (srcErr || !source) return { success: false, error: 'Workspace not found' }

    // 2. Create new workspace
    const { data: newWs, error: wsErr } = await supabase
      .from('workspaces')
      .insert({
        name: `${source.name} (Copy)`,
        description: source.description,
        created_by: userId,
      })
      .select('id')
      .single()

    if (wsErr || !newWs) return { success: false, error: wsErr?.message ?? 'Failed to clone' }

    const newWsId = newWs.id

    // 3. Copy workspace member assignments
    const { data: assignments } = await supabase
      .from('workspace_assignments')
      .select('user_id')
      .eq('workspace_id', workspaceId)

    if (assignments && assignments.length > 0) {
      await supabase.from('workspace_assignments').insert(
        assignments.map((a) => ({ workspace_id: newWsId, user_id: a.user_id }))
      )
    }

    // 4. Copy projects (structure only, no tasks)
    const { data: projects } = await supabase
      .from('projects')
      .select('name, description, client_id, start_date, due_date, status, priority, estimated_hours')
      .eq('workspace_id', workspaceId)

    if (projects && projects.length > 0) {
      await supabase.from('projects').insert(
        projects.map((p) => ({
          ...p,
          workspace_id: newWsId,
          created_by: userId,
          progress: 0,
        }))
      )
    }

    revalidatePath('/workspaces')
    return { success: true, newWorkspaceId: newWsId }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}
