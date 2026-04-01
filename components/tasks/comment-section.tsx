'use client'

import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Comment, Profile } from '@/types'
import { MentionInput, MentionInputHandle } from './mention-input'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { useToast } from '@/components/ui/use-toast'
import { Lock, MessageSquare, Reply, CornerDownRight } from 'lucide-react'
import { cn, getInitials, timeAgo } from '@/lib/utils'

interface CommentSectionProps {
  taskId: string
  comments: Comment[]
  members: Profile[]
  profile: Profile
  onCommentAdded: (comment: Comment) => void
  inputOnly?: boolean
}

export function CommentSection({
  taskId,
  comments,
  members,
  profile,
  onCommentAdded,
  inputOnly = false,
}: CommentSectionProps) {
  const { toast } = useToast()
  const supabase = createClient()

  const [newComment, setNewComment] = useState('')
  const [isInternal, setIsInternal] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [mentionedUserIds, setMentionedUserIds] = useState<string[]>([])
  const inputRef = useRef<MentionInputHandle>(null)

  const isStaffOrAdmin =
    profile.role === 'super_admin' || profile.role === 'staff'

  async function handleSubmitComment(
    content: string,
    internal: boolean,
    parentCommentId?: string
  ) {
    if (!content.trim()) return

    setSubmitting(true)

    try {
      const { data: comment, error } = await supabase
        .from('comments')
        .insert({
          task_id: taskId,
          user_id: profile.id,
          content: content.trim(),
          is_internal: internal,
          parent_comment_id: parentCommentId ?? null,
        })
        .select('*, user:profiles(id, full_name, email, avatar_url, role, is_temp_password, onboarding_completed, created_at, updated_at)')
        .single()

      if (error) throw error

      // Send mention notifications
      const usersToNotify = mentionedUserIds.filter((id) => id !== profile.id)
      if (usersToNotify.length > 0) {
        await supabase.from('notifications').insert(
          usersToNotify.map((userId) => ({
            user_id: userId,
            type: 'mention',
            title: 'You were mentioned in a comment',
            message: `${profile.full_name} mentioned you: "${content.trim().slice(0, 80)}"`,
            link: `/projects/${(comment as any).task?.project_id ?? ''}/tasks/${taskId}`,
            is_read: false,
          }))
        )
      }

      // Reply notification
      if (parentCommentId) {
        const parentComment = comments.find((c) => c.id === parentCommentId)
        if (parentComment && parentComment.user_id !== profile.id) {
          await supabase.from('notifications').insert({
            user_id: parentComment.user_id,
            type: 'comment_reply',
            title: 'Someone replied to your comment',
            message: `${profile.full_name} replied: "${content.trim().slice(0, 80)}"`,
            link: `/projects/tasks/${taskId}`,
            is_read: false,
          })
        }
      }

      onCommentAdded(comment as Comment)
      setNewComment('')
      setMentionedUserIds([])
      toast({ title: 'Comment added' })
    } catch (err) {
      console.error(err)
      toast({ title: 'Failed to add comment', variant: 'destructive' })
    } finally {
      setSubmitting(false)
    }
  }

  function renderComment(comment: Comment, isReply = false) {
    return (
      <CommentItem
        key={comment.id}
        comment={comment}
        members={members}
        profile={profile}
        isStaffOrAdmin={isStaffOrAdmin}
        isReply={isReply}
        onReplyAdded={onCommentAdded}
        taskId={taskId}
      />
    )
  }

  // Filter internal comments for non-staff users
  const visibleComments = comments.filter(
    (c) => !c.is_internal || isStaffOrAdmin
  )

  if (inputOnly) {
    return (
      <div className="space-y-3">
        <div className="flex items-start gap-3">
          <Avatar className="h-8 w-8 shrink-0 mt-0.5">
            <AvatarImage src={profile.avatar_url ?? undefined} />
            <AvatarFallback className="text-xs">{getInitials(profile.full_name)}</AvatarFallback>
          </Avatar>
          <div className="flex-1 space-y-2">
            <MentionInput
              ref={inputRef}
              value={newComment}
              onChange={setNewComment}
              members={members}
              placeholder="Your thoughts on this…"
              onMentionSelect={(id) => setMentionedUserIds((p) => [...new Set([...p, id])])}
            />
            {newComment.trim() && (
              <Button size="sm" onClick={handleSubmit} disabled={submitting} className="h-7 text-xs">
                {submitting ? 'Posting…' : 'Post Comment'}
              </Button>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-semibold">
        Comments
        {visibleComments.length > 0 && (
          <span className="ml-2 text-muted-foreground font-normal">
            ({visibleComments.length})
          </span>
        )}
      </h2>

      {/* Comment list */}
      <div className="space-y-4">
        {visibleComments.length === 0 ? (
          <div className="text-center py-8">
            <MessageSquare className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              No comments yet. Start the conversation!
            </p>
          </div>
        ) : (
          visibleComments.map((comment) => (
            <div key={comment.id}>
              {renderComment(comment)}
              {/* Replies */}
              {(comment.replies ?? [])
                .filter((r) => !r.is_internal || isStaffOrAdmin)
                .map((reply) => (
                  <div key={reply.id} className="ml-8 mt-2">
                    <div className="flex items-start gap-1 text-muted-foreground mb-1">
                      <CornerDownRight className="h-3.5 w-3.5 mt-0.5" />
                    </div>
                    {renderComment(reply, true)}
                  </div>
                ))}
            </div>
          ))
        )}
      </div>

      <Separator />

      {/* New comment form */}
      <div className="space-y-3">
        <div className="flex items-start gap-3">
          <Avatar className="h-8 w-8 shrink-0 mt-0.5">
            <AvatarImage src={profile.avatar_url ?? undefined} />
            <AvatarFallback className="text-xs">
              {getInitials(profile.full_name)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 space-y-2">
            <MentionInput
              ref={inputRef}
              value={newComment}
              onChange={setNewComment}
              members={members}
              placeholder="Write a comment… Use @ to mention someone"
              rows={3}
              onMentionedUsers={setMentionedUserIds}
              disabled={submitting}
            />
            <div className="flex items-center justify-between">
              {isStaffOrAdmin && (
                <div className="flex items-center gap-2">
                  <Switch
                    id="internal-toggle"
                    checked={isInternal}
                    onCheckedChange={setIsInternal}
                    disabled={submitting}
                  />
                  <Label
                    htmlFor="internal-toggle"
                    className="text-xs cursor-pointer flex items-center gap-1"
                  >
                    <Lock className="h-3 w-3" />
                    Internal only
                  </Label>
                </div>
              )}
              <div className="ml-auto">
                <Button
                  size="sm"
                  onClick={() => handleSubmitComment(newComment, isInternal)}
                  disabled={!newComment.trim() || submitting}
                >
                  {submitting ? 'Posting…' : 'Post Comment'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// Individual comment item
interface CommentItemProps {
  comment: Comment
  members: Profile[]
  profile: Profile
  isStaffOrAdmin: boolean
  isReply: boolean
  taskId: string
  onReplyAdded: (comment: Comment) => void
}

function CommentItem({
  comment,
  members,
  profile,
  isStaffOrAdmin,
  isReply,
  taskId,
  onReplyAdded,
}: CommentItemProps) {
  const { toast } = useToast()
  const supabase = createClient()

  const [showReplyForm, setShowReplyForm] = useState(false)
  const [replyContent, setReplyContent] = useState('')
  const [replyInternal, setReplyInternal] = useState(false)
  const [submittingReply, setSubmittingReply] = useState(false)
  const [replyMentions, setReplyMentions] = useState<string[]>([])

  const user = comment.user
  const isInternal = comment.is_internal

  // Highlight @mentions
  function renderContent(content: string) {
    const parts = content.split(/(@[\w][\w\s]*?)(?=\s|$|[^a-zA-Z\s])/g)
    return parts.map((part, i) => {
      if (part.startsWith('@')) {
        const name = part.slice(1).trim()
        const member = members.find(
          (m) => m.full_name.toLowerCase() === name.toLowerCase()
        )
        if (member) {
          return (
            <span key={i} className="text-primary font-medium">
              {part}
            </span>
          )
        }
      }
      return <span key={i}>{part}</span>
    })
  }

  async function submitReply() {
    if (!replyContent.trim()) return
    setSubmittingReply(true)

    try {
      const { data: reply, error } = await supabase
        .from('comments')
        .insert({
          task_id: taskId,
          user_id: profile.id,
          content: replyContent.trim(),
          is_internal: replyInternal,
          parent_comment_id: comment.id,
        })
        .select('*, user:profiles(id, full_name, email, avatar_url, role, is_temp_password, onboarding_completed, created_at, updated_at)')
        .single()

      if (error) throw error

      // Notify mentioned users
      const usersToNotify = replyMentions.filter((id) => id !== profile.id)
      if (usersToNotify.length > 0) {
        await supabase.from('notifications').insert(
          usersToNotify.map((userId) => ({
            user_id: userId,
            type: 'mention',
            title: 'You were mentioned in a comment',
            message: `${profile.full_name} mentioned you: "${replyContent.trim().slice(0, 80)}"`,
            link: `/projects/tasks/${taskId}`,
            is_read: false,
          }))
        )
      }

      // Notify parent comment author
      if (comment.user_id !== profile.id) {
        await supabase.from('notifications').insert({
          user_id: comment.user_id,
          type: 'comment_reply',
          title: 'Someone replied to your comment',
          message: `${profile.full_name} replied: "${replyContent.trim().slice(0, 80)}"`,
          link: `/projects/tasks/${taskId}`,
          is_read: false,
        })
      }

      onReplyAdded(reply as Comment)
      setReplyContent('')
      setShowReplyForm(false)
      toast({ title: 'Reply posted' })
    } catch {
      toast({ title: 'Failed to post reply', variant: 'destructive' })
    } finally {
      setSubmittingReply(false)
    }
  }

  return (
    <div
      className={cn(
        'flex items-start gap-3',
        isInternal && 'rounded-lg bg-amber-50 border border-amber-200 p-3'
      )}
    >
      <Avatar className="h-8 w-8 shrink-0 mt-0.5">
        <AvatarImage src={user?.avatar_url ?? undefined} />
        <AvatarFallback className="text-xs">
          {user ? getInitials(user.full_name) : '?'}
        </AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium">{user?.full_name ?? 'Unknown'}</span>
          <span className="text-xs text-muted-foreground">{timeAgo(comment.created_at)}</span>
          {isInternal && (
            <Badge variant="outline" className="h-5 gap-1 text-xs text-amber-700 border-amber-300">
              <Lock className="h-3 w-3" />
              Internal
            </Badge>
          )}
        </div>

        <div className="mt-1 text-sm leading-relaxed whitespace-pre-wrap">
          {renderContent(comment.content)}
        </div>

        {/* Reply button (only on top-level comments) */}
        {!isReply && (
          <Button
            variant="ghost"
            size="sm"
            className="mt-1 h-6 gap-1.5 text-xs text-muted-foreground hover:text-foreground px-1"
            onClick={() => setShowReplyForm((v) => !v)}
          >
            <Reply className="h-3.5 w-3.5" />
            Reply
          </Button>
        )}

        {/* Reply form */}
        {showReplyForm && (
          <div className="mt-3 space-y-2 pl-1">
            <MentionInput
              value={replyContent}
              onChange={setReplyContent}
              members={members}
              placeholder="Write a reply…"
              rows={2}
              onMentionedUsers={setReplyMentions}
              disabled={submittingReply}
            />
            <div className="flex items-center gap-2">
              {isStaffOrAdmin && (
                <div className="flex items-center gap-1.5">
                  <Switch
                    id={`internal-reply-${comment.id}`}
                    checked={replyInternal}
                    onCheckedChange={setReplyInternal}
                    disabled={submittingReply}
                  />
                  <Label
                    htmlFor={`internal-reply-${comment.id}`}
                    className="text-xs cursor-pointer flex items-center gap-1"
                  >
                    <Lock className="h-3 w-3" />
                    Internal
                  </Label>
                </div>
              )}
              <div className="ml-auto flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => {
                    setShowReplyForm(false)
                    setReplyContent('')
                  }}
                  disabled={submittingReply}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  className="h-7 text-xs"
                  onClick={submitReply}
                  disabled={!replyContent.trim() || submittingReply}
                >
                  {submittingReply ? 'Posting…' : 'Reply'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
