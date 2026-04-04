'use client'

import { useState, useTransition } from 'react'
import { CustomRole } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
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
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Plus, Pencil, Trash2, Loader2, Tag } from 'lucide-react'
import {
  createCustomRoleAction,
  updateCustomRoleAction,
  deleteCustomRoleAction,
} from '@/app/actions/custom-roles'

// Preset colors for quick selection
const PRESET_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444',
  '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#06b6d4', '#3b82f6', '#64748b', '#1e293b',
]

interface RoleFormData {
  name: string
  color: string
  description: string
}

const EMPTY_FORM: RoleFormData = { name: '', color: '#6366f1', description: '' }

interface CustomRolesTabProps {
  initialRoles: CustomRole[]
}

export function CustomRolesTab({ initialRoles }: CustomRolesTabProps) {
  const [roles, setRoles] = useState<CustomRole[]>(initialRoles)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<CustomRole | null>(null)
  const [form, setForm] = useState<RoleFormData>(EMPTY_FORM)
  const [deleteTarget, setDeleteTarget] = useState<CustomRole | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const openCreate = () => {
    setEditing(null)
    setForm(EMPTY_FORM)
    setError(null)
    setDialogOpen(true)
  }

  const openEdit = (role: CustomRole) => {
    setEditing(role)
    setForm({ name: role.name, color: role.color, description: role.description ?? '' })
    setError(null)
    setDialogOpen(true)
  }

  const handleSave = () => {
    if (!form.name.trim()) {
      setError('Role name is required')
      return
    }
    setError(null)
    startTransition(async () => {
      if (editing) {
        const result = await updateCustomRoleAction(editing.id, {
          name: form.name.trim(),
          color: form.color,
          description: form.description.trim() || undefined,
        })
        if (result.error) { setError(result.error); return }
        setRoles((prev) =>
          prev.map((r) => (r.id === editing.id ? { ...r, ...form, name: form.name.trim() } : r))
        )
      } else {
        const result = await createCustomRoleAction({
          name: form.name.trim(),
          color: form.color,
          description: form.description.trim() || undefined,
        })
        if (result.error) { setError(result.error); return }
        if (result.role) setRoles((prev) => [...prev, result.role as CustomRole])
      }
      setDialogOpen(false)
    })
  }

  const handleDelete = () => {
    if (!deleteTarget) return
    startTransition(async () => {
      const result = await deleteCustomRoleAction(deleteTarget.id)
      if (result.error) { setError(result.error); return }
      setRoles((prev) => prev.filter((r) => r.id !== deleteTarget.id))
      setDeleteTarget(null)
    })
  }

  return (
    <div className="space-y-4">
      {error && !dialogOpen && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            Create job title roles (e.g. Team Lead, Designer) to assign to team members.
          </p>
        </div>
        <Button onClick={openCreate} size="sm">
          <Plus className="mr-2 h-4 w-4" />
          New Role
        </Button>
      </div>

      {roles.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center">
          <Tag className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
          <p className="text-sm font-medium">No custom roles yet</p>
          <p className="text-xs text-muted-foreground mt-1">
            Create roles like &quot;Team Lead&quot; or &quot;Designer&quot; to assign to staff.
          </p>
          <Button onClick={openCreate} size="sm" className="mt-4">
            <Plus className="mr-2 h-4 w-4" />
            Create First Role
          </Button>
        </div>
      ) : (
        <div className="rounded-md border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Role</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Description</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground w-[80px]"></th>
              </tr>
            </thead>
            <tbody>
              {roles.map((role) => (
                <tr key={role.id} className="border-b last:border-0 hover:bg-gray-50/50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span
                        className="h-3 w-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: role.color }}
                      />
                      <Badge
                        style={{
                          backgroundColor: role.color + '20',
                          color: role.color,
                          borderColor: role.color + '40',
                        }}
                        variant="outline"
                        className="font-medium text-xs"
                      >
                        {role.name}
                      </Badge>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    {role.description ?? <span className="italic">No description</span>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => openEdit(role)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => setDeleteTarget(role)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Role' : 'Create New Role'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Role Name *</label>
              <Input
                placeholder="e.g. Team Lead, Designer, Account Manager"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Color</label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={form.color}
                  onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
                  className="h-9 w-9 rounded cursor-pointer border border-input p-0.5"
                />
                <div className="flex flex-wrap gap-1.5">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      className="h-6 w-6 rounded-full border-2 transition-all"
                      style={{
                        backgroundColor: c,
                        borderColor: form.color === c ? c : 'transparent',
                        outline: form.color === c ? `2px solid ${c}` : 'none',
                        outlineOffset: '2px',
                      }}
                      onClick={() => setForm((f) => ({ ...f, color: c }))}
                    />
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <span
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: form.color }}
                />
                <span className="text-xs text-muted-foreground">Preview:</span>
                <Badge
                  style={{
                    backgroundColor: form.color + '20',
                    color: form.color,
                    borderColor: form.color + '40',
                  }}
                  variant="outline"
                  className="text-xs font-medium"
                >
                  {form.name || 'Role Name'}
                </Badge>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Description</label>
              <Textarea
                placeholder="Optional description for this role..."
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                rows={2}
                className="resize-none"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editing ? 'Save Changes' : 'Create Role'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Role</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{deleteTarget?.name}</strong>? Users assigned
              this role will have it removed automatically.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
