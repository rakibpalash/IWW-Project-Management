'use client'

import { useState, useTransition } from 'react'
import {
  Dialog, DialogContent, DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Search, AlertCircle, Loader2, CalendarPlus, Pencil, Check } from 'lucide-react'
import { Profile } from '@/types'
import { createOptionalLeaveAction } from '@/app/actions/leave'
import { useToast } from '@/components/ui/use-toast'
import { cn } from '@/lib/utils'

function getInitials(name: string) {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
}

// Pre-built leave templates — editable after selection
const LEAVE_TEMPLATES = [
  { name: 'Hajj Leave',          days: 15, emoji: '🕌' },
  { name: 'Marriage Leave',      days: 7,  emoji: '💍' },
  { name: 'Paternity Leave',     days: 7,  emoji: '👶' },
  { name: 'Bereavement Leave',   days: 3,  emoji: '🕊️' },
  { name: 'Study Leave',         days: 5,  emoji: '📚' },
  { name: 'Compassionate Leave', days: 3,  emoji: '🤝' },
  { name: 'Birthday Leave',      days: 1,  emoji: '🎂' },
  { name: 'Volunteer Leave',     days: 2,  emoji: '🌱' },
]

interface Props {
  open: boolean
  onClose: () => void
  staffProfiles: Profile[]
}

export function CreateOptionalLeaveDialog({ open, onClose, staffProfiles }: Props) {
  const { toast } = useToast()
  const [isPending, startTransition] = useTransition()

  const [leaveName, setLeaveName] = useState('')
  const [totalDays, setTotalDays] = useState('1')
  const [selectedUserId, setSelectedUserId] = useState('')
  const [notes, setNotes] = useState('')
  const [staffSearch, setStaffSearch] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [activeTemplate, setActiveTemplate] = useState<string | null>(null)

  const selectedUser = staffProfiles.find((p) => p.id === selectedUserId)
  const filteredStaff = staffProfiles.filter((p) =>
    !staffSearch ||
    p.full_name.toLowerCase().includes(staffSearch.toLowerCase()) ||
    p.email.toLowerCase().includes(staffSearch.toLowerCase())
  )

  function applyTemplate(t: typeof LEAVE_TEMPLATES[0]) {
    setLeaveName(t.name)
    setTotalDays(String(t.days))
    setActiveTemplate(t.name)
  }

  function handleNameChange(val: string) {
    setLeaveName(val)
    // If user edits the name manually, deactivate template highlight
    if (activeTemplate && val !== activeTemplate) setActiveTemplate(null)
  }

  function reset() {
    setLeaveName(''); setTotalDays('1'); setSelectedUserId('')
    setNotes(''); setStaffSearch(''); setError(null); setActiveTemplate(null)
  }

  function handleClose() { reset(); onClose() }

  function handleCreate() {
    if (!leaveName.trim()) { setError('Please enter a leave name'); return }
    if (!selectedUserId) { setError('Please select a staff member'); return }
    const days = parseInt(totalDays, 10)
    if (!days || days < 1) { setError('Days must be at least 1'); return }
    setError(null)

    startTransition(async () => {
      const result = await createOptionalLeaveAction({
        name: leaveName.trim(),
        userId: selectedUserId,
        totalDays: days,
        notes,
      })
      if (!result.success) { setError(result.error ?? 'Failed to create leave'); return }
      toast({
        title: 'Optional leave granted',
        description: `${days} day${days !== 1 ? 's' : ''} of "${leaveName}" granted to ${selectedUser?.full_name}.`,
      })
      handleClose()
    })
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="sm:max-w-lg p-0 gap-0 overflow-hidden max-h-[92vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b bg-gradient-to-r from-violet-50 to-purple-50 shrink-0">
          <div className="h-9 w-9 rounded-xl bg-violet-100 flex items-center justify-center shrink-0">
            <CalendarPlus className="h-4.5 w-4.5 text-violet-600" />
          </div>
          <div>
            <DialogTitle className="text-sm font-semibold">Create Optional Leave</DialogTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Grant a custom leave type to a specific team member
            </p>
          </div>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">
          {error && (
            <Alert variant="destructive" className="py-2">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* ── Step 1: Leave type ── */}
          <div className="space-y-3">
            <div>
              <Label className="text-xs font-semibold">
                Leave Type <span className="text-red-500">*</span>
              </Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Pick a pre-built template or enter a custom name — all fields are editable
              </p>
            </div>

            {/* Template chips */}
            <div className="grid grid-cols-2 gap-2">
              {LEAVE_TEMPLATES.map((t) => {
                const isActive = activeTemplate === t.name
                return (
                  <button
                    key={t.name}
                    type="button"
                    onClick={() => applyTemplate(t)}
                    className={cn(
                      'flex items-center gap-2.5 rounded-lg border px-3 py-2 text-left transition-all text-sm',
                      isActive
                        ? 'border-violet-500 bg-violet-50 text-violet-800 ring-1 ring-violet-300'
                        : 'border-border bg-background hover:bg-muted/40 text-foreground/80'
                    )}
                  >
                    <span className="text-base shrink-0">{t.emoji}</span>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-xs truncate">{t.name}</p>
                      <p className="text-[10px] text-muted-foreground">{t.days} days</p>
                    </div>
                    {isActive && <Check className="h-3.5 w-3.5 text-violet-600 shrink-0" />}
                  </button>
                )
              })}
            </div>

            {/* Editable name + days — always visible for editing */}
            <div className="rounded-lg border border-dashed border-violet-300 bg-violet-50/30 p-3 space-y-3">
              <div className="flex items-center gap-1.5 text-xs text-violet-700 font-medium">
                <Pencil className="h-3 w-3" />
                {activeTemplate ? 'Edit template values' : 'Or enter a custom leave'}
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2 space-y-1">
                  <Label className="text-[10px] text-muted-foreground uppercase tracking-wide">Leave Name</Label>
                  <Input
                    placeholder="e.g. Hajj Leave"
                    value={leaveName}
                    onChange={(e) => handleNameChange(e.target.value)}
                    className="text-sm h-8"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground uppercase tracking-wide">Days</Label>
                  <Input
                    type="number"
                    min="1"
                    max="365"
                    value={totalDays}
                    onChange={(e) => setTotalDays(e.target.value)}
                    className="text-sm h-8"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* ── Step 2: Staff member ── */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold">
              Staff Member <span className="text-red-500">*</span>
            </Label>
            {selectedUser ? (
              <div className="flex items-center gap-2 rounded-lg border border-violet-200 bg-violet-50/50 px-3 py-2">
                <Avatar className="h-7 w-7 shrink-0">
                  <AvatarImage src={selectedUser.avatar_url ?? undefined} />
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
                <ScrollArea className="h-36">
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

          {/* ── Notes ── */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Notes <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Textarea
              placeholder="Any internal notes about this leave grant…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="text-sm resize-none"
            />
          </div>

          {/* ── Summary preview ── */}
          {leaveName.trim() && selectedUser && (
            <div className="rounded-xl border border-violet-200 bg-violet-50/60 px-4 py-3">
              <p className="text-xs font-semibold text-violet-700 mb-1">Summary</p>
              <p className="text-sm text-foreground/80">
                Granting{' '}
                <strong>{totalDays || 0} day{parseInt(totalDays) !== 1 ? 's' : ''}</strong>{' '}
                of <strong>"{leaveName}"</strong> to{' '}
                <strong>{selectedUser.full_name}</strong>
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t bg-muted/20 shrink-0">
          <Button variant="ghost" size="sm" onClick={handleClose} disabled={isPending}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleCreate}
            disabled={isPending || !leaveName.trim() || !selectedUserId}
            className="bg-violet-600 hover:bg-violet-700 text-white min-w-[100px]"
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Grant Leave'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
