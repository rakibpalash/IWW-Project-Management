'use client'

import { useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, X } from 'lucide-react'

export function TempPasswordBanner() {
  const [dismissed, setDismissed] = useState(false)

  if (dismissed) return null

  return (
    <div
      role="alert"
      className="flex items-center gap-3 bg-yellow-50 border-b border-yellow-200 px-4 py-2.5 text-yellow-900"
    >
      <AlertTriangle className="h-4 w-4 shrink-0 text-yellow-600" aria-hidden="true" />

      <p className="flex-1 text-sm">
        You&apos;re using a temporary password.{' '}
        <Link
          href="/settings/security"
          className="font-semibold underline underline-offset-2 hover:text-yellow-700 transition-colors"
        >
          Change it now &rarr;
        </Link>
      </p>

      <button
        onClick={() => setDismissed(true)}
        className="shrink-0 rounded-md p-0.5 text-yellow-700 hover:bg-yellow-100 hover:text-yellow-900 transition-colors"
        aria-label="Dismiss banner"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
