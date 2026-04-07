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
  Trash2,
  AlertTriangle,
  Copy,
  UserPlus,
  X,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Checkbox } from '@/components/ui/checkbox'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { updateTaskAction, updateTaskStatusAction, deleteTaskAction, cloneTaskAction } from '@/app/actions/tasks'
import { startTimerAction, stopTimerAction } from '@/app/actions/time-entries'
import { useTaskConfig } from '@/hooks/use-task-config'
import {
  cn,
  formatDate,
  formatHours,
  getInitials,
  timeAgo,
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

// ── Sub-components ────────────────────────────────────────────────────────────
function ElapsedTimer({ startedAt, clientBase }: { startedAt: string; clientBase?: number }) {
  // Use the earlier of server timestamp vs client-recorded start to avoid clock-drift freeze
  const base = Math.min(new Date(startedAt).getTime(), clientBase ?? Infinity)
  const [elapsed, setElapsed] = useState(() => Math.max(0, Math.floor((Date.now() - base) / 1000)))
  useEffect(() => {
    const tick = () => setElapsed(Math.max(0, Math.floor((Date.now() - base) / 1000)))
    const msUntilNextSecond = 1000 - ((Date.now() - base) % 1000)
    let intervalId: ReturnType<typeof setInterval>
    const timeoutId = setTimeout(() => {
      tick()
      intervalId = setInterval(tick, 1000)
    }, msUntilNextSecond)
    return () => { clearTimeout(timeoutId); clearInterval(intervalId) }
  }, [base])
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
  // Stable client reference — createBrowserClient returns a singleton but we
  // keep it in a ref so it never appears in useEffect dependency arrays.
  const supabaseRef = useRef(createClient())
  const supabase = supabaseRef.current
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
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [deletingTask, setDeletingTask] = useState(false)
  const [taskDeleted, setTaskDeleted] = useState(false)
  const [isCloning, setIsCloning] = useState(false)
  const [showAssignDialog, setShowAssignDialog] = useState(false)
  const [assignSearch, setAssignSearch] = useState('')
  const [pendingAssigneeIds, setPendingAssigneeIds] = useState<string[]>([])
  const [savingAssignees, setSavingAssignees] = useState(false)
  const [timerRunning, setTimerRunning] = useState(false)
  const [runningEntry, setRunningEntry] = useState<TimeEntry | null>(null)
  const [timerClientBase, setTimerClientBase] = useState<number | undefined>(undefined)
  const [timerLoading, setTimerLoading] = useState(false)

  const isAdmin = profile.role === 'super_admin'
  const isCreator = task.created_by === profile.id
  const isAssignee = (task.assignees ?? []).some((a) => a.id === profile.id)
  const canEdit = isAdmin || isCreator || isAssignee
  const canTrackTime = profile.role !== 'client'

  const { statuses, priorities, getStatus, getPriority } = useTaskConfig()
  const statusCfg = getStatus(task.status)
  const priorityCfg = getPriority(task.priority)

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

  // ── Live realtime updates ─────────────────────────────────────────────────────
  useEffect(() => {
    const channel = supabase
      .channel(`task-live:${task.id}`)

      // Task field changes (status, priority, title, description, etc.)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'tasks', filter: `id=eq.${task.id}` },
        (payload) => {
          setTask((prev) => ({ ...prev, ...payload.new }))
          // Keep draft in sync if not currently editing
          setTitleDraft((prev) =>
            prev === task.title ? (payload.new as { title: string }).title : prev
          )
        }
      )

      // Task deleted by someone else while this page is open
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'tasks', filter: `id=eq.${task.id}` },
        () => {
          setTaskDeleted(true)
          // Auto-redirect after 4 seconds
          setTimeout(() => {
            router.push(`/projects/${task.project_id}`)
          }, 4000)
        }
      )

      // New activity logs
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'activity_logs', filter: `task_id=eq.${task.id}` },
        async (payload) => {
          const row = payload.new as { id: string; user_id: string }
          // Skip own actions — already updated locally via logActivity
          if (row.user_id === profile.id) return
          const { data } = await supabase
            .from('activity_logs')
            .select('*, user:profiles(id, full_name, avatar_url)')
            .eq('id', row.id)
            .single()
          if (data) setActivityLogs((prev) => [data as ActivityLog, ...prev])
        }
      )

      // New / updated time entries
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'time_entries', filter: `task_id=eq.${task.id}` },
        (payload) => {
          const row = payload.new as TimeEntry
          if (row.user_id === profile.id) return // already added locally by startTimer
          setTimeEntries((prev) => [row, ...prev])
          // Show live countdown when a teammate starts their timer
          if (row.is_running) {
            setRunningEntry(row)
            setTimerRunning(true)
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'time_entries', filter: `task_id=eq.${task.id}` },
        (payload) => {
          const row = payload.new as TimeEntry
          setTimeEntries((prev) =>
            prev.map((e) => (e.id === row.id ? { ...e, ...row } : e))
          )
          // When a teammate's running timer stops, clear the live display
          if (!row.is_running && row.user_id !== profile.id) {
            setRunningEntry((current) => {
              if (current?.id === row.id) {
                setTimerRunning(false)
                return null
              }
              return current
            })
          }
        }
      )

      // New comments from other users
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'comments', filter: `task_id=eq.${task.id}` },
        async (payload) => {
          const row = payload.new as { id: string; user_id: string }
          if (row.user_id === profile.id) return
          const { data } = await supabase
            .from('comments')
            .select('*, user:profiles(id, full_name, email, avatar_url, role, is_temp_password, onboarding_completed, created_at, updated_at)')
            .eq('id', row.id)
            .single()
          if (data) setComments((prev) => [...prev, data as Comment])
        }
      )

      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [task.id, profile.id]) // eslint-disable-line react-hooks/exhaustive-deps

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
    const result = await updateTaskStatusAction(task.id, newStatus)
    if (!result.success) {
      setTask((p) => ({ ...p, status: old }))
      toast({ title: 'Error updating status', description: result.error, variant: 'destructive' })
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
  }

  async function handlePriorityChange(newPriority: string) {
    const old = task.priority
    setTask((p) => ({ ...p, priority: newPriority as Priority }))
    const result = await updateTaskAction(task.id, { priority: newPriority })
    if (!result.success) {
      setTask((p) => ({ ...p, priority: old }))
      toast({ title: 'Error updating priority', description: result.error, variant: 'destructive' })
      return
    }
    await logActivity('priority_changed', old, newPriority)
  }

  async function saveTitle() {
    if (!titleDraft.trim()) return
    setSavingTitle(true)
    const result = await updateTaskAction(task.id, { title: titleDraft.trim() })
    setSavingTitle(false)
    if (!result.success) {
      toast({ title: 'Error saving title', description: result.error, variant: 'destructive' })
      return
    }
    setTask((p) => ({ ...p, title: titleDraft.trim() }))
    setEditingTitle(false)
  }

  async function saveDescription() {
    setSavingDescription(true)
    const old = task.description
    const result = await updateTaskAction(task.id, { description: descriptionDraft })
    setSavingDescription(false)
    if (!result.success) {
      toast({ title: 'Error saving description', description: result.error, variant: 'destructive' })
      return
    }
    setTask((p) => ({ ...p, description: descriptionDraft }))
    setEditingDescription(false)
    await logActivity('description_updated', old, descriptionDraft)
  }

  async function startTimer() {
    if (!canTrackTime) return
    const clickedAt = Date.now()
    setTimerLoading(true)
    const result = await startTimerAction(task.id)
    setTimerLoading(false)
    if (!result.success || !result.entry) {
      toast({ title: result.error ?? 'Failed to start timer', variant: 'destructive' })
      return
    }
    setRunningEntry(result.entry)
    setTimerClientBase(clickedAt)
    setTimerRunning(true)
    setTimeEntries((p) => [result.entry!, ...p])
  }

  async function handleCloneTask() {
    setIsCloning(true)
    const result = await cloneTaskAction(task.id)
    setIsCloning(false)
    if (result.success && result.taskId) {
      toast({ title: 'Task cloned successfully' })
      router.push(`/tasks/${result.taskId}`)
    } else {
      toast({ title: 'Failed to clone task', description: result.error, variant: 'destructive' })
    }
  }

  function openAssignDialog() {
    setPendingAssigneeIds((task.assignees ?? []).map((a) => a.id))
    setAssignSearch('')
    setShowAssignDialog(true)
  }

  async function saveAssignees() {
    setSavingAssignees(true)
    const result = await updateTaskAction(task.id, { assignee_ids: pendingAssigneeIds })
    setSavingAssignees(false)
    if (result.success) {
      const updatedAssignees = members.filter((m) => pendingAssigneeIds.includes(m.id))
      setTask((p) => ({ ...p, assignees: updatedAssignees }))
      setShowAssignDialog(false)
      toast({ title: 'Assignees updated' })
    } else {
      toast({ title: 'Failed to update assignees', description: result.error, variant: 'destructive' })
    }
  }

  async function stopTimer() {
    if (!runningEntry || !canTrackTime) return
    setTimerLoading(true)
    const duration = Math.round(
      (Date.now() - new Date(runningEntry.started_at).getTime()) / 60000,
    )
    const result = await stopTimerAction(runningEntry.id, duration)
    setTimerLoading(false)
    if (!result.success || !result.entry) {
      toast({ title: result.error ?? 'Failed to stop timer', variant: 'destructive' })
      return
    }
    setRunningEntry(null)
    setTimerClientBase(undefined)
    setTimerRunning(false)
    setTimeEntries((p) =>
      p.map((e) => (e.id === runningEntry.id ? result.entry! : e)),
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

  async function handleDeleteTask() {
    setDeletingTask(true)
    const result = await deleteTaskAction(task.id)
    setDeletingTask(false)
    setShowDeleteDialog(false)
    if (!result.success) {
      toast({ title: 'Failed to delete task', description: result.error, variant: 'destructive' })
      return
    }
    router.push(`/projects/${task.project_id}`)
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

        {/* ── Task deleted banner ── */}
        {taskDeleted && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-4 rounded-2xl border bg-card p-8 shadow-xl text-center max-w-sm mx-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
                <Trash2 className="h-7 w-7 text-destructive" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Task Deleted</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  This task was deleted. Redirecting you back to the project…
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={() => router.push(`/projects/${task.project_id}`)}>
                Go back now
              </Button>
            </div>
          </div>
        )}

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

          {/* Actions — admin/canEdit only */}
          <div className="ml-auto flex items-center gap-1 shrink-0">
            {canEdit && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-muted-foreground hover:text-foreground gap-1.5"
                onClick={handleCloneTask}
                disabled={isCloning}
              >
                <Copy className="h-4 w-4" />
                <span className="text-xs hidden sm:inline">{isCloning ? 'Cloning…' : 'Clone'}</span>
              </Button>
            )}
            {isAdmin && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                onClick={() => setShowDeleteDialog(true)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {/* ── Delete confirm dialog ── */}
        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                Delete this task?
              </AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-3">
                  <p>
                    <strong className="text-foreground">&ldquo;{task.title}&rdquo;</strong> will be permanently deleted.
                    This cannot be undone.
                  </p>
                  {(task.assignees ?? []).length > 0 && (
                    <div className="rounded-lg border bg-amber-50 border-amber-200 p-3">
                      <p className="text-xs font-medium text-amber-800 mb-2 flex items-center gap-1.5">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        {(task.assignees ?? []).length} assigned {(task.assignees ?? []).length === 1 ? 'person' : 'people'} will be notified
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {(task.assignees ?? []).map((a) => (
                          <div key={a.id} className="flex items-center gap-1.5">
                            <Avatar className="h-5 w-5">
                              <AvatarImage src={a.avatar_url ?? undefined} />
                              <AvatarFallback className="text-[9px]">{getInitials(a.full_name)}</AvatarFallback>
                            </Avatar>
                            <span className="text-xs text-amber-900">{a.full_name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deletingTask}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteTask}
                disabled={deletingTask}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deletingTask ? 'Deleting…' : 'Delete Task'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

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
                        className="h-6 gap-1 border-0 px-2.5 text-xs font-semibold rounded-full w-auto shadow-none focus:ring-0"
                        style={{
                          backgroundColor: (statusCfg?.color ?? '#94a3b8') + '20',
                          color: statusCfg?.color ?? '#94a3b8',
                        }}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {statuses.map((s) => (
                          <SelectItem key={s.slug} value={s.slug}>
                            <div className="flex items-center gap-1.5">
                              <div className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                              {s.name}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <span
                      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold"
                      style={{
                        backgroundColor: (statusCfg?.color ?? '#94a3b8') + '20',
                        color: statusCfg?.color ?? '#94a3b8',
                      }}
                    >
                      {statusCfg?.name ?? task.status}
                    </span>
                  )}

                  {/* Priority chip */}
                  <span
                    className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium border"
                    style={{
                      backgroundColor: (priorityCfg?.color ?? '#f59e0b') + '15',
                      color: priorityCfg?.color ?? '#f59e0b',
                      borderColor: (priorityCfg?.color ?? '#f59e0b') + '40',
                    }}
                  >
                    <div className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: priorityCfg?.color ?? '#f59e0b' }} />
                    {priorityCfg?.name ?? task.priority}
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
                  {canTrackTime && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs gap-1.5"
                      onClick={() => setShowTimeLogDialog(true)}
                    >
                      <Clock className="h-3.5 w-3.5" />
                      Log Time
                    </Button>
                  )}
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

              {/* Timer ─── hidden for client role ──────────── */}
              {canTrackTime && (
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
                        <ElapsedTimer startedAt={runningEntry.started_at} clientBase={timerClientBase} />
                      ) : (
                        '00:00:00'
                      )}
                    </span>
                  </div>
                  {/* Only the timer owner can stop it; observers see a read-only label */}
                  {timerRunning && runningEntry && runningEntry.user_id !== profile.id ? (
                    <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground w-full py-2">
                      <span className="truncate">
                        {(() => {
                          const teammate = members.find((m) => m.id === runningEntry.user_id)
                          return teammate
                            ? `Timer running by ${teammate.full_name}`
                            : 'Timer running by teammate'
                        })()}
                      </span>
                    </div>
                  ) : (
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
                  )}
                </div>
              )}

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
                      <div className="flex items-center gap-1.5">
                        <div className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: statusCfg?.color ?? '#94a3b8' }} />
                        <span>{statusCfg?.name ?? task.status}</span>
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                      {statuses.map((s) => (
                        <SelectItem key={s.slug} value={s.slug} className="text-xs">
                          <div className="flex items-center gap-1.5">
                            <div className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                            {s.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <span
                    className="inline-flex items-center rounded-md px-2 py-1 text-xs font-medium"
                    style={{
                      backgroundColor: (statusCfg?.color ?? '#94a3b8') + '20',
                      color: statusCfg?.color ?? '#94a3b8',
                    }}
                  >
                    {statusCfg?.name ?? task.status}
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
                      <div className="flex items-center gap-1.5">
                        <div className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: priorityCfg?.color ?? '#f59e0b' }} />
                        <span>{priorityCfg?.name ?? task.priority}</span>
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                      {priorities.map((p) => (
                        <SelectItem key={p.slug} value={p.slug} className="text-xs">
                          <div className="flex items-center gap-1.5">
                            <div className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                            {p.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <span
                    className="inline-flex items-center gap-1.5 text-xs font-medium"
                    style={{ color: priorityCfg?.color ?? '#f59e0b' }}
                  >
                    <div className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: priorityCfg?.color ?? '#f59e0b' }} />
                    {priorityCfg?.name ?? task.priority}
                  </span>
                )}
              </div>

              {/* Assignees ───────────────────────────────────── */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                    Assignees
                  </p>
                  {canEdit && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 text-muted-foreground hover:text-foreground"
                      onClick={openAssignDialog}
                    >
                      <UserPlus className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
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

        {/* Time log dialog — only for non-client roles */}
        {canTrackTime && showTimeLogDialog && (
          <TimeLogDialog
            open={showTimeLogDialog}
            onOpenChange={setShowTimeLogDialog}
            taskId={task.id}
            profile={profile}
            onCreated={handleTimeEntryAdded}
          />
        )}

        {/* Assign Members Dialog */}
        <Dialog open={showAssignDialog} onOpenChange={setShowAssignDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Edit Assignees</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-1">
              <div className="relative">
                <UserPlus className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search members…"
                  value={assignSearch}
                  onChange={(e) => setAssignSearch(e.target.value)}
                  className="w-full rounded-md border border-input bg-background pl-9 pr-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <ScrollArea className="h-64 border rounded-md">
                {members
                  .filter((m) =>
                    !assignSearch.trim() ||
                    m.full_name.toLowerCase().includes(assignSearch.toLowerCase()) ||
                    m.email.toLowerCase().includes(assignSearch.toLowerCase())
                  )
                  .map((m) => (
                    <label
                      key={m.id}
                      className="flex cursor-pointer items-center gap-3 px-3 py-2.5 hover:bg-muted/50 transition-colors"
                    >
                      <Checkbox
                        checked={pendingAssigneeIds.includes(m.id)}
                        onCheckedChange={(checked) => {
                          setPendingAssigneeIds((prev) =>
                            checked
                              ? [...prev, m.id]
                              : prev.filter((id) => id !== m.id)
                          )
                        }}
                      />
                      <Avatar className="h-7 w-7 shrink-0">
                        <AvatarImage src={m.avatar_url ?? undefined} />
                        <AvatarFallback className="text-xs">{getInitials(m.full_name)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{m.full_name}</p>
                        <p className="text-xs text-muted-foreground truncate">{m.email}</p>
                      </div>
                    </label>
                  ))}
              </ScrollArea>
              <p className="text-xs text-muted-foreground">
                {pendingAssigneeIds.length} assignee{pendingAssigneeIds.length !== 1 ? 's' : ''} selected
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAssignDialog(false)} disabled={savingAssignees}>
                Cancel
              </Button>
              <Button onClick={saveAssignees} disabled={savingAssignees}>
                {savingAssignees ? 'Saving…' : 'Save'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
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
      return `changed status from "${oldValue ?? ''}" to "${newValue ?? ''}"`
    case 'priority_changed':
      return `changed priority from "${oldValue ?? ''}" to "${newValue ?? ''}"`
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
