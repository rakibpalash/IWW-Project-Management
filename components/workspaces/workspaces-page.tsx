'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Building2, Search, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { WorkspaceCard } from './workspace-card'
import { CreateWorkspaceDialog } from './create-workspace-dialog'
import { RenameWorkspaceDialog } from './rename-workspace-dialog'
import { SmartDeleteDialog } from '@/components/ui/smart-delete-dialog'
import { useToast } from '@/components/ui/use-toast'
import { deleteWorkspaceAction, cloneWorkspaceAction } from '@/app/actions/workspaces'
import { getWorkspaceDeleteImpact } from '@/app/actions/delete-impact'
import { Workspace } from '@/types'

type WorkspaceWithCounts = Workspace & { member_count: number; project_count: number }

interface WorkspacesPageProps {
  workspaces: WorkspaceWithCounts[]
}

export function WorkspacesPage({ workspaces: initialWorkspaces }: WorkspacesPageProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [, startTransition] = useTransition()

  // Local copy so we can update without triggering a server re-render
  const [workspaces, setWorkspaces] = useState<WorkspaceWithCounts[]>(initialWorkspaces)

  const [search, setSearch] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [renameTarget, setRenameTarget] = useState<Workspace | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Workspace | null>(null)
  const [cloningId, setCloningId] = useState<string | null>(null)

  const filtered = workspaces.filter(
    (w) =>
      w.name.toLowerCase().includes(search.toLowerCase()) ||
      (w.description ?? '').toLowerCase().includes(search.toLowerCase())
  )

  function refresh() {
    startTransition(() => router.refresh())
  }

  // ── Clone ─────────────────────────────────────────────────────────────────
  async function handleClone(workspace: Workspace) {
    setCloningId(workspace.id)
    try {
      const result = await cloneWorkspaceAction(workspace.id)
      if (!result.success) {
        toast({ title: 'Clone failed', description: result.error, variant: 'destructive' })
        return
      }
      toast({ title: 'Workspace cloned', description: `"${workspace.name} (Copy)" created.` })
      refresh() // clone needs server data for the new workspace
    } finally {
      setCloningId(null)
    }
  }

  // ── Delete ────────────────────────────────────────────────────────────────
  async function handleDelete(opts: { moveProjectsToWorkspaceId?: string }) {
    if (!deleteTarget) return
    const targetId = deleteTarget.id
    const targetName = deleteTarget.name

    const result = await deleteWorkspaceAction(targetId, opts)
    if (!result.success) {
      // Throw so SmartDeleteDialog catches it and shows the error inline
      throw new Error(result.error ?? 'Delete failed')
    }
    // Remove from local state — no router.refresh() to avoid server re-render crash
    setWorkspaces((prev) => prev.filter((w) => w.id !== targetId))
    setDeleteTarget(null)
    toast({ title: 'Workspace deleted', description: `"${targetName}" was deleted.` })
  }

  // ── Rename callback ───────────────────────────────────────────────────────
  function handleRenameSuccess() {
    setRenameTarget(null)
    refresh()
  }

  return (
    <div className="page-inner">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Workspaces</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {workspaces.length} workspace{workspaces.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="gap-2 sm:w-auto w-full">
          <Plus className="h-4 w-4" />
          New Workspace
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/70" />
        <Input
          placeholder="Search workspaces…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/30 py-16">
          <Building2 className="h-10 w-10 text-gray-300" />
          <p className="mt-3 text-sm font-medium text-muted-foreground">
            {search ? 'No workspaces match your search' : 'No workspaces yet'}
          </p>
          {!search && (
            <Button
              variant="outline"
              size="sm"
              className="mt-4 gap-2"
              onClick={() => setShowCreate(true)}
            >
              <Plus className="h-4 w-4" />
              Create your first workspace
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((workspace) => (
            <div key={workspace.id} className="relative">
              {cloningId === workspace.id && (
                <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-card/80 backdrop-blur-sm">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Cloning…
                  </div>
                </div>
              )}
              <WorkspaceCard
                workspace={workspace}
                onClick={() => router.push(`/workspaces/${workspace.id}`)}
                onRename={(ws) => setRenameTarget(ws)}
                onClone={(ws) => handleClone(ws)}
                onDelete={(ws) => setDeleteTarget(ws)}
              />
            </div>
          ))}
        </div>
      )}

      {/* Create dialog */}
      <CreateWorkspaceDialog
        open={showCreate}
        onOpenChange={setShowCreate}
        onSuccess={refresh}
      />

      {/* Rename dialog */}
      <RenameWorkspaceDialog
        workspace={renameTarget}
        open={!!renameTarget}
        onOpenChange={(open) => { if (!open) setRenameTarget(null) }}
        onSuccess={handleRenameSuccess}
      />

      {/* Smart Delete Dialog */}
      <SmartDeleteDialog
        open={!!deleteTarget}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}
        entityType="workspace"
        entityName={deleteTarget?.name ?? ''}
        entityId={deleteTarget?.id ?? ''}
        allowForceDelete
        onFetchImpact={() => getWorkspaceDeleteImpact(deleteTarget!.id)}
        onConfirmDelete={(opts) => handleDelete({ moveProjectsToWorkspaceId: opts.moveProjectsToWorkspaceId })}
      />
    </div>
  )
}
