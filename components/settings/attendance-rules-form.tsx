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
import { Loader2, Clock, Calendar, CheckCircle2, Banknote, Smartphone } from 'lucide-react'
import { AttendanceSettings } from '@/types'
import { createClient } from '@/lib/supabase/client'

const timePattern = /^([01]\d|2[0-3]):([0-5]\d)$/
const timeField = z.string().regex(timePattern, 'Must be in HH:MM format')

const formSchema = z.object({
  // General rule
  on_time_end:       timeField,
  late_150_end:      timeField,
  late_250_end:      timeField,
  exit_time_general: timeField,
  // Friday rule
  friday_on_time_end:  timeField,
  friday_late_150_end: timeField,
  friday_late_250_end: timeField,
  exit_time_friday:    timeField,
  // Football rule
  football_on_time_end:  timeField,
  football_late_150_end: timeField,
  football_late_250_end: timeField,
  exit_time_football:    timeField,
  // Leave
  yearly_leave_days: z.coerce.number().int().min(1).max(365),
  wfh_days: z.coerce.number().int().min(0).max(365),
  // Fine amounts (fallback when no salary configured)
  fine_late_1: z.coerce.number().int().min(0),
  fine_late_2: z.coerce.number().int().min(0),
  // Salary fine calculation
  work_hours_per_week: z.coerce.number().int().min(1).max(80),
  // Payment
  org_bkash_number: z.string().max(20).optional().or(z.literal('')),
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
      // General
      on_time_end:       settings?.on_time_end       ?? '09:00',
      late_150_end:      settings?.late_150_end       ?? '09:30',
      late_250_end:      settings?.late_250_end       ?? '11:00',
      exit_time_general: settings?.exit_time_general  ?? '14:15',
      // Friday
      friday_on_time_end:  settings?.friday_on_time_end  ?? '08:30',
      friday_late_150_end: settings?.friday_late_150_end ?? '09:00',
      friday_late_250_end: settings?.friday_late_250_end ?? '11:00',
      exit_time_friday:    settings?.exit_time_friday    ?? '12:15',
      // Football
      football_on_time_end:  settings?.football_on_time_end  ?? '09:45',
      football_late_150_end: settings?.football_late_150_end ?? '10:30',
      football_late_250_end: settings?.football_late_250_end ?? '11:00',
      exit_time_football:    settings?.exit_time_football    ?? '14:30',
      // Leave
      yearly_leave_days: settings?.yearly_leave_days ?? 18,
      wfh_days: settings?.wfh_days ?? 10,
      // Fines
      fine_late_1: settings?.fine_late_1 ?? 150,
      fine_late_2: settings?.fine_late_2 ?? 250,
      // Work schedule
      work_hours_per_week: settings?.work_hours_per_week ?? 30,
      // Payment
      org_bkash_number: settings?.org_bkash_number ?? '',
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

        {/* General Rule (Sat–Thu) */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="h-4 w-4" />
              General Rule <span className="text-xs font-normal text-muted-foreground ml-1">(Sat – Thu)</span>
            </CardTitle>
            <CardDescription>
              Standard check-in boundaries for all days except Friday and Sunday
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <FormField control={form.control} name="on_time_end" render={({ field }) => (
                <FormItem>
                  <FormLabel>On Time Until</FormLabel>
                  <FormControl><Input type="time" {...field} /></FormControl>
                  <FormDescription className="text-xs">No deduction</FormDescription>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="late_150_end" render={({ field }) => (
                <FormItem>
                  <FormLabel>Late (150%) Until</FormLabel>
                  <FormControl><Input type="time" {...field} /></FormControl>
                  <FormDescription className="text-xs">150% deduction</FormDescription>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="late_250_end" render={({ field }) => (
                <FormItem>
                  <FormLabel>Late (250%) Until</FormLabel>
                  <FormControl><Input type="time" {...field} /></FormControl>
                  <FormDescription className="text-xs">250% deduction; after = Absent</FormDescription>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="exit_time_general" render={({ field }) => (
                <FormItem>
                  <FormLabel>Exit Time</FormLabel>
                  <FormControl><Input type="time" {...field} /></FormControl>
                  <FormDescription className="text-xs">Expected check-out</FormDescription>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
          </CardContent>
        </Card>

        {/* Friday Rule */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="h-4 w-4" />
              Friday Rule
            </CardTitle>
            <CardDescription>
              Earlier entry cutoffs and shorter workday for Fridays
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <FormField control={form.control} name="friday_on_time_end" render={({ field }) => (
                <FormItem>
                  <FormLabel>On Time Until</FormLabel>
                  <FormControl><Input type="time" {...field} /></FormControl>
                  <FormDescription className="text-xs">No deduction</FormDescription>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="friday_late_150_end" render={({ field }) => (
                <FormItem>
                  <FormLabel>Late (150%) Until</FormLabel>
                  <FormControl><Input type="time" {...field} /></FormControl>
                  <FormDescription className="text-xs">150% deduction</FormDescription>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="friday_late_250_end" render={({ field }) => (
                <FormItem>
                  <FormLabel>Late (250%) Until</FormLabel>
                  <FormControl><Input type="time" {...field} /></FormControl>
                  <FormDescription className="text-xs">250% deduction; after = Absent</FormDescription>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="exit_time_friday" render={({ field }) => (
                <FormItem>
                  <FormLabel>Exit Time</FormLabel>
                  <FormControl><Input type="time" {...field} /></FormControl>
                  <FormDescription className="text-xs">Expected check-out</FormDescription>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
          </CardContent>
        </Card>

        {/* Football Rule */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="h-4 w-4" />
              Football Rule ⚽
            </CardTitle>
            <CardDescription>
              Extended entry window for selected staff on football match days.
              After the 250% cutoff, status becomes <strong>Advance Absence</strong> (not plain Absent).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <FormField control={form.control} name="football_on_time_end" render={({ field }) => (
                <FormItem>
                  <FormLabel>On Time Until</FormLabel>
                  <FormControl><Input type="time" {...field} /></FormControl>
                  <FormDescription className="text-xs">No deduction</FormDescription>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="football_late_150_end" render={({ field }) => (
                <FormItem>
                  <FormLabel>Late (150%) Until</FormLabel>
                  <FormControl><Input type="time" {...field} /></FormControl>
                  <FormDescription className="text-xs">150% deduction</FormDescription>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="football_late_250_end" render={({ field }) => (
                <FormItem>
                  <FormLabel>Late (250%) Until</FormLabel>
                  <FormControl><Input type="time" {...field} /></FormControl>
                  <FormDescription className="text-xs">250% → Advance Absence</FormDescription>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="exit_time_football" render={({ field }) => (
                <FormItem>
                  <FormLabel>Exit Time</FormLabel>
                  <FormControl><Input type="time" {...field} /></FormControl>
                  <FormDescription className="text-xs">Expected check-out</FormDescription>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
          </CardContent>
        </Card>

        <Separator />

        {/* Leave Defaults */}
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
              <FormField control={form.control} name="yearly_leave_days" render={({ field }) => (
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
              )} />
              <FormField control={form.control} name="wfh_days" render={({ field }) => (
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
              )} />
            </div>
          </CardContent>
        </Card>

        <Separator />

        {/* Late Fine Amounts */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Banknote className="h-4 w-4" />
              Late Fine System
            </CardTitle>
            <CardDescription>
              Fines are calculated automatically at check-in.
              Staff with a salary set use <strong>per-minute deduction</strong> (Level 1 = 150%, Level 2 = 250%).
              Fixed amounts below are used as fallback when no salary is configured.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Work schedule — drives per-minute rate */}
            <div>
              <FormField control={form.control} name="work_hours_per_week" render={({ field }) => (
                <FormItem className="max-w-xs">
                  <FormLabel>Work Hours per Week</FormLabel>
                  <FormControl>
                    <Input type="number" min={1} max={80} {...field} />
                  </FormControl>
                  <FormDescription className="text-xs">
                    Used to calculate salary per minute.{' '}
                    Monthly work minutes = hours × 4 × 60.
                    Default: 30 hrs/week → 7 200 min/month.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            {/* Fixed fallback fines */}
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wide">
                Fixed Fallback Amounts (no salary configured)
              </p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField control={form.control} name="fine_late_1" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Level 1 Fine <span className="text-xs text-amber-600 font-normal">(150% threshold)</span></FormLabel>
                    <FormControl>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">৳</span>
                        <Input type="number" min={0} {...field} className="pl-7" />
                      </div>
                    </FormControl>
                    <FormDescription className="text-xs">
                      Checked in after on-time but before Level 2 threshold
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="fine_late_2" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Level 2 Fine <span className="text-xs text-red-600 font-normal">(250% threshold)</span></FormLabel>
                    <FormControl>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">৳</span>
                        <Input type="number" min={0} {...field} className="pl-7" />
                      </div>
                    </FormControl>
                    <FormDescription className="text-xs">
                      Checked in after Level 2 threshold
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* bKash Payment Number */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Smartphone className="h-4 w-4" />
              bKash Payment Number
            </CardTitle>
            <CardDescription>
              Your organisation&apos;s bKash number shown to staff when a fine is imposed.
              Staff will be instructed to send the fine amount here and share the TxnID.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FormField control={form.control} name="org_bkash_number" render={({ field }) => (
              <FormItem className="max-w-xs">
                <FormLabel>bKash Number</FormLabel>
                <FormControl>
                  <Input placeholder="e.g. 01700000000" {...field} />
                </FormControl>
                <FormDescription className="text-xs">
                  Leave blank to hide payment instructions from notifications.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )} />
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
