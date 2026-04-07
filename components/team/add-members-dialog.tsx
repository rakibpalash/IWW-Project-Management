'use client'

import { useState, useTransition } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Search, X, CheckCircle2, Users } from 'lucide-react'
import { Profile } from '@/types'
import { getInitials } from '@/lib/utils'
import { addTeamMembersAction } from '@/app/actions/teams'
import { useToast } from '@/components/ui/use-toast'

const avatarColors = [
  'bg-pink-500', 'bg-purple-500', 'bg-indigo-500', 'bg-blue-500',
  'bg-cyan-500', 'bg-teal-500', 'bg-green-500', 'bg-orange-500',
]
function getAvatarColor(name: string) {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return avatarColors[Math.abs(hash) % avatarColors.length]
}

interface AddMembersDialogProps {
  open: boolean
  onClose: () => void
  teamId: string
  teamName: string
  allProfiles: Profile[]
  existingMemberIds: string[]
}

export function AddMembersDialog({
  open,
  onClose,
  teamId,
  teamName,
  allProfiles,
  existingMemberIds,
}: AddMembersDialogProps) {
  const { toast } = useToast()
  const [isPending, startTransition] = useTransition()
  const [search, setSearch] = useState('')
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  const availableProfiles = allProfiles.filter((p) => !existingMemberIds.includes(p.id))

  const filteredProfiles = availableProfiles.filter((p) => {
    if (!search) return true
    return (
      p.full_name.toLowerCase().includes(search.toLowerCase()) ||
      p.email.toLowerCase().includes(search.toLowerCase())
    )
  })

  const selectedProfiles = allProfiles.filter((p) => selectedIds.includes(p.id))

  const toggleMember = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  const handleClose = () => {
    setSearch('')
    setSelectedIds([])
    onClose()
  }

  const handleConfirm = () => {
    if (selectedIds.length === 0) return
    startTransition(async () => {
      const result = await addTeamMembersAction(teamId, selectedIds)
      if (result.success) {
        toast({ title: `Added ${selectedIds.length} member${selectedIds.length !== 1 ? 's' : ''} to ${teamName}` })
        handleClose()
      } else {
        toast({ title: 'Failed to add members', description: result.error, variant: 'destructive' })
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-blue-500" />
            Add team members
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <p className="text-sm text-muted-foreground">
            Search for people to add to <span className="font-medium text-foreground/80">{teamName}</span>.
          </p>

          {/* Selected tags */}
          {selectedProfiles.length > 0 && (
            <div className="flex flex-wrap gap-1.5 p-2.5 bg-blue-50 rounded-lg border border-blue-100 min-h-[44px]">
              {selectedProfiles.map((p) => (
                <span
                  key={p.id}
                  className="inline-flex items-center gap-1.5 bg-card border border-blue-200 rounded-full pl-1 pr-2 py-0.5 text-xs font-medium text-foreground/80"
                >
                  <Avatar className="h-4 w-4">
                    <AvatarImage src={p.avatar_url ?? undefined} />
                    <AvatarFallback className={`text-[8px] text-white ${getAvatarColor(p.full_name)}`}>
                      {getInitials(p.full_name)}
                    </AvatarFallback>
                  </Avatar>
                  {p.full_name}
                  <button
                    type="button"
                    onClick={() => toggleMember(p.id)}
                    className="text-muted-foreground/70 hover:text-muted-foreground ml-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/70" />
            <Input
              placeholder="Search people by name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* People list */}
          <div className="max-h-52 overflow-y-auto border border-border rounded-lg divide-y divide-border">
            {availableProfiles.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground/70">
                <Users className="h-6 w-6 mb-2 opacity-50" />
                <p className="text-xs">All members are already in this team</p>
              </div>
            ) : filteredProfiles.length === 0 ? (
              <p className="text-xs text-muted-foreground/70 text-center py-6">No people match your search</p>
            ) : (
              filteredProfiles.map((p) => {
                const isSelected = selectedIds.includes(p.id)
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => toggleMember(p.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-muted/30 transition-colors ${
                      isSelected ? 'bg-blue-50' : ''
                    }`}
                  >
                    <Avatar className="h-8 w-8 flex-shrink-0">
                      <AvatarImage src={p.avatar_url ?? undefined} />
                      <AvatarFallback className={`text-xs text-white ${getAvatarColor(p.full_name)}`}>
                        {getInitials(p.full_name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{p.full_name}</p>
                      <p className="text-xs text-muted-foreground/70 truncate">{p.email}</p>
                    </div>
                    {isSelected ? (
                      <CheckCircle2 className="h-4 w-4 text-blue-500 flex-shrink-0" />
                    ) : (
                      <div className="h-4 w-4 rounded-full border-2 border-border flex-shrink-0" />
                    )}
                  </button>
                )
              })
            )}
          </div>

          {selectedIds.length > 0 && (
            <p className="text-xs text-blue-600 font-medium">
              {selectedIds.length} person{selectedIds.length !== 1 ? 's' : ''} selected
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isPending}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isPending || selectedIds.length === 0}
          >
            {isPending
              ? 'Adding...'
              : selectedIds.length > 0
              ? `Add ${selectedIds.length} member${selectedIds.length !== 1 ? 's' : ''}`
              : 'Add members'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
