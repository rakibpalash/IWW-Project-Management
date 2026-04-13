import { notFound, redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/server'
import { WorkspaceDetailPage } from '@/components/workspaces/workspace-detail-page'
import { Space, Profile, List, Task, ActivityLog } from '@/types'
import { getUser, getProfile } from '@/lib/data/auth'
import { getMyPermissionsAction } from '@/app/actions/permissions'
import { can } from '@/lib/permissions'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const admin = createAdminClient()
  const { data: workspace } = await admin.from('workspaces').select('name').eq('id', id).single()
  return { title: workspace ? `${workspace.name} — IWW PM` : 'Space — IWW PM' }
}

const profileSelect =
  'id, full_name, email, avatar_url, role, is_temp_password, onboarding_completed, created_at, updated_at'

export default async function SpaceDetailRoute({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const user = await getUser()
  if (!user) redirect('/login')

  const profile = await getProfile(user.id)
  if (!profile) redirect('/login')

  const perms = await getMyPermissionsAction()

  if (!can(perms, 'workspaces', 'view')) redirect('/dashboard')

  const isAdmin = can(perms, 'workspaces', 'edit') || can(perms, 'workspaces', 'delete')

  const admin = createAdminClient()

  const { data: workspace, error: wsError } = await admin
    .from('workspaces')
    .select('*')
    .eq('id', id)
    .eq('organization_id', profile.organization_id)
    .single()

  if (wsError || !workspace) notFound()

  const { data: assignments } = await admin
    .from('workspace_assignments')
    .select('user_id')
    .eq('workspace_id', id)

  const memberIds = (assignments ?? []).map((a: { user_id: string }) => a.user_id)
  let members: Profile[] = []
  if (memberIds.length > 0) {
    const { data: memberProfiles } = await admin
      .from('profiles')
      .select(profileSelect)
      .in('id', memberIds)
      .order('full_name')
    members = (memberProfiles as Profile[]) ?? []
  }

  const { data: projects } = await admin
    .from('projects')
    .select('*')
    .eq('workspace_id', id)
    .order('created_at', { ascending: false })

  const projectList = (projects as List[]) ?? []
  const projectIds = projectList.map((p) => p.id)

  let tasks: Task[] = []
  if (projectIds.length > 0) {
    const { data: tasksRaw } = await admin
      .from('tasks')
      .select(`
        *,
        project:projects(id, name),
        assignees:task_assignees(user:profiles(${profileSelect})),
        creator:profiles!tasks_created_by_fkey(${profileSelect})
      `)
      .in('project_id', projectIds)
      .order('created_at', { ascending: false })

    tasks = (tasksRaw ?? []).map((t: any) => ({
      ...t,
      assignees: (t.assignees ?? []).map((a: any) => a.user).filter(Boolean),
    })) as Task[]
  }

  let activityLogs: ActivityLog[] = []
  if (projectIds.length > 0) {
    const taskIds = tasks.map((t) => t.id)
    if (taskIds.length > 0) {
      const { data: logsRaw } = await admin
        .from('activity_logs')
        .select(`*, user:profiles(${profileSelect}), task:tasks(id, title)`)
        .in('task_id', taskIds)
        .order('created_at', { ascending: false })
        .limit(50)
      activityLogs = (logsRaw as ActivityLog[]) ?? []
    }
  }

  const { data: profileData } = await admin
    .from('profiles')
    .select(profileSelect)
    .eq('id', user.id)
    .single()

  return (
    <WorkspaceDetailPage
      workspace={workspace as Space}
      members={members}
      projects={projectList}
      tasks={tasks}
      activityLogs={activityLogs}
      isAdmin={isAdmin}
      profile={profileData as any}
    />
  )
}
