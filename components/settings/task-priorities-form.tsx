'use client'

import { useState, useEffect } from 'react'
import { CustomTaskPriority } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Plus, Pencil, Trash2, ChevronUp, ChevronDown, Star, Check, Loader2 } from 'lucide-react'
import {
  createTaskPriorityAction,
  updateTaskPriorityConfigAction,
  deleteTaskPriorityAction,
  reorderTaskPrioritiesAction,
  seedDefaultPrioritiesAction,
} from '@/app/actions/task-priorities'

const PRESET_COLORS = [
  '#94a3b8', '#64748b', '#22c55e', '#10b981', '#14b8a6',
  '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7',
  '#ec4899', '#f43f5e', '#ef4444', '#f97316', '#f59e0b',
  '#eab308', '#84cc16', '#78716c', '#0ea5e9', '#d946ef',
]

interface Props {
  initialPriorities: CustomTaskPriority[]
}

interface PriorityFormData {
  name: string
  slug: string
  color: string
}

const emptyForm: PriorityFormData = { name: '', slug: '', color: '#f59e0b' }

function toSlug(name: string): string {
  return name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
}

export function TaskPrioritiesForm({ initialPriorities }: Props) {
  const [priorities, setPriorities] = useState<CustomTaskPriority[]>(initialPriorities)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<PriorityFormData>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<CustomTaskPriority | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [reordering, setReordering] = useState(false)
  const [seeding, setSeeding] = useState(false)

  // Auto-seed defaults silently when this org has no priorities yet
  useEffect(() => {
    if (initialPriorities.length === 0) {
      handleSeedDefaults()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function openAdd() {
    setEditingId(null)
    setForm(emptyForm)
    setError(null)
    setDialogOpen(true)
  }

  function openEdit(p: CustomTaskPriority) {
    setEditingId(p.id)
    setForm({ name: p.name, slug: p.slug, color: p.color })
    setError(null)
    setDialogOpen(true)
  }

  async function handleSave() {
    if (!form.name.trim()) { setError('Name is required'); return }
    if (!form.slug.trim()) { setError('Slug is required'); return }
    if (!/^[a-z0-9_]+$/.test(form.slug)) { setError('Slug: lowercase, numbers, underscores only'); return }

    setSaving(true)
    setError(null)

    if (editingId) {
      const result = await updateTaskPriorityConfigAction(editingId, {
        name: form.name.trim(),
        color: form.color,
      })
      if (!result.success) { setError(result.error ?? 'Failed to save'); setSaving(false); return }
      setPriorities((prev) => prev.map((p) =>
        p.id === editingId ? { ...p, name: form.name.trim(), color: form.color } : p
      ))
    } else {
      if (priorities.some((p) => p.slug === form.slug.trim())) {
        setError('A priority with this slug already exists'); setSaving(false); return
      }
      const result = await createTaskPriorityAction(form)
      if (!result.success) { setError(result.error ?? 'Failed to create'); setSaving(false); return }
      if (result.priority) setPriorities((prev) => [...prev, result.priority!])
    }

    setSaving(false)
    setDialogOpen(false)
  }

  async function handleToggleActive(p: CustomTaskPriority) {
    if (p.is_default && p.is_active) return
    setTogglingId(p.id)
    const result = await updateTaskPriorityConfigAction(p.id, { is_active: !p.is_active })
    if (result.success) {
      setPriorities((prev) => prev.map((x) => x.id === p.id ? { ...x, is_active: !x.is_active } : x))
    }
    setTogglingId(null)
  }

  async function handleSetDefault(p: CustomTaskPriority) {
    if (p.is_default) return
    setTogglingId(p.id)
    const result = await updateTaskPriorityConfigAction(p.id, { is_default: true })
    if (result.success) {
      setPriorities((prev) => prev.map((x) => ({ ...x, is_default: x.id === p.id })))
    }
    setTogglingId(null)
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    setDeleteError(null)
    const result = await deleteTaskPriorityAction(deleteTarget.id)
    if (!result.success) { setDeleteError(result.error ?? 'Failed to delete'); setDeleting(false); return }
    setPriorities((prev) => prev.filter((p) => p.id !== deleteTarget.id))
    setDeleteTarget(null)
    setDeleting(false)
  }

  async function handleSeedDefaults() {
    setSeeding(true)
    const result = await seedDefaultPrioritiesAction()
    if (result.success && result.priorities) {
      setPriorities(result.priorities)
    }
    setSeeding(false)
  }

  async function handleReorder(index: number, direction: 'up' | 'down') {
    const newList = [...priorities]
    const swapIndex = direction === 'up' ? index - 1 : index + 1
    if (swapIndex < 0 || swapIndex >= newList.length) return
    ;[newList[index], newList[swapIndex]] = [newList[swapIndex], newList[index]]
    setPriorities(newList)
    setReordering(true)
    await reorderTaskPrioritiesAction(newList.map((p) => p.id))
    setReordering(false)
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">Task Priorities</CardTitle>
            <CardDescription className="mt-1">
              Configure priority levels available when creating or editing tasks.
            </CardDescription>
          </div>
          <Button size="sm" onClick={openAdd}>
            <Plus className="h-4 w-4 mr-1.5" />
            Add Priority
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-2">
        {priorities.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
            <p className="text-sm text-muted-foreground">No priorities configured yet.</p>
            <Button variant="outline" size="sm" onClick={handleSeedDefaults} disabled={seeding}>
              {seeding ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
              Load Defaults
            </Button>
            <p className="text-xs text-muted-foreground">Adds Low, Medium, High, Urgent</p>
          </div>
        )}

        {priorities.map((p, index) => (
          <div
            key={p.id}
            className={`flex items-center gap-3 rounded-lg border px-4 py-3 transition-opacity ${!p.is_active ? 'opacity-50' : ''}`}
          >
            <div className="h-4 w-4 rounded-full shrink-0 border" style={{ backgroundColor: p.color }} />

            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">{p.name}</p>
              <p className="text-xs text-muted-foreground font-mono">{p.slug}</p>
            </div>

            <div className="hidden sm:flex items-center gap-1.5">
              {p.is_default && (
                <Badge className="text-xs bg-blue-100 text-blue-700 border-blue-200">Default</Badge>
              )}
              {!p.is_active && (
                <Badge className="text-xs bg-red-100 text-red-600 border-red-200">Inactive</Badge>
              )}
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                title="Set as default"
                disabled={p.is_default || togglingId === p.id}
                onClick={() => handleSetDefault(p)}
                className={`p-1.5 rounded-md transition-colors ${p.is_default ? 'text-blue-500' : 'text-muted-foreground hover:text-blue-500 hover:bg-blue-50'}`}
              >
                <Star className="h-3.5 w-3.5" fill={p.is_default ? 'currentColor' : 'none'} />
              </button>

              <Switch
                checked={p.is_active}
                disabled={togglingId === p.id || (p.is_default && p.is_active)}
                onCheckedChange={() => handleToggleActive(p)}
                className="h-5 w-9"
              />

              <button
                title="Move up"
                disabled={index === 0 || reordering}
                onClick={() => handleReorder(index, 'up')}
                className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30"
              >
                <ChevronUp className="h-3.5 w-3.5" />
              </button>
              <button
                title="Move down"
                disabled={index === priorities.length - 1 || reordering}
                onClick={() => handleReorder(index, 'down')}
                className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30"
              >
                <ChevronDown className="h-3.5 w-3.5" />
              </button>

              <button
                title="Edit"
                onClick={() => openEdit(p)}
                className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>

              <button
                title="Delete"
                onClick={() => { setDeleteTarget(p); setDeleteError(null) }}
                disabled={p.is_default}
                className="p-1.5 rounded-md text-muted-foreground hover:text-red-600 hover:bg-red-50 disabled:opacity-30"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ))}
      </CardContent>

      {/* Add / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Priority' : 'Add Priority'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Name</Label>
                <Input
                  value={form.name}
                  onChange={(e) => {
                    const name = e.target.value
                    setForm((f) => ({ ...f, name, slug: editingId ? f.slug : toSlug(name) }))
                  }}
                  placeholder="e.g. Critical"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Slug {editingId && <span className="text-xs text-muted-foreground">(not editable)</span>}</Label>
                <Input
                  value={form.slug}
                  readOnly={!!editingId}
                  onChange={(e) => !editingId && setForm((f) => ({ ...f, slug: toSlug(e.target.value) }))}
                  placeholder="e.g. critical"
                  className={editingId ? 'bg-muted font-mono text-sm' : 'font-mono text-sm'}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Color</Label>
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-md border-2 border-border shrink-0" style={{ backgroundColor: form.color }} />
                <div className="flex flex-wrap gap-1.5">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, color: c }))}
                      className="h-6 w-6 rounded-md border-2 transition-transform hover:scale-110"
                      style={{ backgroundColor: c, borderColor: form.color === c ? '#1d4ed8' : 'transparent' }}
                    >
                      {form.color === c && <Check className="h-3 w-3 text-white mx-auto" />}
                    </button>
                  ))}
                </div>
                <Input
                  type="color"
                  value={form.color}
                  onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
                  className="h-8 w-12 p-0.5 cursor-pointer"
                />
              </div>
            </div>

            {/* Preview */}
            <div className="flex items-center gap-2 rounded-md bg-muted/40 px-3 py-2">
              <span className="text-xs text-muted-foreground">Preview:</span>
              <span
                className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold border"
                style={{ backgroundColor: form.color + '20', color: form.color, borderColor: form.color + '40' }}
              >
                {form.name || 'Priority Name'}
              </span>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingId ? 'Save Changes' : 'Create Priority'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Priority</AlertDialogTitle>
            <AlertDialogDescription>
              Delete &quot;{deleteTarget?.name}&quot;? Tasks using this priority must be reassigned first.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteError && <Alert variant="destructive"><AlertDescription>{deleteError}</AlertDescription></Alert>}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-red-600 hover:bg-red-700">
              {deleting ? 'Deleting…' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}
