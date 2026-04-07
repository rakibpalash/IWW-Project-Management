'use client'

import { useState, useEffect } from 'react'
import { Profile } from '@/types'
import { Sidebar } from './sidebar'
import { Topbar } from './topbar'
import { TempPasswordBanner } from './temp-password-banner'
import { CommandPalette } from '@/components/search/command-palette'
import { OnboardingProvider } from '@/components/onboarding/onboarding-provider'

interface DashboardShellProps {
  profile: Profile
  children: React.ReactNode
}

export function DashboardShell({ profile, children }: DashboardShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  // Skeleton while hydrating (prevents flash)
  if (!mounted) {
    return (
      <div className="flex h-screen overflow-hidden bg-background">
        <div className="hidden lg:flex lg:w-60 lg:shrink-0 border-r bg-sidebar" />
        <div className="flex flex-1 flex-col overflow-hidden min-w-0">
          <div className="h-14 border-b bg-background" />
          <div className="flex-1 overflow-y-auto p-4 sm:p-6">{children}</div>
        </div>
      </div>
    )
  }

  return (
    <OnboardingProvider profile={profile}>
      <div className="flex h-screen overflow-hidden bg-background">
        <Sidebar
          profile={profile}
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
      </div>
    </OnboardingProvider>
  )
}
