import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
export default function Loading() {
  return (
    <div className="page-inner max-w-2xl">
      <div className="flex items-center justify-between">
        <Skeleton className="h-7 w-36" />
        <Skeleton className="h-8 w-24 rounded-md" />
      </div>
      <Card>
        <CardHeader><Skeleton className="h-4 w-24" /></CardHeader>
        <CardContent className="divide-y">
          {[...Array(8)].map((_,i) => (
            <div key={i} className="flex items-start gap-3 py-3">
              <Skeleton className="h-8 w-8 rounded-full shrink-0 mt-0.5" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-1/3" />
              </div>
              <Skeleton className="h-2 w-2 rounded-full shrink-0 mt-2" />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
