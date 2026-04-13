import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardHeader, CardFooter } from '@/components/ui/card'
export default function Loading() {
  return (
    <div className="page-inner">
      <div className="flex items-center justify-between">
        <div className="space-y-1.5"><Skeleton className="h-7 w-28" /><Skeleton className="h-4 w-52" /></div>
        <Skeleton className="h-9 w-36 rounded-md" />
      </div>
      <div className="flex flex-wrap gap-3">
        <Skeleton className="h-9 w-56 rounded-md" />
        <Skeleton className="h-9 w-28 rounded-md" />
        <Skeleton className="h-9 w-28 rounded-md" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {[...Array(6)].map((_,i) => (
          <Card key={i} className="flex flex-col">
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-2">
                <Skeleton className="h-5 w-3/5" /><Skeleton className="h-5 w-16 rounded-full" />
              </div>
              <Skeleton className="h-4 w-full mt-1" /><Skeleton className="h-4 w-4/5" />
            </CardHeader>
            <CardContent className="flex-1 space-y-3">
              <div className="space-y-1.5">
                <div className="flex justify-between"><Skeleton className="h-3 w-16" /><Skeleton className="h-3 w-8" /></div>
                <Skeleton className="h-2 w-full rounded-full" />
              </div>
              <div className="flex items-center gap-4"><Skeleton className="h-3 w-24" /><Skeleton className="h-3 w-20" /></div>
              <div className="flex -space-x-2">{[...Array(3)].map((_,j) => <Skeleton key={j} className="h-6 w-6 rounded-full ring-2 ring-background" />)}</div>
            </CardContent>
            <CardFooter className="pt-0"><Skeleton className="h-5 w-20 rounded-full" /></CardFooter>
          </Card>
        ))}
      </div>
    </div>
  )
}
