'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ArrowLeft, Loader2, Mail, CheckCircle2, AlertCircle } from 'lucide-react'

import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { cn } from '@/lib/utils'

// ── Schema ─────────────────────────────────────────────────────────────────
const forgotSchema = z.object({
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Please enter a valid email address'),
})

type ForgotValues = z.infer<typeof forgotSchema>

// ── Component ──────────────────────────────────────────────────────────────
export default function ForgotPasswordPage() {
  const [submitted, setSubmitted] = useState(false)
  const [submittedEmail, setSubmittedEmail] = useState('')
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotValues>({
    resolver: zodResolver(forgotSchema),
  })

  const onSubmit = async (values: ForgotValues) => {
    setServerError(null)
    const supabase = createClient()

    const { error } = await supabase.auth.resetPasswordForEmail(values.email, {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/reset-password`,
    })

    if (error) {
      setServerError(error.message)
      return
    }

    setSubmittedEmail(values.email)
    setSubmitted(true)
  }

  // ── Success state ──────────────────────────────────────────────────────
  if (submitted) {
    return (
      <Card className="shadow-2xl border-slate-200/10 bg-white/95 backdrop-blur-sm">
        <CardHeader className="space-y-1 pb-4">
          <div className="flex items-center justify-center w-12 h-12 rounded-full bg-green-100 mx-auto mb-3">
            <CheckCircle2 className="h-6 w-6 text-green-600" />
          </div>
          <CardTitle className="text-xl font-bold text-slate-900 text-center">
            Check your email
          </CardTitle>
          <CardDescription className="text-slate-500 text-center">
            We sent a password reset link to{' '}
            <span className="font-medium text-slate-700">{submittedEmail}</span>
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="rounded-md bg-blue-50 border border-blue-100 px-4 py-3 text-sm text-blue-700">
            <p className="font-medium mb-1">What to do next:</p>
            <ol className="list-decimal list-inside space-y-1 text-blue-600">
              <li>Open the email from IWW Project Management</li>
              <li>Click the &ldquo;Reset password&rdquo; link</li>
              <li>Choose a new secure password</li>
            </ol>
          </div>
          <p className="text-xs text-slate-400 text-center">
            The link will expire in 60 minutes. Didn&apos;t receive it? Check
            your spam folder.
          </p>
        </CardContent>

        <CardFooter className="justify-center border-t border-slate-100 pt-4 pb-5">
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 hover:underline transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to sign in
          </Link>
        </CardFooter>
      </Card>
    )
  }

  // ── Form state ─────────────────────────────────────────────────────────
  return (
    <Card className="shadow-2xl border-slate-200/10 bg-white/95 backdrop-blur-sm">
      <CardHeader className="space-y-1 pb-4">
        <CardTitle className="text-2xl font-bold text-slate-900">
          Forgot password?
        </CardTitle>
        <CardDescription className="text-slate-500">
          Enter your email and we&apos;ll send you a reset link
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
          {/* Server error */}
          {serverError && (
            <div className="flex items-start gap-3 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{serverError}</span>
            </div>
          )}

          {/* Email */}
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-slate-700">
              Email address
            </Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                disabled={isSubmitting}
                {...register('email')}
                className={cn(
                  'pl-9',
                  errors.email &&
                    'border-destructive focus-visible:ring-destructive'
                )}
              />
            </div>
            {errors.email && (
              <p className="text-xs text-destructive mt-1">
                {errors.email.message}
              </p>
            )}
          </div>

          {/* Submit */}
          <Button
            type="submit"
            className="w-full h-11 text-sm font-semibold mt-2"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending reset link…
              </>
            ) : (
              'Send reset link'
            )}
          </Button>
        </form>
      </CardContent>

      <CardFooter className="justify-center border-t border-slate-100 pt-4 pb-5">
        <Link
          href="/login"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 hover:underline transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to sign in
        </Link>
      </CardFooter>
    </Card>
  )
}
