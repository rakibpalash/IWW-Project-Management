'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Profile, Team } from '@/types'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Users,
  Star,
  Search,
  Plus,
  ChevronRight,
  Globe,
  Lock,
  CheckCircle2,
  Mail,
  Shield,
  User,
  Briefcase,
} from 'lucide-react'
import { getInitials } from '@/lib/utils'
import { CreateTeamDialog } from './create-team-dialog'
import { format, parseISO } from 'date-fns'

interface TeamsHubProps {
  profile: Profile
  allProfiles: Profile[]
  teams: any[]
}

type SidebarSection = 'for-you' | 'teams' | 'people'

const roleConfig: Record<string, { label: string; icon: React.ElementType; className: string }> = {
  super_admin: { label: 'Admin', icon: Shield, className: 'bg-red-100 text-red-700' },
  account_manager: { label: 'Manager', icon: Shield, className: 'bg-purple-100 text-purple-700' },
  project_manager: { label: 'PM', icon: Briefcase, className: 'bg-blue-100 text-blue-700' },
  staff: { label: 'Staff', icon: User, className: 'bg-blue-100 text-blue-700' },
  client: { label: 'Client', icon: Briefcase, className: 'bg-gray-100 text-gray-700' },
}

const avatarColors = [
  'bg-pink-500',
  'bg-purple-500',
  'bg-indigo-500',
  'bg-blue-500',
  'bg-cyan-500',
  'bg-teal-500',
  'bg-green-500',
  'bg-yellow-500',
  'bg-orange-500',
  'bg-red-500',
]

function getAvatarColor(name: string) {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return avatarColors[Math.abs(hash) % avatarColors.length]
}

function TeamTypeBadge({ type }: { type: string }) {
  if (type === 'official') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-full px-2 py-0.5">
        <CheckCircle2 className="h-3 w-3" />
        Official team
      </span>
    )
  }
  if (type === 'private') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-600 bg-gray-50 border border-gray-200 rounded-full px-2 py-0.5">
        <Lock className="h-3 w-3" />
        Private
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600 bg-green-50 border border-green-200 rounded-full px-2 py-0.5">
      <Globe className="h-3 w-3" />
      Public
    </span>
  )
}

function TeamCard({ team, onClick }: { team: any; onClick: () => void }) {
  const memberCount = team.members?.length ?? 0
  const previewMembers = (team.members ?? []).slice(0, 4)

  return (
    <div
      onClick={onClick}
      className="group bg-white border border-gray-200 rounded-xl p-5 hover:shadow-md hover:border-gray-300 transition-all cursor-pointer"
    >
      {/* Color banner strip */}
      <div
        className="h-1.5 w-12 rounded-full mb-4"
        style={{ backgroundColor: team.color || '#ec4899' }}
      />

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
          <TeamTypeBadge type={team.team_type} />
        </div>
      </div>

      {team.description && (
        <p className="text-xs text-gray-500 mb-3 line-clamp-2">{team.description}</p>
      )}

      <div className="flex items-center justify-between">
        <div className="flex -space-x-1.5">
          {previewMembers.map((m: any) => (
            <Avatar key={m.id} className="h-6 w-6 border-2 border-white">
              <AvatarImage src={m.profile?.avatar_url ?? undefined} />
              <AvatarFallback
                className={`text-[9px] font-bold text-white ${getAvatarColor(m.profile?.full_name ?? 'U')}`}
              >
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

function PersonCard({ person }: { person: Profile }) {
  const rc = roleConfig[person.role] ?? roleConfig.staff
  const RoleIcon = rc.icon

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col items-center text-center gap-2 hover:shadow-md transition-all">
      <Avatar className="h-14 w-14">
        <AvatarImage src={person.avatar_url ?? undefined} />
        <AvatarFallback
          className={`text-sm font-bold text-white ${getAvatarColor(person.full_name)}`}
        >
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
        <RoleIcon className="h-3 w-3" />
        {rc.label}
      </span>
      <p className="text-[11px] text-gray-400">
        Joined {format(parseISO(person.created_at), 'MMM yyyy')}
      </p>
    </div>
  )
}

export function TeamsHub({ profile, allProfiles, teams }: TeamsHubProps) {
  const router = useRouter()
  const [activeSection, setActiveSection] = useState<SidebarSection>('for-you')
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [peopleSearch, setPeopleSearch] = useState('')
  const [teamsSearch, setTeamsSearch] = useState('')

  const myTeams = teams.filter((t) =>
    t.members?.some((m: any) => m.user_id === profile.id)
  )

  const filteredPeople = allProfiles.filter((p) =>
    peopleSearch === '' ||
    p.full_name.toLowerCase().includes(peopleSearch.toLowerCase()) ||
    p.email.toLowerCase().includes(peopleSearch.toLowerCase())
  )

  const filteredTeams = teams.filter((t) =>
    teamsSearch === '' || t.name.toLowerCase().includes(teamsSearch.toLowerCase())
  )

  const navItems: { id: SidebarSection; label: string; icon: React.ElementType; count?: number }[] = [
    { id: 'for-you', label: 'For you', icon: Star },
    { id: 'teams', label: 'Teams', icon: Users, count: teams.length },
    { id: 'people', label: 'People', icon: User, count: allProfiles.length },
  ]

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
              <button
                key={item.id}
                onClick={() => setActiveSection(item.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors text-left ${
                  isActive
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`}
              >
                <Icon className="h-4 w-4 flex-shrink-0" />
                <span className="flex-1">{item.label}</span>
                {item.count !== undefined && (
                  <span className="text-xs text-gray-400 font-normal">{item.count}</span>
                )}
              </button>
            )
          })}
        </nav>

        <div className="px-2 mt-4 border-t border-gray-200 pt-4">
          <button
            onClick={() => setShowCreateDialog(true)}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-blue-600 hover:bg-blue-50 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Create team
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
              <p className="text-sm text-gray-500 mt-1">
                People you work with and teams you belong to
              </p>
            </div>

            {/* People you work with */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-semibold text-gray-800">People you work with</h2>
                <button
                  onClick={() => setActiveSection('people')}
                  className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                >
                  View all <ChevronRight className="h-3 w-3" />
                </button>
              </div>
              {allProfiles.length === 0 ? (
                <p className="text-sm text-gray-400">No people found.</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                  {allProfiles.slice(0, 10).map((p) => (
                    <PersonCard key={p.id} person={p} />
                  ))}
                </div>
              )}
            </section>

            {/* Your teams */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-semibold text-gray-800">Your teams</h2>
                <button
                  onClick={() => setActiveSection('teams')}
                  className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                >
                  View all <ChevronRight className="h-3 w-3" />
                </button>
              </div>
              {myTeams.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 border border-dashed border-gray-200 rounded-xl bg-gray-50">
                  <Users className="h-8 w-8 text-gray-300 mb-3" />
                  <p className="text-sm font-medium text-gray-500">You haven't joined any teams yet</p>
                  <p className="text-xs text-gray-400 mt-1">Create or join a team to get started</p>
                  <Button
                    size="sm"
                    className="mt-4"
                    onClick={() => setShowCreateDialog(true)}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Create team
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {myTeams.map((team) => (
                    <TeamCard
                      key={team.id}
                      team={team}
                      onClick={() => router.push(`/team/${team.id}`)}
                    />
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
                <p className="text-sm text-gray-500 mt-1">
                  {teams.length} team{teams.length !== 1 ? 's' : ''} in your organization
                </p>
              </div>
              <Button onClick={() => setShowCreateDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create team
              </Button>
            </div>

            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search teams..."
                value={teamsSearch}
                onChange={(e) => setTeamsSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            {filteredTeams.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 border border-dashed border-gray-200 rounded-2xl bg-gray-50">
                {/* Illustration */}
                <div className="relative mb-6">
                  <div className="w-24 h-24 rounded-full bg-blue-50 flex items-center justify-center">
                    <Users className="h-12 w-12 text-blue-300" />
                  </div>
                  <div className="absolute -top-1 -right-1 w-8 h-8 rounded-full bg-pink-100 flex items-center justify-center">
                    <Star className="h-4 w-4 text-pink-400" />
                  </div>
                </div>
                <h3 className="text-base font-semibold text-gray-700 mb-1">
                  {teamsSearch ? 'No teams found' : 'No teams yet'}
                </h3>
                <p className="text-sm text-gray-400 text-center max-w-xs">
                  {teamsSearch
                    ? 'Try a different search term'
                    : 'Create your first team to start collaborating with your colleagues.'}
                </p>
                {!teamsSearch && (
                  <Button className="mt-6" onClick={() => setShowCreateDialog(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create team
                  </Button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredTeams.map((team) => (
                  <TeamCard
                    key={team.id}
                    team={team}
                    onClick={() => router.push(`/team/${team.id}`)}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* PEOPLE */}
        {activeSection === 'people' && (
          <div className="space-y-6">
            <div>
              <h1 className="text-xl font-bold text-gray-900">People</h1>
              <p className="text-sm text-gray-500 mt-1">
                {allProfiles.length} member{allProfiles.length !== 1 ? 's' : ''} in your organization
              </p>
            </div>

            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search people..."
                value={peopleSearch}
                onChange={(e) => setPeopleSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            {filteredPeople.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-gray-400 border border-dashed border-gray-200 rounded-xl bg-gray-50">
                <User className="h-8 w-8 mb-2 opacity-40" />
                <p className="text-sm">No people found</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                {filteredPeople.map((person) => (
                  <PersonCard key={person.id} person={person} />
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      <CreateTeamDialog
        open={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        allProfiles={allProfiles}
        currentUserId={profile.id}
      />
    </div>
  )
}
