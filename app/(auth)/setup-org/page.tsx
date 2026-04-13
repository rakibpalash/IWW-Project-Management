'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Building2, Loader2, AlertCircle, CheckCircle2, ShieldCheck, Users, LayoutDashboard } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { createOrganizationAction } from '@/app/actions/organizations'

const FEATURES = [
  { icon: ShieldCheck,     text: 'Fully isolated from other organizations' },
  { icon: Users,           text: 'Invite your team after setup' },
  { icon: LayoutDashboard, text: 'Lists, tasks & attendance in one place' },
]

export default function SetupOrgPage() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { setError('Organization name is required'); return }
    setError(null)

    startTransition(async () => {
      const result = await createOrganizationAction({ name: name.trim() })
      if (!result.success) { setError(result.error ?? 'Failed to create organization'); return }
      router.push('/dashboard')
      router.refresh()
    })
  }

  const charCount = name.trim().length
  const isValid = charCount >= 2

  return (
    <Card className="shadow-2xl border-slate-200/10 bg-white/95 backdrop-blur-sm overflow-hidden">
      {/* Top accent bar */}
      <div className="h-1 w-full bg-gradient-to-r from-blue-500 via-blue-600 to-indigo-600" />

      <CardHeader className="pb-2 pt-7 px-7">
        <div className="flex items-center gap-3 mb-1">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-blue-600 shadow-md shadow-blue-600/30">
            <Building2 className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-blue-600">
              Create Organisation
            </p>
            <CardTitle className="text-2xl font-bold text-slate-900 leading-tight">
              Get started free
            </CardTitle>
          </div>
        </div>
        <CardDescription className="text-slate-500 text-sm mt-1">
          Register as Super Admin to set up your organisation and invite your team.
        </CardDescription>
      </CardHeader>

      <CardContent className="px-7 pb-7">
        {/* Feature list */}
        <ul className="mb-6 space-y-2">
          {FEATURES.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-center gap-2.5 text-sm text-slate-600">
              <CheckCircle2 className="h-4 w-4 text-blue-500 shrink-0" />
              {text}
            </li>
          ))}
        </ul>

        <div className="border-t border-slate-100 pt-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Error */}
            {error && (
              <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Organisation name */}
            <div className="space-y-1.5">
              <Label htmlFor="org-name" className="text-slate-700 font-medium">
                Organisation Name <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                <Input
                  id="org-name"
                  placeholder="e.g. Huda Group, Acme Corp…"
                  value={name}
                  onChange={(e) => { setName(e.target.value); setError(null) }}
                  className="h-11 pl-9 pr-14 border-slate-200 focus-visible:ring-blue-500 bg-white text-slate-900 placeholder:text-slate-400 [color-scheme:light]"
                  autoFocus
                  maxLength={80}
                  disabled={isPending}
                />
                <span className={`absolute right-3 top-1/2 -translate-y-1/2 text-xs tabular-nums ${charCount > 70 ? 'text-amber-500' : 'text-slate-400'}`}>
                  {charCount}/80
                </span>
              </div>
              <p className="text-xs text-slate-400">
                This name appears throughout the app and can be changed in Settings.
              </p>
            </div>

            {/* Submit */}
            <Button
              type="submit"
              className="w-full h-11 text-sm font-semibold bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-600/25 transition-all"
              disabled={isPending || !isValid}
            >
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating organisation…
                </>
              ) : (
                <>
                  <Building2 className="mr-2 h-4 w-4" />
                  Create Organisation
                </>
              )}
            </Button>
          </form>
        </div>

        <p className="text-center text-xs text-slate-400 mt-5">
          You can update your organisation name and logo anytime in{' '}
          <span className="font-medium text-slate-500">Settings</span>.
        </p>
      </CardContent>
    </Card>
  )
}
