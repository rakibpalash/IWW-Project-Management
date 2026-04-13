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
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Loader2,
  AlertTriangle,
  Trash2,
  FolderKanban,
  CheckSquare,
  Users,
  ArrowRight,
  Info,
  ChevronLeft,
  ExternalLink,
  Zap,
} from 'lucide-react'
import Link from 'next/link'
import { cn, getInitials } from '@/lib/utils'
import { DeleteImpact } from '@/app/actions/delete-impact'

type EntityType = 'workspace' | 'project' | 'task' | 'staff'

interface SmartDeleteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  entityType: EntityType
  entityName: string
  entityId: string
  allowForceDelete?: boolean
  onFetchImpact: () => Promise<{ success: boolean; impact?: DeleteImpact; error?: string }>
  onConfirmDelete: (opts: {
    moveTasksToProjectId?: string
    moveProjectsToWorkspaceId?: string
    reassignToUserId?: string
  }) => Promise<void>
}

const ENTITY_LABELS: Record<EntityType, { label: string }> = {
  workspace: { label: 'Space' },
  project:   { label: 'Project' },
  task:      { label: 'Task' },
  staff:     { label: 'Staff Member' },
}

type Step = 'loading' | 'impact' | 'reassign' | 'confirm' | 'deleting'

export function SmartDeleteDialog({
  open,
  onOpenChange,
  entityType,
  entityName,
  allowForceDelete = false,
  onFetchImpact,
  onConfirmDelete,
}: SmartDeleteDialogProps) {
  const [step, setStep] = useState<Step>('loading')
  const [isForceDeleting, setIsForceDeleting] = useState(false)
  const [impact, setImpact] = useState<DeleteImpact | null>(null)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const [moveToProject, setMoveToProject] = useState('')
  const [moveToWorkspace, setMoveToWorkspace] = useState('')
  const [reassignToUser, setReassignToUser] = useState('')
  const [confirmValue, setConfirmValue] = useState('')

  const cfg = ENTITY_LABELS[entityType]
  const hasWarning = impact
    ? impact.taskCount > 0 || impact.projectCount > 0 || impact.members.length > 0
    : false
  const confirmReady = confirmValue === entityName

  // Reset on close, fetch on open
  useEffect(() => {
    if (!open) {
      setStep('loading')
      setImpact(null)
      setFetchError(null)
      setDeleteError(null)
      setMoveToProject('')
      setMoveToWorkspace('')
      setReassignToUser('')
      setConfirmValue('')
      setIsForceDeleting(false)
      return
    }
    setStep('loading')
    onFetchImpact().then((res) => {
      if (!res.success || !res.impact) {
        setFetchError(res.error ?? 'Failed to load impact')
        setStep('impact')
        return
      }
      setImpact(res.impact)
      setStep('impact')
    })
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Force Delete: immediate, no step change ───────────────────────────────
  async function handleForceDelete() {
    setDeleteError(null)
    setIsForceDeleting(true)
    try {
      await onConfirmDelete({})
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Delete failed — try again')
    } finally {
      setIsForceDeleting(false)
    }
  }

  // ── Confirmed Delete (step 3): changes step to show spinner ──────────────
  async function handleConfirmedDelete() {
    setDeleteError(null)
    setStep('deleting')
    try {
      await onConfirmDelete({
        moveTasksToProjectId: moveToProject || undefined,
        moveProjectsToWorkspaceId: moveToWorkspace || undefined,
        reassignToUserId: reassignToUser || undefined,
      })
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Delete failed — try again')
      setStep('confirm')
    }
  }

  function buildSummary(): string {
    if (!impact) return 'This action cannot be undone.'
    const parts: string[] = []
    if (entityType === 'workspace' && impact.projectCount > 0) {
      parts.push(
        moveToWorkspace
          ? `${impact.projectCount} project${impact.projectCount !== 1 ? 's' : ''} will be moved`
          : `${impact.projectCount} project${impact.projectCount !== 1 ? 's' : ''} & ${impact.taskCount} task${impact.taskCount !== 1 ? 's' : ''} will be permanently deleted`
      )
    }
    if (entityType === 'project' && impact.taskCount > 0) {
      parts.push(
        moveToProject
          ? `${impact.taskCount} task${impact.taskCount !== 1 ? 's' : ''} will be moved`
          : `${impact.taskCount} task${impact.taskCount !== 1 ? 's' : ''} will be permanently deleted`
      )
    }
    if (entityType === 'staff' && impact.taskCount > 0) {
      parts.push(
        reassignToUser
          ? `${impact.taskCount} task${impact.taskCount !== 1 ? 's' : ''} will be reassigned`
          : `${impact.taskCount} task${impact.taskCount !== 1 ? 's' : ''} will be unassigned`
      )
    }
    if (impact.members.length > 0) {
      parts.push(`${impact.members.length} ${impact.members.length === 1 ? 'person' : 'people'} will be notified`)
    }
    return (parts.length ? parts.join(' · ') + '. ' : '') + 'This action cannot be undone.'
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[420px] p-0 overflow-hidden">

        {/* ── STEP: Impact (loading + impact) ──────────────────────────── */}
        {(step === 'loading' || step === 'impact') && (
          <div className="flex flex-col">
            {/* Header */}
            <div className="px-5 pt-5 pb-4 border-b">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-destructive/10">
                  <Trash2 className="h-4 w-4 text-destructive" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-foreground">Delete {cfg.label}</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Permanently delete{' '}
                    <span className="font-medium text-foreground">&ldquo;{entityName}&rdquo;</span>
                  </p>
                </div>
              </div>
            </div>

            {/* Body */}
            <div className="px-5 py-4 space-y-3">
              {step === 'loading' && (
                <div className="flex items-center justify-center py-6 gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">Checking impact…</span>
                </div>
              )}

              {step === 'impact' && impact && !hasWarning && (
                <div className="flex items-start gap-3 rounded-lg border bg-muted/40 p-3">
                  <Info className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                  <p className="text-sm text-muted-foreground">
                    No projects, tasks, or members are affected. This action cannot be undone.
                  </p>
                </div>
              )}

              {step === 'impact' && impact && hasWarning && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 divide-y divide-amber-100">
                  <div className="flex items-center gap-2 px-3 py-2.5 text-amber-800 font-medium text-sm">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    This will affect:
                  </div>

                  {/* Members */}
                  {impact.members.length > 0 && (
                    <div className="px-3 py-2.5 space-y-1.5">
                      <div className="flex items-center gap-1.5 text-xs text-amber-700 font-medium">
                        <Users className="h-3.5 w-3.5" />
                        {impact.members.length} assigned {impact.members.length === 1 ? 'person' : 'people'}
                      </div>
                      <div className="flex flex-wrap gap-1.5">
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
                    <div className="px-3 py-2.5 space-y-1.5">
                      <div className="flex items-center gap-1.5 text-xs text-amber-700 font-medium">
                        <FolderKanban className="h-3.5 w-3.5" />
                        {impact.projects.length} {impact.projects.length === 1 ? 'project' : 'projects'} &amp;{' '}
                        {impact.taskCount} {impact.taskCount === 1 ? 'task' : 'tasks'} will be deleted
                      </div>
                      <div className="space-y-1">
                        {impact.projects.slice(0, 4).map((p) => (
                          <div key={p.id} className="flex items-center justify-between text-xs">
                            <Link
                              href={`/projects/${p.id}`}
                              target="_blank"
                              className="flex items-center gap-1 truncate max-w-[200px] text-amber-700 hover:text-amber-900 underline underline-offset-2 font-medium"
                            >
                              {p.name}
                              <ExternalLink className="h-3 w-3 shrink-0" />
                            </Link>
                            <Badge variant="outline" className="text-[10px] border-amber-200 text-amber-600 shrink-0">
                              {p.task_count} tasks
                            </Badge>
                          </div>
                        ))}
                        {impact.projects.length > 4 && (
                          <p className="text-xs text-amber-600">+{impact.projects.length - 4} more</p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Tasks only */}
                  {impact.tasks.length > 0 && impact.projects.length === 0 && (
                    <div className="px-3 py-2.5 space-y-1.5">
                      <div className="flex items-center gap-1.5 text-xs text-amber-700 font-medium">
                        <CheckSquare className="h-3.5 w-3.5" />
                        {impact.taskCount} {impact.taskCount === 1 ? 'task' : 'tasks'} will be affected
                      </div>
                      <div className="space-y-1">
                        {impact.tasks.slice(0, 5).map((t) => (
                          <div key={t.id} className="flex items-center justify-between text-xs">
                            <Link
                              href={`/projects/${t.project_id}/tasks/${t.id}`}
                              target="_blank"
                              className="flex items-center gap-1 truncate max-w-[200px] text-amber-700 hover:text-amber-900 underline underline-offset-2 font-medium"
                            >
                              {t.title}
                              <ExternalLink className="h-3 w-3 shrink-0" />
                            </Link>
                            <Badge variant="outline" className="text-[10px] border-amber-200 text-amber-600 shrink-0">
                              {t.status}
                            </Badge>
                          </div>
                        ))}
                        {impact.taskCount > 5 && (
                          <p className="text-xs text-amber-600">and {impact.taskCount - 5} more</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {fetchError && (
                <p className="text-sm text-destructive">{fetchError}</p>
              )}

              {/* Inline delete error (shown when force delete fails) */}
              {deleteError && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5">
                  <p className="text-sm font-medium text-destructive">Delete failed</p>
                  <p className="text-xs text-destructive/70 mt-0.5">{deleteError}</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-5 pb-5 flex items-center justify-between gap-2">
              <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={isForceDeleting}>
                Cancel
              </Button>
              <div className="flex items-center gap-2">
                {/* Force Delete — only when there's a warning and allowForceDelete */}
                {allowForceDelete && hasWarning && step === 'impact' && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleForceDelete}
                    disabled={isForceDeleting || !!fetchError}
                    className="gap-1.5 bg-red-500 hover:bg-red-600"
                  >
                    {isForceDeleting ? (
                      <><Loader2 className="h-3.5 w-3.5 animate-spin" />Deleting…</>
                    ) : (
                      <><Zap className="h-3.5 w-3.5" />Force Delete</>
                    )}
                  </Button>
                )}
                <Button
                  size="sm"
                  onClick={() => setStep(hasWarning ? 'reassign' : 'confirm')}
                  disabled={step === 'loading' || !!fetchError || isForceDeleting}
                  className="gap-1.5"
                >
                  Continue
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ── STEP: Reassign ───────────────────────────────────────────── */}
        {step === 'reassign' && impact && (
          <div className="flex flex-col">
            <div className="px-5 pt-5 pb-4 border-b">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted">
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <h2 className="text-base font-semibold">Reassign before deleting</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">Optional — skip to delete everything</p>
                </div>
              </div>
            </div>

            <div className="px-5 py-4 space-y-4">
              {entityType === 'workspace' && impact.projectCount > 0 && impact.otherWorkspaces.length > 0 && (
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Move projects to another space</label>
                  <Select value={moveToWorkspace} onValueChange={setMoveToWorkspace}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder="Delete all projects" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Delete all projects</SelectItem>
                      {impact.otherWorkspaces.map((w) => (
                        <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {entityType === 'project' && impact.taskCount > 0 && impact.otherProjects.length > 0 && (
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Move tasks to another project</label>
                  <Select value={moveToProject} onValueChange={setMoveToProject}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder="Delete all tasks" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Delete all tasks</SelectItem>
                      {impact.otherProjects.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {entityType === 'staff' && impact.taskCount > 0 && impact.otherUsers.length > 0 && (
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Reassign tasks to</label>
                  <Select value={reassignToUser} onValueChange={setReassignToUser}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder="Unassign all tasks" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Unassign all tasks</SelectItem>
                      {impact.otherUsers.map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          <div className="flex items-center gap-2">
                            <Avatar className="h-5 w-5">
                              <AvatarImage src={u.avatar_url ?? undefined} />
                              <AvatarFallback className="text-[8px]">{getInitials(u.full_name)}</AvatarFallback>
                            </Avatar>
                            {u.full_name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <div className="px-5 pb-5 flex items-center justify-between gap-2">
              <Button variant="outline" size="sm" onClick={() => setStep('impact')} className="gap-1.5">
                <ChevronLeft className="h-3.5 w-3.5" />
                Back
              </Button>
              <Button size="sm" onClick={() => setStep('confirm')} className="gap-1.5">
                Continue
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}

        {/* ── STEP: Confirm (type to delete) ───────────────────────────── */}
        {(step === 'confirm' || step === 'deleting') && (
          <div className="flex flex-col">
            <div className="px-5 pt-5 pb-4 border-b">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-destructive/10">
                  <Trash2 className="h-4 w-4 text-destructive" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-destructive">Confirm deletion</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">{buildSummary()}</p>
                </div>
              </div>
            </div>

            <div className="px-5 py-4 space-y-3">
              <div className="space-y-1.5">
                <label className="text-sm text-muted-foreground">
                  Type <span className="font-mono font-semibold text-foreground">{entityName}</span> to confirm
                </label>
                <Input
                  placeholder={entityName}
                  value={confirmValue}
                  onChange={(e) => setConfirmValue(e.target.value)}
                  disabled={step === 'deleting'}
                  className={cn(
                    'transition-colors',
                    confirmValue.length > 0 && !confirmReady && 'border-destructive/50 focus-visible:ring-destructive/30',
                    confirmReady && 'border-green-500 focus-visible:ring-green-500/30'
                  )}
                  autoComplete="off"
                  autoFocus
                />
              </div>
              {deleteError && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2">
                  <p className="text-xs text-destructive">{deleteError}</p>
                </div>
              )}
            </div>

            <div className="px-5 pb-5 flex items-center justify-between gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setStep(hasWarning ? 'reassign' : 'impact')}
                disabled={step === 'deleting'}
                className="gap-1.5"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                Back
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleConfirmedDelete}
                disabled={!confirmReady || step === 'deleting'}
                className="gap-1.5"
              >
                {step === 'deleting' ? (
                  <><Loader2 className="h-3.5 w-3.5 animate-spin" />Deleting…</>
                ) : (
                  <><Trash2 className="h-3.5 w-3.5" />Delete {cfg.label}</>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
