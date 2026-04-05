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

  useEffect(() => {
    setMounted(true)
  }, [])

  // Suppress rendering the interactive shell until client is hydrated
  // This prevents the "raw HTML" flash caused by hydration mismatch
  if (!mounted) {
    return (
      <div className="flex h-screen overflow-hidden bg-background">
        <div className="hidden lg:flex lg:w-64 lg:flex-col border-r bg-sidebar" />
        <div className="flex flex-1 flex-col overflow-hidden min-w-0">
          <div className="h-16 border-b bg-background" />
          <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
            {children}
          </main>
        </div>
      </div>
    )
  }

  return (
    <OnboardingProvider profile={profile}>
      <div className="flex h-screen overflow-hidden bg-background">
        {/* Mobile overlay */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-20 bg-black/50 lg:hidden"
            onClick={() => setSidebarOpen(false)}
            aria-hidden="true"
          />
        )}

        {/* Sidebar */}
        <Sidebar
          profile={profile}
          isOpen={sidebarOpen}
          isCollapsed={sidebarCollapsed}
          onClose={() => setSidebarOpen(false)}
          onToggleCollapse={() => setSidebarCollapsed((prev) => !prev)}
        />

        {/* Main area */}
        <div className="flex flex-1 flex-col overflow-hidden min-w-0">
          {profile.is_temp_password && <TempPasswordBanner />}

          <Topbar
            profile={profile}
            onMobileMenuToggle={() => setSidebarOpen((prev) => !prev)}
          />

          <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
            {children}
          </main>
        </div>

        {/* Global command palette */}
        <CommandPalette />
      </div>
    </OnboardingProvider>
  )
}
