'use server'
import { revalidatePath } from 'next/cache'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export async function createTeamAction(data: {
  name: string
  description?: string
  team_type: 'official' | 'private' | 'public'
  color: string
  memberIds: string[]
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  const admin = createAdminClient()
  const { data: team, error } = await admin
    .from('teams')
    .insert({ name: data.name, description: data.description, team_type: data.team_type, color: data.color, created_by: user.id })
    .select('*')
    .single()
  if (error) return { success: false, error: error.message }

  // Add creator as lead
  const memberRows: { team_id: string; user_id: string; role: 'lead' | 'member' }[] = [
    { team_id: team.id, user_id: user.id, role: 'lead' },
  ]
  for (const uid of data.memberIds) {
    if (uid !== user.id) memberRows.push({ team_id: team.id, user_id: uid, role: 'member' })
  }
  await admin.from('team_members').insert(memberRows)

  revalidatePath('/team')
  return { success: true, team }
}

export async function updateTeamAction(
  teamId: string,
  data: { name?: string; description?: string; team_type?: string; color?: string }
) {
  const admin = createAdminClient()
  const { error } = await admin
    .from('teams')
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq('id', teamId)
  if (error) return { success: false, error: error.message }
  revalidatePath('/team')
  revalidatePath(`/team/${teamId}`)
  return { success: true }
}

export async function archiveTeamAction(teamId: string) {
  const admin = createAdminClient()
  const { error } = await admin
    .from('teams')
    .update({ is_archived: true, updated_at: new Date().toISOString() })
    .eq('id', teamId)
  if (error) return { success: false, error: error.message }
  revalidatePath('/team')
  revalidatePath(`/team/${teamId}`)
  return { success: true }
}

export async function deleteTeamAction(teamId: string) {
  const admin = createAdminClient()
  const { error } = await admin.from('teams').delete().eq('id', teamId)
  if (error) return { success: false, error: error.message }
  revalidatePath('/team')
  return { success: true }
}

export async function addTeamMembersAction(teamId: string, userIds: string[]) {
  const admin = createAdminClient()
  const rows = userIds.map((uid) => ({ team_id: teamId, user_id: uid, role: 'member' as const }))
  const { error } = await admin.from('team_members').upsert(rows, { onConflict: 'team_id,user_id' })
  if (error) return { success: false, error: error.message }
  revalidatePath(`/team/${teamId}`)
  return { success: true }
}

export async function removeTeamMemberAction(teamId: string, userId: string) {
  const admin = createAdminClient()
  const { error } = await admin
    .from('team_members')
    .delete()
    .eq('team_id', teamId)
    .eq('user_id', userId)
  if (error) return { success: false, error: error.message }
  revalidatePath(`/team/${teamId}`)
  return { success: true }
}

export async function leaveTeamAction(teamId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('team_members')
    .delete()
    .eq('team_id', teamId)
    .eq('user_id', user.id)
  if (error) return { success: false, error: error.message }
  revalidatePath('/team')
  revalidatePath(`/team/${teamId}`)
  return { success: true }
}
