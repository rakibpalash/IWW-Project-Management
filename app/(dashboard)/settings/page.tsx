import { redirect } from 'next/navigation'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { SettingsPage } from '@/components/settings/settings-page'
import { getUser, getProfile } from '@/lib/data/auth'
import { Profile, AttendanceSettings, CustomTaskStatus, CustomTaskPriority, CustomRole, StaffSalary } from '@/types'
import { listPermissionTemplatesAction } from '@/app/actions/permission-templates'

export const metadata = {
  title: 'Settings',
}

const profileSelect =
  'id, full_name, email, avatar_url, role, is_active, is_temp_password, temp_password_plain, onboarding_completed, created_at, updated_at'

const staffProfileSelect =
  'id, full_name, email, avatar_url, role, manager_id, custom_role_id, is_active, is_temp_password, temp_password_plain, onboarding_completed, created_at, updated_at'

export default async function SettingsServerPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const { tab } = await searchParams
  const user = await getUser()
  if (!user) redirect('/login')

  const profile = await getProfile(user.id)
  if (!profile) redirect('/login')

  const supabase = await createClient()
  const orgId = (profile as Profile).organization_id
  const isAdmin = profile.role === 'super_admin'

  // Fetch attendance settings scoped to this org
  const settingsQuery = orgId
    ? supabase.from('attendance_settings').select('*').eq('organization_id', orgId).limit(1).single()
    : supabase.from('attendance_settings').select('*').limit(1).single()
  const { data: attendanceSettings } = await settingsQuery

  let allStaff: Profile[] = []
  let taskStatuses: CustomTaskStatus[] = []
  let taskPriorities: CustomTaskPriority[] = []
  let customRoles: CustomRole[] = []
  let salaries: StaffSalary[] = []

  if (isAdmin) {
    const staffQ = orgId
      ? supabase.from('profiles').select(staffProfileSelect).eq('organization_id', orgId).order('full_name')
      : supabase.from('profiles').select(staffProfileSelect).order('full_name')
    const statusQ = orgId
      ? supabase.from('task_statuses').select('*').eq('organization_id', orgId).order('sort_order')
      : supabase.from('task_statuses').select('*').order('sort_order')
    const priorityQ = orgId
      ? supabase.from('task_priorities').select('*').eq('organization_id', orgId).order('sort_order')
      : supabase.from('task_priorities').select('*').order('sort_order')

    const [staffData, statusesData, prioritiesData] =
      await Promise.all([staffQ, statusQ, priorityQ])

    if (staffData.error) {
      const fallbackQ = orgId
        ? supabase.from('profiles').select(profileSelect).eq('organization_id', orgId).order('full_name')
        : supabase.from('profiles').select(profileSelect).order('full_name')
      const { data: fallbackStaff } = await fallbackQ
      allStaff = (fallbackStaff as Profile[]) ?? []
    } else {
      allStaff = (staffData.data as Profile[]) ?? []
    }
    taskStatuses = (statusesData.data as CustomTaskStatus[]) ?? []
    taskPriorities = (prioritiesData.data as CustomTaskPriority[]) ?? []

    const rolesQ = orgId
      ? supabase.from('custom_roles').select('*').eq('organization_id', orgId).order('name')
      : supabase.from('custom_roles').select('*').order('name')
    const { data: rolesData } = await rolesQ
    customRoles = (rolesData as CustomRole[]) ?? []
  }

  const permissionTemplates = isAdmin ? await listPermissionTemplatesAction() : []

  if (isAdmin) {
    const admin = createAdminClient()
    let salaryQ = admin.from('staff_salaries').select('*').order('created_at', { ascending: false })
    if (orgId) salaryQ = salaryQ.eq('organization_id', orgId)
    const { data: salaryData } = await salaryQ
    salaries = (salaryData as StaffSalary[]) ?? []
  }

  return (
    <SettingsPage
      profile={profile as Profile}
      isAdmin={isAdmin}
      attendanceSettings={(attendanceSettings as AttendanceSettings) ?? null}
      allStaff={allStaff}
      taskStatuses={taskStatuses}
      taskPriorities={taskPriorities}
      customRoles={customRoles}
      permissionTemplates={permissionTemplates}
      salaries={salaries}
      defaultTab={tab}
    />
  )
}
