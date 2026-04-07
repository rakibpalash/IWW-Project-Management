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
  PanelLeftClose,
  PanelLeftOpen,
  X,
  LucideIcon,
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
  isOpen: boolean
  isCollapsed: boolean
  onClose: () => void
  onToggleCollapse: () => void
}

export function Sidebar({ profile, isOpen, isCollapsed, onClose, onToggleCollapse }: SidebarProps) {
  const pathname = usePathname()
  const navItems = NAV_ITEMS[profile.role] ?? []

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
          'flex h-14 shrink-0 items-center border-b border-sidebar-border',
          isCollapsed ? 'lg:justify-center px-0' : 'px-4 justify-between',
        )}>
          {/* Expanded logo */}
          <Link
            href="/dashboard"
            className={cn(
              'flex items-center gap-2.5 outline-none',
              isCollapsed && 'lg:hidden',
            )}
            onClick={onClose}
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground text-[13px] font-bold select-none tracking-tight">
              IW
            </div>
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-sidebar-accent-foreground leading-none truncate">
                IWW PM
              </p>
              <p className="text-[10px] text-sidebar-foreground/50 leading-none mt-0.5">
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
                  className="hidden lg:flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground text-[13px] font-bold hover:opacity-90 transition-opacity"
                >
                  IW
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right" className="font-medium">IWW PM</TooltipContent>
            </Tooltip>
          )}

          {/* Mobile close */}
          <button
            onClick={onClose}
            className="lg:hidden p-1.5 rounded-md text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
            aria-label="Close menu"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* ── Nav ── */}
        <nav className="flex-1 overflow-y-auto scrollbar-hide py-3">
          <ul className={cn('space-y-0.5', isCollapsed ? 'px-2' : 'px-2')}>
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
                    'group flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium',
                    'transition-colors duration-100 relative',
                    isActive
                      ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                      : 'text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground',
                    isCollapsed && 'lg:justify-center lg:px-0 lg:py-2.5',
                  )}
                >
                  {/* Active left bar */}
                  {isActive && (
                    <span className={cn(
                      'absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r-full bg-sidebar-primary',
                      isCollapsed && 'lg:hidden',
                    )} />
                  )}

                  <Icon className={cn(
                    'h-4 w-4 shrink-0 transition-colors',
                    isActive ? 'text-sidebar-primary' : 'text-sidebar-foreground/50 group-hover:text-sidebar-foreground',
                  )} />

                  <span className={cn('truncate', isCollapsed && 'lg:hidden')}>
                    {item.label}
                  </span>

                  {/* Active dot on expanded */}
                  {isActive && !isCollapsed && (
                    <span className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-sidebar-primary" />
                  )}
                </Link>
              )

              return (
                <li key={item.href}>
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

        {/* ── Collapse toggle (desktop) ── */}
        <div className="hidden lg:flex items-center border-t border-sidebar-border px-2 py-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={onToggleCollapse}
                className={cn(
                  'flex h-8 items-center justify-center rounded-lg text-sidebar-foreground/40',
                  'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors',
                  isCollapsed ? 'w-full' : 'w-8',
                )}
                aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              >
                {isCollapsed
                  ? <PanelLeftOpen className="h-4 w-4" />
                  : <PanelLeftClose className="h-4 w-4" />
                }
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">
              {isCollapsed ? 'Expand' : 'Collapse'}
            </TooltipContent>
          </Tooltip>
        </div>

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
