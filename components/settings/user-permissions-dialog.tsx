'use client'

import { useState, useEffect, useTransition } from 'react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useToast } from '@/components/ui/use-toast'
import {
  Loader2, RotateCcw, ShieldCheck, ShieldAlert,
  Building2, FolderKanban, CheckSquare, Users,
  Timer, Clock, CalendarDays, Settings,
} from 'lucide-react'
import { cn, getInitials } from '@/lib/utils'
import {
  RESOURCE_DEFS, ROLE_DEFAULT_PERMISSIONS, PermissionSet,
  Resource, Action, defaultPermissionsForRole, isCustomized,
} from '@/lib/permissions'
import {
  getUserPermissionsAction,
  setUserPermissionsAction,
  resetUserPermissionsAction,
} from '@/app/actions/permissions'
import { Profile } from '@/types'

// ── Icon map ──────────────────────────────────────────────────────────────────

const RESOURCE_ICONS: Record<Resource, React.ElementType> = {
  spaces: Building2,
  lists:   FolderKanban,
  tasks:      CheckSquare,
  team:       Users,
  timesheet:  Timer,
  attendance: Clock,
  leave:      CalendarDays,
  settings:   Settings,
}

const ROLE_LABELS: Record<string, string> = {
  super_admin:     'Super Admin',
  account_manager: 'Org Admin',
  project_manager: 'Team Lead',
  staff:           'Staff',
  client:          'Client',
  partner:         'Partner',
}

const ROLE_BADGE: Record<string, string> = {
  super_admin:     'bg-red-50 text-red-700 border-red-200',
  account_manager: 'bg-purple-50 text-purple-700 border-purple-200',
  project_manager: 'bg-blue-50 text-blue-700 border-blue-200',
  staff:           'bg-green-50 text-green-700 border-green-200',
  client:          'bg-amber-50 text-amber-700 border-amber-200',
  partner:         'bg-indigo-50 text-indigo-700 border-indigo-200',
}

const AVATAR_COLORS = [
  'bg-pink-500','bg-purple-500','bg-indigo-500','bg-blue-500',
  'bg-cyan-500','bg-teal-500','bg-green-500','bg-orange-500','bg-red-500',
]
function avatarColor(name: string) {
  let h = 0
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h)
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length]
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface UserPermissionsDialogProps {
  open: boolean
  onClose: () => void
  user: Profile
  /** Optional: pre-load permissions so we avoid an extra fetch */
  initialPermissions?: PermissionSet
  initialIsCustom?: boolean
}

// ── Component ─────────────────────────────────────────────────────────────────

export function UserPermissionsDialog({
  open, onClose, user, initialPermissions, initialIsCustom,
}: UserPermissionsDialogProps) {
  const { toast } = useToast()
  const [isPending, startTransition] = useTransition()
  const [loading, setLoading] = useState(!initialPermissions)
  const [permissions, setPermissions] = useState<PermissionSet>(
    initialPermissions ?? defaultPermissionsForRole(user.role)
  )
  const [isCustom, setIsCustom] = useState(initialIsCustom ?? false)
  const roleDefault = defaultPermissionsForRole(user.role)
  const isSuperAdmin = user.role === 'super_admin'

  // Fetch if not pre-loaded
  useEffect(() => {
    if (!open) return
    if (initialPermissions) { setLoading(false); return }
    setLoading(true)
    getUserPermissionsAction(user.id).then(({ permissions: p, isCustom: c }) => {
      setPermissions(p)
      setIsCustom(c)
      setLoading(false)
    })
  }, [open, user.id, initialPermissions])

  function hasAction(resource: Resource, action: Action): boolean {
    return (permissions[resource] ?? []).includes(action)
  }

  function toggleAction(resource: Resource, action: Action) {
    setPermissions((prev) => {
      const current = prev[resource] ?? []
      const next = current.includes(action)
        ? current.filter((a) => a !== action)
        : [...current, action]
      return { ...prev, [resource]: next }
    })
  }

  function resetToDefaults() {
    setPermissions(defaultPermissionsForRole(user.role))
    setIsCustom(false)
  }

  function handleSave() {
    startTransition(async () => {
      const result = await setUserPermissionsAction(user.id, permissions)
      if (!result.success) {
        toast({ title: 'Failed to save', description: result.error, variant: 'destructive' })
        return
      }
      setIsCustom(isCustomized(user.role, permissions))
      toast({ title: 'Permissions saved', description: `${user.full_name}'s permissions updated.` })
      onClose()
    })
  }

  function handleReset() {
    startTransition(async () => {
      const result = await resetUserPermissionsAction(user.id)
      if (!result.success) {
        toast({ title: 'Failed to reset', description: result.error, variant: 'destructive' })
        return
      }
      resetToDefaults()
      toast({ title: 'Reset to defaults', description: `Using ${ROLE_LABELS[user.role]} template.` })
    })
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader className="shrink-0">
          {/* User identity */}
          <div className="flex items-center gap-3 mb-3">
            <Avatar className="h-10 w-10">
              <AvatarImage src={user.avatar_url ?? undefined} />
              <AvatarFallback className={`text-sm font-bold text-white ${avatarColor(user.full_name)}`}>
                {getInitials(user.full_name)}
              </AvatarFallback>
            </Avatar>
            <div>
              <DialogTitle className="text-base">{user.full_name}</DialogTitle>
              <p className="text-xs text-muted-foreground">{user.email}</p>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full border', ROLE_BADGE[user.role] ?? ROLE_BADGE.staff)}>
                {ROLE_LABELS[user.role] ?? user.role}
              </span>
              {isCustom ? (
                <span className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                  <ShieldAlert className="h-3 w-3" />Custom
                </span>
              ) : (
                <span className="flex items-center gap-1 text-xs text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                  <ShieldCheck className="h-3 w-3" />Default
                </span>
              )}
            </div>
          </div>

          {isSuperAdmin && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
              Super Admin always has full access. Permissions cannot be restricted.
            </div>
          )}
        </DialogHeader>

        {/* Permission matrix — scrollable */}
        <div className="flex-1 overflow-y-auto min-h-0 space-y-1 pr-1">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            RESOURCE_DEFS.map((resource) => {
              const Icon = RESOURCE_ICONS[resource.key]
              const resourcePerms = permissions[resource.key] ?? []
              const defaultPerms = roleDefault[resource.key] ?? []
              const allGranted = resource.actions.every((a) => resourcePerms.includes(a.key))
              const noneGranted = resource.actions.every((a) => !resourcePerms.includes(a.key))

              return (
                <div key={resource.key} className="rounded-lg border bg-card p-3">
                  <div className="flex items-center gap-2 mb-2.5">
                    <div className="h-7 w-7 rounded-md bg-muted flex items-center justify-center">
                      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                    <span className="text-sm font-semibold">{resource.label}</span>
                    {/* Quick "all / none" toggle */}
                    {!isSuperAdmin && (
                      <button
                        type="button"
                        onClick={() => {
                          setPermissions((prev) => ({
                            ...prev,
                            [resource.key]: allGranted ? [] : resource.actions.map((a) => a.key),
                          }))
                        }}
                        className="ml-auto text-[10px] text-muted-foreground hover:text-foreground underline underline-offset-2"
                      >
                        {allGranted ? 'Remove all' : 'Grant all'}
                      </button>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-x-5 gap-y-2">
                    {resource.actions.map((action) => {
                      const granted = isSuperAdmin || resourcePerms.includes(action.key)
                      const isDefault = defaultPerms.includes(action.key)
                      const changed = granted !== isDefault

                      return (
                        <label
                          key={action.key}
                          className={cn(
                            'flex items-center gap-1.5 cursor-pointer select-none group',
                            isSuperAdmin && 'cursor-not-allowed opacity-60'
                          )}
                        >
                          <Checkbox
                            checked={granted}
                            disabled={isSuperAdmin}
                            onCheckedChange={() => toggleAction(resource.key, action.key)}
                            className={cn(
                              'h-4 w-4',
                              changed && !isSuperAdmin && 'border-amber-500 data-[state=checked]:bg-amber-500'
                            )}
                          />
                          <span className={cn(
                            'text-xs',
                            changed && !isSuperAdmin ? 'text-amber-700 font-medium' : 'text-foreground/80'
                          )}>
                            {action.label}
                          </span>
                          {changed && !isSuperAdmin && (
                            <span className="text-[9px] text-amber-500 font-semibold uppercase tracking-wide">
                              {granted ? '+' : '−'}
                            </span>
                          )}
                        </label>
                      )
                    })}
                  </div>
                </div>
              )
            })
          )}
        </div>

        <DialogFooter className="shrink-0 pt-2 flex-row items-center">
          {!isSuperAdmin && isCustom && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleReset}
              disabled={isPending}
              className="mr-auto text-muted-foreground gap-1.5"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset to {ROLE_LABELS[user.role]} defaults
            </Button>
          )}
          <Button variant="outline" onClick={onClose} disabled={isPending}>Cancel</Button>
          <Button onClick={handleSave} disabled={isPending || isSuperAdmin || loading}>
            {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Save Permissions
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Inline read-only permission summary (used in create user dialog) ──────────

export function PermissionMatrix({
  role,
  permissions,
  onChange,
  disabled = false,
}: {
  role: string
  permissions: PermissionSet
  onChange: (p: PermissionSet) => void
  disabled?: boolean
}) {
  const roleDefault = defaultPermissionsForRole(role)
  const isSuperAdmin = role === 'super_admin'

  function toggleAction(resource: Resource, action: Action) {
    const current = permissions[resource] ?? []
    const next = current.includes(action)
      ? current.filter((a) => a !== action)
      : [...current, action]
    onChange({ ...permissions, [resource]: next })
  }

  return (
    <div className="space-y-1">
      {isSuperAdmin && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700 mb-2">
          Super Admin always has full access to everything.
        </div>
      )}
      {RESOURCE_DEFS.map((resource) => {
        const Icon = RESOURCE_ICONS[resource.key]
        const resourcePerms = isSuperAdmin
          ? resource.actions.map((a) => a.key)
          : (permissions[resource.key] ?? [])
        const defaultPerms = roleDefault[resource.key] ?? []
        const allGranted = resource.actions.every((a) => resourcePerms.includes(a.key))

        return (
          <div key={resource.key} className="rounded-lg border bg-card p-3">
            <div className="flex items-center gap-2 mb-2">
              <Icon className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-semibold">{resource.label}</span>
              {!isSuperAdmin && !disabled && (
                <button
                  type="button"
                  onClick={() => onChange({
                    ...permissions,
                    [resource.key]: allGranted ? [] : resource.actions.map((a) => a.key),
                  })}
                  className="ml-auto text-[10px] text-muted-foreground hover:text-foreground underline"
                >
                  {allGranted ? 'None' : 'All'}
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1.5">
              {resource.actions.map((action) => {
                const granted = isSuperAdmin || resourcePerms.includes(action.key)
                const isDefault = defaultPerms.includes(action.key)
                const changed = !isSuperAdmin && granted !== isDefault
                return (
                  <label key={action.key} className={cn('flex items-center gap-1.5 select-none', !disabled && !isSuperAdmin ? 'cursor-pointer' : 'cursor-default opacity-70')}>
                    <Checkbox
                      checked={granted}
                      disabled={disabled || isSuperAdmin}
                      onCheckedChange={() => toggleAction(resource.key, action.key)}
                      className={cn('h-3.5 w-3.5', changed && 'border-amber-500 data-[state=checked]:bg-amber-500')}
                    />
                    <span className={cn('text-xs', changed ? 'text-amber-700 font-medium' : 'text-foreground/75')}>
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
