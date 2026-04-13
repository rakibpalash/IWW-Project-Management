import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { TaskDetailPage } from '@/components/tasks/task-detail-page'
import { Task, Profile, Comment, TimeEntry, ActivityLog } from '@/types'
import { getUser, getProfile } from '@/lib/data/auth'

interface TaskPageProps {
  params: Promise<{ id: string; taskId: string }>
}

export async function generateMetadata({ params }: TaskPageProps) {
  const { taskId } = await params
  const supabase = await createClient()
  const { data } = await supabase.from('tasks').select('title').eq('id', taskId).single()
  return { title: data?.title ?? 'Task' }
}

export default async function TaskDetailServerPage({ params }: TaskPageProps) {
  const { id: projectId, taskId } = await params
  const user = await getUser()
  if (!user) redirect('/login')

  const profile = await getProfile(user.id)
  if (!profile) redirect('/login')

  const supabase = await createClient()

  const profileSelect =
    'id, full_name, email, avatar_url, role, is_temp_password, onboarding_completed, created_at, updated_at'

  // Fetch the task with project + assignees
  const { data: taskRaw, error: taskError } = await supabase
    .from('tasks')
    .select(`
      *,
      project:projects(id, name, workspace_id, status, priority, description, client_id, start_date, due_date, estimated_hours, progress, created_by, created_at, updated_at),
      assignees:task_assignees(
        user:profiles(${profileSelect})
      )
    `)
    .eq('id', taskId)
    .eq('project_id', projectId)
    .single()

  if (taskError || !taskRaw) {
    notFound()
  }

  const assignees: Profile[] = ((taskRaw as any).assignees ?? [])
    .map((a: any) => a.user)
    .filter(Boolean) as Profile[]

  // Fetch subtasks
  const { data: subtasksRaw } = await supabase
    .from('tasks')
    .select(`
      *,
      assignees:task_assignees(
        user:profiles(${profileSelect})
      )
    `)
    .eq('parent_task_id', taskId)
    .order('created_at', { ascending: true })

  const subtasks: Task[] = (subtasksRaw ?? []).map((s: any) => ({
    ...s,
    assignees: (s.assignees ?? []).map((a: any) => a.user).filter(Boolean),
  })) as Task[]

  const task: Task = {
    ...(taskRaw as any),
    assignees,
    subtasks,
  }

  // Fetch comments (top-level + replies)
  const { data: commentsRaw } = await supabase
    .from('comments')
    .select(`
      *,
      user:profiles(${profileSelect})
    `)
    .eq('task_id', taskId)
    .order('created_at', { ascending: true })

  // Build comment tree
  const allComments = (commentsRaw ?? []) as Comment[]
  const topLevelComments: Comment[] = []
  const repliesMap: Record<string, Comment[]> = {}

  for (const c of allComments) {
    if (c.parent_comment_id) {
      if (!repliesMap[c.parent_comment_id]) repliesMap[c.parent_comment_id] = []
      repliesMap[c.parent_comment_id].push(c)
    } else {
      topLevelComments.push(c)
    }
  }

  const comments: Comment[] = topLevelComments.map((c) => ({
    ...c,
    replies: repliesMap[c.id] ?? [],
  }))

  // Fetch time entries
  const { data: timeEntriesRaw } = await supabase
    .from('time_entries')
    .select('*')
    .eq('task_id', taskId)
    .order('started_at', { ascending: false })

  const timeEntries = (timeEntriesRaw ?? []) as TimeEntry[]

  // Compute actual hours
  const actualMinutes = timeEntries
    .filter((e) => e.duration_minutes !== null)
    .reduce((sum, e) => sum + (e.duration_minutes ?? 0), 0)

  // Fetch activity logs
  const { data: activityLogsRaw } = await supabase
    .from('activity_logs')
    .select(`
      *,
      user:profiles(${profileSelect})
    `)
    .eq('task_id', taskId)
    .order('created_at', { ascending: false })
    .limit(100)

  const activityLogs = (activityLogsRaw ?? []) as ActivityLog[]

  // Fetch workspace members for assignee picker
  const workspaceId = (taskRaw as any).project?.workspace_id
  let members: Profile[] = []

  if (workspaceId) {
    const { data: assignmentsRaw } = await supabase
      .from('workspace_assignments')
      .select(`user:profiles(${profileSelect})`)
      .eq('workspace_id', workspaceId)

    members = ((assignmentsRaw ?? []) as any[])
      .map((a) => a.user)
      .filter(Boolean) as Profile[]
  }

  // Also include super_admins
  const { data: admins } = await supabase
    .from('profiles')
    .select(profileSelect)
    .eq('role', 'super_admin')

  const adminProfiles = (admins ?? []) as Profile[]
  const memberIds = new Set(members.map((m) => m.id))
  for (const a of adminProfiles) {
    if (!memberIds.has(a.id)) members.push(a)
  }

  return (
    <TaskDetailPage
      task={{ ...task, actual_hours: actualMinutes / 60 }}
      comments={comments}
      timeEntries={timeEntries}
      activityLogs={activityLogs}
      members={members}
      profile={profile as Profile}
    />
  )
}
