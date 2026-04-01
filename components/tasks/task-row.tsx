'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Task, Profile, TaskStatus } from '@/types'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useToast } from '@/components/ui/use-toast'
import { ChevronDown, ChevronRight, ExternalLink } from 'lucide-react'
import { TASK_STATUSES } from '@/lib/constants'
import {
  cn,
  formatDate,
  getInitials,
  getPriorityColor,
  getStatusColor,
  isOverdue,
  formatStatus,
} from '@/lib/utils'
import { SubtaskList } from './subtask-list'

interface TaskRowProps {
  task: Task
  profile: Profile
  onTaskUpdated: (task: Task) => void
  onClick?: () => void
  showProject?: boolean
  level?: number
}

export function TaskRow({
  task,
  profile,
  onTaskUpdated,
  onClick,
  showProject = false,
  level = 0,
}: TaskRowProps) {
  const { toast } = useToast()
  const supabase = createClient()
  const [expanded, setExpanded] = useState(false)
  const [updatingStatus, setUpdatingStatus] = useState(false)

  const hasSubtasks = (task.subtasks ?? []).length > 0
  const isDone = task.status === 'done'
  const overdue = !isDone && isOverdue(task.due_date)

  const isAdmin = profile.role === 'super_admin'
  const isCreator = task.created_by === profile.id
  const isAssignee = (task.assignees ?? []).some((a) => a.id === profile.id)
  const canEdit = isAdmin || isCreator || isAssignee

  async function handleCheckboxChange(checked: boolean) {
    const newStatus: TaskStatus = checked ? 'done' : 'todo'
    await handleStatusChange(newStatus)
  }

  async function handleStatusChange(newStatus: string) {
    if (!canEdit) return
    setUpdatingStatus(true)
    const oldStatus = task.status

    const updatedTask = { ...task, status: newStatus as TaskStatus }
    onTaskUpdated(updatedTask)

    const { error } = await supabase
      .from('tasks')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', task.id)

    setUpdatingStatus(false)

    if (error) {
      onTaskUpdated({ ...task, status: oldStatus })
      toast({ title: 'Error updating status', variant: 'destructive' })
      return
    }

    await supabase.from('activity_logs').insert({
      task_id: task.id,
      user_id: profile.id,
      action: 'status_changed',
      old_value: oldStatus,
      new_value: newStatus,
    })
  }

  return (
    <TooltipProvider>
      <div>
        <div
          className={cn(
            'flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors group',
            level > 0 && 'pl-8 border-t border-dashed',
            isDone && 'opacity-60'
          )}
        >
          {/* Expand button */}
          {hasSubtasks ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-5 w-5 p-0 shrink-0"
              onClick={(e) => {
                e.stopPropagation()
                setExpanded((v) => !v)
              }}
            >
              {expanded ? (
                <ChevronDown className="h-3.5 w-3.5" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5" />
              )}
            </Button>
          ) : (
            <div className="w-5 shrink-0" />
          )}

          {/* Checkbox */}
          <Checkbox
            checked={isDone}
            onCheckedChange={handleCheckboxChange}
            disabled={!canEdit || updatingStatus}
            className="shrink-0"
          />

          {/* Title + project */}
          <div
            className="flex-1 min-w-0 cursor-pointer"
            onClick={onClick}
          >
            <p
              className={cn(
                'text-sm font-medium truncate',
                isDone && 'line-through text-muted-foreground'
              )}
            >
              {task.title}
            </p>
            {showProject && task.project && (
              <p className="text-xs text-muted-foreground truncate mt-0.5">
                {task.project.name}
              </p>
            )}
          </div>

          {/* Priority badge */}
          <Badge
            className={cn(
              'hidden sm:flex border text-xs shrink-0',
              getPriorityColor(task.priority)
            )}
          >
            {formatStatus(task.priority)}
          </Badge>

          {/* Status select */}
          {canEdit ? (
            <div onClick={(e) => e.stopPropagation()}>
              <Select
                value={task.status}
                onValueChange={handleStatusChange}
                disabled={updatingStatus}
              >
                <SelectTrigger className="h-7 w-[110px] text-xs shrink-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TASK_STATUSES.map((s) => (
                    <SelectItem key={s.value} value={s.value} className="text-xs">
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <Badge className={cn('border text-xs shrink-0', getStatusColor(task.status))}>
              {formatStatus(task.status)}
            </Badge>
          )}

          {/* Due date */}
          <span
            className={cn(
              'hidden md:block text-xs shrink-0 w-24 text-right',
              overdue ? 'text-red-600 font-medium' : 'text-muted-foreground'
            )}
          >
            {task.due_date ? formatDate(task.due_date) : '—'}
          </span>

          {/* Assignee avatars */}
          <div className="hidden sm:flex -space-x-1.5 shrink-0">
            {(task.assignees ?? []).slice(0, 3).map((a) => (
              <Tooltip key={a.id}>
                <TooltipTrigger asChild>
                  <Avatar className="h-6 w-6 border-2 border-background">
                    <AvatarImage src={a.avatar_url ?? undefined} />
                    <AvatarFallback className="text-[10px]">
                      {getInitials(a.full_name)}
                    </AvatarFallback>
                  </Avatar>
                </TooltipTrigger>
                <TooltipContent>{a.full_name}</TooltipContent>
              </Tooltip>
            ))}
            {(task.assignees ?? []).length > 3 && (
              <Avatar className="h-6 w-6 border-2 border-background">
                <AvatarFallback className="text-[10px]">
                  +{(task.assignees ?? []).length - 3}
                </AvatarFallback>
              </Avatar>
            )}
          </div>

          {/* Navigate */}
          {onClick && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 shrink-0"
              onClick={(e) => {
                e.stopPropagation()
                onClick()
              }}
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>

        {/* Subtasks (expanded) */}
        {hasSubtasks && expanded && (
          <div className="border-t bg-muted/20">
            {(task.subtasks ?? []).map((subtask) => (
              <TaskRow
                key={subtask.id}
                task={subtask}
                profile={profile}
                onTaskUpdated={(updated) => {
                  const updatedParent = {
                    ...task,
                    subtasks: (task.subtasks ?? []).map((s) =>
                      s.id === updated.id ? updated : s
                    ),
                  }
                  onTaskUpdated(updatedParent)
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
