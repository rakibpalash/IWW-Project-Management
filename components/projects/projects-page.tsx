'use client'

import { useState, useMemo } from 'react'
import { Project, Profile, Workspace, ProjectStatus, Priority } from '@/types'
import { ProjectCard } from './project-card'
import { CreateProjectDialog } from './create-project-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { LayoutGrid, List, Plus, Search, X } from 'lucide-react'
import { PROJECT_STATUSES, PRIORITIES } from '@/lib/constants'
import { cn } from '@/lib/utils'

interface ProjectsPageProps {
  initialProjects: Project[]
  profile: Profile
  workspaces: Workspace[]
}

type ViewMode = 'grid' | 'list'

export function ProjectsPage({ initialProjects, profile, workspaces }: ProjectsPageProps) {
  const [projects, setProjects] = useState<Project[]>(initialProjects)
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [priorityFilter, setPriorityFilter] = useState<string>('all')
  const [workspaceFilter, setWorkspaceFilter] = useState<string>('all')
  const [showCreateDialog, setShowCreateDialog] = useState(false)

  const canCreate = profile.role === 'super_admin' || profile.role === 'staff'
  const isAdmin = profile.role === 'super_admin'

  const filteredProjects = useMemo(() => {
    return projects.filter((project) => {
      const matchesSearch =
        search === '' ||
        project.name.toLowerCase().includes(search.toLowerCase()) ||
        project.description?.toLowerCase().includes(search.toLowerCase()) ||
        project.client?.full_name?.toLowerCase().includes(search.toLowerCase())

      const matchesStatus = statusFilter === 'all' || project.status === statusFilter
      const matchesPriority = priorityFilter === 'all' || project.priority === priorityFilter
      const matchesWorkspace =
        workspaceFilter === 'all' || project.workspace_id === workspaceFilter

      return matchesSearch && matchesStatus && matchesPriority && matchesWorkspace
    })
  }, [projects, search, statusFilter, priorityFilter, workspaceFilter])

  const hasActiveFilters =
    search !== '' ||
    statusFilter !== 'all' ||
    priorityFilter !== 'all' ||
    workspaceFilter !== 'all'

  function clearFilters() {
    setSearch('')
    setStatusFilter('all')
    setPriorityFilter('all')
    setWorkspaceFilter('all')
  }

  function handleProjectCreated(newProject: Project) {
    setProjects((prev) => [newProject, ...prev])
    setShowCreateDialog(false)
  }

  function handleProjectUpdated(updated: Project) {
    setProjects((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))
  }

  function handleProjectDeleted(id: string) {
    setProjects((prev) => prev.filter((p) => p.id !== id))
  }

  function handleProjectCloned(cloned: Project) {
    setProjects((prev) => [cloned, ...prev])
  }

  // Count projects by status for overview badges
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const p of projects) {
      counts[p.status] = (counts[p.status] ?? 0) + 1
    }
    return counts
  }, [projects])

  return (
    <div className="page-inner">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Projects</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {projects.length} project{projects.length !== 1 ? 's' : ''} total
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex items-center rounded-md border bg-background p-0.5">
            <Button
              variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => setViewMode('grid')}
              aria-label="Grid view"
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'secondary' : 'ghost'}
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => setViewMode('list')}
              aria-label="List view"
            >
              <List className="h-4 w-4" />
            </Button>
          </div>

          {canCreate && (
            <Button onClick={() => setShowCreateDialog(true)} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              New Project
            </Button>
          )}
        </div>
      </div>

      {/* Status summary pills */}
      <div className="flex flex-wrap gap-2">
        {PROJECT_STATUSES.map((s) => {
          const count = statusCounts[s.value] ?? 0
          if (count === 0) return null
          return (
            <button
              key={s.value}
              onClick={() =>
                setStatusFilter(statusFilter === s.value ? 'all' : s.value)
              }
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                statusFilter === s.value
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background text-muted-foreground hover:bg-muted'
              )}
            >
              {s.label}
              <span
                className={cn(
                  'rounded-full px-1.5 py-0.5 text-xs',
                  statusFilter === s.value
                    ? 'bg-primary-foreground/20 text-primary-foreground'
                    : 'bg-muted text-muted-foreground'
                )}
              >
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {/* Filter bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search projects…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {PROJECT_STATUSES.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={priorityFilter} onValueChange={setPriorityFilter}>
            <SelectTrigger className="w-[130px]">
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Priorities</SelectItem>
              {PRIORITIES.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {isAdmin && workspaces.length > 0 && (
            <Select value={workspaceFilter} onValueChange={setWorkspaceFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Workspace" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Workspaces</SelectItem>
                {workspaces.map((w) => (
                  <SelectItem key={w.id} value={w.id}>
                    {w.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1">
              <X className="h-3.5 w-3.5" />
              Clear
            </Button>
          )}
        </div>
      </div>

      {/* Results */}
      {filteredProjects.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
          <div className="mb-4 rounded-full bg-muted p-4">
            <Search className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold">No projects found</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm">
            {hasActiveFilters
              ? 'Try adjusting your filters or search query.'
              : canCreate
              ? 'Get started by creating your first project.'
              : 'No projects have been assigned to you yet.'}
          </p>
          {hasActiveFilters && (
            <Button variant="outline" size="sm" onClick={clearFilters} className="mt-4">
              Clear filters
            </Button>
          )}
          {!hasActiveFilters && canCreate && (
            <Button size="sm" onClick={() => setShowCreateDialog(true)} className="mt-4">
              <Plus className="h-4 w-4 mr-2" />
              New Project
            </Button>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredProjects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              isAdmin={isAdmin}
              userRole={profile.role}
              onUpdated={handleProjectUpdated}
              onDeleted={handleProjectDeleted}
              onCloned={handleProjectCloned}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {filteredProjects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              listMode
              isAdmin={isAdmin}
              userRole={profile.role}
              onUpdated={handleProjectUpdated}
              onDeleted={handleProjectDeleted}
              onCloned={handleProjectCloned}
            />
          ))}
        </div>
      )}

      {/* Create project dialog */}
      {showCreateDialog && (
        <CreateProjectDialog
          open={showCreateDialog}
          onOpenChange={setShowCreateDialog}
          workspaces={workspaces}
          onCreated={handleProjectCreated}
          profile={profile}
        />
      )}
    </div>
  )
}
