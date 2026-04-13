'use server'

import { createAdminClient } from '@/lib/supabase/server'

export interface DeleteImpact {
  members: { id: string; full_name: string; avatar_url: string | null }[]
  listCount: number
  taskCount: number
  // For space: list of lists that tasks will be deleted from
  lists: { id: string; name: string; task_count: number }[]
  // For reassignment options
  otherSpaces: { id: string; name: string }[]
  otherLists: { id: string; name: string; space_id: string }[]
  // Task list (for list/staff delete)
  tasks: { id: string; title: string; status: string; list_id: string }[]
  // Other users for reassignment (staff delete)
  otherUsers: { id: string; full_name: string; avatar_url: string | null }[]
}

export async function getSpaceDeleteImpact(
  spaceId: string
): Promise<{ success: boolean; impact?: DeleteImpact; error?: string }> {
  try {
    const admin = createAdminClient()

    const [{ data: members }, { data: lists }] = await Promise.all([
      admin
        .from('space_assignments')
        .select('user:profiles(id, full_name, avatar_url)')
        .eq('space_id', spaceId),
      admin
        .from('lists')
        .select('id, name')
        .eq('space_id', spaceId),
    ])

    const listIds = (lists ?? []).map((p) => p.id)

    let taskCount = 0
    const listsWithTasks: DeleteImpact['lists'] = []

    if (listIds.length > 0) {
      const { data: tasks } = await admin
        .from('tasks')
        .select('id, list_id')
        .in('list_id', listIds)
        .is('parent_task_id', null)

      taskCount = tasks?.length ?? 0
      for (const p of lists ?? []) {
        const count = tasks?.filter((t) => t.list_id === p.id).length ?? 0
        listsWithTasks.push({ id: p.id, name: p.name, task_count: count })
      }
    }

    // Other spaces for move option
    const { data: otherSpaces } = await admin
      .from('spaces')
      .select('id, name')
      .neq('id', spaceId)
      .order('name')

    return {
      success: true,
      impact: {
        members: (members ?? []).map((m: any) => m.user).filter(Boolean),
        listCount: lists?.length ?? 0,
        taskCount,
        lists: listsWithTasks,
        otherSpaces: otherSpaces ?? [],
        otherLists: [],
        tasks: [],
        otherUsers: [],
      },
    }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

export async function getListDeleteImpact(
  listId: string
): Promise<{ success: boolean; impact?: DeleteImpact; error?: string }> {
  try {
    const admin = createAdminClient()

    const [{ data: tasksRaw }, { data: taskDetails }, { data: listMembers }] = await Promise.all([
      admin
        .from('tasks')
        .select('id, task_assignees(user:profiles(id, full_name, avatar_url))')
        .eq('list_id', listId)
        .is('parent_task_id', null),
      admin
        .from('tasks')
        .select('id, title, status, list_id')
        .eq('list_id', listId)
        .is('parent_task_id', null)
        .order('title')
        .limit(20),
      // Fetch actual list team members
      admin
        .from('list_members')
        .select('user:profiles(id, full_name, avatar_url)')
        .eq('list_id', listId),
    ])

    // Unique members: list team members + task assignees
    const memberMap = new Map<string, { id: string; full_name: string; avatar_url: string | null }>()

    // List team members (leads + members)
    for (const pm of listMembers ?? []) {
      const u = (pm as any).user
      if (u && !memberMap.has(u.id)) memberMap.set(u.id, u)
    }

    // Also include task assignees
    for (const task of tasksRaw ?? []) {
      for (const ta of (task as any).task_assignees ?? []) {
        const u = ta.user
        if (u && !memberMap.has(u.id)) memberMap.set(u.id, u)
      }
    }

    // Other lists for move option
    const [{ data: otherLists }, { data: otherUsers }] = await Promise.all([
      admin
        .from('lists')
        .select('id, name, space_id')
        .neq('id', listId)
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
        listCount: 0,
        taskCount: tasksRaw?.length ?? 0,
        lists: [],
        otherSpaces: [],
        otherLists: otherLists ?? [],
        tasks: (taskDetails ?? []).map((t: any) => ({ id: t.id, title: t.title, status: t.status, list_id: t.list_id })),
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
        listCount: 0,
        taskCount: 0,
        lists: [],
        otherSpaces: [],
        otherLists: [],
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

    const [{ data: assignedTasks }, { count: listCount }, { data: otherUsers }] = await Promise.all([
      admin
        .from('task_assignees')
        .select('task:tasks(id, title, status, list_id)')
        .eq('user_id', userId),
      admin
        .from('list_members')
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
      .map((t: any) => ({ id: t.id, title: t.title, status: t.status, list_id: t.list_id }))

    return {
      success: true,
      impact: {
        members: [],
        listCount: listCount ?? 0,
        taskCount: tasks.length,
        lists: [],
        tasks,
        otherSpaces: [],
        otherLists: [],
        otherUsers: otherUsers ?? [],
      },
    }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}
