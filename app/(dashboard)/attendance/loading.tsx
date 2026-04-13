import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
export default function Loading() {
  return (
    <div className="page-inner">
      <div className="flex items-center justify-between">
        <div className="space-y-1.5"><Skeleton className="h-7 w-36" /><Skeleton className="h-4 w-52" /></div>
        <Skeleton className="h-9 w-28 rounded-md" />
      </div>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <Skeleton className="h-5 w-32" />
          <div className="flex gap-2"><Skeleton className="h-8 w-8 rounded-md" /><Skeleton className="h-8 w-8 rounded-md" /></div>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="grid grid-cols-5 gap-4 pb-2 border-b">
            {[...Array(5)].map((_,i) => <Skeleton key={i} className="h-4 w-full" />)}
          </div>
          {[...Array(8)].map((_,i) => (
            <div key={i} className="grid grid-cols-5 gap-4 py-1">
              <div className="flex items-center gap-2"><Skeleton className="h-7 w-7 rounded-full" /><Skeleton className="h-4 w-24" /></div>
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-5 w-20 rounded-full" />
              <Skeleton className="h-4 w-14" />
              <Skeleton className="h-4 w-10" />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
