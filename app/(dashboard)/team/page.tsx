import { redirect } from 'next/navigation'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { TeamsHub } from '@/components/team/teams-hub'
import { Profile } from '@/types'

export const metadata = { title: 'Team' }

const profileSelect =
  'id, full_name, email, avatar_url, role, is_temp_password, onboarding_completed, created_at, updated_at'

export default async function TeamServerPage() {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  if (error || !user) redirect('/login')

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select(profileSelect)
    .eq('id', user.id)
    .single()
  if (!profile) redirect('/login')

  const { data: allProfiles } = await admin
    .from('profiles')
    .select(profileSelect)
    .order('full_name')

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

  // Step 4: merge members + profiles into teams
  const profilesById = Object.fromEntries(memberProfiles.map((p) => [p.id, p]))
  const teams = (teamsData ?? []).map((team) => ({
    ...team,
    members: membersData
      .filter((m) => m.team_id === team.id)
      .map((m) => ({ ...m, profile: profilesById[m.user_id] ?? null })),
  }))

  return (
    <TeamsHub
      profile={profile as Profile}
      allProfiles={(allProfiles as Profile[]) ?? []}
      teams={teams}
    />
  )
}
