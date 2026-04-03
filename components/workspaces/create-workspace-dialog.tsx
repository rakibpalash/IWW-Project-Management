'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
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
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useToast } from '@/components/ui/use-toast'
import { createClient } from '@/lib/supabase/client'
import { Profile } from '@/types'
import { Search, Users, Loader2 } from 'lucide-react'
import { getInitials } from '@/lib/utils'

const formSchema = z.object({
  name: z
    .string()
    .min(1, 'Workspace name is required')
    .max(100, 'Name must be 100 characters or less')
    .trim(),
  description: z.string().max(500, 'Description must be 500 characters or less').optional(),
})

type FormValues = z.infer<typeof formSchema>

interface CreateWorkspaceDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function CreateWorkspaceDialog({
  open,
  onOpenChange,
  onSuccess,
}: CreateWorkspaceDialogProps) {
  const { toast } = useToast()
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Staff picker state
  const [staffList, setStaffList] = useState<Profile[]>([])
  const [staffLoading, setStaffLoading] = useState(false)
  const [staffSearch, setStaffSearch] = useState('')
  const [selectedStaff, setSelectedStaff] = useState<Set<string>>(new Set())

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: '', description: '' },
  })

  // Load staff list when dialog opens
  useEffect(() => {
    if (!open) return
    setStaffSearch('')
    setSelectedStaff(new Set())

    async function loadStaff() {
      setStaffLoading(true)
      try {
        const supabase = createClient()
        const { data, error } = await supabase
          .from('profiles')
          .select('id, full_name, email, avatar_url, role')
          .eq('role', 'staff')
          .order('full_name', { ascending: true })

        if (error) throw error
        setStaffList((data as Profile[]) ?? [])
      } catch {
        // Non-critical — staff list just won't show
      } finally {
        setStaffLoading(false)
      }
    }

    loadStaff()
  }, [open])

  function toggleStaff(userId: string) {
    setSelectedStaff((prev) => {
      const next = new Set(prev)
      next.has(userId) ? next.delete(userId) : next.add(userId)
      return next
    })
  }

  async function onSubmit(values: FormValues) {
    setIsSubmitting(true)
    try {
      const supabase = createClient()

      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        toast({
          title: 'Authentication error',
          description: 'You must be logged in to create a workspace.',
          variant: 'destructive',
        })
        return
      }

      // 1. Create workspace
      const { data: workspace, error: wsError } = await supabase
        .from('workspaces')
        .insert({
          name: values.name.trim(),
          description: values.description?.trim() || null,
          created_by: user.id,
        })
        .select('id')
        .single()

      if (wsError || !workspace) {
        toast({
          title: 'Failed to create workspace',
          description: wsError?.message ?? 'Unknown error',
          variant: 'destructive',
        })
        return
      }

      // 2. Assign selected staff
      if (selectedStaff.size > 0) {
        await supabase.from('workspace_assignments').insert(
          [...selectedStaff].map((user_id) => ({
            workspace_id: workspace.id,
            user_id,
          }))
        )
      }

      toast({
        title: 'Workspace created',
        description: `"${values.name}" created with ${selectedStaff.size} member${selectedStaff.size !== 1 ? 's' : ''}.`,
      })

      form.reset()
      onOpenChange(false)
      onSuccess()
    } finally {
      setIsSubmitting(false)
    }
  }

  function handleOpenChange(open: boolean) {
    if (!open) {
      form.reset()
      setSelectedStaff(new Set())
      setStaffSearch('')
    }
    onOpenChange(open)
  }

  const filteredStaff = staffList.filter(
    (s) =>
      s.full_name.toLowerCase().includes(staffSearch.toLowerCase()) ||
      s.email.toLowerCase().includes(staffSearch.toLowerCase())
  )

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create Workspace</DialogTitle>
          <DialogDescription>
            Workspaces help you organise projects and assign team members.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Name */}
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Name <span className="text-red-500">*</span>
                  </FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Marketing Team" {...field} />
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
                      placeholder="What is this workspace for?"
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* ── Assign Staff ────────────────────────────────────────────── */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-gray-500" />
                <span className="text-sm font-medium text-gray-700">Assign Staff</span>
                {selectedStaff.size > 0 && (
                  <span className="ml-auto text-xs text-blue-600 font-medium">
                    {selectedStaff.size} selected
                  </span>
                )}
              </div>

              <div className="rounded-lg border border-gray-200 bg-gray-50/50">
                {/* Staff search */}
                <div className="p-2 border-b border-gray-200">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
                    <Input
                      placeholder="Search staff…"
                      value={staffSearch}
                      onChange={(e) => setStaffSearch(e.target.value)}
                      className="pl-8 h-8 text-sm bg-white"
                    />
                  </div>
                </div>

                {/* Staff list */}
                {staffLoading ? (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                  </div>
                ) : filteredStaff.length === 0 ? (
                  <div className="py-6 text-center">
                    <p className="text-sm text-gray-400">
                      {staffSearch ? 'No staff match your search' : 'No staff members found'}
                    </p>
                  </div>
                ) : (
                  <ScrollArea className="h-44">
                    <ul className="p-1">
                      {filteredStaff.map((staff) => (
                        <li key={staff.id}>
                          <label className="flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 transition-colors hover:bg-white">
                            <Checkbox
                              checked={selectedStaff.has(staff.id)}
                              onCheckedChange={() => toggleStaff(staff.id)}
                            />
                            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-700">
                              {getInitials(staff.full_name)}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium text-gray-900">
                                {staff.full_name}
                              </p>
                              <p className="truncate text-xs text-gray-500">{staff.email}</p>
                            </div>
                          </label>
                        </li>
                      ))}
                    </ul>
                  </ScrollArea>
                )}
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isSubmitting ? 'Creating…' : 'Create Workspace'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
