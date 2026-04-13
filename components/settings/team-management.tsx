'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Profile, Workspace, WorkspaceAssignment, CustomRole } from '@/types'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { CreateUserDialog } from './create-user-dialog'
import { UserPermissionsDialog } from './user-permissions-dialog'
import { SmartDeleteDialog } from '@/components/ui/smart-delete-dialog'
import { Switch } from '@/components/ui/switch'
import {
  Plus, Search, MoreVertical, UserCog, Loader2, Tag, Crown, Shield,
  Briefcase, User, Trash2, UserCheck, UserX, CheckCircle2, XCircle, ShieldCheck,
  Eye, EyeOff,
} from 'lucide-react'
import { updateUserRoleAction, updatePersonAction, deleteUserAction, toggleUserActiveAction } from '@/app/actions/user'
import { getStaffDeleteImpact } from '@/app/actions/delete-impact'
import { assignCustomRoleToUserAction } from '@/app/actions/custom-roles'
import { getInitials } from '@/lib/utils'
import { cn } from '@/lib/utils'

interface TeamManagementProps {
  users: Profile[]
  workspaces: Workspace[]
  workspaceAssignments: (WorkspaceAssignment & { workspace?: Workspace })[]
  customRoles?: CustomRole[]
}

const ROLE_CONFIG: Record<string, { label: string; badgeClass: string; icon: React.ElementType }> = {
  super_admin:     { label: 'Super Admin', badgeClass: 'bg-red-100 text-red-700 border-red-200',             icon: Crown },
  account_manager: { label: 'Org Admin',   badgeClass: 'bg-purple-100 text-purple-700 border-purple-200',   icon: Shield },
  project_manager: { label: 'Team Lead',   badgeClass: 'bg-blue-100 text-blue-700 border-blue-200',         icon: Briefcase },
  staff:           { label: 'Staff',       badgeClass: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: User },
  client:          { label: 'Client',      badgeClass: 'bg-muted text-muted-foreground border-border',         icon: Briefcase },
  partner:         { label: 'Partner',     badgeClass: 'bg-amber-100 text-amber-700 border-amber-200',       icon: Briefcase },
}

const ROLE_OPTIONS = [
  { value: 'super_admin',     label: 'Super Admin' },
  { value: 'account_manager', label: 'Org Admin' },
  { value: 'project_manager', label: 'Team Lead' },
  { value: 'staff',           label: 'Staff' },
  { value: 'client',          label: 'Client' },
]

const AVATAR_COLORS = [
  'bg-pink-500','bg-purple-500','bg-indigo-500','bg-blue-500',
  'bg-cyan-500','bg-teal-500','bg-green-500','bg-yellow-500','bg-orange-500','bg-red-500',
]
function avatarColor(name: string) {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

interface ToggleConfirm {
  user: Profile
  activating: boolean
}

export function TeamManagement({ users, workspaces, workspaceAssignments, customRoles = [] }: TeamManagementProps) {
  const router = useRouter()
  const [createOpen, setCreateOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null)
  const [assigningRoleUserId, setAssigningRoleUserId] = useState<string | null>(null)
  const [assigningManagerUserId, setAssigningManagerUserId] = useState<string | null>(null)
  const [togglingActiveId, setTogglingActiveId] = useState<string | null>(null)
  const [toggleConfirm, setToggleConfirm] = useState<ToggleConfirm | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Profile | null>(null)
  const [permissionsTarget, setPermissionsTarget] = useState<Profile | null>(null)
  const [tempPasswordTarget, setTempPasswordTarget] = useState<Profile | null>(null)
  const [persons, setPersons] = useState<Profile[]>(users)
  const [revealedPasswords, setRevealedPasswords] = useState<Set<string>>(new Set())

  function toggleRevealPassword(userId: string) {
    setRevealedPasswords((prev) => {
      const next = new Set(prev)
      if (next.has(userId)) next.delete(userId)
      else next.add(userId)
      return next
    })
  }

  const filteredUsers = persons.filter((u) => {
    const matchesSearch =
      search === '' ||
      u.full_name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase())
    const matchesRole = roleFilter === 'all' || u.role === roleFilter
    const isActive = u.is_active !== false // treat undefined/null as active (before migration)
    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'active' && isActive) ||
      (statusFilter === 'inactive' && !isActive)
    return matchesSearch && matchesRole && matchesStatus
  })

  const getUserWorkspaces = (userId: string): Workspace[] => {
    return workspaceAssignments
      .filter((a) => a.user_id === userId && a.workspace)
      .map((a) => a.workspace as Workspace)
  }

  const handleRoleChange = async (userId: string, newRole: string) => {
    setUpdatingUserId(userId)
    setError(null)
    const result = await updateUserRoleAction(userId, newRole)
    setUpdatingUserId(null)
    if (!result.success) {
      setError(result.error ?? 'Failed to update role')
    } else {
      router.refresh()
    }
  }

  const handleManagerChange = async (userId: string, managerId: string | null) => {
    setAssigningManagerUserId(userId)
    setError(null)
    const result = await updatePersonAction(userId, { manager_id: managerId })
    setAssigningManagerUserId(null)
    if (!result.success) {
      setError(result.error ?? 'Failed to update manager')
    } else {
      router.refresh()
    }
  }

  const handleCustomRoleAssign = async (userId: string, customRoleId: string | null) => {
    setAssigningRoleUserId(userId)
    setError(null)
    const result = await assignCustomRoleToUserAction(userId, customRoleId)
    setAssigningRoleUserId(null)
    if (result.error) {
      setError(
        result.error.includes('schema cache') || result.error.includes('does not exist') || result.error.includes('column')
          ? 'Database migration required. Run supabase/migrations/006_custom_roles.sql in your Supabase SQL Editor.'
          : result.error
      )
    } else {
      router.refresh()
    }
  }

  const handleToggleActive = async (user: Profile, activate: boolean) => {
    setTogglingActiveId(user.id)
    setError(null)
    const result = await toggleUserActiveAction(user.id, activate)
    setTogglingActiveId(null)
    if (!result.success) {
      setError(result.error ?? 'Failed to update status')
    } else {
      // Optimistic update
      setPersons((prev) => prev.map((p) => p.id === user.id ? { ...p, is_active: activate } : p))
    }
  }

  const activeCount = persons.filter((p) => p.is_active !== false).length
  const inactiveCount = persons.filter((p) => p.is_active === false).length

  return (
    <div className="space-y-4">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Stats row */}
      <div className="flex gap-3">
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          <span className="text-sm font-medium text-emerald-700">{activeCount} Active</span>
        </div>
        {inactiveCount > 0 && (
          <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2">
            <XCircle className="h-4 w-4 text-red-500" />
            <span className="text-sm font-medium text-red-600">{inactiveCount} Inactive</span>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="All Roles" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Roles</SelectItem>
            {ROLE_OPTIONS.map((r) => (
              <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
          <SelectTrigger className="w-[130px]">
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />Add User
        </Button>
      </div>

      <div className="rounded-xl border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead className="text-xs font-semibold text-muted-foreground">User</TableHead>
              <TableHead className="text-xs font-semibold text-muted-foreground">Status</TableHead>
              <TableHead className="text-xs font-semibold text-muted-foreground">Role</TableHead>
              <TableHead className="text-xs font-semibold text-muted-foreground">Reports To</TableHead>
              <TableHead className="text-xs font-semibold text-muted-foreground">Job Title</TableHead>
              <TableHead className="text-xs font-semibold text-muted-foreground">Spaces</TableHead>
              <TableHead className="w-[50px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredUsers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  No users found
                </TableCell>
              </TableRow>
            ) : (
              filteredUsers.map((user) => {
                const rc = ROLE_CONFIG[user.role] ?? ROLE_CONFIG.staff
                const userWorkspaces = getUserWorkspaces(user.id)
                const isUpdating = updatingUserId === user.id
                const isAssigningRole = assigningRoleUserId === user.id
                const isAssigningManager = assigningManagerUserId === user.id
                const isTogglingActive = togglingActiveId === user.id
                const assignedCustomRole = customRoles.find((r) => r.id === user.custom_role_id)
                const manager = user.manager_id ? users.find((u) => u.id === user.manager_id) : null
                const isActive = user.is_active !== false

                return (
                  <TableRow
                    key={user.id}
                    className={cn('hover:bg-muted/30/50 transition-colors', !isActive && 'bg-red-50/30 opacity-75')}
                  >
                    {/* User */}
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={user.avatar_url ?? undefined} />
                            <AvatarFallback className={`text-xs font-bold text-white ${avatarColor(user.full_name)}`}>
                              {getInitials(user.full_name)}
                            </AvatarFallback>
                          </Avatar>
                          {!isActive && (
                            <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-red-500 border-2 border-white" />
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-medium leading-none">{user.full_name}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{user.email}</p>
                          {user.is_temp_password && (
                            <div className="flex flex-col gap-0.5 mt-1">
                              {user.temp_password_plain ? (
                                <button
                                  type="button"
                                  onClick={() => toggleRevealPassword(user.id)}
                                  className="flex items-center gap-1 text-[10px] bg-amber-100 hover:bg-amber-200 text-amber-700 px-1.5 py-0.5 rounded-full font-medium transition-colors w-fit"
                                  title={revealedPasswords.has(user.id) ? 'Hide password' : 'Click to show password'}
                                >
                                  {revealedPasswords.has(user.id) ? <EyeOff className="h-2.5 w-2.5" /> : <Eye className="h-2.5 w-2.5" />}
                                  Temp Password
                                </button>
                              ) : (
                                <Badge variant="outline" className="text-[10px] h-4 px-1 border-amber-300 text-amber-600 w-fit">
                                  Temp Password
                                </Badge>
                              )}
                              {revealedPasswords.has(user.id) && user.temp_password_plain && (
                                <span className="text-[10px] font-mono bg-amber-50 border border-amber-200 text-amber-800 px-1.5 py-0.5 rounded select-all">
                                  {user.temp_password_plain}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </TableCell>

                    {/* Status */}
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {isTogglingActive ? (
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        ) : (
                          <Switch
                            checked={isActive}
                            onCheckedChange={() => setToggleConfirm({ user, activating: !isActive })}
                            className={isActive ? 'data-[state=checked]:bg-emerald-500' : ''}
                          />
                        )}
                        <span className={cn('text-xs font-medium', isActive ? 'text-emerald-600' : 'text-muted-foreground')}>
                          {isActive ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    </TableCell>

                    {/* Role */}
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border w-fit', rc.badgeClass)}>
                          {rc.label}
                        </span>
                        {user.role !== 'super_admin' && (
                          <button
                            onClick={() => setPermissionsTarget(user)}
                            className="inline-flex items-center gap-1 text-[10px] text-blue-600 hover:underline w-fit"
                          >
                            <ShieldCheck className="h-3 w-3" />
                            Permissions
                          </button>
                        )}
                      </div>
                    </TableCell>

                    {/* Reports To */}
                    <TableCell>
                      {isAssigningManager ? (
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      ) : (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="flex items-center gap-1.5 hover:opacity-80 transition-opacity text-left">
                              {manager ? (
                                <div className="flex items-center gap-1.5">
                                  <Avatar className="h-5 w-5 flex-shrink-0">
                                    <AvatarImage src={manager.avatar_url ?? undefined} />
                                    <AvatarFallback className={`text-[8px] font-bold text-white ${avatarColor(manager.full_name)}`}>
                                      {getInitials(manager.full_name)}
                                    </AvatarFallback>
                                  </Avatar>
                                  <span className="text-xs text-foreground/80">{manager.full_name}</span>
                                </div>
                              ) : (
                                <span className="text-xs text-muted-foreground">Assign manager</span>
                              )}
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start" className="w-52 max-h-64 overflow-y-auto">
                            <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">Reports to</div>
                            <DropdownMenuSeparator />
                            {manager && (
                              <DropdownMenuItem
                                onClick={() => handleManagerChange(user.id, null)}
                                className="text-muted-foreground text-xs"
                              >
                                Remove manager
                              </DropdownMenuItem>
                            )}
                            {users
                              .filter((u) => u.id !== user.id)
                              .map((u) => (
                                <DropdownMenuItem
                                  key={u.id}
                                  onClick={() => handleManagerChange(user.id, u.id)}
                                  className="gap-2 text-xs"
                                >
                                  <Avatar className="h-5 w-5 flex-shrink-0">
                                    <AvatarImage src={u.avatar_url ?? undefined} />
                                    <AvatarFallback className={`text-[8px] font-bold text-white ${avatarColor(u.full_name)}`}>
                                      {getInitials(u.full_name)}
                                    </AvatarFallback>
                                  </Avatar>
                                  <span className="flex-1 truncate">{u.full_name}</span>
                                  <span className="text-[10px] text-muted-foreground/70">{ROLE_CONFIG[u.role]?.label}</span>
                                </DropdownMenuItem>
                              ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </TableCell>

                    {/* Job Title */}
                    <TableCell>
                      {isAssigningRole ? (
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      ) : customRoles.length > 0 ? (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="flex items-center gap-1.5 hover:opacity-80 transition-opacity">
                              {assignedCustomRole ? (
                                <Badge
                                  style={{
                                    backgroundColor: assignedCustomRole.color + '20',
                                    color: assignedCustomRole.color,
                                    borderColor: assignedCustomRole.color + '40',
                                  }}
                                  variant="outline"
                                  className="text-xs font-medium cursor-pointer"
                                >
                                  {assignedCustomRole.name}
                                </Badge>
                              ) : (
                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                  <Tag className="h-3 w-3" />Assign title
                                </span>
                              )}
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start" className="w-48">
                            <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">Job Title</div>
                            <DropdownMenuSeparator />
                            {assignedCustomRole && (
                              <DropdownMenuItem
                                onClick={() => handleCustomRoleAssign(user.id, null)}
                                className="text-muted-foreground text-xs"
                              >
                                Remove title
                              </DropdownMenuItem>
                            )}
                            {customRoles.map((cr) => (
                              <DropdownMenuItem
                                key={cr.id}
                                onClick={() => handleCustomRoleAssign(user.id, cr.id)}
                                className="gap-2 text-xs"
                              >
                                <span className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: cr.color }} />
                                {cr.name}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>

                    {/* Workspaces */}
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {userWorkspaces.length === 0 ? (
                          <span className="text-xs text-muted-foreground">No spaces</span>
                        ) : (
                          userWorkspaces.map((ws) => (
                            <Badge key={ws.id} variant="outline" className="text-xs">{ws.name}</Badge>
                          ))
                        )}
                      </div>
                    </TableCell>

                    {/* Actions */}
                    <TableCell>
                      {isUpdating ? (
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground mx-auto" />
                      ) : (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="icon" variant="ghost" className="h-8 w-8">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {/* View Temp Password */}
                            {user.is_temp_password && user.temp_password_plain && (
                              <>
                                <DropdownMenuItem
                                  onClick={() => setTempPasswordTarget(user)}
                                  className="gap-2 text-xs text-amber-600 focus:text-amber-700"
                                >
                                  <Eye className="h-3.5 w-3.5" />
                                  View Temp Password
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                              </>
                            )}
                            {/* Permissions */}
                            {user.role !== 'super_admin' && (
                              <>
                                <DropdownMenuItem
                                  onClick={() => setPermissionsTarget(user)}
                                  className="gap-2 text-xs"
                                >
                                  <ShieldCheck className="h-3.5 w-3.5 text-blue-500" />
                                  Edit Permissions
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                              </>
                            )}
                            <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">Change Role</div>
                            <DropdownMenuSeparator />
                            {ROLE_OPTIONS.filter((r) => r.value !== user.role).map((r) => (
                              <DropdownMenuItem
                                key={r.value}
                                onClick={() => handleRoleChange(user.id, r.value)}
                                className="gap-2 text-xs"
                              >
                                <UserCog className="h-3.5 w-3.5" />
                                Make {r.label}
                              </DropdownMenuItem>
                            ))}
                            <DropdownMenuSeparator />
                            {user.role !== 'super_admin' && (
                              <DropdownMenuItem
                                onClick={() => setDeleteTarget(user)}
                                className="gap-2 text-xs text-destructive focus:text-destructive"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                Remove user
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      <CreateUserDialog open={createOpen} onOpenChange={setCreateOpen} />

      {permissionsTarget && (
        <UserPermissionsDialog
          open={!!permissionsTarget}
          onClose={() => setPermissionsTarget(null)}
          user={permissionsTarget}
        />
      )}

      {/* Temp Password Dialog */}
      <Dialog open={!!tempPasswordTarget} onOpenChange={(open) => { if (!open) setTempPasswordTarget(null) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-4 w-4 text-amber-500" />
              Temporary Password
            </DialogTitle>
          </DialogHeader>
          {tempPasswordTarget && (
            <div className="space-y-3">
              <div className="flex items-center gap-3 rounded-lg bg-muted/50 px-3 py-2.5">
                <Avatar className="h-8 w-8 shrink-0">
                  <AvatarImage src={tempPasswordTarget.avatar_url ?? undefined} />
                  <AvatarFallback className={`text-xs font-bold text-white ${avatarColor(tempPasswordTarget.full_name)}`}>
                    {getInitials(tempPasswordTarget.full_name)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-medium">{tempPasswordTarget.full_name}</p>
                  <p className="text-xs text-muted-foreground">{tempPasswordTarget.email}</p>
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Temporary Password</p>
                <p className="font-mono text-sm bg-amber-50 border border-amber-200 text-amber-800 px-3 py-2 rounded-md select-all break-all">
                  {tempPasswordTarget.temp_password_plain}
                </p>
              </div>
              <p className="text-xs text-muted-foreground">
                This password will be cleared once the user logs in and changes it.
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Activate / Deactivate confirmation dialog */}
      <AlertDialog open={!!toggleConfirm} onOpenChange={(open) => { if (!open) setToggleConfirm(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {toggleConfirm?.activating ? 'Activate user?' : 'Deactivate user?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {toggleConfirm?.activating ? (
                <>
                  <strong>{toggleConfirm.user.full_name}</strong> will be able to log in and access the platform again.
                </>
              ) : (
                <>
                  <strong>{toggleConfirm?.user.full_name}</strong> will be immediately signed out and blocked from logging in.
                  Their data and task assignments will be preserved.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!toggleConfirm) return
                await handleToggleActive(toggleConfirm.user, toggleConfirm.activating)
                setToggleConfirm(null)
              }}
              className={toggleConfirm?.activating
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                : 'bg-orange-600 hover:bg-orange-700 text-white'
              }
            >
              {toggleConfirm?.activating ? (
                <><UserCheck className="mr-2 h-4 w-4" />Activate</>
              ) : (
                <><UserX className="mr-2 h-4 w-4" />Deactivate</>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {deleteTarget && (
        <SmartDeleteDialog
          open={!!deleteTarget}
          onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}
          entityType="staff"
          entityName={deleteTarget.full_name}
          entityId={deleteTarget.id}
          onFetchImpact={() => getStaffDeleteImpact(deleteTarget.id)}
          onConfirmDelete={async (opts) => {
            const result = await deleteUserAction(deleteTarget.id, { reassignToUserId: opts.reassignToUserId })
            if (!result.success) {
              setError(result.error ?? 'Failed to delete user')
            } else {
              setPersons((prev) => prev.filter((p) => p.id !== deleteTarget.id))
            }
            setDeleteTarget(null)
          }}
        />
      )}
    </div>
  )
}
