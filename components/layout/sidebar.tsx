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
  ChevronLeft,
  ChevronRight,
  LucideIcon,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { NAV_ITEMS } from '@/lib/constants'
import { Profile } from '@/types'
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
}

interface SidebarProps {
  profile: Profile
  isOpen: boolean
  isCollapsed: boolean
  onClose: () => void
  onToggleCollapse: () => void
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

function getRoleBadgeLabel(role: Profile['role']): string {
  const labels: Record<Profile['role'], string> = {
    super_admin: 'Super Admin',
    account_manager: 'Account Manager',
    project_manager: 'Project Manager',
    staff: 'Staff',
    client: 'Client',
  }
  return labels[role] ?? role
}

export function Sidebar({
  profile,
  isOpen,
  isCollapsed,
  onClose,
  onToggleCollapse,
}: SidebarProps) {
  const pathname = usePathname()
  const navItems = NAV_ITEMS[profile.role] ?? []

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          // Base styles
          'fixed inset-y-0 left-0 z-30 flex flex-col',
          'bg-sidebar text-sidebar-foreground',
          'border-r border-sidebar-border',
          'transition-all duration-300 ease-in-out',
          // Desktop collapsed / expanded
          'lg:relative lg:translate-x-0',
          isCollapsed ? 'lg:w-[70px]' : 'lg:w-64',
          // Mobile show/hide
          isOpen ? 'translate-x-0 w-64' : '-translate-x-full w-64 lg:translate-x-0',
        )}
      >
        {/* ─── Logo / Header ─── */}
        <div
          className={cn(
            'flex h-16 shrink-0 items-center border-b border-sidebar-border px-4',
            isCollapsed ? 'lg:justify-center' : 'justify-between',
          )}
        >
          <Link
            href="/dashboard"
            className={cn(
              'flex items-center gap-2 font-bold text-sidebar-foreground hover:opacity-90 transition-opacity',
              isCollapsed && 'lg:hidden',
            )}
          >
            {/* Logo mark */}
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground text-sm font-bold select-none">
              IW
            </span>
            <span className="text-base tracking-tight">IWW PM</span>
          </Link>

          {/* Collapsed-mode logo mark only */}
          {isCollapsed && (
            <Link
              href="/dashboard"
              className="hidden lg:flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground text-sm font-bold hover:opacity-90 transition-opacity"
            >
              IW
            </Link>
          )}

          {/* Mobile close button */}
          <button
            onClick={onClose}
            className="lg:hidden ml-auto p-1 rounded-md text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
            aria-label="Close sidebar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* ─── Navigation ─── */}
        <nav className="flex-1 overflow-y-auto overflow-x-hidden py-4 scrollbar-hide">
          <ul className="space-y-1 px-2">
            {navItems.map((item) => {
              const Icon = ICON_MAP[item.icon] ?? LayoutDashboard
              const isActive =
                pathname === item.href ||
                (item.href !== '/dashboard' && pathname.startsWith(item.href))

              const linkContent = (
                <Link
                  href={item.href}
                  onClick={onClose}
                  className={cn(
                    'flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium',
                    'transition-colors duration-150',
                    isActive
                      ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-sm'
                      : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                    isCollapsed && 'lg:justify-center lg:px-0',
                  )}
                >
                  <Icon
                    className={cn(
                      'h-5 w-5 shrink-0',
                      isActive ? 'text-sidebar-primary-foreground' : 'text-sidebar-foreground/60',
                    )}
                  />
                  <span className={cn('truncate', isCollapsed && 'lg:hidden')}>
                    {item.label}
                  </span>
                  {isActive && !isCollapsed && (
                    <span className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-sidebar-primary-foreground/70" />
                  )}
                </Link>
              )

              return (
                <li key={item.href}>
                  {isCollapsed ? (
                    <Tooltip>
                      <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
                      <TooltipContent side="right" className="font-medium">
                        {item.label}
                      </TooltipContent>
                    </Tooltip>
                  ) : (
                    linkContent
                  )}
                </li>
              )
            })}
          </ul>
        </nav>

        {/* ─── Collapse toggle (desktop only) ─── */}
        <div className="hidden lg:flex shrink-0 items-center justify-end border-t border-sidebar-border px-2 py-2">
          <button
            onClick={onToggleCollapse}
            className="flex h-8 w-8 items-center justify-center rounded-md text-sidebar-foreground/50 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isCollapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </button>
        </div>

        {/* ─── User profile footer ─── */}
        <div
          className={cn(
            'shrink-0 border-t border-sidebar-border p-3',
            isCollapsed && 'lg:flex lg:justify-center',
          )}
        >
          {isCollapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Link
                  href="/settings/profile"
                  className="hidden lg:flex h-9 w-9 items-center justify-center"
                >
                  <Avatar className="h-9 w-9 ring-2 ring-sidebar-border hover:ring-sidebar-primary transition-all">
                    <AvatarImage src={profile.avatar_url ?? undefined} alt={profile.full_name} />
                    <AvatarFallback className="bg-sidebar-accent text-sidebar-accent-foreground text-xs font-semibold">
                      {getInitials(profile.full_name)}
                    </AvatarFallback>
                  </Avatar>
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right">
                <p className="font-medium">{profile.full_name}</p>
                <p className="text-xs text-muted-foreground">{getRoleBadgeLabel(profile.role)}</p>
              </TooltipContent>
            </Tooltip>
          ) : (
            <Link
              href="/settings/profile"
              className="flex items-center gap-3 rounded-md p-1.5 hover:bg-sidebar-accent transition-colors group"
            >
              <Avatar className="h-8 w-8 shrink-0 ring-2 ring-sidebar-border group-hover:ring-sidebar-primary transition-all">
                <AvatarImage src={profile.avatar_url ?? undefined} alt={profile.full_name} />
                <AvatarFallback className="bg-sidebar-accent text-sidebar-accent-foreground text-xs font-semibold">
                  {getInitials(profile.full_name)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-sidebar-foreground">
                  {profile.full_name}
                </p>
                <p className="truncate text-xs text-sidebar-foreground/50">
                  {getRoleBadgeLabel(profile.role)}
                </p>
              </div>
            </Link>
          )}

          {/* Always visible on mobile */}
          <Link
            href="/settings/profile"
            className={cn(
              'flex items-center gap-3 rounded-md p-1.5 hover:bg-sidebar-accent transition-colors group',
              isCollapsed ? 'lg:hidden' : 'hidden',
            )}
          >
            <Avatar className="h-8 w-8 shrink-0">
              <AvatarImage src={profile.avatar_url ?? undefined} alt={profile.full_name} />
              <AvatarFallback className="bg-sidebar-accent text-sidebar-accent-foreground text-xs font-semibold">
                {getInitials(profile.full_name)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-sidebar-foreground">
                {profile.full_name}
              </p>
              <p className="truncate text-xs text-sidebar-foreground/50">
                {getRoleBadgeLabel(profile.role)}
              </p>
            </div>
          </Link>
        </div>
      </aside>
    </TooltipProvider>
  )
}
