'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Eye, EyeOff, Loader2, Building2, AlertCircle, CheckCircle2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle,
} from '@/components/ui/card'
import { cn } from '@/lib/utils'

const schema = z.object({
  full_name:        z.string().min(2, 'Full name must be at least 2 characters'),
  email:            z.string().min(1, 'Email is required').email('Enter a valid email'),
  password:         z.string().min(8, 'Password must be at least 8 characters'),
  confirm_password: z.string().min(1, 'Please confirm your password'),
}).refine(d => d.password === d.confirm_password, {
  message: "Passwords don't match",
  path: ['confirm_password'],
})

type FormValues = z.infer<typeof schema>

export function RegisterForm() {
  const router = useRouter()
  const [showPw,     setShowPw]     = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [success,     setSuccess]     = useState(false)

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  })

  async function onSubmit(values: FormValues) {
    setServerError(null)
    const supabase = createClient()

    const { error } = await supabase.auth.signUp({
      email:    values.email,
      password: values.password,
      options: {
        data: {
          full_name: values.full_name,
          role:      'super_admin',
        },
      },
    })

    if (error) {
      if (error.message.toLowerCase().includes('already registered')) {
        setServerError('An account with this email already exists. Please sign in instead.')
      } else {
        setServerError(error.message)
      }
      return
    }

    // Check if email confirmation is required
    const { data: { session } } = await supabase.auth.getSession()
    if (session) {
      // Auto-confirmed (e.g. email confirmations disabled in Supabase)
      router.push('/dashboard')
      router.refresh()
    } else {
      setSuccess(true)
    }
  }

  if (success) {
    return (
      <Card className="shadow-2xl border-slate-200/10 bg-white/95 backdrop-blur-sm">
        <CardContent className="pt-10 pb-8 flex flex-col items-center text-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
            <CheckCircle2 className="h-7 w-7 text-green-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900 mb-1">Check your email</h2>
            <p className="text-sm text-slate-500 leading-relaxed max-w-xs mx-auto">
              We sent a confirmation link to your email address. Click it to activate your account and sign in.
            </p>
          </div>
          <Link href="/login" className="text-sm font-medium text-blue-600 hover:underline mt-2">
            Back to sign in
          </Link>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="shadow-2xl border-slate-200/10 bg-white/95 backdrop-blur-sm">
      <CardHeader className="space-y-1 pb-4">
        <div className="flex items-center gap-2 mb-1">
          <Building2 className="h-5 w-5 text-blue-600" />
          <span className="text-xs font-semibold uppercase tracking-wider text-blue-600">
            Create Organisation
          </span>
        </div>
        <CardTitle className="text-2xl font-bold text-slate-900">Get started free</CardTitle>
        <CardDescription className="text-slate-500">
          Register as Super Admin to set up your organisation.
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

          {/* Full name */}
          <div className="space-y-1.5">
            <Label htmlFor="full_name" className="text-slate-700">Full Name</Label>
            <Input
              id="full_name"
              placeholder="Jane Smith"
              autoComplete="name"
              disabled={isSubmitting}
              {...register('full_name')}
              className={cn(errors.full_name && 'border-destructive focus-visible:ring-destructive')}
            />
            {errors.full_name && <p className="text-xs text-destructive">{errors.full_name.message}</p>}
          </div>

          {/* Email */}
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-slate-700">Email Address</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@company.com"
              autoComplete="email"
              disabled={isSubmitting}
              {...register('email')}
              className={cn(errors.email && 'border-destructive focus-visible:ring-destructive')}
            />
            {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-slate-700">Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPw ? 'text' : 'password'}
                placeholder="Min. 8 characters"
                autoComplete="new-password"
                disabled={isSubmitting}
                {...register('password')}
                className={cn('pr-10', errors.password && 'border-destructive focus-visible:ring-destructive')}
              />
              <button type="button" tabIndex={-1} onClick={() => setShowPw(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
          </div>

          {/* Confirm password */}
          <div className="space-y-1.5">
            <Label htmlFor="confirm_password" className="text-slate-700">Confirm Password</Label>
            <div className="relative">
              <Input
                id="confirm_password"
                type={showConfirm ? 'text' : 'password'}
                placeholder="Re-enter your password"
                autoComplete="new-password"
                disabled={isSubmitting}
                {...register('confirm_password')}
                className={cn('pr-10', errors.confirm_password && 'border-destructive focus-visible:ring-destructive')}
              />
              <button type="button" tabIndex={-1} onClick={() => setShowConfirm(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.confirm_password && <p className="text-xs text-destructive">{errors.confirm_password.message}</p>}
          </div>

          {/* Role badge */}
          <div className="flex items-center gap-2 rounded-lg bg-blue-50 border border-blue-200 px-3 py-2.5">
            <Building2 className="h-4 w-4 text-blue-600 shrink-0" />
            <p className="text-xs text-blue-700">
              You will be registered as <strong>Super Admin</strong> — with full access to manage your organisation.
            </p>
          </div>

          <Button type="submit" className="w-full h-11 text-sm font-semibold mt-2" disabled={isSubmitting}>
            {isSubmitting ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating account…</>
            ) : (
              'Create account'
            )}
          </Button>
        </form>
      </CardContent>

      <CardFooter className="justify-center border-t border-slate-100 pt-4 pb-5">
        <p className="text-sm text-slate-500">
          Already have an account?{' '}
          <Link href="/login" className="font-medium text-blue-600 hover:text-blue-700 hover:underline transition-colors">
            Sign in
          </Link>
        </p>
      </CardFooter>
    </Card>
  )
}
