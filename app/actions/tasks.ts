'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { Task, TimeEntry } from '@/types'
import { notifyMany, getTaskRecipients } from '@/lib/notifications'

type TaskInput = {
  project_id: string
  parent_task_id?: string
  title: string
  description?: string
  start_date?: string
  due_date?: string
  estimated_hours?: number
  priority: string
  status: string
  assignee_ids: string[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function logActivity(
  supabase: Awaited<ReturnType<typeof createClient>>,
  taskId: string,
  userId: string,
  action: string,
  oldValue?: string | null,
  newValue?: string | null
) {
  await supabase.from('activity_logs').insert({
    task_id: taskId,
    user_id: userId,
    action,
    old_value: oldValue ?? null,
    new_value: newValue ?? null,
  })
}

// Use central notify() helper from lib/notifications.ts

// ── Create task ───────────────────────────────────────────────────────────────

export async function createTaskAction(
  data: TaskInput
): Promise<{ success: boolean; task?: Task; error?: string }> {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return { success: false, error: 'Not authenticated' }
    }

    // Determine depth
    let depth = 0
    if (data.parent_task_id) {
      const { data: parent } = await supabase
        .from('tasks')
        .select('depth')
        .eq('id', data.parent_task_id)
        .single()
      if (parent) depth = (parent.depth ?? 0) + 1
    }

    const { data: task, error: taskError } = await supabase
      .from('tasks')
      .insert({
        project_id: data.project_id,
        parent_task_id: data.parent_task_id ?? null,
        title: data.title,
        description: data.description ?? null,
        start_date: data.start_date ?? null,
        due_date: data.due_date ?? null,
        estimated_hours: data.estimated_hours ?? null,
        priority: data.priority,
        status: data.status,
        created_by: user.id,
        depth,
      })
      .select('*')
      .single()

    if (taskError || !task) {
      return { success: false, error: taskError?.message ?? 'Failed to create task' }
    }

    // Insert assignees
    if (data.assignee_ids.length > 0) {
      await supabase.from('task_assignees').insert(
        data.assignee_ids.map((uid) => ({ task_id: task.id, user_id: uid }))
      )
    }

    // Activity log
    await logActivity(supabase, task.id, user.id, 'created_task', null, data.title)

    // Notify each assignee (excluding creator)
    const notifyIds = data.assignee_ids.filter((id) => id !== user.id)
    const notificationType = data.parent_task_id ? 'subtask_assigned' : 'task_assigned'

    await notifyMany(
      notifyIds,
      notificationType,
      data.parent_task_id ? 'New subtask assigned to you' : 'New task assigned to you',
      `You have been assigned to "${data.title}"`,
      `/tasks/${task.id}`
    )

    revalidatePath('/tasks')
    revalidatePath(`/lists/${data.project_id}`)

    return { success: true, task: task as Task }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return { success: false, error: message }
  }
}

// ── Update task ───────────────────────────────────────────────────────────────

export async function updateTaskAction(
  id: string,
  data: Partial<Omit<TaskInput, 'assignee_ids'>> & { assignee_ids?: string[] }
): Promise<{ success: boolean; task?: Task; error?: string }> {
  try {
    // Verify auth with regular client
    const supabase = await createClient()
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return { success: false, error: 'Not authenticated' }
    }

    // Use admin client for DB ops to bypass RLS recursion
    const admin = createAdminClient()

    // Fetch existing task for diff logging
    const { data: existing } = await admin
      .from('tasks')
      .select('*')
      .eq('id', id)
      .single()

    const payload: Record<string, unknown> = { updated_at: new Date().toISOString() }

    if (data.title !== undefined) payload.title = data.title
    if (data.description !== undefined) payload.description = data.description
    if (data.start_date !== undefined) payload.start_date = data.start_date
    if (data.due_date !== undefined) payload.due_date = data.due_date
    if (data.estimated_hours !== undefined) payload.estimated_hours = data.estimated_hours
    if (data.priority !== undefined) payload.priority = data.priority
    if (data.status !== undefined) payload.status = data.status
    if (data.parent_task_id !== undefined) payload.parent_task_id = data.parent_task_id

    const { data: task, error } = await admin
      .from('tasks')
      .update(payload)
      .eq('id', id)
      .select('*')
      .single()

    if (error || !task) {
      return { success: false, error: error?.message ?? 'Failed to update task' }
    }

    // Sync assignees if provided
    if (data.assignee_ids !== undefined) {
      // Determine newly added assignees before deleting old ones
      const { data: oldAssignees } = await admin
        .from('task_assignees')
        .select('user_id')
        .eq('task_id', id)
      const oldIds = (oldAssignees ?? []).map((a: { user_id: string }) => a.user_id)
      const newIds = data.assignee_ids
      const addedIds = newIds.filter((uid) => !oldIds.includes(uid) && uid !== user.id)

      await admin.from('task_assignees').delete().eq('task_id', id)
      if (newIds.length > 0) {
        await admin.from('task_assignees').insert(
          newIds.map((uid) => ({ task_id: id, user_id: uid }))
        )
      }

      // Notify newly added assignees
      if (addedIds.length > 0 && task) {
        const isSubtask = !!task.parent_task_id
        await notifyMany(
          addedIds,
          isSubtask ? 'subtask_assigned' : 'task_assigned',
          isSubtask ? 'New subtask assigned to you' : 'New task assigned to you',
          `You have been assigned to "${task.title}"`,
          `/tasks/${id}`
        )
      }
    }

    // Log field-level changes
    if (existing) {
      const fields = ['title', 'status', 'priority', 'due_date'] as const
      for (const field of fields) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const payloadVal = (payload as any)[field]
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const existingVal = (existing as any)[field]
        if (payloadVal !== undefined && payloadVal !== existingVal) {
          await logActivity(
            admin,
            id,
            user.id,
            `updated_${field}`,
            String(existingVal ?? ''),
            String(payloadVal)
          )
        }
      }
    }

    revalidatePath('/tasks')
    revalidatePath(`/tasks/${id}`)

    return { success: true, task: task as Task }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return { success: false, error: message }
  }
}

// ── Update task status ────────────────────────────────────────────────────────

export async function updateTaskStatusAction(
  id: string,
  status: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Verify auth with regular client
    const supabase = await createClient()
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return { success: false, error: 'Not authenticated' }
    }

    // Use admin client for DB ops to bypass RLS recursion
    const admin = createAdminClient()

    // Fetch task for old status + creator
    const { data: existing } = await admin
      .from('tasks')
      .select('status, created_by, title')
      .eq('id', id)
      .single()

    const oldStatus = existing?.status ?? null

    const { error } = await admin
      .from('tasks')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id)

    if (error) {
      return { success: false, error: error.message }
    }

    // Activity log
    await logActivity(admin, id, user.id, 'changed_status', oldStatus, status)

    // Notify creator + assignees + watchers (excluding the actor)
    const recipients = await getTaskRecipients(
      id,
      user.id,
      existing?.created_by ? [existing.created_by] : []
    )

    await notifyMany(
      recipients,
      'status_changed',
      'Task status updated',
      `"${existing?.title ?? 'A task'}" was moved to ${status.replace(/_/g, ' ')}`,
      `/tasks/${id}`
    )

    revalidatePath('/tasks')
    revalidatePath(`/tasks/${id}`)

    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return { success: false, error: message }
  }
}

// ── Delete task ───────────────────────────────────────────────────────────────

export async function deleteTaskAction(
  id: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient()
    const admin = createAdminClient()

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return { success: false, error: 'Not authenticated' }
    }

    // Fetch task title + all assignees before deleting
    const { data: task } = await admin
      .from('tasks')
      .select('id, title, project_id, task_assignees(user_id)')
      .eq('id', id)
      .single()

    // Fetch deleter's name for the notification message
    const { data: deleter } = await admin
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .single()

    const deleterName = deleter?.full_name ?? 'Someone'
    const taskTitle = task?.title ?? 'a task'
    const assigneeIds: string[] = (task?.task_assignees ?? [])
      .map((a: { user_id: string }) => a.user_id)
      .filter((uid: string) => uid !== user.id) // don't notify the deleter themselves

    // Delete the task (cascades to task_assignees, comments, activity_logs, time_entries)
    const { error } = await admin.from('tasks').delete().eq('id', id)

    if (error) {
      return { success: false, error: error.message }
    }

    // Send in-app notifications to all assignees
    await notifyMany(
      assigneeIds,
      'task_deleted',
      'Task deleted',
      `"${taskTitle}" was deleted by ${deleterName}.`,
      task?.project_id ? `/projects/${task.project_id}` : '/tasks'
    )

    revalidatePath('/tasks')
    revalidatePath(`/lists/${task?.project_id}`)

    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return { success: false, error: message }
  }
}

// ── Log time ──────────────────────────────────────────────────────────────────

export async function logTimeAction(data: {
  task_id: string
  description?: string
  started_at: string
  ended_at: string
  duration_minutes: number
}): Promise<{ success: boolean; entry?: TimeEntry; error?: string }> {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return { success: false, error: 'Not authenticated' }
    }

    const { data: entry, error } = await supabase
      .from('time_entries')
      .insert({
        task_id: data.task_id,
        user_id: user.id,
        description: data.description ?? null,
        started_at: data.started_at,
        ended_at: data.ended_at,
        duration_minutes: data.duration_minutes,
        is_running: false,
      })
      .select('*')
      .single()

    if (error || !entry) {
      return { success: false, error: error?.message ?? 'Failed to log time' }
    }

    // Fetch task for activity log + notifications
    const { data: task } = await supabase
      .from('tasks')
      .select('title, created_by')
      .eq('id', data.task_id)
      .single()

    await logActivity(
      supabase,
      data.task_id,
      user.id,
      'logged_time',
      null,
      `${data.duration_minutes} minutes${data.description ? ` — ${data.description}` : ''}`
    )

    // Notify task creator + watchers (excluding the person who logged time)
    const recipients = await getTaskRecipients(
      data.task_id,
      user.id,
      task?.created_by ? [task.created_by] : []
    )
    await notifyMany(
      recipients,
      'time_logged',
      'Time logged on task',
      `${data.duration_minutes} min logged on "${task?.title ?? 'a task'}"${data.description ? `: ${data.description}` : ''}`,
      `/tasks/${data.task_id}`
    )

    revalidatePath('/tasks')
    revalidatePath(`/tasks/${data.task_id}`)
    revalidatePath('/time-tracking')

    return { success: true, entry: entry as TimeEntry }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return { success: false, error: message }
  }
}

// ── Clone task (recursive) ────────────────────────────────────────────────────

async function cloneTaskRecursive(
  admin: ReturnType<typeof createAdminClient>,
  originalId: string,
  newParentId: string | null,
  projectId: string,
  createdBy: string
): Promise<string | null> {
  const { data: original } = await admin
    .from('tasks')
    .select('*, task_assignees(user_id)')
    .eq('id', originalId)
    .single()

  if (!original) return null

  const { data: cloned } = await admin
    .from('tasks')
    .insert({
      project_id: projectId,
      parent_task_id: newParentId,
      title: newParentId ? original.title : `${original.title} (Copy)`,
      description: original.description,
      start_date: original.start_date,
      due_date: original.due_date,
      estimated_hours: original.estimated_hours,
      priority: original.priority,
      status: 'todo',
      created_by: createdBy,
      depth: original.depth,
    })
    .select('id')
    .single()

  if (!cloned) return null

  const assigneeIds = (original.task_assignees ?? []).map((a: { user_id: string }) => a.user_id)
  if (assigneeIds.length > 0) {
    await admin.from('task_assignees').insert(
      assigneeIds.map((uid: string) => ({ task_id: cloned.id, user_id: uid }))
    )
  }

  const { data: subtasks } = await admin
    .from('tasks')
    .select('id')
    .eq('parent_task_id', originalId)

  for (const sub of subtasks ?? []) {
    await cloneTaskRecursive(admin, sub.id, cloned.id, projectId, createdBy)
  }

  return cloned.id
}

export async function cloneTaskAction(
  taskId: string
): Promise<{ success: boolean; taskId?: string; error?: string }> {
  try {
    const supabase = await createClient()
    const admin = createAdminClient()

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) return { success: false, error: 'Not authenticated' }

    const { data: original } = await admin
      .from('tasks')
      .select('project_id, parent_task_id')
      .eq('id', taskId)
      .single()

    if (!original) return { success: false, error: 'Task not found' }

    const newId = await cloneTaskRecursive(
      admin, taskId, original.parent_task_id, original.project_id, user.id
    )

    if (!newId) return { success: false, error: 'Failed to clone task' }

    revalidatePath('/tasks')
    revalidatePath(`/lists/${original.project_id}`)
    return { success: true, taskId: newId }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}
