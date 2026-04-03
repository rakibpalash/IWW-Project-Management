'use client'

import { useState } from 'react'
import { CustomTaskStatus } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import {
  Plus, Pencil, Trash2, ChevronUp, ChevronDown, Star, Check, Loader2,
} from 'lucide-react'
import {
  createTaskStatusAction,
  updateTaskStatusConfigAction,
  deleteTaskStatusAction,
  reorderTaskStatusesAction,
} from '@/app/actions/task-statuses'

const PRESET_COLORS = [
  '#94a3b8', '#64748b', '#22c55e', '#10b981', '#14b8a6',
  '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7',
  '#ec4899', '#f43f5e', '#ef4444', '#f97316', '#f59e0b',
  '#eab308', '#84cc16', '#78716c', '#0ea5e9', '#d946ef',
]

interface Props {
  initialStatuses: CustomTaskStatus[]
}

interface StatusFormData {
  name: string
  slug: string
  color: string
  is_completed_status: boolean
  counts_toward_progress: boolean
}

const emptyForm: StatusFormData = {
  name: '',
  slug: '',
  color: '#94a3b8',
  is_completed_status: false,
  counts_toward_progress: true,
}

function toSlug(name: string): string {
  return name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
}

export function TaskStatusesForm({ initialStatuses }: Props) {
  const [statuses, setStatuses] = useState<CustomTaskStatus[]>(initialStatuses)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<StatusFormData>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<CustomTaskStatus | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [reordering, setReordering] = useState(false)

  function openAdd() {
    setEditingId(null)
    setForm(emptyForm)
    setError(null)
    setDialogOpen(true)
  }

  function openEdit(s: CustomTaskStatus) {
    setEditingId(s.id)
    setForm({
      name: s.name,
      slug: s.slug,
      color: s.color,
      is_completed_status: s.is_completed_status,
      counts_toward_progress: s.counts_toward_progress,
    })
    setError(null)
    setDialogOpen(true)
  }

  async function handleSave() {
    if (!form.name.trim()) { setError('Name is required'); return }
    if (!form.slug.trim()) { setError('Slug is required'); return }
    if (!/^[a-z0-9_]+$/.test(form.slug)) { setError('Slug must be lowercase letters, numbers, underscores only'); return }

    setSaving(true)
    setError(null)

    if (editingId) {
      const result = await updateTaskStatusConfigAction(editingId, {
        name: form.name.trim(),
        color: form.color,
        is_completed_status: form.is_completed_status,
        counts_toward_progress: form.counts_toward_progress,
      })
      if (!result.success) { setError(result.error ?? 'Failed to save'); setSaving(false); return }
      setStatuses((prev) => prev.map((s) => s.id === editingId
        ? { ...s, name: form.name.trim(), color: form.color, is_completed_status: form.is_completed_status, counts_toward_progress: form.counts_toward_progress }
        : s
      ))
    } else {
      // Check slug uniqueness client-side first
      if (statuses.some((s) => s.slug === form.slug.trim())) {
        setError('A status with this slug already exists'); setSaving(false); return
      }
      const result = await createTaskStatusAction(form)
      if (!result.success) { setError(result.error ?? 'Failed to create'); setSaving(false); return }
      if (result.status) setStatuses((prev) => [...prev, result.status!])
    }

    setSaving(false)
    setDialogOpen(false)
  }

  async function handleToggleActive(s: CustomTaskStatus) {
    if (s.is_default && s.is_active) return // can't deactivate default
    setTogglingId(s.id)
    const result = await updateTaskStatusConfigAction(s.id, { is_active: !s.is_active })
    if (result.success) {
      setStatuses((prev) => prev.map((x) => x.id === s.id ? { ...x, is_active: !x.is_active } : x))
    }
    setTogglingId(null)
  }

  async function handleSetDefault(s: CustomTaskStatus) {
    if (s.is_default) return
    setTogglingId(s.id)
    const result = await updateTaskStatusConfigAction(s.id, { is_default: true })
    if (result.success) {
      setStatuses((prev) => prev.map((x) => ({ ...x, is_default: x.id === s.id })))
    }
    setTogglingId(null)
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    setDeleteError(null)
    const result = await deleteTaskStatusAction(deleteTarget.id)
    if (!result.success) {
      setDeleteError(result.error ?? 'Failed to delete')
      setDeleting(false)
      return
    }
    setStatuses((prev) => prev.filter((s) => s.id !== deleteTarget.id))
    setDeleteTarget(null)
    setDeleting(false)
  }

  async function handleReorder(index: number, direction: 'up' | 'down') {
    const newList = [...statuses]
    const swapIndex = direction === 'up' ? index - 1 : index + 1
    if (swapIndex < 0 || swapIndex >= newList.length) return
    ;[newList[index], newList[swapIndex]] = [newList[swapIndex], newList[index]]
    setStatuses(newList)
    setReordering(true)
    await reorderTaskStatusesAction(newList.map((s) => s.id))
    setReordering(false)
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">Task Statuses</CardTitle>
            <CardDescription className="mt-1">
              Configure the statuses available for tasks and subtasks. Drag to reorder.
            </CardDescription>
          </div>
          <Button size="sm" onClick={openAdd}>
            <Plus className="h-4 w-4 mr-1.5" />
            Add Status
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-2">
        {statuses.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">No statuses configured yet.</p>
        )}

        {statuses.map((s, index) => (
          <div
            key={s.id}
            className={`flex items-center gap-3 rounded-lg border px-4 py-3 transition-opacity ${!s.is_active ? 'opacity-50' : ''}`}
          >
            {/* Color dot */}
            <div className="h-4 w-4 rounded-full shrink-0 border" style={{ backgroundColor: s.color }} />

            {/* Name + slug */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">{s.name}</p>
              <p className="text-xs text-muted-foreground font-mono">{s.slug}</p>
            </div>

            {/* Badges */}
            <div className="hidden sm:flex items-center gap-1.5">
              {s.is_default && (
                <Badge className="text-xs bg-blue-100 text-blue-700 border-blue-200">Default</Badge>
              )}
              {s.is_completed_status && (
                <Badge className="text-xs bg-green-100 text-green-700 border-green-200">Done</Badge>
              )}
              {!s.counts_toward_progress && (
                <Badge className="text-xs bg-gray-100 text-gray-600 border-gray-200">No Progress</Badge>
              )}
              {!s.is_active && (
                <Badge className="text-xs bg-red-100 text-red-600 border-red-200">Inactive</Badge>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1 shrink-0">
              {/* Set default */}
              <button
                title="Set as default"
                disabled={s.is_default || togglingId === s.id}
                onClick={() => handleSetDefault(s)}
                className={`p-1.5 rounded-md transition-colors ${s.is_default ? 'text-blue-500' : 'text-muted-foreground hover:text-blue-500 hover:bg-blue-50'}`}
              >
                <Star className="h-3.5 w-3.5" fill={s.is_default ? 'currentColor' : 'none'} />
              </button>

              {/* Toggle active */}
              <Switch
                checked={s.is_active}
                disabled={togglingId === s.id || (s.is_default && s.is_active)}
                onCheckedChange={() => handleToggleActive(s)}
                className="h-5 w-9"
              />

              {/* Reorder */}
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
                disabled={index === statuses.length - 1 || reordering}
                onClick={() => handleReorder(index, 'down')}
                className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30"
              >
                <ChevronDown className="h-3.5 w-3.5" />
              </button>

              {/* Edit */}
              <button
                title="Edit"
                onClick={() => openEdit(s)}
                className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>

              {/* Delete */}
              <button
                title="Delete"
                onClick={() => { setDeleteTarget(s); setDeleteError(null) }}
                disabled={s.is_default}
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
            <DialogTitle>{editingId ? 'Edit Status' : 'Add Status'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Name</Label>
                <Input
                  value={form.name}
                  onChange={(e) => {
                    const name = e.target.value
                    setForm((f) => ({
                      ...f,
                      name,
                      slug: editingId ? f.slug : toSlug(name),
                    }))
                  }}
                  placeholder="e.g. In Review"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Slug {editingId && <span className="text-xs text-muted-foreground">(not editable)</span>}</Label>
                <Input
                  value={form.slug}
                  readOnly={!!editingId}
                  onChange={(e) => !editingId && setForm((f) => ({ ...f, slug: toSlug(e.target.value) }))}
                  placeholder="e.g. in_review"
                  className={editingId ? 'bg-muted font-mono text-sm' : 'font-mono text-sm'}
                />
              </div>
            </div>

            {/* Color picker */}
            <div className="space-y-1.5">
              <Label>Color</Label>
              <div className="flex items-center gap-2">
                <div
                  className="h-8 w-8 rounded-md border-2 border-border shrink-0"
                  style={{ backgroundColor: form.color }}
                />
                <div className="flex flex-wrap gap-1.5">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, color: c }))}
                      className="h-6 w-6 rounded-md border-2 transition-transform hover:scale-110"
                      style={{
                        backgroundColor: c,
                        borderColor: form.color === c ? '#1d4ed8' : 'transparent',
                      }}
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

            <Separator />

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Mark as completed</p>
                  <p className="text-xs text-muted-foreground">Tasks with this status count as done</p>
                </div>
                <Switch
                  checked={form.is_completed_status}
                  onCheckedChange={(v) => setForm((f) => ({ ...f, is_completed_status: v }))}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Count toward progress</p>
                  <p className="text-xs text-muted-foreground">Include in project progress calculation</p>
                </div>
                <Switch
                  checked={form.counts_toward_progress}
                  onCheckedChange={(v) => setForm((f) => ({ ...f, counts_toward_progress: v }))}
                />
              </div>
            </div>

            {/* Preview */}
            <div className="flex items-center gap-2 rounded-md bg-muted/40 px-3 py-2">
              <span className="text-xs text-muted-foreground">Preview:</span>
              <span
                className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border"
                style={{
                  backgroundColor: form.color + '20',
                  color: form.color,
                  borderColor: form.color + '40',
                }}
              >
                {form.name || 'Status Name'}
              </span>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingId ? 'Save Changes' : 'Create Status'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Status</AlertDialogTitle>
            <AlertDialogDescription>
              Delete &quot;{deleteTarget?.name}&quot;? This cannot be undone. Tasks using this status must be reassigned first.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteError && (
            <Alert variant="destructive">
              <AlertDescription>{deleteError}</AlertDescription>
            </Alert>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleting ? 'Deleting…' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}
