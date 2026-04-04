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

  // Fetch team basic data first
  const { data: teamBase } = await admin
    .from('teams')
    .select('*')
    .eq('id', teamId)
    .single()

  if (!teamBase) notFound()

  // Fetch members separately — graceful if team_members table isn't migrated yet
  let members: any[] = []
  try {
    const { data: membersData } = await admin
      .from('team_members')
      .select('*, profile:profiles(' + profileSelect + ')')
      .eq('team_id', teamId)
    members = membersData ?? []
  } catch {
    members = []
  }

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
