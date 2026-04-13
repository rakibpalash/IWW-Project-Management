import { redirect } from 'next/navigation'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { MyTasksPage } from '@/components/tasks/my-tasks-page'
import { Task, Profile, List } from '@/types'
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
  const admin = createAdminClient()

  if (profile.role === 'client') redirect('/dashboard')

  const profileSelect = 'id, full_name, email, avatar_url, role, is_temp_password, onboarding_completed, created_at, updated_at'
  const taskSelect = `
    *,
    project:projects(id, name, workspace_id, status, priority, description, client_id, start_date, due_date, estimated_hours, progress, created_by, created_at, updated_at),
    assignees:task_assignees(
      user:profiles(${profileSelect})
    )
  `

  let tasks: Task[] = []

  if (profile.role === 'super_admin') {
    // Super admin sees all tasks in their organisation
    const orgId = (profile as Profile).organization_id
    const { data: orgWorkspaces } = orgId
      ? await admin.from('workspaces').select('id').eq('organization_id', orgId)
      : { data: [] }
    const orgWsIds = (orgWorkspaces ?? []).map((w: { id: string }) => w.id)

    if (orgWsIds.length > 0) {
      const { data: orgProjects } = await admin
        .from('projects')
        .select('id')
        .in('workspace_id', orgWsIds)
      const orgProjectIds = (orgProjects ?? []).map((p: { id: string }) => p.id)

      if (orgProjectIds.length > 0) {
        const { data: allTasks } = await admin
          .from('tasks')
          .select(taskSelect)
          .in('project_id', orgProjectIds)
          .is('parent_task_id', null)
          .order('created_at', { ascending: false })

        tasks = (allTasks ?? []).map((t: any) => ({
          ...t,
          assignees: (t.assignees ?? []).map((a: any) => a.user).filter(Boolean),
        })) as Task[]
      }
    }
  } else {
    // Non-admin: show tasks assigned to OR created by the user
    const { data: assignedTaskIds } = await supabase
      .from('task_assignees')
      .select('task_id')
      .eq('user_id', user.id)

    const assignedIds = (assignedTaskIds ?? []).map((a) => a.task_id)

    if (assignedIds.length > 0) {
      const { data: assignedTasks } = await supabase
        .from('tasks')
        .select(taskSelect)
        .in('id', assignedIds)
        .is('parent_task_id', null)
        .order('created_at', { ascending: false })

      const { data: createdTasks } = await supabase
        .from('tasks')
        .select(taskSelect)
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
        .select(taskSelect)
        .eq('created_by', user.id)
        .is('parent_task_id', null)
        .order('created_at', { ascending: false })

      tasks = (createdTasks ?? []).map((t: any) => ({
        ...t,
        assignees: (t.assignees ?? []).map((a: any) => a.user).filter(Boolean),
      })) as Task[]
    }
  }

  // Fetch all accessible projects for the create task dropdown (scoped to org via workspaces)
  const orgId = (profile as Profile).organization_id
  const { data: orgWorkspaces } = orgId
    ? await admin.from('workspaces').select('id').eq('organization_id', orgId)
    : { data: [] }
  const orgWsIds = (orgWorkspaces ?? []).map((w: { id: string }) => w.id)

  const { data: projectsData } = orgWsIds.length > 0
    ? await supabase.from('projects').select('id, name, workspace_id, status, priority, description, client_id, start_date, due_date, estimated_hours, progress, created_by, created_at, updated_at').in('workspace_id', orgWsIds).order('name')
    : { data: [] }
  const allProjects: List[] = (projectsData ?? []) as List[]

  return (
    <MyTasksPage
      initialTasks={tasks}
      profile={profile as Profile}
      projects={allProjects}
    />
  )
}
