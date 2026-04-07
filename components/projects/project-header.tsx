'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Project, Profile } from '@/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { EditProjectDialog } from './edit-project-dialog'
import { TimeSummary } from './time-summary'
import { SmartDeleteDialog } from '@/components/ui/smart-delete-dialog'
import {
  cn,
  formatDate,
  isOverdue,
  getPriorityColor,
  getStatusColor,
  formatStatus,
} from '@/lib/utils'
import { Calendar, Pencil, AlertTriangle, Building2, User, Trash2, Copy } from 'lucide-react'
import { deleteProjectAction, cloneProjectAction } from '@/app/actions/projects'
import { getProjectDeleteImpact } from '@/app/actions/delete-impact'
import { useToast } from '@/components/ui/use-toast'

interface ProjectHeaderProps {
  project: Project
  profile: Profile
  onProjectUpdated?: (updated: Project) => void
}

export function ProjectHeader({ project, profile, onProjectUpdated }: ProjectHeaderProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [isCloning, setIsCloning] = useState(false)
  const isAdmin = profile.role === 'super_admin'

  async function handleClone() {
    setIsCloning(true)
    const result = await cloneProjectAction(project.id)
    setIsCloning(false)
    if (result.success) {
      toast({ title: 'Project cloned', description: `"${result.project?.name}" created` })
      router.push(`/projects/${result.project?.id}`)
    } else {
      toast({ title: 'Failed to clone', description: result.error, variant: 'destructive' })
    }
  }

  const overdue =
    isOverdue(project.due_date) &&
    project.status !== 'completed' &&
    project.status !== 'cancelled'

  return (
    <div className="space-y-4">
      {/* Title row */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2 flex-1 min-w-0">
          {/* Breadcrumb-style workspace */}
          {project.workspace && (
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Building2 className="h-3.5 w-3.5" />
              <span>{project.workspace.name}</span>
            </div>
          )}

          {/* Project name */}
          <div className="flex items-start gap-2 flex-wrap">
            <h1 className="text-2xl font-bold tracking-tight leading-tight">
              {project.name}
            </h1>
            {overdue && (
              <div className="flex items-center gap-1 text-red-600 mt-1">
                <AlertTriangle className="h-4 w-4" />
                <span className="text-sm font-medium">Overdue</span>
              </div>
            )}
          </div>

          {/* Badges */}
          <div className="flex flex-wrap items-center gap-2">
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
              {formatStatus(project.priority)} priority
            </Badge>

            {/* Due date */}
            {project.due_date && (
              <div
                className={cn(
                  'flex items-center gap-1 text-xs',
                  overdue ? 'text-red-600 font-semibold' : 'text-muted-foreground'
                )}
              >
                <Calendar className="h-3.5 w-3.5" />
                Due {formatDate(project.due_date)}
              </div>
            )}

            {/* Client */}
            {project.client && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <User className="h-3.5 w-3.5" />
                {project.client.full_name}
              </div>
            )}
          </div>
        </div>

        {/* Admin actions */}
        {isAdmin && (
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowEditDialog(true)}
            >
              <Pencil className="h-4 w-4 mr-2" />
              Edit
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleClone}
              disabled={isCloning}
            >
              <Copy className="h-4 w-4 mr-2" />
              {isCloning ? 'Cloning…' : 'Clone'}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowDeleteDialog(true)}
              className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      {/* Progress bar */}
      <div>
        <div className="flex items-center justify-between text-sm mb-1.5">
          <span className="text-muted-foreground">Overall Progress</span>
          <span className="font-semibold">{project.progress}%</span>
        </div>
        <Progress
          value={project.progress}
          className={cn(
            'h-3',
            project.progress >= 100
              ? '[&>div]:bg-green-500'
              : project.progress >= 80
              ? '[&>div]:bg-orange-500'
              : ''
          )}
        />
      </div>

      {/* Time summary */}
      <TimeSummary
        estimatedHours={project.estimated_hours}
        actualHours={project.actual_hours ?? 0}
        showProgressBar
      />

      {/* Description */}
      {project.description && (
        <p className="text-sm text-muted-foreground leading-relaxed">
          {project.description}
        </p>
      )}

      {/* Edit dialog */}
      {showEditDialog && (
        <EditProjectDialog
          open={showEditDialog}
          onOpenChange={setShowEditDialog}
          project={project}
          onUpdated={(updated) => {
            setShowEditDialog(false)
            onProjectUpdated?.(updated)
          }}
        />
      )}

      {/* Smart Delete Dialog */}
      <SmartDeleteDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        entityType="project"
        entityName={project.name}
        entityId={project.id}
        onFetchImpact={() => getProjectDeleteImpact(project.id)}
        onConfirmDelete={async (opts) => {
          const result = await deleteProjectAction(project.id, { moveTasksToProjectId: opts.moveTasksToProjectId })
          if (!result.success) {
            toast({ title: 'Delete failed', description: result.error, variant: 'destructive' })
            return
          }
          toast({ title: 'Project deleted', description: `"${project.name}" was deleted.` })
          router.push('/projects')
        }}
      />
    </div>
  )
}
