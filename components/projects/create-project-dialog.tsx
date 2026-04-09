'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/client'
import { Project, Workspace, Profile, BillingType } from '@/types'
import { toast } from '@/components/ui/use-toast'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from '@/components/ui/form'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import {
  CalendarIcon, Loader2, Plus, Search, Users, GitBranch, ChevronDown,
} from 'lucide-react'
import { format } from 'date-fns'
import { cn, getInitials } from '@/lib/utils'
import Link from 'next/link'

type TaskStatus   = { slug: string; name: string; color: string }
type TaskPriority = { slug: string; name: string; color: string; is_default: boolean }

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

const BILLING_TYPES: { value: BillingType; label: string; description: string }[] = [
  { value: 'hourly',       label: 'Hourly',      description: 'Billed by hours worked' },
  { value: 'fixed',        label: 'Fixed Price',  description: 'Fixed project cost' },
  { value: 'retainer',     label: 'Retainer',     description: 'Monthly retainer fee' },
  { value: 'non_billable', label: 'Non-Billable', description: 'Internal / no billing' },
]

const formSchema = z.object({
  name:             z.string().min(1, 'Project name is required').max(255),
  workspace_id:     z.string().min(1, 'Workspace is required'),
  client_id:        z.string().optional(),
  partner_id:       z.string().optional(),
  is_internal:      z.boolean().default(false),
  billing_type:     z.enum(['hourly', 'fixed', 'retainer', 'non_billable']).default('hourly'),
  start_date:       z.date().optional(),
  due_date:         z.date().optional(),
  status:           z.string().min(1),
  priority:         z.string().min(1),
  estimated_hours:  z.coerce.number().min(0).optional().or(z.literal('')),
  description:      z.string().max(2000).optional(),
})

type FormValues = z.infer<typeof formSchema>

interface CreateProjectDialogProps {
  open:          boolean
  onOpenChange:  (open: boolean) => void
  workspaces:    Workspace[]
  onCreated?:    (project: Project) => void
  profile?:      Profile
}

function Section({
  label, defaultOpen = true, children,
}: {
  label: string; defaultOpen?: boolean; children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border-t border-border pt-3">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex w-full items-center gap-1.5 mb-3 group"
      >
        <ChevronDown
          className={cn(
            'h-4 w-4 text-muted-foreground transition-transform duration-200',
            !open && '-rotate-90'
          )}
        />
        <span className="text-sm font-semibold text-foreground group-hover:text-foreground/80 transition-colors">
          {label}
        </span>
      </button>
      {open && <div className="space-y-4 pl-1">{children}</div>}
    </div>
  )
}

export function CreateProjectDialog({
  open, onOpenChange, workspaces, onCreated, profile,
}: CreateProjectDialogProps) {
  const router   = useRouter()
  const supabase = createClient()
  const isSuperAdmin = profile?.role === 'super_admin'

  const [loading,    setLoading]    = useState(false)
  const [clients,    setClients]    = useState<Profile[]>([])
  const [partners,   setPartners]   = useState<Profile[]>([])
  const [statuses,   setStatuses]   = useState<TaskStatus[]>([])
  const [priorities, setPriorities] = useState<TaskPriority[]>([])
  const [startOpen,  setStartOpen]  = useState(false)
  const [dueOpen,    setDueOpen]    = useState(false)

  // All internal users (everyone except client/partner)
  const [allUsers,       setAllUsers]       = useState<Profile[]>([])
  const [projectManager, setProjectManager] = useState<string>('')
  const [pmSearch,       setPmSearch]       = useState('')

  // Assign staff
  const [staffSearch,   setStaffSearch]   = useState('')
  const [selectedStaff, setSelectedStaff] = useState<Set<string>>(new Set())

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '', workspace_id: workspaces.length === 1 ? workspaces[0].id : '',
      client_id: undefined, partner_id: undefined,
      is_internal: false, billing_type: 'hourly',
      status: '', priority: '', description: '', estimated_hours: '',
    },
  })

  const isInternal  = form.watch('is_internal')
  const billingType = form.watch('billing_type')

  useEffect(() => {
    if (!open) {
      setSelectedStaff(new Set()); setStaffSearch(''); setPmSearch(''); setProjectManager('')
      form.reset({
        name: '', workspace_id: workspaces.length === 1 ? workspaces[0].id : '',
        client_id: undefined, partner_id: undefined,
        is_internal: false, billing_type: 'hourly',
        status: '', priority: '', description: '', estimated_hours: '',
      })
      return
    }

    const baseSelect = 'id, full_name, email, avatar_url, role, is_temp_password, onboarding_completed, created_at, updated_at'

    // Clients — only role='client'
    supabase.from('profiles').select(baseSelect).eq('role', 'client').order('full_name')
      .then(({ data }) => setClients((data as Profile[]) ?? []))

    // Partners — only role='partner'
    supabase.from('profiles').select(baseSelect).eq('role', 'partner').order('full_name')
      .then(({ data }) => setPartners((data as Profile[]) ?? []))

    supabase.from('task_statuses').select('slug, name, color').eq('is_active', true).order('sort_order')
      .then(({ data }) => {
        const list = (data as TaskStatus[]) ?? []
        setStatuses(list)
        if (list.length > 0 && !form.getValues('status')) form.setValue('status', list[0].slug)
      })

    supabase.from('task_priorities').select('slug, name, color, is_default').eq('is_active', true).order('sort_order')
      .then(({ data }) => {
        const list = (data as TaskPriority[]) ?? []
        setPriorities(list)
        if (list.length > 0 && !form.getValues('priority')) {
          const def = list.find(p => p.is_default) ?? list[0]
          form.setValue('priority', def.slug)
        }
      })

    // Try with manager_id first (needs migration), fall back to base fields
    supabase.from('profiles')
      .select(`${baseSelect}, manager_id`)
      .order('full_name')
      .then(({ data, error }) => {
        if (error || !data) {
          // manager_id column not yet available — fetch without it
          supabase.from('profiles').select(baseSelect).order('full_name')
            .then(({ data: fallback }) => setAllUsers((fallback as Profile[]) ?? []))
        } else {
          setAllUsers((data as Profile[]) ?? [])
        }
      })
  }, [open])

  useEffect(() => {
    if (isInternal) {
      form.setValue('billing_type', 'non_billable')
      form.setValue('client_id', undefined)
      form.setValue('partner_id', undefined)
    } else {
      // Restore billing type when Internal is toggled off
      if (form.getValues('billing_type') === 'non_billable') {
        form.setValue('billing_type', 'hourly')
      }
    }
  }, [isInternal])

  function toggleStaff(id: string) {
    setSelectedStaff(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  // Users available as project manager (anyone internal)
  const filteredPm = allUsers.filter(u =>
    u.full_name.toLowerCase().includes(pmSearch.toLowerCase()) ||
    u.email.toLowerCase().includes(pmSearch.toLowerCase())
  )
  const selectedPmUser = allUsers.find(u => u.id === projectManager)

  // Team members = all internal users, grouped by manager, excluding selected PM
  const teamCandidates = allUsers.filter(u => u.id !== projectManager)

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
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { toast({ title: 'Not authenticated', variant: 'destructive' }); return }

      const { data, error } = await supabase.from('projects').insert({
        name: values.name,
        workspace_id: values.workspace_id,
        client_id: values.is_internal ? null : (values.client_id || null),
        partner_id: values.is_internal ? null : (values.partner_id || null),
        is_internal: values.is_internal,
        billing_type: values.billing_type,
        start_date: values.start_date ? format(values.start_date, 'yyyy-MM-dd') : null,
        due_date: values.due_date ? format(values.due_date, 'yyyy-MM-dd') : null,
        status: values.status,
        priority: values.priority,
        estimated_hours: values.estimated_hours === '' || values.estimated_hours === undefined ? null : Number(values.estimated_hours),
        description: values.description || null,
        progress: 0,
        created_by: user.id,
      }).select(`*, workspace:workspaces(*), client:profiles!projects_client_id_fkey(id, full_name, email, avatar_url, role, is_temp_password, onboarding_completed, created_at, updated_at), partner:profiles!projects_partner_id_fkey(id, full_name, email, avatar_url, role, is_temp_password, onboarding_completed, created_at, updated_at)`).single()

      if (error) { toast({ title: 'Failed to create project', description: error.message, variant: 'destructive' }); return }

      const memberInserts: { project_id: string; user_id: string; project_role: 'lead' | 'member' }[] = []
      if (projectManager) memberInserts.push({ project_id: data.id, user_id: projectManager, project_role: 'lead' })
      selectedStaff.forEach(uid => {
        if (uid !== projectManager) memberInserts.push({ project_id: data.id, user_id: uid, project_role: 'member' })
      })
      if (memberInserts.length > 0) {
        const { error: memberError } = await supabase.from('project_members').insert(memberInserts)
        if (memberError) {
          toast({ title: 'Project created', description: `"${data.name}" created, but some team members could not be assigned.`, variant: 'destructive' })
          onCreated?.(data as Project)
          form.reset()
          onOpenChange(false)
          router.push(`/projects/${data.id}`)
          return
        }
      }

      toast({ title: 'Project created', description: `"${data.name}" has been created successfully.` })
      onCreated?.(data as Project)
      form.reset()
      onOpenChange(false)
      router.push(`/projects/${data.id}`)
    } finally { setLoading(false) }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Project</DialogTitle>
          <DialogDescription>Fill in the details below to create a new project.</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">

            {/* Project Name + Workspace */}
            <FormField control={form.control} name="name" render={({ field }) => (
              <FormItem>
                <FormLabel>Project Name *</FormLabel>
                <FormControl><Input placeholder="e.g. Website Redesign" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

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

            {/* ── Status & Priority ── */}
            <Section label="Status & Priority">
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="status" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger></FormControl>
                      <SelectContent>
                        {statuses.map(s => (
                          <SelectItem key={s.slug} value={s.slug}>
                            <div className="flex items-center gap-2">
                              <div className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                              {s.name}
                            </div>
                          </SelectItem>
                        ))}
                        <div className="border-t mt-1 pt-1">
                          <Link href="/settings?tab=statuses" onClick={() => onOpenChange(false)}
                            className="flex items-center gap-1.5 px-2 py-1.5 text-xs text-blue-600 hover:bg-blue-50 rounded w-full">
                            <Plus className="h-3 w-3" />Create new status
                          </Link>
                        </div>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="priority" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Priority</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Select priority" /></SelectTrigger></FormControl>
                      <SelectContent>
                        {priorities.map(p => (
                          <SelectItem key={p.slug} value={p.slug}>
                            <div className="flex items-center gap-2">
                              <div className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                              {p.name}
                            </div>
                          </SelectItem>
                        ))}
                        <div className="border-t mt-1 pt-1">
                          <Link href="/settings?tab=priorities" onClick={() => onOpenChange(false)}
                            className="flex items-center gap-1.5 px-2 py-1.5 text-xs text-blue-600 hover:bg-blue-50 rounded w-full">
                            <Plus className="h-3 w-3" />Create new priority
                          </Link>
                        </div>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
            </Section>

            {/* ── Timeline ── */}
            <Section label="Timeline">
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

              <FormField control={form.control} name="estimated_hours" render={({ field }) => (
                <FormItem>
                  <FormLabel>Estimated Hours</FormLabel>
                  <FormControl>
                    <Input type="number" min={0} step={0.5} placeholder="e.g. 40" {...field} value={field.value ?? ''} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </Section>

            {/* ── Client & Billing ── */}
            <Section label="Client & Billing" defaultOpen={false}>
              <FormField control={form.control} name="is_internal" render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <FormLabel className="text-sm font-medium">Internal Project</FormLabel>
                    <p className="text-xs text-muted-foreground mt-0.5">No client or billing — internal work only</p>
                  </div>
                  <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                </FormItem>
              )} />

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

            </Section>

            {/* ── Team ── */}
            <Section label="Team">
              {/* Project Manager — searchable picker */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium">
                  Project Manager <span className="text-xs text-muted-foreground font-normal">(lead)</span>
                </label>

                {selectedPmUser && (
                  <div className="flex items-center gap-2 rounded-lg border border-primary/40 bg-primary/5 px-3 py-2">
                    <div className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white', avatarColor(selectedPmUser.id))}>
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
                      <Input placeholder="Search for project manager…" value={pmSearch} onChange={e => setPmSearch(e.target.value)} className="pl-8 h-8 text-sm" />
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
                      <Input placeholder="Search staffs…" value={staffSearch} onChange={e => setStaffSearch(e.target.value)} className="pl-8 h-8 text-sm bg-background" />
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

                  {/* Selected counter */}
                  <div className="border-t px-3 py-2">
                    <p className="text-xs text-muted-foreground">
                      {selectedStaff.size} member{selectedStaff.size !== 1 ? 's' : ''} selected in total
                    </p>
                  </div>
                </div>
              </div>
            </Section>

            {/* ── Description ── */}
            <Section label="Description" defaultOpen={false}>
              <FormField control={form.control} name="description" render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Textarea placeholder="Describe the project goals, scope, and any relevant details…" rows={3} {...field} value={field.value ?? ''} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </Section>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Cancel</Button>
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Project
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
