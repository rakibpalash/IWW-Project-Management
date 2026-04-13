'use client'

/**
 * ClickUp-style full-content-area loader.
 *
 * Usage: drop  <PageLoader />  inside any loading.tsx
 * or pass  label  to override the default text.
 */

interface PageLoaderProps {
  label?: string
}

export function PageLoader({ label }: PageLoaderProps) {
  return (
    <div className="flex h-[calc(100vh-4rem)] w-full flex-col items-center justify-center gap-6 select-none">
      {/* Logo mark */}
      <div className="relative flex items-center justify-center">
        {/* Outer glow ring */}
        <span className="absolute inline-flex h-20 w-20 rounded-2xl bg-[#1a9e7a]/20 animate-ping" />
        {/* Icon card */}
        <div className="relative z-10 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[#1a9e7a] to-[#0e7a5f] shadow-xl shadow-[#1a9e7a]/30">
          <span className="text-2xl font-black text-white tracking-tight leading-none">I</span>
        </div>
      </div>

      {/* Bouncing dots */}
      <div className="flex items-center gap-2">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-2 w-2 rounded-full bg-[#1a9e7a]"
            style={{
              animation: 'iww-bounce 1.1s ease-in-out infinite',
              animationDelay: `${i * 0.18}s`,
            }}
          />
        ))}
      </div>

      {/* Optional label */}
      {label && (
        <p className="text-sm text-muted-foreground tracking-wide animate-pulse">{label}</p>
      )}

      <style>{`
        @keyframes iww-bounce {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.5; }
          40%            { transform: translateY(-10px); opacity: 1; }
        }
      `}</style>
    </div>
  )
}
