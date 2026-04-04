'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Profile, Team } from '@/types'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
  Users, Star, Search, Plus, ChevronRight, Globe, Lock, CheckCircle2,
  Mail, Shield, User, Briefcase, MoreHorizontal, Pencil, Trash2, UserPlus,
} from 'lucide-react'
import { getInitials } from '@/lib/utils'
import { CreateTeamDialog } from './create-team-dialog'
import { CreateUserDialog } from '@/components/settings/create-user-dialog'
import { format, parseISO } from 'date-fns'
import { deleteUserAction, updatePersonAction } from '@/app/actions/user'
import { deleteTeamAction, updateTeamAction } from '@/app/actions/teams'
import { useToast } from '@/components/ui/use-toast'

interface TeamsHubProps {
  profile: Profile
  allProfiles: Profile[]
  teams: any[]
}

type SidebarSection = 'for-you' | 'teams' | 'people'

const ROLES = ['staff', 'client', 'account_manager', 'project_manager', 'super_admin'] as const

const roleConfig: Record<string, { label: string; icon: React.ElementType; className: string }> = {
  super_admin:     { label: 'Admin',   icon: Shield,   className: 'bg-red-100 text-red-700' },
  account_manager: { label: 'Manager', icon: Shield,   className: 'bg-purple-100 text-purple-700' },
  project_manager: { label: 'PM',      icon: Briefcase,className: 'bg-blue-100 text-blue-700' },
  staff:           { label: 'Staff',   icon: User,     className: 'bg-blue-100 text-blue-700' },
  client:          { label: 'Client',  icon: Briefcase,className: 'bg-gray-100 text-gray-700' },
}

const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Admin', account_manager: 'Account Manager',
  project_manager: 'Project Manager', staff: 'Staff', client: 'Client',
}

const avatarColors = [
  'bg-pink-500','bg-purple-500','bg-indigo-500','bg-blue-500',
  'bg-cyan-500','bg-teal-500','bg-green-500','bg-yellow-500','bg-orange-500','bg-red-500',
]
function getAvatarColor(name: string) {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return avatarColors[Math.abs(hash) % avatarColors.length]
}

function TeamTypeBadge({ type }: { type: string }) {
  if (type === 'official') return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-full px-2 py-0.5">
      <CheckCircle2 className="h-3 w-3" />Official team
    </span>
  )
  if (type === 'private') return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-600 bg-gray-50 border border-gray-200 rounded-full px-2 py-0.5">
      <Lock className="h-3 w-3" />Private
    </span>
  )
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600 bg-green-50 border border-green-200 rounded-full px-2 py-0.5">
      <Globe className="h-3 w-3" />Public
    </span>
  )
}

// ── Team Card ──────────────────────────────────────────────────────────────────
function TeamCard({
  team, isAdmin, onClick, onEdit, onDelete,
}: {
  team: any; isAdmin: boolean
  onClick: () => void; onEdit: () => void; onDelete: () => void
}) {
  const memberCount = team.members?.length ?? 0
  const previewMembers = (team.members ?? []).slice(0, 4)

  return (
    <div className="group relative bg-white border border-gray-200 rounded-xl p-5 hover:shadow-md hover:border-gray-300 transition-all cursor-pointer"
      onClick={onClick}>
      <div className="h-1.5 w-12 rounded-full mb-4" style={{ backgroundColor: team.color || '#ec4899' }} />
      <div className="flex items-start gap-3 mb-3">
        <div className="h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: team.color || '#ec4899' }}>
          <Users className="h-5 w-5 text-white" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-sm text-gray-900 group-hover:text-blue-600 transition-colors truncate">{team.name}</h3>
          <TeamTypeBadge type={team.team_type} />
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
      {team.description && <p className="text-xs text-gray-500 mb-3 line-clamp-2">{team.description}</p>}
      <div className="flex items-center justify-between">
        <div className="flex -space-x-1.5">
          {previewMembers.map((m: any) => (
            <Avatar key={m.id} className="h-6 w-6 border-2 border-white">
              <AvatarImage src={m.profile?.avatar_url ?? undefined} />
              <AvatarFallback className={`text-[9px] font-bold text-white ${getAvatarColor(m.profile?.full_name ?? 'U')}`}>
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

// ── Person Card ────────────────────────────────────────────────────────────────
function PersonCard({
  person, isAdmin, onEdit, onDelete,
}: {
  person: Profile; isAdmin: boolean; onEdit: () => void; onDelete: () => void
}) {
  const rc = roleConfig[person.role] ?? roleConfig.staff
  const RoleIcon = rc.icon

  return (
    <div className="group relative bg-white border border-gray-200 rounded-xl p-4 flex flex-col items-center text-center gap-2 hover:shadow-md transition-all">
      {isAdmin && (
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="h-6 w-6 flex items-center justify-center rounded-md hover:bg-gray-100 text-gray-400">
                <MoreHorizontal className="h-3.5 w-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onEdit} className="gap-2">
                <Pencil className="h-3.5 w-3.5" />Edit
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onDelete} className="gap-2 text-red-600 focus:text-red-600">
                <Trash2 className="h-3.5 w-3.5" />Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
      <Avatar className="h-14 w-14">
        <AvatarImage src={person.avatar_url ?? undefined} />
        <AvatarFallback className={`text-sm font-bold text-white ${getAvatarColor(person.full_name)}`}>
          {getInitials(person.full_name)}
        </AvatarFallback>
      </Avatar>
      <div>
        <p className="font-semibold text-sm text-gray-900 leading-tight">{person.full_name}</p>
        <div className="flex items-center justify-center gap-1 text-xs text-gray-400 mt-0.5">
          <Mail className="h-3 w-3" />
          <span className="truncate max-w-[140px]">{person.email}</span>
        </div>
      </div>
      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${rc.className}`}>
        <RoleIcon className="h-3 w-3" />{rc.label}
      </span>
      <p className="text-[11px] text-gray-400">Joined {format(parseISO(person.created_at), 'MMM yyyy')}</p>
    </div>
  )
}

// ── Edit Person Dialog ─────────────────────────────────────────────────────────
function EditPersonDialog({
  person, open, onClose,
}: { person: Profile | null; open: boolean; onClose: () => void }) {
  const { toast } = useToast()
  const [isPending, startTransition] = useTransition()
  const [name, setName] = useState(person?.full_name ?? '')
  const [role, setRole] = useState<string>(person?.role ?? 'staff')

  // sync when person changes
  useState(() => { setName(person?.full_name ?? ''); setRole(person?.role ?? 'staff') })

  function handleSave() {
    if (!person) return
    startTransition(async () => {
      const result = await updatePersonAction(person.id, { full_name: name.trim(), role })
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
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ROLES.map((r) => (
                  <SelectItem key={r} value={r}>{ROLE_LABELS[r] ?? r}</SelectItem>
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
const PRESET_COLORS = [
  { value: '#ec4899', label: 'Pink' }, { value: '#3b82f6', label: 'Blue' },
  { value: '#22c55e', label: 'Green' }, { value: '#f97316', label: 'Orange' },
  { value: '#a855f7', label: 'Purple' }, { value: '#ef4444', label: 'Red' },
]

function EditTeamDialog({
  team, open, onClose,
}: { team: any | null; open: boolean; onClose: () => void }) {
  const { toast } = useToast()
  const [isPending, startTransition] = useTransition()
  const [name, setName] = useState(team?.name ?? '')
  const [description, setDescription] = useState(team?.description ?? '')
  const [color, setColor] = useState(team?.color ?? '#ec4899')

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
            <Label>Team color</Label>
            <div className="flex gap-2">
              {PRESET_COLORS.map((c) => (
                <button key={c.value} type="button" onClick={() => setColor(c.value)}
                  className="h-7 w-7 rounded-full transition-transform hover:scale-110 relative"
                  style={{ backgroundColor: c.value }}>
                  {color === c.value && (
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
  const [activeSection, setActiveSection] = useState<SidebarSection>('for-you')
  const [showCreateTeam, setShowCreateTeam] = useState(false)
  const [showAddPeople, setShowAddPeople] = useState(false)
  const [peopleSearch, setPeopleSearch] = useState('')
  const [teamsSearch, setTeamsSearch] = useState('')

  // Edit / Delete person
  const [editingPerson, setEditingPerson] = useState<Profile | null>(null)
  const [deletingPerson, setDeletingPerson] = useState<Profile | null>(null)

  // Edit / Delete team
  const [editingTeam, setEditingTeam] = useState<any | null>(null)
  const [deletingTeam, setDeletingTeam] = useState<any | null>(null)

  const isAdmin = profile.role === 'super_admin'

  const myTeams = teams.filter((t) => t.members?.some((m: any) => m.user_id === profile.id))
  const filteredPeople = allProfiles.filter((p) =>
    !peopleSearch || p.full_name.toLowerCase().includes(peopleSearch.toLowerCase()) || p.email.toLowerCase().includes(peopleSearch.toLowerCase())
  )
  const filteredTeams = teams.filter((t) =>
    !teamsSearch || t.name.toLowerCase().includes(teamsSearch.toLowerCase())
  )

  const navItems = [
    { id: 'for-you' as SidebarSection, label: 'For you', icon: Star },
    { id: 'teams'   as SidebarSection, label: 'Teams',   icon: Users, count: teams.length },
    { id: 'people'  as SidebarSection, label: 'People',  icon: User,  count: allProfiles.length },
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
      <aside className="w-56 border-r border-gray-200 bg-gray-50 flex-shrink-0 flex flex-col pt-6 pb-4">
        <div className="px-4 mb-4">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Teams</h2>
        </div>
        <nav className="flex-1 space-y-0.5 px-2">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = activeSection === item.id
            return (
              <button key={item.id} onClick={() => setActiveSection(item.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors text-left ${
                  isActive ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`}>
                <Icon className="h-4 w-4 flex-shrink-0" />
                <span className="flex-1">{item.label}</span>
                {'count' in item && item.count !== undefined && (
                  <span className="text-xs text-gray-400 font-normal">{item.count}</span>
                )}
              </button>
            )
          })}
        </nav>
        <div className="px-2 mt-4 border-t border-gray-200 pt-4">
          <button onClick={() => setShowCreateTeam(true)}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-blue-600 hover:bg-blue-50 transition-colors">
            <Plus className="h-4 w-4" />Create team
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto p-6">

        {/* FOR YOU */}
        {activeSection === 'for-you' && (
          <div className="space-y-8">
            <div>
              <h1 className="text-xl font-bold text-gray-900">For you</h1>
              <p className="text-sm text-gray-500 mt-1">People you work with and teams you belong to</p>
            </div>
            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-semibold text-gray-800">People you work with</h2>
                <button onClick={() => setActiveSection('people')} className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                  View all <ChevronRight className="h-3 w-3" />
                </button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                {allProfiles.slice(0, 10).map((p) => (
                  <PersonCard key={p.id} person={p} isAdmin={isAdmin}
                    onEdit={() => setEditingPerson(p)}
                    onDelete={() => setDeletingPerson(p)} />
                ))}
              </div>
            </section>
            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-semibold text-gray-800">Your teams</h2>
                <button onClick={() => setActiveSection('teams')} className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                  View all <ChevronRight className="h-3 w-3" />
                </button>
              </div>
              {myTeams.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 border border-dashed border-gray-200 rounded-xl bg-gray-50">
                  <Users className="h-8 w-8 text-gray-300 mb-3" />
                  <p className="text-sm font-medium text-gray-500">You haven't joined any teams yet</p>
                  <Button size="sm" className="mt-4" onClick={() => setShowCreateTeam(true)}>
                    <Plus className="h-4 w-4 mr-1" />Create team
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {myTeams.map((team) => (
                    <TeamCard key={team.id} team={team} isAdmin={isAdmin}
                      onClick={() => router.push(`/team/${team.id}`)}
                      onEdit={() => setEditingTeam(team)}
                      onDelete={() => setDeletingTeam(team)} />
                  ))}
                </div>
              )}
            </section>
          </div>
        )}

        {/* TEAMS */}
        {activeSection === 'teams' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h1 className="text-xl font-bold text-gray-900">Teams</h1>
                <p className="text-sm text-gray-500 mt-1">{teams.length} team{teams.length !== 1 ? 's' : ''} in your organization</p>
              </div>
              <Button onClick={() => setShowCreateTeam(true)}>
                <Plus className="h-4 w-4 mr-2" />Create team
              </Button>
            </div>
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input placeholder="Search teams..." value={teamsSearch} onChange={(e) => setTeamsSearch(e.target.value)} className="pl-9" />
            </div>
            {filteredTeams.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 border border-dashed border-gray-200 rounded-2xl bg-gray-50">
                <div className="relative mb-6">
                  <div className="w-24 h-24 rounded-full bg-blue-50 flex items-center justify-center">
                    <Users className="h-12 w-12 text-blue-300" />
                  </div>
                  <div className="absolute -top-1 -right-1 w-8 h-8 rounded-full bg-pink-100 flex items-center justify-center">
                    <Star className="h-4 w-4 text-pink-400" />
                  </div>
                </div>
                <h3 className="text-base font-semibold text-gray-700 mb-1">{teamsSearch ? 'No teams found' : 'No teams yet'}</h3>
                <p className="text-sm text-gray-400 text-center max-w-xs">
                  {teamsSearch ? 'Try a different search term' : 'Create your first team to start collaborating.'}
                </p>
                {!teamsSearch && (
                  <Button className="mt-6" onClick={() => setShowCreateTeam(true)}>
                    <Plus className="h-4 w-4 mr-2" />Create team
                  </Button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredTeams.map((team) => (
                  <TeamCard key={team.id} team={team} isAdmin={isAdmin}
                    onClick={() => router.push(`/team/${team.id}`)}
                    onEdit={() => setEditingTeam(team)}
                    onDelete={() => setDeletingTeam(team)} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* PEOPLE */}
        {activeSection === 'people' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h1 className="text-xl font-bold text-gray-900">People</h1>
                <p className="text-sm text-gray-500 mt-1">{allProfiles.length} member{allProfiles.length !== 1 ? 's' : ''} in your organization</p>
              </div>
              {isAdmin && (
                <Button onClick={() => setShowAddPeople(true)}>
                  <UserPlus className="h-4 w-4 mr-2" />Add people
                </Button>
              )}
            </div>
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input placeholder="Search people..." value={peopleSearch} onChange={(e) => setPeopleSearch(e.target.value)} className="pl-9" />
            </div>
            {filteredPeople.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-gray-400 border border-dashed border-gray-200 rounded-xl bg-gray-50">
                <User className="h-8 w-8 mb-2 opacity-40" />
                <p className="text-sm">No people found</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                {filteredPeople.map((person) => (
                  <PersonCard key={person.id} person={person} isAdmin={isAdmin}
                    onEdit={() => setEditingPerson(person)}
                    onDelete={() => setDeletingPerson(person)} />
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Dialogs */}
      <CreateTeamDialog open={showCreateTeam} onClose={() => setShowCreateTeam(false)} allProfiles={allProfiles} currentUserId={profile.id} />
      <CreateUserDialog open={showAddPeople} onOpenChange={(v) => setShowAddPeople(v)} />

      <EditPersonDialog person={editingPerson} open={!!editingPerson} onClose={() => setEditingPerson(null)} />
      <EditTeamDialog   team={editingTeam}   open={!!editingTeam}   onClose={() => setEditingTeam(null)} />

      {/* Delete person confirm */}
      <AlertDialog open={!!deletingPerson} onOpenChange={(v) => !v && setDeletingPerson(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deletingPerson?.full_name}?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently remove this person from the system. This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeletePerson} className="bg-red-600 hover:bg-red-700">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete team confirm */}
      <AlertDialog open={!!deletingTeam} onOpenChange={(v) => !v && setDeletingTeam(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{deletingTeam?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently delete the team and remove all members. This action cannot be undone.</AlertDialogDescription>
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
