import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/server'
import { TeamsHub } from '@/components/team/teams-hub'
import { Profile } from '@/types'
import { getUser, getProfile } from '@/lib/data/auth'

export const metadata = { title: 'Team' }

const profileSelect =
  'id, full_name, email, avatar_url, role, manager_id, custom_role_id, is_temp_password, onboarding_completed, created_at, updated_at, custom_role:custom_roles(id, name, color)'
const baseProfileSelect =
  'id, full_name, email, avatar_url, role, manager_id, is_temp_password, onboarding_completed, created_at, updated_at'

export default async function TeamServerPage() {
  const user = await getUser()
  if (!user) redirect('/login')

  const profile = await getProfile(user.id)
  if (!profile) redirect('/login')

  const admin = createAdminClient()

  const { data: allProfilesRaw, error: profilesError } = await admin
    .from('profiles')
    .select(profileSelect)
    .order('full_name')

  // Fallback: if custom_role join fails (migration not yet run), use base select
  const allProfiles = profilesError
    ? (await admin.from('profiles').select(baseProfileSelect).order('full_name')).data
    : allProfilesRaw

  // Step 1: fetch teams without member join
  const { data: teamsData } = await admin
    .from('teams')
    .select('*')
    .eq('is_archived', false)
    .order('created_at', { ascending: false })

  // Step 2: fetch all team_members for these teams
  const teamIds = (teamsData ?? []).map((t) => t.id)
  let membersData: any[] = []
  if (teamIds.length > 0) {
    const { data } = await admin
      .from('team_members')
      .select('*')
      .in('team_id', teamIds)
    membersData = data ?? []
  }

  // Step 3: fetch profiles for member user_ids
  const memberUserIds = [...new Set(membersData.map((m) => m.user_id))]
  let memberProfiles: any[] = []
  if (memberUserIds.length > 0) {
    const { data } = await admin
      .from('profiles')
      .select(profileSelect)
      .in('id', memberUserIds)
    memberProfiles = data ?? []
  }

  // Normalize Supabase join: custom_role is returned as array, flatten to object
  function normalizeProfile(p: any): Profile {
    return { ...p, custom_role: Array.isArray(p.custom_role) ? (p.custom_role[0] ?? null) : p.custom_role }
  }

  // Step 4: merge members + profiles into teams
  const profilesById = Object.fromEntries(memberProfiles.map((p) => [p.id, normalizeProfile(p)]))
  const teams = (teamsData ?? []).map((team) => ({
    ...team,
    members: membersData
      .filter((m) => m.team_id === team.id)
      .map((m) => ({ ...m, profile: profilesById[m.user_id] ?? null })),
  }))

  const normalizedProfiles = (allProfiles ?? []).map(normalizeProfile)

  return (
    <TeamsHub
      profile={profile as Profile}
      allProfiles={normalizedProfiles}
      teams={teams}
    />
  )
}
