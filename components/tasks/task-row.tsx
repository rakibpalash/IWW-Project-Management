'use client'

import { useState, useRef, useEffect } from 'react'
import { Task, Profile, TaskStatus } from '@/types'
import { updateTaskStatusAction } from '@/app/actions/tasks'
import { createClient } from '@/lib/supabase/client'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useToast } from '@/components/ui/use-toast'
import { ChevronDown, ChevronRight, ExternalLink, Flag, AlertCircle, Plus, ListTree } from 'lucide-react'
import { useTaskConfig } from '@/hooks/use-task-config'
import { cn, formatDate, getInitials, isOverdue } from '@/lib/utils'

export type VisibleColsRow = {
  assignee:  boolean
  dueDate:   boolean
  size:      boolean
  priority:  boolean
}

interface TaskRowProps {
  task: Task
  profile: Profile
  onTaskUpdated: (task: Task) => void
  onClick?: () => void
  showList?: boolean
  level?: number
  // Bulk selection
  selected?: boolean
  onSelect?: (id: string, checked: boolean) => void
  visibleCols?: VisibleColsRow
}

const PRIORITY_COLOR: Record<string, string> = {
  urgent: '#ef4444',
  high:   '#f97316',
  medium: '#eab308',
  low:    '#3b82f6',
}

export function TaskRow({
  task,
  profile,
  onTaskUpdated,
  onClick,
  showList = false,
  level = 0,
  selected = false,
  onSelect,
  visibleCols,
}: TaskRowProps) {
  const cols = visibleCols ?? { assignee: true, dueDate: true, size: true, priority: true }
  const { toast } = useToast()
  const { statuses, getStatus, getPriority, defaultPriority } = useTaskConfig()
  const [expanded, setExpanded] = useState(false)
  const [updatingStatus, setUpdatingStatus] = useState(false)

  // Inline subtask creation
  const [addingSubtask, setAddingSubtask] = useState(false)
  const [newSubtaskName, setNewSubtaskName] = useState('')
  const [savingSubtask, setSavingSubtask] = useState(false)
  const subtaskInputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  useEffect(() => {
    if (addingSubtask) setTimeout(() => subtaskInputRef.current?.focus(), 30)
  }, [addingSubtask])

  async function submitSubtask() {
    const title = newSubtaskName.trim()
    if (!title) { setAddingSubtask(false); setNewSubtaskName(''); return }
    setSavingSubtask(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data, error } = await supabase.from('tasks').insert({
        title,
        list_id:        task.list_id,
        parent_task_id: task.id,
        status:         'todo',
        priority:       defaultPriority || 'medium',
        created_by:     user.id,
      }).select('*, assignees:task_assignees(user:profiles(*)), subtasks:tasks!parent_task_id(*)').single()
      if (error) { toast({ title: 'Failed to create subtask', description: error.message, variant: 'destructive' }); return }
      onTaskUpdated({ ...task, subtasks: [...(task.subtasks ?? []), data as Task] })
      setNewSubtaskName('')
      setExpanded(true)
      subtaskInputRef.current?.focus()
    } finally { setSavingSubtask(false) }
  }

  const hasSubtasks = (task.subtasks ?? []).length > 0
  const statusCfg   = getStatus(task.status)
  const priorityCfg = getPriority(task.priority)
  const isDone      = statusCfg?.is_completed_status ?? task.status === 'done'
  const overdue     = !isDone && isOverdue(task.due_date)

  const doneSlug    = statuses.find((s) => s.is_completed_status && s.slug === 'done')?.slug
                   ?? statuses.find((s) => s.is_completed_status)?.slug
                   ?? 'done'
  const defaultSlug = statuses.find((s) => s.is_default)?.slug ?? 'todo'

  const isAdmin    = profile.role === 'super_admin'
  const isCreator  = task.created_by === profile.id
  const isAssignee = (task.assignees ?? []).some((a) => a.id === profile.id)
  const canEdit    = isAdmin || isCreator || isAssignee

  const doneCount  = (task.subtasks ?? []).filter((s) => s.status === 'done').length
  const totalSubs  = (task.subtasks ?? []).length

  async function handleStatusChange(newStatus: string) {
    if (!canEdit) return
    setUpdatingStatus(true)
    const oldStatus = task.status
    onTaskUpdated({ ...task, status: newStatus as TaskStatus })
    const result = await updateTaskStatusAction(task.id, newStatus)
    setUpdatingStatus(false)
    if (!result.success) {
      onTaskUpdated({ ...task, status: oldStatus })
      toast({ title: 'Error updating status', description: result.error, variant: 'destructive' })
    }
  }

  const paddingLeft = 12 + level * 20

  return (
    <TooltipProvider>
      <div>
        {/* ── Row ────────────────────────────────────────────────────────── */}
        <div
          className={cn(
            'flex items-center border-b border-border/40 bg-white dark:bg-zinc-900 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors group',
            'min-h-[36px]',
            isDone && 'opacity-60',
            selected && 'bg-blue-50 dark:bg-blue-950/30 hover:bg-blue-50 dark:hover:bg-blue-950/30',
          )}
          style={{ paddingLeft }}
        >
          {/* Checkbox + expand toggle */}
          <div className="w-7 shrink-0 flex items-center justify-center">
            {onSelect ? (
              <input
                type="checkbox"
                checked={selected}
                onChange={(e) => { e.stopPropagation(); onSelect(task.id, e.target.checked) }}
                onClick={(e) => e.stopPropagation()}
                className="h-3.5 w-3.5 cursor-pointer accent-primary rounded"
              />
            ) : hasSubtasks ? (
              <button
                className="h-5 w-5 flex items-center justify-center rounded hover:bg-muted text-muted-foreground"
                onClick={(e) => { e.stopPropagation(); setExpanded((v) => !v) }}
              >
                {expanded
                  ? <ChevronDown className="h-3.5 w-3.5" />
                  : <ChevronRight className="h-3.5 w-3.5" />}
              </button>
            ) : null}
          </div>

          {/* Status circle — click to change */}
          <div className="w-6 shrink-0 flex items-center justify-center">
            {canEdit ? (
              <div onClick={(e) => e.stopPropagation()}>
                <Select
                  value={task.status}
                  onValueChange={handleStatusChange}
                  disabled={updatingStatus}
                >
                  <SelectTrigger className="h-auto w-auto border-0 p-0 shadow-none bg-transparent focus:ring-0 focus:ring-offset-0 [&>svg]:hidden">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div
                          className="h-3.5 w-3.5 rounded-full border-2 cursor-pointer hover:opacity-80 transition-opacity"
                          style={{
                            borderColor: statusCfg?.color ?? '#94a3b8',
                            backgroundColor: isDone ? (statusCfg?.color ?? '#94a3b8') : 'transparent',
                          }}
                        />
                      </TooltipTrigger>
                      <TooltipContent side="right" className="text-xs">
                        {statusCfg?.name ?? task.status}
                      </TooltipContent>
                    </Tooltip>
                  </SelectTrigger>
                  <SelectContent>
                    {statuses.map((s) => (
                      <SelectItem key={s.slug} value={s.slug} className="text-xs">
                        <div className="flex items-center gap-2">
                          <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                          {s.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div
                className="h-3.5 w-3.5 rounded-full border-2"
                style={{
                  borderColor: statusCfg?.color ?? '#94a3b8',
                  backgroundColor: isDone ? (statusCfg?.color ?? '#94a3b8') : 'transparent',
                }}
              />
            )}
          </div>

          {/* Task name */}
          <div
            className="flex-1 min-w-0 px-2 flex items-center gap-2 cursor-pointer h-full py-2"
            onClick={onClick}
          >
            <span
              className={cn(
                'text-sm truncate leading-none',
                isDone && 'line-through text-muted-foreground',
              )}
            >
              {task.title}
            </span>
            {showList && task.list && (
              <span className="text-xs text-muted-foreground/50 truncate shrink-0 hidden sm:inline">
                · {task.list.name}
              </span>
            )}
            {hasSubtasks && (
              <span className="text-[10px] text-muted-foreground/50 shrink-0 tabular-nums">
                {doneCount}/{totalSubs}
              </span>
            )}
            {overdue && (
              <AlertCircle className="h-3 w-3 text-red-500 shrink-0" />
            )}
            {/* Hover actions */}
            <div className="ml-auto flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" onClick={e => e.stopPropagation()}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => { setNewSubtaskName(''); setAddingSubtask(true) }}
                    className="h-6 w-6 flex items-center justify-center rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs font-medium">Add subtask</TooltipContent>
              </Tooltip>
            </div>
          </div>

          {/* Assignees */}
          {cols.assignee && (
            <div className="w-[80px] shrink-0 flex items-center px-1">
              <div className="flex -space-x-1">
                {(task.assignees ?? []).slice(0, 3).map((a) => (
                  <Tooltip key={a.id}>
                    <TooltipTrigger asChild>
                      <Avatar className="h-5 w-5 border border-background ring-0">
                        <AvatarImage src={a.avatar_url ?? undefined} />
                        <AvatarFallback className="text-[8px] font-medium">
                          {getInitials(a.full_name)}
                        </AvatarFallback>
                      </Avatar>
                    </TooltipTrigger>
                    <TooltipContent className="text-xs">{a.full_name}</TooltipContent>
                  </Tooltip>
                ))}
                {(task.assignees ?? []).length > 3 && (
                  <Avatar className="h-5 w-5 border border-background">
                    <AvatarFallback className="text-[8px]">
                      +{(task.assignees ?? []).length - 3}
                    </AvatarFallback>
                  </Avatar>
                )}
              </div>
            </div>
          )}

          {/* Due date */}
          {cols.dueDate && (
            <div className="w-[90px] shrink-0 flex items-center px-1">
              <span className={cn(
                'text-xs',
                overdue ? 'text-red-500 font-medium' : task.due_date ? 'text-muted-foreground' : 'text-muted-foreground/30',
              )}>
                {task.due_date ? formatDate(task.due_date) : '—'}
              </span>
            </div>
          )}

          {/* Size (estimated hours) */}
          {cols.size && (
            <div className="w-[70px] shrink-0 flex items-center px-1">
              <span className="text-xs text-muted-foreground tabular-nums">
                {task.estimated_hours ? `${task.estimated_hours}h` : '—'}
              </span>
            </div>
          )}

          {/* Priority */}
          {cols.priority && (
            <div className="w-[90px] shrink-0 flex items-center px-1">
              <span
                className="text-xs font-medium flex items-center gap-1"
                style={{ color: PRIORITY_COLOR[task.priority] ?? '#94a3b8' }}
              >
                <Flag className="h-3 w-3 shrink-0" />
                <span className="truncate">{priorityCfg?.name ?? task.priority}</span>
              </span>
            </div>
          )}

          {/* Open button */}
          <div className="w-8 shrink-0 flex items-center justify-center opacity-0 group-hover:opacity-100">
            {onClick && (
              <button
                className="h-5 w-5 flex items-center justify-center rounded hover:bg-muted text-muted-foreground"
                onClick={(e) => { e.stopPropagation(); onClick() }}
                title="Open task"
              >
                <ExternalLink className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>

        {/* ── Inline subtask input ────────────────────────────────────────── */}
        {addingSubtask && (
          <div
            className="flex items-center border-b border-border/40 bg-muted/5 min-h-[36px]"
            style={{ paddingLeft: paddingLeft + 20 }}
          >
            <div className="w-7 shrink-0" />
            <div className="w-6 shrink-0 flex items-center justify-center">
              <div className="h-3.5 w-3.5 rounded-full border-2 border-dashed border-muted-foreground/40" />
            </div>
            <input
              ref={subtaskInputRef}
              value={newSubtaskName}
              onChange={e => setNewSubtaskName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') { e.preventDefault(); submitSubtask() }
                if (e.key === 'Escape') { setAddingSubtask(false); setNewSubtaskName('') }
              }}
              placeholder="Task Name or type '/' for commands..."
              disabled={savingSubtask}
              className="flex-1 min-w-0 bg-transparent text-sm px-2 py-2 outline-none placeholder:text-muted-foreground/40"
            />
            <div className="flex items-center gap-1 pr-2 shrink-0">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    className="h-6 w-6 flex items-center justify-center rounded hover:bg-muted text-muted-foreground/50"
                    onClick={() => { setAddingSubtask(false); setNewSubtaskName('') }}
                  >
                    <ListTree className="h-3.5 w-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">Cancel</TooltipContent>
              </Tooltip>
            </div>
          </div>
        )}

        {/* ── Subtasks ───────────────────────────────────────────────────── */}
        {hasSubtasks && expanded && (
          <div className="border-l-2 border-border/40 ml-[19px]">
            {(task.subtasks ?? []).map((subtask) => (
              <TaskRow
                key={subtask.id}
                task={subtask}
                profile={profile}
                onTaskUpdated={(updated) => {
                  onTaskUpdated({
                    ...task,
                    subtasks: (task.subtasks ?? []).map((s) =>
                      s.id === updated.id ? updated : s
                    ),
                  })
                }}
                level={level + 1}
              />
            ))}
          </div>
        )}
      </div>
    </TooltipProvider>
  )
}
