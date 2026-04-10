'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useToast } from '@/components/ui/use-toast'
import {
  Plus, Pencil, Trash2, Loader2, ShieldCheck, Star, Copy,
  Building2, FolderKanban, CheckSquare, Users, Timer, Clock, CalendarDays, Settings,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  RESOURCE_DEFS, ROLE_DEFAULT_PERMISSIONS, PermissionSet,
  Resource, Action, defaultPermissionsForRole,
} from '@/lib/permissions'
import {
  createPermissionTemplateAction,
  updatePermissionTemplateAction,
  deletePermissionTemplateAction,
  PermissionTemplate,
} from '@/app/actions/permission-templates'

// ── Constants ─────────────────────────────────────────────────────────────────

const ROLE_OPTIONS = [
  { value: 'account_manager', label: 'Org Admin',  badge: 'bg-purple-50 text-purple-700 border-purple-200' },
  { value: 'project_manager', label: 'Team Lead',  badge: 'bg-blue-50 text-blue-700 border-blue-200' },
  { value: 'staff',           label: 'Staff',      badge: 'bg-green-50 text-green-700 border-green-200' },
  { value: 'client',          label: 'Client',     badge: 'bg-amber-50 text-amber-700 border-amber-200' },
  { value: 'partner',         label: 'Partner',    badge: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
]

const RESOURCE_ICONS: Record<Resource, React.ElementType> = {
  workspaces: Building2, projects: FolderKanban, tasks: CheckSquare,
  team: Users, timesheet: Timer, attendance: Clock, leave: CalendarDays, settings: Settings,
}

function roleBadge(role: string) {
  return ROLE_OPTIONS.find((r) => r.value === role)?.badge ?? 'bg-gray-50 text-gray-700 border-gray-200'
}
function roleLabel(role: string) {
  return ROLE_OPTIONS.find((r) => r.value === role)?.label ?? role
}

// ── Permission mini-matrix (used inside the dialog) ───────────────────────────

function PermissionEditor({
  role, permissions, onChange,
}: {
  role: string
  permissions: PermissionSet
  onChange: (p: PermissionSet) => void
}) {
  function toggle(resource: Resource, action: Action) {
    const cur = permissions[resource] ?? []
    onChange({
      ...permissions,
      [resource]: cur.includes(action) ? cur.filter((a) => a !== action) : [...cur, action],
    })
  }

  return (
    <div className="space-y-1.5 max-h-80 overflow-y-auto pr-1">
      {RESOURCE_DEFS.map((res) => {
        const Icon = RESOURCE_ICONS[res.key]
        const granted = permissions[res.key] ?? []
        const allOn = res.actions.every((a) => granted.includes(a.key))
        const def = (ROLE_DEFAULT_PERMISSIONS[role] ?? {})[res.key] ?? []

        return (
          <div key={res.key} className="rounded-lg border p-2.5 bg-card">
            <div className="flex items-center gap-2 mb-1.5">
              <Icon className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-semibold">{res.label}</span>
              <button
                type="button"
                onClick={() => onChange({ ...permissions, [res.key]: allOn ? [] : res.actions.map((a) => a.key) })}
                className="ml-auto text-[10px] text-muted-foreground hover:text-foreground underline"
              >
                {allOn ? 'None' : 'All'}
              </button>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {res.actions.map((action) => {
                const on = granted.includes(action.key)
                const changed = on !== def.includes(action.key)
                return (
                  <label key={action.key} className="flex items-center gap-1.5 cursor-pointer">
                    <Checkbox
                      checked={on}
                      onCheckedChange={() => toggle(res.key, action.key)}
                      className={cn('h-3.5 w-3.5', changed && 'border-amber-500 data-[state=checked]:bg-amber-500')}
                    />
                    <span className={cn('text-xs', changed ? 'text-amber-700 font-medium' : 'text-foreground/80')}>
                      {action.label}
                    </span>
                  </label>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Template form dialog ──────────────────────────────────────────────────────

function TemplateDialog({
  open, onClose, editing, onSaved,
}: {
  open: boolean
  onClose: () => void
  editing: PermissionTemplate | null
  onSaved: (t: PermissionTemplate, isNew: boolean) => void
}) {
  const { toast } = useToast()
  const [isPending, startTransition] = useTransition()
  const [name, setName] = useState(editing?.name ?? '')
  const [description, setDescription] = useState(editing?.description ?? '')
  const [baseRole, setBaseRole] = useState(editing?.base_role ?? 'staff')
  const [permissions, setPermissions] = useState<PermissionSet>(
    editing?.permissions ?? defaultPermissionsForRole('staff')
  )
  const [isDefault, setIsDefault] = useState(editing?.is_default ?? false)

  // When role changes in "new" mode, reset permissions to role defaults
  function handleRoleChange(r: string) {
    setBaseRole(r)
    if (!editing) setPermissions(defaultPermissionsForRole(r))
  }

  function handleSave() {
    if (!name.trim()) return
    startTransition(async () => {
      if (editing) {
        const result = await updatePermissionTemplateAction(editing.id, {
          name: name.trim(), description: description.trim() || undefined,
          base_role: baseRole, permissions, is_default: isDefault,
        })
        if (!result.success) { toast({ title: 'Failed', description: result.error, variant: 'destructive' }); return }
        toast({ title: 'Template updated' })
        onSaved({ ...editing, name: name.trim(), description: description.trim() || null, base_role: baseRole, permissions, is_default: isDefault }, false)
      } else {
        const result = await createPermissionTemplateAction({
          name: name.trim(), description: description.trim() || undefined,
          base_role: baseRole, permissions, is_default: isDefault,
        })
        if (!result.success || !result.template) { toast({ title: 'Failed', description: result.error, variant: 'destructive' }); return }
        toast({ title: 'Template created', description: `"${name.trim()}" is ready to use.` })
        onSaved(result.template, true)
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit Template' : 'New Permission Template'}</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto min-h-0 space-y-4 pr-1">
          {/* Name */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Template Name *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Senior Staff" />
            </div>
            <div className="space-y-1.5">
              <Label>Designed For</Label>
              <Select value={baseRole} onValueChange={handleRoleChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map((r) => (
                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Description <span className="text-muted-foreground text-xs">(optional)</span></Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. For senior staff who can approve leave requests" />
          </div>

          {/* Set as default toggle */}
          <label className="flex items-center gap-2.5 p-3 rounded-lg border cursor-pointer hover:bg-muted/30 transition-colors">
            <Checkbox checked={isDefault} onCheckedChange={(v) => setIsDefault(!!v)} />
            <div>
              <p className="text-sm font-medium">Set as default for {roleLabel(baseRole)}</p>
              <p className="text-xs text-muted-foreground">This template will be pre-selected when creating a {roleLabel(baseRole)} user</p>
            </div>
            {isDefault && <Star className="h-4 w-4 text-amber-500 fill-amber-400 ml-auto shrink-0" />}
          </label>

          {/* Permission matrix */}
          <div>
            <p className="text-sm font-semibold mb-2">Permissions</p>
            <p className="text-xs text-muted-foreground mb-3">
              Amber highlights show differences from the {roleLabel(baseRole)} role default.
            </p>
            <PermissionEditor role={baseRole} permissions={permissions} onChange={setPermissions} />
          </div>
        </div>

        <DialogFooter className="shrink-0 pt-2">
          <Button variant="outline" onClick={onClose} disabled={isPending}>Cancel</Button>
          <Button onClick={handleSave} disabled={isPending || !name.trim()}>
            {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            {editing ? 'Save Changes' : 'Create Template'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Main tab component ────────────────────────────────────────────────────────

interface PermissionTemplatesTabProps {
  initialTemplates: PermissionTemplate[]
}

export function PermissionTemplatesTab({ initialTemplates }: PermissionTemplatesTabProps) {
  const { toast } = useToast()
  const [isPending, startTransition] = useTransition()
  const [templates, setTemplates] = useState<PermissionTemplate[]>(initialTemplates)
  const [showDialog, setShowDialog] = useState(false)
  const [editing, setEditing] = useState<PermissionTemplate | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<PermissionTemplate | null>(null)

  // Group by base_role
  const grouped = ROLE_OPTIONS.map((r) => ({
    ...r,
    templates: templates.filter((t) => t.base_role === r.value),
  })).filter((g) => g.templates.length > 0 || true)  // show all role sections

  function handleSaved(t: PermissionTemplate, isNew: boolean) {
    if (isNew) {
      setTemplates((prev) => [...prev, t])
    } else {
      setTemplates((prev) => prev.map((x) => x.id === t.id ? t : x))
    }
    setShowDialog(false)
    setEditing(null)
  }

  function handleEdit(t: PermissionTemplate) {
    setEditing(t)
    setShowDialog(true)
  }

  function handleDuplicate(t: PermissionTemplate) {
    setEditing(null)
    // Pre-fill dialog with duplicate values but clear id
    setEditing({ ...t, id: '', name: `${t.name} (copy)`, is_default: false } as any)
    setShowDialog(true)
  }

  function handleDelete() {
    if (!deleteTarget) return
    startTransition(async () => {
      const result = await deletePermissionTemplateAction(deleteTarget.id)
      if (!result.success) { toast({ title: 'Failed to delete', description: result.error, variant: 'destructive' }); return }
      setTemplates((prev) => prev.filter((t) => t.id !== deleteTarget.id))
      setDeleteTarget(null)
      toast({ title: 'Template deleted' })
    })
  }

  // Count permissions granted for a quick summary
  function permSummary(perms: PermissionSet) {
    let total = 0, granted = 0
    for (const res of RESOURCE_DEFS) {
      total += res.actions.length
      granted += (perms[res.key] ?? []).length
    }
    return { granted, total }
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-base">Permission Templates</h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            Create reusable permission sets to apply when adding new team members.
          </p>
        </div>
        <Button onClick={() => { setEditing(null); setShowDialog(true) }} size="sm">
          <Plus className="h-4 w-4 mr-1.5" />New Template
        </Button>
      </div>

      {/* Role sections */}
      {ROLE_OPTIONS.map((roleOpt) => {
        const roleTemplates = templates.filter((t) => t.base_role === roleOpt.value)
        return (
          <div key={roleOpt.value}>
            <div className="flex items-center gap-2 mb-2">
              <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full border', roleOpt.badge)}>
                {roleOpt.label}
              </span>
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs text-muted-foreground">{roleTemplates.length} template{roleTemplates.length !== 1 ? 's' : ''}</span>
            </div>

            {roleTemplates.length === 0 ? (
              <button
                onClick={() => { setEditing(null); setShowDialog(true) }}
                className="w-full flex items-center gap-2 px-4 py-3 rounded-lg border border-dashed border-border text-sm text-muted-foreground hover:bg-muted/30 hover:border-primary/40 transition-colors"
              >
                <Plus className="h-4 w-4" />
                Add a template for {roleOpt.label}
              </button>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {roleTemplates.map((t) => {
                  const { granted, total } = permSummary(t.permissions)
                  const pct = Math.round((granted / total) * 100)
                  return (
                    <div
                      key={t.id}
                      className="rounded-xl border bg-card p-4 space-y-3 hover:shadow-sm transition-shadow"
                    >
                      {/* Card header */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <ShieldCheck className="h-4 w-4 text-blue-500 shrink-0" />
                            <p className="font-semibold text-sm truncate">{t.name}</p>
                            {t.is_default && (
                              <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-400 shrink-0" title="Default template" />
                            )}
                          </div>
                          {t.description && (
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{t.description}</p>
                          )}
                        </div>
                      </div>

                      {/* Permission progress */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>{granted} of {total} permissions</span>
                          <span>{pct}%</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full bg-blue-500 transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>

                      {/* Permission chips — show resource names that have any access */}
                      <div className="flex flex-wrap gap-1">
                        {RESOURCE_DEFS.filter((res) => (t.permissions[res.key] ?? []).length > 0).map((res) => (
                          <span key={res.key} className="text-[10px] bg-muted px-1.5 py-0.5 rounded-md text-muted-foreground">
                            {res.label}
                          </span>
                        ))}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 pt-1 border-t border-border/50">
                        <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 flex-1"
                          onClick={() => handleEdit(t)}>
                          <Pencil className="h-3 w-3" />Edit
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 flex-1"
                          onClick={() => handleDuplicate(t)}>
                          <Copy className="h-3 w-3" />Duplicate
                        </Button>
                        <Button size="sm" variant="ghost"
                          className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => setDeleteTarget(t)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}

      {/* Template dialog */}
      {showDialog && (
        <TemplateDialog
          open={showDialog}
          onClose={() => { setShowDialog(false); setEditing(null) }}
          editing={editing?.id ? editing : null}
          onSaved={handleSaved}
        />
      )}

      {/* Delete confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete template?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>&quot;{deleteTarget?.name}&quot;</strong> will be permanently deleted. Users who were assigned
              this template will keep their current individual permissions unchanged.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDelete}
              disabled={isPending}
            >
              {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
