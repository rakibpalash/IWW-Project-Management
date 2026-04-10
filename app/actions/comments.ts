'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { notify, notifyMany, getTaskRecipients } from '@/lib/notifications'
import { Comment } from '@/types'

const PROFILE_SELECT =
  'id, full_name, email, avatar_url, role, is_temp_password, onboarding_completed, created_at, updated_at'

export async function addCommentAction(data: {
  taskId: string
  content: string
  isInternal: boolean
  parentCommentId?: string | null
  mentionedUserIds?: string[]
  parentCommentAuthorId?: string | null
}): Promise<{ success: boolean; comment?: Comment; error?: string }> {
  try {
    const supabase = await createClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) return { success: false, error: 'Not authenticated' }

    const admin = createAdminClient()

    const { data: comment, error } = await admin
      .from('comments')
      .insert({
        task_id: data.taskId,
        user_id: user.id,
        content: data.content.trim(),
        is_internal: data.isInternal,
        parent_comment_id: data.parentCommentId ?? null,
      })
      .select(`*, user:profiles(${PROFILE_SELECT})`)
      .single()

    if (error || !comment) {
      return { success: false, error: error?.message ?? 'Failed to add comment' }
    }

    // Fetch actor's name for notification messages
    const { data: actor } = await admin
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .single()
    const actorName = actor?.full_name ?? 'Someone'

    // 1. Mention notifications
    const mentionIds = (data.mentionedUserIds ?? []).filter((id) => id !== user.id)
    if (mentionIds.length > 0) {
      await notifyMany(
        mentionIds,
        'mention',
        'You were mentioned in a comment',
        `${actorName} mentioned you: "${data.content.trim().slice(0, 80)}"`,
        `/tasks/${data.taskId}`
      )
    }

    // 2. Reply notification to parent comment author
    if (data.parentCommentId && data.parentCommentAuthorId && data.parentCommentAuthorId !== user.id) {
      await notify({
        userId: data.parentCommentAuthorId,
        type: 'comment_reply',
        title: 'Someone replied to your comment',
        message: `${actorName} replied: "${data.content.trim().slice(0, 80)}"`,
        link: `/tasks/${data.taskId}`,
      })
    }

    // 3. comment_added — notify task creator + assignees + watchers for top-level comments
    if (!data.parentCommentId) {
      const { data: task } = await admin
        .from('tasks')
        .select('title, created_by')
        .eq('id', data.taskId)
        .single()

      const recipients = await getTaskRecipients(
        data.taskId,
        user.id,
        task?.created_by ? [task.created_by] : []
      )

      // Exclude already-mentioned users to avoid double notifications
      const commentRecipients = recipients.filter((id) => !mentionIds.includes(id))

      await notifyMany(
        commentRecipients,
        'comment_added',
        'New comment on task',
        `${actorName} commented on "${task?.title ?? 'a task'}": "${data.content.trim().slice(0, 80)}"`,
        `/tasks/${data.taskId}`
      )
    }

    revalidatePath(`/tasks/${data.taskId}`)
    return { success: true, comment: comment as Comment }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}
