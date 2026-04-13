'use client'

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Task, Profile, Comment, TimeEntry, ActivityLog, TaskStatus, Priority } from '@/types'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
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
import { useToast } from '@/components/ui/use-toast'
import {
  ExternalLink, Trash2, Copy, Check, Flag, Zap, Users, Calendar,
  Clock, Play, Square, Circle, Bold, Code, List, AlertTriangle,
  UserPlus, X, ChevronDown, Hash, Timer, Plus,
} from 'lucide-react'
import { SubtaskList } from './subtask-list'
import { CommentSection } from './comment-section'
import { useTaskConfig } from '@/hooks/use-task-config'
import {
  updateTaskAction, updateTaskStatusAction, deleteTaskAction, cloneTaskAction,
} from '@/app/actions/tasks'
import { startTimerAction, stopTimerAction } from '@/app/actions/time-entries'
import { cn, formatDate, getInitials, timeAgo, formatHours } from '@/lib/utils'
import { format, parseISO } from 'date-fns'

// ── Types ──────────────────────────────────────────────────────────────────────

interface TaskDetailSheetProps {
  taskId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  profile: Profile
  members?: Profile[]
  onTaskUpdated?: (task: Task) => void
  onTaskDeleted?: (taskId: string) => void
}

type FeedItem =
  | { type: 'activity'; id: string; date: string; data: ActivityLog }
  | { type: 'comment';  id: string; date: string; data: Comment }
  | { type: 'time';     id: string; date: string; data: TimeEntry }

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatActivityAction(action: string, oldVal: string | null, newVal: string | null): string {
  switch (action) {
    case 'status_changed':   return `changed status from "${oldVal}" to "${newVal}"`
    case 'priority_changed': return `changed priority to "${newVal}"`
    case 'title_changed':    return `renamed task`
    case 'description_updated': return `updated description`
    case 'assignee_added':   return `assigned ${newVal}`
    case 'assignee_removed': return `unassigned ${newVal}`
    case 'due_date_changed': return `changed due date to ${newVal ?? 'none'}`
    default:                 return action.replace(/_/g, ' ')
  }
}

function ElapsedTimer({ startedAt, clientBase }: { startedAt: string; clientBase?: number }) {
  const base = Math.min(new Date(startedAt).getTime(), clientBase ?? Infinity)
  const [elapsed, setElapsed] = useState(() => Math.max(0, Math.floor((Date.now() - base) / 1000)))
  useEffect(() => {
    const tick = () => setElapsed(Math.max(0, Math.floor((Date.now() - base) / 1000)))
    const ms = 1000 - ((Date.now() - base) % 1000)
    let iid: ReturnType<typeof setInterval>
    const tid = setTimeout(() => { tick(); iid = setInterval(tick, 1000) }, ms)
    return () => { clearTimeout(tid); clearInterval(iid) }
  }, [base])
  const h = Math.floor(elapsed / 3600).toString().padStart(2, '0')
  const m = Math.floor((elapsed % 3600) / 60).toString().padStart(2, '0')
  const s = (elapsed % 60).toString().padStart(2, '0')
  return <span>{h}:{m}:{s}</span>
}

// ── Loading skeleton ────────────────────────────────────────────────────────────

function SheetSkeleton() {
  return (
    <div className="flex h-full">
      <div className="flex-1 p-6 space-y-6 overflow-y-auto">
        <Skeleton className="h-8 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
      <div className="w-[230px] border-l p-4 space-y-4">
        <Skeleton className="h-4 w-20" />
        {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
      </div>
    </div>
  )
}

// ── Feed row ────────────────────────────────────────────────────────────────────

function FeedRow({ item, isLast }: { item: FeedItem; isLast: boolean }) {
  const divider = !isLast && 'border-b border-border/40'

  if (item.type === 'activity') {
    const log = item.data
    return (
      <div className={cn('flex items-start gap-3 py-3', divider)}>
        <Avatar className="h-6 w-6 mt-0.5 shrink-0">
          <AvatarImage src={log.user?.avatar_url ?? undefined} />
          <AvatarFallback className="text-[9px]">{log.user ? getInitials(log.user.full_name) : '?'}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className="text-xs">
            <span className="font-medium">{log.user?.full_name ?? 'Unknown'}</span>{' '}
            <span className="text-muted-foreground">{formatActivityAction(log.action, log.old_value, log.new_value)}</span>
          </p>
          <p className="text-[11px] text-muted-foreground/60 mt-0.5">{timeAgo(log.created_at)}</p>
        </div>
      </div>
    )
  }

  if (item.type === 'comment') {
    const c = item.data
    return (
      <div className={cn('flex items-start gap-3 py-3', divider)}>
        <Avatar className="h-6 w-6 mt-0.5 shrink-0">
          <AvatarImage src={c.user?.avatar_url ?? undefined} />
          <AvatarFallback className="text-[9px]">{c.user ? getInitials(c.user.full_name) : '?'}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-medium">{c.user?.full_name ?? 'Unknown'}</span>
            {c.is_internal && (
              <span className="text-[9px] bg-amber-100 text-amber-700 px-1 py-0.5 rounded font-medium">Internal</span>
            )}
            <span className="text-[11px] text-muted-foreground/60">{timeAgo(c.created_at)}</span>
          </div>
          <div className="text-xs text-foreground/90 whitespace-pre-wrap rounded-md bg-muted/50 px-2.5 py-2">{c.content}</div>
        </div>
      </div>
    )
  }

  if (item.type === 'time') {
    const e = item.data
    const mins = e.duration_minutes ?? 0
    return (
      <div className={cn('flex items-start gap-3 py-3', divider)}>
        <div className="h-6 w-6 mt-0.5 shrink-0 rounded-full bg-muted flex items-center justify-center">
          <Clock className="h-3 w-3 text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs">
            <span className="font-medium">Time logged</span>{' '}
            <span className="font-mono text-[11px] bg-muted px-1.5 py-0.5 rounded">{formatHours(mins / 60)}</span>
            {e.description && <span className="text-muted-foreground"> — {e.description}</span>}
          </p>
          <p className="text-[11px] text-muted-foreground/60 mt-0.5">{timeAgo(e.created_at)}</p>
        </div>
      </div>
    )
  }

  return null
}

// ── Property row ────────────────────────────────────────────────────────────────

function PropRow({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ElementType
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-center gap-2 py-1.5 px-1 rounded-md hover:bg-muted/30 transition-colors group">
      <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      <span className="text-xs text-muted-foreground w-[72px] shrink-0">{label}</span>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export function TaskDetailSheet({
  taskId,
  open,
  onOpenChange,
  profile,
  members: externalMembers,
  onTaskUpdated,
  onTaskDeleted,
}: TaskDetailSheetProps) {
  const router = useRouter()
  const { toast } = useToast()
  const supabase = useRef(createClient()).current

  const [task,         setTask]         = useState<Task | null>(null)
  const [comments,     setComments]     = useState<Comment[]>([])
  const [timeEntries,  setTimeEntries]  = useState<TimeEntry[]>([])
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([])
  const [members,      setMembers]      = useState<Profile[]>(externalMembers ?? [])
  const [loading,      setLoading]      = useState(false)

  const [editingTitle, setEditingTitle]           = useState(false)
  const [titleDraft,   setTitleDraft]             = useState('')
  const [savingTitle,  setSavingTitle]            = useState(false)
  const [editingDesc,  setEditingDesc]            = useState(false)
  const [descDraft,    setDescDraft]              = useState('')
  const [savingDesc,   setSavingDesc]             = useState(false)
  const [savingField,  setSavingField]            = useState(false)

  const [showAssignDialog, setShowAssignDialog]   = useState(false)
  const [assignSearch,     setAssignSearch]       = useState('')
  const [pendingIds,       setPendingIds]         = useState<string[]>([])
  const [savingAssignees,  setSavingAssignees]    = useState(false)

  const [showDeleteDialog, setShowDeleteDialog]   = useState(false)
  const [deletingTask,     setDeletingTask]       = useState(false)
  const [isCloning,        setIsCloning]         = useState(false)

  const [timerRunning,    setTimerRunning]        = useState(false)
  const [runningEntry,    setRunningEntry]        = useState<TimeEntry | null>(null)
  const [timerClientBase, setTimerClientBase]     = useState<number | undefined>(undefined)
  const [timerLoading,    setTimerLoading]        = useState(false)

  const descRef = useRef<HTMLTextAreaElement>(null)

  const { statuses, priorities, getStatus, getPriority } = useTaskConfig()

  const isAdmin    = profile.role === 'super_admin'
  const isCreator  = task?.created_by === profile.id
  const isAssignee = (task?.assignees ?? []).some((a) => a.id === profile.id)
  const canEdit    = isAdmin || isCreator || isAssignee
  const canTrack   = profile.role !== 'client'

  const statusCfg   = task ? getStatus(task.status)   : null
  const priorityCfg = task ? getPriority(task.priority) : null

  const totalLoggedMin = timeEntries
    .filter((e) => e.duration_minutes !== null && !e.is_running)
    .reduce((s, e) => s + (e.duration_minutes ?? 0), 0)

  const estMin       = (task?.estimated_hours ?? 0) * 60
  const timeProgress = estMin > 0 ? Math.min((totalLoggedMin / estMin) * 100, 100) : 0

  const profileSelect = 'id, full_name, email, avatar_url, role, is_temp_password, onboarding_completed, created_at, updated_at'

  // ── Fetch task data ──────────────────────────────────────────────────────────

  const fetchTask = useCallback(async (id: string) => {
    setLoading(true)
    const { data: raw } = await supabase
      .from('tasks')
      .select(`*, project:projects(id,name,workspace_id), assignees:task_assignees(user:profiles(${profileSelect}))`)
      .eq('id', id)
      .single()

    if (!raw) { setLoading(false); return }

    const assignees: Profile[] = ((raw as any).assignees ?? []).map((a: any) => a.user).filter(Boolean)

    const { data: subs } = await supabase
      .from('tasks')
      .select(`*, assignees:task_assignees(user:profiles(${profileSelect}))`)
      .eq('parent_task_id', id)
      .order('created_at', { ascending: true })

    const subtasks: Task[] = (subs ?? []).map((s: any) => ({
      ...s,
      assignees: (s.assignees ?? []).map((a: any) => a.user).filter(Boolean),
    }))

    const { data: cmts } = await supabase
      .from('comments')
      .select(`*, user:profiles(${profileSelect})`)
      .eq('task_id', id)
      .order('created_at', { ascending: true })

    const { data: entries } = await supabase
      .from('time_entries')
      .select('*')
      .eq('task_id', id)
      .order('started_at', { ascending: false })

    const { data: logs } = await supabase
      .from('activity_logs')
      .select(`*, user:profiles(${profileSelect})`)
      .eq('task_id', id)
      .order('created_at', { ascending: false })
      .limit(60)

    const t: Task = { ...(raw as any), assignees, subtasks }
    setTask(t)
    setTitleDraft(t.title)
    setDescDraft(t.description ?? '')
    setComments((cmts ?? []) as Comment[])
    setTimeEntries((entries ?? []) as TimeEntry[])
    setActivityLogs((logs ?? []) as ActivityLog[])

    const running = (entries ?? []).find((e: any) => e.is_running)
    if (running) { setRunningEntry(running as TimeEntry); setTimerRunning(true) }
    else { setRunningEntry(null); setTimerRunning(false) }

    // Fetch members if not passed in
    if (!externalMembers) {
      const wsId = (raw as any).project?.workspace_id
      const [wsMems, admins] = await Promise.all([
        wsId ? supabase.from('workspace_assignments').select(`user:profiles(${profileSelect})`).eq('workspace_id', wsId) : Promise.resolve({ data: [] }),
        supabase.from('profiles').select(profileSelect).eq('role', 'super_admin'),
      ])
      const all: Profile[] = [
        ...((wsMems.data ?? []) as any[]).map((a) => a.user).filter(Boolean),
        ...((admins.data ?? []) as Profile[]),
      ]
      const seen = new Set<string>()
      setMembers(all.filter((m) => { if (seen.has(m.id)) return false; seen.add(m.id); return true }))
    }

    setLoading(false)
  }, [supabase, externalMembers]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (open && taskId) {
      setTask(null)
      setComments([])
      setTimeEntries([])
      setActivityLogs([])
      setEditingTitle(false)
      setEditingDesc(false)
      fetchTask(taskId)
    }
  }, [open, taskId]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Realtime ─────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!open || !task) return
    const ch = supabase
      .channel(`sheet-task:${task.id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'tasks', filter: `id=eq.${task.id}` },
        (p) => setTask((prev) => prev ? { ...prev, ...p.new } : prev))
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'comments', filter: `task_id=eq.${task.id}` },
        async (p) => {
          const row = p.new as { id: string; user_id: string }
          if (row.user_id === profile.id) return
          const { data } = await supabase.from('comments').select(`*, user:profiles(${profileSelect})`).eq('id', row.id).single()
          if (data) setComments((prev) => [...prev, data as Comment])
        })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'activity_logs', filter: `task_id=eq.${task.id}` },
        async (p) => {
          const row = p.new as { id: string; user_id: string }
          if (row.user_id === profile.id) return
          const { data } = await supabase.from('activity_logs').select(`*, user:profiles(${profileSelect})`).eq('id', row.id).single()
          if (data) setActivityLogs((prev) => [data as ActivityLog, ...prev])
        })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [open, task?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Feed ─────────────────────────────────────────────────────────────────────

  const feedItems = useMemo<FeedItem[]>(() => {
    const items: FeedItem[] = [
      ...activityLogs.map((a) => ({ type: 'activity' as const, id: a.id, date: a.created_at, data: a })),
      ...comments.map((c)     => ({ type: 'comment'  as const, id: c.id, date: c.created_at, data: c })),
      ...timeEntries.filter((e) => !e.is_running).map((e) => ({ type: 'time' as const, id: e.id, date: e.created_at, data: e })),
    ]
    return items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }, [activityLogs, comments, timeEntries])

  // ── Helpers ──────────────────────────────────────────────────────────────────

  async function logActivity(action: string, oldVal: string | null, newVal: string | null) {
    if (!task) return
    const { data } = await supabase.from('activity_logs').insert({
      task_id: task.id, user_id: profile.id, action, old_value: oldVal, new_value: newVal,
    }).select(`*, user:profiles(${profileSelect})`).single()
    if (data) setActivityLogs((p) => [data as ActivityLog, ...p])
  }

  // ── Handlers ─────────────────────────────────────────────────────────────────

  async function handleStatusChange(newStatus: string) {
    if (!task) return
    const old = task.status
    setTask((p) => p ? { ...p, status: newStatus as TaskStatus } : p)
    const result = await updateTaskStatusAction(task.id, newStatus)
    if (!result.success) {
      setTask((p) => p ? { ...p, status: old } : p)
      toast({ title: 'Error', description: result.error, variant: 'destructive' })
      return
    }
    await logActivity('status_changed', old, newStatus)
    onTaskUpdated?.({ ...task, status: newStatus as TaskStatus })
  }

  async function handlePriorityChange(newPriority: string) {
    if (!task) return
    const old = task.priority
    setTask((p) => p ? { ...p, priority: newPriority as Priority } : p)
    const result = await updateTaskAction(task.id, { priority: newPriority })
    if (!result.success) {
      setTask((p) => p ? { ...p, priority: old } : p)
      toast({ title: 'Error', description: result.error, variant: 'destructive' })
      return
    }
    await logActivity('priority_changed', old, newPriority)
    onTaskUpdated?.({ ...task, priority: newPriority as Priority })
  }

  async function saveTitle() {
    if (!task || !titleDraft.trim()) return
    setSavingTitle(true)
    const result = await updateTaskAction(task.id, { title: titleDraft.trim() })
    setSavingTitle(false)
    if (!result.success) { toast({ title: 'Error', description: result.error, variant: 'destructive' }); return }
    setTask((p) => p ? { ...p, title: titleDraft.trim() } : p)
    setEditingTitle(false)
    onTaskUpdated?.({ ...task, title: titleDraft.trim() })
  }

  async function saveDesc() {
    if (!task) return
    setSavingDesc(true)
    const old = task.description
    const result = await updateTaskAction(task.id, { description: descDraft })
    setSavingDesc(false)
    if (!result.success) { toast({ title: 'Error', description: result.error, variant: 'destructive' }); return }
    setTask((p) => p ? { ...p, description: descDraft } : p)
    setEditingDesc(false)
    await logActivity('description_updated', old, descDraft)
  }

  async function handleFieldChange(field: 'start_date' | 'due_date' | 'estimated_hours', value: string) {
    if (!task) return
    setSavingField(true)
    const payload: Record<string, string | number | null> = {
      [field]: field === 'estimated_hours' ? (value ? parseFloat(value) : null) : (value || null),
    }
    const result = await updateTaskAction(task.id, payload as any)
    if (result.success) setTask((p) => p ? { ...p, ...payload } : p)
    else toast({ title: 'Error', description: result.error, variant: 'destructive' })
    setSavingField(false)
  }

  async function saveAssignees() {
    if (!task) return
    setSavingAssignees(true)
    const result = await updateTaskAction(task.id, { assignee_ids: pendingIds })
    setSavingAssignees(false)
    if (result.success) {
      const updated = members.filter((m) => pendingIds.includes(m.id))
      setTask((p) => p ? { ...p, assignees: updated } : p)
      setShowAssignDialog(false)
      onTaskUpdated?.({ ...task, assignees: updated })
    } else {
      toast({ title: 'Error', description: result.error, variant: 'destructive' })
    }
  }

  async function handleDeleteTask() {
    if (!task) return
    setDeletingTask(true)
    const result = await deleteTaskAction(task.id)
    setDeletingTask(false)
    setShowDeleteDialog(false)
    if (!result.success) { toast({ title: 'Error', description: result.error, variant: 'destructive' }); return }
    onTaskDeleted?.(task.id)
    onOpenChange(false)
  }

  async function handleClone() {
    if (!task) return
    setIsCloning(true)
    const result = await cloneTaskAction(task.id)
    setIsCloning(false)
    if (result.success && result.taskId) {
      toast({ title: 'Task cloned' })
      router.push(`/lists/${task.project_id}/tasks/${result.taskId}`)
    } else {
      toast({ title: 'Error', description: result.error, variant: 'destructive' })
    }
  }

  async function startTimer() {
    if (!task || !canTrack) return
    const clickedAt = Date.now()
    setTimerLoading(true)
    const result = await startTimerAction(task.id)
    setTimerLoading(false)
    if (!result.success || !result.entry) { toast({ title: result.error ?? 'Failed', variant: 'destructive' }); return }
    setRunningEntry(result.entry)
    setTimerClientBase(clickedAt)
    setTimerRunning(true)
    setTimeEntries((p) => [result.entry!, ...p])
  }

  async function stopTimer() {
    if (!runningEntry || !canTrack) return
    setTimerLoading(true)
    const duration = Math.round((Date.now() - new Date(runningEntry.started_at).getTime()) / 60000)
    const result = await stopTimerAction(runningEntry.id, duration)
    setTimerLoading(false)
    if (!result.success || !result.entry) { toast({ title: result.error ?? 'Failed', variant: 'destructive' }); return }
    setRunningEntry(null)
    setTimerClientBase(undefined)
    setTimerRunning(false)
    setTimeEntries((p) => p.map((e) => (e.id === runningEntry.id ? result.entry! : e)))
  }

  function applyFormat(fmt: 'bold' | 'code' | 'bullet') {
    const ta = descRef.current
    if (!ta) return
    const start = ta.selectionStart
    const end   = ta.selectionEnd
    const sel   = descDraft.slice(start, end)
    let rep: string; let off: number
    if (fmt === 'bold')   { rep = `**${sel}**`; off = 2 }
    else if (fmt === 'code') { rep = `\`${sel}\``; off = 1 }
    else                  { rep = `- ${sel}`;  off = 2 }
    const nv = descDraft.slice(0, start) + rep + descDraft.slice(end)
    setDescDraft(nv)
    requestAnimationFrame(() => { ta.focus(); ta.setSelectionRange(start + off, start + off + sel.length) })
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <TooltipProvider>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-none p-0 flex flex-col"
          style={{ width: 'min(90vw, 960px)' }}
        >
          {loading || !task ? (
            <SheetSkeleton />
          ) : (
            <div className="flex flex-col h-full">

              {/* ── Top bar ── */}
              <div className="flex items-center gap-2 border-b px-4 h-11 shrink-0 bg-background/95">
                {/* Breadcrumb */}
                {task.project && (
                  <>
                    <button
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors truncate max-w-[140px]"
                      onClick={() => router.push(`/lists/${task.project_id}`)}
                    >
                      {task.project.name}
                    </button>
                    <span className="text-muted-foreground/40 shrink-0 text-xs">/</span>
                  </>
                )}
                <span className="text-xs font-medium truncate flex-1 text-foreground/80">{task.title}</span>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  {canEdit && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground" onClick={handleClone} disabled={isCloning}>
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent className="text-xs">Clone task</TooltipContent>
                    </Tooltip>
                  )}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground" onClick={() => router.push(`/lists/${task.project_id}/tasks/${task.id}`)}>
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent className="text-xs">Open full page</TooltipContent>
                  </Tooltip>
                  {isAdmin && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive" onClick={() => setShowDeleteDialog(true)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent className="text-xs">Delete task</TooltipContent>
                    </Tooltip>
                  )}
                </div>
              </div>

              {/* ── Body ── */}
              <div className="flex flex-1 min-h-0">

                {/* ── Left: content ── */}
                <div className="flex-1 overflow-y-auto">
                  <div className="px-6 py-5 space-y-6 max-w-2xl">

                    {/* Status + Priority chips */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold cursor-pointer"
                        style={{
                          backgroundColor: (statusCfg?.color ?? '#94a3b8') + '20',
                          color: statusCfg?.color ?? '#94a3b8',
                        }}
                      >
                        <div className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: statusCfg?.color ?? '#94a3b8' }} />
                        {statusCfg?.name ?? task.status}
                      </span>
                      <span
                        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium border"
                        style={{
                          backgroundColor: (priorityCfg?.color ?? '#f59e0b') + '15',
                          color: priorityCfg?.color ?? '#f59e0b',
                          borderColor: (priorityCfg?.color ?? '#f59e0b') + '40',
                        }}
                      >
                        <Flag className="h-2.5 w-2.5 shrink-0" />
                        {priorityCfg?.name ?? task.priority}
                      </span>
                      {/* Assignee avatars */}
                      {(task.assignees ?? []).length > 0 && (
                        <div className="flex -space-x-1 ml-0.5">
                          {(task.assignees ?? []).slice(0, 4).map((a) => (
                            <Tooltip key={a.id}>
                              <TooltipTrigger asChild>
                                <Avatar className="h-5 w-5 border-2 border-background cursor-default">
                                  <AvatarImage src={a.avatar_url ?? undefined} />
                                  <AvatarFallback className="text-[8px]">{getInitials(a.full_name)}</AvatarFallback>
                                </Avatar>
                              </TooltipTrigger>
                              <TooltipContent className="text-xs">{a.full_name}</TooltipContent>
                            </Tooltip>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Title */}
                    {editingTitle ? (
                      <div className="space-y-2">
                        <Textarea
                          value={titleDraft}
                          onChange={(e) => setTitleDraft(e.target.value)}
                          className="text-xl font-bold resize-none border-0 border-b rounded-none px-0 py-1 focus-visible:ring-0 focus-visible:border-primary"
                          rows={2}
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveTitle() }
                            if (e.key === 'Escape') { setEditingTitle(false); setTitleDraft(task.title) }
                          }}
                        />
                        <div className="flex gap-2">
                          <Button size="sm" onClick={saveTitle} disabled={savingTitle} className="h-7 gap-1.5">
                            <Check className="h-3 w-3" />{savingTitle ? 'Saving…' : 'Save'}
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7" onClick={() => { setEditingTitle(false); setTitleDraft(task.title) }}>
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <h1
                        className={cn(
                          'text-xl font-bold leading-snug break-words',
                          canEdit && 'cursor-text hover:bg-muted/50 -mx-2 px-2 py-1 rounded-md transition-colors',
                        )}
                        onClick={() => canEdit && setEditingTitle(true)}
                      >
                        {task.title}
                      </h1>
                    )}

                    {/* Description */}
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">Description</p>
                      {editingDesc ? (
                        <div className="rounded-lg border bg-background overflow-hidden">
                          <div className="flex items-center gap-0.5 px-2 py-1.5 border-b bg-muted/30">
                            {([
                              { icon: <Bold className="h-3.5 w-3.5" />, fmt: 'bold' },
                              { icon: <Code className="h-3.5 w-3.5" />, fmt: 'code' },
                              { icon: <List className="h-3.5 w-3.5" />, fmt: 'bullet' },
                            ] as const).map(({ icon, fmt }) => (
                              <button key={fmt} type="button" onMouseDown={(e) => { e.preventDefault(); applyFormat(fmt) }}
                                className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                                {icon}
                              </button>
                            ))}
                          </div>
                          <Textarea ref={descRef} value={descDraft} onChange={(e) => setDescDraft(e.target.value)}
                            placeholder="Add a description…" rows={5}
                            className="border-0 rounded-none resize-none text-sm focus-visible:ring-0 px-3 py-2.5" autoFocus />
                          <div className="flex gap-2 px-3 py-2 border-t bg-muted/20">
                            <Button size="sm" onClick={saveDesc} disabled={savingDesc} className="h-7 gap-1.5">
                              <Check className="h-3 w-3" />{savingDesc ? 'Saving…' : 'Save'}
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7" onClick={() => setEditingDesc(false)}>Cancel</Button>
                          </div>
                        </div>
                      ) : (
                        <div
                          className={cn(
                            'text-sm leading-relaxed rounded-md px-3 py-2 -mx-3 transition-colors min-h-[40px]',
                            canEdit && 'cursor-text hover:bg-muted/50',
                            !task.description && 'text-muted-foreground italic',
                          )}
                          onClick={() => canEdit && setEditingDesc(true)}
                        >
                          {task.description
                            ? <div className="whitespace-pre-wrap">{task.description}</div>
                            : canEdit ? 'Click to add a description…' : 'No description.'}
                        </div>
                      )}
                    </div>

                    {/* Subtasks */}
                    <div className="rounded-xl border bg-card/50 p-4">
                      <SubtaskList
                        parentTask={task}
                        subtasks={task.subtasks ?? []}
                        members={members}
                        profile={profile}
                        onSubtaskCreated={(s) => setTask((p) => p ? { ...p, subtasks: [...(p.subtasks ?? []), s] } : p)}
                        onSubtaskUpdated={(u) => setTask((p) => p ? { ...p, subtasks: (p.subtasks ?? []).map((s) => s.id === u.id ? u : s) } : p)}
                      />
                    </div>

                    {/* Activity */}
                    <div className="space-y-3">
                      <h3 className="text-sm font-semibold">Activity</h3>
                      <CommentSection
                        taskId={task.id}
                        comments={[]}
                        members={members}
                        profile={profile}
                        onCommentAdded={(c) => setComments((p) => [...p, c])}
                        inputOnly
                      />
                      {feedItems.length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-6">No activity yet.</p>
                      ) : (
                        <div>
                          {feedItems.map((item, i) => (
                            <FeedRow key={`${item.type}-${item.id}`} item={item} isLast={i === feedItems.length - 1} />
                          ))}
                        </div>
                      )}
                    </div>

                  </div>
                </div>

                {/* ── Right: properties ── */}
                <div className="w-[230px] shrink-0 border-l bg-card/10 overflow-y-auto">

                  {/* Timer */}
                  {canTrack && (
                    <div className="border-b px-4 py-3">
                      <div className="flex items-center gap-2.5 mb-2">
                        {timerRunning && runningEntry ? (
                          <span className="relative flex h-2 w-2 shrink-0">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
                          </span>
                        ) : (
                          <Circle className="h-2 w-2 text-muted-foreground/40 shrink-0" />
                        )}
                        <span className="text-lg font-mono font-bold tabular-nums">
                          {timerRunning && runningEntry
                            ? <ElapsedTimer startedAt={runningEntry.started_at} clientBase={timerClientBase} />
                            : '00:00:00'}
                        </span>
                      </div>
                      <button
                        onClick={timerRunning ? stopTimer : startTimer}
                        disabled={timerLoading}
                        className={cn(
                          'flex items-center justify-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-md transition-colors w-full',
                          timerRunning
                            ? 'bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 dark:bg-red-950/30 dark:border-red-900'
                            : 'bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20',
                          timerLoading && 'opacity-50 cursor-not-allowed',
                        )}
                      >
                        {timerRunning
                          ? <><Square className="h-3 w-3 fill-current" />Stop</>
                          : <><Play className="h-3 w-3 fill-current" />Start Timer</>}
                      </button>
                      {totalLoggedMin > 0 && (
                        <p className="text-[11px] text-muted-foreground text-center mt-1.5">
                          {formatHours(totalLoggedMin / 60)} logged
                        </p>
                      )}
                    </div>
                  )}

                  {/* Properties */}
                  <div className="px-3 py-3">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1.5 px-1">Properties</p>

                    {/* Status */}
                    <PropRow icon={Zap} label="Status">
                      {canEdit ? (
                        <Select value={task.status} onValueChange={handleStatusChange}>
                          <SelectTrigger className="h-7 border-0 px-2 text-xs font-medium shadow-none bg-transparent focus:ring-0 hover:bg-muted/50 rounded-md">
                            <div className="flex items-center gap-1.5">
                              <div className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: statusCfg?.color }} />
                              {statusCfg?.name ?? task.status}
                            </div>
                          </SelectTrigger>
                          <SelectContent>
                            {statuses.map((s) => (
                              <SelectItem key={s.slug} value={s.slug} className="text-xs">
                                <div className="flex items-center gap-2">
                                  <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                                  {s.name}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <span className="text-xs px-2">{statusCfg?.name ?? task.status}</span>
                      )}
                    </PropRow>

                    {/* Priority */}
                    <PropRow icon={Flag} label="Priority">
                      {canEdit ? (
                        <Select value={task.priority} onValueChange={handlePriorityChange}>
                          <SelectTrigger className="h-7 border-0 px-2 text-xs font-medium shadow-none bg-transparent focus:ring-0 hover:bg-muted/50 rounded-md">
                            <div className="flex items-center gap-1.5">
                              <Flag className="h-3 w-3" style={{ color: priorityCfg?.color }} />
                              {priorityCfg?.name ?? task.priority}
                            </div>
                          </SelectTrigger>
                          <SelectContent>
                            {priorities.map((p) => (
                              <SelectItem key={p.slug} value={p.slug} className="text-xs">
                                <div className="flex items-center gap-2">
                                  <Flag className="h-3 w-3" style={{ color: p.color }} />
                                  {p.name}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <span className="text-xs px-2">{priorityCfg?.name ?? task.priority}</span>
                      )}
                    </PropRow>

                    {/* Assignees */}
                    <PropRow icon={Users} label="Assignees">
                      <button
                        onClick={() => { setPendingIds((task.assignees ?? []).map((a) => a.id)); setAssignSearch(''); setShowAssignDialog(true) }}
                        className="flex items-center gap-1 px-2 h-7 rounded-md hover:bg-muted/50 transition-colors w-full text-left"
                        disabled={!canEdit}
                      >
                        {(task.assignees ?? []).length === 0 ? (
                          <span className="text-xs text-muted-foreground/50">None</span>
                        ) : (
                          <div className="flex -space-x-1">
                            {(task.assignees ?? []).slice(0, 3).map((a) => (
                              <Avatar key={a.id} className="h-5 w-5 border border-background">
                                <AvatarImage src={a.avatar_url ?? undefined} />
                                <AvatarFallback className="text-[8px]">{getInitials(a.full_name)}</AvatarFallback>
                              </Avatar>
                            ))}
                            {(task.assignees ?? []).length > 3 && (
                              <span className="text-[10px] text-muted-foreground ml-1">+{(task.assignees ?? []).length - 3}</span>
                            )}
                          </div>
                        )}
                      </button>
                    </PropRow>

                    {/* Start date */}
                    <PropRow icon={Calendar} label="Start">
                      <input
                        type="date"
                        value={task.start_date?.slice(0, 10) ?? ''}
                        onChange={(e) => handleFieldChange('start_date', e.target.value)}
                        disabled={!canEdit || savingField}
                        className="h-7 w-full px-2 text-xs rounded-md border-0 bg-transparent hover:bg-muted/50 focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
                      />
                    </PropRow>

                    {/* Due date */}
                    <PropRow icon={Calendar} label="Due">
                      <input
                        type="date"
                        value={task.due_date?.slice(0, 10) ?? ''}
                        onChange={(e) => handleFieldChange('due_date', e.target.value)}
                        disabled={!canEdit || savingField}
                        className="h-7 w-full px-2 text-xs rounded-md border-0 bg-transparent hover:bg-muted/50 focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
                      />
                    </PropRow>

                    {/* Estimated hours */}
                    <PropRow icon={Timer} label="Est. hrs">
                      <input
                        type="number"
                        min={0}
                        step={0.5}
                        value={task.estimated_hours ?? ''}
                        onChange={(e) => handleFieldChange('estimated_hours', e.target.value)}
                        disabled={!canEdit || savingField}
                        placeholder="—"
                        className="h-7 w-full px-2 text-xs rounded-md border-0 bg-transparent hover:bg-muted/50 focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
                      />
                    </PropRow>

                    {/* Time progress bar */}
                    {estMin > 0 && (
                      <div className="mt-2 px-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[11px] text-muted-foreground">Time progress</span>
                          <span className="text-[11px] font-medium">{Math.round(timeProgress)}%</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                          <div
                            className={cn('h-full rounded-full transition-all', timeProgress >= 100 ? 'bg-red-500' : 'bg-primary')}
                            style={{ width: `${timeProgress}%` }}
                          />
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {formatHours(totalLoggedMin / 60)} / {formatHours((task.estimated_hours ?? 0))}
                        </p>
                      </div>
                    )}

                    {/* Project */}
                    {task.project && (
                      <>
                        <Separator className="my-2" />
                        <PropRow icon={Hash} label="Project">
                          <button
                            onClick={() => router.push(`/lists/${task.project_id}`)}
                            className="text-xs px-2 text-primary hover:underline truncate"
                          >
                            {task.project.name}
                          </button>
                        </PropRow>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* ── Delete dialog ── */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Delete task?
            </AlertDialogTitle>
            <AlertDialogDescription>
              <strong>&ldquo;{task?.title}&rdquo;</strong> will be permanently deleted. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingTask}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteTask} disabled={deletingTask}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deletingTask ? 'Deleting…' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Assign dialog ── */}
      <AlertDialog open={showAssignDialog} onOpenChange={setShowAssignDialog}>
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-base">
              <UserPlus className="h-4 w-4" />
              Manage Assignees
            </AlertDialogTitle>
          </AlertDialogHeader>
          <div className="space-y-3 py-1">
            <input
              autoFocus
              value={assignSearch}
              onChange={(e) => setAssignSearch(e.target.value)}
              placeholder="Search members…"
              className="w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <div className="max-h-52 overflow-y-auto space-y-1">
              {members
                .filter((m) => m.full_name.toLowerCase().includes(assignSearch.toLowerCase()))
                .map((m) => {
                  const checked = pendingIds.includes(m.id)
                  return (
                    <label key={m.id} className="flex items-center gap-3 px-2 py-1.5 rounded-md hover:bg-muted cursor-pointer">
                      <input type="checkbox" checked={checked}
                        onChange={() => setPendingIds((p) => checked ? p.filter((id) => id !== m.id) : [...p, m.id])}
                        className="rounded" />
                      <Avatar className="h-6 w-6 shrink-0">
                        <AvatarImage src={m.avatar_url ?? undefined} />
                        <AvatarFallback className="text-[9px]">{getInitials(m.full_name)}</AvatarFallback>
                      </Avatar>
                      <span className="text-sm truncate">{m.full_name}</span>
                    </label>
                  )
                })}
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={saveAssignees} disabled={savingAssignees}>
              {savingAssignees ? 'Saving…' : 'Save'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </TooltipProvider>
  )
}
