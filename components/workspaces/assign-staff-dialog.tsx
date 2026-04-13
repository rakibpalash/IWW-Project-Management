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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useToast } from '@/components/ui/use-toast'
import { Profile } from '@/types'
import { Search, Users } from 'lucide-react'
import { getInitials } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { listOrgMembersForAssignmentAction, updateWorkspaceMembersAction } from '@/app/actions/workspaces'

type RoleTab = 'staff' | 'client' | 'partner'

const TABS: { id: RoleTab; label: string }[] = [
  { id: 'staff',   label: 'Staff'   },
  { id: 'client',  label: 'Client'  },
  { id: 'partner', label: 'Partner' },
]

const AVATAR_COLORS = [
  'bg-pink-500','bg-purple-500','bg-indigo-500','bg-blue-500',
  'bg-cyan-500','bg-teal-500','bg-green-500','bg-yellow-500','bg-orange-500','bg-red-500',
]
function avatarColor(name: string) {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

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
  const [allMembers, setAllMembers] = useState<Profile[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set(currentMemberIds))
  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState<RoleTab>('staff')
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setSelected(new Set(currentMemberIds))
    setSearch('')
    setActiveTab('staff')

    async function load() {
      setIsLoading(true)
      try {
        const result = await listOrgMembersForAssignmentAction()
        if (!result.success) throw new Error(result.error)
        setAllMembers((result.members ?? []) as Profile[])
      } catch {
        toast({ title: 'Failed to load members', variant: 'destructive' })
      } finally {
        setIsLoading(false)
      }
    }

    load()
  }, [open, currentMemberIds, toast])

  function toggle(userId: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(userId)) next.delete(userId)
      else next.add(userId)
      return next
    })
  }

  async function handleSave() {
    setIsSaving(true)
    try {
      const toAdd = [...selected].filter((id) => !currentMemberIds.includes(id))
      const toRemove = currentMemberIds.filter((id) => !selected.has(id))

      const result = await updateWorkspaceMembersAction(workspaceId, toAdd, toRemove)
      if (!result.success) throw new Error(result.error)

      toast({ title: 'Workspace members updated' })
      onOpenChange(false)
      onSuccess()
    } catch (err) {
      toast({
        title: 'Failed to update',
        description: err instanceof Error ? err.message : 'An error occurred',
        variant: 'destructive',
      })
    } finally {
      setIsSaving(false)
    }
  }

  const tabMembers = allMembers.filter((m) => m.role === activeTab)
  const filtered = tabMembers.filter(
    (m) =>
      m.full_name.toLowerCase().includes(search.toLowerCase()) ||
      m.email.toLowerCase().includes(search.toLowerCase())
  )

  const tabCounts = {
    staff:   allMembers.filter((m) => m.role === 'staff').length,
    client:  allMembers.filter((m) => m.role === 'client').length,
    partner: allMembers.filter((m) => m.role === 'partner').length,
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Assign Members</DialogTitle>
          <DialogDescription>
            Select staff, clients, and partners to assign to this space.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {/* Role tabs */}
          <div className="flex gap-1 p-1 bg-muted rounded-lg">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex-1 py-1.5 text-xs font-medium rounded-md transition-colors',
                  activeTab === tab.id
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground/80'
                )}
              >
                {tab.label}
                {tabCounts[tab.id] > 0 && (
                  <span className="ml-1 text-[10px] text-muted-foreground/70">({tabCounts[tab.id]})</span>
                )}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/70" />
            <Input
              placeholder={`Search ${activeTab}s…`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* List */}
          {isLoading ? (
            <div className="flex items-center justify-center py-10">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center py-8 text-center">
              <Users className="h-8 w-8 text-gray-300" />
              <p className="mt-2 text-sm text-muted-foreground">
                {search
                  ? `No ${activeTab}s match your search`
                  : `No ${activeTab}s found in the system`}
              </p>
            </div>
          ) : (
            <ScrollArea className="h-64 pr-1">
              <ul className="space-y-1">
                {filtered.map((person) => (
                  <li key={person.id}>
                    <label className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-muted/30">
                      <Checkbox
                        id={person.id}
                        checked={selected.has(person.id)}
                        onCheckedChange={() => toggle(person.id)}
                      />
                      <Avatar className="h-8 w-8 flex-shrink-0">
                        <AvatarImage src={person.avatar_url ?? undefined} />
                        <AvatarFallback className={`text-xs font-bold text-white ${avatarColor(person.full_name)}`}>
                          {getInitials(person.full_name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">{person.full_name}</p>
                        <p className="truncate text-xs text-muted-foreground">{person.email}</p>
                      </div>
                      {selected.has(person.id) && (
                        <span className="text-[10px] font-medium text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-full flex-shrink-0">
                          Added
                        </span>
                      )}
                    </label>
                  </li>
                ))}
              </ul>
            </ScrollArea>
          )}

          <p className="text-xs text-muted-foreground/70">
            {allMembers.filter((m) => selected.has(m.id)).length} member{allMembers.filter((m) => selected.has(m.id)).length !== 1 ? 's' : ''} selected in total
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
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
