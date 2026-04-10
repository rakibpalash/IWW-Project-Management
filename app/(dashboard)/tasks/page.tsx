import { redirect } from 'next/navigation'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { MyTasksPage } from '@/components/tasks/my-tasks-page'
import { Task, Profile, Project } from '@/types'
import { getUser, getProfile } from '@/lib/data/auth'

export const metadata = {
  title: 'My Tasks',
}

export default async function TasksServerPage() {
  const user = await getUser()
  if (!user) redirect('/login')

  const profile = await getProfile(user.id)
  if (!profile) redirect('/login')

  const supabase = await createClient()

  if (profile.role === 'client') redirect('/dashboard')

  // Fetch tasks assigned to current user via task_assignees
  const { data: assignedTaskIds } = await supabase
    .from('task_assignees')
    .select('task_id')
    .eq('user_id', user.id)

  const assignedIds = (assignedTaskIds ?? []).map((a) => a.task_id)

  // Fetch all tasks: assigned OR created by user
  let tasks: Task[] = []

  const profileSelect = 'id, full_name, email, avatar_url, role, is_temp_password, onboarding_completed, created_at, updated_at'

  if (assignedIds.length > 0) {
    const { data: assignedTasks } = await supabase
      .from('tasks')
      .select(`
        *,
        project:projects(id, name, workspace_id, status, priority, description, client_id, start_date, due_date, estimated_hours, progress, created_by, created_at, updated_at),
        assignees:task_assignees(
          user:profiles(${profileSelect})
        )
      `)
      .in('id', assignedIds)
      .is('parent_task_id', null)
      .order('created_at', { ascending: false })

    const { data: createdTasks } = await supabase
      .from('tasks')
      .select(`
        *,
        project:projects(id, name, workspace_id, status, priority, description, client_id, start_date, due_date, estimated_hours, progress, created_by, created_at, updated_at),
        assignees:task_assignees(
          user:profiles(${profileSelect})
        )
      `)
      .eq('created_by', user.id)
      .not('id', 'in', `(${assignedIds.join(',')})`)
      .is('parent_task_id', null)
      .order('created_at', { ascending: false })

    const allRaw = [...(assignedTasks ?? []), ...(createdTasks ?? [])]
    tasks = allRaw.map((t: any) => ({
      ...t,
      assignees: (t.assignees ?? []).map((a: any) => a.user).filter(Boolean),
    })) as Task[]
  } else {
    const { data: createdTasks } = await supabase
      .from('tasks')
      .select(`
        *,
        project:projects(id, name, workspace_id, status, priority, description, client_id, start_date, due_date, estimated_hours, progress, created_by, created_at, updated_at),
        assignees:task_assignees(
          user:profiles(${profileSelect})
        )
      `)
      .eq('created_by', user.id)
      .is('parent_task_id', null)
      .order('created_at', { ascending: false })

    tasks = (createdTasks ?? []).map((t: any) => ({
      ...t,
      assignees: (t.assignees ?? []).map((a: any) => a.user).filter(Boolean),
    })) as Task[]
  }

  // Fetch all accessible projects for the create task dropdown (scoped to org via workspaces)
  const admin = createAdminClient()
  const orgId = (profile as Profile).organization_id
  const { data: orgWorkspaces } = orgId
    ? await admin.from('workspaces').select('id').eq('organization_id', orgId)
    : await admin.from('workspaces').select('id')
  const orgWsIds = (orgWorkspaces ?? []).map((w: { id: string }) => w.id)

  const { data: projectsData } = orgWsIds.length > 0
    ? await supabase.from('projects').select('id, name, workspace_id, status, priority, description, client_id, start_date, due_date, estimated_hours, progress, created_by, created_at, updated_at').in('workspace_id', orgWsIds).order('name')
    : await supabase.from('projects').select('id, name, workspace_id, status, priority, description, client_id, start_date, due_date, estimated_hours, progress, created_by, created_at, updated_at').order('name')
  const allProjects: Project[] = (projectsData ?? []) as Project[]

  return (
    <MyTasksPage
      initialTasks={tasks}
      profile={profile as Profile}
      projects={allProjects}
    />
  )
}
