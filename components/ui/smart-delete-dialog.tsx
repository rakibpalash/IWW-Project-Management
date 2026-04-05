'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2, AlertTriangle, Trash2, FolderKanban, CheckSquare, Users, ArrowRight, Info } from 'lucide-react'
import { cn, getInitials } from '@/lib/utils'
import { DeleteImpact } from '@/app/actions/delete-impact'

type EntityType = 'workspace' | 'project' | 'task'

interface SmartDeleteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  entityType: EntityType
  entityName: string
  entityId: string
  // Fetch impact fn — called when dialog opens
  onFetchImpact: () => Promise<{ success: boolean; impact?: DeleteImpact; error?: string }>
  // Called with optional move-to target
  onConfirmDelete: (opts: { moveTasksToProjectId?: string; moveProjectsToWorkspaceId?: string }) => Promise<void>
}

const ENTITY_LABELS: Record<EntityType, { icon: React.ReactNode; color: string; label: string }> = {
  workspace: { icon: <FolderKanban className="h-5 w-5" />, color: 'text-blue-600', label: 'Workspace' },
  project: { icon: <FolderKanban className="h-5 w-5" />, color: 'text-purple-600', label: 'Project' },
  task: { icon: <CheckSquare className="h-5 w-5" />, color: 'text-green-600', label: 'Task' },
}

export function SmartDeleteDialog({
  open,
  onOpenChange,
  entityType,
  entityName,
  entityId,
  onFetchImpact,
  onConfirmDelete,
}: SmartDeleteDialogProps) {
  const [step, setStep] = useState<'loading' | 'impact' | 'confirm' | 'deleting'>('loading')
  const [impact, setImpact] = useState<DeleteImpact | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [moveToProject, setMoveToProject] = useState<string>('')
  const [moveToWorkspace, setMoveToWorkspace] = useState<string>('')

  const cfg = ENTITY_LABELS[entityType]

  useEffect(() => {
    if (!open) {
      setStep('loading')
      setImpact(null)
      setError(null)
      setMoveToProject('')
      setMoveToWorkspace('')
      return
    }

    setStep('loading')
    onFetchImpact().then((res) => {
      if (!res.success || !res.impact) {
        setError(res.error ?? 'Failed to load impact')
        setStep('impact')
        return
      }
      setImpact(res.impact)
      setStep('impact')
    })
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  const hasImpact =
    impact && (impact.members.length > 0 || impact.projectCount > 0 || impact.taskCount > 0)

  async function handleDelete() {
    setStep('deleting')
    await onConfirmDelete({
      moveTasksToProjectId: moveToProject || undefined,
      moveProjectsToWorkspaceId: moveToWorkspace || undefined,
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <Trash2 className="h-5 w-5" />
            Delete {cfg.label}?
          </DialogTitle>
          <DialogDescription asChild>
            <div className="mt-1">
              You are about to permanently delete{' '}
              <strong className="text-foreground">&ldquo;{entityName}&rdquo;</strong>.
            </div>
          </DialogDescription>
        </DialogHeader>

        {/* Loading */}
        {step === 'loading' && (
          <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Checking impact…</span>
          </div>
        )}

        {/* Impact summary */}
        {(step === 'impact' || step === 'confirm' || step === 'deleting') && impact && (
          <div className="space-y-4">

            {/* No impact — simple confirm */}
            {!hasImpact && (
              <div className="flex items-start gap-3 rounded-lg border bg-muted/40 p-3">
                <Info className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                <p className="text-sm text-muted-foreground">
                  No members or tasks are affected. This action cannot be undone.
                </p>
              </div>
            )}

            {/* Has impact */}
            {hasImpact && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-3">
                <div className="flex items-center gap-2 text-amber-800 font-medium text-sm">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  This will affect:
                </div>

                {/* Affected members */}
                {impact.members.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5 text-xs text-amber-700 font-medium">
                      <Users className="h-3.5 w-3.5" />
                      {impact.members.length} assigned {impact.members.length === 1 ? 'person' : 'people'}
                    </div>
                    <div className="flex flex-wrap gap-1.5 pl-5">
                      {impact.members.map((m) => (
                        <div key={m.id} className="flex items-center gap-1 rounded-full bg-white border border-amber-200 pl-0.5 pr-2 py-0.5">
                          <Avatar className="h-4 w-4">
                            <AvatarImage src={m.avatar_url ?? undefined} />
                            <AvatarFallback className="text-[8px]">{getInitials(m.full_name)}</AvatarFallback>
                          </Avatar>
                          <span className="text-xs text-amber-900">{m.full_name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Projects inside workspace */}
                {impact.projects.length > 0 && (
                  <div className="space-y-1 pl-0">
                    <div className="flex items-center gap-1.5 text-xs text-amber-700 font-medium">
                      <FolderKanban className="h-3.5 w-3.5" />
                      {impact.projects.length} {impact.projects.length === 1 ? 'project' : 'projects'} &amp; {impact.taskCount} {impact.taskCount === 1 ? 'task' : 'tasks'} will be deleted
                    </div>
                    <div className="space-y-1 pl-5">
                      {impact.projects.slice(0, 4).map((p) => (
                        <div key={p.id} className="flex items-center justify-between text-xs text-amber-800">
                          <span className="truncate max-w-[180px]">{p.name}</span>
                          <Badge variant="outline" className="text-[10px] border-amber-300 text-amber-700 shrink-0">
                            {p.task_count} {p.task_count === 1 ? 'task' : 'tasks'}
                          </Badge>
                        </div>
                      ))}
                      {impact.projects.length > 4 && (
                        <p className="text-xs text-amber-600">+{impact.projects.length - 4} more projects</p>
                      )}
                    </div>
                  </div>
                )}

                {/* Tasks only (project delete) */}
                {impact.taskCount > 0 && impact.projects.length === 0 && (
                  <div className="flex items-center gap-1.5 text-xs text-amber-700 font-medium">
                    <CheckSquare className="h-3.5 w-3.5" />
                    {impact.taskCount} {impact.taskCount === 1 ? 'task' : 'tasks'} will be deleted
                  </div>
                )}
              </div>
            )}

            {/* Option: Move tasks to another project */}
            {impact.taskCount > 0 && impact.otherProjects.length > 0 && entityType === 'project' && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                  Move tasks to another project instead? <span className="text-muted-foreground font-normal">(optional)</span>
                </label>
                <Select value={moveToProject} onValueChange={setMoveToProject}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Delete tasks (don't move)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Delete tasks (don&apos;t move)</SelectItem>
                    {impact.otherProjects.map((p) => (
                      <SelectItem key={p.id} value={p.id} className="text-xs">
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Option: Move projects to another workspace */}
            {impact.projectCount > 0 && impact.otherWorkspaces.length > 0 && entityType === 'workspace' && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                  Move projects to another workspace instead? <span className="text-muted-foreground font-normal">(optional)</span>
                </label>
                <Select value={moveToWorkspace} onValueChange={setMoveToWorkspace}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Delete projects (don't move)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Delete projects (don&apos;t move)</SelectItem>
                    {impact.otherWorkspaces.map((w) => (
                      <SelectItem key={w.id} value={w.id} className="text-xs">
                        {w.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Always-visible warning */}
            <p className="text-xs text-muted-foreground">
              {moveToProject || moveToWorkspace
                ? 'Assignments and comments will be removed from moved items.'
                : 'This action cannot be undone.'}
              {' '}All assignees will receive an in-app notification.
            </p>
          </div>
        )}

        {/* Error */}
        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}

        <DialogFooter className="gap-2 mt-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={step === 'deleting'}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={step === 'loading' || step === 'deleting' || !!error}
            className="gap-1.5"
          >
            {step === 'deleting' ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Deleting…
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4" />
                {moveToProject
                  ? 'Move tasks & delete'
                  : moveToWorkspace
                  ? 'Move projects & delete'
                  : `Delete ${cfg.label}`}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
