'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { requireAuthWithOrg } from '@/lib/data/auth'
import { revalidatePath } from 'next/cache'
import { getMyPermissionsAction } from './permissions'
import { can } from '@/lib/permissions'

// ── Auth + admin guard ────────────────────────────────────────────────────────

async function requireAdmin() {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) throw new Error('Not authenticated')

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('role, organization_id')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'super_admin') throw new Error('Insufficient permissions')

  return { supabase, userId: user.id, orgId: profile.organization_id as string | null }
}

// ── Create ────────────────────────────────────────────────────────────────────

export async function createWorkspaceAction(data: {
  name: string
  description?: string
  memberIds?: string[]
}): Promise<{ success: boolean; workspace?: any; error?: string }> {
  try {
    const { user, orgId } = await requireAuthWithOrg()
    const admin = createAdminClient()

    const { data: workspace, error: wsError } = await admin
      .from('spaces')
      .insert({
        name: data.name.trim(),
        description: data.description?.trim() || null,
        created_by: user.id,
        organization_id: orgId,
      })
      .select('id, name, description, created_by, created_at, updated_at')
      .single()

    if (wsError || !workspace) return { success: false, error: wsError?.message ?? 'Failed to create workspace' }

    if (data.memberIds && data.memberIds.length > 0) {
      await admin.from('space_assignments').insert(
        data.memberIds.map((user_id) => ({ space_id: workspace.id, user_id }))
      )
    }

    revalidatePath('/spaces')
    return { success: true, workspace }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
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
      .from('spaces')
      .update({
        name: name.trim(),
        description: description?.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', workspaceId)

    if (error) return { success: false, error: error.message }

    revalidatePath('/spaces')
    revalidatePath(`/spaces/${workspaceId}`)
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
      admin.from('space_assignments').select('user_id').eq('space_id', workspaceId),
      admin.from('profiles').select('full_name, id').eq(
        'id', (await supabase.auth.getUser()).data.user?.id ?? ''
      ).single(),
    ])

    if (opts?.moveProjectsToWorkspaceId) {
      // Move projects to another workspace instead of deleting
      const { error: moveError } = await admin
        .from('lists')
        .update({ space_id: opts.moveProjectsToWorkspaceId })
        .eq('space_id', workspaceId)
      if (moveError) return { success: false, error: moveError.message }
    }

    // Delete the workspace — ON DELETE CASCADE handles all child rows automatically:
    // workspace_assignments, projects → project_members, tasks → task_assignees,
    // task_watchers, comments, time_entries, activity_logs
    const { error } = await admin.from('spaces').delete().eq('id', workspaceId)
    if (error) {
      console.error('[deleteWorkspaceAction] DB error:', error.message, error.code, error.details)
      return { success: false, error: error.message }
    }

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
          link: '/lists',
          is_read: false,
        }))
      if (notifications.length > 0) await admin.from('notifications').insert(notifications)
    }

    // Do NOT call revalidatePath here — Next.js 15 auto re-renders the page
    // when revalidatePath is called from a server action, which crashes the
    // WorkspacesRoute server component. The client removes the workspace from
    // local state directly (optimistic update) so no server revalidation needed.
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
    const { supabase, userId, orgId } = await requireAdmin()

    // 1. Fetch source workspace
    const { data: source, error: srcErr } = await supabase
      .from('spaces')
      .select('*')
      .eq('id', workspaceId)
      .single()

    if (srcErr || !source) return { success: false, error: 'Workspace not found' }

    // 2. Create new workspace (stamp org_id)
    const { data: newWs, error: wsErr } = await supabase
      .from('spaces')
      .insert({
        name: `${source.name} (Copy)`,
        description: source.description,
        created_by: userId,
        organization_id: orgId,
      })
      .select('id')
      .single()

    if (wsErr || !newWs) return { success: false, error: wsErr?.message ?? 'Failed to clone' }

    const newWsId = newWs.id

    // 3. Copy workspace member assignments
    const { data: assignments } = await supabase
      .from('space_assignments')
      .select('user_id')
      .eq('space_id', workspaceId)

    if (assignments && assignments.length > 0) {
      await supabase.from('space_assignments').insert(
        assignments.map((a) => ({ space_id: newWsId, user_id: a.user_id }))
      )
    }

    // 4. Copy projects (structure only, no tasks)
    const { data: projects } = await supabase
      .from('lists')
      .select('name, description, client_id, start_date, due_date, status, priority, estimated_hours')
      .eq('space_id', workspaceId)

    if (projects && projects.length > 0) {
      await supabase.from('lists').insert(
        projects.map((p) => ({
          ...p,
          space_id: newWsId,
          created_by: userId,
          progress: 0,
        }))
      )
    }

    revalidatePath('/spaces')
    return { success: true, newWorkspaceId: newWsId }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

// ── Update Members ────────────────────────────────────────────────────────────

export async function updateWorkspaceMembersAction(
  workspaceId: string,
  toAdd: string[],
  toRemove: string[]
): Promise<{ success: boolean; error?: string }> {
  try {
    const userClient = await createClient()
    const { data: { user } } = await userClient.auth.getUser()
    if (!user) return { success: false, error: 'Not authenticated' }

    // Check the caller has workspace edit permission
    const perms = await getMyPermissionsAction()
    if (!can(perms, 'workspaces', 'edit')) return { success: false, error: 'Insufficient permissions' }

    const admin = createAdminClient()

    // Verify the workspace belongs to the caller's org
    const { data: profile } = await admin.from('profiles').select('organization_id').eq('id', user.id).single()
    const { data: workspace } = await admin.from('spaces').select('organization_id').eq('id', workspaceId).single()
    if (!workspace || workspace.organization_id !== profile?.organization_id) {
      return { success: false, error: 'Unauthorized' }
    }

    if (toRemove.length > 0) {
      const { error } = await admin
        .from('space_assignments')
        .delete()
        .eq('space_id', workspaceId)
        .in('user_id', toRemove)
      if (error) return { success: false, error: error.message }
    }

    if (toAdd.length > 0) {
      const { error } = await admin
        .from('space_assignments')
        .upsert(
          toAdd.map((user_id) => ({ space_id: workspaceId, user_id })),
          { onConflict: 'space_id,user_id' }
        )
      if (error) return { success: false, error: error.message }
    }

    revalidatePath(`/spaces/${workspaceId}`)
    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

// ── List all org members for workspace assignment ─────────────────────────────

export async function listOrgMembersForAssignmentAction(): Promise<{
  success: boolean
  members?: { id: string; full_name: string; email: string; avatar_url: string | null; role: string }[]
  error?: string
}> {
  try {
    const userClient = await createClient()
    const { data: { user } } = await userClient.auth.getUser()
    if (!user) return { success: false, error: 'Not authenticated' }

    const perms = await getMyPermissionsAction()
    if (!can(perms, 'workspaces', 'view')) return { success: false, error: 'Insufficient permissions' }

    const admin = createAdminClient()
    const { data: profile } = await admin.from('profiles').select('organization_id').eq('id', user.id).single()

    const { data, error } = await admin
      .from('profiles')
      .select('id, full_name, email, avatar_url, role')
      .eq('organization_id', profile?.organization_id)
      .in('role', ['staff', 'client', 'partner', 'project_manager'])
      .order('full_name')

    if (error) return { success: false, error: error.message }
    return { success: true, members: data ?? [] }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

// ── Get current members of a workspace (for realtime state sync) ──────────────

export async function getWorkspaceMembersAction(workspaceId: string): Promise<{
  success: boolean
  members?: { id: string; full_name: string; email: string; avatar_url: string | null; role: string }[]
  error?: string
}> {
  try {
    const userClient = await createClient()
    const { data: { user } } = await userClient.auth.getUser()
    if (!user) return { success: false, error: 'Not authenticated' }

    const admin = createAdminClient()
    const { data: assignments } = await admin
      .from('space_assignments')
      .select('user_id')
      .eq('space_id', workspaceId)

    const memberIds = (assignments ?? []).map((a: { user_id: string }) => a.user_id)
    if (memberIds.length === 0) return { success: true, members: [] }

    const { data, error } = await admin
      .from('profiles')
      .select('id, full_name, email, avatar_url, role, is_temp_password, onboarding_completed, created_at, updated_at')
      .in('id', memberIds)
      .order('full_name')

    if (error) return { success: false, error: error.message }
    return { success: true, members: data ?? [] }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}
