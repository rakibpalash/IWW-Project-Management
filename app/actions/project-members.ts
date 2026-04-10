'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/server'
import { createClient } from '@/lib/supabase/server'
import { Profile, ProjectMember } from '@/types'
import { notify } from '@/lib/notifications'

const PROFILE_SELECT = 'id, full_name, email, avatar_url, role, is_temp_password, onboarding_completed, created_at, updated_at, custom_role_id'

// ── Get project members ───────────────────────────────────────────────────────
export async function getProjectMembersAction(projectId: string): Promise<{
  members?: ProjectMember[]
  error?: string
}> {
  const admin = createAdminClient()

  const { data: membersData, error: membersErr } = await admin
    .from('project_members')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true })

  if (membersErr) return { error: membersErr.message }
  if (!membersData || membersData.length === 0) return { members: [] }

  const userIds = membersData.map((m) => m.user_id)
  const { data: profilesData } = await admin
    .from('profiles')
    .select(PROFILE_SELECT)
    .in('id', userIds)

  const profilesById: Record<string, Profile> = {}
  for (const p of profilesData ?? []) {
    profilesById[p.id] = p as Profile
  }

  const members: ProjectMember[] = membersData.map((m) => ({
    ...m,
    profile: profilesById[m.user_id],
  }))

  return { members }
}

// ── Add member ────────────────────────────────────────────────────────────────
export async function addProjectMemberAction(
  projectId: string,
  userId: string,
  role: 'lead' | 'member'
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('project_members')
    .insert({ project_id: projectId, user_id: userId, project_role: role })
    .select()
    .single()

  if (error) return { error: error.message }

  // Notify the added member (unless they added themselves)
  if (userId !== user.id) {
    const { data: project } = await admin
      .from('projects')
      .select('name')
      .eq('id', projectId)
      .single()

    await notify({
      userId,
      type: 'project_member_added',
      title: 'Added to project',
      message: `You've been added to "${project?.name ?? 'a project'}" as ${role === 'lead' ? 'Team Lead' : 'Member'}.`,
      link: `/projects/${projectId}`,
    })
  }

  revalidatePath(`/projects/${projectId}`)
  return { member: data }
}

// ── Update member role ────────────────────────────────────────────────────────
export async function updateProjectMemberRoleAction(
  memberId: string,
  role: 'lead' | 'member',
  projectId: string
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('project_members')
    .update({ project_role: role })
    .eq('id', memberId)

  if (error) return { error: error.message }
  revalidatePath(`/projects/${projectId}`)
  return { success: true }
}

// ── Remove member ─────────────────────────────────────────────────────────────
export async function removeProjectMemberAction(
  memberId: string,
  projectId: string
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('project_members')
    .delete()
    .eq('id', memberId)

  if (error) return { error: error.message }
  revalidatePath(`/projects/${projectId}`)
  return { success: true }
}
