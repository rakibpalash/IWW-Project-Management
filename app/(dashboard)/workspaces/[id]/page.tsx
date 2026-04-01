import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { WorkspaceDetailPage } from '@/components/workspaces/workspace-detail-page'
import { Workspace, Profile, Project, Task, ActivityLog } from '@/types'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: workspace } = await supabase.from('workspaces').select('name').eq('id', id).single()
  return { title: workspace ? `${workspace.name} — IWW PM` : 'Workspace — IWW PM' }
}

const profileSelect =
  'id, full_name, email, avatar_url, role, is_temp_password, onboarding_completed, created_at, updated_at'

export default async function WorkspaceDetailRoute({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'super_admin') redirect('/dashboard')

  // Fetch workspace
  const { data: workspace, error: wsError } = await supabase
    .from('workspaces')
    .select('*')
    .eq('id', id)
    .single()

  if (wsError || !workspace) notFound()

  // Fetch members
  const { data: assignments } = await supabase
    .from('workspace_assignments')
    .select('user_id')
    .eq('workspace_id', id)

  const memberIds = (assignments ?? []).map((a: { user_id: string }) => a.user_id)
  let members: Profile[] = []
  if (memberIds.length > 0) {
    const { data: memberProfiles } = await supabase
      .from('profiles')
      .select(profileSelect)
      .in('id', memberIds)
      .order('full_name')
    members = (memberProfiles as Profile[]) ?? []
  }

  // Fetch projects
  const { data: projects } = await supabase
    .from('projects')
    .select('*')
    .eq('workspace_id', id)
    .order('created_at', { ascending: false })

  const projectList = (projects as Project[]) ?? []
  const projectIds = projectList.map((p) => p.id)

  // Fetch all tasks across workspace projects
  let tasks: Task[] = []
  if (projectIds.length > 0) {
    const { data: tasksRaw } = await supabase
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

  // Fetch recent activity logs
  let activityLogs: ActivityLog[] = []
  if (projectIds.length > 0) {
    // Get task ids in this workspace
    const taskIds = tasks.map((t) => t.id)
    if (taskIds.length > 0) {
      const { data: logsRaw } = await supabase
        .from('activity_logs')
        .select(`*, user:profiles(${profileSelect}), task:tasks(id, title)`)
        .in('task_id', taskIds)
        .order('created_at', { ascending: false })
        .limit(50)
      activityLogs = (logsRaw as ActivityLog[]) ?? []
    }
  }

  return (
    <WorkspaceDetailPage
      workspace={workspace as Workspace}
      members={members}
      projects={projectList}
      tasks={tasks}
      activityLogs={activityLogs}
      isAdmin={true}
    />
  )
}
