'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useToast } from '@/components/ui/use-toast'
import { createClient } from '@/lib/supabase/client'
import { Profile } from '@/types'
import { Search, Users } from 'lucide-react'
import { getInitials } from '@/lib/utils'

interface AssignStaffDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  workspaceId: string
  currentMemberIds: string[]
  onSuccess: () => void
}

export function AssignStaffDialog({
  open,
  onOpenChange,
  workspaceId,
  currentMemberIds,
  onSuccess,
}: AssignStaffDialogProps) {
  const { toast } = useToast()
  const [staffList, setStaffList] = useState<Profile[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set(currentMemberIds))
  const [search, setSearch] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  // Load staff profiles whenever dialog opens
  useEffect(() => {
    if (!open) return

    setSelected(new Set(currentMemberIds))
    setSearch('')

    async function loadStaff() {
      setIsLoading(true)
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
        toast({
          title: 'Failed to load staff',
          description: 'Could not fetch staff members.',
          variant: 'destructive',
        })
      } finally {
        setIsLoading(false)
      }
    }

    loadStaff()
  }, [open, currentMemberIds, toast])

  function toggle(userId: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(userId)) {
        next.delete(userId)
      } else {
        next.add(userId)
      }
      return next
    })
  }

  async function handleSave() {
    setIsSaving(true)
    try {
      const supabase = createClient()

      const toAdd = [...selected].filter((id) => !currentMemberIds.includes(id))
      const toRemove = currentMemberIds.filter((id) => !selected.has(id))

      // Remove deselected members
      if (toRemove.length > 0) {
        const { error } = await supabase
          .from('workspace_assignments')
          .delete()
          .eq('workspace_id', workspaceId)
          .in('user_id', toRemove)

        if (error) throw error
      }

      // Add newly selected members
      if (toAdd.length > 0) {
        const { error } = await supabase.from('workspace_assignments').upsert(
          toAdd.map((user_id) => ({ workspace_id: workspaceId, user_id })),
          { onConflict: 'workspace_id,user_id' }
        )

        if (error) throw error
      }

      toast({
        title: 'Staff assignments updated',
        description: 'Workspace members have been updated successfully.',
      })

      onOpenChange(false)
      onSuccess()
    } catch (err: unknown) {
      toast({
        title: 'Failed to update assignments',
        description: err instanceof Error ? err.message : 'An unexpected error occurred.',
        variant: 'destructive',
      })
    } finally {
      setIsSaving(false)
    }
  }

  const filtered = staffList.filter(
    (s) =>
      s.full_name.toLowerCase().includes(search.toLowerCase()) ||
      s.email.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Assign Staff</DialogTitle>
          <DialogDescription>
            Select staff members to assign to this workspace.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              placeholder="Search staff…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Staff list */}
          {isLoading ? (
            <div className="flex items-center justify-center py-10">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center py-8 text-center">
              <Users className="h-8 w-8 text-gray-300" />
              <p className="mt-2 text-sm text-gray-500">
                {search ? 'No staff match your search' : 'No staff members found'}
              </p>
            </div>
          ) : (
            <ScrollArea className="h-72 pr-1">
              <ul className="space-y-1">
                {filtered.map((staff) => (
                  <li key={staff.id}>
                    <label className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-gray-50">
                      <Checkbox
                        id={staff.id}
                        checked={selected.has(staff.id)}
                        onCheckedChange={() => toggle(staff.id)}
                      />
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-700">
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

          <p className="text-xs text-gray-400">
            {selected.size} staff member{selected.size !== 1 ? 's' : ''} selected
          </p>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving || isLoading}>
            {isSaving ? 'Saving…' : 'Save Assignments'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
