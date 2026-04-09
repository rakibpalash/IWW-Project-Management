'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/client'
import { Project, Workspace, Profile, BillingType } from '@/types'
import { toast } from '@/components/ui/use-toast'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { CalendarIcon, DollarSign, Loader2, Lock } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { cn } from '@/lib/utils'

type TaskStatus   = { slug: string; name: string; color: string }
type TaskPriority = { slug: string; name: string; color: string; is_default: boolean }

const BILLING_TYPES: { value: BillingType; label: string; description: string }[] = [
  { value: 'hourly',       label: 'Hourly',      description: 'Billed by hours worked' },
  { value: 'fixed',        label: 'Fixed Price',  description: 'Fixed project cost' },
  { value: 'retainer',     label: 'Retainer',     description: 'Monthly retainer fee' },
  { value: 'non_billable', label: 'Non-Billable', description: 'Internal / no billing' },
]

const formSchema = z.object({
  name:            z.string().min(1, 'Project name is required').max(255),
  workspace_id:    z.string().min(1, 'Workspace is required'),
  client_id:       z.string().optional(),
  partner_id:      z.string().optional(),
  is_internal:     z.boolean().default(false),
  billing_type:    z.enum(['hourly', 'fixed', 'retainer', 'non_billable']).default('hourly'),
  fixed_price:     z.coerce.number().min(0).optional().or(z.literal('')),
  start_date:      z.date().optional(),
  due_date:        z.date().optional(),
  status:          z.string().min(1),
  priority:        z.string().min(1),
  progress:        z.coerce.number().min(0).max(100),
  estimated_hours: z.coerce.number().min(0).optional().or(z.literal('')),
  description:     z.string().max(2000).optional(),
})

type FormValues = z.infer<typeof formSchema>

interface EditProjectDialogProps {
  open:          boolean
  onOpenChange:  (open: boolean) => void
  project:       Project
  isSuperAdmin?: boolean
  onUpdated?:    (project: Project) => void
}

export function EditProjectDialog({
  open,
  onOpenChange,
  project,
  isSuperAdmin = false,
  onUpdated,
}: EditProjectDialogProps) {
  const supabase   = createClient()
  const [loading,    setLoading]    = useState(false)
  const [clients,    setClients]    = useState<Profile[]>([])
  const [partners,   setPartners]   = useState<Profile[]>([])
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [statuses,   setStatuses]   = useState<TaskStatus[]>([])
  const [priorities, setPriorities] = useState<TaskPriority[]>([])
  const [startOpen,  setStartOpen]  = useState(false)
  const [dueOpen,    setDueOpen]    = useState(false)

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name:            project.name,
      workspace_id:    project.workspace_id,
      client_id:       project.client_id ?? undefined,
      partner_id:      project.partner_id ?? undefined,
      is_internal:     project.is_internal ?? false,
      billing_type:    (project.billing_type as BillingType) ?? 'hourly',
      fixed_price:     project.fixed_price ?? '',
      start_date:      project.start_date ? parseISO(project.start_date) : undefined,
      due_date:        project.due_date   ? parseISO(project.due_date)   : undefined,
      status:          project.status,
      priority:        project.priority,
      progress:        project.progress,
      estimated_hours: project.estimated_hours ?? '',
      description:     project.description ?? '',
    },
  })

  const isInternal  = form.watch('is_internal')
  const billingType = form.watch('billing_type')

  useEffect(() => {
    if (!open) return

    supabase.from('workspaces').select('*').order('name')
      .then(({ data }) => setWorkspaces(data ?? []))

    supabase.from('profiles')
      .select('id, full_name, email, avatar_url, role, is_temp_password, onboarding_completed, created_at, updated_at')
      .eq('role', 'client').order('full_name')
      .then(({ data }) => setClients((data as Profile[]) ?? []))

    supabase.from('profiles')
      .select('id, full_name, email, avatar_url, role, is_temp_password, onboarding_completed, created_at, updated_at')
      .eq('role', 'partner').order('full_name')
      .then(({ data }) => setPartners((data as Profile[]) ?? []))

    supabase.from('task_statuses').select('slug, name, color').eq('is_active', true).order('sort_order')
      .then(({ data }) => setStatuses((data as TaskStatus[]) ?? []))

    supabase.from('task_priorities').select('slug, name, color, is_default').eq('is_active', true).order('sort_order')
      .then(({ data }) => setPriorities((data as TaskPriority[]) ?? []))
  }, [open])

  useEffect(() => {
    if (isInternal) {
      form.setValue('billing_type', 'non_billable')
      form.setValue('client_id', undefined)
      form.setValue('partner_id', undefined)
    }
  }, [isInternal])

  async function onSubmit(values: FormValues) {
    setLoading(true)
    try {
      const payload: Record<string, unknown> = {
        name:            values.name,
        workspace_id:    values.workspace_id,
        client_id:       values.is_internal ? null : (values.client_id || null),
        partner_id:      values.is_internal ? null : (values.partner_id || null),
        is_internal:     values.is_internal,
        billing_type:    values.billing_type,
        start_date:      values.start_date ? format(values.start_date, 'yyyy-MM-dd') : null,
        due_date:        values.due_date   ? format(values.due_date,   'yyyy-MM-dd') : null,
        status:          values.status,
        priority:        values.priority,
        progress:        values.progress,
        estimated_hours: values.estimated_hours === '' || values.estimated_hours === undefined
          ? null : Number(values.estimated_hours),
        description:     values.description || null,
        updated_at:      new Date().toISOString(),
      }

      // fixed_price — only super admin can set it
      if (isSuperAdmin) {
        payload.fixed_price = values.billing_type === 'fixed' && values.fixed_price !== '' && values.fixed_price !== undefined
          ? Number(values.fixed_price)
          : null
      }

      const { data, error } = await supabase
        .from('projects')
        .update(payload)
        .eq('id', project.id)
        .select(`
          *,
          workspace:workspaces(*),
          client:profiles!projects_client_id_fkey(id, full_name, email, avatar_url, role, is_temp_password, onboarding_completed, created_at, updated_at),
          partner:profiles!projects_partner_id_fkey(id, full_name, email, avatar_url, role, is_temp_password, onboarding_completed, created_at, updated_at)
        `)
        .single()

      if (error) {
        toast({ title: 'Failed to update project', description: error.message, variant: 'destructive' })
        return
      }

      toast({ title: 'Project updated', description: `"${data.name}" has been updated successfully.` })
      onUpdated?.(data as Project)
      onOpenChange(false)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Project</DialogTitle>
          <DialogDescription>Update the project details below.</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">

            {/* Name */}
            <FormField control={form.control} name="name" render={({ field }) => (
              <FormItem>
                <FormLabel>Project Name *</FormLabel>
                <FormControl><Input placeholder="e.g. Website Redesign" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            {/* Workspace */}
            <FormField control={form.control} name="workspace_id" render={({ field }) => (
              <FormItem>
                <FormLabel>Workspace *</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl><SelectTrigger><SelectValue placeholder="Select a workspace" /></SelectTrigger></FormControl>
                  <SelectContent>
                    {workspaces.map(w => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />

            {/* Internal toggle */}
            <FormField control={form.control} name="is_internal" render={({ field }) => (
              <FormItem className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <FormLabel className="text-sm font-medium">Internal Project</FormLabel>
                  <p className="text-xs text-muted-foreground mt-0.5">No client or billing — internal work only</p>
                </div>
                <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
              </FormItem>
            )} />

            {/* Client + Partner */}
            {!isInternal && (
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="client_id" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Client</FormLabel>
                    <Select onValueChange={v => field.onChange(v === '__none__' ? undefined : v)} value={field.value ?? '__none__'}>
                      <FormControl><SelectTrigger><SelectValue placeholder="No client" /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="__none__">No client</SelectItem>
                        {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )} />

                <FormField control={form.control} name="partner_id" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Partner / Reseller</FormLabel>
                    <Select onValueChange={v => field.onChange(v === '__none__' ? undefined : v)} value={field.value ?? '__none__'}>
                      <FormControl><SelectTrigger><SelectValue placeholder="No partner" /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="__none__">No partner</SelectItem>
                        {partners.map(p => <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )} />
              </div>
            )}

            {/* Billing type */}
            <FormField control={form.control} name="billing_type" render={({ field }) => (
              <FormItem>
                <FormLabel>Billing Type</FormLabel>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {BILLING_TYPES.map(bt => (
                    <button key={bt.value} type="button"
                      disabled={isInternal && bt.value !== 'non_billable'}
                      onClick={() => field.onChange(bt.value)}
                      className={cn(
                        'flex flex-col items-start rounded-lg border p-2.5 text-left transition-colors',
                        field.value === bt.value ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50',
                        isInternal && bt.value !== 'non_billable' && 'opacity-40 cursor-not-allowed'
                      )}>
                      <span className="text-xs font-semibold">{bt.label}</span>
                      <span className="text-xs text-muted-foreground mt-0.5">{bt.description}</span>
                    </button>
                  ))}
                </div>
              </FormItem>
            )} />

            {/* Fixed Price Amount — super admin edits, others see read-only */}
            {billingType === 'fixed' && (
              isSuperAdmin ? (
                <FormField control={form.control} name="fixed_price" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-1.5">
                      <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
                      Fixed Price Amount
                    </FormLabel>
                    <FormControl>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                        <Input type="number" min={0} step={0.01} placeholder="0.00" className="pl-7"
                          {...field} value={field.value ?? ''} />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              ) : (
                <div className="rounded-lg border border-border bg-muted/30 px-4 py-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-sm font-medium">Fixed Price Amount</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Lock className="h-3 w-3" />
                      <span className="text-xs">Admin only</span>
                    </div>
                  </div>
                  <p className="mt-1 text-sm font-semibold">
                    {project.fixed_price != null
                      ? `$${Number(project.fixed_price).toLocaleString('en-AU', { minimumFractionDigits: 2 })}`
                      : <span className="text-muted-foreground font-normal">Not set</span>
                    }
                  </p>
                </div>
              )
            )}

            {/* Status + Priority */}
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="status" render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      {statuses.map(s => (
                        <SelectItem key={s.slug} value={s.slug}>
                          <div className="flex items-center gap-2">
                            <div className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                            {s.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="priority" render={({ field }) => (
                <FormItem>
                  <FormLabel>Priority</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      {priorities.map(p => (
                        <SelectItem key={p.slug} value={p.slug}>
                          <div className="flex items-center gap-2">
                            <div className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                            {p.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            {/* Progress */}
            <FormField control={form.control} name="progress" render={({ field }) => (
              <FormItem>
                <FormLabel>Progress (%)</FormLabel>
                <FormControl>
                  <Input type="number" min={0} max={100} step={1} placeholder="0" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            {/* Dates */}
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="start_date" render={({ field }) => (
                <FormItem>
                  <FormLabel>Start Date</FormLabel>
                  <Popover open={startOpen} onOpenChange={setStartOpen}>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button variant="outline" className={cn('w-full justify-start text-left font-normal', !field.value && 'text-muted-foreground')}>
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {field.value ? format(field.value, 'PPP') : 'Pick a date'}
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={field.value}
                        onSelect={date => { field.onChange(date); setStartOpen(false) }}
                        disabled={date => { const due = form.getValues('due_date'); return due ? date > due : false }}
                        initialFocus />
                    </PopoverContent>
                  </Popover>
                </FormItem>
              )} />

              <FormField control={form.control} name="due_date" render={({ field }) => (
                <FormItem>
                  <FormLabel>Due Date</FormLabel>
                  <Popover open={dueOpen} onOpenChange={setDueOpen}>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button variant="outline" className={cn('w-full justify-start text-left font-normal', !field.value && 'text-muted-foreground')}>
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {field.value ? format(field.value, 'PPP') : 'Pick a date'}
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={field.value}
                        onSelect={date => { field.onChange(date); setDueOpen(false) }}
                        disabled={date => { const start = form.getValues('start_date'); return start ? date < start : false }}
                        initialFocus />
                    </PopoverContent>
                  </Popover>
                </FormItem>
              )} />
            </div>

            {/* Estimated hours */}
            <FormField control={form.control} name="estimated_hours" render={({ field }) => (
              <FormItem>
                <FormLabel>Estimated Hours</FormLabel>
                <FormControl>
                  <Input type="number" min={0} step={0.5} placeholder="e.g. 40" {...field} value={field.value ?? ''} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            {/* Description */}
            <FormField control={form.control} name="description" render={({ field }) => (
              <FormItem>
                <FormLabel>Description</FormLabel>
                <FormControl>
                  <Textarea placeholder="Describe the project goals, scope, and any relevant details…" rows={4}
                    {...field} value={field.value ?? ''} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Cancel</Button>
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
