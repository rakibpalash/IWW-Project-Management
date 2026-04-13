'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Building2, Search, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SpaceCard } from './space-card'
import { CreateSpaceDialog } from './create-space-dialog'
import { RenameSpaceDialog } from './rename-space-dialog'
import { SmartDeleteDialog } from '@/components/ui/smart-delete-dialog'
import { useToast } from '@/components/ui/use-toast'
import { deleteSpaceAction, cloneSpaceAction } from '@/app/actions/spaces'
import { getSpaceDeleteImpact } from '@/app/actions/delete-impact'
import { Space, Profile } from '@/types'

type SpaceWithCounts = Space & { member_count: number; list_count: number }

interface SpacesPageProps {
  spaces: SpaceWithCounts[]
  staffProfiles: Profile[]
  canCreate?: boolean
  canEdit?: boolean
  canDelete?: boolean
}

export function SpacesPage({ spaces: initialSpaces, staffProfiles, canCreate = false, canEdit = false, canDelete = false }: SpacesPageProps) {
  const router = useRouter()
  const { toast } = useToast()

  const [spaces, setSpaces] = useState<SpaceWithCounts[]>(initialSpaces)
  const [search, setSearch] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [renameTarget, setRenameTarget] = useState<Space | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Space | null>(null)
  const [cloningId, setCloningId] = useState<string | null>(null)

  const filtered = spaces.filter(
    (w) =>
      w.name.toLowerCase().includes(search.toLowerCase()) ||
      (w.description ?? '').toLowerCase().includes(search.toLowerCase())
  )

  // ── Create: add to local state instantly ─────────────────────────────────
  function handleCreateSuccess(newSpace: SpaceWithCounts) {
    setSpaces((prev) => [newSpace, ...prev])
  }

  // ── Rename: update in local state instantly ───────────────────────────────
  function handleRenameSuccess(id: string, name: string, description: string | null) {
    setRenameTarget(null)
    setSpaces((prev) =>
      prev.map((w) => (w.id === id ? { ...w, name, description, updated_at: new Date().toISOString() } : w))
    )
  }

  // ── Clone: needs server data for new space ────────────────────────────
  async function handleClone(space: Space) {
    setCloningId(space.id)
    try {
      const result = await cloneSpaceAction(space.id)
      if (!result.success) {
        toast({ title: 'Clone failed', description: result.error, variant: 'destructive' })
        return
      }
      // Add cloned space to local state immediately
      setSpaces((prev) => [
        {
          id: result.newSpaceId!,
          name: `${space.name} (Copy)`,
          description: (space as SpaceWithCounts).description ?? null,
          created_by: '',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          member_count: (space as SpaceWithCounts).member_count,
          list_count: (space as SpaceWithCounts).list_count,
        },
        ...prev,
      ])
      toast({ title: 'Space cloned', description: `"${space.name} (Copy)" created.` })
    } finally {
      setCloningId(null)
    }
  }

  // ── Delete: remove from local state instantly ─────────────────────────────
  async function handleDelete(opts: { moveListsToSpaceId?: string }) {
    if (!deleteTarget) return
    const targetId = deleteTarget.id
    const targetName = deleteTarget.name
    const result = await deleteSpaceAction(targetId, opts)
    if (!result.success) {
      throw new Error(result.error ?? 'Delete failed')
    }
    setSpaces((prev) => prev.filter((w) => w.id !== targetId))
    setDeleteTarget(null)
    toast({ title: 'Space deleted', description: `"${targetName}" was deleted.` })
  }

  return (
    <div className="page-inner">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Spaces</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {spaces.length} space{spaces.length !== 1 ? 's' : ''}
          </p>
        </div>
        {canCreate && (
          <Button onClick={() => setShowCreate(true)} className="gap-2 sm:w-auto w-full">
            <Plus className="h-4 w-4" />
            New Space
          </Button>
        )}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/70" />
        <Input
          placeholder="Search spaces…"
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
            {search ? 'No spaces match your search' : 'No spaces yet'}
          </p>
          {!search && canCreate && (
            <Button variant="outline" size="sm" className="mt-4 gap-2" onClick={() => setShowCreate(true)}>
              <Plus className="h-4 w-4" />
              Create your first space
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((space) => (
            <div key={space.id} className="relative">
              {cloningId === space.id && (
                <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-card/80 backdrop-blur-sm">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Cloning…
                  </div>
                </div>
              )}
              <SpaceCard
                space={space}
                onClick={() => router.push(`/spaces/${space.id}`)}
                onRename={(ws) => setRenameTarget(ws)}
                onClone={(ws) => handleClone(ws)}
                onDelete={(ws) => setDeleteTarget(ws)}
                canEdit={canEdit}
                canDelete={canDelete}
              />
            </div>
          ))}
        </div>
      )}

      <CreateSpaceDialog
        open={showCreate}
        onOpenChange={setShowCreate}
        onSuccess={handleCreateSuccess}
        staffProfiles={staffProfiles}
      />

      <RenameSpaceDialog
        space={renameTarget}
        open={!!renameTarget}
        onOpenChange={(open) => { if (!open) setRenameTarget(null) }}
        onSuccess={handleRenameSuccess}
      />

      <SmartDeleteDialog
        open={!!deleteTarget}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}
        entityType="space"
        entityName={deleteTarget?.name ?? ''}
        entityId={deleteTarget?.id ?? ''}
        allowForceDelete
        onFetchImpact={() => getSpaceDeleteImpact(deleteTarget!.id)}
        onConfirmDelete={(opts) => handleDelete({ moveListsToSpaceId: opts.moveListsToSpaceId })}
      />
    </div>
  )
}
