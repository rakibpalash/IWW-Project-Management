'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
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
  workspaceId: string,
  opts?: { moveProjectsToWorkspaceId?: string }
): Promise<{ success: boolean; error?: string }> {
  try {
    const { supabase } = await requireAdmin()
    const admin = createAdminClient()

    // Collect notification data BEFORE deleting
    const [{ data: members }, { data: deleter }] = await Promise.all([
      admin.from('workspace_assignments').select('user_id').eq('workspace_id', workspaceId),
      admin.from('profiles').select('full_name, id').eq(
        'id', (await supabase.auth.getUser()).data.user?.id ?? ''
      ).single(),
    ])

    if (opts?.moveProjectsToWorkspaceId) {
      // Move projects to another workspace instead of deleting
      const { error: moveError } = await admin
        .from('projects')
        .update({ workspace_id: opts.moveProjectsToWorkspaceId })
        .eq('workspace_id', workspaceId)
      if (moveError) return { success: false, error: moveError.message }
    }

    // Delete the workspace — ON DELETE CASCADE handles all child rows automatically:
    // workspace_assignments, projects → project_members, tasks → task_assignees,
    // task_watchers, comments, time_entries, activity_logs
    const { error } = await admin.from('workspaces').delete().eq('id', workspaceId)
    if (error) return { success: false, error: error.message }

    // Send notifications to affected members
    if (members && members.length > 0 && deleter) {
      const notifications = members
        .filter((m) => m.user_id !== deleter.id)
        .map((m) => ({
          user_id: m.user_id,
          type: 'task_deleted',
          title: 'Workspace removed',
          message: opts?.moveProjectsToWorkspaceId
            ? `Workspace was reorganised by ${deleter.full_name}. Your projects were moved.`
            : `Workspace and all its projects were deleted by ${deleter.full_name}.`,
          link: '/projects',
          is_read: false,
        }))
      if (notifications.length > 0) await admin.from('notifications').insert(notifications)
    }

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
