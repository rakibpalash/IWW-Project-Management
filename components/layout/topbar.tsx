'use client'

import { useCallback } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useTheme } from 'next-themes'
import {
  Menu,
  Search,
  Bell,
  LogOut,
  User,
  Settings,
  Sun,
  Moon,
  ChevronRight,
  Map,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { startTour } from '@/components/onboarding/product-tour'
import { Profile } from '@/types'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useNotifications } from '@/hooks/use-notifications'
import { useUIStore } from '@/store/ui-store'
import { cn } from '@/lib/utils'

const BREADCRUMB_MAP: Record<string, string> = {
  dashboard:     'Dashboard',
  spaces:        'Spaces',
  lists:         'Lists',
  tasks:         'My Tasks',
  attendance:    'Attendance',
  leave:         'Leave',
  team:          'Team & Access',
  settings:      'Settings',
  notifications: 'Notifications',
  timesheet:     'Timesheet',
  reports:       'Reports',
}

function getInitials(name: string) {
  return name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()
}

function Breadcrumb({ pathname }: { pathname: string }) {
  const segments = pathname.split('/').filter(Boolean)
  const crumbs = segments.map((seg, i) => {
    const label = BREADCRUMB_MAP[seg] ?? (seg.length === 36 ? '…' : seg.charAt(0).toUpperCase() + seg.slice(1))
    const href = '/' + segments.slice(0, i + 1).join('/')
    return { label, href }
  })

  if (crumbs.length === 0) return null

  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-sm min-w-0">
      {crumbs.map((crumb, i) => (
        <span key={crumb.href} className="flex items-center gap-1 min-w-0">
          {i > 0 && <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />}
          {i === crumbs.length - 1 ? (
            <span className="font-semibold text-foreground truncate">{crumb.label}</span>
          ) : (
            <Link
              href={crumb.href}
              className="text-muted-foreground hover:text-foreground transition-colors truncate"
            >
              {crumb.label}
            </Link>
          )}
        </span>
      ))}
    </nav>
  )
}

interface TopbarProps {
  profile: Profile
  onMobileMenuToggle: () => void
}

export function Topbar({ profile, onMobileMenuToggle }: TopbarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { theme, setTheme } = useTheme()
  const { unreadCount } = useNotifications()
  const setCommandPaletteOpen = useUIStore((s) => s.setCommandPaletteOpen)

  const handleSignOut = useCallback(async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }, [router])

  const toggleTheme = () => setTheme(theme === 'dark' ? 'light' : 'dark')

  return (
    <header className="flex h-11 shrink-0 items-center gap-3 border-b border-border bg-background px-3 md:px-5">
      {/* Mobile hamburger */}
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 lg:hidden text-muted-foreground hover:text-foreground"
        onClick={onMobileMenuToggle}
        aria-label="Open navigation menu"
      >
        <Menu className="h-4 w-4" />
      </Button>

      {/* Breadcrumb */}
      <div className="flex-1 min-w-0">
        <Breadcrumb pathname={pathname} />
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-0.5">
        {/* Product Tour */}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-foreground"
          aria-label="Take a tour"
          title="Take a tour"
          onClick={() => startTour(profile.role)}
        >
          <Map className="h-4 w-4" />
        </Button>

        {/* Search */}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-foreground"
          aria-label="Search (⌘K)"
          onClick={() => setCommandPaletteOpen(true)}
        >
          <Search className="h-4 w-4" />
        </Button>

        {/* Dark / Light toggle */}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-foreground"
          aria-label="Toggle theme"
          onClick={toggleTheme}
        >
          <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
        </Button>

        {/* Notifications */}
        <Link href="/notifications" aria-label="Notifications">
          <Button
            variant="ghost"
            size="icon"
            className="relative h-8 w-8 text-muted-foreground hover:text-foreground"
            asChild={false}
          >
            <Bell className="h-4 w-4" />
            {unreadCount > 0 && (
              <span className={cn(
                'absolute right-1 top-1 flex h-3.5 w-3.5 items-center justify-center',
                'rounded-full bg-destructive text-destructive-foreground',
                'text-[9px] font-bold leading-none',
              )}>
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </Button>
        </Link>

        {/* User dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="ml-1 flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-accent transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <Avatar className="h-6 w-6 shrink-0">
                <AvatarImage src={profile.avatar_url ?? undefined} alt={profile.full_name} />
                <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-bold">
                  {getInitials(profile.full_name)}
                </AvatarFallback>
              </Avatar>
              <span className="hidden md:block max-w-[120px] truncate text-[13px] font-medium text-foreground">
                {profile.full_name.split(' ')[0]}
              </span>
            </button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuLabel className="font-normal py-2">
              <div className="flex flex-col gap-0.5">
                <p className="text-sm font-semibold leading-none">{profile.full_name}</p>
                <p className="text-xs text-muted-foreground truncate mt-0.5">{profile.email}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem asChild>
                <Link href="/settings/profile" className="cursor-pointer">
                  <User className="mr-2 h-3.5 w-3.5" />
                  Profile
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/settings" className="cursor-pointer">
                  <Settings className="mr-2 h-3.5 w-3.5" />
                  Settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={toggleTheme} className="cursor-pointer">
                {theme === 'dark'
                  ? <><Sun className="mr-2 h-3.5 w-3.5" />Light mode</>
                  : <><Moon className="mr-2 h-3.5 w-3.5" />Dark mode</>
                }
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer"
              onClick={handleSignOut}
            >
              <LogOut className="mr-2 h-3.5 w-3.5" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
