'use client'

import { useState, useTransition, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { format, parseISO } from 'date-fns'
import { AssignStaffDialog } from './assign-staff-dialog'
import { CreateProjectDialog } from '@/components/projects/create-project-dialog'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Workspace, Profile, Project } from '@/types'
import {
  cn,
  formatStatus,
  getStatusColor,
  getPriorityColor,
  getInitials,
} from '@/lib/utils'
import {
  ArrowLeft,
  Users,
  Search,
  Filter,
  LayoutGrid,
  List,
  MoreHorizontal,
  Plus,
  RefreshCw,
  ChevronDown,
  SlidersHorizontal,
  Share2,
  Maximize2,
  UserPlus,
  FolderKanban,
  LayoutList,
  Calendar,
  ArrowUpDown,
  ExternalLink,
} from 'lucide-react'

interface WorkspaceDetailPageProps {
  workspace: Workspace
  members: Profile[]
  projects: Project[]
  isAdmin: boolean
}

type TabType = 'list' | 'members' | 'board'
type SortKey = 'name' | 'priority' | 'status' | 'created_at' | 'updated_at' | 'due_date'

const PRIORITY_ORDER: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 }

const STATUS_COLORS: Record<string, string> = {
  planning:    'bg-slate-100 text-slate-700 border-slate-200',
  in_progress: 'bg-amber-50 text-amber-700 border-amber-200',
  on_hold:     'bg-orange-50 text-orange-700 border-orange-200',
  completed:   'bg-green-50 text-green-700 border-green-200',
  cancelled:   'bg-red-50 text-red-700 border-red-200',
}

const PRIORITY_DOT: Record<string, string> = {
  urgent: 'text-red-500',
  high:   'text-orange-500',
  medium: 'text-yellow-500',
  low:    'text-blue-400',
}

const PRIORITY_LABEL: Record<string, string> = {
  urgent: '↑↑ Urgent',
  high:   '↑ High',
  medium: '= Medium',
  low:    '↓ Low',
}

export function WorkspaceDetailPage({
  workspace,
  members,
  projects: initialProjects,
  isAdmin,
}: WorkspaceDetailPageProps) {
  const router = useRouter()
  const [, startTransition] = useTransition()

  const [activeTab, setActiveTab] = useState<TabType>('list')
  const [showAssign, setShowAssign] = useState(false)
  const [showCreateProject, setShowCreateProject] = useState(false)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [sortKey, setSortKey] = useState<SortKey>('created_at')
  const [sortAsc, setSortAsc] = useState(false)
  const [projects, setProjects] = useState<Project[]>(initialProjects)

  function handleRefresh() {
    startTransition(() => router.refresh())
  }

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortAsc((v) => !v)
    else { setSortKey(key); setSortAsc(true) }
  }

  const filtered = useMemo(() => {
    let list = [...projects]
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.description ?? '').toLowerCase().includes(q)
      )
    }
    list.sort((a, b) => {
      let cmp = 0
      if (sortKey === 'priority') {
        cmp = (PRIORITY_ORDER[a.priority] ?? 99) - (PRIORITY_ORDER[b.priority] ?? 99)
      } else if (sortKey === 'name') {
        cmp = a.name.localeCompare(b.name)
      } else if (sortKey === 'status') {
        cmp = a.status.localeCompare(b.status)
      } else if (sortKey === 'due_date') {
        cmp = (a.due_date ?? '9999').localeCompare(b.due_date ?? '9999')
      } else if (sortKey === 'updated_at') {
        cmp = (a.updated_at ?? '').localeCompare(b.updated_at ?? '')
      } else {
        cmp = (a.created_at ?? '').localeCompare(b.created_at ?? '')
      }
      return sortAsc ? cmp : -cmp
    })
    return list
  }, [projects, search, sortKey, sortAsc])

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleAll() {
    if (selected.size === filtered.length) setSelected(new Set())
    else setSelected(new Set(filtered.map((p) => p.id)))
  }

  function fmtDt(iso?: string | null) {
    if (!iso) return '—'
    try { return format(parseISO(iso), 'MMM dd, yyyy, h:mm a') } catch { return iso }
  }

  function fmtDate(iso?: string | null) {
    if (!iso) return '—'
    try { return format(parseISO(iso), 'MMM dd, yyyy') } catch { return iso }
  }

  const tabs: { key: TabType; label: string; icon: React.ReactNode }[] = [
    { key: 'list',    label: 'List',    icon: <LayoutList className="h-3.5 w-3.5" /> },
    { key: 'members', label: 'Members', icon: <Users className="h-3.5 w-3.5" /> },
    { key: 'board',   label: 'Board',   icon: <LayoutGrid className="h-3.5 w-3.5" /> },
  ]

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] -m-6 overflow-hidden">

      {/* ── Breadcrumb ── */}
      <div className="px-6 pt-4 pb-0">
        <button
          onClick={() => router.push('/workspaces')}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-3"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Workspaces
        </button>
      </div>

      {/* ── Workspace header ── */}
      <div className="px-6 pb-0">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-3">
            {/* Workspace icon */}
            <div className="h-8 w-8 rounded-md bg-blue-600 flex items-center justify-center shrink-0">
              <FolderKanban className="h-4 w-4 text-white" />
            </div>
            <h1 className="text-xl font-bold">{workspace.name}</h1>

            {/* Member avatars */}
            <div className="flex -space-x-1.5 ml-1">
              {members.slice(0, 5).map((m) => (
                <Avatar key={m.id} className="h-6 w-6 border-2 border-background">
                  <AvatarImage src={m.avatar_url ?? undefined} />
                  <AvatarFallback className="text-[10px] bg-blue-100 text-blue-700">
                    {getInitials(m.full_name)}
                  </AvatarFallback>
                </Avatar>
              ))}
              {members.length > 5 && (
                <div className="h-6 w-6 rounded-full bg-muted border-2 border-background flex items-center justify-center text-[10px] font-medium text-muted-foreground">
                  +{members.length - 5}
                </div>
              )}
            </div>

            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </div>

          {/* Top-right actions */}
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground">
              <Share2 className="h-3.5 w-3.5" />
            </Button>
            {isAdmin && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1.5 text-xs text-muted-foreground"
                onClick={() => setShowAssign(true)}
              >
                <UserPlus className="h-3.5 w-3.5" />
                Assign Staff
              </Button>
            )}
            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground">
              <Maximize2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {workspace.description && (
          <p className="text-sm text-muted-foreground ml-11 mb-1">{workspace.description}</p>
        )}
      </div>

      {/* ── Tab bar ── */}
      <div className="px-6 border-b">
        <div className="flex items-center gap-0">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px',
                activeTab === tab.key
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30'
              )}
            >
              {tab.icon}
              {tab.label}
              {tab.key === 'list' && projects.length > 0 && (
                <span className={cn(
                  'ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold',
                  activeTab === 'list' ? 'bg-blue-100 text-blue-700' : 'bg-muted text-muted-foreground'
                )}>
                  {projects.length}
                </span>
              )}
              {tab.key === 'members' && members.length > 0 && (
                <span className={cn(
                  'ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold',
                  activeTab === 'members' ? 'bg-blue-100 text-blue-700' : 'bg-muted text-muted-foreground'
                )}>
                  {members.length}
                </span>
              )}
            </button>
          ))}
          <button className="flex items-center gap-1 px-3 py-2.5 text-sm text-muted-foreground hover:text-foreground border-b-2 border-transparent -mb-px">
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* ── LIST TAB ── */}
      {activeTab === 'list' && (
        <div className="flex flex-col flex-1 overflow-hidden">

          {/* Toolbar */}
          <div className="flex items-center gap-2 px-4 py-2 border-b bg-background">
            {/* Left tools */}
            <div className="flex items-center gap-1.5 flex-1">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search projects…"
                  className="h-8 pl-8 w-48 text-xs"
                />
              </div>

              {/* Member filter avatars */}
              <div className="flex -space-x-1 ml-1">
                {members.slice(0, 3).map((m) => (
                  <Avatar key={m.id} className="h-6 w-6 border-2 border-background cursor-pointer hover:z-10 hover:scale-110 transition-transform">
                    <AvatarImage src={m.avatar_url ?? undefined} />
                    <AvatarFallback className="text-[10px] bg-slate-200 text-slate-600">
                      {getInitials(m.full_name)}
                    </AvatarFallback>
                  </Avatar>
                ))}
              </div>

              <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs text-muted-foreground">
                <Filter className="h-3.5 w-3.5" />
                Filter
              </Button>
              <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs text-muted-foreground">
                <SlidersHorizontal className="h-3.5 w-3.5" />
                Group
              </Button>
            </div>

            {/* Right tools */}
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs text-muted-foreground hidden sm:flex">
                <ArrowUpDown className="h-3.5 w-3.5" />
                Sort
              </Button>
              <div className="flex items-center border rounded-md overflow-hidden">
                <button className="px-2 py-1.5 bg-blue-50 text-blue-600 border-r">
                  <List className="h-3.5 w-3.5" />
                </button>
                <button className="px-2 py-1.5 text-muted-foreground hover:bg-muted">
                  <LayoutGrid className="h-3.5 w-3.5" />
                </button>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Table */}
          <div className="flex-1 overflow-auto">
            <table className="w-full text-sm border-collapse">
              <thead className="sticky top-0 z-10 bg-muted/60 backdrop-blur-sm">
                <tr className="border-b">
                  <th className="w-10 px-3 py-2.5 text-left">
                    <Checkbox
                      checked={selected.size === filtered.length && filtered.length > 0}
                      onCheckedChange={toggleAll}
                    />
                  </th>
                  <th className="px-3 py-2.5 text-left font-medium text-xs text-muted-foreground min-w-[260px]">
                    <button className="flex items-center gap-1 hover:text-foreground" onClick={() => handleSort('name')}>
                      Project Name
                      {sortKey === 'name' && <ChevronDown className={cn('h-3 w-3', !sortAsc && 'rotate-180')} />}
                    </button>
                  </th>
                  <th className="px-3 py-2.5 text-left font-medium text-xs text-muted-foreground w-32">
                    <button className="flex items-center gap-1 hover:text-foreground" onClick={() => handleSort('priority')}>
                      Priority
                      {sortKey === 'priority' && <ChevronDown className={cn('h-3 w-3', !sortAsc && 'rotate-180')} />}
                    </button>
                  </th>
                  <th className="px-3 py-2.5 text-left font-medium text-xs text-muted-foreground w-36">
                    <button className="flex items-center gap-1 hover:text-foreground" onClick={() => handleSort('status')}>
                      Status
                      {sortKey === 'status' && <ChevronDown className={cn('h-3 w-3', !sortAsc && 'rotate-180')} />}
                    </button>
                  </th>
                  <th className="px-3 py-2.5 text-left font-medium text-xs text-muted-foreground w-16">
                    Progress
                  </th>
                  <th className="px-3 py-2.5 text-left font-medium text-xs text-muted-foreground w-44">
                    <button className="flex items-center gap-1 hover:text-foreground" onClick={() => handleSort('created_at')}>
                      Created
                      {sortKey === 'created_at' && <ChevronDown className={cn('h-3 w-3', !sortAsc && 'rotate-180')} />}
                    </button>
                  </th>
                  <th className="px-3 py-2.5 text-left font-medium text-xs text-muted-foreground w-44">
                    <button className="flex items-center gap-1 hover:text-foreground" onClick={() => handleSort('updated_at')}>
                      Updated
                      {sortKey === 'updated_at' && <ChevronDown className={cn('h-3 w-3', !sortAsc && 'rotate-180')} />}
                    </button>
                  </th>
                  <th className="px-3 py-2.5 text-left font-medium text-xs text-muted-foreground w-32">
                    <button className="flex items-center gap-1 hover:text-foreground" onClick={() => handleSort('due_date')}>
                      Due Date
                      {sortKey === 'due_date' && <ChevronDown className={cn('h-3 w-3', !sortAsc && 'rotate-180')} />}
                    </button>
                  </th>
                  <th className="w-10 px-2" />
                </tr>
              </thead>

              <tbody className="divide-y divide-border/50">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-16 text-center text-sm text-muted-foreground">
                      <FolderKanban className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                      {search ? 'No projects match your search.' : 'No projects in this workspace yet.'}
                    </td>
                  </tr>
                ) : (
                  filtered.map((project) => (
                    <tr
                      key={project.id}
                      className={cn(
                        'group hover:bg-muted/40 transition-colors cursor-pointer',
                        selected.has(project.id) && 'bg-blue-50/50'
                      )}
                    >
                      {/* Checkbox */}
                      <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selected.has(project.id)}
                          onCheckedChange={() => toggleSelect(project.id)}
                        />
                      </td>

                      {/* Project name */}
                      <td
                        className="px-3 py-2.5"
                        onClick={() => router.push(`/projects/${project.id}`)}
                      >
                        <div className="flex items-center gap-2">
                          <div className="h-5 w-5 rounded bg-blue-100 flex items-center justify-center shrink-0">
                            <FolderKanban className="h-3 w-3 text-blue-600" />
                          </div>
                          <span className="font-medium text-sm group-hover:text-blue-600 transition-colors truncate max-w-[220px]">
                            {project.name}
                          </span>
                          <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 shrink-0" />
                        </div>
                        {project.description && (
                          <p className="ml-7 text-xs text-muted-foreground truncate max-w-[220px] mt-0.5">
                            {project.description}
                          </p>
                        )}
                      </td>

                      {/* Priority */}
                      <td className="px-3 py-2.5" onClick={() => router.push(`/projects/${project.id}`)}>
                        <span className={cn('flex items-center gap-1.5 text-xs font-medium', PRIORITY_DOT[project.priority])}>
                          {PRIORITY_LABEL[project.priority] ?? project.priority}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="px-3 py-2.5" onClick={() => router.push(`/projects/${project.id}`)}>
                        <span className={cn(
                          'inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-semibold border',
                          STATUS_COLORS[project.status] ?? 'bg-muted text-muted-foreground'
                        )}>
                          {formatStatus(project.status)}
                          <ChevronDown className="h-3 w-3 opacity-60" />
                        </span>
                      </td>

                      {/* Progress */}
                      <td className="px-3 py-2.5" onClick={() => router.push(`/projects/${project.id}`)}>
                        <div className="flex items-center gap-1.5">
                          <div className="h-1.5 w-10 rounded-full bg-muted overflow-hidden">
                            <div
                              className="h-full bg-blue-500 rounded-full"
                              style={{ width: `${project.progress ?? 0}%` }}
                            />
                          </div>
                          <span className="text-xs text-muted-foreground">{project.progress ?? 0}%</span>
                        </div>
                      </td>

                      {/* Created */}
                      <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap" onClick={() => router.push(`/projects/${project.id}`)}>
                        {fmtDt(project.created_at)}
                      </td>

                      {/* Updated */}
                      <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap" onClick={() => router.push(`/projects/${project.id}`)}>
                        {fmtDt(project.updated_at)}
                      </td>

                      {/* Due date */}
                      <td className="px-3 py-2.5 text-xs whitespace-nowrap" onClick={() => router.push(`/projects/${project.id}`)}>
                        {project.due_date ? (
                          <span className="flex items-center gap-1 text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            {fmtDate(project.due_date)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/50">—</span>
                        )}
                      </td>

                      {/* Row actions */}
                      <td className="px-2 py-2.5" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <MoreHorizontal className="h-3.5 w-3.5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => router.push(`/projects/${project.id}`)}>
                              Open project
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => router.push(`/projects/${project.id}`)}>
                              View tasks
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* ── Table footer ── */}
          <div className="flex items-center justify-between px-4 py-2 border-t bg-background text-xs text-muted-foreground">
            <button
              className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors font-medium"
              onClick={() => setShowCreateProject(true)}
            >
              <Plus className="h-3.5 w-3.5" />
              Create
            </button>
            <div className="flex items-center gap-2">
              <span>{filtered.length} of {projects.length}</span>
              <button onClick={handleRefresh} className="hover:text-foreground transition-colors">
                <RefreshCw className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MEMBERS TAB ── */}
      {activeTab === 'members' && (
        <div className="flex-1 overflow-auto p-6">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-muted-foreground">
              {members.length} staff member{members.length !== 1 ? 's' : ''} assigned to this workspace
            </p>
            {isAdmin && (
              <Button size="sm" className="gap-2" onClick={() => setShowAssign(true)}>
                <UserPlus className="h-4 w-4" />
                Assign Staff
              </Button>
            )}
          </div>

          {members.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-16">
              <Users className="h-10 w-10 text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">No staff assigned yet</p>
              {isAdmin && (
                <Button variant="outline" size="sm" className="mt-4 gap-2" onClick={() => setShowAssign(true)}>
                  <UserPlus className="h-4 w-4" />
                  Assign Staff
                </Button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {members.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center gap-3 rounded-lg border bg-card p-3.5 hover:border-blue-200 hover:shadow-sm transition-all"
                >
                  <Avatar className="h-9 w-9 shrink-0">
                    <AvatarImage src={member.avatar_url ?? undefined} />
                    <AvatarFallback className="text-sm bg-blue-100 text-blue-700 font-semibold">
                      {getInitials(member.full_name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{member.full_name}</p>
                    <p className="truncate text-xs text-muted-foreground">{member.email}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── BOARD TAB ── */}
      {activeTab === 'board' && (
        <div className="flex-1 overflow-auto p-6">
          <div className="flex gap-4 h-full">
            {(['planning', 'in_progress', 'on_hold', 'completed'] as const).map((status) => {
              const cols = filtered.filter((p) => p.status === status)
              return (
                <div key={status} className="flex flex-col w-64 shrink-0">
                  <div className="flex items-center justify-between mb-3">
                    <span className={cn(
                      'inline-flex items-center rounded px-2 py-0.5 text-xs font-semibold border',
                      STATUS_COLORS[status]
                    )}>
                      {formatStatus(status)}
                    </span>
                    <span className="text-xs text-muted-foreground">{cols.length}</span>
                  </div>
                  <div className="flex flex-col gap-2 flex-1 overflow-y-auto">
                    {cols.map((project) => (
                      <div
                        key={project.id}
                        className="rounded-lg border bg-card p-3 cursor-pointer hover:border-blue-300 hover:shadow-sm transition-all"
                        onClick={() => router.push(`/projects/${project.id}`)}
                      >
                        <p className="text-sm font-medium mb-1.5 line-clamp-2">{project.name}</p>
                        <div className="flex items-center justify-between">
                          <span className={cn('text-xs font-medium', PRIORITY_DOT[project.priority])}>
                            {PRIORITY_LABEL[project.priority]}
                          </span>
                          {project.due_date && (
                            <span className="text-xs text-muted-foreground">{fmtDate(project.due_date)}</span>
                          )}
                        </div>
                        <div className="mt-2 h-1 rounded-full bg-muted overflow-hidden">
                          <div className="h-full bg-blue-500 rounded-full" style={{ width: `${project.progress ?? 0}%` }} />
                        </div>
                      </div>
                    ))}
                    {isAdmin && (
                      <button
                        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground p-2 rounded hover:bg-muted transition-colors"
                        onClick={() => setShowCreateProject(true)}
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Add project
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Dialogs ── */}
      <AssignStaffDialog
        open={showAssign}
        onOpenChange={setShowAssign}
        workspaceId={workspace.id}
        currentMemberIds={members.map((m) => m.id)}
        onSuccess={() => startTransition(() => router.refresh())}
      />

      {isAdmin && (
        <CreateProjectDialog
          open={showCreateProject}
          onOpenChange={setShowCreateProject}
          workspaces={[workspace]}
          onCreated={() => startTransition(() => router.refresh())}
        />
      )}
    </div>
  )
}
