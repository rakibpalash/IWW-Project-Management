'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/client'
import { Project, Workspace, Profile } from '@/types'
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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { CalendarIcon, Loader2 } from 'lucide-react'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import { PRIORITIES } from '@/lib/constants'

type TaskStatus = { slug: string; name: string; color: string }

const formSchema = z.object({
  name: z.string().min(1, 'Project name is required').max(255),
  workspace_id: z.string().min(1, 'Workspace is required'),
  client_id: z.string().optional(),
  start_date: z.date().optional(),
  due_date: z.date().optional(),
  status: z.string().min(1),
  priority: z.enum(['low', 'medium', 'high', 'urgent']),
  estimated_hours: z.coerce.number().min(0).optional().or(z.literal('')),
  description: z.string().max(2000).optional(),
})

type FormValues = z.infer<typeof formSchema>

interface CreateProjectDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  workspaces: Workspace[]
  onCreated?: (project: Project) => void
}

export function CreateProjectDialog({
  open,
  onOpenChange,
  workspaces,
  onCreated,
}: CreateProjectDialogProps) {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [clients, setClients] = useState<Profile[]>([])
  const [statuses, setStatuses] = useState<TaskStatus[]>([])
  const [startOpen, setStartOpen] = useState(false)
  const [dueOpen, setDueOpen] = useState(false)

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      workspace_id: '',
      client_id: undefined,
      status: '',
      priority: 'medium',
      description: '',
      estimated_hours: '',
    },
  })

  useEffect(() => {
    if (!open) return

    supabase
      .from('profiles')
      .select('id, full_name, email, avatar_url, role, is_temp_password, onboarding_completed, created_at, updated_at')
      .eq('role', 'client')
      .order('full_name')
      .then(({ data }) => setClients((data as Profile[]) ?? []))

    supabase
      .from('task_statuses')
      .select('slug, name, color')
      .eq('is_active', true)
      .order('sort_order')
      .then(({ data }) => {
        const list = (data as TaskStatus[]) ?? []
        setStatuses(list)
        // Set default status to first active status
        if (list.length > 0 && !form.getValues('status')) {
          form.setValue('status', list[0].slug)
        }
      })
  }, [open])

  async function onSubmit(values: FormValues) {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        toast({ title: 'Not authenticated', variant: 'destructive' })
        return
      }

      const payload: Record<string, unknown> = {
        name: values.name,
        workspace_id: values.workspace_id,
        client_id: values.client_id || null,
        start_date: values.start_date ? format(values.start_date, 'yyyy-MM-dd') : null,
        due_date: values.due_date ? format(values.due_date, 'yyyy-MM-dd') : null,
        status: values.status,
        priority: values.priority,
        estimated_hours:
          values.estimated_hours === '' || values.estimated_hours === undefined
            ? null
            : Number(values.estimated_hours),
        description: values.description || null,
        progress: 0,
        created_by: user.id,
      }

      const { data, error } = await supabase
        .from('projects')
        .insert(payload)
        .select(`
          *,
          workspace:workspaces(*),
          client:profiles!projects_client_id_fkey(id, full_name, email, avatar_url, role, is_temp_password, onboarding_completed, created_at, updated_at)
        `)
        .single()

      if (error) {
        toast({ title: 'Failed to create project', description: error.message, variant: 'destructive' })
        return
      }

      toast({ title: 'Project created', description: `"${data.name}" has been created successfully.` })
      onCreated?.(data as Project)
      form.reset()
      onOpenChange(false)
      router.push(`/projects/${data.id}`)
    } finally {
      setLoading(false)
    }
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
            {/* Name */}
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Project Name *</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Website Redesign" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Workspace */}
            <FormField
              control={form.control}
              name="workspace_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Workspace *</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a workspace" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {workspaces.map((w) => (
                        <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Client */}
            <FormField
              control={form.control}
              name="client_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Client</FormLabel>
                  <Select
                    onValueChange={(v) => field.onChange(v === '__none__' ? undefined : v)}
                    defaultValue={field.value ?? '__none__'}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="No client assigned" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="__none__">No client</SelectItem>
                      {clients.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.full_name} ({c.email})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Status + Priority */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {statuses.map((s) => (
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
                )}
              />

              <FormField
                control={form.control}
                name="priority"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Priority</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {PRIORITIES.map((p) => (
                          <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Start date + Due date */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="start_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Start Date</FormLabel>
                    <Popover open={startOpen} onOpenChange={setStartOpen}>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn('w-full justify-start text-left font-normal', !field.value && 'text-muted-foreground')}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {field.value ? format(field.value, 'PPP') : 'Pick a date'}
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={(date) => { field.onChange(date); setStartOpen(false) }}
                          disabled={(date) => {
                            const due = form.getValues('due_date')
                            return due ? date > due : false
                          }}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="due_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Due Date</FormLabel>
                    <Popover open={dueOpen} onOpenChange={setDueOpen}>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn('w-full justify-start text-left font-normal', !field.value && 'text-muted-foreground')}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {field.value ? format(field.value, 'PPP') : 'Pick a date'}
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={(date) => { field.onChange(date); setDueOpen(false) }}
                          disabled={(date) => {
                            const start = form.getValues('start_date')
                            return start ? date < start : false
                          }}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Estimated hours */}
            <FormField
              control={form.control}
              name="estimated_hours"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Estimated Hours</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={0}
                      step={0.5}
                      placeholder="e.g. 40"
                      {...field}
                      value={field.value ?? ''}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Description */}
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Describe the project goals, scope, and any relevant details…"
                      rows={4}
                      {...field}
                      value={field.value ?? ''}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
                Cancel
              </Button>
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
