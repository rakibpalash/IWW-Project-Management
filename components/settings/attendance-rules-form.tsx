'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, Clock, Calendar, CheckCircle2 } from 'lucide-react'
import { AttendanceSettings } from '@/types'
import { createClient } from '@/lib/supabase/client'

const timePattern = /^([01]\d|2[0-3]):([0-5]\d)$/

const formSchema = z.object({
  on_time_end: z.string().regex(timePattern, 'Must be in HH:MM format'),
  late_150_end: z.string().regex(timePattern, 'Must be in HH:MM format'),
  late_250_end: z.string().regex(timePattern, 'Must be in HH:MM format'),
  football_on_time_end: z.string().regex(timePattern, 'Must be in HH:MM format'),
  football_late_150_end: z.string().regex(timePattern, 'Must be in HH:MM format'),
  football_late_250_end: z.string().regex(timePattern, 'Must be in HH:MM format'),
  yearly_leave_days: z.coerce.number().int().min(1).max(365),
  wfh_days: z.coerce.number().int().min(0).max(365),
})

type FormValues = z.infer<typeof formSchema>

interface AttendanceRulesFormProps {
  settings: AttendanceSettings | null
}

export function AttendanceRulesForm({ settings }: AttendanceRulesFormProps) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      on_time_end: settings?.on_time_end ?? '09:00',
      late_150_end: settings?.late_150_end ?? '09:30',
      late_250_end: settings?.late_250_end ?? '11:00',
      football_on_time_end: settings?.football_on_time_end ?? '09:45',
      football_late_150_end: settings?.football_late_150_end ?? '10:30',
      football_late_250_end: settings?.football_late_250_end ?? '11:00',
      yearly_leave_days: settings?.yearly_leave_days ?? 18,
      wfh_days: settings?.wfh_days ?? 10,
    },
  })

  const onSubmit = async (values: FormValues) => {
    setSaving(true)
    setError(null)
    setSaved(false)

    try {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      let result
      if (settings?.id) {
        result = await supabase
          .from('attendance_settings')
          .update({ ...values, updated_by: user?.id ?? null })
          .eq('id', settings.id)
      } else {
        result = await supabase
          .from('attendance_settings')
          .insert({ ...values, updated_by: user?.id ?? null })
      }

      if (result.error) {
        setError(result.error.message)
        return
      }

      setSaved(true)
      router.refresh()
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {saved && (
          <Alert className="border-green-200 bg-green-50">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-700">Settings saved successfully!</AlertDescription>
          </Alert>
        )}

        {/* Default Attendance Rules */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="h-4 w-4" />
              Default Attendance Rules
            </CardTitle>
            <CardDescription>
              Standard check-in time boundaries for attendance classification
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <FormField
                control={form.control}
                name="on_time_end"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>On Time Until</FormLabel>
                    <FormControl>
                      <Input type="time" {...field} />
                    </FormControl>
                    <FormDescription className="text-xs">
                      Check-in before this = On Time (no deduction)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="late_150_end"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Late 1.5x Until</FormLabel>
                    <FormControl>
                      <Input type="time" {...field} />
                    </FormControl>
                    <FormDescription className="text-xs">
                      Check-in before this = 1.5x deduction
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="late_250_end"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Late 2.5x Until</FormLabel>
                    <FormControl>
                      <Input type="time" {...field} />
                    </FormControl>
                    <FormDescription className="text-xs">
                      Check-in before this = 2.5x deduction
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </CardContent>
        </Card>

        {/* Football Rules */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="h-4 w-4" />
              Football Day Rules
            </CardTitle>
            <CardDescription>
              Alternative time boundaries applied on football match days
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <FormField
                control={form.control}
                name="football_on_time_end"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>On Time Until</FormLabel>
                    <FormControl>
                      <Input type="time" {...field} />
                    </FormControl>
                    <FormDescription className="text-xs">
                      Football day on-time cutoff
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="football_late_150_end"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Late 1.5x Until</FormLabel>
                    <FormControl>
                      <Input type="time" {...field} />
                    </FormControl>
                    <FormDescription className="text-xs">
                      Football day 1.5x deduction cutoff
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="football_late_250_end"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Late 2.5x Until</FormLabel>
                    <FormControl>
                      <Input type="time" {...field} />
                    </FormControl>
                    <FormDescription className="text-xs">
                      Football day 2.5x deduction cutoff
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </CardContent>
        </Card>

        {/* Leave Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Calendar className="h-4 w-4" />
              Leave Defaults
            </CardTitle>
            <CardDescription>
              Default allocation when a new leave balance record is created for a staff member
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="yearly_leave_days"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Annual Leave Days</FormLabel>
                    <FormControl>
                      <Input type="number" min={1} max={365} {...field} />
                    </FormControl>
                    <FormDescription className="text-xs">
                      Default yearly leave allocation per staff
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="wfh_days"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Work From Home Days</FormLabel>
                    <FormControl>
                      <Input type="number" min={0} max={365} {...field} />
                    </FormControl>
                    <FormDescription className="text-xs">
                      Default WFH allocation per staff
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button type="submit" disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Settings
          </Button>
        </div>
      </form>
    </Form>
  )
}
