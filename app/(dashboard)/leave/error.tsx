'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { AlertTriangle } from 'lucide-react'

export default function LeaveError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[Leave page error]', error)
  }, [error])

  const router = useRouter()

  return (
    <div className="page-inner flex flex-col items-center justify-center py-24 gap-4 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
        <AlertTriangle className="h-8 w-8 text-destructive" />
      </div>
      <h2 className="text-xl font-bold">Failed to load leave data</h2>
      <p className="text-sm text-muted-foreground max-w-sm">
        An error occurred while loading the leave page. This may be a temporary issue.
        {error.digest && (
          <span className="block mt-1 font-mono text-xs">Error: {error.digest}</span>
        )}
      </p>
      <div className="flex gap-2">
        <Button onClick={reset}>Try again</Button>
        <Button variant="outline" onClick={() => router.push('/dashboard')}>Go to Dashboard</Button>
      </div>
    </div>
  )
}
