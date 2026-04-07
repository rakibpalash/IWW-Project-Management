'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Search, X, CheckCircle2, Users } from 'lucide-react'
import { Profile } from '@/types'
import { getInitials } from '@/lib/utils'
import { createTeamAction } from '@/app/actions/teams'
import { useToast } from '@/components/ui/use-toast'

const PRESET_COLORS = [
  { value: '#ec4899', label: 'Pink' },
  { value: '#3b82f6', label: 'Blue' },
  { value: '#22c55e', label: 'Green' },
  { value: '#f97316', label: 'Orange' },
  { value: '#a855f7', label: 'Purple' },
  { value: '#ef4444', label: 'Red' },
]

const avatarColors = [
  'bg-pink-500', 'bg-purple-500', 'bg-indigo-500', 'bg-blue-500',
  'bg-cyan-500', 'bg-teal-500', 'bg-green-500', 'bg-orange-500',
]
function getAvatarColor(name: string) {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return avatarColors[Math.abs(hash) % avatarColors.length]
}

interface CreateTeamDialogProps {
  open: boolean
  onClose: () => void
  allProfiles: Profile[]
  currentUserId: string
}

export function CreateTeamDialog({
  open,
  onClose,
  allProfiles,
  currentUserId,
}: CreateTeamDialogProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [isPending, startTransition] = useTransition()

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [color, setColor] = useState('#ec4899')
  const [memberSearch, setMemberSearch] = useState('')
  const [memberRoleFilter, setMemberRoleFilter] = useState<string>('all')
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  const ROLE_LABELS: Record<string, string> = {
    super_admin: 'Admin',
    account_manager: 'Account Manager',
    project_manager: 'Project Manager',
    staff: 'Staff',
    client: 'Client',
  }

  // Dynamically build filter tabs from roles present in allProfiles (excluding current user)
  const availableRoles = Array.from(
    new Set(allProfiles.filter((p) => p.id !== currentUserId).map((p) => p.role))
  ).sort()

  const filteredProfiles = allProfiles.filter((p) => {
    if (p.id === currentUserId) return false
    if (memberRoleFilter !== 'all' && p.role !== memberRoleFilter) return false
    if (!memberSearch) return true
    return (
      p.full_name.toLowerCase().includes(memberSearch.toLowerCase()) ||
      p.email.toLowerCase().includes(memberSearch.toLowerCase())
    )
  })

  const selectedProfiles = allProfiles.filter((p) => selectedIds.includes(p.id))

  const toggleMember = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  const handleClose = () => {
    setName('')
    setDescription('')
    setColor('#ec4899')
    setMemberSearch('')
    setMemberRoleFilter('all')
    setSelectedIds([])
    onClose()
  }

  const handleCreate = () => {
    if (!name.trim()) {
      toast({ title: 'Team name is required', variant: 'destructive' })
      return
    }
    startTransition(async () => {
      const result = await createTeamAction({
        name: name.trim(),
        description: description.trim() || undefined,
        team_type: 'official',
        color,
        memberIds: selectedIds,
      })
      if (result.success) {
        toast({ title: 'Team created successfully' })
        handleClose()
        router.refresh()
        if (result.team) router.push(`/team/${result.team.id}`)
      } else {
        toast({ title: 'Failed to create team', description: result.error, variant: 'destructive' })
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div
              className="h-8 w-8 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: color }}
            >
              <Users className="h-4 w-4 text-white" />
            </div>
            Create a team
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Name */}
          <div className="space-y-1.5">
            <Label htmlFor="team-name">Team name *</Label>
            <Input
              id="team-name"
              placeholder="e.g. Design team"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="team-desc">Description</Label>
            <Textarea
              id="team-desc"
              placeholder="What does this team do?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="resize-none"
            />
          </div>

          {/* Color */}
          <div className="space-y-1.5">
            <Label>Team color</Label>
            <div className="flex gap-2">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setColor(c.value)}
                  className="h-7 w-7 rounded-full transition-transform hover:scale-110 relative"
                  style={{ backgroundColor: c.value }}
                  title={c.label}
                >
                  {color === c.value && (
                    <span className="absolute inset-0 flex items-center justify-center">
                      <span className="h-2 w-2 rounded-full bg-card" />
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Members */}
          <div className="space-y-2">
            <Label>Add members</Label>

            {/* Selected tags */}
            {selectedProfiles.length > 0 && (
              <div className="flex flex-wrap gap-1.5 p-2 bg-muted/30 rounded-lg border border-border">
                {selectedProfiles.map((p) => (
                  <span
                    key={p.id}
                    className="inline-flex items-center gap-1.5 bg-card border border-border rounded-full pl-1 pr-2 py-0.5 text-xs font-medium text-foreground/80"
                  >
                    <Avatar className="h-4 w-4">
                      <AvatarImage src={p.avatar_url ?? undefined} />
                      <AvatarFallback className={`text-[8px] text-white ${getAvatarColor(p.full_name)}`}>
                        {getInitials(p.full_name)}
                      </AvatarFallback>
                    </Avatar>
                    {p.full_name.split(' ')[0]}
                    <button
                      type="button"
                      onClick={() => toggleMember(p.id)}
                      className="text-muted-foreground/70 hover:text-muted-foreground"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* Role filter dropdown + Search */}
            <div className="flex gap-2">
              <Select value={memberRoleFilter} onValueChange={setMemberRoleFilter}>
                <SelectTrigger className="w-36 shrink-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {availableRoles.map((r) => (
                    <SelectItem key={r} value={r}>
                      {ROLE_LABELS[r] ?? r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/70" />
                <Input
                  placeholder="Search people..."
                  value={memberSearch}
                  onChange={(e) => setMemberSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            {/* People list */}
            <div className="max-h-40 overflow-y-auto border border-border rounded-lg divide-y divide-border">
              {filteredProfiles.length === 0 ? (
                <p className="text-xs text-muted-foreground/70 text-center py-4">No people found</p>
              ) : (
                filteredProfiles.map((p) => {
                  const isSelected = selectedIds.includes(p.id)
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => toggleMember(p.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-muted/30 transition-colors ${
                        isSelected ? 'bg-blue-50' : ''
                      }`}
                    >
                      <Avatar className="h-7 w-7 flex-shrink-0">
                        <AvatarImage src={p.avatar_url ?? undefined} />
                        <AvatarFallback className={`text-xs text-white ${getAvatarColor(p.full_name)}`}>
                          {getInitials(p.full_name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{p.full_name}</p>
                        <p className="text-xs text-muted-foreground/70 truncate">{p.email}</p>
                      </div>
                      {isSelected && (
                        <CheckCircle2 className="h-4 w-4 text-blue-500 flex-shrink-0" />
                      )}
                    </button>
                  )
                })
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={isPending || !name.trim()}>
            {isPending ? 'Creating...' : 'Create team'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
