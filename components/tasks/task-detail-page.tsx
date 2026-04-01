'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Task, Profile, Comment, TimeEntry, ActivityLog, TaskStatus, Priority } from '@/types'
import { SubtaskList } from './subtask-list'
import { CommentSection } from './comment-section'
import { TimerButton } from '@/components/time-tracking/timer-button'
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
  Users,
  Activity,
  MessageSquare,
  Timer,
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

  const [editingDescription, setEditingDescription] = useState(false)
  const [descriptionDraft, setDescriptionDraft] = useState(task.description ?? '')
  const [savingDescription, setSavingDescription] = useState(false)

  const [showTimeLogDialog, setShowTimeLogDialog] = useState(false)

  const isAdmin = profile.role === 'super_admin'
  const isCreator = task.created_by === profile.id
  const isAssignee = (task.assignees ?? []).some((a) => a.id === profile.id)
  const canEdit = isAdmin || isCreator || isAssignee

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
    const oldStatus = task.status
    setTask((prev) => ({ ...prev, status: newStatus as TaskStatus }))

    const { error } = await supabase
      .from('tasks')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', task.id)

    if (error) {
      setTask((prev) => ({ ...prev, status: oldStatus }))
      toast({ title: 'Error updating status', variant: 'destructive' })
      return
    }

    await logActivity('status_changed', oldStatus, newStatus)
    toast({ title: 'Status updated' })
  }

  async function handlePriorityChange(newPriority: string) {
    const oldPriority = task.priority
    setTask((prev) => ({ ...prev, priority: newPriority as Priority }))

    const { error } = await supabase
      .from('tasks')
      .update({ priority: newPriority, updated_at: new Date().toISOString() })
      .eq('id', task.id)

    if (error) {
      setTask((prev) => ({ ...prev, priority: oldPriority }))
      toast({ title: 'Error updating priority', variant: 'destructive' })
      return
    }

    await logActivity('priority_changed', oldPriority, newPriority)
    toast({ title: 'Priority updated' })
  }

  async function saveDescription() {
    setSavingDescription(true)
    const oldDesc = task.description

    const { error } = await supabase
      .from('tasks')
      .update({ description: descriptionDraft, updated_at: new Date().toISOString() })
      .eq('id', task.id)

    setSavingDescription(false)

    if (error) {
      toast({ title: 'Error saving description', variant: 'destructive' })
      return
    }

    setTask((prev) => ({ ...prev, description: descriptionDraft }))
    setEditingDescription(false)
    await logActivity('description_updated', oldDesc, descriptionDraft)
    toast({ title: 'Description saved' })
  }

  function handleSubtaskCreated(subtask: Task) {
    setTask((prev) => ({
      ...prev,
      subtasks: [...(prev.subtasks ?? []), subtask],
    }))
  }

  function handleSubtaskUpdated(updated: Task) {
    setTask((prev) => ({
      ...prev,
      subtasks: (prev.subtasks ?? []).map((s) => (s.id === updated.id ? updated : s)),
    }))
  }

  function handleCommentAdded(comment: Comment) {
    setComments((prev) => [...prev, comment])
  }

  function handleTimeEntryAdded(entry: TimeEntry) {
    setTimeEntries((prev) => [entry, ...prev])
  }

  function handleTimeEntryUpdated(entry: TimeEntry) {
    setTimeEntries((prev) => prev.map((e) => (e.id === entry.id ? entry : e)))
  }

  function handleTimeEntryDeleted(id: string) {
    setTimeEntries((prev) => prev.filter((e) => e.id !== id))
  }

  const totalLoggedMinutes = timeEntries
    .filter((e) => e.duration_minutes !== null && !e.is_running)
    .reduce((sum, e) => sum + (e.duration_minutes ?? 0), 0)

  return (
    <TooltipProvider>
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Back button */}
        <Button
          variant="ghost"
          size="sm"
          className="gap-2"
          onClick={() => router.push(`/projects/${task.project_id}`)}
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Project
        </Button>

        {/* Header */}
        <div className="rounded-lg border bg-card p-6 space-y-4">
          {/* Project badge */}
          {task.project && (
            <div className="text-xs text-muted-foreground font-medium">
              {task.project.name}
            </div>
          )}

          {/* Title */}
          <h1 className="text-2xl font-bold leading-tight">{task.title}</h1>

          {/* Status + Priority row */}
          <div className="flex flex-wrap items-center gap-3">
            {canEdit ? (
              <>
                <Select value={task.status} onValueChange={handleStatusChange}>
                  <SelectTrigger className="w-[140px] h-8 text-sm">
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

                <Select value={task.priority} onValueChange={handlePriorityChange}>
                  <SelectTrigger className="w-[120px] h-8 text-sm">
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
              </>
            ) : (
              <>
                <Badge className={cn('border text-xs', getStatusColor(task.status))}>
                  {formatStatus(task.status)}
                </Badge>
                <Badge className={cn('border text-xs', getPriorityColor(task.priority))}>
                  {formatStatus(task.priority)}
                </Badge>
              </>
            )}

            {/* Timer button */}
            <div className="ml-auto">
              <TimerButton
                taskId={task.id}
                profile={profile}
                onEntryCreated={handleTimeEntryAdded}
                onEntryUpdated={handleTimeEntryUpdated}
              />
            </div>
          </div>

          {/* Metadata grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2 border-t">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Start Date</p>
              <div className="flex items-center gap-1.5 text-sm">
                <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                {task.start_date ? formatDate(task.start_date) : '—'}
              </div>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Due Date</p>
              <div className="flex items-center gap-1.5 text-sm">
                <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                {task.due_date ? formatDate(task.due_date) : '—'}
              </div>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Estimated</p>
              <div className="flex items-center gap-1.5 text-sm">
                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                {task.estimated_hours ? `${task.estimated_hours}h` : '—'}
              </div>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Logged</p>
              <div className="flex items-center gap-1.5 text-sm">
                <Timer className="h-3.5 w-3.5 text-muted-foreground" />
                {formatHours(totalLoggedMinutes / 60)}
              </div>
            </div>
          </div>

          {/* Assignees */}
          <div>
            <p className="text-xs text-muted-foreground mb-2">Assignees</p>
            <div className="flex items-center gap-2">
              {(task.assignees ?? []).length === 0 ? (
                <span className="text-sm text-muted-foreground">Unassigned</span>
              ) : (
                <div className="flex -space-x-2">
                  {(task.assignees ?? []).map((assignee) => (
                    <Tooltip key={assignee.id}>
                      <TooltipTrigger asChild>
                        <Avatar className="h-8 w-8 border-2 border-background ring-1 ring-border">
                          <AvatarImage src={assignee.avatar_url ?? undefined} />
                          <AvatarFallback className="text-xs">
                            {getInitials(assignee.full_name)}
                          </AvatarFallback>
                        </Avatar>
                      </TooltipTrigger>
                      <TooltipContent>{assignee.full_name}</TooltipContent>
                    </Tooltip>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Description */}
        <div className="rounded-lg border bg-card p-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold">Description</h2>
            {canEdit && !editingDescription && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1.5 text-xs"
                onClick={() => {
                  setDescriptionDraft(task.description ?? '')
                  setEditingDescription(true)
                }}
              >
                <Edit3 className="h-3.5 w-3.5" />
                Edit
              </Button>
            )}
          </div>

          {editingDescription ? (
            <div className="space-y-3">
              <Textarea
                value={descriptionDraft}
                onChange={(e) => setDescriptionDraft(e.target.value)}
                placeholder="Add a description…"
                rows={6}
                className="resize-none"
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={saveDescription}
                  disabled={savingDescription}
                  className="gap-1.5"
                >
                  <Check className="h-3.5 w-3.5" />
                  {savingDescription ? 'Saving…' : 'Save'}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setEditingDescription(false)}
                  className="gap-1.5"
                >
                  <X className="h-3.5 w-3.5" />
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div
              className={cn(
                'text-sm leading-relaxed whitespace-pre-wrap',
                !task.description && 'text-muted-foreground italic'
              )}
            >
              {task.description || 'No description provided.'}
            </div>
          )}
        </div>

        {/* Subtasks */}
        <div className="rounded-lg border bg-card p-6">
          <SubtaskList
            parentTask={task}
            subtasks={task.subtasks ?? []}
            members={members}
            profile={profile}
            onSubtaskCreated={handleSubtaskCreated}
            onSubtaskUpdated={handleSubtaskUpdated}
          />
        </div>

        {/* Tabs: Time / Comments / Activity */}
        <Tabs defaultValue="time">
          <TabsList className="w-full sm:w-auto">
            <TabsTrigger value="time" className="gap-2">
              <Timer className="h-4 w-4" />
              Time
            </TabsTrigger>
            <TabsTrigger value="comments" className="gap-2">
              <MessageSquare className="h-4 w-4" />
              Comments
              {comments.length > 0 && (
                <Badge variant="secondary" className="ml-1 text-xs px-1.5">
                  {comments.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="activity" className="gap-2">
              <Activity className="h-4 w-4" />
              Activity
            </TabsTrigger>
          </TabsList>

          {/* Time tracking tab */}
          <TabsContent value="time" className="mt-4">
            <div className="rounded-lg border bg-card p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold">Time Entries</h2>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => setShowTimeLogDialog(true)}
                >
                  <Plus className="h-4 w-4" />
                  Log Time
                </Button>
              </div>
              <TimeEntriesList
                timeEntries={timeEntries}
                profile={profile}
                onEntryUpdated={handleTimeEntryUpdated}
                onEntryDeleted={handleTimeEntryDeleted}
              />
            </div>
          </TabsContent>

          {/* Comments tab */}
          <TabsContent value="comments" className="mt-4">
            <div className="rounded-lg border bg-card p-6">
              <CommentSection
                taskId={task.id}
                comments={comments}
                members={members}
                profile={profile}
                onCommentAdded={handleCommentAdded}
              />
            </div>
          </TabsContent>

          {/* Activity tab */}
          <TabsContent value="activity" className="mt-4">
            <div className="rounded-lg border bg-card p-6 space-y-4">
              <h2 className="text-sm font-semibold">Activity Log</h2>
              {activityLogs.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No activity recorded yet.
                </p>
              ) : (
                <div className="space-y-3">
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
                          <span className="font-medium">{log.user?.full_name ?? 'Unknown'}</span>{' '}
                          <span className="text-muted-foreground">
                            {formatActivityAction(log.action, log.old_value, log.new_value)}
                          </span>
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {timeAgo(log.created_at)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>

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
  newValue: string | null
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
