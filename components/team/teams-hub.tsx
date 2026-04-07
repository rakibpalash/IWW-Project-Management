'use client'

import { useState, useTransition, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Profile, CustomRole } from '@/types'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useToast } from '@/components/ui/use-toast'
import { SmartDeleteDialog } from '@/components/ui/smart-delete-dialog'
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
import { getStaffDeleteImpact } from '@/app/actions/delete-impact'
import { deleteUserAction } from '@/app/actions/user'
import {
  createUserAction,
  updatePersonAction,
} from '@/app/actions/user'
import { addTeamMembersAction, createTeamAction, updateTeamAction, deleteTeamAction } from '@/app/actions/teams'
import {
  Users,
  Plus,
  Search,
  MoreHorizontal,
  Pencil,
  Trash2,
  LayoutList,
  GitBranch,
  ChevronRight,
  Crown,
  Shield,
  Briefcase,
  User,
  Mail,
  Eye,
  EyeOff,
  Building2,
} from 'lucide-react'
import { cn, getInitials } from '@/lib/utils'
import { format, parseISO } from 'date-fns'
import { ROLE_LABELS } from '@/lib/constants'

// ── Types ─────────────────────────────────────────────────────────────────────

interface TeamsHubProps {
  profile: Profile
  allProfiles: Profile[]
  teams: any[]
}

// ── Constants ─────────────────────────────────────────────────────────────────

const AVATAR_COLORS = [
  'bg-pink-500', 'bg-purple-500', 'bg-indigo-500', 'bg-blue-500',
  'bg-cyan-500', 'bg-teal-500', 'bg-green-500', 'bg-orange-500', 'bg-red-500',
]
function avatarColor(name: string) {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

const ROLE_HIERARCHY: { role: string; label: string; icon: React.ReactNode; depth: number }[] = [
  { role: 'super_admin',     label: 'Super Admin',  icon: <Crown className="h-3.5 w-3.5" />,    depth: 0 },
  { role: 'account_manager', label: 'Org Admin',    icon: <Shield className="h-3.5 w-3.5" />,   depth: 1 },
  { role: 'project_manager', label: 'Team Lead',    icon: <Briefcase className="h-3.5 w-3.5" />, depth: 2 },
  { role: 'staff',           label: 'Staff',        icon: <User className="h-3.5 w-3.5" />,      depth: 3 },
  { role: 'client',          label: 'Client',       icon: <Building2 className="h-3.5 w-3.5" />, depth: 0 },
  { role: 'partner',         label: 'Partner',      icon: <Users className="h-3.5 w-3.5" />,     depth: 0 },
]

const ROLE_BADGE: Record<string, string> = {
  super_admin:     'bg-red-50 text-red-700 border-red-200',
  account_manager: 'bg-purple-50 text-purple-700 border-purple-200',
  project_manager: 'bg-blue-50 text-blue-700 border-blue-200',
  staff:           'bg-green-50 text-green-700 border-green-200',
  client:          'bg-amber-50 text-amber-700 border-amber-200',
  partner:         'bg-indigo-50 text-indigo-700 border-indigo-200',
}

const ROLE_OPTIONS = [
  { value: 'account_manager', label: 'Org Admin' },
  { value: 'project_manager', label: 'Team Lead' },
  { value: 'staff',           label: 'Staff' },
  { value: 'client',          label: 'Client' },
  { value: 'partner',         label: 'Partner' },
]

// ── Org Chart ─────────────────────────────────────────────────────────────────

function OrgNodeCard({ person }: { person: Profile }) {
  const rc = ROLE_HIERARCHY.find((r) => r.role === person.role)
  const badgeClass = ROLE_BADGE[person.role] ?? ROLE_BADGE.staff
  return (
    <div className="flex flex-col items-center w-44 bg-card border border-border rounded-xl p-3 shadow-sm hover:shadow-md transition-shadow">
      <Avatar className="h-10 w-10 mb-2">
        <AvatarImage src={person.avatar_url ?? undefined} />
        <AvatarFallback className={`text-xs font-bold text-white ${avatarColor(person.full_name)}`}>
          {getInitials(person.full_name)}
        </AvatarFallback>
      </Avatar>
      <p className="text-xs font-semibold text-foreground text-center leading-tight truncate w-full text-center">{person.full_name}</p>
      {person.custom_role && (
        <p className="text-[10px] text-muted-foreground/70 text-center mt-0.5 truncate w-full">{person.custom_role.name}</p>
      )}
      <span className={cn('mt-1.5 text-[10px] font-medium px-2 py-0.5 rounded-full border', badgeClass)}>
        {ROLE_LABELS[person.role] ?? person.role}
      </span>
    </div>
  )
}

function OrgNode({ person, childrenMap, depth = 0 }: { person: Profile; childrenMap: Record<string, Profile[]>; depth?: number }) {
  const children = childrenMap[person.id] || []
  const isOnly = children.length === 1
  return (
    <div className="flex flex-col items-center">
      <OrgNodeCard person={person} />
      {children.length > 0 && (
        <div className="flex flex-col items-center">
          <div className="w-px h-6 bg-muted" />
          <div className="flex items-start">
            {children.map((child, i) => {
              const isFirst = i === 0
              const isLast = i === children.length - 1
              return (
                <div key={child.id} className="flex flex-col items-center">
                  {!isOnly ? (
                    <div className="flex items-start w-full">
                      <div className={cn('flex-1 h-px bg-muted', isFirst && 'invisible')} />
                      <div className="w-px h-6 bg-muted flex-shrink-0" />
                      <div className={cn('flex-1 h-px bg-muted', isLast && 'invisible')} />
                    </div>
                  ) : (
                    <div className="w-px h-6 bg-muted" />
                  )}
                  <div className={cn(depth < 2 ? 'px-4' : 'px-2')}>
                    <OrgNode person={child} childrenMap={childrenMap} depth={depth + 1} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function OrgChartView({ profiles }: { profiles: Profile[] }) {
  const profileMap = Object.fromEntries(profiles.map((p) => [p.id, p]))
  const childrenMap: Record<string, Profile[]> = {}
  for (const p of profiles) {
    if (p.manager_id && profileMap[p.manager_id]) {
      if (!childrenMap[p.manager_id]) childrenMap[p.manager_id] = []
      childrenMap[p.manager_id].push(p)
    }
  }
  const roots = profiles.filter((p) => !p.manager_id || !profileMap[p.manager_id])
  const hasHierarchy = profiles.some((p) => p.manager_id && profileMap[p.manager_id])

  if (!hasHierarchy) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 py-20 text-center">
        <div className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center mb-4">
          <GitBranch className="h-8 w-8 text-blue-300" />
        </div>
        <h3 className="text-sm font-semibold text-foreground/80 mb-1">No hierarchy set up yet</h3>
        <p className="text-xs text-muted-foreground/70 max-w-xs">Assign a "Reports To" for each person to build the org chart.</p>
      </div>
    )
  }

  return (
    <div className="overflow-auto flex-1 p-8">
      <div className="flex gap-16 justify-center min-w-max pb-8">
        {roots.map((root) => <OrgNode key={root.id} person={root} childrenMap={childrenMap} />)}
      </div>
    </div>
  )
}

// ── People Table ───────────────────────────────────────────────────────────────

function PeopleTable({
  profiles,
  allProfiles,
  teams,
  isAdmin,
  onEdit,
  onDelete,
}: {
  profiles: Profile[]
  allProfiles: Profile[]
  teams: any[]
  isAdmin: boolean
  onEdit: (p: Profile) => void
  onDelete: (p: Profile) => void
}) {
  const [isPending, startTransition] = useTransition()
  const { toast } = useToast()
  const profileMap = Object.fromEntries(allProfiles.map((p) => [p.id, p]))

  // Get team for a profile
  function getTeamForProfile(profileId: string) {
    for (const team of teams) {
      if ((team.members ?? []).some((m: any) => m.user_id === profileId)) return team
    }
    return null
  }

  function handleInlineRoleChange(person: Profile, newRole: string) {
    startTransition(async () => {
      const result = await updatePersonAction(person.id, { role: newRole })
      if (!result.success) toast({ title: 'Failed to update role', description: result.error, variant: 'destructive' })
    })
  }

  function handleInlineManagerChange(person: Profile, managerId: string) {
    startTransition(async () => {
      const result = await updatePersonAction(person.id, { manager_id: managerId === '__none' ? null : managerId })
      if (!result.success) toast({ title: 'Failed to update manager', description: result.error, variant: 'destructive' })
    })
  }

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/30 hover:bg-muted/30">
            <TableHead className="font-semibold text-muted-foreground text-xs uppercase tracking-wide">Person</TableHead>
            <TableHead className="font-semibold text-muted-foreground text-xs uppercase tracking-wide">Role</TableHead>
            <TableHead className="font-semibold text-muted-foreground text-xs uppercase tracking-wide">Reports To</TableHead>
            <TableHead className="font-semibold text-muted-foreground text-xs uppercase tracking-wide">Team</TableHead>
            <TableHead className="font-semibold text-muted-foreground text-xs uppercase tracking-wide">Job Title</TableHead>
            <TableHead className="font-semibold text-muted-foreground text-xs uppercase tracking-wide">Joined</TableHead>
            {isAdmin && <TableHead className="w-10" />}
          </TableRow>
        </TableHeader>
        <TableBody>
          {profiles.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center py-12 text-muted-foreground/70 text-sm">No people found</TableCell>
            </TableRow>
          ) : (
            profiles.map((person) => {
              const badgeClass = ROLE_BADGE[person.role] ?? ROLE_BADGE.staff
              const roleLabel = ROLE_LABELS[person.role] ?? person.role
              const manager = person.manager_id ? profileMap[person.manager_id] : null
              const team = getTeamForProfile(person.id)
              return (
                <TableRow key={person.id} className="hover:bg-muted/30/60">
                  {/* Person */}
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8 flex-shrink-0">
                        <AvatarImage src={person.avatar_url ?? undefined} />
                        <AvatarFallback className={`text-xs font-bold text-white ${avatarColor(person.full_name)}`}>
                          {getInitials(person.full_name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground leading-none">{person.full_name}</p>
                        <p className="text-xs text-muted-foreground/70 mt-0.5 flex items-center gap-1">
                          <Mail className="h-3 w-3 shrink-0" />
                          <span className="truncate max-w-[160px]">{person.email}</span>
                        </p>
                        {person.is_temp_password && (
                          <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-medium mt-0.5 inline-block">
                            Temp Password
                          </span>
                        )}
                      </div>
                    </div>
                  </TableCell>

                  {/* Role — inline edit for admin */}
                  <TableCell>
                    {isAdmin && person.role !== 'super_admin' ? (
                      <Select
                        value={person.role}
                        onValueChange={(v) => handleInlineRoleChange(person, v)}
                        disabled={isPending}
                      >
                        <SelectTrigger className="h-7 text-xs w-[110px] border-0 bg-transparent p-0 focus:ring-0 hover:bg-muted rounded px-2">
                          <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full border', badgeClass)}>
                            {roleLabel}
                          </span>
                        </SelectTrigger>
                        <SelectContent>
                          {ROLE_OPTIONS.map((r) => (
                            <SelectItem key={r.value} value={r.value} className="text-xs">{r.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full border', badgeClass)}>
                        {roleLabel}
                      </span>
                    )}
                  </TableCell>

                  {/* Reports To — inline edit for admin */}
                  <TableCell>
                    {isAdmin ? (
                      <Select
                        value={person.manager_id ?? '__none'}
                        onValueChange={(v) => handleInlineManagerChange(person, v)}
                        disabled={isPending}
                      >
                        <SelectTrigger className="h-7 text-xs border-0 bg-transparent p-0 focus:ring-0 hover:bg-muted rounded px-2 min-w-[120px]">
                          {manager ? (
                            <div className="flex items-center gap-1.5">
                              <Avatar className="h-5 w-5">
                                <AvatarImage src={manager.avatar_url ?? undefined} />
                                <AvatarFallback className={`text-[8px] font-bold text-white ${avatarColor(manager.full_name)}`}>
                                  {getInitials(manager.full_name)}
                                </AvatarFallback>
                              </Avatar>
                              <span className="text-xs text-foreground/80 truncate max-w-[80px]">{manager.full_name}</span>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground/70">Assign manager</span>
                          )}
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none" className="text-xs">No manager</SelectItem>
                          {allProfiles
                            .filter((p) => p.id !== person.id)
                            .map((p) => (
                              <SelectItem key={p.id} value={p.id} className="text-xs">
                                {p.full_name} — {ROLE_LABELS[p.role] ?? p.role}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    ) : manager ? (
                      <div className="flex items-center gap-1.5">
                        <Avatar className="h-5 w-5">
                          <AvatarImage src={manager.avatar_url ?? undefined} />
                          <AvatarFallback className={`text-[8px] font-bold text-white ${avatarColor(manager.full_name)}`}>
                            {getInitials(manager.full_name)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-xs text-foreground/80">{manager.full_name}</span>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground/70">—</span>
                    )}
                  </TableCell>

                  {/* Team */}
                  <TableCell>
                    {team ? (
                      <div className="flex items-center gap-1.5">
                        <div className="h-2 w-2 rounded-full" style={{ backgroundColor: team.color || '#ec4899' }} />
                        <span className="text-xs text-foreground/80">{team.name}</span>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground/70">—</span>
                    )}
                  </TableCell>

                  {/* Job Title */}
                  <TableCell>
                    {person.custom_role ? (
                      <Badge
                        variant="outline"
                        className="text-xs font-medium"
                        style={{
                          backgroundColor: person.custom_role.color + '18',
                          color: person.custom_role.color,
                          borderColor: person.custom_role.color + '40',
                        }}
                      >
                        {person.custom_role.name}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground/70">—</span>
                    )}
                  </TableCell>

                  {/* Joined */}
                  <TableCell>
                    <span className="text-xs text-muted-foreground/70">
                      {person.created_at ? format(parseISO(person.created_at), 'MMM yyyy') : '—'}
                    </span>
                  </TableCell>

                  {/* Actions */}
                  {isAdmin && (
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground/70 transition-colors">
                            <MoreHorizontal className="h-4 w-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => onEdit(person)} className="gap-2">
                            <Pencil className="h-3.5 w-3.5" />Edit
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => onDelete(person)}
                            className="gap-2 text-red-600 focus:text-red-600"
                          >
                            <Trash2 className="h-3.5 w-3.5" />Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  )}
                </TableRow>
              )
            })
          )}
        </TableBody>
      </Table>
    </div>
  )
}

// ── Edit Person Dialog ─────────────────────────────────────────────────────────

function EditPersonDialog({
  person, allProfiles, open, onClose,
}: {
  person: Profile | null; allProfiles: Profile[]; open: boolean; onClose: () => void
}) {
  const { toast } = useToast()
  const [isPending, startTransition] = useTransition()
  const [name, setName] = useState(person?.full_name ?? '')
  const [role, setRole] = useState(person?.role ?? 'staff')
  const [managerId, setManagerId] = useState(person?.manager_id ?? '__none')

  // Sync when person changes
  const personKey = person?.id
  useState(() => {
    if (person) { setName(person.full_name); setRole(person.role); setManagerId(person.manager_id ?? '__none') }
  })

  function handleSave() {
    if (!person) return
    startTransition(async () => {
      const result = await updatePersonAction(person.id, {
        full_name: name.trim(), role,
        manager_id: managerId === '__none' ? null : managerId,
      })
      if (result.success) { toast({ title: 'Person updated' }); onClose() }
      else toast({ title: 'Failed to update', description: result.error, variant: 'destructive' })
    })
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader><DialogTitle>Edit person</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Full name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Role</Label>
            <Select value={role} onValueChange={(v) => setRole(v as typeof role)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ROLE_OPTIONS.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Reports to</Label>
            <Select value={managerId} onValueChange={setManagerId}>
              <SelectTrigger><SelectValue placeholder="No manager" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">No manager</SelectItem>
                {allProfiles.filter((p) => p.id !== person?.id).map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.full_name} — {ROLE_LABELS[p.role] ?? p.role}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>Cancel</Button>
          <Button onClick={handleSave} disabled={isPending || !name.trim()}>
            {isPending ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Add Person Dialog ──────────────────────────────────────────────────────────

function generatePassword() {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#!'
  return Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

// Maps each role to which roles are valid managers for it
const MANAGER_ROLE_FOR: Record<string, string[]> = {
  account_manager: ['super_admin'],                      // Org Admin → CEO
  project_manager: ['account_manager', 'super_admin'],   // Team Lead → Org Admin (or CEO)
  staff:           ['project_manager', 'account_manager'],// Staff → Team Lead (or Org Admin)
  client:          ['super_admin', 'account_manager'],
  partner:         ['super_admin', 'account_manager'],
}

function AddPersonDialog({
  open, onClose, allProfiles, teams,
}: {
  open: boolean; onClose: () => void; allProfiles: Profile[]; teams: any[]
}) {
  const { toast } = useToast()
  const [isPending, startTransition] = useTransition()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('staff')
  const [managerId, setManagerId] = useState('__none')
  const [teamId, setTeamId] = useState('__none')
  const [password, setPassword] = useState(() => generatePassword())
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Filter managers based on the selected role
  const eligibleManagers = allProfiles.filter((p) => {
    const allowed = MANAGER_ROLE_FOR[role]
    return allowed ? allowed.includes(p.role) : true
  })

  // When role changes: reset manager, then auto-select if exactly one match
  function handleRoleChange(newRole: string) {
    setRole(newRole as typeof role)
    const allowed = MANAGER_ROLE_FOR[newRole]
    if (allowed) {
      const matches = allProfiles.filter((p) => allowed.includes(p.role))
      setManagerId(matches.length === 1 ? matches[0].id : '__none')
    } else {
      setManagerId('__none')
    }
  }

  function reset() {
    setFullName(''); setEmail(''); setRole('staff'); setManagerId('__none'); setTeamId('__none')
    setPassword(generatePassword()); setError(null)
  }

  function handleClose() { reset(); onClose() }

  function handleCreate() {
    if (!fullName.trim() || !email.trim()) { setError('Name and email are required'); return }
    setError(null)
    startTransition(async () => {
      const result = await createUserAction({ email: email.trim(), full_name: fullName.trim(), role, password })
      if (!result.success) { setError(result.error ?? 'Failed to create user'); return }
      const userId = result.userId!
      // Set manager if selected
      if (managerId !== '__none') {
        await updatePersonAction(userId, { manager_id: managerId })
      }
      // Add to team if selected
      if (teamId !== '__none') {
        await addTeamMembersAction(teamId, [userId])
      }
      toast({
        title: 'Person added',
        description: `${fullName} was created. Temp password: ${password}`,
        duration: 8000,
      })
      handleClose()
    })
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-blue-50 flex items-center justify-center">
              <Users className="h-4 w-4 text-blue-600" />
            </div>
            Add Person
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-sm">{error}</div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5 col-span-2">
              <Label>Full Name *</Label>
              <Input placeholder="e.g. Jane Smith" value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label>Email *</Label>
              <Input type="email" placeholder="jane@company.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Role</Label>
              <Select value={role} onValueChange={handleRoleChange}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Reports To</Label>
              <Select value={managerId} onValueChange={setManagerId}>
                <SelectTrigger><SelectValue placeholder="No manager" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">No manager</SelectItem>
                  {eligibleManagers.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      <span className="flex items-center gap-2">
                        {p.full_name}
                        <span className="text-xs text-muted-foreground">
                          ({p.role === 'super_admin' ? 'CEO' : p.role === 'account_manager' ? 'Org Admin' : 'Team Lead'})
                        </span>
                      </span>
                    </SelectItem>
                  ))}
                  {eligibleManagers.length === 0 && (
                    <div className="px-3 py-2 text-xs text-muted-foreground">No eligible managers found</div>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Team</Label>
              <Select value={teamId} onValueChange={setTeamId}>
                <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">No team</SelectItem>
                  {teams.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="flex items-center justify-between">
                Password
                <button
                  type="button"
                  className="text-xs text-blue-600 hover:underline"
                  onClick={() => setPassword(generatePassword())}
                >
                  Regenerate
                </button>
              </Label>
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pr-9 font-mono text-xs"
                />
                <button
                  type="button"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/70 hover:text-muted-foreground"
                  onClick={() => setShowPassword((v) => !v)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>
          <p className="text-xs text-muted-foreground/70">
            The person will be prompted to change this password on first login.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isPending}>Cancel</Button>
          <Button onClick={handleCreate} disabled={isPending || !fullName.trim() || !email.trim()}>
            {isPending ? 'Creating…' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────────

export function TeamsHub({ profile, allProfiles, teams }: TeamsHubProps) {
  const router = useRouter()
  const { toast } = useToast()
  const isAdmin = profile.role === 'super_admin'

  const [profiles, setProfiles] = useState<Profile[]>(allProfiles)
  const [localTeams, setLocalTeams] = useState<any[]>(teams)
  const [viewMode, setViewMode] = useState<'table' | 'orgchart'>('table')
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState<'all' | 'role' | 'team'>('all')
  const [filterValue, setFilterValue] = useState<string>('')
  const [editTarget, setEditTarget] = useState<Profile | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Profile | null>(null)
  const [showAddPerson, setShowAddPerson] = useState(false)
  // Group CRUD state
  const [showCreateGroup, setShowCreateGroup] = useState(false)
  const [editGroup, setEditGroup] = useState<any | null>(null)
  const [deleteGroupId, setDeleteGroupId] = useState<string | null>(null)

  // Role counts
  const roleCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const p of profiles) counts[p.role] = (counts[p.role] ?? 0) + 1
    return counts
  }, [profiles])

  // Team counts
  const teamMemberCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const team of localTeams) counts[team.id] = team.members?.length ?? 0
    return counts
  }, [localTeams])

  // Filtered profiles for right panel
  const filteredProfiles = useMemo(() => {
    let result = profiles
    // Role/team filter from left panel
    if (filterType === 'role' && filterValue) {
      result = result.filter((p) => p.role === filterValue)
    } else if (filterType === 'team' && filterValue) {
      const teamMembers = new Set(
        (localTeams.find((t) => t.id === filterValue)?.members ?? []).map((m: any) => m.user_id)
      )
      result = result.filter((p) => teamMembers.has(p.id))
    }
    // Search filter
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(
        (p) => p.full_name.toLowerCase().includes(q) || p.email.toLowerCase().includes(q)
      )
    }
    return result
  }, [profiles, filterType, filterValue, search, teams])

  function setFilter(type: 'all' | 'role' | 'team', value = '') {
    setFilterType(type)
    setFilterValue(value)
    setViewMode('table')
  }

  function handleEditClose() {
    setEditTarget(null)
    router.refresh()
  }

  function handleDeleteClose() {
    setDeleteTarget(null)
  }

  return (
    <div className="flex h-full overflow-hidden bg-background">

      {/* ── Left Panel ── */}
      <div className="w-56 flex-shrink-0 bg-card border-r border-border flex flex-col overflow-y-auto">
        <div className="px-4 py-4 border-b border-border/60">
          <h1 className="text-base font-bold text-foreground">Team & Access</h1>
          <p className="text-xs text-muted-foreground/70 mt-0.5">{profiles.length} members</p>
        </div>

        <nav className="flex-1 px-2 py-3 space-y-0.5">
          {/* All */}
          <button
            onClick={() => setFilter('all')}
            className={cn(
              'w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-sm transition-colors',
              filterType === 'all'
                ? 'bg-blue-50 text-blue-700 font-medium'
                : 'text-muted-foreground hover:bg-muted/30'
            )}
          >
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              All Members
            </div>
            <span className="text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full">{profiles.length}</span>
          </button>

          {/* Role hierarchy */}
          <div className="pt-3 pb-1 px-3">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">By Role</p>
          </div>
          {ROLE_HIERARCHY.map((r) => {
            const count = roleCounts[r.role] ?? 0
            if (count === 0) return null
            const active = filterType === 'role' && filterValue === r.role
            return (
              <button
                key={r.role}
                onClick={() => setFilter('role', r.role)}
                style={{ paddingLeft: `${(r.depth * 12) + 12}px` }}
                className={cn(
                  'w-full flex items-center justify-between gap-2 pr-3 py-1.5 rounded-lg text-sm transition-colors',
                  active ? 'bg-blue-50 text-blue-700 font-medium' : 'text-muted-foreground hover:bg-muted/30'
                )}
              >
                <div className="flex items-center gap-2">
                  {r.depth > 0 && <ChevronRight className="h-3 w-3 text-gray-300 shrink-0" />}
                  <span className="text-muted-foreground/70">{r.icon}</span>
                  <span className="text-xs">{r.label}</span>
                </div>
                <span className="text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full shrink-0">{count}</span>
              </button>
            )
          })}

          {/* Groups section */}
          <div className="pt-3 pb-1 px-3 flex items-center justify-between">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">Groups</p>
            {isAdmin && (
              <button
                onClick={() => setShowCreateGroup(true)}
                className="h-5 w-5 rounded hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                title="Create group"
              >
                <Plus className="h-3 w-3" />
              </button>
            )}
          </div>
          {localTeams.length === 0 && (
            <p className="text-xs text-muted-foreground/50 px-3 py-1.5">No groups yet</p>
          )}
          {localTeams.map((team) => {
            const active = filterType === 'team' && filterValue === team.id
            const count = teamMemberCounts[team.id] ?? 0
            return (
              <div
                key={team.id}
                className={cn(
                  'group relative flex items-center rounded-lg transition-colors',
                  active ? 'bg-blue-50 dark:bg-blue-950/40' : 'hover:bg-muted/30'
                )}
              >
                <button
                  onClick={() => setFilter('team', team.id)}
                  className={cn(
                    'flex-1 flex items-center gap-2 px-3 py-1.5 text-sm min-w-0',
                    active ? 'text-blue-700 font-medium' : 'text-muted-foreground'
                  )}
                >
                  <div className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: team.color || '#ec4899' }} />
                  <span className="text-xs truncate">{team.name}</span>
                </button>
                {isAdmin ? (
                  <div className="flex items-center gap-0.5 mr-1.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <button
                      onClick={(e) => { e.stopPropagation(); setEditGroup(team) }}
                      className="h-5 w-5 flex items-center justify-center rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                      title="Rename"
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setDeleteGroupId(team.id) }}
                      className="h-5 w-5 flex items-center justify-center rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                      title="Delete"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <span className="text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full shrink-0 mr-2">{count}</span>
                )}
              </div>
            )
          })}
        </nav>

        {/* Bottom actions */}
        {isAdmin && (
          <div className="px-3 py-3 border-t border-border/60 space-y-1">
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start gap-2 text-xs text-muted-foreground hover:text-foreground/80 h-8"
              onClick={() => setShowAddPerson(true)}
            >
              <Plus className="h-3.5 w-3.5" />Add person
            </Button>
          </div>
        )}
      </div>

      {/* ── Right Panel ── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <div className="bg-card border-b border-border px-6 py-3 flex items-center gap-3 flex-shrink-0">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/70" />
            <Input
              placeholder="Search people…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9"
            />
          </div>

          <div className="flex items-center gap-1 ml-auto">
            {/* View toggle */}
            <div className="flex items-center rounded-lg border border-border p-0.5 bg-muted/30">
              <button
                onClick={() => setViewMode('table')}
                className={cn(
                  'flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors',
                  viewMode === 'table' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground/80'
                )}
              >
                <LayoutList className="h-3.5 w-3.5" />Table
              </button>
              <button
                onClick={() => setViewMode('orgchart')}
                className={cn(
                  'flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors',
                  viewMode === 'orgchart' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground/80'
                )}
              >
                <GitBranch className="h-3.5 w-3.5" />Org Chart
              </button>
            </div>

            {isAdmin && (
              <Button size="sm" className="h-9 gap-1.5 ml-1" onClick={() => setShowAddPerson(true)}>
                <Plus className="h-4 w-4" />Add Person
              </Button>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {/* Active filter label */}
          {(filterType !== 'all' || search) && (
            <div className="flex items-center gap-2 mb-4">
              <span className="text-sm text-muted-foreground">
                Showing <strong>{filteredProfiles.length}</strong> {filteredProfiles.length === 1 ? 'person' : 'people'}
                {filterType === 'role' && ` · ${ROLE_HIERARCHY.find((r) => r.role === filterValue)?.label ?? filterValue}`}
                {filterType === 'team' && ` · ${localTeams.find((t) => t.id === filterValue)?.name ?? 'Group'}`}
                {search && ` matching "${search}"`}
              </span>
              <button
                onClick={() => { setFilter('all'); setSearch('') }}
                className="text-xs text-blue-600 hover:underline"
              >
                Clear
              </button>
            </div>
          )}

          {viewMode === 'table' ? (
            <PeopleTable
              profiles={filteredProfiles}
              allProfiles={profiles}
              teams={localTeams}
              isAdmin={isAdmin}
              onEdit={setEditTarget}
              onDelete={setDeleteTarget}
            />
          ) : (
            <OrgChartView profiles={filteredProfiles} />
          )}
        </div>
      </div>

      {/* ── Dialogs ── */}
      {editTarget && (
        <EditPersonDialog
          person={editTarget}
          allProfiles={profiles}
          open={!!editTarget}
          onClose={handleEditClose}
        />
      )}

      <AddPersonDialog
        open={showAddPerson}
        onClose={() => { setShowAddPerson(false); router.refresh() }}
        allProfiles={profiles}
        teams={localTeams}
      />

      {deleteTarget && (
        <SmartDeleteDialog
          open={!!deleteTarget}
          onOpenChange={(v) => !v && handleDeleteClose()}
          entityType="staff"
          entityName={deleteTarget.full_name}
          entityId={deleteTarget.id}
          onFetchImpact={() => getStaffDeleteImpact(deleteTarget.id)}
          onConfirmDelete={async (opts) => {
            const result = await deleteUserAction(deleteTarget.id, { reassignToUserId: opts.reassignToUserId })
            if (!result.success) {
              toast({ title: 'Delete failed', description: result.error, variant: 'destructive' })
              return
            }
            toast({ title: 'Person deleted', description: `${deleteTarget.full_name} has been removed.` })
            setProfiles((prev) => prev.filter((p) => p.id !== deleteTarget.id))
            handleDeleteClose()
          }}
        />
      )}

      {/* ── Group CRUD Dialogs ── */}
      <GroupDialog
        open={showCreateGroup}
        onOpenChange={setShowCreateGroup}
        onSave={async (name, color) => {
          const result = await createTeamAction({ name, color, team_type: 'public', memberIds: [] })
          if (!result.success) { toast({ title: 'Failed to create group', description: result.error, variant: 'destructive' }); return }
          setLocalTeams((prev) => [...prev, { ...result.team, members: [] }])
          setShowCreateGroup(false)
          toast({ title: 'Group created', description: `"${name}" was created.` })
        }}
      />

      <GroupDialog
        open={!!editGroup}
        onOpenChange={(open) => { if (!open) setEditGroup(null) }}
        initialName={editGroup?.name ?? ''}
        initialColor={editGroup?.color ?? '#6366f1'}
        title="Rename Group"
        onSave={async (name, color) => {
          if (!editGroup) return
          const result = await updateTeamAction(editGroup.id, { name, color })
          if (!result.success) { toast({ title: 'Failed to update group', description: result.error, variant: 'destructive' }); return }
          setLocalTeams((prev) => prev.map((t) => t.id === editGroup.id ? { ...t, name, color } : t))
          setEditGroup(null)
          toast({ title: 'Group updated' })
        }}
      />

      <AlertDialog open={!!deleteGroupId} onOpenChange={(open) => { if (!open) setDeleteGroupId(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Group</AlertDialogTitle>
            <AlertDialogDescription>
              Delete &quot;{localTeams.find((t) => t.id === deleteGroupId)?.name}&quot;? Members will not be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                if (!deleteGroupId) return
                const result = await deleteTeamAction(deleteGroupId)
                if (!result.success) { toast({ title: 'Failed to delete group', description: result.error, variant: 'destructive' }); return }
                setLocalTeams((prev) => prev.filter((t) => t.id !== deleteGroupId))
                if (filterType === 'team' && filterValue === deleteGroupId) setFilter('all')
                setDeleteGroupId(null)
                toast({ title: 'Group deleted' })
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// ── Group Create/Edit Dialog ───────────────────────────────────────────────────

const GROUP_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e',
  '#f97316', '#eab308', '#22c55e', '#14b8a6', '#3b82f6',
]

function GroupDialog({
  open, onOpenChange, onSave, initialName = '', initialColor = '#6366f1', title = 'Create Group',
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (name: string, color: string) => Promise<void>
  initialName?: string
  initialColor?: string
  title?: string
}) {
  const [name, setName] = useState(initialName)
  const [color, setColor] = useState(initialColor)
  const [isPending, startTransition] = useTransition()

  // Sync when reopened
  useState(() => { setName(initialName); setColor(initialColor) })

  function handleSave() {
    if (!name.trim()) return
    startTransition(async () => { await onSave(name.trim(), color) })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Group Name *</Label>
            <Input
              placeholder="e.g. Design Team"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Color</Label>
            <div className="flex flex-wrap gap-2">
              {GROUP_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={cn(
                    'h-6 w-6 rounded-full transition-all',
                    color === c ? 'ring-2 ring-offset-2 ring-foreground scale-110' : 'hover:scale-105'
                  )}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>Cancel</Button>
          <Button onClick={handleSave} disabled={isPending || !name.trim()}>
            {isPending ? 'Saving…' : title === 'Create Group' ? 'Create' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
