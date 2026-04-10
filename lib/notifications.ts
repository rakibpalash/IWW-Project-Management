/**
 * Central notification helper.
 * All server actions should use `notify()` to send in-app notifications.
 * Always uses the admin client so RLS doesn't block cross-user inserts.
 */

import { createAdminClient } from '@/lib/supabase/server'

export type NotificationType =
  | 'task_assigned'
  | 'subtask_assigned'
  | 'mention'
  | 'comment_reply'
  | 'comment_added'
  | 'status_changed'
  | 'task_deleted'
  | 'time_logged'
  | 'project_member_added'
  | 'leave_approved'
  | 'leave_rejected'
  | 'due_date_approaching'
  | 'fine_imposed'

interface NotifyPayload {
  userId: string
  type: NotificationType
  title: string
  message: string
  link?: string
}

/** Send a single notification */
export async function notify(payload: NotifyPayload): Promise<void> {
  try {
    const admin = createAdminClient()
    await admin.from('notifications').insert({
      user_id: payload.userId,
      type: payload.type,
      title: payload.title,
      message: payload.message,
      link: payload.link ?? null,
      is_read: false,
    })
  } catch {
    // Never let notification failures break the main action
  }
}

/** Send the same notification to multiple users at once */
export async function notifyMany(
  userIds: string[],
  type: NotificationType,
  title: string,
  message: string,
  link?: string
): Promise<void> {
  if (userIds.length === 0) return
  try {
    const admin = createAdminClient()
    await admin.from('notifications').insert(
      userIds.map((userId) => ({
        user_id: userId,
        type,
        title,
        message,
        link: link ?? null,
        is_read: false,
      }))
    )
  } catch {
    // Never let notification failures break the main action
  }
}

/** Fetch all assignee IDs for a task (excluding a specific userId) */
export async function getTaskAssigneeIds(
  taskId: string,
  excludeUserId?: string
): Promise<string[]> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('task_assignees')
    .select('user_id')
    .eq('task_id', taskId)
  const ids = (data ?? []).map((a: { user_id: string }) => a.user_id)
  return excludeUserId ? ids.filter((id) => id !== excludeUserId) : ids
}

/** Fetch task watcher IDs (excluding a specific userId) */
export async function getTaskWatcherIds(
  taskId: string,
  excludeUserId?: string
): Promise<string[]> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('task_watchers')
    .select('user_id')
    .eq('task_id', taskId)
  const ids = (data ?? []).map((w: { user_id: string }) => w.user_id)
  return excludeUserId ? ids.filter((id) => id !== excludeUserId) : ids
}

/** Collect unique recipient IDs (assignees + watchers + creator), excluding actor */
export async function getTaskRecipients(
  taskId: string,
  actorId: string,
  extraIds?: string[]
): Promise<string[]> {
  const [assignees, watchers] = await Promise.all([
    getTaskAssigneeIds(taskId, actorId),
    getTaskWatcherIds(taskId, actorId),
  ])
  const all = new Set([...assignees, ...watchers, ...(extraIds ?? [])])
  all.delete(actorId)
  return Array.from(all)
}
