import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { TeamPage } from '@/components/team/team-page'
import { Profile, Workspace, WorkspaceAssignment } from '@/types'

export const metadata = {
  title: 'Team',
}

const profileSelect =
  'id, full_name, email, avatar_url, role, is_temp_password, onboarding_completed, created_at, updated_at'

export default async function TeamServerPage() {
  const supabase = await createClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select(profileSelect)
    .eq('id', user.id)
    .single()

  if (!profile) {
    redirect('/login')
  }

  if (profile.role !== 'super_admin') {
    redirect('/dashboard')
  }

  // Fetch all profiles
  const { data: allProfiles } = await supabase
    .from('profiles')
    .select(profileSelect)
    .order('full_name')

  // Fetch workspaces
  const { data: workspaces } = await supabase.from('workspaces').select('*').order('name')

  // Fetch workspace assignments with workspace details
  const { data: workspaceAssignments } = await supabase
    .from('workspace_assignments')
    .select('*, workspace:workspaces(*)')

  return (
    <TeamPage
      profile={profile as Profile}
      allProfiles={(allProfiles as Profile[]) ?? []}
      workspaces={(workspaces as Workspace[]) ?? []}
      workspaceAssignments={(workspaceAssignments as (WorkspaceAssignment & { workspace?: Workspace })[]) ?? []}
    />
  )
}
