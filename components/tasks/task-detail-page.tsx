'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Task, Profile, Comment, TimeEntry, ActivityLog, TaskStatus, Priority } from '@/types'
import { SubtaskList } from './subtask-list'
import { CommentSection } from './comment-section'
import { TimeLogDialog } from '@/components/time-tracking/time-log-dialog'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useToast } from '@/components/ui/use-toast'
import {
  ArrowLeft,
  Calendar,
  Clock,
  Check,
  Circle,
  Play,
  Square,
  Bold,
  Code,
  List,
} from 'lucide-react'
import { TASK_STATUSES, PRIORITIES } from '@/lib/constants'
import {
  cn,
  formatDate,
  formatHours,
  getInitials,
  timeAgo,
  formatStatus,
} from '@/lib/utils'
import { format, parseISO } from 'date-fns'

interface TaskDetailPageProps {
  task: Task
  comments: Comment[]
  timeEntries: TimeEntry[]
  activityLogs: ActivityLog[]
  members: Profile[]
  profile: Profile
}

type FeedItem =
  | { type: 'activity'; id: string; date: string; data: ActivityLog }
  | { type: 'comment'; id: string; date: string; data: Comment }
  | { type: 'time'; id: string; date: string; data: TimeEntry }

// ── Status / priority style maps ─────────────────────────────────────────────
const STATUS_CLASSES: Record<string, string> = {
  todo: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  in_progress: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  in_review: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  done: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  cancelled: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
}

const PRIORITY_CLASSES: Record<Priority, string> = {
  urgent: 'border-red-200 bg-red-50 text-red-700',
  high: 'border-orange-200 bg-orange-50 text-orange-700',
  medium: 'border-yellow-200 bg-yellow-50 text-yellow-700',
  low: 'border-blue-200 bg-blue-50 text-blue-600',
}

const PRIORITY_ICON: Record<Priority, string> = {
  urgent: '!!',
  high: '▲',
  medium: '=',
  low: '▼',
}

// ── Sub-components ────────────────────────────────────────────────────────────
function ElapsedTimer({ startedAt }: { startedAt: string }) {
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    const base = new Date(startedAt).getTime()
    const tick = () => setElapsed(Math.floor((Date.now() - base) / 1000))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [startedAt])
  const h = Math.floor(elapsed / 3600).toString().padStart(2, '0')
  const m = Math.floor((elapsed % 3600) / 60).toString().padStart(2, '0')
  const s = (elapsed % 60).toString().padStart(2, '0')
  return <span>{h}:{m}:{s}</span>
}

function FeedRow({ item, isLast }: { item: FeedItem; isLast: boolean }) {
  const divider = !isLast && 'border-b border-border/40'

  if (item.type === 'activity') {
    const log = item.data
    return (
      <div className={cn('flex items-start gap-3 py-3', divider)}>
        <Avatar className="h-7 w-7 mt-0.5 shrink-0">
          <AvatarImage src={log.user?.avatar_url ?? undefined} />
          <AvatarFallback className="text-[10px]">
            {log.user ? getInitials(log.user.full_name) : '?'}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className="text-sm">
            <span className="font-medium">{log.user?.full_name ?? 'Unknown'}</span>{' '}
            <span className="text-muted-foreground">
              {formatActivityAction(log.action, log.old_value, log.new_value)}
            </span>
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">{timeAgo(log.created_at)}</p>
        </div>
      </div>
    )
  }

  if (item.type === 'comment') {
    const c = item.data
    return (
      <div className={cn('flex items-start gap-3 py-3', divider)}>
        <Avatar className="h-7 w-7 mt-0.5 shrink-0">
          <AvatarImage src={c.user?.avatar_url ?? undefined} />
          <AvatarFallback className="text-[10px]">
            {c.user ? getInitials(c.user.full_name) : '?'}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-sm font-medium">{c.user?.full_name ?? 'Unknown'}</span>
            {c.is_internal && (
              <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-medium">
                Internal
              </span>
            )}
            <span className="text-xs text-muted-foreground">{timeAgo(c.created_at)}</span>
          </div>
          <div className="text-sm text-foreground/90 whitespace-pre-wrap rounded-lg bg-muted/50 px-3 py-2.5">
            {c.content}
          </div>
        </div>
      </div>
    )
  }

  if (item.type === 'time') {
    const e = item.data
    const mins = e.duration_minutes ?? 0
    return (
      <div className={cn('flex items-start gap-3 py-3', divider)}>
        <div className="h-7 w-7 mt-0.5 shrink-0 rounded-full bg-muted flex items-center justify-center">
          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm">
            <span className="font-medium">Time logged</span>{' '}
            <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">
              {formatHours(mins / 60)}
            </span>
            {e.description && (
              <span className="text-muted-foreground"> — {e.description}</span>
            )}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">{timeAgo(e.created_at)}</p>
        </div>
      </div>
    )
  }

  return null
}

// ── Main component ────────────────────────────────────────────────────────────
export function TaskDetailPage({
  task: initialTask,
  comments: initialComments,
  timeEntries: initialTimeEntries,
  activityLogs: initialActivityLogs,
  members,
  profile,
}: TaskDetailPageProps) {
  const router = useRouter()
  const { toast } = useToast()
  const supabase = createClient()
  const descTextareaRef = useRef<HTMLTextAreaElement>(null)

  const [task, setTask] = useState<Task>(initialTask)
  const [comments, setComments] = useState<Comment[]>(initialComments)
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>(initialTimeEntries)
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>(initialActivityLogs)

  const [editingTitle, setEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState(task.title)
  const [editingDescription, setEditingDescription] = useState(false)
  const [descriptionDraft, setDescriptionDraft] = useState(task.description ?? '')
  const [savingTitle, setSavingTitle] = useState(false)
  const [savingDescription, setSavingDescription] = useState(false)

  const [showTimeLogDialog, setShowTimeLogDialog] = useState(false)
  const [timerRunning, setTimerRunning] = useState(false)
  const [runningEntry, setRunningEntry] = useState<TimeEntry | null>(null)
  const [timerLoading, setTimerLoading] = useState(false)

  const isAdmin = profile.role === 'super_admin'
  const isCreator = task.created_by === profile.id
  const isAssignee = (task.assignees ?? []).some((a) => a.id === profile.id)
  const canEdit = isAdmin || isCreator || isAssignee

  const totalLoggedMinutes = timeEntries
    .filter((e) => e.duration_minutes !== null && !e.is_running)
    .reduce((sum, e) => sum + (e.duration_minutes ?? 0), 0)

  const estimatedMinutes = (task.estimated_hours ?? 0) * 60
  const timeProgress =
    estimatedMinutes > 0 ? Math.min((totalLoggedMinutes / estimatedMinutes) * 100, 100) : 0

  useEffect(() => {
    const running = timeEntries.find((e) => e.is_running)
    if (running) {
      setRunningEntry(running)
      setTimerRunning(true)
    }
  }, [])

  const feedItems = useMemo<FeedItem[]>(() => {
    const items: FeedItem[] = [
      ...activityLogs.map((a) => ({
        type: 'activity' as const,
        id: a.id,
        date: a.created_at,
        data: a,
      })),
      ...comments.map((c) => ({
        type: 'comment' as const,
        id: c.id,
        date: c.created_at,
        data: c,
      })),
      ...timeEntries
        .filter((e) => !e.is_running)
        .map((e) => ({
          type: 'time' as const,
          id: e.id,
          date: e.created_at,
          data: e,
        })),
    ]
    return items.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    )
  }, [activityLogs, comments, timeEntries])

  // ── Handlers ────────────────────────────────────────────────────────────────
  async function logActivity(
    action: string,
    oldValue: string | null,
    newValue: string | null,
  ) {
    await supabase.from('activity_logs').insert({
      task_id: task.id,
      user_id: profile.id,
      action,
      old_value: oldValue,
      new_value: newValue,
    })
  }

  async function handleStatusChange(newStatus: string) {
    const old = task.status
    setTask((p) => ({ ...p, status: newStatus as TaskStatus }))
    const { error } = await supabase
      .from('tasks')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', task.id)
    if (error) {
      setTask((p) => ({ ...p, status: old }))
      toast({ title: 'Error updating status', variant: 'destructive' })
      return
    }
    const newLog: ActivityLog = {
      id: crypto.randomUUID(),
      task_id: task.id,
      user_id: profile.id,
      action: 'status_changed',
      old_value: old,
      new_value: newStatus,
      created_at: new Date().toISOString(),
      user: profile,
    }
    setActivityLogs((p) => [newLog, ...p])
    await logActivity('status_changed', old, newStatus)
  }

  async function handlePriorityChange(newPriority: string) {
    const old = task.priority
    setTask((p) => ({ ...p, priority: newPriority as Priority }))
    const { error } = await supabase
      .from('tasks')
      .update({ priority: newPriority, updated_at: new Date().toISOString() })
      .eq('id', task.id)
    if (error) {
      setTask((p) => ({ ...p, priority: old }))
      toast({ title: 'Error updating priority', variant: 'destructive' })
      return
    }
    await logActivity('priority_changed', old, newPriority)
  }

  async function saveTitle() {
    if (!titleDraft.trim()) return
    setSavingTitle(true)
    const { error } = await supabase
      .from('tasks')
      .update({ title: titleDraft.trim(), updated_at: new Date().toISOString() })
      .eq('id', task.id)
    setSavingTitle(false)
    if (error) {
      toast({ title: 'Error saving title', variant: 'destructive' })
      return
    }
    setTask((p) => ({ ...p, title: titleDraft.trim() }))
    setEditingTitle(false)
  }

  async function saveDescription() {
    setSavingDescription(true)
    const old = task.description
    const { error } = await supabase
      .from('tasks')
      .update({ description: descriptionDraft, updated_at: new Date().toISOString() })
      .eq('id', task.id)
    setSavingDescription(false)
    if (error) {
      toast({ title: 'Error saving description', variant: 'destructive' })
      return
    }
    setTask((p) => ({ ...p, description: descriptionDraft }))
    setEditingDescription(false)
    await logActivity('description_updated', old, descriptionDraft)
  }

  async function startTimer() {
    setTimerLoading(true)
    const { data, error } = await supabase
      .from('time_entries')
      .insert({
        task_id: task.id,
        user_id: profile.id,
        started_at: new Date().toISOString(),
        is_running: true,
        duration_minutes: 0,
      })
      .select('*')
      .single()
    setTimerLoading(false)
    if (error || !data) {
      toast({ title: 'Failed to start timer', variant: 'destructive' })
      return
    }
    setRunningEntry(data as TimeEntry)
    setTimerRunning(true)
    setTimeEntries((p) => [data as TimeEntry, ...p])
  }

  async function stopTimer() {
    if (!runningEntry) return
    setTimerLoading(true)
    const duration = Math.round(
      (Date.now() - new Date(runningEntry.started_at).getTime()) / 60000,
    )
    const { data, error } = await supabase
      .from('time_entries')
      .update({
        is_running: false,
        duration_minutes: duration,
        updated_at: new Date().toISOString(),
      })
      .eq('id', runningEntry.id)
      .select('*')
      .single()
    setTimerLoading(false)
    if (error || !data) {
      toast({ title: 'Failed to stop timer', variant: 'destructive' })
      return
    }
    setRunningEntry(null)
    setTimerRunning(false)
    setTimeEntries((p) =>
      p.map((e) => (e.id === runningEntry.id ? (data as TimeEntry) : e)),
    )
  }

  function applyFormat(fmt: 'bold' | 'code' | 'bullet') {
    const ta = descTextareaRef.current
    if (!ta) return
    const start = ta.selectionStart
    const end = ta.selectionEnd
    const sel = descriptionDraft.slice(start, end)
    let replacement: string
    let offset: number
    if (fmt === 'bold') {
      replacement = `**${sel}**`
      offset = 2
    } else if (fmt === 'code') {
      replacement = `\`${sel}\``
      offset = 1
    } else {
      replacement = `- ${sel}`
      offset = 2
    }
    const newVal =
      descriptionDraft.slice(0, start) + replacement + descriptionDraft.slice(end)
    setDescriptionDraft(newVal)
    requestAnimationFrame(() => {
      ta.focus()
      ta.setSelectionRange(start + offset, start + offset + sel.length)
    })
  }

  function handleSubtaskCreated(subtask: Task) {
    setTask((p) => ({ ...p, subtasks: [...(p.subtasks ?? []), subtask] }))
  }
  function handleSubtaskUpdated(updated: Task) {
    setTask((p) => ({
      ...p,
      subtasks: (p.subtasks ?? []).map((s) => (s.id === updated.id ? updated : s)),
    }))
  }
  function handleCommentAdded(comment: Comment) {
    setComments((p) => [...p, comment])
  }
  function handleTimeEntryAdded(entry: TimeEntry) {
    setTimeEntries((p) => [entry, ...p])
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <TooltipProvider>
      <div className="min-h-screen bg-background">

        {/* ── Top nav ── */}
        <div className="sticky top-0 z-20 flex items-center gap-2 border-b bg-background/95 backdrop-blur-sm px-4 h-[49px]">
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-muted-foreground hover:text-foreground h-8 px-2 shrink-0"
            onClick={() => router.push(`/projects/${task.project_id}`)}
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>

          <Separator orientation="vertical" className="h-5" />

          {task.project && (
            <button
              className="text-xs text-muted-foreground hover:text-foreground transition-colors truncate max-w-[140px]"
              onClick={() => router.push(`/projects/${task.project_id}`)}
            >
              {task.project.name}
            </button>
          )}

          <span className="text-muted-foreground/40 shrink-0">/</span>
          <span className="text-xs text-foreground font-medium truncate max-w-[220px]">
            {task.title}
          </span>
        </div>

        {/* ── Body ── */}
        <div className="flex h-[calc(100vh-49px)]">

          {/* ── Left panel ── */}
          <div className="flex-1 overflow-y-auto">
            <div className="max-w-2xl mx-auto px-8 py-8 space-y-8">

              {/* Header: meta chips + title ─────────────────── */}
              <div className="space-y-3">

                {/* Meta row */}
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Status */}
                  {canEdit ? (
                    <Select value={task.status} onValueChange={handleStatusChange}>
                      <SelectTrigger
                        className={cn(
                          'h-6 gap-1 border-0 px-2.5 text-xs font-semibold rounded-full w-auto shadow-none focus:ring-0',
                          STATUS_CLASSES[task.status] ?? 'bg-muted text-muted-foreground',
                        )}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TASK_STATUSES.map((s) => (
                          <SelectItem key={s.value} value={s.value}>
                            {s.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <span
                      className={cn(
                        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold',
                        STATUS_CLASSES[task.status],
                      )}
                    >
                      {formatStatus(task.status)}
                    </span>
                  )}

                  {/* Priority chip */}
                  <span
                    className={cn(
                      'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium border',
                      PRIORITY_CLASSES[task.priority],
                    )}
                  >
                    <span className="font-bold text-[11px] leading-none">
                      {PRIORITY_ICON[task.priority]}
                    </span>
                    {formatStatus(task.priority)}
                  </span>

                  {/* Assignee avatars */}
                  {(task.assignees ?? []).length > 0 && (
                    <div className="flex items-center -space-x-1.5 ml-0.5">
                      {(task.assignees ?? []).slice(0, 5).map((a) => (
                        <Tooltip key={a.id}>
                          <TooltipTrigger asChild>
                            <Avatar className="h-6 w-6 border-2 border-background cursor-default">
                              <AvatarImage src={a.avatar_url ?? undefined} />
                              <AvatarFallback className="text-[10px]">
                                {getInitials(a.full_name)}
                              </AvatarFallback>
                            </Avatar>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{a.full_name}</p>
                          </TooltipContent>
                        </Tooltip>
                      ))}
                      {(task.assignees ?? []).length > 5 && (
                        <span className="text-xs text-muted-foreground ml-2">
                          +{(task.assignees ?? []).length - 5}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Title */}
                {editingTitle ? (
                  <div className="space-y-2">
                    <Textarea
                      value={titleDraft}
                      onChange={(e) => setTitleDraft(e.target.value)}
                      className="text-2xl font-bold resize-none border-0 border-b rounded-none px-0 py-1 focus-visible:ring-0 focus-visible:border-primary leading-snug"
                      rows={2}
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault()
                          saveTitle()
                        }
                        if (e.key === 'Escape') {
                          setEditingTitle(false)
                          setTitleDraft(task.title)
                        }
                      }}
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={saveTitle}
                        disabled={savingTitle}
                        className="h-7 gap-1.5"
                      >
                        <Check className="h-3 w-3" />
                        {savingTitle ? 'Saving…' : 'Save'}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7"
                        onClick={() => {
                          setEditingTitle(false)
                          setTitleDraft(task.title)
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <h1
                    className={cn(
                      'text-2xl font-bold leading-snug break-words',
                      canEdit &&
                        'cursor-text hover:bg-muted/50 -mx-2 px-2 py-1 rounded-md transition-colors',
                    )}
                    onClick={() => canEdit && setEditingTitle(true)}
                  >
                    {task.title}
                  </h1>
                )}
              </div>

              {/* Description ─────────────────────────────────── */}
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">
                  Description
                </p>
                {editingDescription ? (
                  <div className="rounded-lg border bg-background overflow-hidden">
                    {/* Toolbar */}
                    <div className="flex items-center gap-0.5 px-2 py-1.5 border-b bg-muted/30">
                      {(
                        [
                          { icon: <Bold className="h-3.5 w-3.5" />, title: 'Bold', fmt: 'bold' },
                          { icon: <Code className="h-3.5 w-3.5" />, title: 'Code', fmt: 'code' },
                          { icon: <List className="h-3.5 w-3.5" />, title: 'Bullet list', fmt: 'bullet' },
                        ] as const
                      ).map(({ icon, title, fmt }) => (
                        <button
                          key={fmt}
                          type="button"
                          title={title}
                          onMouseDown={(e) => {
                            e.preventDefault()
                            applyFormat(fmt)
                          }}
                          className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                        >
                          {icon}
                        </button>
                      ))}
                    </div>
                    <Textarea
                      ref={descTextareaRef}
                      value={descriptionDraft}
                      onChange={(e) => setDescriptionDraft(e.target.value)}
                      placeholder="Add a description…"
                      rows={6}
                      className="border-0 rounded-none resize-none text-sm focus-visible:ring-0 px-3 py-2.5"
                      autoFocus
                    />
                    <div className="flex gap-2 px-3 py-2 border-t bg-muted/20">
                      <Button
                        size="sm"
                        onClick={saveDescription}
                        disabled={savingDescription}
                        className="h-7 gap-1.5"
                      >
                        <Check className="h-3 w-3" />
                        {savingDescription ? 'Saving…' : 'Save'}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7"
                        onClick={() => setEditingDescription(false)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div
                    className={cn(
                      'text-sm leading-relaxed rounded-md px-3 py-2.5 -mx-3 transition-colors',
                      canEdit && 'cursor-text hover:bg-muted/50',
                      !task.description && 'text-muted-foreground italic',
                    )}
                    onClick={() => canEdit && setEditingDescription(true)}
                  >
                    {task.description ? (
                      <div className="whitespace-pre-wrap">{task.description}</div>
                    ) : canEdit ? (
                      'Click to add a description…'
                    ) : (
                      'No description provided.'
                    )}
                  </div>
                )}
              </div>

              {/* Subtasks ────────────────────────────────────── */}
              <div className="rounded-xl border bg-card/50 p-4">
                <SubtaskList
                  parentTask={task}
                  subtasks={task.subtasks ?? []}
                  members={members}
                  profile={profile}
                  onSubtaskCreated={handleSubtaskCreated}
                  onSubtaskUpdated={handleSubtaskUpdated}
                />
              </div>

              {/* Activity feed ───────────────────────────────── */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">Activity</h3>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs gap-1.5"
                    onClick={() => setShowTimeLogDialog(true)}
                  >
                    <Clock className="h-3.5 w-3.5" />
                    Log Time
                  </Button>
                </div>

                {/* Comment input */}
                <CommentSection
                  taskId={task.id}
                  comments={[]}
                  members={members}
                  profile={profile}
                  onCommentAdded={handleCommentAdded}
                  inputOnly
                />

                {/* Unified timeline */}
                {feedItems.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No activity yet.</p>
                ) : (
                  <div>
                    {feedItems.map((item, i) => (
                      <FeedRow
                        key={`${item.type}-${item.id}`}
                        item={item}
                        isLast={i === feedItems.length - 1}
                      />
                    ))}
                  </div>
                )}
              </div>

            </div>
          </div>

          {/* ── Right sidebar ── */}
          <div className="w-72 shrink-0 border-l">
            <div className="sticky top-[49px] h-[calc(100vh-49px)] overflow-y-auto bg-card/30 p-5 space-y-6">

              {/* Timer ───────────────────────────────────────── */}
              <div className="rounded-xl border bg-card p-4 space-y-3">
                <div className="flex items-center gap-2.5">
                  {timerRunning && runningEntry ? (
                    <span className="relative flex h-2.5 w-2.5 shrink-0">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
                    </span>
                  ) : (
                    <Circle className="h-2.5 w-2.5 text-muted-foreground shrink-0" />
                  )}
                  <span className="text-3xl font-mono font-bold tabular-nums tracking-tight">
                    {timerRunning && runningEntry ? (
                      <ElapsedTimer startedAt={runningEntry.started_at} />
                    ) : (
                      '00:00:00'
                    )}
                  </span>
                </div>
                <button
                  onClick={timerRunning ? stopTimer : startTimer}
                  disabled={timerLoading}
                  className={cn(
                    'flex items-center justify-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg transition-colors w-full',
                    timerRunning
                      ? 'bg-red-50 text-red-600 hover:bg-red-100 border border-red-200'
                      : 'bg-primary text-primary-foreground hover:bg-primary/90',
                    timerLoading && 'opacity-50 cursor-not-allowed',
                  )}
                >
                  {timerRunning ? (
                    <>
                      <Square className="h-3.5 w-3.5 fill-current" />
                      Stop Timer
                    </>
                  ) : (
                    <>
                      <Play className="h-3.5 w-3.5 fill-current" />
                      Start Timer
                    </>
                  )}
                </button>
              </div>

              {/* Time summary ────────────────────────────────── */}
              <div className="space-y-2">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Time
                </p>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Logged</span>
                  <span className="text-sm font-semibold tabular-nums">
                    {formatHours(totalLoggedMinutes / 60)}
                  </span>
                </div>
                {task.estimated_hours ? (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Estimated</span>
                      <span className="text-sm font-medium text-muted-foreground tabular-nums">
                        {task.estimated_hours}h
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className={cn(
                          'h-full rounded-full transition-all duration-300',
                          timeProgress >= 100 ? 'bg-destructive' : 'bg-primary',
                        )}
                        style={{ width: `${timeProgress}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-muted-foreground text-right">
                      {Math.round(timeProgress)}% of estimate
                    </p>
                  </>
                ) : null}
              </div>

              <Separator />

              {/* Status ──────────────────────────────────────── */}
              <div className="space-y-1.5">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Status
                </p>
                {canEdit ? (
                  <Select value={task.status} onValueChange={handleStatusChange}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TASK_STATUSES.map((s) => (
                        <SelectItem key={s.value} value={s.value}>
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <span
                    className={cn(
                      'inline-flex items-center rounded-md px-2 py-1 text-xs font-medium',
                      STATUS_CLASSES[task.status],
                    )}
                  >
                    {formatStatus(task.status)}
                  </span>
                )}
              </div>

              {/* Priority ────────────────────────────────────── */}
              <div className="space-y-1.5">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Priority
                </p>
                {canEdit ? (
                  <Select value={task.priority} onValueChange={handlePriorityChange}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PRIORITIES.map((p) => (
                        <SelectItem key={p.value} value={p.value}>
                          {p.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <span className="text-sm font-medium">{formatStatus(task.priority)}</span>
                )}
              </div>

              {/* Assignees ───────────────────────────────────── */}
              <div className="space-y-2">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Assignees
                </p>
                {(task.assignees ?? []).length === 0 ? (
                  <p className="text-xs text-muted-foreground">Unassigned</p>
                ) : (
                  <div className="space-y-2">
                    {(task.assignees ?? []).map((a) => (
                      <div key={a.id} className="flex items-center gap-2">
                        <Avatar className="h-7 w-7 shrink-0">
                          <AvatarImage src={a.avatar_url ?? undefined} />
                          <AvatarFallback className="text-xs">
                            {getInitials(a.full_name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="text-xs font-medium truncate">{a.full_name}</p>
                          <p className="text-[10px] text-muted-foreground truncate">{a.email}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <Separator />

              {/* Dates ───────────────────────────────────────── */}
              <div className="space-y-3">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Dates
                </p>
                <div className="flex items-center gap-2.5">
                  <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-[10px] text-muted-foreground">Start</p>
                    <p className="text-xs font-medium">
                      {task.start_date ? formatDate(task.start_date) : '—'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2.5">
                  <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-[10px] text-muted-foreground">Due</p>
                    <p
                      className={cn(
                        'text-xs font-medium',
                        !task.due_date && 'text-muted-foreground',
                      )}
                    >
                      {task.due_date ? formatDate(task.due_date) : '—'}
                    </p>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Details ─────────────────────────────────────── */}
              <div className="space-y-2.5">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Details
                </p>
                {task.project && (
                  <div>
                    <p className="text-[10px] text-muted-foreground">Project</p>
                    <p className="text-xs font-medium truncate">{task.project.name}</p>
                  </div>
                )}
                <div>
                  <p className="text-[10px] text-muted-foreground">Created</p>
                  <p className="text-xs text-muted-foreground">
                    {task.created_at
                      ? format(parseISO(task.created_at), 'dd MMM yyyy')
                      : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground">Task ID</p>
                  <p className="text-xs text-muted-foreground font-mono">{task.id.slice(0, 8)}</p>
                </div>
              </div>

            </div>
          </div>

        </div>

        {/* Time log dialog */}
        {showTimeLogDialog && (
          <TimeLogDialog
            open={showTimeLogDialog}
            onOpenChange={setShowTimeLogDialog}
            taskId={task.id}
            profile={profile}
            onCreated={handleTimeEntryAdded}
          />
        )}
      </div>
    </TooltipProvider>
  )
}

function formatActivityAction(
  action: string,
  oldValue: string | null,
  newValue: string | null,
): string {
  switch (action) {
    case 'status_changed':
      return `changed status from "${formatStatus(oldValue ?? '')}" to "${formatStatus(newValue ?? '')}"`
    case 'priority_changed':
      return `changed priority from "${formatStatus(oldValue ?? '')}" to "${formatStatus(newValue ?? '')}"`
    case 'description_updated':
      return 'updated the description'
    case 'task_created':
      return 'created this task'
    case 'assignee_added':
      return `added ${newValue} as an assignee`
    case 'assignee_removed':
      return `removed ${oldValue} from assignees`
    case 'subtask_created':
      return `created subtask "${newValue}"`
    default:
      return action.replace(/_/g, ' ')
  }
}
