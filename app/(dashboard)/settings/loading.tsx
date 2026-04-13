import { Skeleton } from '@/components/ui/skeleton'

export default function Loading() {
  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Page header */}
      <Skeleton className="h-8 w-32" />

      {/* Tab bar */}
      <div className="flex gap-1 border-b pb-0">
        {[80, 100, 90, 110, 95, 85].map((w, i) => (
          <Skeleton key={i} className="h-9 rounded-b-none" style={{ width: w }} />
        ))}
      </div>

      {/* Card 1 — general form */}
      <div className="rounded-xl border bg-card p-6 flex flex-col gap-5">
        <Skeleton className="h-5 w-40" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex flex-col gap-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-9 w-full" />
            </div>
          ))}
        </div>
      </div>

      {/* Card 2 — rules form */}
      <div className="rounded-xl border bg-card p-6 flex flex-col gap-5">
        <Skeleton className="h-5 w-52" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex flex-col gap-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-9 w-full" />
            </div>
          ))}
        </div>
        <Skeleton className="h-9 w-28 self-end" />
      </div>

      {/* Card 3 — staff list */}
      <div className="rounded-xl border bg-card p-6 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-9 w-28" />
        </div>
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-center gap-3 py-2 border-b last:border-0">
            <Skeleton className="h-9 w-9 rounded-full shrink-0" />
            <div className="flex flex-col gap-1 flex-1">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-44" />
            </div>
            <Skeleton className="h-6 w-16 rounded-full" />
            <Skeleton className="h-8 w-8 rounded-md" />
          </div>
        ))}
      </div>
    </div>
  )
}
