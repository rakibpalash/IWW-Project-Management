'use server'

import { createAdminClient } from '@/lib/supabase/server'

export interface DeleteImpact {
  members: { id: string; full_name: string; avatar_url: string | null }[]
  projectCount: number
  taskCount: number
  // For workspace: list of projects that tasks will be deleted from
  projects: { id: string; name: string; task_count: number }[]
  // For reassignment options
  otherWorkspaces: { id: string; name: string }[]
  otherProjects: { id: string; name: string; workspace_id: string }[]
  // Task list (for project/staff delete)
  tasks: { id: string; title: string; status: string; project_id: string }[]
  // Other users for reassignment (staff delete)
  otherUsers: { id: string; full_name: string; avatar_url: string | null }[]
}

export async function getWorkspaceDeleteImpact(
  workspaceId: string
): Promise<{ success: boolean; impact?: DeleteImpact; error?: string }> {
  try {
    const admin = createAdminClient()

    const [{ data: members }, { data: projects }] = await Promise.all([
      admin
        .from('workspace_assignments')
        .select('user:profiles(id, full_name, avatar_url)')
        .eq('workspace_id', workspaceId),
      admin
        .from('projects')
        .select('id, name')
        .eq('workspace_id', workspaceId),
    ])

    const projectIds = (projects ?? []).map((p) => p.id)

    let taskCount = 0
    const projectsWithTasks: DeleteImpact['projects'] = []

    if (projectIds.length > 0) {
      const { data: tasks } = await admin
        .from('tasks')
        .select('id, project_id')
        .in('project_id', projectIds)
        .is('parent_task_id', null)

      taskCount = tasks?.length ?? 0
      for (const p of projects ?? []) {
        const count = tasks?.filter((t) => t.project_id === p.id).length ?? 0
        projectsWithTasks.push({ id: p.id, name: p.name, task_count: count })
      }
    }

    // Other workspaces for move option
    const { data: otherWorkspaces } = await admin
      .from('workspaces')
      .select('id, name')
      .neq('id', workspaceId)
      .order('name')

    return {
      success: true,
      impact: {
        members: (members ?? []).map((m: any) => m.user).filter(Boolean),
        projectCount: projects?.length ?? 0,
        taskCount,
        projects: projectsWithTasks,
        otherWorkspaces: otherWorkspaces ?? [],
        otherProjects: [],
        tasks: [],
        otherUsers: [],
      },
    }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

export async function getProjectDeleteImpact(
  projectId: string
): Promise<{ success: boolean; impact?: DeleteImpact; error?: string }> {
  try {
    const admin = createAdminClient()

    const [{ data: tasksRaw }, { data: project }, { data: taskDetails }] = await Promise.all([
      admin
        .from('tasks')
        .select('id, task_assignees(user:profiles(id, full_name, avatar_url))')
        .eq('project_id', projectId)
        .is('parent_task_id', null),
      admin.from('projects').select('workspace_id').eq('id', projectId).single(),
      admin
        .from('tasks')
        .select('id, title, status, project_id')
        .eq('project_id', projectId)
        .is('parent_task_id', null)
        .order('title')
        .limit(20),
    ])

    // Unique members across all tasks
    const memberMap = new Map<string, { id: string; full_name: string; avatar_url: string | null }>()
    for (const task of tasksRaw ?? []) {
      for (const ta of (task as any).task_assignees ?? []) {
        const u = ta.user
        if (u && !memberMap.has(u.id)) memberMap.set(u.id, u)
      }
    }

    // Other workspaces and projects for move option
    const [{ data: otherProjects }, { data: otherUsers }] = await Promise.all([
      admin
        .from('projects')
        .select('id, name, workspace_id')
        .neq('id', projectId)
        .order('name'),
      admin
        .from('profiles')
        .select('id, full_name, avatar_url')
        .in('role', ['staff', 'account_manager', 'project_manager'])
        .order('full_name'),
    ])

    return {
      success: true,
      impact: {
        members: Array.from(memberMap.values()),
        projectCount: 0,
        taskCount: tasksRaw?.length ?? 0,
        projects: [],
        otherWorkspaces: [],
        otherProjects: otherProjects ?? [],
        tasks: (taskDetails ?? []).map((t: any) => ({ id: t.id, title: t.title, status: t.status, project_id: t.project_id })),
        otherUsers: otherUsers ?? [],
      },
    }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

export async function getTaskDeleteImpact(
  taskId: string
): Promise<{ success: boolean; impact?: DeleteImpact; error?: string }> {
  try {
    const admin = createAdminClient()

    const { data: assignees } = await admin
      .from('task_assignees')
      .select('user:profiles(id, full_name, avatar_url)')
      .eq('task_id', taskId)

    return {
      success: true,
      impact: {
        members: (assignees ?? []).map((a: any) => a.user).filter(Boolean),
        projectCount: 0,
        taskCount: 0,
        projects: [],
        otherWorkspaces: [],
        otherProjects: [],
        tasks: [],
        otherUsers: [],
      },
    }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

export async function getStaffDeleteImpact(
  userId: string
): Promise<{ success: boolean; impact?: DeleteImpact; error?: string }> {
  try {
    const admin = createAdminClient()

    const [{ data: assignedTasks }, { count: projectCount }, { data: otherUsers }] = await Promise.all([
      admin
        .from('task_assignees')
        .select('task:tasks(id, title, status, project_id)')
        .eq('user_id', userId),
      admin
        .from('project_members')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId),
      admin
        .from('profiles')
        .select('id, full_name, avatar_url')
        .in('role', ['staff', 'account_manager', 'project_manager'])
        .neq('id', userId)
        .order('full_name'),
    ])

    const tasks = (assignedTasks ?? [])
      .map((a: any) => a.task)
      .filter(Boolean)
      .map((t: any) => ({ id: t.id, title: t.title, status: t.status, project_id: t.project_id }))

    return {
      success: true,
      impact: {
        members: [],
        projectCount: projectCount ?? 0,
        taskCount: tasks.length,
        projects: [],
        tasks,
        otherWorkspaces: [],
        otherProjects: [],
        otherUsers: otherUsers ?? [],
      },
    }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}
