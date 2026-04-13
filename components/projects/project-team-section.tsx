'use client'

import { useState, useTransition, useMemo } from 'react'
import { ListMember, Profile, CustomRole } from '@/types'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Plus, Trash2, Crown, Users, Search, Loader2 } from 'lucide-react'
import {
  addProjectMemberAction,
  updateProjectMemberRoleAction,
  removeProjectMemberAction,
} from '@/app/actions/project-members'
import { getInitials } from '@/lib/utils'

interface ProjectTeamSectionProps {
  projectId: string
  initialMembers: ListMember[]
  allProfiles: Profile[]   // all staff available to add
  customRoles: CustomRole[]
  canManage: boolean        // true for super_admin
}

export function ProjectTeamSection({
  projectId,
  initialMembers,
  allProfiles,
  customRoles,
  canManage,
}: ProjectTeamSectionProps) {
  const [members, setMembers] = useState<ListMember[]>(initialMembers)
  const [addOpen, setAddOpen] = useState(false)
  const [removeTarget, setRemoveTarget] = useState<ListMember | null>(null)
  const [search, setSearch] = useState('')
  const [selectedUserId, setSelectedUserId] = useState('')
  const [selectedRole, setSelectedRole] = useState<'lead' | 'member'>('member')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const leads = members.filter((m) => m.project_role === 'lead')
  const regularMembers = members.filter((m) => m.project_role === 'member')

  // Profiles not already added (include all assignable roles)
  const available = useMemo(() => {
    const addedIds = new Set(members.map((m) => m.user_id))
    return allProfiles.filter(
      (p) => !addedIds.has(p.id) && p.role !== 'super_admin'
    )
  }, [members, allProfiles])

  const filtered = useMemo(() => {
    if (!search.trim()) return available
    const q = search.toLowerCase()
    return available.filter(
      (p) =>
        p.full_name.toLowerCase().includes(q) ||
        p.email.toLowerCase().includes(q)
    )
  }, [available, search])

  const handleAdd = () => {
    if (!selectedUserId) { setError('Please select a user'); return }
    setError(null)
    startTransition(async () => {
      const result = await addProjectMemberAction(projectId, selectedUserId, selectedRole)
      if (result.error) { setError(result.error); return }
      const profile = allProfiles.find((p) => p.id === selectedUserId)
      const newMember: ListMember = {
        id: (result.member as any).id,
        list_id: projectId,
        user_id: selectedUserId,
        project_role: selectedRole,
        created_at: (result.member as any).created_at,
        profile,
      }
      setMembers((prev) => [...prev, newMember])
      setAddOpen(false)
      setSelectedUserId('')
      setSelectedRole('member')
      setSearch('')
    })
  }

  const handleRoleChange = (member: ListMember, newRole: 'lead' | 'member') => {
    startTransition(async () => {
      const result = await updateProjectMemberRoleAction(member.id, newRole, projectId)
      if (result.error) { setError(result.error); return }
      setMembers((prev) =>
        prev.map((m) => (m.id === member.id ? { ...m, project_role: newRole } : m))
      )
    })
  }

  const handleRemove = () => {
    if (!removeTarget) return
    startTransition(async () => {
      const result = await removeProjectMemberAction(removeTarget.id, projectId)
      if (result.error) { setError(result.error); return }
      setMembers((prev) => prev.filter((m) => m.id !== removeTarget.id))
      setRemoveTarget(null)
    })
  }

  const getCustomRole = (profile?: Profile) => {
    if (!profile?.custom_role_id) return null
    return customRoles.find((r) => r.id === profile.custom_role_id) ?? null
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4" />
            Project Team
          </CardTitle>
          {canManage && (
            <Button size="sm" variant="outline" onClick={() => { setAddOpen(true); setError(null) }}>
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Add Member
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {members.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <Users className="h-8 w-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">No team members assigned yet.</p>
            {canManage && (
              <Button size="sm" variant="outline" className="mt-3" onClick={() => setAddOpen(true)}>
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Add First Member
              </Button>
            )}
          </div>
        ) : (
          <>
            {/* Leads */}
            {leads.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Crown className="h-3.5 w-3.5 text-amber-500" />
                  Project Lead{leads.length > 1 ? 's' : ''}
                </p>
                <div className="space-y-2">
                  {leads.map((m) => (
                    <MemberRow
                      key={m.id}
                      member={m}
                      customRole={getCustomRole(m.profile)}
                      canManage={canManage}
                      isPending={isPending}
                      onRoleChange={handleRoleChange}
                      onRemove={() => setRemoveTarget(m)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Members */}
            {regularMembers.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5" />
                  Members
                </p>
                <div className="space-y-2">
                  {regularMembers.map((m) => (
                    <MemberRow
                      key={m.id}
                      member={m}
                      customRole={getCustomRole(m.profile)}
                      canManage={canManage}
                      isPending={isPending}
                      onRoleChange={handleRoleChange}
                      onRemove={() => setRemoveTarget(m)}
                    />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>

      {/* Add Member Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Team Member</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Role in Project</label>
              <Select value={selectedRole} onValueChange={(v) => setSelectedRole(v as 'lead' | 'member')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="lead">
                    <div className="flex items-center gap-2">
                      <Crown className="h-3.5 w-3.5 text-amber-500" />
                      Project Lead
                    </div>
                  </SelectItem>
                  <SelectItem value="member">
                    <div className="flex items-center gap-2">
                      <Users className="h-3.5 w-3.5" />
                      Member
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Select Person</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name or email..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <div className="border rounded-md max-h-52 overflow-y-auto">
                {filtered.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">
                    {available.length === 0 ? 'All staff already added' : 'No results'}
                  </p>
                ) : (
                  filtered.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className={`w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-muted/50 transition-colors ${
                        selectedUserId === p.id ? 'bg-primary/10' : ''
                      }`}
                      onClick={() => setSelectedUserId(p.id)}
                    >
                      <Avatar className="h-8 w-8 flex-shrink-0">
                        <AvatarImage src={p.avatar_url ?? undefined} />
                        <AvatarFallback className="text-xs">{getInitials(p.full_name)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{p.full_name}</p>
                        <p className="text-xs text-muted-foreground truncate">{p.email}</p>
                      </div>
                      {selectedUserId === p.id && (
                        <div className="ml-auto h-4 w-4 rounded-full bg-primary flex-shrink-0" />
                      )}
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAdd} disabled={isPending || !selectedUserId}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Add Member
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove Confirm */}
      <AlertDialog open={!!removeTarget} onOpenChange={(o) => !o && setRemoveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Member</AlertDialogTitle>
            <AlertDialogDescription>
              Remove <strong>{removeTarget?.profile?.full_name ?? 'this member'}</strong> from the list team?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemove}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}

// ── Member Row ──────────────────────────────────────────────────────────────
interface MemberRowProps {
  member: ListMember
  customRole: CustomRole | null
  canManage: boolean
  isPending: boolean
  onRoleChange: (m: ListMember, role: 'lead' | 'member') => void
  onRemove: () => void
}

function MemberRow({ member, customRole, canManage, isPending, onRoleChange, onRemove }: MemberRowProps) {
  const profile = member.profile
  return (
    <div className="flex items-center gap-3 rounded-lg border bg-card p-3">
      <Avatar className="h-9 w-9 flex-shrink-0">
        <AvatarImage src={profile?.avatar_url ?? undefined} />
        <AvatarFallback className="text-sm">
          {getInitials(profile?.full_name ?? '?')}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-medium truncate">{profile?.full_name ?? 'Unknown'}</p>
          {customRole && (
            <Badge
              style={{
                backgroundColor: customRole.color + '20',
                color: customRole.color,
                borderColor: customRole.color + '40',
              }}
              variant="outline"
              className="text-[10px] h-4 px-1.5 font-medium"
            >
              {customRole.name}
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground truncate">{profile?.email ?? ''}</p>
      </div>
      {canManage && (
        <div className="flex items-center gap-1 flex-shrink-0">
          <Select
            value={member.project_role}
            onValueChange={(v) => onRoleChange(member, v as 'lead' | 'member')}
            disabled={isPending}
          >
            <SelectTrigger className="h-7 text-xs w-[90px] px-2">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="lead" className="text-xs">Lead</SelectItem>
              <SelectItem value="member" className="text-xs">Member</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-destructive"
            onClick={onRemove}
            disabled={isPending}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </div>
  )
}
