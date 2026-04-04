import { redirect, notFound } from 'next/navigation'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { TeamDetailPage } from '@/components/team/team-detail-page'
import { Profile } from '@/types'

const profileSelect =
  'id, full_name, email, avatar_url, role, is_temp_password, onboarding_completed, created_at, updated_at'

export default async function TeamDetailServerPage({
  params,
}: {
  params: Promise<{ teamId: string }>
}) {
  const { teamId } = await params
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

  // Fetch team base data
  const { data: teamBase } = await admin
    .from('teams')
    .select('*')
    .eq('id', teamId)
    .single()
  if (!teamBase) notFound()

  // Step 1: fetch team_members rows
  const { data: memberRows } = await admin
    .from('team_members')
    .select('*')
    .eq('team_id', teamId)

  // Step 2: fetch profiles for those user_ids
  const memberUserIds = (memberRows ?? []).map((m) => m.user_id)
  let memberProfiles: any[] = []
  if (memberUserIds.length > 0) {
    const { data } = await admin
      .from('profiles')
      .select(profileSelect)
      .in('id', memberUserIds)
    memberProfiles = data ?? []
  }

  // Step 3: merge
  const profilesById = Object.fromEntries(memberProfiles.map((p) => [p.id, p]))
  const members = (memberRows ?? []).map((m) => ({
    ...m,
    profile: profilesById[m.user_id] ?? null,
  }))

  const team = { ...teamBase, members }

  const { data: allProfiles } = await admin
    .from('profiles')
    .select(profileSelect)
    .order('full_name')

  return (
    <TeamDetailPage
      team={team as any}
      profile={profile as Profile}
      allProfiles={(allProfiles as Profile[]) ?? []}
    />
  )
}
