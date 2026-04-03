'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { Task, TimeEntry } from '@/types'

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

async function createNotification(
  supabase: Awaited<ReturnType<typeof createClient>>,
  recipientId: string,
  type: 'task_assigned' | 'subtask_assigned' | 'mention' | 'comment_reply' | 'status_changed',
  title: string,
  message: string,
  link?: string
) {
  await supabase.from('notifications').insert({
    user_id: recipientId,
    type,
    title,
    message,
    link: link ?? null,
    is_read: false,
  })
}

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

    await Promise.all(
      notifyIds.map((recipientId) =>
        createNotification(
          supabase,
          recipientId,
          notificationType,
          data.parent_task_id ? 'New subtask assigned to you' : 'New task assigned to you',
          `You have been assigned to "${data.title}"`,
          `/tasks/${task.id}`
        )
      )
    )

    revalidatePath('/tasks')
    revalidatePath(`/projects/${data.project_id}`)

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
    const supabase = await createClient()

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return { success: false, error: 'Not authenticated' }
    }

    // Fetch existing task for diff logging
    const { data: existing } = await supabase
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

    const { data: task, error } = await supabase
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
      await supabase.from('task_assignees').delete().eq('task_id', id)
      if (data.assignee_ids.length > 0) {
        await supabase.from('task_assignees').insert(
          data.assignee_ids.map((uid) => ({ task_id: id, user_id: uid }))
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
            supabase,
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
    const supabase = await createClient()

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return { success: false, error: 'Not authenticated' }
    }

    // Use admin client to bypass RLS (avoids infinite recursion in tasks_update
    // policy which checks task_assignees, which in turn checks back into tasks)
    const adminSupabase = await createAdminClient()

    // Fetch task for old status + creator
    const { data: existing } = await adminSupabase
      .from('tasks')
      .select('status, created_by, title')
      .eq('id', id)
      .single()

    const oldStatus = existing?.status ?? null

    const { error } = await adminSupabase
      .from('tasks')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id)

    if (error) {
      return { success: false, error: error.message }
    }

    // Activity log
    await logActivity(supabase, id, user.id, 'changed_status', oldStatus, status)

    // Notify creator if it's not the same person who changed the status
    if (existing && existing.created_by && existing.created_by !== user.id) {
      await createNotification(
        supabase,
        existing.created_by,
        'status_changed',
        'Task status updated',
        `"${existing.title}" was moved to ${status.replace(/_/g, ' ')}`,
        `/tasks/${id}`
      )
    }

    // Notify watchers
    const { data: watchers } = await supabase
      .from('task_watchers')
      .select('user_id')
      .eq('task_id', id)

    if (watchers && watchers.length > 0) {
      await Promise.all(
        watchers
          .filter((w) => w.user_id !== user.id)
          .map((w) =>
            createNotification(
              supabase,
              w.user_id,
              'status_changed',
              'Task status updated',
              `"${existing?.title ?? 'A task'}" was moved to ${status.replace(/_/g, ' ')}`,
              `/tasks/${id}`
            )
          )
      )
    }

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

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return { success: false, error: 'Not authenticated' }
    }

    const { error } = await supabase.from('tasks').delete().eq('id', id)

    if (error) {
      return { success: false, error: error.message }
    }

    revalidatePath('/tasks')

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

    // Fetch task title for activity log
    const { data: task } = await supabase
      .from('tasks')
      .select('title')
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

    revalidatePath('/tasks')
    revalidatePath(`/tasks/${data.task_id}`)
    revalidatePath('/time-tracking')

    return { success: true, entry: entry as TimeEntry }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return { success: false, error: message }
  }
}
