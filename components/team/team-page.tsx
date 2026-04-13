'use client'

import { useState } from 'react'
import { Profile, Space, SpaceAssignment, Role } from '@/types'
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
import { Card, CardContent } from '@/components/ui/card'
import { Mail, Search, Users, Shield, User, Briefcase } from 'lucide-react'
import { format, parseISO } from 'date-fns'

interface TeamPageProps {
  profile: Profile
  allProfiles: Profile[]
  workspaces: Space[]
  workspaceAssignments: (SpaceAssignment & { workspace?: Space })[]
}

const roleConfig: Record<string, { label: string; icon: React.ElementType; className: string }> = {
  super_admin: { label: 'Admin', icon: Shield, className: 'bg-red-100 text-red-700' },
  staff: { label: 'Staff', icon: User, className: 'bg-blue-100 text-blue-700' },
  client: { label: 'Client', icon: Briefcase, className: 'bg-muted text-foreground/80' },
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

function UserCard({
  user,
  workspaces,
}: {
  user: Profile
  workspaces: Space[]
}) {
  const rc = roleConfig[user.role] ?? roleConfig.staff
  const RoleIcon = rc.icon

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="pt-5 pb-4">
        <div className="flex flex-col items-center text-center gap-3">
          <Avatar className="h-16 w-16">
            <AvatarImage src={user.avatar_url ?? undefined} />
            <AvatarFallback className="text-lg bg-primary/10 text-primary font-semibold">
              {getInitials(user.full_name)}
            </AvatarFallback>
          </Avatar>

          <div className="space-y-1 w-full">
            <p className="font-semibold text-sm leading-tight">{user.full_name}</p>
            <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
              <Mail className="h-3 w-3 shrink-0" />
              <span className="truncate max-w-[160px]">{user.email}</span>
            </div>
          </div>

          <span
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${rc.className}`}
          >
            <RoleIcon className="h-3 w-3" />
            {rc.label}
          </span>

          {workspaces.length > 0 && (
            <div className="w-full">
              <p className="text-xs text-muted-foreground mb-1.5">Spaces</p>
              <div className="flex flex-wrap justify-center gap-1">
                {workspaces.map((ws) => (
                  <Badge key={ws.id} variant="outline" className="text-xs">
                    {ws.name}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {user.is_temp_password && (
            <Badge variant="outline" className="text-[10px] border-amber-300 text-amber-600">
              Temp Password
            </Badge>
          )}

          <p className="text-[11px] text-muted-foreground">
            Joined {format(parseISO(user.created_at), 'MMM yyyy')}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

export function TeamPage({
  profile,
  allProfiles,
  workspaces,
  workspaceAssignments,
}: TeamPageProps) {
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [spaceFilter, setSpaceFilter] = useState('all')

  const getUserWorkspaces = (userId: string): Space[] => {
    return workspaceAssignments
      .filter((a) => a.user_id === userId && a.workspace)
      .map((a) => a.workspace as Space)
  }

  const filteredUsers = allProfiles.filter((u) => {
    const matchesSearch =
      search === '' ||
      u.full_name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase())

    const matchesRole = roleFilter === 'all' || u.role === roleFilter

    const matchesWorkspace =
      spaceFilter === 'all' ||
      workspaceAssignments.some(
        (a) => a.user_id === u.id && a.space_id === spaceFilter
      )

    return matchesSearch && matchesRole && matchesWorkspace
  })

  const staffCount = allProfiles.filter((u) => u.role === 'staff').length
  const adminCount = allProfiles.filter((u) => u.role === 'super_admin').length
  const clientCount = allProfiles.filter((u) => u.role === 'client').length

  return (
    <div className="page-inner">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Team</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {allProfiles.length} members — {adminCount} admin, {staffCount} staff, {clientCount} client
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
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
            <SelectItem value="super_admin">Admin</SelectItem>
            <SelectItem value="staff">Staff</SelectItem>
            <SelectItem value="client">Client</SelectItem>
          </SelectContent>
        </Select>
        {workspaces.length > 0 && (
          <Select value={spaceFilter} onValueChange={setSpaceFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="All Spaces" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Spaces</SelectItem>
              {workspaces.map((ws) => (
                <SelectItem key={ws.id} value={ws.id}>
                  {ws.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* User Grid */}
      {filteredUsers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground border rounded-lg bg-muted/30">
          <Users className="h-10 w-10 mb-3 opacity-40" />
          <p className="text-sm font-medium">No team members found</p>
          <p className="text-xs mt-1">Try adjusting your filters</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {filteredUsers.map((user) => (
            <UserCard
              key={user.id}
              user={user}
              workspaces={getUserWorkspaces(user.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
