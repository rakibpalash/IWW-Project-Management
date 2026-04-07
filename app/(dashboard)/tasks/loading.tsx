import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardHeader } from '@/components/ui/card'

function TaskRowSkeleton() {
  return (
    <div className="flex items-center gap-3 py-3 border-b last:border-0">
      <Skeleton className="h-4 w-4 rounded shrink-0" />
      <div className="flex-1 min-w-0 space-y-1.5">
        <Skeleton className="h-4 w-3/4" />
        <div className="flex items-center gap-3">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-3 w-16" />
        </div>
      </div>
      <Skeleton className="h-5 w-20 rounded-full shrink-0" />
      <Skeleton className="h-5 w-16 rounded-full shrink-0" />
      <Skeleton className="h-6 w-6 rounded-full shrink-0" />
    </div>
  )
}

export default function TasksLoading() {
  return (
    <div className="page-inner" data-testid="tasks-loading">
      {/* Page heading + action button */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-4 w-48" />
        </div>
        <Skeleton className="h-9 w-32 rounded-md" />
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3">
        <Skeleton className="h-9 w-52 rounded-md" />
        <Skeleton className="h-9 w-28 rounded-md" />
        <Skeleton className="h-9 w-28 rounded-md" />
        <Skeleton className="h-9 w-28 rounded-md" />
      </div>

      {/* Kanban columns OR list view */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {['Todo', 'In Progress', 'In Review', 'Done'].map((col) => (
          <Card key={col}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <Skeleton className="h-5 w-20" />
                <Skeleton className="h-5 w-6 rounded-full" />
              </div>
            </CardHeader>
            <CardContent className="space-y-2 px-3 pb-3">
              {Array.from({ length: col === 'Todo' ? 4 : col === 'In Progress' ? 3 : 2 }).map(
                (_, i) => (
                  <div key={i} className="rounded-lg border bg-card p-3 space-y-2 shadow-sm">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-3 w-5/6" />
                    <div className="flex items-center justify-between mt-1">
                      <div className="flex items-center gap-1.5">
                        <Skeleton className="h-5 w-14 rounded-full" />
                        <Skeleton className="h-5 w-12 rounded-full" />
                      </div>
                      <Skeleton className="h-5 w-5 rounded-full" />
                    </div>
                  </div>
                )
              )}
              <Skeleton className="h-8 w-full rounded-md mt-1" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Table skeleton (shown on mobile or list view) */}
      <Card className="md:hidden">
        <CardHeader>
          <Skeleton className="h-5 w-24" />
        </CardHeader>
        <CardContent className="px-4 py-0">
          {Array.from({ length: 8 }).map((_, i) => (
            <TaskRowSkeleton key={i} />
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
