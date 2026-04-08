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
  onFetchImpact: () => Promise<{ success: boolean; impact?: DeleteImpact; error?: string }>
  onConfirmDelete: (opts: {
    moveTasksToProjectId?: string
    moveProjectsToWorkspaceId?: string
    reassignToUserId?: string
  }) => Promise<void>
}

const ENTITY_LABELS: Record<EntityType, { icon: React.ReactNode; label: string }> = {
  workspace: { icon: <FolderKanban className="h-5 w-5" />, label: 'Workspace' },
  project:   { icon: <FolderKanban className="h-5 w-5" />, label: 'Project' },
  task:      { icon: <CheckSquare className="h-5 w-5" />,  label: 'Task' },
  staff:     { icon: <Users className="h-5 w-5" />,        label: 'Staff Member' },
}

type Step = 'loading' | 'step1' | 'step2' | 'step3' | 'deleting'

export function SmartDeleteDialog({
  open,
  onOpenChange,
  entityType,
  entityName,
  entityId,
  onFetchImpact,
  onConfirmDelete,
}: SmartDeleteDialogProps) {
  const [step, setStep] = useState<Step>('loading')
  const [impact, setImpact] = useState<DeleteImpact | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Reassignment options
  const [moveToProject, setMoveToProject] = useState<string>('')
  const [moveToWorkspace, setMoveToWorkspace] = useState<string>('')
  const [reassignToUser, setReassignToUser] = useState<string>('')

  // Step 3 confirm input
  const [confirmValue, setConfirmValue] = useState('')

  const cfg = ENTITY_LABELS[entityType]

  const hasImpact = impact
    ? impact.taskCount > 0 || impact.projectCount > 0
    : false

  useEffect(() => {
    if (!open) {
      setStep('loading')
      setImpact(null)
      setError(null)
      setMoveToProject('')
      setMoveToWorkspace('')
      setReassignToUser('')
      setConfirmValue('')
      return
    }

    setStep('loading')
    onFetchImpact().then((res) => {
      if (!res.success || !res.impact) {
        setError(res.error ?? 'Failed to load impact')
        setStep('step1')
        return
      }
      setImpact(res.impact)
      setStep('step1')
    })
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  function goToNext() {
    if (step === 'step1') {
      if (hasImpact) {
        setStep('step2')
      } else {
        setStep('step3')
      }
    } else if (step === 'step2') {
      setStep('step3')
    }
  }

  function goBack() {
    if (step === 'step2') setStep('step1')
    else if (step === 'step3') setStep(hasImpact ? 'step2' : 'step1')
  }

  async function handleDelete() {
    setStep('deleting')
    try {
      await onConfirmDelete({
        moveTasksToProjectId: moveToProject || undefined,
        moveProjectsToWorkspaceId: moveToWorkspace || undefined,
        reassignToUserId: reassignToUser || undefined,
      })
    } catch {
      setStep('step3')
    }
  }

  const confirmReady = confirmValue === entityName

  // Summary for step 3
  function buildSummary(): string {
    if (!impact) return 'This action cannot be undone.'
    const parts: string[] = []
    if (entityType === 'staff') {
      if (impact.taskCount > 0) {
        if (reassignToUser) {
          const user = impact.otherUsers.find((u) => u.id === reassignToUser)
          parts.push(`${impact.taskCount} task${impact.taskCount === 1 ? '' : 's'} will be reassigned to ${user?.full_name ?? 'selected user'}`)
        } else {
          parts.push(`${impact.taskCount} task${impact.taskCount === 1 ? '' : 's'} will be unassigned`)
        }
      }
    } else if (entityType === 'project') {
      if (impact.taskCount > 0) {
        if (moveToProject) {
          const proj = impact.otherProjects.find((p) => p.id === moveToProject)
          parts.push(`${impact.taskCount} task${impact.taskCount === 1 ? '' : 's'} will be moved to "${proj?.name ?? 'selected project'}"`)
        } else {
          parts.push(`${impact.taskCount} task${impact.taskCount === 1 ? '' : 's'} will be permanently deleted`)
        }
      }
      if (impact.members.length > 0) {
        parts.push(`${impact.members.length} ${impact.members.length === 1 ? 'person' : 'people'} will be notified`)
      }
    } else if (entityType === 'workspace') {
      if (impact.projectCount > 0) {
        if (moveToWorkspace) {
          const ws = impact.otherWorkspaces.find((w) => w.id === moveToWorkspace)
          parts.push(`${impact.projectCount} project${impact.projectCount === 1 ? '' : 's'} will be moved to "${ws?.name ?? 'selected workspace'}"`)
        } else {
          parts.push(`${impact.projectCount} project${impact.projectCount === 1 ? '' : 's'} and ${impact.taskCount} task${impact.taskCount === 1 ? '' : 's'} will be permanently deleted`)
        }
      }
      if (impact.members.length > 0) {
        parts.push(`${impact.members.length} ${impact.members.length === 1 ? 'person' : 'people'} will be notified`)
      }
    } else if (entityType === 'task') {
      if (impact.members.length > 0) {
        parts.push(`${impact.members.length} ${impact.members.length === 1 ? 'person' : 'people'} will be notified`)
      }
    }
    if (parts.length === 0) return 'This action cannot be undone.'
    return parts.join(' and ') + '. This action cannot be undone.'
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        {/* ── STEP 1: Impact Warning ─────────────────────────────────────── */}
        {(step === 'loading' || step === 'step1') && (
          <>
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

            {step === 'loading' && (
              <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">Checking impact…</span>
              </div>
            )}

            {step === 'step1' && impact && (
              <div className="space-y-4">
                {!hasImpact && impact.members.length === 0 && (
                  <div className="flex items-start gap-3 rounded-lg border bg-muted/40 p-3">
                    <Info className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                    <p className="text-sm text-muted-foreground">
                      No members or tasks are affected. This action cannot be undone.
                    </p>
                  </div>
                )}

                {(hasImpact || impact.members.length > 0) && (
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
                            <div
                              key={m.id}
                              className="flex items-center gap-1 rounded-full bg-white border border-amber-200 pl-0.5 pr-2 py-0.5"
                            >
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

                    {/* Tasks list (project or staff) */}
                    {impact.tasks.length > 0 && (
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 text-xs text-amber-700 font-medium">
                          <CheckSquare className="h-3.5 w-3.5" />
                          {impact.taskCount} {impact.taskCount === 1 ? 'task' : 'tasks'} will be affected
                        </div>
                        <div className="space-y-1 pl-5">
                          {impact.tasks.slice(0, 5).map((t) => (
                            <div key={t.id} className="flex items-center justify-between text-xs text-amber-800">
                              <Link
                                href={`/projects/${t.project_id}/tasks/${t.id}`}
                                target="_blank"
                                className="flex items-center gap-1 truncate max-w-[200px] underline underline-offset-2 text-amber-700 hover:text-amber-900 font-medium"
                              >
                                {t.title}
                                <ExternalLink className="h-3 w-3 shrink-0" />
                              </Link>
                              <Badge
                                variant="outline"
                                className="text-[10px] border-amber-300 text-amber-700 shrink-0 ml-2"
                              >
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

                    {/* Tasks count only (no list) for project with no task details */}
                    {impact.taskCount > 0 && impact.tasks.length === 0 && impact.projects.length === 0 && (
                      <div className="flex items-center gap-1.5 text-xs text-amber-700 font-medium">
                        <CheckSquare className="h-3.5 w-3.5" />
                        {impact.taskCount} {impact.taskCount === 1 ? 'task' : 'tasks'} will be deleted
                      </div>
                    )}

                    {/* Projects inside workspace */}
                    {impact.projects.length > 0 && (
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 text-xs text-amber-700 font-medium">
                          <FolderKanban className="h-3.5 w-3.5" />
                          {impact.projects.length} {impact.projects.length === 1 ? 'project' : 'projects'} &amp;{' '}
                          {impact.taskCount} {impact.taskCount === 1 ? 'task' : 'tasks'} will be deleted
                        </div>
                        <div className="space-y-1 pl-5">
                          {impact.projects.slice(0, 4).map((p) => (
                            <div key={p.id} className="flex items-center justify-between text-xs text-amber-800">
                              <Link
                                href={`/projects/${p.id}`}
                                target="_blank"
                                className="flex items-center gap-1 truncate max-w-[180px] underline underline-offset-2 text-amber-700 hover:text-amber-900 font-medium"
                              >
                                {p.name}
                                <ExternalLink className="h-3 w-3 shrink-0" />
                              </Link>
                              <Badge
                                variant="outline"
                                className="text-[10px] border-amber-300 text-amber-700 shrink-0"
                              >
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
                  </div>
                )}
              </div>
            )}

            {error && <p className="text-sm text-destructive">{error}</p>}

            <DialogFooter className="gap-2 mt-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                onClick={goToNext}
                disabled={step === 'loading' || !!error}
                className="gap-1.5"
              >
                Continue
                <ArrowRight className="h-4 w-4" />
              </Button>
            </DialogFooter>
          </>
        )}

        {/* ── STEP 2: Reassignment ──────────────────────────────────────── */}
        {step === 'step2' && impact && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ArrowRight className="h-5 w-5 text-muted-foreground" />
                Reassign or Remove Dependencies
              </DialogTitle>
              <DialogDescription>
                Choose what to do with the affected items before deleting.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-1">
              {/* Project: move tasks */}
              {entityType === 'project' && impact.taskCount > 0 && impact.otherProjects.length > 0 && (
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground flex items-center gap-1.5">
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                    Move tasks to another project?
                    <span className="text-muted-foreground font-normal text-xs">(optional)</span>
                  </label>
                  <Select value={moveToProject} onValueChange={setMoveToProject}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder="Delete tasks (don't move)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Delete tasks (don&apos;t move)</SelectItem>
                      {impact.otherProjects.map((p) => (
                        <SelectItem key={p.id} value={p.id} className="text-sm">
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Workspace: move projects */}
              {entityType === 'workspace' && impact.projectCount > 0 && impact.otherWorkspaces.length > 0 && (
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground flex items-center gap-1.5">
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                    Move projects to another workspace?
                    <span className="text-muted-foreground font-normal text-xs">(optional)</span>
                  </label>
                  <Select value={moveToWorkspace} onValueChange={setMoveToWorkspace}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder="Delete projects (don't move)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Delete projects (don&apos;t move)</SelectItem>
                      {impact.otherWorkspaces.map((w) => (
                        <SelectItem key={w.id} value={w.id} className="text-sm">
                          {w.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Staff: reassign tasks */}
              {entityType === 'staff' && impact.taskCount > 0 && (
                <div className="space-y-3">
                  {/* Task list */}
                  <div className="space-y-1.5">
                    <p className="text-sm font-medium">
                      {impact.taskCount} assigned {impact.taskCount === 1 ? 'task' : 'tasks'}:
                    </p>
                    <div className="max-h-40 overflow-y-auto rounded-md border bg-muted/30 divide-y">
                      {impact.tasks.map((t) => (
                        <div key={t.id} className="flex items-center justify-between px-3 py-1.5 text-xs">
                          <span className="truncate max-w-[220px] text-foreground">{t.title}</span>
                          <Badge variant="outline" className="text-[10px] shrink-0 ml-2">
                            {t.status}
                          </Badge>
                        </div>
                      ))}
                      {impact.taskCount > impact.tasks.length && (
                        <div className="px-3 py-1.5 text-xs text-muted-foreground">
                          and {impact.taskCount - impact.tasks.length} more…
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Reassign select */}
                  {impact.otherUsers.length > 0 && (
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium flex items-center gap-1.5">
                        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                        Reassign tasks to:
                        <span className="text-muted-foreground font-normal text-xs">(optional)</span>
                      </label>
                      <Select value={reassignToUser} onValueChange={setReassignToUser}>
                        <SelectTrigger className="h-9 text-sm">
                          <SelectValue placeholder="Unassign tasks (don't reassign)" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">Unassign tasks (don&apos;t reassign)</SelectItem>
                          {impact.otherUsers.map((u) => (
                            <SelectItem key={u.id} value={u.id} className="text-sm">
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
                      {!reassignToUser && (
                        <p className="text-xs text-muted-foreground">
                          If no user is selected, tasks will be unassigned.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              <button
                onClick={() => setStep('step3')}
                className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
              >
                Skip — delete everything without reassigning
              </button>
            </div>

            <DialogFooter className="gap-2 mt-2">
              <Button variant="outline" onClick={goBack} className="gap-1.5">
                <ChevronLeft className="h-4 w-4" />
                Back
              </Button>
              <Button onClick={goToNext} className="gap-1.5">
                Continue
                <ArrowRight className="h-4 w-4" />
              </Button>
            </DialogFooter>
          </>
        )}

        {/* ── STEP 3: Type to Confirm ───────────────────────────────────── */}
        {(step === 'step3' || step === 'deleting') && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-destructive">
                <Trash2 className="h-5 w-5" />
                Delete {cfg.label}?
              </DialogTitle>
              <DialogDescription asChild>
                <div className="mt-1 text-sm text-muted-foreground">
                  {impact ? buildSummary() : 'This action cannot be undone.'}
                </div>
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-1">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">
                  Type <span className="font-mono text-destructive">{entityName}</span> to confirm
                </label>
                <Input
                  placeholder={entityName}
                  value={confirmValue}
                  onChange={(e) => setConfirmValue(e.target.value)}
                  disabled={step === 'deleting'}
                  className={cn(
                    'transition-colors',
                    confirmValue.length > 0 && !confirmReady && 'border-red-400 focus-visible:ring-red-400',
                    confirmReady && 'border-green-500 focus-visible:ring-green-500'
                  )}
                  autoComplete="off"
                  autoFocus
                />
              </div>
            </div>

            <DialogFooter className="gap-2 mt-2">
              <Button
                variant="outline"
                onClick={goBack}
                disabled={step === 'deleting'}
                className="gap-1.5"
              >
                <ChevronLeft className="h-4 w-4" />
                Back
              </Button>
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={!confirmReady || step === 'deleting'}
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
                    Delete {cfg.label}
                  </>
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
