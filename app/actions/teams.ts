'use server'
import { revalidatePath } from 'next/cache'
import { createClient, createAdminClient } from '@/lib/supabase/server'

async function getCallerProfile() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('id, role, organization_id').eq('id', user.id).single()
  return profile ? { ...profile, userId: user.id } : null
}

export async function createTeamAction(data: {
  name: string
  description?: string
  team_type: 'official' | 'private' | 'public'
  color: string
  memberIds: string[]
  addCreatorAsMember?: boolean  // default true for normal creation, false for assign-only flow
}) {
  const caller = await getCallerProfile()
  if (!caller) return { success: false, error: 'Not authenticated' }

  const admin = createAdminClient()
  const { data: team, error } = await admin
    .from('teams')
    .insert({ name: data.name, description: data.description, team_type: data.team_type, color: data.color, created_by: caller.userId, organization_id: caller.organization_id })
    .select('*')
    .single()
  if (error) return { success: false, error: error.message }

  const addCreator = data.addCreatorAsMember !== false  // true unless explicitly false
  const memberRows: { team_id: string; user_id: string; role: 'lead' | 'member' }[] = []
  if (addCreator) {
    memberRows.push({ team_id: team.id, user_id: caller.userId, role: 'lead' })
  }
  for (const uid of data.memberIds) {
    if (uid !== caller.userId) memberRows.push({ team_id: team.id, user_id: uid, role: 'member' })
    else if (!addCreator) memberRows.push({ team_id: team.id, user_id: uid, role: 'member' })
  }
  if (memberRows.length > 0) await admin.from('team_members').insert(memberRows)

  revalidatePath('/team')
  return { success: true, team }
}

export async function updateTeamAction(
  teamId: string,
  data: { name?: string; description?: string; team_type?: string; color?: string }
) {
  const caller = await getCallerProfile()
  if (!caller) return { success: false, error: 'Not authenticated' }

  const admin = createAdminClient()
  const { data: team } = await admin.from('teams').select('created_by').eq('id', teamId).single()
  if (!team) return { success: false, error: 'Team not found' }
  if (caller.role !== 'super_admin' && team.created_by !== caller.userId) {
    return { success: false, error: 'Unauthorized' }
  }

  const { error } = await admin.from('teams').update({ ...data, updated_at: new Date().toISOString() }).eq('id', teamId)
  if (error) return { success: false, error: error.message }
  revalidatePath('/team')
  revalidatePath(`/team/${teamId}`)
  return { success: true }
}

export async function archiveTeamAction(teamId: string) {
  const caller = await getCallerProfile()
  if (!caller) return { success: false, error: 'Not authenticated' }

  const admin = createAdminClient()
  const { data: team } = await admin.from('teams').select('created_by').eq('id', teamId).single()
  if (!team) return { success: false, error: 'Team not found' }
  if (caller.role !== 'super_admin' && team.created_by !== caller.userId) {
    return { success: false, error: 'Unauthorized' }
  }

  const { error } = await admin.from('teams').update({ is_archived: true, updated_at: new Date().toISOString() }).eq('id', teamId)
  if (error) return { success: false, error: error.message }
  revalidatePath('/team')
  revalidatePath(`/team/${teamId}`)
  return { success: true }
}

export async function deleteTeamAction(teamId: string) {
  const caller = await getCallerProfile()
  if (!caller) return { success: false, error: 'Not authenticated' }

  const admin = createAdminClient()
  const { data: team } = await admin.from('teams').select('created_by').eq('id', teamId).single()
  if (!team) return { success: false, error: 'Team not found' }
  if (caller.role !== 'super_admin' && team.created_by !== caller.userId) {
    return { success: false, error: 'Unauthorized' }
  }

  const { error } = await admin.from('teams').delete().eq('id', teamId)
  if (error) return { success: false, error: error.message }
  revalidatePath('/team')
  return { success: true }
}

export async function addTeamMembersAction(teamId: string, userIds: string[]) {
  const caller = await getCallerProfile()
  if (!caller) return { success: false, error: 'Not authenticated' }

  const admin = createAdminClient()
  // Anyone who is a member or admin can add members
  const { data: membership } = await admin.from('team_members').select('id').eq('team_id', teamId).eq('user_id', caller.userId).maybeSingle()
  const { data: team } = await admin.from('teams').select('created_by').eq('id', teamId).single()
  const canAdd = caller.role === 'super_admin' || team?.created_by === caller.userId || !!membership
  if (!canAdd) return { success: false, error: 'Unauthorized' }

  const rows = userIds.map((uid) => ({ team_id: teamId, user_id: uid, role: 'member' as const }))
  const { error } = await admin.from('team_members').upsert(rows, { onConflict: 'team_id,user_id' })
  if (error) return { success: false, error: error.message }
  revalidatePath('/team')
  revalidatePath(`/team/${teamId}`)
  return { success: true }
}

export async function removeTeamMemberAction(teamId: string, userId: string) {
  const caller = await getCallerProfile()
  if (!caller) return { success: false, error: 'Not authenticated' }

  const admin = createAdminClient()
  const { data: team } = await admin.from('teams').select('created_by').eq('id', teamId).single()
  const { data: callerMembership } = await admin.from('team_members').select('role').eq('team_id', teamId).eq('user_id', caller.userId).maybeSingle()
  const canManage = caller.role === 'super_admin' || team?.created_by === caller.userId || callerMembership?.role === 'lead'
  if (!canManage) return { success: false, error: 'Unauthorized' }

  const { error } = await admin.from('team_members').delete().eq('team_id', teamId).eq('user_id', userId)
  if (error) return { success: false, error: error.message }
  revalidatePath('/team')
  revalidatePath(`/team/${teamId}`)
  return { success: true }
}

export async function leaveTeamAction(teamId: string) {
  const caller = await getCallerProfile()
  if (!caller) return { success: false, error: 'Not authenticated' }

  const admin = createAdminClient()
  // Prevent team creator from leaving (they should delete or transfer instead)
  const { data: team } = await admin.from('teams').select('created_by').eq('id', teamId).single()
  if (team?.created_by === caller.userId) {
    return { success: false, error: 'Team creator cannot leave. Delete the team or transfer ownership instead.' }
  }

  const { error } = await admin.from('team_members').delete().eq('team_id', teamId).eq('user_id', caller.userId)
  if (error) return { success: false, error: error.message }
  revalidatePath('/team')
  revalidatePath(`/team/${teamId}`)
  return { success: true }
}
