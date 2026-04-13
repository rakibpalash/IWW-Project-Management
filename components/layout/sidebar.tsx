'use client'

import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
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
  Hash,
  ListChecks,
  CalendarClock,
  Bell,
  Inbox,
  User,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Profile, Workspace, Project } from '@/types'
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
        'group relative flex items-center gap-3 rounded-lg transition-colors select-none',
        indent ? 'pl-9 pr-3 py-2' : 'px-3 py-2.5',
        active
          ? 'bg-sidebar-primary/15 text-white'
          : 'text-sidebar-foreground/60 hover:bg-white/5 hover:text-sidebar-foreground/90',
      )}
    >
      {/* Left active bar */}
      {active && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[4px] h-[22px] rounded-r-full bg-sidebar-primary" />
      )}
      <Icon className={cn(
        'shrink-0 transition-colors',
        indent ? 'h-[17px] w-[17px]' : 'h-5 w-5',
        active
          ? 'text-sidebar-primary'
          : 'text-sidebar-foreground/40 group-hover:text-sidebar-foreground/70',
      )} />
      <span className={cn(
        'truncate font-semibold leading-tight',
        indent ? 'text-[13px]' : 'text-[15px]',
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
}: {
  workspace: Workspace
  projects: Project[]
  pathname: string
  onClose: () => void
}) {
  const hasActiveProject = projects.some(p => pathname.startsWith(`/projects/${p.id}`))
  const [open, setOpen] = useState(hasActiveProject || projects.length <= 5)
  const color = getSpaceColor(workspace.id)
  const initial = workspace.name.slice(0, 1).toUpperCase()

  return (
    <div>
      {/* Space row */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-white/5"
      >
        {/* Colored badge */}
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[13px] font-black text-white leading-none"
          style={{ backgroundColor: color }}
        >
          {initial}
        </span>
        <span className="flex-1 truncate text-[15px] font-semibold text-sidebar-foreground/80 group-hover:text-white transition-colors">
          {workspace.name}
        </span>
        <span className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          {open
            ? <ChevronDown className="h-4 w-4 text-sidebar-foreground/40" />
            : <ChevronRight className="h-4 w-4 text-sidebar-foreground/40" />
          }
        </span>
      </button>

      {/* Projects list */}
      {open && (
        <div className="space-y-0.5 pb-1">
          {projects.length === 0 ? (
            <p className="py-2 text-[13px] text-sidebar-foreground/25 font-medium" style={{ paddingLeft: '52px' }}>
              No lists yet
            </p>
          ) : (
            projects.map(proj => {
              const active = pathname.startsWith(`/projects/${proj.id}`)
              return (
                <Link
                  key={proj.id}
                  href={`/projects/${proj.id}`}
                  onClick={onClose}
                  className={cn(
                    'group relative flex items-center gap-3 rounded-lg py-2 transition-colors',
                    active
                      ? 'bg-sidebar-primary/15 text-white'
                      : 'text-sidebar-foreground/55 hover:bg-white/5 hover:text-sidebar-foreground/85',
                  )}
                  style={{ paddingLeft: '44px', paddingRight: '12px' }}
                >
                  {active && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[4px] h-[18px] rounded-r-full bg-sidebar-primary" />
                  )}
                  <Hash className={cn(
                    'h-[15px] w-[15px] shrink-0',
                    active ? 'text-sidebar-primary' : 'text-sidebar-foreground/30 group-hover:text-sidebar-foreground/60',
                  )} />
                  <span className="truncate text-[13px] font-semibold">{proj.name}</span>
                </Link>
              )
            })
          )}

          {/* Add List */}
          <Link
            href="/projects"
            onClick={onClose}
            className="flex items-center gap-2 rounded-lg py-2 text-[13px] font-medium text-sidebar-foreground/25 hover:text-sidebar-foreground/55 hover:bg-white/5 transition-colors"
            style={{ paddingLeft: '44px', paddingRight: '12px' }}
          >
            <Plus className="h-[15px] w-[15px] shrink-0" />
            <span>Add List</span>
          </Link>
        </div>
      )}
    </div>
  )
}

// ─── props ─────────────────────────────────────────────────────────────────────

interface SidebarProps {
  profile: Profile
  permissions?: PermissionSet
  isOpen: boolean
  isCollapsed: boolean
  onClose: () => void
  onToggleCollapse: () => void
}

// ─── component ─────────────────────────────────────────────────────────────────

export function Sidebar({ profile, permissions, isOpen, isCollapsed, onClose, onToggleCollapse }: SidebarProps) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const supabase = createClient()

  const [workspaces,      setWorkspaces]      = useState<Workspace[]>([])
  const [projects,        setProjects]        = useState<Project[]>([])
  const [myTasksOpen,     setMyTasksOpen]     = useState(pathname.startsWith('/tasks'))
  const [showCreateSpace, setShowCreateSpace] = useState(false)
  const [staffProfiles,   setStaffProfiles]   = useState<Profile[]>([])

  useEffect(() => {
    supabase.from('workspaces')
      .select('id, name, description, created_at, updated_at, created_by')
      .order('name')
      .then(({ data }) => setWorkspaces((data as Workspace[]) ?? []))

    supabase.from('projects')
      .select('id, name, workspace_id, status, priority, created_at, updated_at, created_by, is_internal, billing_type, progress, actual_hours, estimated_hours, start_date, due_date, description')
      .order('name')
      .then(({ data }) => setProjects((data as Project[]) ?? []))
  }, [])

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

  const isTasksActive = pathname.startsWith('/tasks')

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
          'flex h-[60px] shrink-0 items-center border-b border-sidebar-border',
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
            <div className="px-3 py-3 space-y-0.5">

              {/* Home */}
              <NavItem href="/dashboard" icon={LayoutGrid} label="Home"
                active={pathname === '/dashboard'} onClick={onClose} />

              {/* My Tasks (collapsible) */}
              <div>
                <button
                  type="button"
                  onClick={() => setMyTasksOpen(o => !o)}
                  className={cn(
                    'group relative flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors select-none',
                    isTasksActive ? 'bg-sidebar-primary/15 text-white' : 'text-sidebar-foreground/60 hover:bg-white/5 hover:text-sidebar-foreground/90',
                  )}
                >
                  {isTasksActive && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[4px] h-[22px] rounded-r-full bg-sidebar-primary" />
                  )}
                  <CheckSquare className={cn('h-5 w-5 shrink-0', isTasksActive ? 'text-sidebar-primary' : 'text-sidebar-foreground/40 group-hover:text-sidebar-foreground/70')} />
                  <span className="flex-1 text-[15px] font-semibold">My Tasks</span>
                  {myTasksOpen
                    ? <ChevronDown className="h-4 w-4 text-sidebar-foreground/30 shrink-0" />
                    : <ChevronRight className="h-4 w-4 text-sidebar-foreground/30 shrink-0" />
                  }
                </button>

                {myTasksOpen && (
                  <div className="space-y-0.5 pt-0.5">
                    <NavItem href="/tasks"             icon={User}         label="Assigned to me"  active={pathname === '/tasks' && !searchParams.get('filter')} onClick={onClose} indent />
                    <NavItem href="/tasks?filter=today" icon={CalendarClock} label="Today & Overdue" active={pathname === '/tasks' && searchParams.get('filter') === 'today'} onClick={onClose} indent />
                  </div>
                )}
              </div>

              {/* ── SPACES ── */}
              <div className="pt-4">
                <div className="flex items-center justify-between px-1 mb-2">
                  <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-sidebar-foreground/30">
                    Spaces
                  </span>
                  <button
                    onClick={openCreateSpace}
                    className="flex h-5 w-5 items-center justify-center rounded text-sidebar-foreground/30 hover:text-white hover:bg-white/10 transition-colors"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="space-y-0.5">
                  {/* All Tasks */}
                  <NavItem href="/tasks" icon={ListChecks} label="All Tasks" active={false} onClick={onClose} />

                  {/* Spaces */}
                  {workspaces.map(ws => (
                    <SpaceItem
                      key={ws.id}
                      workspace={ws}
                      projects={projects.filter(p => p.workspace_id === ws.id)}
                      pathname={pathname}
                      onClose={onClose}
                    />
                  ))}

                  {/* New Space */}
                  <button
                    onClick={openCreateSpace}
                    className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-[15px] font-semibold text-sidebar-foreground/25 hover:text-sidebar-foreground/55 hover:bg-white/5 transition-colors mt-1 w-full text-left"
                  >
                    <Plus className="h-5 w-5 shrink-0" />
                    <span>New Space</span>
                  </button>
                </div>
              </div>

              {/* ── HR + Admin items ── */}
              <div className="pt-4 space-y-0.5">
                {showTimesheet  && <NavItem href="/timesheet"  icon={Timer}        label="Timesheet"  active={pathname.startsWith('/timesheet')}  onClick={onClose} />}
                {showAttendance && <NavItem href="/attendance" icon={Clock}        label="Attendance" active={pathname.startsWith('/attendance')} onClick={onClose} />}
                {showLeave      && <NavItem href="/leave"      icon={CalendarDays} label="Leave"      active={pathname.startsWith('/leave')}      onClick={onClose} />}
                {showTeam       && <NavItem href="/team"       icon={Users}        label="Team"       active={pathname.startsWith('/team')}       onClick={onClose} />}
                {showReports    && <NavItem href="/reports"    icon={BarChart2}    label="Reports"    active={pathname.startsWith('/reports')}    onClick={onClose} />}
                {showSettings   && <NavItem href="/settings"   icon={Settings}     label="Settings"   active={pathname.startsWith('/settings')}   onClick={onClose} />}
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
    </TooltipProvider>
  )
}
