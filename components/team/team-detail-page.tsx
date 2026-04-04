'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Profile, Team, TeamMember } from '@/types'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
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
import {
  Users,
  MoreHorizontal,
  Star,
  Settings,
  LogOut,
  Archive,
  Trash2,
  UserPlus,
  CheckCircle2,
  Globe,
  Lock,
  Crown,
  X,
  ArrowLeft,
  FileText,
  Link2,
} from 'lucide-react'
import { getInitials, formatDate } from '@/lib/utils'
import {
  deleteTeamAction,
  archiveTeamAction,
  leaveTeamAction,
  removeTeamMemberAction,
} from '@/app/actions/teams'
import { useToast } from '@/components/ui/use-toast'
import { AddMembersDialog } from './add-members-dialog'

const avatarColors = [
  'bg-pink-500', 'bg-purple-500', 'bg-indigo-500', 'bg-blue-500',
  'bg-cyan-500', 'bg-teal-500', 'bg-green-500', 'bg-orange-500',
]
function getAvatarColor(name: string) {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return avatarColors[Math.abs(hash) % avatarColors.length]
}

function TeamTypeBadge({ type }: { type: string }) {
  if (type === 'official') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-full px-2.5 py-0.5">
        <CheckCircle2 className="h-3.5 w-3.5" />
        Official team
      </span>
    )
  }
  if (type === 'private') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-600 bg-gray-100 border border-gray-200 rounded-full px-2.5 py-0.5">
        <Lock className="h-3.5 w-3.5" />
        Private
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600 bg-green-50 border border-green-200 rounded-full px-2.5 py-0.5">
      <Globe className="h-3.5 w-3.5" />
      Public
    </span>
  )
}

interface TeamDetailPageProps {
  team: Team & { members?: (TeamMember & { profile?: Profile })[] }
  profile: Profile
  allProfiles: Profile[]
}

type TabType = 'about' | 'members'

export function TeamDetailPage({ team, profile, allProfiles }: TeamDetailPageProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [isPending, startTransition] = useTransition()
  const [activeTab, setActiveTab] = useState<TabType>('about')
  const [showAddMembers, setShowAddMembers] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false)
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false)
  const [removingUserId, setRemovingUserId] = useState<string | null>(null)

  const members = team.members ?? []
  const memberCount = members.length
  const isAdmin = profile.role === 'super_admin'
  const isCreator = team.created_by === profile.id
  const canManage = isAdmin || isCreator
  const isMember = members.some((m) => m.user_id === profile.id)

  const existingMemberIds = members.map((m) => m.user_id)

  // Build gradient from team color
  const teamColor = team.color || '#ec4899'
  const coverStyle = {
    background: `linear-gradient(135deg, ${teamColor}dd 0%, ${teamColor}88 50%, ${teamColor}33 100%)`,
  }

  const handleDelete = () => {
    startTransition(async () => {
      const result = await deleteTeamAction(team.id)
      if (result.success) {
        toast({ title: 'Team deleted' })
        router.push('/team')
      } else {
        toast({ title: 'Failed to delete team', description: result.error, variant: 'destructive' })
      }
    })
  }

  const handleArchive = () => {
    startTransition(async () => {
      const result = await archiveTeamAction(team.id)
      if (result.success) {
        toast({ title: 'Team archived' })
        router.push('/team')
      } else {
        toast({ title: 'Failed to archive team', description: result.error, variant: 'destructive' })
      }
    })
  }

  const handleLeave = () => {
    startTransition(async () => {
      const result = await leaveTeamAction(team.id)
      if (result.success) {
        toast({ title: 'You have left the team' })
        router.push('/team')
      } else {
        toast({ title: 'Failed to leave team', description: result.error, variant: 'destructive' })
      }
    })
  }

  const handleRemoveMember = (userId: string) => {
    setRemovingUserId(userId)
    startTransition(async () => {
      const result = await removeTeamMemberAction(team.id, userId)
      setRemovingUserId(null)
      if (result.success) {
        toast({ title: 'Member removed' })
        router.refresh()
      } else {
        toast({ title: 'Failed to remove member', description: result.error, variant: 'destructive' })
      }
    })
  }

  return (
    <div className="-mx-6 -my-6">
      {/* Cover banner */}
      <div className="relative h-36 w-full" style={coverStyle}>
        <button
          onClick={() => router.push('/team')}
          className="absolute top-4 left-4 flex items-center gap-1.5 text-white/80 hover:text-white text-sm font-medium transition-colors bg-black/10 hover:bg-black/20 rounded-lg px-3 py-1.5"
        >
          <ArrowLeft className="h-4 w-4" />
          Teams
        </button>
      </div>

      {/* Team header */}
      <div className="px-6 pb-0 border-b border-gray-200 bg-white">
        <div className="flex items-end gap-4 -mt-8 mb-4">
          {/* Team icon */}
          <div
            className="h-16 w-16 rounded-xl flex items-center justify-center shadow-lg border-4 border-white flex-shrink-0"
            style={{ backgroundColor: teamColor }}
          >
            <Users className="h-8 w-8 text-white" />
          </div>

          <div className="flex-1 min-w-0 pb-1">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <h1 className="text-xl font-bold text-gray-900 leading-tight">{team.name}</h1>
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  <TeamTypeBadge type={team.team_type} />
                  <span className="text-xs text-gray-400">
                    {memberCount} member{memberCount !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 pb-1">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowAddMembers(true)}
                  className="gap-1.5"
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  Add people
                </Button>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm" variant="outline" className="px-2">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem className="gap-2 cursor-pointer">
                      <Star className="h-4 w-4 text-yellow-500" />
                      Star team
                    </DropdownMenuItem>
                    {canManage && (
                      <DropdownMenuItem className="gap-2 cursor-pointer">
                        <Settings className="h-4 w-4 text-gray-500" />
                        Team settings
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    {isMember && !isCreator && (
                      <DropdownMenuItem
                        className="gap-2 cursor-pointer text-orange-600 focus:text-orange-600"
                        onClick={() => setShowLeaveConfirm(true)}
                      >
                        <LogOut className="h-4 w-4" />
                        Leave team
                      </DropdownMenuItem>
                    )}
                    {canManage && (
                      <>
                        <DropdownMenuItem
                          className="gap-2 cursor-pointer text-orange-600 focus:text-orange-600"
                          onClick={() => setShowArchiveConfirm(true)}
                        >
                          <Archive className="h-4 w-4" />
                          Archive team
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="gap-2 cursor-pointer text-red-600 focus:text-red-600"
                          onClick={() => setShowDeleteConfirm(true)}
                        >
                          <Trash2 className="h-4 w-4" />
                          Delete team
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1">
          {(['about', 'members'] as TabType[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors capitalize ${
                activeTab === tab
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab === 'members' ? `Members (${memberCount})` : 'About'}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="p-6">
        {activeTab === 'about' && (
          <div className="flex gap-6">
            {/* Main content */}
            <div className="flex-1 min-w-0 space-y-6">
              {/* Description */}
              <section>
                <h2 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                  <FileText className="h-4 w-4 text-gray-400" />
                  What we're doing
                </h2>
                {team.description ? (
                  <p className="text-sm text-gray-600 leading-relaxed">{team.description}</p>
                ) : (
                  <p className="text-sm text-gray-400 italic">No description provided.</p>
                )}
              </section>

              {/* Members grid (preview) */}
              <section>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-semibold text-gray-700">
                    Members ({memberCount})
                  </h2>
                  <button
                    onClick={() => setActiveTab('members')}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    View all
                  </button>
                </div>
                {members.length === 0 ? (
                  <p className="text-sm text-gray-400">No members yet.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {members.slice(0, 6).map((m) => (
                      <MemberRow key={m.id} member={m} />
                    ))}
                  </div>
                )}
              </section>
            </div>

            {/* Right sidebar */}
            <aside className="w-64 flex-shrink-0 space-y-5">
              {/* Details */}
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Details
                </h3>

                <div className="space-y-2.5 text-sm">
                  <div className="flex items-start gap-2">
                    <span className="text-gray-400 min-w-[80px] text-xs pt-0.5">Team type</span>
                    <TeamTypeBadge type={team.team_type} />
                  </div>

                  <div className="flex items-start gap-2">
                    <span className="text-gray-400 min-w-[80px] text-xs pt-0.5">Created</span>
                    <span className="text-gray-600 text-xs">{formatDate(team.created_at)}</span>
                  </div>

                  <div className="flex items-start gap-2">
                    <span className="text-gray-400 min-w-[80px] text-xs pt-0.5">Parent team</span>
                    <span className="text-gray-400 text-xs italic">No parent team</span>
                  </div>

                  <div className="flex items-start gap-2">
                    <span className="text-gray-400 min-w-[80px] text-xs pt-0.5">Sub-teams</span>
                    <span className="text-gray-400 text-xs italic">No sub-teams</span>
                  </div>
                </div>
              </div>

              {/* Team links */}
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                  Team links
                </h3>
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <Link2 className="h-4 w-4" />
                  <span className="text-xs italic">No links added</span>
                </div>
              </div>
            </aside>
          </div>
        )}

        {activeTab === 'members' && (
          <div className="max-w-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-gray-800">
                {memberCount} member{memberCount !== 1 ? 's' : ''}
              </h2>
              <Button size="sm" onClick={() => setShowAddMembers(true)} className="gap-1.5">
                <UserPlus className="h-3.5 w-3.5" />
                Add people
              </Button>
            </div>

            {members.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 border border-dashed border-gray-200 rounded-xl bg-gray-50">
                <Users className="h-8 w-8 text-gray-300 mb-2" />
                <p className="text-sm text-gray-400">No members in this team</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100 border border-gray-200 rounded-xl overflow-hidden bg-white">
                {members.map((m) => (
                  <MemberRowFull
                    key={m.id}
                    member={m}
                    canManage={canManage}
                    isCurrentUser={m.user_id === profile.id}
                    isRemoving={removingUserId === m.user_id}
                    onRemove={() => handleRemoveMember(m.user_id)}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Add Members Dialog */}
      <AddMembersDialog
        open={showAddMembers}
        onClose={() => setShowAddMembers(false)}
        teamId={team.id}
        teamName={team.name}
        allProfiles={allProfiles}
        existingMemberIds={existingMemberIds}
      />

      {/* Delete Confirm */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete team?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <strong>{team.name}</strong> and remove all its members.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete team
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Archive Confirm */}
      <AlertDialog open={showArchiveConfirm} onOpenChange={setShowArchiveConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive team?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{team.name}</strong> will be archived and hidden from the teams list.
              You can restore it later from settings.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleArchive}
              className="bg-orange-600 hover:bg-orange-700"
            >
              Archive team
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Leave Confirm */}
      <AlertDialog open={showLeaveConfirm} onOpenChange={setShowLeaveConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave team?</AlertDialogTitle>
            <AlertDialogDescription>
              You will be removed from <strong>{team.name}</strong>. You can be re-added by a team
              admin.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleLeave}>Leave team</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function MemberRow({ member }: { member: TeamMember & { profile?: Profile } }) {
  const p = member.profile
  if (!p) return null
  return (
    <div className="flex items-center gap-3 p-3 bg-white border border-gray-100 rounded-xl hover:border-gray-200 transition-colors">
      <Avatar className="h-9 w-9">
        <AvatarImage src={p.avatar_url ?? undefined} />
        <AvatarFallback className={`text-xs font-bold text-white ${getAvatarColor(p.full_name)}`}>
          {getInitials(p.full_name)}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">{p.full_name}</p>
        <p className="text-xs text-gray-400 truncate">{p.email}</p>
      </div>
      {member.role === 'lead' && (
        <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600 bg-amber-50 rounded-full px-2 py-0.5">
          <Crown className="h-3 w-3" />
          Lead
        </span>
      )}
    </div>
  )
}

function MemberRowFull({
  member,
  canManage,
  isCurrentUser,
  isRemoving,
  onRemove,
}: {
  member: TeamMember & { profile?: Profile }
  canManage: boolean
  isCurrentUser: boolean
  isRemoving: boolean
  onRemove: () => void
}) {
  const p = member.profile
  if (!p) return null

  return (
    <div className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors">
      <Avatar className="h-9 w-9 flex-shrink-0">
        <AvatarImage src={p.avatar_url ?? undefined} />
        <AvatarFallback className={`text-xs font-bold text-white ${getAvatarColor(p.full_name)}`}>
          {getInitials(p.full_name)}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-gray-900 truncate">{p.full_name}</p>
          {isCurrentUser && (
            <span className="text-xs text-gray-400">(you)</span>
          )}
        </div>
        <p className="text-xs text-gray-400 truncate">{p.email}</p>
      </div>

      {member.role === 'lead' ? (
        <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-2.5 py-0.5 flex-shrink-0">
          <Crown className="h-3 w-3" />
          Lead
        </span>
      ) : (
        <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 bg-gray-100 rounded-full px-2.5 py-0.5 flex-shrink-0">
          Member
        </span>
      )}

      {canManage && !isCurrentUser && member.role !== 'lead' && (
        <button
          onClick={onRemove}
          disabled={isRemoving}
          className="p-1 text-gray-300 hover:text-red-500 transition-colors flex-shrink-0"
          title="Remove member"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}
