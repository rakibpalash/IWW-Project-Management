'use client'

import { useState } from 'react'
import { Task, Profile, TaskStatus } from '@/types'
import { updateTaskStatusAction } from '@/app/actions/tasks'
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
import { useTaskConfig } from '@/hooks/use-task-config'
import {
  cn,
  formatDate,
  getInitials,
  isOverdue,
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
  const { statuses, priorities, getStatus, getPriority } = useTaskConfig()
  const [expanded, setExpanded] = useState(false)
  const [updatingStatus, setUpdatingStatus] = useState(false)

  const hasSubtasks = (task.subtasks ?? []).length > 0
  const statusCfg = getStatus(task.status)
  const priorityCfg = getPriority(task.priority)
  const isDone = statusCfg?.is_completed_status ?? task.status === 'done'
  const overdue = !isDone && isOverdue(task.due_date)
  // Slug for "done" state when checking off
  const doneSlug = statuses.find((s) => s.is_completed_status && s.slug === 'done')?.slug ?? statuses.find((s) => s.is_completed_status)?.slug ?? 'done'
  const defaultSlug = statuses.find((s) => s.is_default)?.slug ?? 'todo'

  const isAdmin = profile.role === 'super_admin'
  const isCreator = task.created_by === profile.id
  const isAssignee = (task.assignees ?? []).some((a) => a.id === profile.id)
  const canEdit = isAdmin || isCreator || isAssignee

  async function handleCheckboxChange(checked: boolean) {
    await handleStatusChange(checked ? doneSlug : defaultSlug)
  }

  async function handleStatusChange(newStatus: string) {
    if (!canEdit) return
    setUpdatingStatus(true)
    const oldStatus = task.status

    // Optimistic update
    onTaskUpdated({ ...task, status: newStatus as TaskStatus })

    const result = await updateTaskStatusAction(task.id, newStatus)

    setUpdatingStatus(false)

    if (!result.success) {
      // Revert optimistic update
      onTaskUpdated({ ...task, status: oldStatus })
      toast({
        title: 'Error updating status',
        description: result.error,
        variant: 'destructive',
      })
    }
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
          <span
            className="hidden sm:inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium shrink-0"
            style={{
              backgroundColor: (priorityCfg?.color ?? '#f59e0b') + '20',
              color: priorityCfg?.color ?? '#f59e0b',
              borderColor: (priorityCfg?.color ?? '#f59e0b') + '40',
            }}
          >
            {priorityCfg?.name ?? task.priority}
          </span>

          {/* Status select */}
          {canEdit ? (
            <div onClick={(e) => e.stopPropagation()}>
              <Select
                value={task.status}
                onValueChange={handleStatusChange}
                disabled={updatingStatus}
              >
                <SelectTrigger className="h-7 w-[120px] text-xs shrink-0">
                  <div className="flex items-center gap-1.5">
                    <div
                      className="h-2 w-2 rounded-full shrink-0"
                      style={{ backgroundColor: statusCfg?.color ?? '#94a3b8' }}
                    />
                    <span className="truncate">{statusCfg?.name ?? task.status}</span>
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
            </div>
          ) : (
            <span
              className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium shrink-0"
              style={{
                backgroundColor: (statusCfg?.color ?? '#94a3b8') + '20',
                color: statusCfg?.color ?? '#94a3b8',
                borderColor: (statusCfg?.color ?? '#94a3b8') + '40',
              }}
            >
              {statusCfg?.name ?? task.status}
            </span>
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
