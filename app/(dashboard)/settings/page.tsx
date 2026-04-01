import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { SettingsPage } from '@/components/settings/settings-page'
import { Profile, AttendanceSettings, WorkspaceAssignment, Workspace } from '@/types'

export const metadata = {
  title: 'Settings',
}

const profileSelect =
  'id, full_name, email, avatar_url, role, is_temp_password, onboarding_completed, created_at, updated_at'

export default async function SettingsServerPage() {
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

  const isAdmin = profile.role === 'super_admin'

  // Fetch attendance settings (singleton)
  const { data: attendanceSettings } = await supabase
    .from('attendance_settings')
    .select('*')
    .limit(1)
    .single()

  let allStaff: Profile[] = []
  let workspaceAssignments: (WorkspaceAssignment & { workspace?: Workspace })[] = []
  let workspaces: Workspace[] = []

  if (isAdmin) {
    // Fetch all users for team management
    const { data: staffData } = await supabase
      .from('profiles')
      .select(profileSelect)
      .order('full_name')

    allStaff = (staffData as Profile[]) ?? []

    // Fetch workspaces
    const { data: workspacesData } = await supabase
      .from('workspaces')
      .select('*')
      .order('name')

    workspaces = workspacesData ?? []

    // Fetch workspace assignments
    const { data: assignmentsData } = await supabase
      .from('workspace_assignments')
      .select('*, workspace:workspaces(*)')

    workspaceAssignments = assignmentsData ?? []
  }

  return (
    <SettingsPage
      profile={profile as Profile}
      isAdmin={isAdmin}
      attendanceSettings={(attendanceSettings as AttendanceSettings) ?? null}
      allStaff={allStaff}
      workspaces={workspaces}
      workspaceAssignments={workspaceAssignments}
    />
  )
}
