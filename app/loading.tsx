import { Skeleton } from '@/components/ui/skeleton'

/**
 * Root loading.tsx — shown while the async (dashboard)/layout.tsx is resolving
 * (fetching user, profile, permissions). Must mirror the full DashboardShell
 * structure so the sidebar + topbar are visible immediately on hard refresh.
 */
export default function Loading() {
  return (
    <div className="flex h-screen overflow-hidden bg-background">

      {/* ── Sidebar skeleton ─────────────────────────────────── */}
      <aside className="hidden lg:flex lg:w-[220px] lg:shrink-0 border-r bg-sidebar flex-col">

        {/* Logo / brand */}
        <div className="flex items-center gap-2 h-14 px-4 border-b">
          <Skeleton className="h-7 w-7 rounded-lg" />
          <Skeleton className="h-4 w-24" />
        </div>

        {/* Nav items */}
        <nav className="flex-1 flex flex-col gap-1 px-2 py-3 overflow-hidden">
          {/* Main nav */}
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div key={i} className="flex items-center gap-2 px-2 py-2 rounded-md">
              <Skeleton className="h-4 w-4 shrink-0 rounded" />
              <Skeleton className="h-3.5" style={{ width: 60 + (i % 4) * 18 }} />
            </div>
          ))}

          {/* Divider */}
          <div className="my-2 border-t mx-2" />

          {/* Spaces section label */}
          <div className="flex items-center justify-between px-2 py-1">
            <Skeleton className="h-3 w-12" />
            <Skeleton className="h-4 w-4 rounded" />
          </div>

          {/* Space items */}
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-2 px-2 py-1.5 rounded-md">
              <Skeleton className="h-5 w-5 rounded shrink-0" />
              <Skeleton className="h-3.5 w-20" />
            </div>
          ))}
        </nav>

        {/* User profile at bottom */}
        <div className="flex items-center gap-2 px-3 py-3 border-t">
          <Skeleton className="h-7 w-7 rounded-full shrink-0" />
          <div className="flex flex-col gap-1 flex-1 min-w-0">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-2.5 w-14" />
          </div>
        </div>
      </aside>

      {/* ── Main area ────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col overflow-hidden min-w-0">

        {/* Topbar */}
        <header className="flex items-center gap-3 h-14 px-4 border-b bg-background shrink-0">
          {/* Mobile hamburger */}
          <Skeleton className="h-8 w-8 rounded-md lg:hidden" />
          {/* Breadcrumb / page title */}
          <Skeleton className="h-4 w-32 hidden sm:block" />
          <div className="flex-1" />
          {/* Action icons */}
          <Skeleton className="h-8 w-8 rounded-md" />
          <Skeleton className="h-8 w-8 rounded-md" />
          <Skeleton className="h-8 w-8 rounded-full" />
        </header>

        {/* Page content — dashboard-style skeleton */}
        <main className="flex-1 overflow-y-auto p-6 flex flex-col gap-5">
          {/* Page heading */}
          <Skeleton className="h-7 w-36" />

          {/* Stat cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="rounded-xl border bg-card p-4 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-3.5 w-20" />
                  <Skeleton className="h-7 w-7 rounded-md" />
                </div>
                <Skeleton className="h-7 w-14" />
                <Skeleton className="h-3 w-24" />
              </div>
            ))}
          </div>

          {/* Two-column panels */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {[1, 2].map((col) => (
              <div key={col} className="rounded-xl border bg-card p-4 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-5 w-28" />
                  <Skeleton className="h-7 w-16 rounded-md" />
                </div>
                {[1, 2, 3, 4].map((row) => (
                  <div key={row} className="flex items-center gap-3 py-1">
                    <Skeleton className="h-8 w-8 rounded-md shrink-0" />
                    <div className="flex flex-col gap-1 flex-1">
                      <Skeleton className="h-3.5" style={{ width: 80 + (row % 3) * 30 }} />
                      <Skeleton className="h-3 w-20" />
                    </div>
                    <Skeleton className="h-5 w-16 rounded-full" />
                  </div>
                ))}
              </div>
            ))}
          </div>
        </main>
      </div>
    </div>
  )
}
