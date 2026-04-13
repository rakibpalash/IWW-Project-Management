'use client'

import { useState, useEffect } from 'react'
import { Profile } from '@/types'
import { PermissionSet } from '@/lib/permissions'
import { Sidebar } from './sidebar'
import { Topbar } from './topbar'
import { TempPasswordBanner } from './temp-password-banner'
import { CommandPalette } from '@/components/search/command-palette'
import { OnboardingProvider } from '@/components/onboarding/onboarding-provider'
import { TourAutoStart } from '@/components/onboarding/tour-auto-start'

interface DashboardShellProps {
  profile: Profile
  permissions?: PermissionSet
  children: React.ReactNode
}

export function DashboardShell({ profile, permissions, children }: DashboardShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  // Skeleton while hydrating — sidebar must be visible immediately to avoid black-flash
  if (!mounted) {
    return (
      <div className="flex h-screen overflow-hidden bg-background">
        {/* Sidebar skeleton — matches real sidebar dimensions & dark bg */}
        <aside className="hidden lg:flex lg:w-[220px] lg:shrink-0 border-r bg-sidebar flex-col">
          {/* Logo row */}
          <div className="flex items-center gap-2 h-14 px-4 border-b border-sidebar-border">
            <div className="h-7 w-7 rounded-lg bg-white/10 animate-pulse" />
            <div className="h-3.5 w-24 rounded bg-white/10 animate-pulse" />
          </div>
          {/* Nav items */}
          <nav className="flex-1 flex flex-col gap-0.5 px-2 py-3">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <div key={i} className="flex items-center gap-2 px-2 py-2 rounded-md">
                <div className="h-4 w-4 shrink-0 rounded bg-white/10 animate-pulse" />
                <div
                  className="h-3 rounded bg-white/10 animate-pulse"
                  style={{ width: 52 + (i % 4) * 18 }}
                />
              </div>
            ))}
            <div className="my-2 border-t border-sidebar-border mx-1" />
            <div className="flex items-center justify-between px-2 py-1">
              <div className="h-3 w-12 rounded bg-white/10 animate-pulse" />
              <div className="h-4 w-4 rounded bg-white/10 animate-pulse" />
            </div>
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-2 px-2 py-1.5 rounded-md">
                <div className="h-5 w-5 rounded shrink-0 bg-white/10 animate-pulse" />
                <div className="h-3 w-20 rounded bg-white/10 animate-pulse" />
              </div>
            ))}
          </nav>
          {/* User row */}
          <div className="flex items-center gap-2 px-3 py-3 border-t border-sidebar-border">
            <div className="h-7 w-7 rounded-full shrink-0 bg-white/10 animate-pulse" />
            <div className="flex flex-col gap-1 flex-1 min-w-0">
              <div className="h-3 w-20 rounded bg-white/10 animate-pulse" />
              <div className="h-2.5 w-14 rounded bg-white/10 animate-pulse" />
            </div>
          </div>
        </aside>

        {/* Main area skeleton */}
        <div className="flex flex-1 flex-col overflow-hidden min-w-0">
          <div className="h-14 border-b bg-background" />
          <div className="flex-1 overflow-y-auto scrollbar-thin">{children}</div>
        </div>
      </div>
    )
  }

  return (
    <OnboardingProvider profile={profile}>
      <div className="flex h-screen overflow-hidden bg-background">
        <Sidebar
          profile={profile}
          permissions={permissions}
          isOpen={sidebarOpen}
          isCollapsed={sidebarCollapsed}
          onClose={() => setSidebarOpen(false)}
          onToggleCollapse={() => setSidebarCollapsed((p) => !p)}
        />

        <div className="flex flex-1 flex-col overflow-hidden min-w-0">
          {profile.is_temp_password && <TempPasswordBanner />}

          <Topbar
            profile={profile}
            onMobileMenuToggle={() => setSidebarOpen((p) => !p)}
          />

          {/* Main scrollable area — children own their own padding via page-root / page-inner */}
          <main className="flex-1 overflow-y-auto scrollbar-thin">
            {children}
          </main>
        </div>

        <CommandPalette />
        <TourAutoStart profile={profile} />
      </div>
    </OnboardingProvider>
  )
}
