'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Comment, Profile } from '@/types'
import { addCommentAction } from '@/app/actions/comments'
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
import type { RealtimeChannel } from '@supabase/supabase-js'

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
  const supabaseRef = useRef(createClient())
  const supabase = supabaseRef.current

  const [newComment, setNewComment] = useState('')
  const [isInternal, setIsInternal] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [mentionedUserIds, setMentionedUserIds] = useState<string[]>([])
  const inputRef = useRef<MentionInputHandle>(null)

  // ── Typing indicator ────────────────────────────────────────────────────────
  const [typingUsers, setTypingUsers] = useState<Map<string, string>>(new Map())
  const channelRef = useRef<RealtimeChannel | null>(null)
  const stopTypingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const userTypingTimeouts = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  useEffect(() => {
    const channel = supabase.channel(`typing:task:${taskId}`, {
      config: { broadcast: { self: false } },
    })

    channel
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        const { userId, name, isTyping } = payload as {
          userId: string
          name: string
          isTyping: boolean
        }
        if (userId === profile.id) return

        // Auto-clear a user's typing state after 4s in case stop event is missed
        const existing = userTypingTimeouts.current.get(userId)
        if (existing) clearTimeout(existing)

        if (isTyping) {
          setTypingUsers((prev) => new Map(prev).set(userId, name))
          const t = setTimeout(() => {
            setTypingUsers((prev) => {
              const next = new Map(prev)
              next.delete(userId)
              return next
            })
            userTypingTimeouts.current.delete(userId)
          }, 4000)
          userTypingTimeouts.current.set(userId, t)
        } else {
          setTypingUsers((prev) => {
            const next = new Map(prev)
            next.delete(userId)
            return next
          })
          userTypingTimeouts.current.delete(userId)
        }
      })
      .subscribe()

    channelRef.current = channel

    return () => {
      supabase.removeChannel(channel)
      if (stopTypingTimeout.current) clearTimeout(stopTypingTimeout.current)
      userTypingTimeouts.current.forEach((t) => clearTimeout(t))
    }
  }, [taskId, profile.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const broadcastTyping = useCallback(
    (isTyping: boolean) => {
      channelRef.current?.send({
        type: 'broadcast',
        event: 'typing',
        payload: { userId: profile.id, name: profile.full_name, isTyping },
      })
    },
    [profile.id, profile.full_name]
  )

  function handleCommentChange(value: string) {
    setNewComment(value)

    if (value.trim()) {
      broadcastTyping(true)
      if (stopTypingTimeout.current) clearTimeout(stopTypingTimeout.current)
      stopTypingTimeout.current = setTimeout(() => broadcastTyping(false), 2500)
    } else {
      if (stopTypingTimeout.current) clearTimeout(stopTypingTimeout.current)
      broadcastTyping(false)
    }
  }

  function TypingIndicator() {
    if (typingUsers.size === 0) return null
    const names = Array.from(typingUsers.values())
    const label =
      names.length === 1
        ? `${names[0]} is typing`
        : names.length === 2
        ? `${names[0]} and ${names[1]} are typing`
        : `${names[0]} and ${names.length - 1} others are typing`

    return (
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground h-4">
        <span className="flex items-end gap-0.5 pb-0.5">
          {[0, 150, 300].map((delay) => (
            <span
              key={delay}
              className="block w-1 h-1 rounded-full bg-muted-foreground animate-bounce"
              style={{ animationDelay: `${delay}ms` }}
            />
          ))}
        </span>
        <span>{label}…</span>
      </div>
    )
  }

  const isStaffOrAdmin =
    profile.role === 'super_admin' || profile.role === 'staff'

  async function handleSubmitComment(
    content: string,
    internal: boolean,
    parentCommentId?: string
  ) {
    if (!content.trim()) return

    // Clear typing indicator when submitting
    if (stopTypingTimeout.current) clearTimeout(stopTypingTimeout.current)
    broadcastTyping(false)

    setSubmitting(true)

    try {
      const parentComment = parentCommentId
        ? comments.find((c) => c.id === parentCommentId)
        : undefined

      const result = await addCommentAction({
        taskId,
        content,
        isInternal: internal,
        parentCommentId: parentCommentId ?? null,
        mentionedUserIds,
        parentCommentAuthorId: parentComment?.user_id ?? null,
      })

      if (!result.success || !result.comment) throw new Error(result.error ?? 'Failed')

      onCommentAdded(result.comment)
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
      <div className="space-y-2">
        <div className="flex items-start gap-3">
          <Avatar className="h-8 w-8 shrink-0 mt-0.5">
            <AvatarImage src={profile.avatar_url ?? undefined} />
            <AvatarFallback className="text-xs">{getInitials(profile.full_name)}</AvatarFallback>
          </Avatar>
          <div className="flex-1 space-y-2">
            <MentionInput
              ref={inputRef}
              value={newComment}
              onChange={handleCommentChange}
              members={members}
              placeholder="Your thoughts on this…"
              onMentionedUsers={setMentionedUserIds}
            />
            {newComment.trim() && (
              <Button size="sm" onClick={() => handleSubmitComment(newComment, isInternal)} disabled={submitting} className="h-7 text-xs">
                {submitting ? 'Posting…' : 'Post Comment'}
              </Button>
            )}
          </div>
        </div>
        <TypingIndicator />
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
              onChange={handleCommentChange}
              members={members}
              placeholder="Write a comment… Use @ to mention someone"
              rows={3}
              onMentionedUsers={setMentionedUserIds}
              disabled={submitting}
            />
            <TypingIndicator />
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

  const [showReplyForm, setShowReplyForm] = useState(false)
  const [replyContent, setReplyContent] = useState('')
  const [replyInternal, setReplyInternal] = useState(false)
  const [submittingReply, setSubmittingReply] = useState(false)
  const [replyMentions, setReplyMentions] = useState<string[]>([])

  const user = comment.user
  const isInternal = comment.is_internal

  // Highlight @mentions — greedy match, stops at punctuation/newline/@
  function renderContent(content: string) {
    const regex = /@([\w][\w ]*?)(?=[,.()\[\]{}<>!?;:'"@\n]|$)/g
    const result: React.ReactNode[] = []
    let lastIndex = 0
    let match

    while ((match = regex.exec(content)) !== null) {
      const name = match[1].trimEnd()
      const member = members.find(
        (m) => m.full_name.toLowerCase() === name.toLowerCase()
      )

      if (member) {
        // Push text before the mention
        if (match.index > lastIndex) {
          result.push(
            <span key={lastIndex}>{content.slice(lastIndex, match.index)}</span>
          )
        }
        result.push(
          <span
            key={match.index}
            className="text-primary font-semibold bg-primary/10 rounded px-0.5"
          >
            @{member.full_name}
          </span>
        )
        lastIndex = match.index + match[0].length
      }
    }

    // Push remaining text
    if (lastIndex < content.length) {
      result.push(<span key={lastIndex}>{content.slice(lastIndex)}</span>)
    }

    return result.length > 0 ? result : <>{content}</>
  }

  async function submitReply() {
    if (!replyContent.trim()) return
    setSubmittingReply(true)

    try {
      const result = await addCommentAction({
        taskId,
        content: replyContent,
        isInternal: replyInternal,
        parentCommentId: comment.id,
        mentionedUserIds: replyMentions,
        parentCommentAuthorId: comment.user_id,
      })

      if (!result.success || !result.comment) throw new Error(result.error ?? 'Failed')

      onReplyAdded(result.comment)
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
