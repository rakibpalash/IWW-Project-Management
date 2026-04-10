'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'

// ── Types ─────────────────────────────────────────────────────────────────────

export type ProjectProgressRow = {
  id: string
  name: string
  status: string
  priority: string
  total_tasks: number
  completed_tasks: number
  logged_hours: number
  estimated_hours: number | null
  due_date: string | null
  progress: number
  workspace_name: string | null
  is_overdue: boolean
}

export type ProjectTimeRow = {
  project_id: string
  project_name: string
  user_id: string
  user_name: string
  total_minutes: number
  entry_count: number
  billable_minutes: number
}

export type TaskCompletionData = {
  total: number
  completed: number
  in_progress: number
  overdue: number
  by_status: { status: string; count: number }[]
  by_project: { project_name: string; total: number; completed: number }[]
}

export type OverdueTaskRow = {
  id: string
  title: string
  project_name: string
  priority: string
  due_date: string
  days_overdue: number
  assignees: { id: string; name: string }[]
}

export type TaskDistributionData = {
  by_status: { label: string; count: number; color: string }[]
  by_priority: { label: string; count: number; color: string }[]
  by_assignee: { name: string; total: number; done: number }[]
}

export type TimeLogRow = {
  id: string
  date: string
  user_name: string
  project_name: string
  task_title: string
  duration_minutes: number
  description: string | null
  is_billable: boolean
}

export type MemberProductivityRow = {
  user_id: string
  user_name: string
  user_email: string
  tasks_assigned: number
  tasks_completed: number
  hours_logged: number
  completion_rate: number
}

export type AttendanceSummaryRow = {
  user_id: string
  user_name: string
  on_time: number
  late_150: number
  late_250: number
  absent: number
  no_record: number
  total_working_days: number
  attendance_rate: number
}

export type LeaveUsageRow = {
  user_id: string
  user_name: string
  user_email: string
  yearly_base: number
  yearly_additional: number
  yearly_total: number
  yearly_used: number
  yearly_remaining: number
  wfh_base: number
  wfh_additional: number
  wfh_total: number
  wfh_used: number
  wfh_remaining: number
  marriage_total: number
  marriage_used: number
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function getOrgId(): Promise<{ orgId: string | null; error?: string }> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) return { orgId: null, error: 'Not authenticated' }

    const admin = createAdminClient()
    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('organization_id')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) return { orgId: null, error: 'Profile not found' }
    if (!profile.organization_id) return { orgId: null, error: 'Organization not set up' }

    return { orgId: profile.organization_id as string }
  } catch (err) {
    return { orgId: null, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

// ── 1. Project Progress Report ────────────────────────────────────────────────

export async function getProjectProgressReportAction(filters: {
  workspaceId?: string
  status?: string
}): Promise<{ data?: ProjectProgressRow[]; error?: string }> {
  try {
    const { orgId, error: orgError } = await getOrgId()
    if (orgError || !orgId) return { error: orgError ?? 'Organization not found' }

    const admin = createAdminClient()

    // Fetch workspaces scoped to org
    let workspaceQuery = admin.from('workspaces').select('id').eq('organization_id', orgId)
    if (filters.workspaceId) workspaceQuery = workspaceQuery.eq('id', filters.workspaceId)
    const { data: workspaces } = await workspaceQuery
    const workspaceIds = (workspaces ?? []).map((w: any) => w.id)

    if (workspaceIds.length === 0) return { data: [] }

    // Fetch projects
    let projectQuery = admin
      .from('projects')
      .select('id, name, status, priority, due_date, estimated_hours, progress, workspace_id, workspace:workspaces(name)')
      .in('workspace_id', workspaceIds)

    if (filters.status) projectQuery = projectQuery.eq('status', filters.status)

    const { data: projects, error: projError } = await projectQuery
    if (projError || !projects || projects.length === 0) return { data: [] }

    const projectIds = projects.map((p: any) => p.id)

    // Fetch task counts per project
    const { data: allTasks } = await admin
      .from('tasks')
      .select('id, project_id, status')
      .in('project_id', projectIds)

    // Fetch time entries via tasks
    const { data: timeEntries } = await admin
      .from('time_entries')
      .select('task_id, duration_minutes, task:tasks!inner(project_id)')
      .in('task.project_id', projectIds)
      .not('duration_minutes', 'is', null)

    const now = new Date()

    const rows: ProjectProgressRow[] = projects.map((p: any) => {
      const projectTasks = (allTasks ?? []).filter((t: any) => t.project_id === p.id)
      const total_tasks = projectTasks.length
      const completed_tasks = projectTasks.filter((t: any) => t.status === 'done').length

      const projectTimeEntries = (timeEntries ?? []).filter(
        (te: any) => te.task?.project_id === p.id
      )
      const logged_minutes = projectTimeEntries.reduce(
        (sum: number, te: any) => sum + (te.duration_minutes ?? 0),
        0
      )
      const logged_hours = Math.round((logged_minutes / 60) * 100) / 100

      const is_overdue =
        p.due_date != null &&
        p.status !== 'completed' &&
        p.status !== 'cancelled' &&
        new Date(p.due_date) < now

      return {
        id: p.id,
        name: p.name,
        status: p.status,
        priority: p.priority,
        total_tasks,
        completed_tasks,
        logged_hours,
        estimated_hours: p.estimated_hours ?? null,
        due_date: p.due_date ?? null,
        progress: p.progress ?? 0,
        workspace_name: (p.workspace as any)?.name ?? null,
        is_overdue,
      }
    })

    return { data: rows }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

// ── 2. Project Time Report ────────────────────────────────────────────────────

export async function getProjectTimeReportAction(filters: {
  startDate: string
  endDate: string
  projectId?: string
}): Promise<{ data?: ProjectTimeRow[]; error?: string }> {
  try {
    const { orgId, error: orgError } = await getOrgId()
    if (orgError || !orgId) return { error: orgError ?? 'Organization not found' }

    const admin = createAdminClient()

    // Get workspace IDs for org
    const { data: workspaces } = await admin
      .from('workspaces')
      .select('id')
      .eq('organization_id', orgId)
    const workspaceIds = (workspaces ?? []).map((w: any) => w.id)
    if (workspaceIds.length === 0) return { data: [] }

    // Get project IDs scoped to org
    let projectQuery = admin
      .from('projects')
      .select('id, name')
      .in('workspace_id', workspaceIds)
    if (filters.projectId) projectQuery = projectQuery.eq('id', filters.projectId)
    const { data: projects } = await projectQuery
    const projectIds = (projects ?? []).map((p: any) => p.id)
    if (projectIds.length === 0) return { data: [] }

    const projectMap = Object.fromEntries((projects ?? []).map((p: any) => [p.id, p.name]))

    // Fetch time entries in date range via task → project
    const { data: entries, error: entriesError } = await admin
      .from('time_entries')
      .select('id, user_id, duration_minutes, is_billable, task:tasks!inner(project_id)')
      .gte('started_at', `${filters.startDate}T00:00:00`)
      .lte('started_at', `${filters.endDate}T23:59:59`)
      .in('task.project_id', projectIds)
      .not('duration_minutes', 'is', null)

    if (entriesError || !entries || entries.length === 0) return { data: [] }

    // Get profile names
    const userIds = [...new Set(entries.map((e: any) => e.user_id))]
    const { data: profiles } = await admin
      .from('profiles')
      .select('id, full_name')
      .in('id', userIds)
    const profileMap = Object.fromEntries((profiles ?? []).map((p: any) => [p.id, p.full_name]))

    // Aggregate by project + user
    const aggregated: Record<string, ProjectTimeRow> = {}
    for (const entry of entries) {
      const projectId = (entry as any).task?.project_id
      if (!projectId) continue
      const key = `${projectId}__${entry.user_id}`
      if (!aggregated[key]) {
        aggregated[key] = {
          project_id: projectId,
          project_name: projectMap[projectId] ?? 'Unknown Project',
          user_id: entry.user_id,
          user_name: profileMap[entry.user_id] ?? 'Unknown User',
          total_minutes: 0,
          entry_count: 0,
          billable_minutes: 0,
        }
      }
      aggregated[key].total_minutes += entry.duration_minutes ?? 0
      aggregated[key].entry_count += 1
      if ((entry as any).is_billable) {
        aggregated[key].billable_minutes += entry.duration_minutes ?? 0
      }
    }

    return { data: Object.values(aggregated) }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

// ── 3. Task Completion Report ─────────────────────────────────────────────────

export async function getTaskCompletionReportAction(filters: {
  startDate: string
  endDate: string
  projectId?: string
}): Promise<{ data?: TaskCompletionData; error?: string }> {
  try {
    const { orgId, error: orgError } = await getOrgId()
    if (orgError || !orgId) return { error: orgError ?? 'Organization not found' }

    const admin = createAdminClient()

    // Get workspace + project IDs for org
    const { data: workspaces } = await admin
      .from('workspaces')
      .select('id')
      .eq('organization_id', orgId)
    const workspaceIds = (workspaces ?? []).map((w: any) => w.id)
    if (workspaceIds.length === 0) {
      return {
        data: { total: 0, completed: 0, in_progress: 0, overdue: 0, by_status: [], by_project: [] },
      }
    }

    let projectQuery = admin
      .from('projects')
      .select('id, name')
      .in('workspace_id', workspaceIds)
    if (filters.projectId) projectQuery = projectQuery.eq('id', filters.projectId)
    const { data: projects } = await projectQuery
    const projectIds = (projects ?? []).map((p: any) => p.id)
    const projectMap = Object.fromEntries((projects ?? []).map((p: any) => [p.id, p.name]))

    if (projectIds.length === 0) {
      return {
        data: { total: 0, completed: 0, in_progress: 0, overdue: 0, by_status: [], by_project: [] },
      }
    }

    const { data: tasks, error: tasksError } = await admin
      .from('tasks')
      .select('id, status, due_date, project_id')
      .in('project_id', projectIds)
      .gte('created_at', `${filters.startDate}T00:00:00`)
      .lte('created_at', `${filters.endDate}T23:59:59`)

    if (tasksError || !tasks) {
      return {
        data: { total: 0, completed: 0, in_progress: 0, overdue: 0, by_status: [], by_project: [] },
      }
    }

    const now = new Date()
    const total = tasks.length
    const completed = tasks.filter((t: any) => t.status === 'done').length
    const in_progress = tasks.filter((t: any) => t.status === 'in_progress').length
    const overdue = tasks.filter(
      (t: any) =>
        t.due_date != null &&
        t.status !== 'done' &&
        t.status !== 'cancelled' &&
        new Date(t.due_date) < now
    ).length

    // by_status aggregation
    const statusCounts: Record<string, number> = {}
    for (const t of tasks) {
      statusCounts[t.status] = (statusCounts[t.status] ?? 0) + 1
    }
    const by_status = Object.entries(statusCounts).map(([status, count]) => ({ status, count }))

    // by_project aggregation
    const byProjectMap: Record<string, { total: number; completed: number }> = {}
    for (const t of tasks) {
      if (!byProjectMap[t.project_id]) byProjectMap[t.project_id] = { total: 0, completed: 0 }
      byProjectMap[t.project_id].total += 1
      if (t.status === 'done') byProjectMap[t.project_id].completed += 1
    }
    const by_project = Object.entries(byProjectMap).map(([projectId, counts]) => ({
      project_name: projectMap[projectId] ?? 'Unknown Project',
      ...counts,
    }))

    return { data: { total, completed, in_progress, overdue, by_status, by_project } }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

// ── 4. Overdue Tasks Report ───────────────────────────────────────────────────

export async function getOverdueTasksReportAction(filters: {
  projectId?: string
  priority?: string
}): Promise<{ data?: OverdueTaskRow[]; error?: string }> {
  try {
    const { orgId, error: orgError } = await getOrgId()
    if (orgError || !orgId) return { error: orgError ?? 'Organization not found' }

    const admin = createAdminClient()

    const { data: workspaces } = await admin
      .from('workspaces')
      .select('id')
      .eq('organization_id', orgId)
    const workspaceIds = (workspaces ?? []).map((w: any) => w.id)
    if (workspaceIds.length === 0) return { data: [] }

    let projectQuery = admin
      .from('projects')
      .select('id, name')
      .in('workspace_id', workspaceIds)
    if (filters.projectId) projectQuery = projectQuery.eq('id', filters.projectId)
    const { data: projects } = await projectQuery
    const projectIds = (projects ?? []).map((p: any) => p.id)
    const projectMap = Object.fromEntries((projects ?? []).map((p: any) => [p.id, p.name]))

    if (projectIds.length === 0) return { data: [] }

    const today = new Date().toISOString().slice(0, 10)

    let taskQuery = admin
      .from('tasks')
      .select('id, title, priority, due_date, project_id, task_assignees(user_id)')
      .in('project_id', projectIds)
      .lt('due_date', today)
      .not('status', 'in', '("done","cancelled")')
      .not('due_date', 'is', null)

    if (filters.priority) taskQuery = taskQuery.eq('priority', filters.priority)

    const { data: tasks, error: tasksError } = await taskQuery
    if (tasksError || !tasks) return { data: [] }

    // Get assignee profiles
    const allUserIds = [
      ...new Set(
        tasks.flatMap((t: any) => ((t.task_assignees as any[]) ?? []).map((a: any) => a.user_id))
      ),
    ]
    const profileMap: Record<string, string> = {}
    if (allUserIds.length > 0) {
      const { data: profiles } = await admin
        .from('profiles')
        .select('id, full_name')
        .in('id', allUserIds)
      for (const p of profiles ?? []) {
        profileMap[(p as any).id] = (p as any).full_name
      }
    }

    const now = new Date()

    const rows: OverdueTaskRow[] = tasks.map((t: any) => {
      const dueDate = new Date(t.due_date)
      const diffMs = now.getTime() - dueDate.getTime()
      const days_overdue = Math.floor(diffMs / (1000 * 60 * 60 * 24))

      const assignees = ((t.task_assignees as any[]) ?? []).map((a: any) => ({
        id: a.user_id,
        name: profileMap[a.user_id] ?? 'Unknown',
      }))

      return {
        id: t.id,
        title: t.title,
        project_name: projectMap[t.project_id] ?? 'Unknown Project',
        priority: t.priority,
        due_date: t.due_date,
        days_overdue,
        assignees,
      }
    })

    rows.sort((a, b) => b.days_overdue - a.days_overdue)

    return { data: rows }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

// ── 5. Task Distribution Report ───────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  todo: '#94a3b8',
  in_progress: '#3b82f6',
  in_review: '#f59e0b',
  done: '#22c55e',
  cancelled: '#ef4444',
}

const PRIORITY_COLORS: Record<string, string> = {
  low: '#94a3b8',
  medium: '#3b82f6',
  high: '#f59e0b',
  urgent: '#ef4444',
}

export async function getTaskDistributionReportAction(filters: {
  projectId?: string
}): Promise<{ data?: TaskDistributionData; error?: string }> {
  try {
    const { orgId, error: orgError } = await getOrgId()
    if (orgError || !orgId) return { error: orgError ?? 'Organization not found' }

    const admin = createAdminClient()

    const { data: workspaces } = await admin
      .from('workspaces')
      .select('id')
      .eq('organization_id', orgId)
    const workspaceIds = (workspaces ?? []).map((w: any) => w.id)
    if (workspaceIds.length === 0) {
      return { data: { by_status: [], by_priority: [], by_assignee: [] } }
    }

    let projectQuery = admin
      .from('projects')
      .select('id')
      .in('workspace_id', workspaceIds)
    if (filters.projectId) projectQuery = projectQuery.eq('id', filters.projectId)
    const { data: projects } = await projectQuery
    const projectIds = (projects ?? []).map((p: any) => p.id)

    if (projectIds.length === 0) {
      return { data: { by_status: [], by_priority: [], by_assignee: [] } }
    }

    const { data: tasks, error: tasksError } = await admin
      .from('tasks')
      .select('id, status, priority, task_assignees(user_id)')
      .in('project_id', projectIds)

    if (tasksError || !tasks) {
      return { data: { by_status: [], by_priority: [], by_assignee: [] } }
    }

    // by_status
    const statusCounts: Record<string, number> = {}
    for (const t of tasks) {
      statusCounts[t.status] = (statusCounts[t.status] ?? 0) + 1
    }
    const by_status = Object.entries(statusCounts).map(([label, count]) => ({
      label,
      count,
      color: STATUS_COLORS[label] ?? '#94a3b8',
    }))

    // by_priority
    const priorityCounts: Record<string, number> = {}
    for (const t of tasks) {
      priorityCounts[t.priority] = (priorityCounts[t.priority] ?? 0) + 1
    }
    const by_priority = Object.entries(priorityCounts).map(([label, count]) => ({
      label,
      count,
      color: PRIORITY_COLORS[label] ?? '#94a3b8',
    }))

    // by_assignee — gather all user IDs
    const allUserIds = [
      ...new Set(
        tasks.flatMap((t: any) => ((t.task_assignees as any[]) ?? []).map((a: any) => a.user_id))
      ),
    ]
    const profileMap: Record<string, string> = {}
    if (allUserIds.length > 0) {
      const { data: profiles } = await admin
        .from('profiles')
        .select('id, full_name')
        .in('id', allUserIds)
      for (const p of profiles ?? []) {
        profileMap[(p as any).id] = (p as any).full_name
      }
    }

    const assigneeCounts: Record<string, { total: number; done: number }> = {}
    for (const t of tasks) {
      for (const a of (t as any).task_assignees ?? []) {
        const uid = a.user_id
        if (!assigneeCounts[uid]) assigneeCounts[uid] = { total: 0, done: 0 }
        assigneeCounts[uid].total += 1
        if (t.status === 'done') assigneeCounts[uid].done += 1
      }
    }
    const by_assignee = Object.entries(assigneeCounts).map(([uid, counts]) => ({
      name: profileMap[uid] ?? 'Unknown',
      ...counts,
    }))

    return { data: { by_status, by_priority, by_assignee } }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

// ── 6. Time Log Report ────────────────────────────────────────────────────────

export async function getTimeLogReportAction(filters: {
  startDate: string
  endDate: string
  projectId?: string
  userId?: string
}): Promise<{ data?: TimeLogRow[]; error?: string }> {
  try {
    const { orgId, error: orgError } = await getOrgId()
    if (orgError || !orgId) return { error: orgError ?? 'Organization not found' }

    const admin = createAdminClient()

    const { data: workspaces } = await admin
      .from('workspaces')
      .select('id')
      .eq('organization_id', orgId)
    const workspaceIds = (workspaces ?? []).map((w: any) => w.id)
    if (workspaceIds.length === 0) return { data: [] }

    let projectQuery = admin
      .from('projects')
      .select('id, name')
      .in('workspace_id', workspaceIds)
    if (filters.projectId) projectQuery = projectQuery.eq('id', filters.projectId)
    const { data: projects } = await projectQuery
    const projectIds = (projects ?? []).map((p: any) => p.id)
    const projectMap = Object.fromEntries((projects ?? []).map((p: any) => [p.id, p.name]))

    if (projectIds.length === 0) return { data: [] }

    let entryQuery = admin
      .from('time_entries')
      .select(
        'id, user_id, started_at, duration_minutes, description, is_billable, task:tasks!inner(id, title, project_id)'
      )
      .gte('started_at', `${filters.startDate}T00:00:00`)
      .lte('started_at', `${filters.endDate}T23:59:59`)
      .in('task.project_id', projectIds)
      .not('duration_minutes', 'is', null)
      .order('started_at', { ascending: false })

    if (filters.userId) entryQuery = entryQuery.eq('user_id', filters.userId)

    const { data: entries, error: entriesError } = await entryQuery
    if (entriesError || !entries) return { data: [] }

    // Get profiles
    const userIds = [...new Set(entries.map((e: any) => e.user_id))]
    const profileMap: Record<string, string> = {}
    if (userIds.length > 0) {
      const { data: profiles } = await admin
        .from('profiles')
        .select('id, full_name')
        .in('id', userIds)
      for (const p of profiles ?? []) {
        profileMap[(p as any).id] = (p as any).full_name
      }
    }

    const rows: TimeLogRow[] = entries.map((e: any) => ({
      id: e.id,
      date: (e.started_at as string).slice(0, 10),
      user_name: profileMap[e.user_id] ?? 'Unknown User',
      project_name: projectMap[e.task?.project_id] ?? 'Unknown Project',
      task_title: e.task?.title ?? 'Unknown Task',
      duration_minutes: e.duration_minutes ?? 0,
      description: e.description ?? null,
      is_billable: e.is_billable ?? false,
    }))

    return { data: rows }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

// ── 7. Member Productivity Report ─────────────────────────────────────────────

export async function getMemberProductivityReportAction(filters: {
  startDate: string
  endDate: string
}): Promise<{ data?: MemberProductivityRow[]; error?: string }> {
  try {
    const { orgId, error: orgError } = await getOrgId()
    if (orgError || !orgId) return { error: orgError ?? 'Organization not found' }

    const admin = createAdminClient()

    // Get all staff members for this org
    const { data: profiles, error: profilesError } = await admin
      .from('profiles')
      .select('id, full_name, email')
      .eq('organization_id', orgId)
      .in('role', ['staff', 'project_manager', 'account_manager'])

    if (profilesError || !profiles || profiles.length === 0) return { data: [] }

    const userIds = profiles.map((p: any) => p.id)

    // Tasks assigned in date range
    const { data: assignees } = await admin
      .from('task_assignees')
      .select('user_id, task:tasks!inner(id, status, created_at)')
      .in('user_id', userIds)
      .gte('task.created_at', `${filters.startDate}T00:00:00`)
      .lte('task.created_at', `${filters.endDate}T23:59:59`)

    // Time entries in date range
    const { data: timeEntries } = await admin
      .from('time_entries')
      .select('user_id, duration_minutes')
      .in('user_id', userIds)
      .gte('started_at', `${filters.startDate}T00:00:00`)
      .lte('started_at', `${filters.endDate}T23:59:59`)
      .not('duration_minutes', 'is', null)

    // Aggregate per user
    const assigneeMap: Record<string, { assigned: number; completed: number }> = {}
    for (const a of assignees ?? []) {
      const uid = a.user_id
      if (!assigneeMap[uid]) assigneeMap[uid] = { assigned: 0, completed: 0 }
      assigneeMap[uid].assigned += 1
      if ((a as any).task?.status === 'done') assigneeMap[uid].completed += 1
    }

    const timeMap: Record<string, number> = {}
    for (const te of timeEntries ?? []) {
      timeMap[te.user_id] = (timeMap[te.user_id] ?? 0) + (te.duration_minutes ?? 0)
    }

    const rows: MemberProductivityRow[] = profiles.map((p: any) => {
      const agg = assigneeMap[p.id] ?? { assigned: 0, completed: 0 }
      const total_minutes = timeMap[p.id] ?? 0
      const hours_logged = Math.round((total_minutes / 60) * 100) / 100
      const completion_rate =
        agg.assigned > 0 ? Math.round((agg.completed / agg.assigned) * 100) : 0

      return {
        user_id: p.id,
        user_name: p.full_name,
        user_email: p.email,
        tasks_assigned: agg.assigned,
        tasks_completed: agg.completed,
        hours_logged,
        completion_rate,
      }
    })

    return { data: rows }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

// ── 8. Attendance Summary Report ──────────────────────────────────────────────

export async function getAttendanceSummaryReportAction(filters: {
  month: string // "YYYY-MM"
}): Promise<{ data?: AttendanceSummaryRow[]; error?: string }> {
  try {
    const { orgId, error: orgError } = await getOrgId()
    if (orgError || !orgId) return { error: orgError ?? 'Organization not found' }

    const admin = createAdminClient()

    // Get staff profiles for the org
    const { data: profiles, error: profilesError } = await admin
      .from('profiles')
      .select('id, full_name')
      .eq('organization_id', orgId)
      .eq('role', 'staff')

    if (profilesError || !profiles || profiles.length === 0) return { data: [] }

    const userIds = profiles.map((p: any) => p.id)

    // Parse month bounds
    const [year, month] = filters.month.split('-').map(Number)
    const startDate = `${filters.month}-01`
    const lastDay = new Date(year, month, 0).getDate()
    const endDate = `${filters.month}-${String(lastDay).padStart(2, '0')}`

    // Count working days in the month (Mon–Sat, excluding Sunday)
    let total_working_days = 0
    for (let d = 1; d <= lastDay; d++) {
      const dow = new Date(year, month - 1, d).getDay()
      if (dow !== 0) total_working_days++ // 0 = Sunday
    }

    // Fetch attendance records for the month
    const { data: records } = await admin
      .from('attendance_records')
      .select('user_id, status, date')
      .in('user_id', userIds)
      .gte('date', startDate)
      .lte('date', endDate)

    // Group by user
    const recordMap: Record<string, { on_time: number; late_150: number; late_250: number; absent: number }> = {}
    for (const r of records ?? []) {
      if (!recordMap[r.user_id]) {
        recordMap[r.user_id] = { on_time: 0, late_150: 0, late_250: 0, absent: 0 }
      }
      const status = r.status as string
      if (status === 'on_time') recordMap[r.user_id].on_time += 1
      else if (status === 'late_150') recordMap[r.user_id].late_150 += 1
      else if (status === 'late_250') recordMap[r.user_id].late_250 += 1
      else if (status === 'absent' || status === 'advance_absence') recordMap[r.user_id].absent += 1
    }

    const rows: AttendanceSummaryRow[] = profiles.map((p: any) => {
      const agg = recordMap[p.id] ?? { on_time: 0, late_150: 0, late_250: 0, absent: 0 }
      const recorded_days = agg.on_time + agg.late_150 + agg.late_250 + agg.absent
      const no_record = Math.max(0, total_working_days - recorded_days)
      const present_days = agg.on_time + agg.late_150 + agg.late_250
      const attendance_rate =
        total_working_days > 0
          ? Math.round((present_days / total_working_days) * 100)
          : 0

      return {
        user_id: p.id,
        user_name: p.full_name,
        on_time: agg.on_time,
        late_150: agg.late_150,
        late_250: agg.late_250,
        absent: agg.absent,
        no_record,
        total_working_days,
        attendance_rate,
      }
    })

    return { data: rows }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

// ── 9. Leave Usage Report ─────────────────────────────────────────────────────

export async function getLeaveUsageReportAction(filters: {
  year: number
}): Promise<{ data?: LeaveUsageRow[]; error?: string }> {
  try {
    const { orgId, error: orgError } = await getOrgId()
    if (orgError || !orgId) return { error: orgError ?? 'Organization not found' }

    const admin = createAdminClient()

    // Get all non-client profiles for the org
    const { data: profiles, error: profilesError } = await admin
      .from('profiles')
      .select('id, full_name, email')
      .eq('organization_id', orgId)
      .not('role', 'eq', 'client')

    if (profilesError || !profiles || profiles.length === 0) return { data: [] }

    const userIds = profiles.map((p: any) => p.id)

    // Fetch leave balances for the year
    const { data: balances } = await admin
      .from('leave_balances')
      .select('user_id, yearly_total, yearly_used, yearly_additional, wfh_total, wfh_used, wfh_additional, marriage_total, marriage_used')
      .in('user_id', userIds)
      .eq('year', filters.year)

    const balanceMap = Object.fromEntries(
      (balances ?? []).map((b: any) => [b.user_id, b])
    )

    const rows: LeaveUsageRow[] = profiles.map((p: any) => {
      const b = balanceMap[p.id]

      const yearly_additional = b?.yearly_additional ?? 0
      const yearly_total = b?.yearly_total ?? 0
      const yearly_used = b?.yearly_used ?? 0
      const wfh_additional = b?.wfh_additional ?? 0
      const wfh_total = b?.wfh_total ?? 0
      const wfh_used = b?.wfh_used ?? 0
      const marriage_total = b?.marriage_total ?? 0
      const marriage_used = b?.marriage_used ?? 0

      return {
        user_id: p.id,
        user_name: p.full_name,
        user_email: p.email,
        yearly_base: yearly_total - yearly_additional,
        yearly_additional,
        yearly_total,
        yearly_used,
        yearly_remaining: Math.max(0, yearly_total - yearly_used),
        wfh_base: wfh_total - wfh_additional,
        wfh_additional,
        wfh_total,
        wfh_used,
        wfh_remaining: Math.max(0, wfh_total - wfh_used),
        marriage_total,
        marriage_used,
      }
    })

    return { data: rows }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Unknown error' }
  }
}
