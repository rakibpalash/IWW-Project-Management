'use client'

import { useState, useTransition, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Profile } from '@/types'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  GitBranch, Users, User, Search, Plus, ChevronRight,
  Globe, Lock, Mail, Shield, Briefcase,
  MoreHorizontal, Pencil, Trash2, UserPlus, Crown,
} from 'lucide-react'
import { cn, getInitials } from '@/lib/utils'
import { CreateTeamDialog } from './create-team-dialog'
import { CreateUserDialog } from '@/components/settings/create-user-dialog'
import { format, parseISO } from 'date-fns'
import { deleteUserAction, updatePersonAction } from '@/app/actions/user'
import { deleteTeamAction, updateTeamAction } from '@/app/actions/teams'
import { useToast } from '@/components/ui/use-toast'

// ── Config ─────────────────────────────────────────────────────────────────────

interface TeamsHubProps {
  profile: Profile
  allProfiles: Profile[]
  teams: any[]
}

type Section = 'org-chart' | 'people' | 'teams'

const ROLE_CONFIG: Record<string, {
  label: string
  badgeClass: string
  icon: React.ElementType
}> = {
  super_admin:     { label: 'Super Admin', badgeClass: 'bg-red-100 text-red-700 border-red-200',             icon: Crown },
  account_manager: { label: 'Org Admin',   badgeClass: 'bg-purple-100 text-purple-700 border-purple-200',   icon: Shield },
  project_manager: { label: 'Team Lead',   badgeClass: 'bg-blue-100 text-blue-700 border-blue-200',         icon: Briefcase },
  staff:           { label: 'Staff',       badgeClass: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: User },
  client:          { label: 'Client',      badgeClass: 'bg-gray-100 text-gray-600 border-gray-200',         icon: Briefcase },
}

const ROLE_OPTIONS = [
  { value: 'super_admin',     label: 'Super Admin' },
  { value: 'account_manager', label: 'Org Admin' },
  { value: 'project_manager', label: 'Team Lead' },
  { value: 'staff',           label: 'Staff' },
  { value: 'client',          label: 'Client' },
]

const AVATAR_COLORS = [
  'bg-pink-500', 'bg-purple-500', 'bg-indigo-500', 'bg-blue-500',
  'bg-cyan-500', 'bg-teal-500', 'bg-green-500', 'bg-yellow-500',
  'bg-orange-500', 'bg-red-500',
]

function avatarColor(name: string) {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

// ── Org Chart ─────────────────────────────────────────────────────────────────

function OrgNodeCard({ person }: { person: Profile }) {
  const rc = ROLE_CONFIG[person.role] ?? ROLE_CONFIG.staff
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-3 flex flex-col items-center gap-2 w-40 hover:shadow-md hover:border-blue-200 transition-all">
      <Avatar className="h-11 w-11">
        <AvatarImage src={person.avatar_url ?? undefined} />
        <AvatarFallback className={`text-xs font-bold text-white ${avatarColor(person.full_name)}`}>
          {getInitials(person.full_name)}
        </AvatarFallback>
      </Avatar>
      <div className="text-center w-full min-w-0">
        <p className="text-xs font-semibold text-gray-900 leading-tight truncate">{person.full_name}</p>
        {person.custom_role && (
          <p className="text-[10px] text-gray-400 mt-0.5 truncate">{person.custom_role.name}</p>
        )}
      </div>
      <span className={cn('text-[10px] font-medium px-2 py-0.5 rounded-full border', rc.badgeClass)}>
        {rc.label}
      </span>
    </div>
  )
}

function OrgNode({
  person,
  childrenMap,
  depth = 0,
}: {
  person: Profile
  childrenMap: Record<string, Profile[]>
  depth?: number
}) {
  const children = childrenMap[person.id] || []
  const isOnly = children.length === 1

  return (
    <div className="flex flex-col items-center">
      <OrgNodeCard person={person} />
      {children.length > 0 && (
        <div className="flex flex-col items-center">
          <div className="w-px h-6 bg-gray-200 flex-shrink-0" />
          <div className="flex items-start">
            {children.map((child, i) => {
              const isFirst = i === 0
              const isLast = i === children.length - 1
              return (
                <div key={child.id} className="flex flex-col items-center">
                  {!isOnly ? (
                    <div className="flex items-start w-full">
                      <div className={cn('flex-1 h-px bg-gray-200', isFirst && 'invisible')} />
                      <div className="w-px h-6 bg-gray-200 flex-shrink-0" />
                      <div className={cn('flex-1 h-px bg-gray-200', isLast && 'invisible')} />
                    </div>
                  ) : (
                    <div className="w-px h-6 bg-gray-200" />
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

function OrgChartSection({ profiles }: { profiles: Profile[] }) {
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
      <div className="flex flex-col items-center justify-center py-24 text-center flex-1">
        <div className="w-20 h-20 rounded-2xl bg-blue-50 flex items-center justify-center mb-5">
          <GitBranch className="h-10 w-10 text-blue-300" />
        </div>
        <h3 className="text-base font-semibold text-gray-700 mb-2">No hierarchy set up yet</h3>
        <p className="text-sm text-gray-400 max-w-xs leading-relaxed">
          Go to{' '}
          <span className="text-blue-600 font-medium">Settings → Team Management</span>{' '}
          and assign a manager to each person to build your org chart.
        </p>
      </div>
    )
  }

  return (
    <div className="overflow-auto p-8 flex-1">
      <div className="flex gap-16 justify-center min-w-max pb-8">
        {roots.map((root) => (
          <OrgNode key={root.id} person={root} childrenMap={childrenMap} />
        ))}
      </div>
    </div>
  )
}

// ── People Table ───────────────────────────────────────────────────────────────

function PeopleSection({
  profiles,
  isAdmin,
  onEdit,
  onDelete,
}: {
  profiles: Profile[]
  isAdmin: boolean
  onEdit: (p: Profile) => void
  onDelete: (p: Profile) => void
}) {
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const profileMap = Object.fromEntries(profiles.map((p) => [p.id, p]))

  const filtered = profiles.filter((p) => {
    const matchSearch =
      !search ||
      p.full_name.toLowerCase().includes(search.toLowerCase()) ||
      p.email.toLowerCase().includes(search.toLowerCase())
    const matchRole = roleFilter === 'all' || p.role === roleFilter
    return matchSearch && matchRole
  })

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="flex items-center gap-3 flex-wrap px-6 py-4 border-b border-gray-100 flex-shrink-0">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search people..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="All roles" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All roles</SelectItem>
            {ROLE_OPTIONS.map((r) => (
              <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-sm text-gray-400">{filtered.length} member{filtered.length !== 1 ? 's' : ''}</span>
      </div>
      <div className="overflow-auto flex-1 px-6 py-4">
        <div className="rounded-xl border border-gray-200 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50 hover:bg-gray-50">
                <TableHead className="font-semibold text-gray-600 text-xs">Person</TableHead>
                <TableHead className="font-semibold text-gray-600 text-xs">Role</TableHead>
                <TableHead className="font-semibold text-gray-600 text-xs">Reports To</TableHead>
                <TableHead className="font-semibold text-gray-600 text-xs">Job Title</TableHead>
                <TableHead className="font-semibold text-gray-600 text-xs">Joined</TableHead>
                {isAdmin && <TableHead className="w-10" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-gray-400 text-sm">
                    No people found
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((person) => {
                  const rc = ROLE_CONFIG[person.role] ?? ROLE_CONFIG.staff
                  const manager = person.manager_id ? profileMap[person.manager_id] : null
                  return (
                    <TableRow key={person.id} className="hover:bg-gray-50/50">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8 flex-shrink-0">
                            <AvatarImage src={person.avatar_url ?? undefined} />
                            <AvatarFallback className={`text-xs font-bold text-white ${avatarColor(person.full_name)}`}>
                              {getInitials(person.full_name)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-900 leading-none">{person.full_name}</p>
                            <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                              <Mail className="h-3 w-3 flex-shrink-0" />
                              <span className="truncate max-w-[180px]">{person.email}</span>
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full border', rc.badgeClass)}>
                          {rc.label}
                        </span>
                      </TableCell>
                      <TableCell>
                        {manager ? (
                          <div className="flex items-center gap-2">
                            <Avatar className="h-5 w-5 flex-shrink-0">
                              <AvatarImage src={manager.avatar_url ?? undefined} />
                              <AvatarFallback className={`text-[8px] font-bold text-white ${avatarColor(manager.full_name)}`}>
                                {getInitials(manager.full_name)}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-sm text-gray-700">{manager.full_name}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </TableCell>
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
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-gray-400">
                          {format(parseISO(person.created_at), 'MMM yyyy')}
                        </span>
                      </TableCell>
                      {isAdmin && (
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-gray-100 text-gray-400 transition-colors">
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
      </div>
    </div>
  )
}

// ── Teams Grid ─────────────────────────────────────────────────────────────────

function TeamCard({
  team, isAdmin, onClick, onEdit, onDelete,
}: {
  team: any; isAdmin: boolean
  onClick: () => void; onEdit: () => void; onDelete: () => void
}) {
  const memberCount = team.members?.length ?? 0
  const previewMembers = (team.members ?? []).slice(0, 4)
  return (
    <div
      className="group relative bg-white border border-gray-200 rounded-xl p-5 hover:shadow-md hover:border-gray-300 transition-all cursor-pointer"
      onClick={onClick}
    >
      <div className="h-1.5 w-12 rounded-full mb-4" style={{ backgroundColor: team.color || '#ec4899' }} />
      <div className="flex items-start gap-3 mb-3">
        <div
          className="h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: team.color || '#ec4899' }}
        >
          <Users className="h-5 w-5 text-white" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-sm text-gray-900 group-hover:text-blue-600 transition-colors truncate">
            {team.name}
          </h3>
          {team.description && <p className="text-xs text-gray-400 truncate mt-0.5">{team.description}</p>}
        </div>
        {isAdmin && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                onClick={(e) => e.stopPropagation()}
                className="opacity-0 group-hover:opacity-100 transition-opacity h-7 w-7 flex items-center justify-center rounded-md hover:bg-gray-100 text-gray-400"
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
              <DropdownMenuItem onClick={onEdit} className="gap-2">
                <Pencil className="h-3.5 w-3.5" />Edit team
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onDelete} className="gap-2 text-red-600 focus:text-red-600">
                <Trash2 className="h-3.5 w-3.5" />Delete team
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
      <div className="flex items-center justify-between mt-2">
        <div className="flex -space-x-1.5">
          {previewMembers.map((m: any) => (
            <Avatar key={m.id} className="h-6 w-6 border-2 border-white">
              <AvatarImage src={m.profile?.avatar_url ?? undefined} />
              <AvatarFallback className={`text-[9px] font-bold text-white ${avatarColor(m.profile?.full_name ?? 'U')}`}>
                {getInitials(m.profile?.full_name ?? 'U')}
              </AvatarFallback>
            </Avatar>
          ))}
          {memberCount > 4 && (
            <div className="h-6 w-6 rounded-full border-2 border-white bg-gray-100 flex items-center justify-center text-[9px] font-semibold text-gray-600">
              +{memberCount - 4}
            </div>
          )}
        </div>
        <span className="text-xs text-gray-400">{memberCount} member{memberCount !== 1 ? 's' : ''}</span>
      </div>
    </div>
  )
}

function TeamsSection({
  teams, isAdmin, onTeamClick, onEditTeam, onDeleteTeam, onCreateTeam,
}: {
  teams: any[]
  isAdmin: boolean
  onTeamClick: (id: string) => void
  onEditTeam: (team: any) => void
  onDeleteTeam: (team: any) => void
  onCreateTeam: () => void
}) {
  const [search, setSearch] = useState('')
  const filtered = teams.filter((t) => !search || t.name.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100 flex-shrink-0">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search teams..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>
      <div className="flex-1 overflow-auto p-6">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 border border-dashed border-gray-200 rounded-2xl bg-gray-50">
            <Users className="h-12 w-12 text-gray-200 mb-4" />
            <h3 className="text-sm font-semibold text-gray-500 mb-1">
              {search ? 'No teams found' : 'No teams yet'}
            </h3>
            <p className="text-xs text-gray-400">{search ? 'Try a different search' : 'Create your first team to get started'}</p>
            {!search && (
              <Button size="sm" className="mt-4" onClick={onCreateTeam}>
                <Plus className="h-4 w-4 mr-1" />Create team
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map((team) => (
              <TeamCard
                key={team.id}
                team={team}
                isAdmin={isAdmin}
                onClick={() => onTeamClick(team.id)}
                onEdit={() => onEditTeam(team)}
                onDelete={() => onDeleteTeam(team)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Edit Person Dialog ─────────────────────────────────────────────────────────

function EditPersonDialog({
  person,
  allProfiles,
  open,
  onClose,
}: {
  person: Profile | null
  allProfiles: Profile[]
  open: boolean
  onClose: () => void
}) {
  const { toast } = useToast()
  const [isPending, startTransition] = useTransition()
  const [name, setName] = useState('')
  const [role, setRole] = useState('staff')
  const [managerId, setManagerId] = useState<string>('__none')

  useEffect(() => {
    if (person) {
      setName(person.full_name)
      setRole(person.role)
      setManagerId(person.manager_id ?? '__none')
    }
  }, [person?.id])

  function handleSave() {
    if (!person) return
    startTransition(async () => {
      const result = await updatePersonAction(person.id, {
        full_name: name.trim(),
        role,
        manager_id: managerId === '__none' ? null : managerId,
      })
      if (result.success) {
        toast({ title: 'Person updated' })
        onClose()
      } else {
        toast({ title: 'Failed to update', description: result.error, variant: 'destructive' })
      }
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
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ROLE_OPTIONS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Reports to</Label>
            <Select value={managerId} onValueChange={setManagerId}>
              <SelectTrigger><SelectValue placeholder="No manager" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">No manager</SelectItem>
                {allProfiles
                  .filter((p) => p.id !== person?.id)
                  .map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.full_name} — {ROLE_CONFIG[p.role]?.label ?? p.role}
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

// ── Edit Team Dialog ───────────────────────────────────────────────────────────

const PRESET_COLORS = ['#ec4899', '#3b82f6', '#22c55e', '#f97316', '#a855f7', '#ef4444']

function EditTeamDialog({
  team, open, onClose,
}: { team: any | null; open: boolean; onClose: () => void }) {
  const { toast } = useToast()
  const [isPending, startTransition] = useTransition()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [color, setColor] = useState('#ec4899')

  useEffect(() => {
    if (team) {
      setName(team.name ?? '')
      setDescription(team.description ?? '')
      setColor(team.color ?? '#ec4899')
    }
  }, [team?.id])

  function handleSave() {
    if (!team) return
    startTransition(async () => {
      const result = await updateTeamAction(team.id, {
        name: name.trim(), description: description.trim() || undefined, color,
      })
      if (result.success) { toast({ title: 'Team updated' }); onClose() }
      else toast({ title: 'Failed to update', description: result.error, variant: 'destructive' })
    })
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader><DialogTitle>Edit team</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Team name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What does this team do?" />
          </div>
          <div className="space-y-1.5">
            <Label>Color</Label>
            <div className="flex gap-2">
              {PRESET_COLORS.map((c) => (
                <button key={c} type="button" onClick={() => setColor(c)}
                  className="h-7 w-7 rounded-full transition-transform hover:scale-110 relative"
                  style={{ backgroundColor: c }}>
                  {color === c && (
                    <span className="absolute inset-0 flex items-center justify-center">
                      <span className="h-2 w-2 rounded-full bg-white" />
                    </span>
                  )}
                </button>
              ))}
            </div>
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

// ── Main Hub ───────────────────────────────────────────────────────────────────

export function TeamsHub({ profile, allProfiles, teams }: TeamsHubProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [, startTransition] = useTransition()
  const [activeSection, setActiveSection] = useState<Section>('org-chart')
  const [showCreateTeam, setShowCreateTeam] = useState(false)
  const [showAddPeople, setShowAddPeople] = useState(false)
  const [editingPerson, setEditingPerson] = useState<Profile | null>(null)
  const [deletingPerson, setDeletingPerson] = useState<Profile | null>(null)
  const [editingTeam, setEditingTeam] = useState<any | null>(null)
  const [deletingTeam, setDeletingTeam] = useState<any | null>(null)

  const isAdmin = profile.role === 'super_admin'

  const navItems: { id: Section; label: string; icon: React.ElementType; count?: number }[] = [
    { id: 'org-chart', label: 'Org Chart', icon: GitBranch },
    { id: 'people',    label: 'People',    icon: User,  count: allProfiles.length },
    { id: 'teams',     label: 'Teams',     icon: Users, count: teams.length },
  ]

  function handleDeletePerson() {
    if (!deletingPerson) return
    startTransition(async () => {
      const result = await deleteUserAction(deletingPerson.id)
      if (result.success) { toast({ title: 'Person deleted' }); setDeletingPerson(null) }
      else toast({ title: 'Failed to delete', description: result.error, variant: 'destructive' })
    })
  }

  function handleDeleteTeam() {
    if (!deletingTeam) return
    startTransition(async () => {
      const result = await deleteTeamAction(deletingTeam.id)
      if (result.success) { toast({ title: 'Team deleted' }); setDeletingTeam(null) }
      else toast({ title: 'Failed to delete', description: result.error, variant: 'destructive' })
    })
  }

  return (
    <div className="flex h-full -mx-6 -my-6">
      {/* Left sidebar */}
      <aside className="w-52 border-r border-gray-200 bg-gray-50/60 flex-shrink-0 flex flex-col pt-6 pb-4">
        <div className="px-4 mb-3">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Team</h2>
        </div>
        <nav className="flex-1 space-y-0.5 px-2">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = activeSection === item.id
            return (
              <button key={item.id} onClick={() => setActiveSection(item.id)}
                className={cn(
                  'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors text-left',
                  isActive ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
                )}>
                <Icon className="h-4 w-4 flex-shrink-0" />
                <span className="flex-1">{item.label}</span>
                {item.count !== undefined && (
                  <span className="text-xs text-gray-400 font-normal">{item.count}</span>
                )}
              </button>
            )
          })}
        </nav>
        <div className="px-2 mt-4 border-t border-gray-200 pt-4 space-y-1">
          <button onClick={() => setShowCreateTeam(true)}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-blue-600 hover:bg-blue-50 transition-colors">
            <Plus className="h-4 w-4" />Create team
          </button>
          {isAdmin && (
            <button onClick={() => setShowAddPeople(true)}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors">
              <UserPlus className="h-4 w-4" />Add person
            </button>
          )}
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-white flex-shrink-0">
          <div>
            {activeSection === 'org-chart' && (
              <>
                <h1 className="text-lg font-bold text-gray-900">Org Chart</h1>
                <p className="text-xs text-gray-400 mt-0.5">Visual hierarchy of your organization</p>
              </>
            )}
            {activeSection === 'people' && (
              <>
                <h1 className="text-lg font-bold text-gray-900">People</h1>
                <p className="text-xs text-gray-400 mt-0.5">
                  {allProfiles.length} member{allProfiles.length !== 1 ? 's' : ''} in your organization
                </p>
              </>
            )}
            {activeSection === 'teams' && (
              <>
                <h1 className="text-lg font-bold text-gray-900">Teams</h1>
                <p className="text-xs text-gray-400 mt-0.5">{teams.length} team{teams.length !== 1 ? 's' : ''}</p>
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            {activeSection === 'org-chart' && isAdmin && (
              <Button variant="outline" size="sm" onClick={() => router.push('/settings')}>
                Manage hierarchy <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            )}
            {activeSection === 'people' && isAdmin && (
              <Button size="sm" onClick={() => setShowAddPeople(true)}>
                <UserPlus className="h-4 w-4 mr-2" />Add person
              </Button>
            )}
            {activeSection === 'teams' && (
              <Button size="sm" onClick={() => setShowCreateTeam(true)}>
                <Plus className="h-4 w-4 mr-2" />Create team
              </Button>
            )}
          </div>
        </div>

        {activeSection === 'org-chart' && <OrgChartSection profiles={allProfiles} />}
        {activeSection === 'people' && (
          <PeopleSection
            profiles={allProfiles}
            isAdmin={isAdmin}
            onEdit={setEditingPerson}
            onDelete={setDeletingPerson}
          />
        )}
        {activeSection === 'teams' && (
          <TeamsSection
            teams={teams}
            isAdmin={isAdmin}
            onTeamClick={(id) => router.push(`/team/${id}`)}
            onEditTeam={setEditingTeam}
            onDeleteTeam={setDeletingTeam}
            onCreateTeam={() => setShowCreateTeam(true)}
          />
        )}
      </main>

      {/* Dialogs */}
      <CreateTeamDialog open={showCreateTeam} onClose={() => setShowCreateTeam(false)} allProfiles={allProfiles} currentUserId={profile.id} />
      <CreateUserDialog open={showAddPeople} onOpenChange={(v) => setShowAddPeople(v)} />
      <EditPersonDialog person={editingPerson} allProfiles={allProfiles} open={!!editingPerson} onClose={() => setEditingPerson(null)} />
      <EditTeamDialog team={editingTeam} open={!!editingTeam} onClose={() => setEditingTeam(null)} />

      <AlertDialog open={!!deletingPerson} onOpenChange={(v) => !v && setDeletingPerson(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deletingPerson?.full_name}?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently remove this person. This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeletePerson} className="bg-red-600 hover:bg-red-700">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deletingTeam} onOpenChange={(v) => !v && setDeletingTeam(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{deletingTeam?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently delete the team and remove all members.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteTeam} className="bg-red-600 hover:bg-red-700">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
