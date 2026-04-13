'use client'

import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import {
  LayoutGrid,
  CheckSquare,
  Clock,
  CalendarDays,
  Users,
  Settings,
  Timer,
  BarChart2,
  PanelLeftClose,
  PanelLeftOpen,
  X,
  ChevronDown,
  ChevronRight,
  Plus,
  ListChecks,
  CalendarClock,
  Inbox,
  MoreHorizontal,
  FolderOpen,
  CircleDot,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Profile, Space, List, Task } from '@/types'
import { PermissionSet, can } from '@/lib/permissions'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { createClient } from '@/lib/supabase/client'
import { CreateWorkspaceDialog } from '@/components/workspaces/create-workspace-dialog'
import { CreateProjectDialog } from '@/components/projects/create-project-dialog'
import { CreateTaskDialog } from '@/components/tasks/create-task-dialog'

// ─── constants ─────────────────────────────────────────────────────────────────

const ROLE_LABELS: Record<Profile['role'], string> = {
  super_admin:     'CEO',
  account_manager: 'Org Admin',
  project_manager: 'Team Lead',
  staff:           'Staff',
  client:          'Client',
  partner:         'Partner',
}

const SPACE_COLORS = [
  '#7c3aed','#0891b2','#0284c7','#059669',
  '#d97706','#dc2626','#db2777','#4f46e5',
]
function getSpaceColor(id: string) {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return SPACE_COLORS[h % SPACE_COLORS.length]
}
function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
}

// ─── add menu popup ────────────────────────────────────────────────────────────

interface AddMenuItem {
  icon: React.ElementType
  label: string
  description: string
  onClick: () => void
}

function AddMenu({ items }: { items: AddMenuItem[] }) {
  return (
    <div className="w-56 rounded-xl bg-[#1e2130] border border-white/10 shadow-2xl overflow-hidden py-1.5">
      <p className="px-3 pt-1 pb-2 text-[10px] font-bold uppercase tracking-widest text-sidebar-foreground/35">
        Create
      </p>
      {items.map((item) => (
        <button
          key={item.label}
          onClick={item.onClick}
          className="flex w-full items-start gap-3 px-3 py-2 hover:bg-white/8 transition-colors text-left"
        >
          <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/8 border border-white/10">
            <item.icon className="h-3.5 w-3.5 text-sidebar-foreground/70" />
          </span>
          <span className="min-w-0">
            <p className="text-[13px] font-semibold text-white leading-tight">{item.label}</p>
            <p className="text-[11px] text-sidebar-foreground/40 leading-tight mt-0.5">{item.description}</p>
          </span>
        </button>
      ))}
    </div>
  )
}

// ─── nav item ──────────────────────────────────────────────────────────────────

function NavItem({
  href,
  icon: Icon,
  label,
  active,
  onClick,
  indent = false,
}: {
  href: string
  icon: React.ElementType
  label: string
  active: boolean
  onClick: () => void
  indent?: boolean
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        'group relative flex items-center gap-2.5 rounded-lg transition-colors select-none',
        indent ? 'pl-8 pr-3 py-1.5' : 'px-2 py-1.5',
        active
          ? 'bg-sidebar-primary/15 text-white'
          : 'text-sidebar-foreground/60 hover:bg-white/5 hover:text-sidebar-foreground/90',
      )}
    >
      {/* Left active bar */}
      {active && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-[18px] rounded-r-full bg-sidebar-primary" />
      )}
      <Icon className={cn(
        'shrink-0 transition-colors',
        indent ? 'h-[15px] w-[15px]' : 'h-[17px] w-[17px]',
        active
          ? 'text-sidebar-primary'
          : 'text-sidebar-foreground/40 group-hover:text-sidebar-foreground/70',
      )} />
      <span className={cn(
        'truncate font-semibold leading-tight',
        indent ? 'text-[12px]' : 'text-[13px]',
        active ? 'text-white' : '',
      )}>
        {label}
      </span>
    </Link>
  )
}

// ─── space item ────────────────────────────────────────────────────────────────

function SpaceItem({
  workspace,
  projects,
  pathname,
  onClose,
  onCreateList,
  onCreateTask,
}: {
  workspace: Space
  projects: List[]
  pathname: string
  onClose: () => void
  onCreateList: (spaceId: string) => void
  onCreateTask: (listId: string) => void
}) {
  const hasActiveProject = projects.some(p => pathname.startsWith(`/lists/${p.id}`))
  const [open, setOpen] = useState(true)
  const [spaceMenuOpen, setSpaceMenuOpen] = useState(false)
  const [listMenuOpen, setListMenuOpen] = useState<string | null>(null)
  const spaceMenuRef = useRef<HTMLDivElement>(null)
  const listMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (hasActiveProject) setOpen(true)
  }, [hasActiveProject])

  // Close menus on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (spaceMenuRef.current && !spaceMenuRef.current.contains(e.target as Node)) setSpaceMenuOpen(false)
      if (listMenuRef.current && !listMenuRef.current.contains(e.target as Node)) setListMenuOpen(null)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const color = getSpaceColor(workspace.id)
  const initial = workspace.name.slice(0, 1).toUpperCase()

  return (
    <div>
      {/* Space row */}
      <div className="group flex w-full items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-white/5">
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          className="flex items-center gap-2 flex-1 min-w-0 text-left"
        >
          <span
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[12px] font-black text-white leading-none"
            style={{ backgroundColor: color }}
          >
            {initial}
          </span>
          <span className="flex-1 truncate text-[13px] font-semibold text-sidebar-foreground/80 group-hover:text-white transition-colors">
            {workspace.name}
          </span>
        </button>
        {/* Actions: ... and + */}
        <span className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <button className="h-5 w-5 flex items-center justify-center rounded text-sidebar-foreground/40 hover:text-white hover:bg-white/10 transition-colors">
            <MoreHorizontal className="h-3.5 w-3.5" />
          </button>
          {/* Space + button with popup */}
          <div className="relative" ref={spaceMenuRef}>
            <button
              onClick={(e) => { e.stopPropagation(); setSpaceMenuOpen(o => !o) }}
              className="h-5 w-5 flex items-center justify-center rounded text-sidebar-foreground/40 hover:text-white hover:bg-white/10 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
            {spaceMenuOpen && (
              <div className="absolute left-0 top-6 z-50">
                <AddMenu items={[
                  { icon: ListChecks, label: 'List', description: 'Track tasks, projects, people & more', onClick: () => { setSpaceMenuOpen(false); onCreateList(workspace.id) } },
                  { icon: FolderOpen, label: 'Folder', description: 'Group Lists, Docs & more', onClick: () => { setSpaceMenuOpen(false) } },
                ]} />
              </div>
            )}
          </div>
        </span>
      </div>

      {/* Lists */}
      {open && (
        <div className="pb-0.5">
          {projects.length === 0 ? (
            <p className="py-1.5 text-[12px] text-sidebar-foreground/25 font-medium pl-9 pr-3">
              No lists yet
            </p>
          ) : (
            projects.map(proj => {
              const active = pathname.startsWith(`/lists/${proj.id}`)
              return (
                <div key={proj.id} className="group/list relative flex items-center rounded-lg transition-colors hover:bg-white/5">
                  <Link
                    href={`/lists/${proj.id}`}
                    onClick={onClose}
                    className={cn(
                      'flex items-center gap-2 flex-1 min-w-0 py-1.5 pl-9 pr-2',
                      active ? 'text-white' : 'text-sidebar-foreground/55 hover:text-sidebar-foreground/85',
                    )}
                  >
                    {active && (
                      <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-[16px] rounded-r-full bg-sidebar-primary" />
                    )}
                    <ListChecks className={cn(
                      'h-[14px] w-[14px] shrink-0',
                      active ? 'text-sidebar-primary' : 'text-sidebar-foreground/30 group-hover/list:text-sidebar-foreground/60',
                    )} />
                    <span className="truncate text-[12px] font-semibold">{proj.name}</span>
                  </Link>
                  <span className="flex items-center gap-0.5 opacity-0 group-hover/list:opacity-100 transition-opacity pr-2 shrink-0">
                    <button className="h-4 w-4 flex items-center justify-center rounded text-sidebar-foreground/40 hover:text-white hover:bg-white/10 transition-colors">
                      <MoreHorizontal className="h-3 w-3" />
                    </button>
                    {/* List + button with popup */}
                    <div className="relative" ref={listMenuOpen === proj.id ? listMenuRef : undefined}>
                      <button
                        onClick={(e) => { e.stopPropagation(); setListMenuOpen(o => o === proj.id ? null : proj.id) }}
                        className="h-4 w-4 flex items-center justify-center rounded text-sidebar-foreground/40 hover:text-white hover:bg-white/10 transition-colors"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                      {listMenuOpen === proj.id && (
                        <div className="absolute right-0 top-5 z-50">
                          <AddMenu items={[
                            { icon: CircleDot, label: 'Task', description: 'Create individual tasks to manage your work', onClick: () => { setListMenuOpen(null); onCreateTask(proj.id) } },
                            { icon: ListChecks, label: 'List', description: 'Track tasks, projects, people & more', onClick: () => { setListMenuOpen(null); onCreateList(workspace.id) } },
                          ]} />
                        </div>
                      )}
                    </div>
                  </span>
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}

// ─── props ─────────────────────────────────────────────────────────────────────

interface SidebarProps {
  profile: Profile
  permissions?: PermissionSet
  initialSpaces?: Space[]
  initialLists?: List[]
  isOpen: boolean
  isCollapsed: boolean
  onClose: () => void
  onToggleCollapse: () => void
}

// ─── component ─────────────────────────────────────────────────────────────────

export function Sidebar({ profile, permissions, initialSpaces = [], initialLists = [], isOpen, isCollapsed, onClose, onToggleCollapse }: SidebarProps) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const supabase = createClient()

  const [workspaces,        setWorkspaces]        = useState<Space[]>(initialSpaces)
  const [projects,          setProjects]          = useState<List[]>(initialLists)
  const [showCreateSpace,   setShowCreateSpace]   = useState(false)
  const [staffProfiles,     setStaffProfiles]     = useState<Profile[]>([])
  const [showCreateList,    setShowCreateList]    = useState(false)
  const [createListSpaceId, setCreateListSpaceId] = useState<string | null>(null)
  const [showCreateTask,    setShowCreateTask]    = useState(false)
  const [createTaskListId,  setCreateTaskListId]  = useState<string | null>(null)

  const PROJECT_SELECT = 'id, name, workspace_id, status, priority, created_at, updated_at, created_by, is_internal, billing_type, progress, actual_hours, estimated_hours, start_date, due_date, description'
  const WS_SELECT      = 'id, name, description, created_at, updated_at, created_by'

  // Role-aware fetch — mirrors the EXACT same query logic as the Lists page
  async function fetchSidebarData() {
    const role    = profile.role
    const userId  = profile.id
    const orgId   = (profile as any).organization_id as string | null ?? null

    if (role === 'staff') {
      const { data: assignments } = await supabase
        .from('workspace_assignments').select('workspace_id').eq('user_id', userId)
      const wsIds = (assignments ?? []).map((a: { workspace_id: string }) => a.workspace_id)
      if (wsIds.length > 0) {
        const [wsRes, projRes] = await Promise.all([
          supabase.from('workspaces').select(WS_SELECT).in('id', wsIds).order('name'),
          supabase.from('projects').select(PROJECT_SELECT).in('workspace_id', wsIds).order('name'),
        ])
        setWorkspaces((wsRes.data as Space[]) ?? [])
        setProjects((projRes.data as List[]) ?? [])
      } else {
        setWorkspaces([])
        setProjects([])
      }
    } else if (role === 'client') {
      const [wsRes, projRes] = await Promise.all([
        supabase.from('workspaces').select(WS_SELECT).order('name'),
        supabase.from('projects').select(PROJECT_SELECT).eq('client_id', userId).order('name'),
      ])
      setWorkspaces((wsRes.data as Space[]) ?? [])
      setProjects((projRes.data as List[]) ?? [])
    } else {
      // super_admin / account_manager / others — explicit org-scoped filter (same as Lists page)
      const wsQuery = orgId
        ? supabase.from('workspaces').select(WS_SELECT).eq('organization_id', orgId).order('name')
        : supabase.from('workspaces').select(WS_SELECT).order('name')
      const { data: wsData } = await wsQuery
      const spaces = (wsData as Space[]) ?? []
      const wsIds  = spaces.map(w => w.id)

      const { data: projData } = wsIds.length > 0
        ? await supabase.from('projects').select(PROJECT_SELECT).in('workspace_id', wsIds).order('name')
        : await supabase.from('projects').select(PROJECT_SELECT).order('name')

      setWorkspaces(spaces)
      setProjects((projData as List[]) ?? [])
    }
  }

  // Refetch on every route change — catches list creation, deletion, rename
  useEffect(() => {
    fetchSidebarData()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  // Real-time subscription for instant in-page updates (no navigation needed)
  useEffect(() => {
    const channel = supabase
      .channel('sidebar-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'projects' },
        (payload) => {
          supabase.from('projects').select(PROJECT_SELECT).eq('id', payload.new.id).single()
            .then(({ data }) => {
              if (data) setProjects(prev =>
                [...prev, data as List].sort((a, b) => a.name.localeCompare(b.name)))
            })
        }
      )
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'projects' },
        (payload) => {
          supabase.from('projects').select(PROJECT_SELECT).eq('id', payload.new.id).single()
            .then(({ data }) => {
              if (data) setProjects(prev => prev.map(p => p.id === (data as List).id ? data as List : p))
            })
        }
      )
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'projects' },
        (payload) => { setProjects(prev => prev.filter(p => p.id !== payload.old.id)) }
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'workspaces' },
        () => { fetchSidebarData() }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function openCreateList(spaceId: string) {
    setCreateListSpaceId(spaceId)
    setShowCreateList(true)
  }

  function openCreateTask(listId: string) {
    setCreateTaskListId(listId)
    setShowCreateTask(true)
  }

  function openCreateSpace() {
    if (staffProfiles.length === 0) {
      supabase.from('profiles')
        .select('id, full_name, email, avatar_url, role, is_temp_password, onboarding_completed, created_at, updated_at')
        .neq('role', 'client')
        .order('full_name')
        .then(({ data }) => setStaffProfiles((data as Profile[]) ?? []))
    }
    setShowCreateSpace(true)
  }

  const permsLoaded    = permissions && Object.keys(permissions).length > 0
  const showTimesheet  = !permsLoaded || can(permissions!, 'timesheet',  'view_own') || can(permissions!, 'timesheet',  'view_all')
  const showAttendance = !permsLoaded || can(permissions!, 'attendance', 'view_own') || can(permissions!, 'attendance', 'view_all')
  const showLeave      = !permsLoaded || can(permissions!, 'leave',      'view_own') || can(permissions!, 'leave',      'view_all')
  const showTeam       = !permsLoaded || can(permissions!, 'team',       'view')
  const showReports    = !permsLoaded || can(permissions!, 'settings',   'manage')
  const showSettings   = !permsLoaded || can(permissions!, 'settings',   'manage')

  return (
    <TooltipProvider delayDuration={0}>
      {isOpen && (
        <div className="fixed inset-0 z-20 bg-black/60 backdrop-blur-sm lg:hidden" onClick={onClose} aria-hidden />
      )}

      <aside className={cn(
        'fixed inset-y-0 left-0 z-30 flex flex-col',
        'bg-sidebar border-r border-sidebar-border',
        'transition-all duration-300 ease-in-out',
        'lg:relative lg:translate-x-0',
        isCollapsed ? 'lg:w-[60px]' : 'lg:w-[240px]',
        isOpen ? 'translate-x-0 w-[240px] shadow-2xl' : '-translate-x-full w-[240px] lg:translate-x-0',
      )}>


        {/* ── Logo bar ── */}
        <div className={cn(
          'flex h-11 shrink-0 items-center border-b border-sidebar-border',
          isCollapsed ? 'lg:justify-center px-2' : 'px-4 gap-3',
        )}>
          {/* Logo badge */}
          <Link href="/dashboard" onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sidebar-primary text-white text-[15px] font-black select-none shadow-lg shadow-sidebar-primary/30">
            IW
          </Link>

          {!isCollapsed && (
            <>
              <p className="flex-1 text-[15px] font-bold text-white leading-none truncate">IWW PM</p>
              <div className="flex items-center gap-1">
                <button onClick={onToggleCollapse}
                  className="hidden lg:flex h-7 w-7 items-center justify-center rounded-md text-sidebar-foreground/30 hover:bg-white/10 hover:text-white transition-colors"
                  aria-label="Collapse">
                  <PanelLeftClose className="h-4 w-4" />
                </button>
                <button onClick={onClose}
                  className="lg:hidden h-7 w-7 flex items-center justify-center rounded-md text-sidebar-foreground/40 hover:bg-white/10 hover:text-white transition-colors">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </>
          )}

          {isCollapsed && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button onClick={onToggleCollapse}
                  className="hidden lg:flex h-7 w-7 items-center justify-center rounded-md text-sidebar-foreground/30 hover:bg-white/10 hover:text-white transition-colors">
                  <PanelLeftOpen className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" className="text-xs">Expand</TooltipContent>
            </Tooltip>
          )}
        </div>

        {/* ── Scrollable nav ── */}
        <nav className="flex-1 overflow-y-auto scrollbar-hide" data-tour="sidebar-nav">

          {/* ────── COLLAPSED icon strip ────── */}
          {isCollapsed && (
            <div className="flex flex-col items-center gap-1 py-3 px-2">
              {[
                { href: '/dashboard',    Icon: LayoutGrid,   label: 'Home' },
                { href: '/notifications',Icon: Inbox,        label: 'Inbox' },
                { href: '/tasks',        Icon: CheckSquare,  label: 'My Tasks' },
                { href: '/timesheet',    Icon: Timer,        label: 'Timesheet' },
                { href: '/attendance',   Icon: Clock,        label: 'Attendance' },
                { href: '/leave',        Icon: CalendarDays, label: 'Leave' },
                { href: '/team',         Icon: Users,        label: 'Team' },
                { href: '/reports',      Icon: BarChart2,    label: 'Reports' },
                { href: '/settings',     Icon: Settings,     label: 'Settings' },
              ].map(({ href, Icon, label }) => {
                const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
                return (
                  <Tooltip key={href}>
                    <TooltipTrigger asChild>
                      <Link href={href} onClick={onClose}
                        className={cn(
                          'flex h-10 w-10 items-center justify-center rounded-lg transition-colors relative',
                          active ? 'bg-sidebar-primary/20 text-sidebar-primary' : 'text-sidebar-foreground/45 hover:bg-white/8 hover:text-white'
                        )}>
                        {active && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-sidebar-primary" />}
                        <Icon className="h-5 w-5" />
                      </Link>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="text-xs font-medium">{label}</TooltipContent>
                  </Tooltip>
                )
              })}
            </div>
          )}

          {/* ────── EXPANDED layout ────── */}
          {!isCollapsed && (
            <div className="px-2 py-2 space-y-0.5">

              {/* Home */}
              <NavItem href="/dashboard" icon={LayoutGrid} label="Dashboard"
                active={pathname === '/dashboard'} onClick={onClose} />

              {/* ── MY WORK ── */}
              <div className="pt-2.5">
                <div className="px-1 mb-1">
                  <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-sidebar-foreground/30">
                    My Work
                  </span>
                </div>
                <div className="space-y-0.5">
                  <NavItem href="/tasks"              icon={CheckSquare}   label="My Tasks"        active={pathname === '/tasks' && !searchParams.get('filter')} onClick={onClose} indent />
                  <NavItem href="/tasks?filter=today" icon={CalendarClock} label="Today & Overdue" active={pathname === '/tasks' && searchParams.get('filter') === 'today'} onClick={onClose} indent />
                  {showTimesheet && <NavItem href="/timesheet" icon={Timer} label="Timesheet" active={pathname.startsWith('/timesheet')} onClick={onClose} indent />}
                </div>
              </div>

              {/* ── SPACES ── */}
              <div className="pt-2.5">
                <div className="flex items-center justify-between px-1 mb-1">
                  <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-sidebar-foreground/30">
                    Spaces
                  </span>
                  <span className="flex items-center gap-0.5">
                    <button
                      className="flex h-4 w-4 items-center justify-center rounded text-sidebar-foreground/30 hover:text-white hover:bg-white/10 transition-colors"
                    >
                      <MoreHorizontal className="h-3 w-3" />
                    </button>
                    <button
                      onClick={openCreateSpace}
                      className="flex h-4 w-4 items-center justify-center rounded text-sidebar-foreground/30 hover:text-white hover:bg-white/10 transition-colors"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  </span>
                </div>

                <div className="space-y-0.5">
                  {/* All Tasks */}
                  <Link href="/tasks" onClick={onClose} className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-white/5 transition-colors text-sidebar-foreground/60 hover:text-sidebar-foreground/90">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-sidebar-foreground/15">
                      <CheckSquare className="h-4 w-4 text-sidebar-foreground/50" />
                    </span>
                    <span className="truncate text-[13px] font-semibold">All Tasks</span>
                  </Link>

                  {/* Space items */}
                  {workspaces.map(ws => (
                    <SpaceItem
                      key={ws.id}
                      workspace={ws}
                      projects={projects.filter(p => p.workspace_id === ws.id)}
                      pathname={pathname}
                      onClose={onClose}
                      onCreateList={openCreateList}
                      onCreateTask={openCreateTask}
                    />
                  ))}

                  {/* New Space */}
                  <button
                    onClick={openCreateSpace}
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-[12px] font-semibold text-sidebar-foreground/35 hover:text-sidebar-foreground/70 hover:bg-white/5 transition-colors mt-1"
                  >
                    <Plus className="h-[14px] w-[14px] shrink-0" />
                    <span>New Space</span>
                  </button>
                </div>
              </div>

              {/* ── TEAM & HR ── */}
              {(showAttendance || showLeave || showTeam) && (
                <div className="pt-2.5">
                  <div className="px-1 mb-1">
                    <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-sidebar-foreground/30">
                      Team &amp; HR
                    </span>
                  </div>
                  <div className="space-y-0.5">
                    {showAttendance && <NavItem href="/attendance" icon={Clock}        label="Attendance" active={pathname.startsWith('/attendance')} onClick={onClose} indent />}
                    {showLeave      && <NavItem href="/leave"      icon={CalendarDays} label="Leave"      active={pathname.startsWith('/leave')}      onClick={onClose} indent />}
                    {showTeam       && <NavItem href="/team"       icon={Users}        label="Team"       active={pathname.startsWith('/team')}       onClick={onClose} indent />}
                  </div>
                </div>
              )}

              {/* ── Reports + Settings ── */}
              <div className="pt-2.5 space-y-0.5">
                {showReports  && <NavItem href="/reports"  icon={BarChart2} label="Reports"  active={pathname.startsWith('/reports')}  onClick={onClose} />}
                {showSettings && <NavItem href="/settings" icon={Settings}  label="Settings" active={pathname.startsWith('/settings')} onClick={onClose} />}
              </div>

            </div>
          )}
        </nav>

        {/* ── User footer ── */}
        <div className={cn(
          'shrink-0 border-t border-sidebar-border',
          isCollapsed ? 'p-2 flex justify-center' : 'p-3',
        )}>
          {isCollapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Link href="/settings/profile"
                  className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-white/10 transition-colors">
                  <Avatar className="h-7 w-7">
                    <AvatarImage src={profile.avatar_url ?? undefined} />
                    <AvatarFallback className="bg-sidebar-primary text-white text-[11px] font-bold">
                      {getInitials(profile.full_name)}
                    </AvatarFallback>
                  </Avatar>
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right">
                <p className="font-semibold">{profile.full_name}</p>
                <p className="text-xs text-muted-foreground">{ROLE_LABELS[profile.role]}</p>
              </TooltipContent>
            </Tooltip>
          ) : (
            <Link href="/settings/profile"
              className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-white/8 transition-colors">
              <Avatar className="h-8 w-8 shrink-0">
                <AvatarImage src={profile.avatar_url ?? undefined} />
                <AvatarFallback className="bg-sidebar-primary text-white text-[11px] font-bold">
                  {getInitials(profile.full_name)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-bold text-white leading-tight">{profile.full_name}</p>
                <p className="truncate text-[11px] text-sidebar-foreground/45 leading-tight mt-0.5">{ROLE_LABELS[profile.role]}</p>
              </div>
            </Link>
          )}
        </div>
      </aside>

      {/* ── Create Space Dialog ── */}
      <CreateWorkspaceDialog
        open={showCreateSpace}
        onOpenChange={setShowCreateSpace}
        staffProfiles={staffProfiles}
        onSuccess={(newWs) => {
          setWorkspaces(prev => [...prev, { ...newWs }])
          setShowCreateSpace(false)
        }}
      />

      {/* ── Create List Dialog ── */}
      <CreateProjectDialog
        open={showCreateList}
        onOpenChange={setShowCreateList}
        workspaces={createListSpaceId ? workspaces.filter(w => w.id === createListSpaceId) : workspaces}
        onCreated={(newList) => {
          setProjects(prev => [...prev, newList].sort((a, b) => a.name.localeCompare(b.name)))
          setShowCreateList(false)
        }}
        profile={profile}
      />

      {/* ── Create Task Dialog ── */}
      {showCreateTask && createTaskListId && (
        <CreateTaskDialog
          open={showCreateTask}
          onOpenChange={setShowCreateTask}
          projects={projects}
          profile={profile}
          projectId={createTaskListId}
          onCreated={() => { setShowCreateTask(false) }}
        />
      )}
    </TooltipProvider>
  )
}
