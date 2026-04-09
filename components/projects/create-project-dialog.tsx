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
  CalendarIcon, Loader2, Plus, Search, Users, Lock, DollarSign, GitBranch,
} from 'lucide-react'
import { format } from 'date-fns'
import { cn, getInitials } from '@/lib/utils'
import Link from 'next/link'

type TaskStatus   = { slug: string; name: string; color: string }
type TaskPriority = { slug: string; name: string; color: string; is_default: boolean }

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
  fixed_price:      z.coerce.number().min(0).optional().or(z.literal('')),
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

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 pt-1">
      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{children}</span>
      <div className="flex-1 h-px bg-border" />
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

  // Hierarchy
  const [managers,       setManagers]       = useState<Profile[]>([])
  const [projectManager, setProjectManager] = useState<string>('')

  // Assign staff
  const [staffList,     setStaffList]     = useState<Profile[]>([])
  const [staffSearch,   setStaffSearch]   = useState('')
  const [selectedStaff, setSelectedStaff] = useState<Set<string>>(new Set())

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '', workspace_id: workspaces.length === 1 ? workspaces[0].id : '',
      client_id: undefined, partner_id: undefined,
      is_internal: false, billing_type: 'hourly',
      status: '', priority: '', description: '', estimated_hours: '', fixed_price: '',
    },
  })

  const isInternal  = form.watch('is_internal')
  const billingType = form.watch('billing_type')

  useEffect(() => {
    if (!open) { setSelectedStaff(new Set()); setStaffSearch(''); setProjectManager(''); return }

    supabase.from('profiles').select('id, full_name, email, avatar_url, role, is_temp_password, onboarding_completed, created_at, updated_at, manager_id')
      .eq('role', 'client').order('full_name')
      .then(({ data }) => setClients((data as Profile[]) ?? []))

    supabase.from('profiles').select('id, full_name, email, avatar_url, role, is_temp_password, onboarding_completed, created_at, updated_at, manager_id')
      .eq('role', 'partner').order('full_name')
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

    supabase.from('profiles')
      .select('id, full_name, email, avatar_url, role, is_temp_password, onboarding_completed, created_at, updated_at, manager_id')
      .in('role', ['super_admin', 'account_manager', 'project_manager'])
      .order('full_name')
      .then(({ data }) => setManagers((data as Profile[]) ?? []))

    supabase.from('profiles')
      .select('id, full_name, email, avatar_url, role, is_temp_password, onboarding_completed, created_at, updated_at, manager_id')
      .eq('role', 'staff').order('full_name')
      .then(({ data }) => setStaffList((data as Profile[]) ?? []))
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

  const staffByManager = staffList.reduce<Record<string, Profile[]>>((acc, s) => {
    const key = s.manager_id ?? '__none__'
    if (!acc[key]) acc[key] = []
    acc[key].push(s)
    return acc
  }, {})

  const filteredStaff = staffList.filter(s =>
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
        fixed_price: values.billing_type === 'fixed' && isSuperAdmin && values.fixed_price !== '' && values.fixed_price !== undefined ? Number(values.fixed_price) : null,
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
      if (memberInserts.length > 0) await supabase.from('project_members').insert(memberInserts)

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
            <SectionLabel>Status & Priority</SectionLabel>

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

            {/* ── Timeline ── */}
            <SectionLabel>Timeline</SectionLabel>

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

            {/* ── Client & Billing ── */}
            <SectionLabel>Client & Billing</SectionLabel>

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
                    <Select onValueChange={v => field.onChange(v === '__none__' ? undefined : v)} defaultValue={field.value ?? '__none__'}>
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
                    <Select onValueChange={v => field.onChange(v === '__none__' ? undefined : v)} defaultValue={field.value ?? '__none__'}>
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

            {billingType === 'fixed' && (
              <div className="rounded-lg border border-border p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Fixed Price Amount</span>
                  {!isSuperAdmin && (
                    <span className="ml-auto flex items-center gap-1 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
                      <Lock className="h-3 w-3" />Super admin only
                    </span>
                  )}
                </div>
                {isSuperAdmin ? (
                  <FormField control={form.control} name="fixed_price" render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                          <Input type="number" min={0} step={0.01} placeholder="0.00" className="pl-7" {...field} value={field.value ?? ''} />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                ) : (
                  <div className="flex items-center gap-2 rounded-md bg-muted/50 border border-dashed border-border px-3 py-2.5">
                    <Lock className="h-4 w-4 text-muted-foreground shrink-0" />
                    <p className="text-sm text-muted-foreground">Pricing is set by the super admin. Contact your administrator.</p>
                  </div>
                )}
              </div>
            )}

            {/* ── Team ── */}
            <SectionLabel>Team</SectionLabel>

            <div>
              <label className="text-sm font-medium mb-1.5 block">
                Project Manager <span className="text-xs text-muted-foreground font-normal">(lead)</span>
              </label>
              <Select value={projectManager} onValueChange={setProjectManager}>
                <SelectTrigger>
                  <SelectValue placeholder="Select project manager…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">No project manager</SelectItem>
                  {managers.map(m => (
                    <SelectItem key={m.id} value={m.id}>
                      <div className="flex items-center gap-2">
                        <div className="h-5 w-5 shrink-0 rounded-full bg-blue-100 flex items-center justify-center text-[9px] font-bold text-blue-700">
                          {getInitials(m.full_name)}
                        </div>
                        <span>{m.full_name}</span>
                        <span className="text-xs text-muted-foreground capitalize">{m.role.replace('_', ' ')}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Assign Team Members</span>
                {selectedStaff.size > 0 && (
                  <span className="ml-auto text-xs text-blue-600 font-medium">{selectedStaff.size} selected</span>
                )}
              </div>
              <div className="rounded-lg border border-border">
                <div className="p-2 border-b">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/70" />
                    <Input placeholder="Search staff…" value={staffSearch} onChange={e => setStaffSearch(e.target.value)} className="pl-8 h-8 text-sm" />
                  </div>
                </div>

                {staffList.length === 0 ? (
                  <div className="py-5 text-center text-sm text-muted-foreground">No staff members found</div>
                ) : (
                  <ScrollArea className="h-44">
                    {showGrouped ? (
                      <div className="p-1">
                        {Object.entries(staffByManager).map(([managerId, members]) => {
                          const manager = managerId === '__none__' ? null : managers.find(m => m.id === managerId) ?? staffList.find(m => m.id === managerId)
                          return (
                            <div key={managerId}>
                              <div className="flex items-center gap-1.5 px-2 py-1 mt-1">
                                <GitBranch className="h-3 w-3 text-muted-foreground/60 shrink-0" />
                                <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                                  {manager ? `Reports to: ${manager.full_name}` : 'No manager assigned'}
                                </span>
                              </div>
                              {members.map(staff => (
                                <label key={staff.id} className="flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 pl-6 hover:bg-muted/50 transition-colors">
                                  <Checkbox checked={selectedStaff.has(staff.id)} onCheckedChange={() => toggleStaff(staff.id)} />
                                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-[10px] font-semibold text-blue-700">
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
                          <li className="py-4 text-center text-sm text-muted-foreground">No staff match your search</li>
                        ) : filteredStaff.map(staff => (
                          <li key={staff.id}>
                            <label className="flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 hover:bg-muted/50 transition-colors">
                              <Checkbox checked={selectedStaff.has(staff.id)} onCheckedChange={() => toggleStaff(staff.id)} />
                              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-[10px] font-semibold text-blue-700">
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
              </div>
            </div>

            {/* ── Description ── */}
            <SectionLabel>Description</SectionLabel>

            <FormField control={form.control} name="description" render={({ field }) => (
              <FormItem>
                <FormControl>
                  <Textarea placeholder="Describe the project goals, scope, and any relevant details…" rows={3} {...field} value={field.value ?? ''} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

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
