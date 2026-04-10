import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/server'
import { TeamsHub } from '@/components/team/teams-hub'
import { Profile } from '@/types'
import { getUser, getProfile } from '@/lib/data/auth'

export const metadata = { title: 'Team' }

export default async function TeamServerPage() {
  const user = await getUser()
  if (!user) redirect('/login')

  const profile = await getProfile(user.id)
  if (!profile) redirect('/login')

  const admin = createAdminClient()
  const orgId = profile.organization_id

  // Fetch profiles — try with optional columns first, fall back to minimal
  const fullSelect = 'id, full_name, email, avatar_url, role, manager_id, custom_role_id, is_temp_password, onboarding_completed, created_at, updated_at'
  const minSelect  = 'id, full_name, email, avatar_url, role, is_temp_password, onboarding_completed, created_at, updated_at'

  if (!orgId) {
    return <TeamsHub profile={profile as Profile} allProfiles={[]} teams={[]} customRoles={[]} />
  }

  const { data: allProfilesRaw, error: profilesError } = await admin.from('profiles').select(fullSelect).eq('organization_id', orgId).order('full_name')

  let allProfilesData: any[]
  if (profilesError) {
    const { data } = await admin.from('profiles').select(minSelect).eq('organization_id', orgId).order('full_name')
    allProfilesData = data ?? []
  } else {
    allProfilesData = allProfilesRaw ?? []
  }

  // Fetch custom roles separately and merge by custom_role_id
  const { data: customRolesData } = await admin.from('custom_roles').select('id, name, color').eq('organization_id', orgId)
  const customRolesById: Record<string, any> = {}
  for (const cr of customRolesData ?? []) customRolesById[cr.id] = cr

  function normalizeProfile(p: any): Profile {
    const customRole = p.custom_role_id ? (customRolesById[p.custom_role_id] ?? null) : null
    return { ...p, custom_role: customRole }
  }

  // Fetch teams (scoped to org)
  const { data: teamsData } = await admin.from('teams').select('*').eq('organization_id', orgId).eq('is_archived', false).order('created_at', { ascending: false })

  // Fetch team_members
  const teamIds = (teamsData ?? []).map((t) => t.id)
  let membersData: any[] = []
  if (teamIds.length > 0) {
    const { data } = await admin.from('team_members').select('*').in('team_id', teamIds)
    membersData = data ?? []
  }

  // Fetch profiles for team members (org-scoped)
  const memberUserIds = [...new Set(membersData.map((m) => m.user_id))]
  let memberProfiles: any[] = []
  if (memberUserIds.length > 0) {
    const { data } = await admin.from('profiles').select(fullSelect).in('id', memberUserIds).eq('organization_id', orgId)
    memberProfiles = data ?? []
  }

  // Build teams with member profiles
  const profilesById = Object.fromEntries(memberProfiles.map((p) => [p.id, normalizeProfile(p)]))
  const teams = (teamsData ?? []).map((team) => ({
    ...team,
    members: membersData
      .filter((m) => m.team_id === team.id)
      .map((m) => ({ ...m, profile: profilesById[m.user_id] ?? null })),
  }))

  const normalizedProfiles = allProfilesData.map(normalizeProfile)

  return (
    <TeamsHub
      profile={profile as Profile}
      allProfiles={normalizedProfiles}
      teams={teams}
      customRoles={(customRolesData ?? []) as { id: string; name: string; color: string }[]}
    />
  )
}
