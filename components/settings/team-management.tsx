'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Profile, Workspace, WorkspaceAssignment, Role } from '@/types'
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
import { Alert, AlertDescription } from '@/components/ui/alert'
import { CreateUserDialog } from './create-user-dialog'
import { Plus, Search, MoreVertical, UserCog, Loader2 } from 'lucide-react'
import { updateUserRoleAction } from '@/app/actions/user'

interface TeamManagementProps {
  users: Profile[]
  workspaces: Workspace[]
  workspaceAssignments: (WorkspaceAssignment & { workspace?: Workspace })[]
}

const roleConfig: Record<string, { label: string; className: string }> = {
  super_admin: { label: 'Admin', className: 'bg-red-100 text-red-700' },
  staff: { label: 'Staff', className: 'bg-blue-100 text-blue-700' },
  client: { label: 'Client', className: 'bg-gray-100 text-gray-700' },
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export function TeamManagement({ users, workspaces, workspaceAssignments }: TeamManagementProps) {
  const router = useRouter()
  const [createOpen, setCreateOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      search === '' ||
      u.full_name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase())
    const matchesRole = roleFilter === 'all' || u.role === roleFilter
    return matchesSearch && matchesRole
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

  return (
    <div className="space-y-4">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

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
          <SelectTrigger className="w-[130px]">
            <SelectValue placeholder="All Roles" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Roles</SelectItem>
            <SelectItem value="super_admin">Admin</SelectItem>
            <SelectItem value="staff">Staff</SelectItem>
            <SelectItem value="client">Client</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add User
        </Button>
      </div>

      <div className="rounded-md border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead>User</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Workspaces</TableHead>
              <TableHead className="w-[60px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredUsers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                  No users found
                </TableCell>
              </TableRow>
            ) : (
              filteredUsers.map((user) => {
                const rc = roleConfig[user.role] ?? roleConfig.staff
                const userWorkspaces = getUserWorkspaces(user.id)
                const isUpdating = updatingUserId === user.id

                return (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={user.avatar_url ?? undefined} />
                          <AvatarFallback className="text-xs">
                            {getInitials(user.full_name)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm font-medium leading-none">{user.full_name}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{user.email}</p>
                          {user.is_temp_password && (
                            <Badge
                              variant="outline"
                              className="mt-1 text-[10px] h-4 px-1 border-amber-300 text-amber-600"
                            >
                              Temp Password
                            </Badge>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${rc.className}`}
                      >
                        {rc.label}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {userWorkspaces.length === 0 ? (
                          <span className="text-xs text-muted-foreground">No workspaces</span>
                        ) : (
                          userWorkspaces.map((ws) => (
                            <Badge key={ws.id} variant="outline" className="text-xs">
                              {ws.name}
                            </Badge>
                          ))
                        )}
                      </div>
                    </TableCell>
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
                            <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                              Change Role
                            </div>
                            <DropdownMenuSeparator />
                            {user.role !== 'super_admin' && (
                              <DropdownMenuItem
                                onClick={() => handleRoleChange(user.id, 'super_admin')}
                              >
                                <UserCog className="mr-2 h-4 w-4" />
                                Make Admin
                              </DropdownMenuItem>
                            )}
                            {user.role !== 'staff' && (
                              <DropdownMenuItem
                                onClick={() => handleRoleChange(user.id, 'staff')}
                              >
                                Make Staff
                              </DropdownMenuItem>
                            )}
                            {user.role !== 'client' && (
                              <DropdownMenuItem
                                onClick={() => handleRoleChange(user.id, 'client')}
                              >
                                Make Client
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
    </div>
  )
}
