'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Eye, EyeOff, Loader2, KeyRound, CheckCircle2, AlertCircle, ShieldCheck,
} from 'lucide-react'

import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle,
} from '@/components/ui/card'
import { cn } from '@/lib/utils'

const resetSchema = z
  .object({
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
      .regex(/[0-9]/, 'Must contain at least one number'),
    confirmPassword: z.string().min(1, 'Please confirm your password'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })

type ResetValues = z.infer<typeof resetSchema>

function PasswordStrength({ password }: { password: string }) {
  const checks = [
    { label: 'At least 8 characters', ok: password.length >= 8 },
    { label: 'Uppercase letter', ok: /[A-Z]/.test(password) },
    { label: 'Number', ok: /[0-9]/.test(password) },
  ]
  const score = checks.filter((c) => c.ok).length
  const barColor =
    score === 0 ? 'bg-slate-200'
    : score === 1 ? 'bg-red-400'
    : score === 2 ? 'bg-yellow-400'
    : 'bg-green-500'
  if (!password) return null
  return (
    <div className="space-y-2 mt-1">
      <div className="flex gap-1 h-1">
        {[0, 1, 2].map((i) => (
          <div key={i} className={cn('flex-1 rounded-full transition-colors', i < score ? barColor : 'bg-slate-200')} />
        ))}
      </div>
      <ul className="space-y-0.5">
        {checks.map((c) => (
          <li key={c.label} className={cn('flex items-center gap-1.5 text-xs', c.ok ? 'text-green-600' : 'text-slate-400')}>
            <CheckCircle2 className={cn('h-3 w-3', !c.ok && 'opacity-30')} />
            {c.label}
          </li>
        ))}
      </ul>
    </div>
  )
}

export default function ResetPasswordPage() {
  const router = useRouter()
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setIsReady(true)
    })
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setIsReady(true)
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } =
    useForm<ResetValues>({ resolver: zodResolver(resetSchema) })
  const passwordValue = watch('password', '')

  const onSubmit = async (values: ResetValues) => {
    setServerError(null)
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password: values.password })
    if (error) { setServerError(error.message); return }
    setSuccess(true)
    setTimeout(() => router.push('/dashboard'), 2000)
  }

  if (success) {
    return (
      <Card className="shadow-2xl border-slate-200/10 bg-white/95 backdrop-blur-sm">
        <CardHeader className="space-y-1 pb-4">
          <div className="flex items-center justify-center w-12 h-12 rounded-full bg-green-100 mx-auto mb-3">
            <ShieldCheck className="h-6 w-6 text-green-600" />
          </div>
          <CardTitle className="text-xl font-bold text-slate-900 text-center">
            Password updated!
          </CardTitle>
          <CardDescription className="text-slate-500 text-center">
            Your password has been changed. Redirecting to dashboard...
          </CardDescription>
        </CardHeader>
        <CardContent className="pb-6">
          <div className="flex items-center justify-center gap-2 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Redirecting...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!isReady) {
    return (
      <Card className="shadow-2xl border-slate-200/10 bg-white/95 backdrop-blur-sm">
        <CardContent className="flex flex-col items-center justify-center py-12 gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <p className="text-sm text-slate-500">Verifying your reset link...</p>
          <p className="text-xs text-slate-400 text-center max-w-xs">
            If this takes too long, your link may have expired.{' '}
            <Link href="/forgot-password" className="text-blue-600 hover:underline">
              Request a new one
            </Link>
            .
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="shadow-2xl border-slate-200/10 bg-white/95 backdrop-blur-sm">
      <CardHeader className="space-y-1 pb-4">
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-blue-50 mx-auto mb-2">
          <KeyRound className="h-5 w-5 text-blue-600" />
        </div>
        <CardTitle className="text-2xl font-bold text-slate-900 text-center">
          Set new password
        </CardTitle>
        <CardDescription className="text-slate-500 text-center">
          Choose a strong password for your account
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
          {serverError && (
            <div className="flex items-start gap-3 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{serverError}</span>
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-slate-700">New password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder="Minimum 8 characters"
                disabled={isSubmitting}
                {...register('password')}
                className={cn('pr-10', errors.password && 'border-destructive focus-visible:ring-destructive')}
              />
              <button type="button" tabIndex={-1} onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                aria-label={showPassword ? 'Hide password' : 'Show password'}>
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.password
              ? <p className="text-xs text-destructive mt-1">{errors.password.message}</p>
              : <PasswordStrength password={passwordValue} />}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirmPassword" className="text-slate-700">Confirm new password</Label>
            <div className="relative">
              <Input
                id="confirmPassword"
                type={showConfirm ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder="Repeat your new password"
                disabled={isSubmitting}
                {...register('confirmPassword')}
                className={cn('pr-10', errors.confirmPassword && 'border-destructive focus-visible:ring-destructive')}
              />
              <button type="button" tabIndex={-1} onClick={() => setShowConfirm((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                aria-label={showConfirm ? 'Hide password' : 'Show password'}>
                {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.confirmPassword && (
              <p className="text-xs text-destructive mt-1">{errors.confirmPassword.message}</p>
            )}
          </div>
          <Button type="submit" className="w-full h-11 text-sm font-semibold mt-2" disabled={isSubmitting}>
            {isSubmitting ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Updating password...</>
            ) : (
              <><ShieldCheck className="mr-2 h-4 w-4" />Update password</>
            )}
          </Button>
        </form>
      </CardContent>
      <CardFooter className="justify-center border-t border-slate-100 pt-4 pb-5">
        <p className="text-sm text-slate-500">
          Remember your password?{' '}
          <Link href="/login" className="font-medium text-blue-600 hover:text-blue-700 hover:underline transition-colors">
            Sign in
          </Link>
        </p>
      </CardFooter>
    </Card>
  )
}
