import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
export default function Loading() {
  return (
    <div className="page-inner">
      <div className="flex items-center justify-between">
        <div className="space-y-1.5"><Skeleton className="h-7 w-24" /><Skeleton className="h-4 w-48" /></div>
        <Skeleton className="h-9 w-32 rounded-md" />
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[...Array(4)].map((_,i) => (
          <Card key={i}><CardContent className="pt-5 space-y-2">
            <Skeleton className="h-4 w-20" /><Skeleton className="h-8 w-12" /><Skeleton className="h-2 w-full rounded-full" />
          </CardContent></Card>
        ))}
      </div>
      <Card>
        <CardHeader><Skeleton className="h-5 w-32" /></CardHeader>
        <CardContent className="space-y-3">
          {[...Array(6)].map((_,i) => (
            <div key={i} className="flex items-center gap-3 py-1">
              <Skeleton className="h-8 w-8 rounded-full shrink-0" />
              <div className="flex-1 space-y-1.5"><Skeleton className="h-4 w-2/5" /><Skeleton className="h-3 w-1/4" /></div>
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-8 w-20 rounded-md" />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
