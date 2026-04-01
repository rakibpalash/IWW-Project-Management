import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'IWW Project Management — Sign In',
}

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 px-4 py-12">
      {/* Subtle grid overlay */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      {/* Brand header */}
      <div className="relative z-10 mb-8 flex flex-col items-center gap-2 text-center">
        <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-600 shadow-lg shadow-blue-600/40">
          {/* Simple monogram logo */}
          <span className="text-white text-2xl font-bold tracking-tight select-none">
            IW
          </span>
        </div>
        <h1 className="text-white text-xl font-semibold tracking-tight mt-1">
          IWW Project Management
        </h1>
        <p className="text-blue-200/70 text-sm">
          Project &amp; Team Management System
        </p>
      </div>

      {/* Page card */}
      <div className="relative z-10 w-full max-w-md">{children}</div>

      {/* Footer */}
      <p className="relative z-10 mt-8 text-xs text-slate-500">
        &copy; {new Date().getFullYear()} IWW. All rights reserved.
      </p>
    </div>
  )
}
