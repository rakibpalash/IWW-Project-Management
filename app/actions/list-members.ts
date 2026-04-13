'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/server'
import { createClient } from '@/lib/supabase/server'
import { Profile, ListMember } from '@/types'
import { notify } from '@/lib/notifications'

const PROFILE_SELECT = 'id, full_name, email, avatar_url, role, is_temp_password, onboarding_completed, created_at, updated_at, custom_role_id'

// ── Get list members ───────────────────────────────────────────────────────
export async function getListMembersAction(listId: string): Promise<{
  members?: ListMember[]
  error?: string
}> {
  const admin = createAdminClient()

  const { data: membersData, error: membersErr } = await admin
    .from('list_members')
    .select('*')
    .eq('list_id', listId)
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

  const members: ListMember[] = membersData.map((m) => ({
    ...m,
    profile: profilesById[m.user_id],
  }))

  return { members }
}

// ── Add member ────────────────────────────────────────────────────────────────
export async function addListMemberAction(
  listId: string,
  userId: string,
  role: 'lead' | 'member'
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('list_members')
    .insert({ list_id: listId, user_id: userId, list_role: role })
    .select()
    .single()

  if (error) return { error: error.message }

  // Notify the added member (unless they added themselves)
  if (userId !== user.id) {
    const { data: list } = await admin
      .from('lists')
      .select('name')
      .eq('id', listId)
      .single()

    await notify({
      userId,
      type: 'project_member_added',
      title: 'Added to list',
      message: `You've been added to "${list?.name ?? 'a list'}" as ${role === 'lead' ? 'Team Lead' : 'Member'}.`,
      link: `/lists/${listId}`,
    })
  }

  revalidatePath(`/lists/${listId}`)
  return { member: data }
}

// ── Update member role ────────────────────────────────────────────────────────
export async function updateListMemberRoleAction(
  memberId: string,
  role: 'lead' | 'member',
  listId: string
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('list_members')
    .update({ list_role: role })
    .eq('id', memberId)

  if (error) return { error: error.message }
  revalidatePath(`/lists/${listId}`)
  return { success: true }
}

// ── Remove member ─────────────────────────────────────────────────────────────
export async function removeListMemberAction(
  memberId: string,
  listId: string
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('list_members')
    .delete()
    .eq('id', memberId)

  if (error) return { error: error.message }
  revalidatePath(`/lists/${listId}`)
  return { success: true }
}
