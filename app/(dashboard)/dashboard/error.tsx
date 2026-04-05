'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Dashboard error:', error)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center p-6">
      <h2 className="text-xl font-semibold">Dashboard failed to load</h2>
      <p className="text-muted-foreground max-w-sm text-sm">
        {error.message || 'An unexpected error occurred.'}
      </p>
      {error.digest && (
        <p className="font-mono text-xs text-muted-foreground">ID: {error.digest}</p>
      )}
      <Button onClick={reset}>Try again</Button>
    </div>
  )
}
