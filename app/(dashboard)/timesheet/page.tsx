import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/server'
import { TimesheetPage } from '@/components/timesheet/timesheet-page'
import { Profile } from '@/types'
import { getTimesheetEntriesAction } from '@/app/actions/timesheet'
import { getUser, getProfile } from '@/lib/data/auth'

export default async function TimesheetServerPage() {
  const user = await getUser()
  if (!user) redirect('/login')

  const profile = await getProfile(user.id)
  if (!profile) redirect('/login')

  // Clients have no time tracking
  if (profile.role === 'client') redirect('/dashboard')

  // Date range: current month as default
  const now = new Date()
  const dateFrom = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const dateTo = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString()

  const admin = createAdminClient()
  const orgId = (profile as Profile).organization_id
  const result = await getTimesheetEntriesAction({ dateFrom, dateTo })
  const entries = result.entries ?? []

  // Fetch all workspaces for workspace filter (scoped to org)
  const wsQuery = orgId
    ? admin.from('workspaces').select('id, name').eq('organization_id', orgId).order('name')
    : admin.from('workspaces').select('id, name').order('name')
  const { data: workspaces } = await wsQuery

  // Fetch project→workspace mapping (projects are scoped via workspaces)
  const wsIds = (workspaces ?? []).map((w: { id: string }) => w.id)
  const { data: projectsRaw } = wsIds.length > 0
    ? await admin.from('projects').select('id, name, workspace_id').in('workspace_id', wsIds).order('name')
    : await admin.from('projects').select('id, name, workspace_id').order('name')
  const projectWorkspaceMap: Record<string, string> = {}
  for (const p of projectsRaw ?? []) {
    projectWorkspaceMap[p.id] = p.workspace_id
  }
  const allProjects = (projectsRaw ?? []).map((p) => ({ id: p.id, name: p.name, workspace_id: p.workspace_id }))

  // For admin: fetch all profiles for people filter (scoped to org)
  let allProfiles: Pick<Profile, 'id' | 'full_name' | 'avatar_url' | 'role'>[] = []
  if (profile.role === 'super_admin') {
    const profilesQuery = orgId
      ? admin.from('profiles').select('id, full_name, avatar_url, role').eq('organization_id', orgId).neq('role', 'client').order('full_name')
      : admin.from('profiles').select('id, full_name, avatar_url, role').neq('role', 'client').order('full_name')
    const { data: profilesData } = await profilesQuery
    allProfiles = (profilesData ?? []) as typeof allProfiles
  }

  return (
    <TimesheetPage
      profile={profile as Profile}
      initialEntries={entries}
      initialDateFrom={dateFrom}
      initialDateTo={dateTo}
      allWorkspaces={(workspaces ?? []) as { id: string; name: string }[]}
      allProjects={allProjects}
      projectWorkspaceMap={projectWorkspaceMap}
      allProfiles={allProfiles}
    />
  )
}
