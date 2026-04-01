import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ProjectDetailPage } from '@/components/projects/project-detail-page'
import { Project, Task, Profile, ActivityLog } from '@/types'

interface ProjectPageProps {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: ProjectPageProps) {
  const { id } = await params
  const supabase = await createClient()
  const { data } = await supabase
    .from('projects')
    .select('name')
    .eq('id', id)
    .single()

  return { title: data?.name ?? 'Project' }
}

export default async function ProjectPage({ params }: ProjectPageProps) {
  const { id } = await params
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
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile) {
    redirect('/login')
  }

  // Fetch project with joins
  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select(`
      *,
      workspace:workspaces(*),
      client:profiles!projects_client_id_fkey(id, full_name, email, avatar_url, role, is_temp_password, onboarding_completed, created_at, updated_at)
    `)
    .eq('id', id)
    .single()

  if (projectError || !project) {
    notFound()
  }

  // Access control
  if (profile.role === 'client' && project.client_id !== user.id) {
    notFound()
  }

  if (profile.role === 'staff') {
    const { data: assignment } = await supabase
      .from('workspace_assignments')
      .select('id')
      .eq('user_id', user.id)
      .eq('workspace_id', project.workspace_id)
      .single()

    if (!assignment) {
      notFound()
    }
  }

  // Fetch top-level tasks (depth = 0, no parent)
  const { data: tasksRaw } = await supabase
    .from('tasks')
    .select(`
      *,
      assignees:task_assignees(
        user:profiles(id, full_name, email, avatar_url, role, is_temp_password, onboarding_completed, created_at, updated_at)
      )
    `)
    .eq('project_id', id)
    .is('parent_task_id', null)
    .order('created_at', { ascending: true })

  // Fetch subtasks for each top-level task
  const topLevelTasks: Task[] = []
  if (tasksRaw && tasksRaw.length > 0) {
    const taskIds = tasksRaw.map((t: any) => t.id)

    const { data: subtasksRaw } = await supabase
      .from('tasks')
      .select(`
        *,
        assignees:task_assignees(
          user:profiles(id, full_name, email, avatar_url, role, is_temp_password, onboarding_completed, created_at, updated_at)
        )
      `)
      .in('parent_task_id', taskIds)
      .order('created_at', { ascending: true })

    const subtasksByParent: Record<string, Task[]> = {}
    for (const sub of subtasksRaw ?? []) {
      const parentId = (sub as any).parent_task_id
      if (!subtasksByParent[parentId]) subtasksByParent[parentId] = []
      const assignees = ((sub as any).assignees ?? []).map((a: any) => a.user).filter(Boolean)
      subtasksByParent[parentId].push({ ...sub, assignees } as Task)
    }

    for (const t of tasksRaw) {
      const assignees = ((t as any).assignees ?? []).map((a: any) => a.user).filter(Boolean)
      topLevelTasks.push({
        ...(t as any),
        assignees,
        subtasks: subtasksByParent[t.id] ?? [],
      } as Task)
    }
  }

  // Fetch actual hours via time entries on tasks
  let actualHours = 0
  const { data: timeEntries } = await supabase
    .from('time_entries')
    .select('duration_minutes, task:tasks!inner(project_id)')
    .eq('tasks.project_id', id)
    .not('duration_minutes', 'is', null)

  if (timeEntries) {
    for (const entry of timeEntries as any[]) {
      actualHours += (entry.duration_minutes ?? 0) / 60
    }
  }

  // Fetch activity logs for timeline
  const { data: activityLogs } = await supabase
    .from('activity_logs')
    .select(`
      *,
      user:profiles(id, full_name, email, avatar_url, role, is_temp_password, onboarding_completed, created_at, updated_at)
    `)
    .eq('task_id', id)
    .order('created_at', { ascending: false })
    .limit(50)

  // Fetch workspace members
  const { data: assignments } = await supabase
    .from('workspace_assignments')
    .select(`
      user:profiles(id, full_name, email, avatar_url, role, is_temp_password, onboarding_completed, created_at, updated_at)
    `)
    .eq('workspace_id', project.workspace_id)

  const members: Profile[] = (assignments ?? [])
    .map((a: any) => a.user)
    .filter(Boolean) as Profile[]

  const projectWithHours = {
    ...project,
    actual_hours: actualHours,
  } as Project

  return (
    <ProjectDetailPage
      project={projectWithHours}
      tasks={topLevelTasks}
      activityLogs={(activityLogs as ActivityLog[]) ?? []}
      members={members}
      profile={profile as Profile}
    />
  )
}
