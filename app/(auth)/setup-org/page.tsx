'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Building2, Loader2, AlertCircle, Sparkles } from 'lucide-react'
import { createOrganizationAction } from '@/app/actions/organizations'

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 via-white to-purple-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo / brand */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="h-10 w-10 rounded-xl bg-violet-600 flex items-center justify-center">
            <Building2 className="h-5 w-5 text-white" />
          </div>
          <span className="text-xl font-bold text-foreground">IWW PM</span>
        </div>

        <Card className="shadow-lg border-0 bg-white/80 backdrop-blur">
          <CardHeader className="text-center pb-2">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Sparkles className="h-5 w-5 text-violet-500" />
            </div>
            <CardTitle className="text-xl">Set up your organization</CardTitle>
            <CardDescription className="text-sm">
              Create your workspace. Your team&apos;s data will be fully isolated from other organizations.
            </CardDescription>
          </CardHeader>

          <CardContent className="pt-4">
            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <Alert variant="destructive" className="py-2">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="org-name">Organization Name <span className="text-red-500">*</span></Label>
                <Input
                  id="org-name"
                  placeholder="e.g. Huda Group, Acme Corp…"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-10"
                  autoFocus
                />
                <p className="text-xs text-muted-foreground">
                  This is how your organization appears throughout the app.
                </p>
              </div>

              <Button
                type="submit"
                className="w-full bg-violet-600 hover:bg-violet-700 text-white h-10"
                disabled={isPending || !name.trim()}
              >
                {isPending ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating…</>
                ) : (
                  <><Building2 className="mr-2 h-4 w-4" /> Create Organization</>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground mt-4">
          You can update your organization name and logo anytime in Settings.
        </p>
      </div>
    </div>
  )
}
