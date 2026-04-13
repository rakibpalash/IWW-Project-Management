'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/client'
import { List, Space, Profile, BillingType } from '@/types'
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
import { Checkbox } from '@/components/ui/checkbox'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { CalendarIcon, DollarSign, GitBranch, Loader2, Lock, Search, Users } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { cn, getInitials } from '@/lib/utils'

type TaskStatus   = { slug: string; name: string; color: string }
type TaskPriority = { slug: string; name: string; color: string; is_default: boolean }

const BILLING_TYPES: { value: BillingType; label: string; description: string }[] = [
  { value: 'hourly',       label: 'Hourly',      description: 'Billed by hours worked' },
  { value: 'fixed',        label: 'Fixed Price',  description: 'Fixed project cost' },
  { value: 'retainer',     label: 'Retainer',     description: 'Monthly retainer fee' },
  { value: 'non_billable', label: 'Non-Billable', description: 'Internal / no billing' },
]

const AVATAR_COLORS = [
  'bg-rose-400', 'bg-pink-400', 'bg-fuchsia-400', 'bg-purple-400',
  'bg-violet-400', 'bg-blue-400', 'bg-cyan-400', 'bg-teal-400',
  'bg-emerald-400', 'bg-green-400', 'bg-amber-400', 'bg-orange-400',
]
function avatarColor(id: string) {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return AVATAR_COLORS[h % AVATAR_COLORS.length]
}

const formSchema = z.object({
  name:            z.string().min(1, 'Project name is required').max(255),
  space_id:    z.string().min(1, 'Workspace is required'),
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
  project:       List
  isSuperAdmin?: boolean
  onUpdated?:    (project: List) => void
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
  const [workspaces, setWorkspaces] = useState<Space[]>([])
  const [statuses,   setStatuses]   = useState<TaskStatus[]>([])
  const [priorities, setPriorities] = useState<TaskPriority[]>([])
  const [startOpen,  setStartOpen]  = useState(false)
  const [dueOpen,    setDueOpen]    = useState(false)

  // Team assignment
  const [allUsers,       setAllUsers]       = useState<Profile[]>([])
  const [projectManager, setProjectManager] = useState<string>('')
  const [pmSearch,       setPmSearch]       = useState('')
  const [staffSearch,    setStaffSearch]    = useState('')
  const [selectedStaff,  setSelectedStaff]  = useState<Set<string>>(new Set())
  // Track existing member record IDs so we can delete removed ones
  const [existingMembers, setExistingMembers] = useState<{ id: string; user_id: string; project_role: string }[]>([])

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name:            project.name,
      space_id:    project.space_id,
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

    supabase.from('spaces').select('*').order('name')
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

    // Load all internal users
    const baseSelect = 'id, full_name, email, avatar_url, role, is_temp_password, onboarding_completed, created_at, updated_at'
    supabase.from('profiles')
      .select(`${baseSelect}, manager_id`)
      .order('full_name')
      .then(({ data, error }) => {
        if (error || !data) {
          supabase.from('profiles').select(baseSelect).order('full_name')
            .then(({ data: fallback }) => setAllUsers((fallback as Profile[]) ?? []))
        } else {
          setAllUsers((data as Profile[]) ?? [])
        }
      })

    // Load existing project members
    supabase.from('list_members')
      .select('id, user_id, project_role')
      .eq('list_id', project.id)
      .then(({ data }) => {
        if (!data) return
        setExistingMembers(data)
        const lead = data.find(m => m.project_role === 'lead')
        const members = data.filter(m => m.project_role === 'member').map(m => m.user_id)
        setProjectManager(lead?.user_id ?? '')
        setSelectedStaff(new Set(members))
      })
  }, [open])

  useEffect(() => {
    if (isInternal) {
      form.setValue('billing_type', 'non_billable')
      form.setValue('client_id', undefined)
      form.setValue('partner_id', undefined)
    }
  }, [isInternal])

  function toggleStaff(id: string) {
    setSelectedStaff(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  // PM candidates — exclude client/partner
  const filteredPm = allUsers.filter(u =>
    u.role !== 'client' && u.role !== 'partner' && (
      u.full_name.toLowerCase().includes(pmSearch.toLowerCase()) ||
      u.email.toLowerCase().includes(pmSearch.toLowerCase())
    )
  )
  const selectedPmUser = allUsers.find(u => u.id === projectManager)

  // Staff candidates — exclude PM
  const teamCandidates = allUsers.filter(u => u.role === 'staff' && u.id !== projectManager)

  const staffByManager = teamCandidates.reduce<Record<string, Profile[]>>((acc, s) => {
    const key = s.manager_id ?? '__none__'
    if (!acc[key]) acc[key] = []
    acc[key].push(s)
    return acc
  }, {})

  const filteredStaff = teamCandidates.filter(s =>
    s.full_name.toLowerCase().includes(staffSearch.toLowerCase()) ||
    s.email.toLowerCase().includes(staffSearch.toLowerCase())
  )
  const showGrouped = !staffSearch.trim()

  async function onSubmit(values: FormValues) {
    setLoading(true)
    try {
      const payload: Record<string, unknown> = {
        name:            values.name,
        space_id:    values.space_id,
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
        .from('lists')
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

      // ── Sync team members ──────────────────────────────────────────────────
      // Build desired state
      const desired: { user_id: string; project_role: 'lead' | 'member' }[] = []
      if (projectManager) desired.push({ user_id: projectManager, project_role: 'lead' })
      selectedStaff.forEach(uid => {
        if (uid !== projectManager) desired.push({ user_id: uid, project_role: 'member' })
      })

      // Remove members that are no longer desired
      const desiredIds = new Set(desired.map(d => d.user_id))
      const toRemove = existingMembers.filter(m => !desiredIds.has(m.user_id)).map(m => m.id)
      if (toRemove.length > 0) {
        await supabase.from('list_members').delete().in('id', toRemove)
      }

      // Add new members not already in existingMembers
      const existingUserIds = new Set(existingMembers.map(m => m.user_id))
      const toAdd = desired.filter(d => !existingUserIds.has(d.user_id))
        .map(d => ({ list_id: project.id, user_id: d.user_id, project_role: d.project_role }))
      if (toAdd.length > 0) {
        await supabase.from('list_members').insert(toAdd)
      }

      // Update role if existing lead changed
      const existingLead = existingMembers.find(m => m.project_role === 'lead')
      if (existingLead && projectManager && existingLead.user_id !== projectManager && existingUserIds.has(projectManager)) {
        await supabase.from('list_members')
          .update({ project_role: 'lead' })
          .eq('list_id', project.id)
          .eq('user_id', projectManager)
      }
      // Demote old lead to member if they're now in selectedStaff
      if (existingLead && existingLead.user_id !== projectManager && selectedStaff.has(existingLead.user_id) && existingUserIds.has(existingLead.user_id)) {
        await supabase.from('list_members')
          .update({ project_role: 'member' })
          .eq('id', existingLead.id)
      }

      toast({ title: 'List updated', description: `"${data.name}" has been updated successfully.` })
      onUpdated?.(data as List)
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
                <FormLabel>List Name *</FormLabel>
                <FormControl><Input placeholder="e.g. Website Redesign" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            {/* Workspace */}
            <FormField control={form.control} name="space_id" render={({ field }) => (
              <FormItem>
                <FormLabel>Space *</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl><SelectTrigger><SelectValue placeholder="Select a space" /></SelectTrigger></FormControl>
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

            {/* ── Team Assignment ── */}
            <div className="border-t border-border pt-4 space-y-4">
              <p className="text-sm font-semibold">Team</p>

              {/* Project Manager */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium">
                  Project Manager <span className="text-xs text-muted-foreground font-normal">(lead)</span>
                </label>

                {selectedPmUser && (
                  <div className="flex items-center gap-2 rounded-lg border border-primary/40 bg-primary/5 px-3 py-2">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-100 text-[10px] font-bold text-blue-700">
                      {getInitials(selectedPmUser.full_name)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{selectedPmUser.full_name}</p>
                      <p className="truncate text-xs text-muted-foreground capitalize">{selectedPmUser.role.replace(/_/g, ' ')}</p>
                    </div>
                    <button type="button" onClick={() => setProjectManager('')}
                      className="text-xs text-muted-foreground hover:text-destructive transition-colors px-1">
                      Remove
                    </button>
                  </div>
                )}

                <div className="rounded-lg border border-border">
                  <div className="p-2 border-b">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/70" />
                      <Input placeholder="Search for project manager…" value={pmSearch}
                        onChange={e => setPmSearch(e.target.value)} className="pl-8 h-8 text-sm" />
                    </div>
                  </div>
                  {allUsers.length === 0 ? (
                    <div className="py-4 text-center text-sm text-muted-foreground">No users found</div>
                  ) : (
                    <ScrollArea className="h-36">
                      <ul className="p-1">
                        {filteredPm.map(u => (
                          <li key={u.id}>
                            <button type="button" onClick={() => { setProjectManager(u.id); setPmSearch('') }}
                              className={cn(
                                'flex w-full items-center gap-3 rounded-md px-3 py-2 text-left transition-colors',
                                projectManager === u.id ? 'bg-primary/10 border border-primary/30' : 'hover:bg-muted/50'
                              )}>
                              <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white', avatarColor(u.id))}>
                                {getInitials(u.full_name)}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-medium">{u.full_name}</p>
                                <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                              </div>
                              <span className="shrink-0 text-[10px] text-muted-foreground capitalize bg-muted rounded px-1.5 py-0.5">
                                {u.role.replace(/_/g, ' ')}
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    </ScrollArea>
                  )}
                </div>
              </div>

              {/* Assign Team Members */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Assign Team Members</span>
                </div>
                <div className="rounded-lg border border-border">
                  <div className="p-2 border-b">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/70" />
                      <Input placeholder="Search staffs…" value={staffSearch}
                        onChange={e => setStaffSearch(e.target.value)} className="pl-8 h-8 text-sm bg-background" />
                    </div>
                  </div>

                  {allUsers.length === 0 ? (
                    <div className="py-5 text-center text-sm text-muted-foreground">No users found</div>
                  ) : teamCandidates.length === 0 ? (
                    <div className="py-5 text-center text-sm text-muted-foreground">No other members to assign</div>
                  ) : (
                    <ScrollArea className="h-52">
                      {showGrouped ? (
                        <div className="p-1">
                          {Object.entries(staffByManager).map(([managerId, members]) => {
                            const manager = managerId === '__none__' ? null : allUsers.find(m => m.id === managerId)
                            return (
                              <div key={managerId}>
                                <div className="flex items-center gap-1.5 px-3 py-1.5 mt-1">
                                  <GitBranch className="h-3 w-3 text-muted-foreground/60 shrink-0" />
                                  <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                                    {manager ? `Reports to: ${manager.full_name}` : 'No manager assigned'}
                                  </span>
                                </div>
                                {members.map(staff => (
                                  <label key={staff.id} className="flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 hover:bg-muted/50 transition-colors">
                                    <Checkbox checked={selectedStaff.has(staff.id)} onCheckedChange={() => toggleStaff(staff.id)} />
                                    <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white', avatarColor(staff.id))}>
                                      {getInitials(staff.full_name)}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <p className="truncate text-sm font-medium">{staff.full_name}</p>
                                      <p className="truncate text-xs text-muted-foreground">{staff.email}</p>
                                    </div>
                                  </label>
                                ))}
                              </div>
                            )
                          })}
                        </div>
                      ) : (
                        <ul className="p-1">
                          {filteredStaff.length === 0 ? (
                            <li className="py-4 text-center text-sm text-muted-foreground">No members match your search</li>
                          ) : filteredStaff.map(staff => (
                            <li key={staff.id}>
                              <label className="flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 hover:bg-muted/50 transition-colors">
                                <Checkbox checked={selectedStaff.has(staff.id)} onCheckedChange={() => toggleStaff(staff.id)} />
                                <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white', avatarColor(staff.id))}>
                                  {getInitials(staff.full_name)}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-sm font-medium">{staff.full_name}</p>
                                  <p className="truncate text-xs text-muted-foreground">{staff.email}</p>
                                </div>
                              </label>
                            </li>
                          ))}
                        </ul>
                      )}
                    </ScrollArea>
                  )}

                  <div className="border-t px-3 py-2">
                    <p className="text-xs text-muted-foreground">
                      {selectedStaff.size} member{selectedStaff.size !== 1 ? 's' : ''} selected
                    </p>
                  </div>
                </div>
              </div>
            </div>

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
