import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { SettingsPage } from '@/components/settings/settings-page'
import { getUser, getProfile } from '@/lib/data/auth'
import { Profile, AttendanceSettings, WorkspaceAssignment, Workspace, CustomTaskStatus, CustomTaskPriority, CustomRole } from '@/types'

export const metadata = {
  title: 'Settings',
}

const profileSelect =
  'id, full_name, email, avatar_url, role, is_temp_password, onboarding_completed, created_at, updated_at'

// Includes custom_role_id — only used after 006_custom_roles migration is run
const staffProfileSelect =
  'id, full_name, email, avatar_url, role, is_temp_password, onboarding_completed, created_at, updated_at, custom_role_id'

export default async function SettingsServerPage() {
  const user = await getUser()
  if (!user) redirect('/login')

  const profile = await getProfile(user.id)
  if (!profile) redirect('/login')

  const supabase = await createClient()

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
  let taskStatuses: CustomTaskStatus[] = []
  let taskPriorities: CustomTaskPriority[] = []
  let customRoles: CustomRole[] = []

  if (isAdmin) {
    const [staffData, workspacesData, assignmentsData, statusesData, prioritiesData] =
      await Promise.all([
        supabase.from('profiles').select(staffProfileSelect).order('full_name'),
        supabase.from('workspaces').select('*').order('name'),
        supabase.from('workspace_assignments').select('*, workspace:workspaces(*)'),
        supabase.from('task_statuses').select('*').order('sort_order'),
        supabase.from('task_priorities').select('*').order('sort_order'),
      ])

    // Fall back to profileSelect if staffProfileSelect fails (migration not run yet)
    if (staffData.error) {
      const { data: fallbackStaff } = await supabase.from('profiles').select(profileSelect).order('full_name')
      allStaff = (fallbackStaff as Profile[]) ?? []
    } else {
      allStaff = (staffData.data as Profile[]) ?? []
    }
    workspaces = workspacesData.data ?? []
    workspaceAssignments = assignmentsData.data ?? []
    taskStatuses = (statusesData.data as CustomTaskStatus[]) ?? []
    taskPriorities = (prioritiesData.data as CustomTaskPriority[]) ?? []

    // custom_roles table only exists after migration — ignore error if table missing
    const { data: rolesData } = await supabase.from('custom_roles').select('*').order('name')
    customRoles = (rolesData as CustomRole[]) ?? []
  }

  return (
    <SettingsPage
      profile={profile as Profile}
      isAdmin={isAdmin}
      attendanceSettings={(attendanceSettings as AttendanceSettings) ?? null}
      allStaff={allStaff}
      workspaces={workspaces}
      workspaceAssignments={workspaceAssignments}
      taskStatuses={taskStatuses}
      taskPriorities={taskPriorities}
      customRoles={customRoles}
    />
  )
}
