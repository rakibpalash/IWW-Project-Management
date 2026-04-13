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

export async function createSpaceAction(data: {
  name: string
  description?: string
  memberIds?: string[]
}): Promise<{ success: boolean; space?: any; error?: string }> {
  try {
    const { user, orgId } = await requireAuthWithOrg()
    const admin = createAdminClient()

    const { data: space, error: wsError } = await admin
      .from('spaces')
      .insert({
        name: data.name.trim(),
        description: data.description?.trim() || null,
        created_by: user.id,
        organization_id: orgId,
      })
      .select('id, name, description, created_by, created_at, updated_at')
      .single()

    if (wsError || !space) return { success: false, error: wsError?.message ?? 'Failed to create space' }

    if (data.memberIds && data.memberIds.length > 0) {
      await admin.from('space_assignments').insert(
        data.memberIds.map((user_id) => ({ space_id: space.id, user_id }))
      )
    }

    revalidatePath('/spaces')
    return { success: true, space }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

// ── Rename ────────────────────────────────────────────────────────────────────

export async function renameSpaceAction(
  spaceId: string,
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
      .eq('id', spaceId)

    if (error) return { success: false, error: error.message }

    revalidatePath('/spaces')
    revalidatePath(`/spaces/${spaceId}`)
    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

// ── Delete ────────────────────────────────────────────────────────────────────

export async function deleteSpaceAction(
  spaceId: string,
  opts?: { moveListsToSpaceId?: string }
): Promise<{ success: boolean; error?: string }> {
  try {
    const { supabase } = await requireAdmin()
    const admin = createAdminClient()

    // Collect notification data BEFORE deleting
    const [{ data: members }, { data: deleter }] = await Promise.all([
      admin.from('space_assignments').select('user_id').eq('space_id', spaceId),
      admin.from('profiles').select('full_name, id').eq(
        'id', (await supabase.auth.getUser()).data.user?.id ?? ''
      ).single(),
    ])

    if (opts?.moveListsToSpaceId) {
      // Move lists to another space instead of deleting
      const { error: moveError } = await admin
        .from('lists')
        .update({ space_id: opts.moveListsToSpaceId })
        .eq('space_id', spaceId)
      if (moveError) return { success: false, error: moveError.message }
    }

    // Delete the space — ON DELETE CASCADE handles all child rows automatically:
    // space_assignments, lists → list_members, tasks → task_assignees,
    // task_watchers, comments, time_entries, activity_logs
    const { error } = await admin.from('spaces').delete().eq('id', spaceId)
    if (error) {
      console.error('[deleteSpaceAction] DB error:', error.message, error.code, error.details)
      return { success: false, error: error.message }
    }

    // Send notifications to affected members
    if (members && members.length > 0 && deleter) {
      const notifications = members
        .filter((m) => m.user_id !== deleter.id)
        .map((m) => ({
          user_id: m.user_id,
          type: 'task_deleted',
          title: 'Space removed',
          message: opts?.moveListsToSpaceId
            ? `Space was reorganised by ${deleter.full_name}. Your lists were moved.`
            : `Space and all its lists were deleted by ${deleter.full_name}.`,
          link: '/lists',
          is_read: false,
        }))
      if (notifications.length > 0) await admin.from('notifications').insert(notifications)
    }

    // Do NOT call revalidatePath here — Next.js 15 auto re-renders the page
    // when revalidatePath is called from a server action, which crashes the
    // SpacesRoute server component. The client removes the space from
    // local state directly (optimistic update) so no server revalidation needed.
    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

// ── Clone ─────────────────────────────────────────────────────────────────────

export async function cloneSpaceAction(
  spaceId: string
): Promise<{ success: boolean; newSpaceId?: string; error?: string }> {
  try {
    const { supabase, userId, orgId } = await requireAdmin()

    // 1. Fetch source space
    const { data: source, error: srcErr } = await supabase
      .from('spaces')
      .select('*')
      .eq('id', spaceId)
      .single()

    if (srcErr || !source) return { success: false, error: 'Space not found' }

    // 2. Create new space (stamp org_id)
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

    // 3. Copy space member assignments
    const { data: assignments } = await supabase
      .from('space_assignments')
      .select('user_id')
      .eq('space_id', spaceId)

    if (assignments && assignments.length > 0) {
      await supabase.from('space_assignments').insert(
        assignments.map((a) => ({ space_id: newWsId, user_id: a.user_id }))
      )
    }

    // 4. Copy lists (structure only, no tasks)
    const { data: lists } = await supabase
      .from('lists')
      .select('name, description, client_id, start_date, due_date, status, priority, estimated_hours')
      .eq('space_id', spaceId)

    if (lists && lists.length > 0) {
      await supabase.from('lists').insert(
        lists.map((p) => ({
          ...p,
          space_id: newWsId,
          created_by: userId,
          progress: 0,
        }))
      )
    }

    revalidatePath('/spaces')
    return { success: true, newSpaceId: newWsId }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

// ── Update Members ────────────────────────────────────────────────────────────

export async function updateSpaceMembersAction(
  spaceId: string,
  toAdd: string[],
  toRemove: string[]
): Promise<{ success: boolean; error?: string }> {
  try {
    const userClient = await createClient()
    const { data: { user } } = await userClient.auth.getUser()
    if (!user) return { success: false, error: 'Not authenticated' }

    // Check the caller has space edit permission
    const perms = await getMyPermissionsAction()
    if (!can(perms, 'spaces', 'edit')) return { success: false, error: 'Insufficient permissions' }

    const admin = createAdminClient()

    // Verify the space belongs to the caller's org
    const { data: profile } = await admin.from('profiles').select('organization_id').eq('id', user.id).single()
    const { data: space } = await admin.from('spaces').select('organization_id').eq('id', spaceId).single()
    if (!space || space.organization_id !== profile?.organization_id) {
      return { success: false, error: 'Unauthorized' }
    }

    if (toRemove.length > 0) {
      const { error } = await admin
        .from('space_assignments')
        .delete()
        .eq('space_id', spaceId)
        .in('user_id', toRemove)
      if (error) return { success: false, error: error.message }
    }

    if (toAdd.length > 0) {
      const { error } = await admin
        .from('space_assignments')
        .upsert(
          toAdd.map((user_id) => ({ space_id: spaceId, user_id })),
          { onConflict: 'space_id,user_id' }
        )
      if (error) return { success: false, error: error.message }
    }

    revalidatePath(`/spaces/${spaceId}`)
    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

// ── List all org members for space assignment ─────────────────────────────

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
    if (!can(perms, 'spaces', 'view')) return { success: false, error: 'Insufficient permissions' }

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

// ── Get current members of a space (for realtime state sync) ──────────────

export async function getSpaceMembersAction(spaceId: string): Promise<{
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
      .eq('space_id', spaceId)

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
