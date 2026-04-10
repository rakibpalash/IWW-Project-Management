'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Building2,
  FolderKanban,
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
  LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { NAV_ITEMS } from '@/lib/constants'
import { Profile } from '@/types'
import { PermissionSet, can } from '@/lib/permissions'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

const ICON_MAP: Record<string, LucideIcon> = {
  LayoutDashboard,
  Building2,
  FolderKanban,
  CheckSquare,
  Clock,
  CalendarDays,
  Users,
  Settings,
  Timer,
  BarChart2,
}

const ROLE_LABELS: Record<Profile['role'], string> = {
  super_admin:     'CEO',
  account_manager: 'Org Admin',
  project_manager: 'Team Lead',
  staff:           'Staff',
  client:          'Client',
  partner:         'Partner',
}

function getInitials(name: string) {
  return name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()
}

interface SidebarProps {
  profile: Profile
  permissions?: PermissionSet
  isOpen: boolean
  isCollapsed: boolean
  onClose: () => void
  onToggleCollapse: () => void
}

// Maps nav hrefs to driver.js data-tour attribute values used by product-tour.tsx
const NAV_TOUR_IDS: Record<string, string> = {
  '/dashboard':  'nav-dashboard',
  '/workspaces': 'nav-workspaces',
  '/projects':   'nav-projects',
  '/tasks':      'nav-tasks',
  '/timesheet':  'nav-time-tracking',
  '/attendance': 'nav-attendance',
  '/leave':      'nav-leave',
  '/team':       'nav-team',
  '/reports':    'nav-reports',
  '/settings':   'nav-settings',
}

// Master nav catalogue — defines every possible item and what permission gates it.
// Items are shown if: (a) no permissions loaded → fall back to role-default nav,
// or (b) permissions loaded → show only items where the check passes.
const ALL_NAV: { href: string; label: string; icon: string; check: (p: PermissionSet) => boolean }[] = [
  { href: '/workspaces', label: 'Workspaces', icon: 'Building2',      check: (p) => can(p, 'workspaces', 'view') },
  { href: '/projects',   label: 'Projects',   icon: 'FolderKanban',   check: (p) => can(p, 'projects',   'view') },
  { href: '/tasks',      label: 'My Tasks',   icon: 'CheckSquare',    check: (p) => can(p, 'tasks',      'view') },
  { href: '/timesheet',  label: 'Timesheet',  icon: 'Timer',          check: (p) => can(p, 'timesheet',  'view_own') || can(p, 'timesheet', 'view_all') },
  { href: '/attendance', label: 'Attendance', icon: 'Clock',          check: (p) => can(p, 'attendance', 'view_own') || can(p, 'attendance', 'view_all') },
  { href: '/leave',      label: 'Leave',      icon: 'CalendarDays',   check: (p) => can(p, 'leave',      'view_own') || can(p, 'leave', 'view_all') },
  { href: '/team',       label: 'Team',       icon: 'Users',          check: (p) => can(p, 'team',       'view') },
  { href: '/reports',    label: 'Reports',    icon: 'BarChart2',      check: (p) => can(p, 'settings',   'manage') },
  { href: '/settings',   label: 'Settings',   icon: 'Settings',       check: (p) => can(p, 'settings',   'manage') },
]

export function Sidebar({ profile, permissions, isOpen, isCollapsed, onClose, onToggleCollapse }: SidebarProps) {
  const pathname = usePathname()
  const baseNavItems = NAV_ITEMS[profile.role] ?? []

  // Only apply permission-based filtering when permissions are actually loaded
  const permsLoaded = permissions && Object.keys(permissions).length > 0

  let navItems: typeof baseNavItems
  if (!permsLoaded) {
    // No permissions yet — use the role-default nav as-is
    navItems = baseNavItems
  } else {
    // Build nav from the master catalogue filtered by actual permissions
    const dynamicItems = ALL_NAV
      .filter((item) => item.check(permissions!))
      .map(({ href, label, icon }) => ({ href, label, icon }))

    // Dashboard is always first
    navItems = [
      { href: '/dashboard', label: 'Dashboard', icon: 'LayoutDashboard' },
      ...dynamicItems,
    ]
  }

  return (
    <TooltipProvider delayDuration={0}>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={onClose}
          aria-hidden
        />
      )}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-30 flex flex-col',
          'bg-sidebar border-r border-sidebar-border',
          'transition-all duration-300 ease-in-out',
          // Desktop
          'lg:relative lg:translate-x-0',
          isCollapsed ? 'lg:w-[68px]' : 'lg:w-60',
          // Mobile
          isOpen ? 'translate-x-0 w-60 shadow-2xl' : '-translate-x-full w-60 lg:translate-x-0',
        )}
      >
        {/* ── Logo ── */}
        <div className={cn(
          'flex h-14 shrink-0 items-center border-b border-sidebar-border px-3',
          isCollapsed ? 'lg:justify-center lg:px-2' : 'justify-between',
        )}>
          {/* Expanded logo */}
          <Link
            href="/dashboard"
            className={cn(
              'flex items-center gap-3 outline-none min-w-0',
              isCollapsed && 'lg:hidden',
            )}
            onClick={onClose}
          >
            {/* High-contrast white logo mark */}
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-[#1a1a2e] text-[14px] font-black select-none tracking-tight shadow-sm">
              IW
            </div>
            <div className="min-w-0">
              <p className="text-[14px] font-bold text-white leading-none truncate">
                IWW PM
              </p>
              <p className="text-[11px] text-sidebar-foreground/60 leading-none mt-1">
                Project Management
              </p>
            </div>
          </Link>

          {/* Collapsed logo */}
          {isCollapsed && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Link
                  href="/dashboard"
                  className="hidden lg:flex h-9 w-9 items-center justify-center rounded-xl bg-white text-[#1a1a2e] text-[14px] font-black hover:opacity-90 transition-opacity shadow-sm"
                >
                  IW
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right" className="font-medium">IWW PM</TooltipContent>
            </Tooltip>
          )}

          {/* Right side: desktop collapse toggle + mobile close */}
          <div className={cn('flex items-center gap-1', isCollapsed && 'lg:hidden')}>
            {/* Desktop collapse button */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={onToggleCollapse}
                  className="hidden lg:flex h-8 w-8 items-center justify-center rounded-lg text-sidebar-foreground/40 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
                  aria-label="Collapse sidebar"
                >
                  <PanelLeftClose className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Collapse</TooltipContent>
            </Tooltip>

            {/* Mobile close */}
            <button
              onClick={onClose}
              className="lg:hidden p-1.5 rounded-md text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
              aria-label="Close menu"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Desktop expand button when collapsed */}
          {isCollapsed && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={onToggleCollapse}
                  className="hidden lg:flex h-8 w-8 items-center justify-center rounded-lg text-sidebar-foreground/40 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
                  aria-label="Expand sidebar"
                >
                  <PanelLeftOpen className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">Expand</TooltipContent>
            </Tooltip>
          )}
        </div>

        {/* ── Nav ── */}
        <nav data-tour="sidebar-nav" className="flex-1 overflow-y-auto scrollbar-hide py-4">
          <ul className="space-y-1 px-3">
            {navItems.map((item) => {
              const Icon = ICON_MAP[item.icon] ?? LayoutDashboard
              const isActive =
                pathname === item.href ||
                (item.href !== '/dashboard' && pathname.startsWith(item.href))

              const inner = (
                <Link
                  href={item.href}
                  onClick={onClose}
                  className={cn(
                    'group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium',
                    'transition-colors duration-100 relative',
                    isActive
                      ? 'bg-sidebar-accent text-white'
                      : 'text-sidebar-foreground hover:bg-sidebar-accent/70 hover:text-white',
                    isCollapsed && 'lg:justify-center lg:px-0 lg:py-3',
                  )}
                >
                  {/* Active left bar */}
                  {isActive && (
                    <span className={cn(
                      'absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 rounded-r-full bg-sidebar-primary',
                      isCollapsed && 'lg:hidden',
                    )} />
                  )}

                  <Icon className={cn(
                    'h-[18px] w-[18px] shrink-0 transition-colors',
                    isActive ? 'text-sidebar-primary' : 'text-sidebar-foreground/60 group-hover:text-white',
                  )} />

                  <span className={cn('truncate', isCollapsed && 'lg:hidden')}>
                    {item.label}
                  </span>

                  {/* Active dot on expanded */}
                  {isActive && !isCollapsed && (
                    <span className="ml-auto h-2 w-2 shrink-0 rounded-full bg-sidebar-primary" />
                  )}
                </Link>
              )

              return (
                <li key={item.href} data-tour={NAV_TOUR_IDS[item.href]}>
                  {isCollapsed ? (
                    <Tooltip>
                      <TooltipTrigger asChild>{inner}</TooltipTrigger>
                      <TooltipContent side="right">{item.label}</TooltipContent>
                    </Tooltip>
                  ) : inner}
                </li>
              )
            })}
          </ul>
        </nav>

        {/* ── User footer ── */}
        <div className={cn(
          'shrink-0 border-t border-sidebar-border p-2',
          isCollapsed && 'lg:flex lg:justify-center',
        )}>
          {/* Collapsed */}
          {isCollapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Link
                  href="/settings/profile"
                  className="hidden lg:flex h-9 w-9 items-center justify-center rounded-lg hover:bg-sidebar-accent transition-colors"
                >
                  <Avatar className="h-7 w-7">
                    <AvatarImage src={profile.avatar_url ?? undefined} />
                    <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground text-[11px] font-semibold">
                      {getInitials(profile.full_name)}
                    </AvatarFallback>
                  </Avatar>
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right">
                <p className="font-medium text-sm">{profile.full_name}</p>
                <p className="text-xs text-muted-foreground">{ROLE_LABELS[profile.role]}</p>
              </TooltipContent>
            </Tooltip>
          ) : null}

          {/* Expanded (always shown on mobile, shown on desktop when not collapsed) */}
          <Link
            href="/settings/profile"
            className={cn(
              'flex items-center gap-2.5 rounded-lg p-2 hover:bg-sidebar-accent transition-colors',
              isCollapsed ? 'lg:hidden' : '',
            )}
          >
            <Avatar className="h-7 w-7 shrink-0">
              <AvatarImage src={profile.avatar_url ?? undefined} />
              <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground text-[11px] font-semibold">
                {getInitials(profile.full_name)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12px] font-semibold text-sidebar-accent-foreground leading-none">
                {profile.full_name}
              </p>
              <p className="truncate text-[11px] text-sidebar-foreground/50 leading-none mt-1">
                {ROLE_LABELS[profile.role]}
              </p>
            </div>
          </Link>
        </div>
      </aside>
    </TooltipProvider>
  )
}
