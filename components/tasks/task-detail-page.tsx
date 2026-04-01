'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Task, Profile, Comment, TimeEntry, ActivityLog, TaskStatus, Priority } from '@/types'
import { SubtaskList } from './subtask-list'
import { CommentSection } from './comment-section'
import { TimeLogDialog } from '@/components/time-tracking/time-log-dialog'
import { TimeEntriesList } from '@/components/time-tracking/time-entries-list'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
  Edit3,
  Check,
  X,
  Plus,
  Activity,
  MessageSquare,
  Timer,
  ChevronDown,
  Circle,
  Tag,
  Info,
  Paperclip,
  Play,
  Square,
} from 'lucide-react'
import { TASK_STATUSES, PRIORITIES } from '@/lib/constants'
import {
  cn,
  formatDate,
  formatHours,
  getInitials,
  getPriorityColor,
  getStatusColor,
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

// ── Elapsed timer display ─────────────────────────────────────────────────────
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

  const [task, setTask] = useState<Task>(initialTask)
  const [comments, setComments] = useState<Comment[]>(initialComments)
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>(initialTimeEntries)
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>(initialActivityLogs)

  const [editingTitle, setEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState(task.title)
  const [editingDescription, setEditingDescription] = useState(false)
  const [descriptionDraft, setDescriptionDraft] = useState(task.description ?? '')
  const [savingDescription, setSavingDescription] = useState(false)
  const [savingTitle, setSavingTitle] = useState(false)

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

  // Check for running timer on mount
  useEffect(() => {
    const running = timeEntries.find((e) => e.is_running)
    if (running) {
      setRunningEntry(running)
      setTimerRunning(true)
    }
  }, [])

  async function logActivity(action: string, oldValue: string | null, newValue: string | null) {
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
    if (error) { toast({ title: 'Error saving title', variant: 'destructive' }); return }
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
    if (error) { toast({ title: 'Error saving description', variant: 'destructive' }); return }
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
    if (error || !data) { toast({ title: 'Failed to start timer', variant: 'destructive' }); return }
    setRunningEntry(data as TimeEntry)
    setTimerRunning(true)
    setTimeEntries((p) => [data as TimeEntry, ...p])
  }

  async function stopTimer() {
    if (!runningEntry) return
    setTimerLoading(true)
    const duration = Math.round((Date.now() - new Date(runningEntry.started_at).getTime()) / 60000)
    const { data, error } = await supabase
      .from('time_entries')
      .update({ is_running: false, duration_minutes: duration, updated_at: new Date().toISOString() })
      .eq('id', runningEntry.id)
      .select('*')
      .single()
    setTimerLoading(false)
    if (error || !data) { toast({ title: 'Failed to stop timer', variant: 'destructive' }); return }
    setRunningEntry(null)
    setTimerRunning(false)
    setTimeEntries((p) => p.map((e) => (e.id === runningEntry.id ? (data as TimeEntry) : e)))
  }

  function handleSubtaskCreated(subtask: Task) {
    setTask((p) => ({ ...p, subtasks: [...(p.subtasks ?? []), subtask] }))
  }
  function handleSubtaskUpdated(updated: Task) {
    setTask((p) => ({ ...p, subtasks: (p.subtasks ?? []).map((s) => (s.id === updated.id ? updated : s)) }))
  }
  function handleCommentAdded(comment: Comment) {
    setComments((p) => [...p, comment])
  }
  function handleTimeEntryAdded(entry: TimeEntry) {
    setTimeEntries((p) => [entry, ...p])
  }
  function handleTimeEntryUpdated(entry: TimeEntry) {
    setTimeEntries((p) => p.map((e) => (e.id === entry.id ? entry : e)))
  }
  function handleTimeEntryDeleted(id: string) {
    setTimeEntries((p) => p.filter((e) => e.id !== id))
  }

  const primaryAssignee = (task.assignees ?? [])[0]
  const statusMeta = TASK_STATUSES.find((s) => s.value === task.status)

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-background">
        {/* ── Top nav bar ── */}
        <div className="sticky top-0 z-10 flex items-center gap-3 border-b bg-card px-4 py-2.5">
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-muted-foreground"
            onClick={() => router.push(`/projects/${task.project_id}`)}
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>

          <Separator orientation="vertical" className="h-5" />

          {/* Status badge */}
          {canEdit ? (
            <Select value={task.status} onValueChange={handleStatusChange}>
              <SelectTrigger className={cn(
                'h-7 gap-1.5 border-0 px-2.5 text-xs font-semibold rounded-full w-auto',
                task.status === 'todo' && 'bg-slate-100 text-slate-700',
                task.status === 'in_progress' && 'bg-yellow-100 text-yellow-700',
                task.status === 'in_review' && 'bg-blue-100 text-blue-700',
                task.status === 'done' && 'bg-green-100 text-green-700',
                task.status === 'cancelled' && 'bg-red-100 text-red-700',
              )}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TASK_STATUSES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <span className={cn(
              'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold',
              getStatusColor(task.status)
            )}>
              {formatStatus(task.status)}
            </span>
          )}

          {/* Assignee */}
          {primaryAssignee && (
            <div className="flex items-center gap-2 ml-1">
              <Avatar className="h-6 w-6">
                <AvatarImage src={primaryAssignee.avatar_url ?? undefined} />
                <AvatarFallback className="text-xs">{getInitials(primaryAssignee.full_name)}</AvatarFallback>
              </Avatar>
              <div className="hidden sm:block">
                <p className="text-[10px] text-muted-foreground leading-none">Assigned to</p>
                <p className="text-xs font-medium leading-tight">{primaryAssignee.full_name}</p>
              </div>
            </div>
          )}

          <div className="ml-auto flex items-center gap-1">
            {task.project && (
              <span className="hidden md:inline text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                {task.project.name}
              </span>
            )}
          </div>
        </div>

        {/* ── Two-column layout ── */}
        <div className="flex h-[calc(100vh-49px)]">

          {/* ── Left panel (main content) ── */}
          <div className="flex-1 overflow-y-auto">
            <div className="max-w-3xl mx-auto px-6 py-6 space-y-6">

              {/* Title */}
              <div>
                {editingTitle ? (
                  <div className="space-y-2">
                    <Textarea
                      value={titleDraft}
                      onChange={(e) => setTitleDraft(e.target.value)}
                      className="text-2xl font-bold resize-none border-0 border-b rounded-none px-0 focus-visible:ring-0 focus-visible:border-primary"
                      rows={2}
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={saveTitle} disabled={savingTitle} className="gap-1.5 h-7">
                        <Check className="h-3 w-3" />{savingTitle ? 'Saving…' : 'Save'}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => { setEditingTitle(false); setTitleDraft(task.title) }} className="h-7">
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="group flex items-start gap-2">
                    <h1
                      className="text-2xl font-bold leading-snug flex-1 cursor-text"
                      onClick={() => canEdit && setEditingTitle(true)}
                    >
                      {task.title}
                    </h1>
                    {canEdit && (
                      <button
                        onClick={() => setEditingTitle(true)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity mt-1 p-1 rounded hover:bg-muted text-muted-foreground"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Description */}
              <div>
                {editingDescription ? (
                  <div className="space-y-2">
                    <Textarea
                      value={descriptionDraft}
                      onChange={(e) => setDescriptionDraft(e.target.value)}
                      placeholder="Add a description…"
                      rows={5}
                      className="resize-none text-sm"
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={saveDescription} disabled={savingDescription} className="gap-1.5 h-7">
                        <Check className="h-3 w-3" />{savingDescription ? 'Saving…' : 'Save'}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditingDescription(false)} className="h-7">
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div
                    className={cn(
                      'group text-sm leading-relaxed whitespace-pre-wrap rounded-md p-3 -mx-3 cursor-text hover:bg-muted/50 transition-colors',
                      !task.description && 'text-muted-foreground italic'
                    )}
                    onClick={() => canEdit && setEditingDescription(true)}
                  >
                    {task.description || (canEdit ? 'Click to add a description…' : 'No description provided.')}
                  </div>
                )}
              </div>

              <Separator />

              {/* Action buttons */}
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" className="gap-2 h-8 text-xs">
                  <Plus className="h-3.5 w-3.5" />
                  Add Checklist
                </Button>
                <Button variant="outline" size="sm" className="gap-2 h-8 text-xs">
                  <Paperclip className="h-3.5 w-3.5" />
                  Add Attachments
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 h-8 text-xs"
                  onClick={() => setShowTimeLogDialog(true)}
                >
                  <Clock className="h-3.5 w-3.5" />
                  Log Time
                </Button>
              </div>

              {/* Subtasks */}
              <div className="rounded-lg border bg-card p-4">
                <SubtaskList
                  parentTask={task}
                  subtasks={task.subtasks ?? []}
                  members={members}
                  profile={profile}
                  onSubtaskCreated={handleSubtaskCreated}
                  onSubtaskUpdated={handleSubtaskUpdated}
                />
              </div>

              {/* Activities / Comments / Time tabs */}
              <Tabs defaultValue="activity">
                <TabsList className="h-9 border-b w-full rounded-none bg-transparent p-0 justify-start gap-0">
                  <TabsTrigger
                    value="activity"
                    className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 text-sm"
                  >
                    Activities
                  </TabsTrigger>
                  <TabsTrigger
                    value="comments"
                    className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 text-sm"
                  >
                    Comments
                    {comments.length > 0 && (
                      <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-xs">{comments.length}</span>
                    )}
                  </TabsTrigger>
                  <TabsTrigger
                    value="time"
                    className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 text-sm"
                  >
                    Time Entries
                  </TabsTrigger>
                </TabsList>

                {/* Activity feed */}
                <TabsContent value="activity" className="mt-0 pt-4">
                  {/* Comment input box */}
                  <div className="mb-5">
                    <CommentSection
                      taskId={task.id}
                      comments={[]}
                      members={members}
                      profile={profile}
                      onCommentAdded={handleCommentAdded}
                      inputOnly
                    />
                  </div>

                  {activityLogs.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-10">No activity yet.</p>
                  ) : (
                    <div className="space-y-4">
                      {activityLogs.map((log) => (
                        <div key={log.id} className="flex items-start gap-3">
                          <Avatar className="h-7 w-7 mt-0.5 shrink-0">
                            <AvatarImage src={log.user?.avatar_url ?? undefined} />
                            <AvatarFallback className="text-xs">
                              {log.user ? getInitials(log.user.full_name) : '?'}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm">
                              <span className="font-medium text-primary">{log.user?.full_name ?? 'Unknown'}</span>{' '}
                              <span className="text-muted-foreground">
                                {formatActivityAction(log.action, log.old_value, log.new_value)}
                              </span>
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">{timeAgo(log.created_at)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>

                {/* Comments */}
                <TabsContent value="comments" className="mt-0 pt-4">
                  <CommentSection
                    taskId={task.id}
                    comments={comments}
                    members={members}
                    profile={profile}
                    onCommentAdded={handleCommentAdded}
                  />
                </TabsContent>

                {/* Time entries */}
                <TabsContent value="time" className="mt-0 pt-4">
                  <TimeEntriesList
                    timeEntries={timeEntries}
                    profile={profile}
                    onEntryUpdated={handleTimeEntryUpdated}
                    onEntryDeleted={handleTimeEntryDeleted}
                  />
                </TabsContent>
              </Tabs>
            </div>
          </div>

          {/* ── Right sidebar ── */}
          <div className="w-64 shrink-0 border-l bg-card overflow-y-auto">
            <div className="p-4 space-y-5">

              {/* Timer */}
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  {timerRunning && runningEntry ? (
                    <span className="flex h-2.5 w-2.5 relative">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
                    </span>
                  ) : (
                    <Circle className="h-2.5 w-2.5 text-muted-foreground" />
                  )}
                  <span className="text-2xl font-mono font-bold tabular-nums">
                    {timerRunning && runningEntry
                      ? <ElapsedTimer startedAt={runningEntry.started_at} />
                      : '00:00:00'
                    }
                  </span>
                </div>
                <button
                  onClick={timerRunning ? stopTimer : startTimer}
                  disabled={timerLoading}
                  className={cn(
                    'flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md transition-colors w-full justify-center',
                    timerRunning
                      ? 'bg-red-50 text-red-600 hover:bg-red-100 border border-red-200'
                      : 'bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20'
                  )}
                >
                  {timerRunning
                    ? <><Square className="h-3 w-3 fill-current" /> Stop Timer</>
                    : <><Play className="h-3 w-3 fill-current" /> Start Timer</>
                  }
                </button>
              </div>

              {/* Time log total */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Timer className="h-3.5 w-3.5" />
                  <span className="text-xs">Time Log</span>
                </div>
                <span className="text-xs font-medium">{formatHours(totalLoggedMinutes / 60)}</span>
              </div>

              <Separator />

              {/* Dates */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Start date</p>
                    <p className={cn('text-xs', task.start_date ? 'text-foreground' : 'text-muted-foreground')}>
                      {task.start_date ? formatDate(task.start_date) : 'Not set yet'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Due on</p>
                    <p className={cn('text-xs', task.due_date ? 'text-foreground font-medium' : 'text-muted-foreground')}>
                      {task.due_date ? formatDate(task.due_date) : 'Not set yet'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Estimated</p>
                    <p className={cn('text-xs', task.estimated_hours ? 'text-foreground' : 'text-muted-foreground')}>
                      {task.estimated_hours ? `${task.estimated_hours}h` : 'Not set yet'}
                    </p>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Priority */}
              <div className="flex items-center gap-2">
                <div className={cn(
                  'h-2 w-2 rounded-full shrink-0',
                  task.priority === 'urgent' && 'bg-red-500',
                  task.priority === 'high' && 'bg-orange-500',
                  task.priority === 'medium' && 'bg-yellow-500',
                  task.priority === 'low' && 'bg-blue-400',
                )} />
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Priority</p>
                  {canEdit ? (
                    <Select value={task.priority} onValueChange={handlePriorityChange}>
                      <SelectTrigger className="h-auto p-0 border-0 text-xs font-medium bg-transparent focus:ring-0 shadow-none">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PRIORITIES.map((p) => (
                          <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <p className="text-xs font-medium">{formatStatus(task.priority)}</p>
                  )}
                </div>
              </div>

              {/* Assignees */}
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-2">Assignees</p>
                {(task.assignees ?? []).length === 0 ? (
                  <p className="text-xs text-muted-foreground">Unassigned</p>
                ) : (
                  <div className="space-y-2">
                    {(task.assignees ?? []).map((assignee) => (
                      <div key={assignee.id} className="flex items-center gap-2">
                        <Avatar className="h-6 w-6 shrink-0">
                          <AvatarImage src={assignee.avatar_url ?? undefined} />
                          <AvatarFallback className="text-xs">{getInitials(assignee.full_name)}</AvatarFallback>
                        </Avatar>
                        <span className="text-xs truncate">{assignee.full_name}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <Separator />

              {/* About the Task */}
              <div>
                <div className="flex items-center gap-1.5 mb-3">
                  <Info className="h-3.5 w-3.5 text-muted-foreground" />
                  <p className="text-xs font-medium">About the Task</p>
                </div>
                <div className="space-y-2">
                  {task.project && (
                    <>
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Project</p>
                        <p className="text-xs font-medium truncate">{task.project.name}</p>
                      </div>
                    </>
                  )}
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Created</p>
                    <p className="text-xs text-muted-foreground">
                      {task.created_at
                        ? format(parseISO(task.created_at), 'dd MMM yyyy, hh:mm a')
                        : '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Task ID</p>
                    <p className="text-xs text-muted-foreground font-mono truncate">{task.id.slice(0, 8)}…</p>
                  </div>
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
