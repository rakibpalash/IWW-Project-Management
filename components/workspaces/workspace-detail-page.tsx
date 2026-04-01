'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { AssignStaffDialog } from './assign-staff-dialog'
import { cn, formatDate, getStatusColor, getPriorityColor, formatStatus, getInitials } from '@/lib/utils'
import { Workspace, Profile, Project } from '@/types'
import {
  Building2,
  Users,
  FolderKanban,
  UserPlus,
  Pencil,
  Calendar,
  ArrowLeft,
} from 'lucide-react'

interface WorkspaceDetailPageProps {
  workspace: Workspace
  members: Profile[]
  projects: Project[]
  isAdmin: boolean
}

export function WorkspaceDetailPage({
  workspace,
  members,
  projects,
  isAdmin,
}: WorkspaceDetailPageProps) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [showAssign, setShowAssign] = useState(false)

  function handleAssignSuccess() {
    startTransition(() => {
      router.refresh()
    })
  }

  return (
    <div className="space-y-6">
      {/* Back button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => router.push('/workspaces')}
        className="gap-2 text-gray-500 -ml-2"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Workspaces
      </Button>

      {/* Workspace header */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <Building2 className="h-7 w-7" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{workspace.name}</h1>
              {workspace.description && (
                <p className="mt-1 text-sm text-gray-500">{workspace.description}</p>
              )}
              <div className="mt-2 flex items-center gap-1.5 text-xs text-gray-400">
                <Calendar className="h-3.5 w-3.5" />
                <span>Created {formatDate(workspace.created_at)}</span>
              </div>
            </div>
          </div>
          {isAdmin && (
            <Button
              variant="outline"
              size="sm"
              className="gap-2 shrink-0"
              onClick={() => {
                // Edit functionality - navigate or open edit dialog
                // Placeholder: could be expanded to an inline edit or separate dialog
              }}
            >
              <Pencil className="h-4 w-4" />
              Edit
            </Button>
          )}
        </div>

        {/* Quick stats */}
        <div className="mt-6 grid grid-cols-2 gap-4 border-t border-gray-100 pt-5 sm:grid-cols-3">
          <div className="flex items-center gap-2 text-sm">
            <Users className="h-4 w-4 text-gray-400" />
            <span className="text-gray-500">
              <span className="font-semibold text-gray-900">{members.length}</span> member
              {members.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <FolderKanban className="h-4 w-4 text-gray-400" />
            <span className="text-gray-500">
              <span className="font-semibold text-gray-900">{projects.length}</span> project
              {projects.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <FolderKanban className="h-4 w-4 text-gray-400" />
            <span className="text-gray-500">
              <span className="font-semibold text-gray-900">
                {projects.filter((p) => p.status === 'in_progress').length}
              </span>{' '}
              active
            </span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="members" className="space-y-4">
        <TabsList>
          <TabsTrigger value="members" className="gap-2">
            <Users className="h-4 w-4" />
            Members
            {members.length > 0 && (
              <Badge variant="secondary" className="ml-1 text-xs">
                {members.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="projects" className="gap-2">
            <FolderKanban className="h-4 w-4" />
            Projects
            {projects.length > 0 && (
              <Badge variant="secondary" className="ml-1 text-xs">
                {projects.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Members Tab */}
        <TabsContent value="members" className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">
              {members.length} staff member{members.length !== 1 ? 's' : ''} assigned
            </p>
            {isAdmin && (
              <Button size="sm" className="gap-2" onClick={() => setShowAssign(true)}>
                <UserPlus className="h-4 w-4" />
                Assign Staff
              </Button>
            )}
          </div>

          {members.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-gray-50 py-12">
              <Users className="h-10 w-10 text-gray-300" />
              <p className="mt-3 text-sm text-gray-500">No staff assigned yet</p>
              {isAdmin && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4 gap-2"
                  onClick={() => setShowAssign(true)}
                >
                  <UserPlus className="h-4 w-4" />
                  Assign Staff
                </Button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {members.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-semibold text-blue-700">
                    {getInitials(member.full_name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-900">
                      {member.full_name}
                    </p>
                    <p className="truncate text-xs text-gray-500">{member.email}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Projects Tab */}
        <TabsContent value="projects" className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">
              {projects.length} project{projects.length !== 1 ? 's' : ''} in this workspace
            </p>
            {isAdmin && (
              <Button
                size="sm"
                variant="outline"
                className="gap-2"
                onClick={() => router.push('/projects')}
              >
                <FolderKanban className="h-4 w-4" />
                View All Projects
              </Button>
            )}
          </div>

          {projects.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-gray-50 py-12">
              <FolderKanban className="h-10 w-10 text-gray-300" />
              <p className="mt-3 text-sm text-gray-500">No projects in this workspace yet</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              {projects.map((project) => (
                <div
                  key={project.id}
                  className="group cursor-pointer rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-all hover:border-blue-200 hover:shadow-md"
                  onClick={() => router.push(`/projects/${project.id}`)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-gray-900 group-hover:text-blue-700 transition-colors">
                        {project.name}
                      </p>
                      {project.description && (
                        <p className="mt-0.5 truncate text-sm text-gray-500">
                          {project.description}
                        </p>
                      )}
                    </div>
                    <Badge
                      variant="outline"
                      className={cn('shrink-0 text-xs capitalize', getStatusColor(project.status))}
                    >
                      {formatStatus(project.status)}
                    </Badge>
                  </div>

                  <div className="mt-4 space-y-1.5">
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span>Progress</span>
                      <span>{project.progress}%</span>
                    </div>
                    <Progress value={project.progress} className="h-1.5" />
                  </div>

                  <div className="mt-3 flex items-center gap-3 text-xs text-gray-400">
                    <Badge
                      variant="outline"
                      className={cn('text-xs capitalize', getPriorityColor(project.priority))}
                    >
                      {project.priority}
                    </Badge>
                    {project.due_date && (
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {formatDate(project.due_date)}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Assign Staff Dialog */}
      <AssignStaffDialog
        open={showAssign}
        onOpenChange={setShowAssign}
        workspaceId={workspace.id}
        currentMemberIds={members.map((m) => m.id)}
        onSuccess={handleAssignSuccess}
      />
    </div>
  )
}
