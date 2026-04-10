'use client'

import { useState, useTransition } from 'react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import {
  Search, Check, AlertCircle, Loader2, CalendarPlus,
} from 'lucide-react'
import { Profile } from '@/types'
import { createOptionalLeaveAction } from '@/app/actions/leave'
import { useToast } from '@/components/ui/use-toast'
function getInitials(name: string) {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
}

interface Props {
  open: boolean
  onClose: () => void
  staffProfiles: Profile[]
}

export function CreateOptionalLeaveDialog({ open, onClose, staffProfiles }: Props) {
  const { toast } = useToast()
  const [isPending, startTransition] = useTransition()

  const [leaveName, setLeaveName] = useState('')
  const [selectedUserId, setSelectedUserId] = useState('')
  const [totalDays, setTotalDays] = useState('1')
  const [notes, setNotes] = useState('')
  const [staffSearch, setStaffSearch] = useState('')
  const [error, setError] = useState<string | null>(null)

  const resolvedName = leaveName
  const selectedUser = staffProfiles.find((p) => p.id === selectedUserId)
  const filteredStaff = staffProfiles.filter((p) =>
    !staffSearch ||
    p.full_name.toLowerCase().includes(staffSearch.toLowerCase()) ||
    p.email.toLowerCase().includes(staffSearch.toLowerCase())
  )

  function reset() {
    setLeaveName(''); setSelectedUserId('')
    setTotalDays('1'); setNotes(''); setStaffSearch(''); setError(null)
  }

  function handleClose() { reset(); onClose() }

  function handleCreate() {
    if (!resolvedName.trim()) { setError('Please enter a leave name'); return }
    if (!selectedUserId) { setError('Please select a staff member'); return }
    const days = parseInt(totalDays, 10)
    if (!days || days < 1) { setError('Days must be at least 1'); return }
    setError(null)

    startTransition(async () => {
      const result = await createOptionalLeaveAction({
        name: resolvedName.trim(),
        userId: selectedUserId,
        totalDays: days,
        notes,
      })
      if (!result.success) { setError(result.error ?? 'Failed to create leave'); return }
      toast({
        title: 'Optional leave created',
        description: `${days} day${days !== 1 ? 's' : ''} of "${resolvedName}" granted to ${selectedUser?.full_name}.`,
      })
      handleClose()
    })
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="sm:max-w-lg p-0 gap-0 overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-5 border-b bg-gradient-to-r from-violet-50 to-purple-50">
          <div className="h-10 w-10 rounded-xl bg-violet-100 flex items-center justify-center shrink-0">
            <CalendarPlus className="h-5 w-5 text-violet-600" />
          </div>
          <div>
            <DialogTitle className="text-base font-semibold">Create Optional Leave</DialogTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Grant a custom leave type to a specific team member
            </p>
          </div>
        </div>

        <div className="px-6 py-5 space-y-5 overflow-y-auto max-h-[70vh]">
          {error && (
            <Alert variant="destructive" className="py-2">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Leave name — custom only */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">
              Leave Name <span className="text-red-500">*</span>
            </Label>
            <Input
              placeholder="e.g. Paternity Leave, Hajj Leave, Study Leave…"
              value={leaveName}
              onChange={(e) => setLeaveName(e.target.value)}
              className="text-sm"
            />
            <p className="text-xs text-muted-foreground">Enter any custom leave type name</p>
          </div>

          {/* Staff member selector */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold">
              Staff Member <span className="text-red-500">*</span>
            </Label>
            {selectedUser ? (
              <div className="flex items-center gap-2 rounded-lg border border-violet-200 bg-violet-50/50 px-3 py-2">
                <Avatar className="h-7 w-7 shrink-0">
                  <AvatarFallback className="text-[10px] bg-violet-100 text-violet-700">
                    {getInitials(selectedUser.full_name)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{selectedUser.full_name}</p>
                  <p className="text-xs text-muted-foreground truncate">{selectedUser.email}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedUserId('')}
                  className="text-xs text-violet-600 hover:underline shrink-0"
                >
                  Change
                </button>
              </div>
            ) : (
              <div className="rounded-lg border border-border">
                <div className="p-2 border-b">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/70" />
                    <Input
                      placeholder="Search by name or email…"
                      value={staffSearch}
                      onChange={(e) => setStaffSearch(e.target.value)}
                      className="pl-8 h-8 text-sm"
                    />
                  </div>
                </div>
                <ScrollArea className="h-40">
                  <ul className="p-1">
                    {filteredStaff.map((p) => (
                      <li key={p.id}>
                        <button
                          type="button"
                          onClick={() => { setSelectedUserId(p.id); setStaffSearch('') }}
                          className="w-full flex items-center gap-3 rounded-md px-3 py-2 hover:bg-muted/50 transition-colors text-left"
                        >
                          <Avatar className="h-7 w-7 shrink-0">
                            <AvatarImage src={p.avatar_url ?? undefined} />
                            <AvatarFallback className="text-[10px]">{getInitials(p.full_name)}</AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{p.full_name}</p>
                            <p className="truncate text-xs text-muted-foreground">{p.email}</p>
                          </div>
                          <Badge variant="outline" className="text-[10px] capitalize shrink-0">
                            {p.role.replace('_', ' ')}
                          </Badge>
                        </button>
                      </li>
                    ))}
                    {filteredStaff.length === 0 && (
                      <li className="py-4 text-center text-sm text-muted-foreground">No staff found</li>
                    )}
                  </ul>
                </ScrollArea>
              </div>
            )}
          </div>

          {/* Days */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">
                Total Days <span className="text-red-500">*</span>
              </Label>
              <Input
                type="number"
                min="1"
                max="365"
                value={totalDays}
                onChange={(e) => setTotalDays(e.target.value)}
                className="text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Year</Label>
              <Input
                value={new Date().getFullYear()}
                disabled
                className="text-sm bg-muted/30"
              />
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Notes (optional)</Label>
            <Textarea
              placeholder="Any internal notes about this leave grant…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="text-sm resize-none"
            />
          </div>

          {/* Preview */}
          {resolvedName && selectedUser && (
            <div className="rounded-xl border border-violet-200 bg-violet-50/60 px-4 py-3">
              <p className="text-xs font-semibold text-violet-700 mb-1">Summary</p>
              <p className="text-sm text-foreground/80">
                Granting <strong>{totalDays || 0} day{parseInt(totalDays) !== 1 ? 's' : ''}</strong> of{' '}
                <strong>"{resolvedName}"</strong> to{' '}
                <strong>{selectedUser.full_name}</strong>
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t bg-muted/20">
          <Button variant="ghost" size="sm" onClick={handleClose} disabled={isPending}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleCreate}
            disabled={isPending || !resolvedName.trim() || !selectedUserId}
            className="bg-violet-600 hover:bg-violet-700 text-white min-w-[100px]"
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Grant Leave'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
