import { Skeleton } from '@/components/ui/skeleton'

export default function Loading() {
  return (
    <div className="flex flex-col gap-5 p-6 max-w-4xl mx-auto">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-3" />
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-4 w-3" />
        <Skeleton className="h-4 w-36" />
      </div>

      {/* Task title */}
      <Skeleton className="h-8 w-3/4" />

      {/* Meta row */}
      <div className="flex items-center gap-3 flex-wrap">
        <Skeleton className="h-7 w-24 rounded-full" />
        <Skeleton className="h-7 w-20 rounded-full" />
        <Skeleton className="h-7 w-28 rounded-full" />
        <Skeleton className="h-7 w-7 rounded-full" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2 flex flex-col gap-5">
          {/* Description */}
          <div className="rounded-xl border bg-card p-4 flex flex-col gap-3">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>

          {/* Subtasks */}
          <div className="rounded-xl border bg-card p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-7 w-24" />
            </div>
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-2 py-1">
                <Skeleton className="h-4 w-4 rounded" />
                <Skeleton className="h-4 flex-1 max-w-[240px]" />
                <Skeleton className="h-5 w-16 rounded-full ml-auto" />
              </div>
            ))}
          </div>

          {/* Comments */}
          <div className="rounded-xl border bg-card p-4 flex flex-col gap-4">
            <Skeleton className="h-4 w-24" />
            {[1, 2].map((i) => (
              <div key={i} className="flex gap-3">
                <Skeleton className="h-8 w-8 rounded-full shrink-0" />
                <div className="flex flex-col gap-2 flex-1">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-4/5" />
                </div>
              </div>
            ))}
            <Skeleton className="h-20 w-full rounded-lg" />
          </div>
        </div>

        {/* Sidebar */}
        <div className="flex flex-col gap-4">
          {[['Assignees', 2], ['Due Date', 1], ['Priority', 1], ['Time Logged', 1]].map(([label], idx) => (
            <div key={idx} className="rounded-xl border bg-card p-4 flex flex-col gap-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-5 w-28" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
