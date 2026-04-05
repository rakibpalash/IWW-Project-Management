'use client'

import { useEffect } from 'react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Global error:', error)
  }, [error])

  return (
    <html>
      <body>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', gap: '16px', textAlign: 'center', padding: '24px', fontFamily: 'sans-serif' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 600 }}>Something went wrong</h2>
          <p style={{ color: '#666', maxWidth: '400px', fontSize: '14px' }}>
            {error.message || 'An unexpected error occurred.'}
          </p>
          <button onClick={reset} style={{ padding: '8px 20px', borderRadius: '6px', background: '#000', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '14px' }}>
            Try again
          </button>
        </div>
      </body>
    </html>
  )
}
