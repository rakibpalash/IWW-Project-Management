'use client'

import { useRouter } from 'next/navigation'
import { Project } from '@/types'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import {
  cn,
  formatDate,
  isOverdue,
  formatHours,
  getPriorityColor,
  getStatusColor,
  formatStatus,
} from '@/lib/utils'
import {
  Calendar,
  Building2,
  User,
  Clock,
  AlertTriangle,
} from 'lucide-react'

interface ProjectCardProps {
  project: Project
  listMode?: boolean
}

export function ProjectCard({ project, listMode = false }: ProjectCardProps) {
  const router = useRouter()
  const overdue =
    isOverdue(project.due_date) &&
    project.status !== 'completed' &&
    project.status !== 'cancelled'

  const actualHours = project.actual_hours ?? 0
  const estimatedHours = project.estimated_hours ?? null

  function handleClick() {
    router.push(`/projects/${project.id}`)
  }

  if (listMode) {
    return (
      <div
        onClick={handleClick}
        className={cn(
          'flex items-center gap-4 rounded-lg border bg-card px-4 py-3 cursor-pointer transition-colors hover:bg-muted/50',
          overdue && 'border-red-200 bg-red-50/30 dark:bg-red-950/10'
        )}
      >
        {/* Priority dot */}
        <div
          className={cn(
            'h-2.5 w-2.5 flex-shrink-0 rounded-full',
            project.priority === 'urgent' && 'bg-red-500',
            project.priority === 'high' && 'bg-orange-500',
            project.priority === 'medium' && 'bg-yellow-500',
            project.priority === 'low' && 'bg-green-500'
          )}
        />

        {/* Name */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium truncate">{project.name}</span>
            {overdue && (
              <AlertTriangle className="h-3.5 w-3.5 text-red-500 flex-shrink-0" />
            )}
          </div>
          {project.description && (
            <p className="text-xs text-muted-foreground truncate mt-0.5">
              {project.description}
            </p>
          )}
        </div>

        {/* Status */}
        <Badge
          className={cn('hidden sm:inline-flex flex-shrink-0', getStatusColor(project.status))}
          variant="outline"
        >
          {formatStatus(project.status)}
        </Badge>

        {/* Priority */}
        <Badge
          className={cn('hidden md:inline-flex flex-shrink-0', getPriorityColor(project.priority))}
          variant="outline"
        >
          {formatStatus(project.priority)}
        </Badge>

        {/* Progress */}
        <div className="hidden lg:flex items-center gap-2 w-24 flex-shrink-0">
          <Progress value={project.progress} className="h-1.5 flex-1" />
          <span className="text-xs text-muted-foreground w-7 text-right">
            {project.progress}%
          </span>
        </div>

        {/* Workspace */}
        {project.workspace && (
          <div className="hidden xl:flex items-center gap-1 text-xs text-muted-foreground flex-shrink-0 max-w-[120px]">
            <Building2 className="h-3 w-3 flex-shrink-0" />
            <span className="truncate">{project.workspace.name}</span>
          </div>
        )}

        {/* Due date */}
        <div
          className={cn(
            'hidden sm:flex items-center gap-1 text-xs flex-shrink-0',
            overdue ? 'text-red-600 font-medium' : 'text-muted-foreground'
          )}
        >
          <Calendar className="h-3 w-3" />
          {formatDate(project.due_date)}
        </div>
      </div>
    )
  }

  // Grid card mode
  return (
    <Card
      onClick={handleClick}
      className={cn(
        'cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5',
        overdue && 'border-red-300 dark:border-red-800'
      )}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-1">
              {overdue && (
                <AlertTriangle className="h-3.5 w-3.5 text-red-500 flex-shrink-0" />
              )}
              <h3 className="font-semibold text-sm leading-tight line-clamp-2">
                {project.name}
              </h3>
            </div>
            {project.description && (
              <p className="text-xs text-muted-foreground line-clamp-2">
                {project.description}
              </p>
            )}
          </div>
        </div>

        {/* Badges row */}
        <div className="flex flex-wrap gap-1.5 mt-2">
          <Badge
            className={cn('text-xs', getStatusColor(project.status))}
            variant="outline"
          >
            {formatStatus(project.status)}
          </Badge>
          <Badge
            className={cn('text-xs', getPriorityColor(project.priority))}
            variant="outline"
          >
            {formatStatus(project.priority)}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-3 pt-0">
        {/* Progress bar */}
        <div>
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
            <span>Progress</span>
            <span className="font-medium">{project.progress}%</span>
          </div>
          <Progress
            value={project.progress}
            className={cn(
              'h-2',
              project.progress >= 100
                ? '[&>div]:bg-green-500'
                : project.progress >= 80
                ? '[&>div]:bg-orange-500'
                : ''
            )}
          />
        </div>

        {/* Due date */}
        <div className="flex items-center gap-1.5">
          <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
          <span
            className={cn(
              'text-xs',
              overdue ? 'text-red-600 font-semibold' : 'text-muted-foreground'
            )}
          >
            {project.due_date ? (
              <>
                Due {formatDate(project.due_date)}
                {overdue && ' — Overdue'}
              </>
            ) : (
              'No due date'
            )}
          </span>
        </div>

        {/* Client */}
        {project.client && (
          <div className="flex items-center gap-1.5">
            <User className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground truncate">
              {project.client.full_name}
            </span>
          </div>
        )}

        {/* Workspace */}
        {project.workspace && (
          <div className="flex items-center gap-1.5">
            <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground truncate">
              {project.workspace.name}
            </span>
          </div>
        )}

        {/* Time tracking */}
        {(estimatedHours !== null || actualHours > 0) && (
          <div className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">
              {formatHours(actualHours)} actual
              {estimatedHours !== null && (
                <> / {formatHours(estimatedHours)} est.</>
              )}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
