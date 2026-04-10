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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Search, AlertCircle, Loader2, CalendarPlus, Trash2, Pencil, Check, X, Plus,
} from 'lucide-react'
import { Profile } from '@/types'
import { LeaveTemplate } from './leave-page'
import {
  createOptionalLeaveAction,
  createOptionalLeaveTemplateAction,
  updateOptionalLeaveTemplateAction,
  deleteOptionalLeaveTemplateAction,
} from '@/app/actions/leave'
import { useToast } from '@/components/ui/use-toast'
import { cn } from '@/lib/utils'

function getInitials(name: string) {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
}

interface Props {
  open: boolean
  onClose: () => void
  staffProfiles: Profile[]
  leaveTemplates: LeaveTemplate[]
}

export function CreateOptionalLeaveDialog({ open, onClose, staffProfiles, leaveTemplates: initialTemplates }: Props) {
  const { toast } = useToast()
  const [isPending, startTransition] = useTransition()

  // Template list (local state so updates reflect immediately)
  const [templates, setTemplates] = useState<LeaveTemplate[]>(initialTemplates)

  // Form state
  const [templateId, setTemplateId]     = useState('')
  const [leaveName, setLeaveName]       = useState('')
  const [totalDays, setTotalDays]       = useState('1')
  const [selectedUserId, setSelectedUserId] = useState('')
  const [notes, setNotes]               = useState('')
  const [staffSearch, setStaffSearch]   = useState('')
  const [error, setError]               = useState<string | null>(null)

  // Manage mode — inline edit per template
  const [manageOpen, setManageOpen]     = useState(false)
  const [editingId, setEditingId]       = useState<string | null>(null)
  const [editName, setEditName]         = useState('')
  const [editDays, setEditDays]         = useState('')
  const [saving, setSaving]             = useState(false)

  // Add-new-template mode
  const [addingNew, setAddingNew]       = useState(false)
  const [newName, setNewName]           = useState('')
  const [newDays, setNewDays]           = useState('1')

  const selectedUser = staffProfiles.find((p) => p.id === selectedUserId)
  const filteredStaff = staffProfiles.filter((p) =>
    !staffSearch ||
    p.full_name.toLowerCase().includes(staffSearch.toLowerCase()) ||
    p.email.toLowerCase().includes(staffSearch.toLowerCase())
  )

  // ── Template selection ──
  function handleTemplateChange(val: string) {
    setTemplateId(val)
    if (val === 'custom') {
      setLeaveName('')
      setTotalDays('1')
    } else {
      const t = templates.find((t) => t.id === val)
      if (t) { setLeaveName(t.name); setTotalDays(String(t.default_days)) }
    }
    setError(null)
  }

  // ── Inline edit template ──
  function startEdit(t: LeaveTemplate) {
    setEditingId(t.id)
    setEditName(t.name)
    setEditDays(String(t.default_days))
  }

  async function saveEdit(id: string) {
    if (!editName.trim() || !editDays) return
    setSaving(true)
    const result = await updateOptionalLeaveTemplateAction(id, {
      name: editName.trim(),
      default_days: parseInt(editDays, 10),
    })
    setSaving(false)
    if (!result.success) { toast({ title: 'Error', description: result.error, variant: 'destructive' }); return }
    setTemplates((prev) => prev.map((t) => t.id === id ? { ...t, name: editName.trim(), default_days: parseInt(editDays, 10) } : t))
    // If this template is currently selected, update the form fields too
    if (templateId === id) { setLeaveName(editName.trim()); setTotalDays(editDays) }
    setEditingId(null)
  }

  async function deleteTemplate(id: string, isBuiltin: boolean) {
    if (isBuiltin) return
    setSaving(true)
    const result = await deleteOptionalLeaveTemplateAction(id)
    setSaving(false)
    if (!result.success) { toast({ title: 'Error', description: result.error, variant: 'destructive' }); return }
    setTemplates((prev) => prev.filter((t) => t.id !== id))
    if (templateId === id) { setTemplateId(''); setLeaveName(''); setTotalDays('1') }
  }

  // ── Add new template ──
  async function saveNewTemplate() {
    if (!newName.trim() || !newDays) return
    setSaving(true)
    const result = await createOptionalLeaveTemplateAction({
      name: newName.trim(),
      default_days: parseInt(newDays, 10),
    })
    setSaving(false)
    if (!result.success) { toast({ title: 'Error', description: result.error, variant: 'destructive' }); return }
    const newTemplate: LeaveTemplate = {
      id: result.id!,
      name: newName.trim(),
      default_days: parseInt(newDays, 10),
      is_builtin: false,
    }
    setTemplates((prev) => [...prev, newTemplate])
    setAddingNew(false)
    setNewName('')
    setNewDays('1')
    toast({ title: 'Template saved', description: `"${newName.trim()}" added to templates` })
  }

  // ── Grant leave ──
  function handleCreate() {
    if (!leaveName.trim()) { setError('Please enter a leave name'); return }
    if (!selectedUserId)   { setError('Please select a staff member'); return }
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

  function reset() {
    setTemplateId(''); setLeaveName(''); setTotalDays('1')
    setSelectedUserId(''); setNotes(''); setStaffSearch(''); setError(null)
    setManageOpen(false); setEditingId(null); setAddingNew(false)
    setNewName(''); setNewDays('1')
  }
  function handleClose() { reset(); onClose() }

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

          {/* ── Step 1: Leave Type ── */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-xs font-semibold">
                  Leave Type <span className="text-red-500">*</span>
                </Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Pick a template or select &quot;Custom&quot; to enter a new name
                </p>
              </div>
              <button
                type="button"
                onClick={() => { setManageOpen((v) => !v); setEditingId(null); setAddingNew(false) }}
                className={cn(
                  'text-xs flex items-center gap-1 px-2 py-1 rounded-md transition-colors',
                  manageOpen
                    ? 'bg-violet-100 text-violet-700'
                    : 'text-muted-foreground hover:text-violet-700 hover:bg-violet-50'
                )}
              >
                <Pencil className="h-3 w-3" />
                Manage types
              </button>
            </div>

            {/* ── Manage Panel ── */}
            {manageOpen && (
              <div className="rounded-lg border border-violet-200 bg-violet-50/40 p-3 space-y-2">
                <p className="text-[11px] font-semibold text-violet-700 uppercase tracking-wide mb-2">
                  Manage Leave Types
                </p>
                {templates.map((t) => (
                  <div key={t.id} className="flex items-center gap-2">
                    {editingId === t.id ? (
                      <>
                        <Input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="h-7 text-xs flex-1"
                          placeholder="Leave name"
                        />
                        <Input
                          type="number"
                          value={editDays}
                          onChange={(e) => setEditDays(e.target.value)}
                          className="h-7 text-xs w-16"
                          min="1"
                        />
                        <button type="button" onClick={() => saveEdit(t.id)} disabled={saving}
                          className="text-green-600 hover:text-green-700 p-1">
                          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                        </button>
                        <button type="button" onClick={() => setEditingId(null)}
                          className="text-muted-foreground hover:text-foreground p-1">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </>
                    ) : (
                      <>
                        <span className="flex-1 text-xs font-medium truncate">{t.name}</span>
                        <span className="text-[10px] text-muted-foreground">{t.default_days}d</span>
                        {t.is_builtin && (
                          <Badge variant="outline" className="text-[9px] h-4 px-1 text-muted-foreground">built-in</Badge>
                        )}
                        <button type="button" onClick={() => startEdit(t)}
                          className="text-muted-foreground hover:text-violet-600 p-1 transition-colors">
                          <Pencil className="h-3 w-3" />
                        </button>
                        {!t.is_builtin && (
                          <button type="button" onClick={() => deleteTemplate(t.id, t.is_builtin)} disabled={saving}
                            className="text-muted-foreground hover:text-red-500 p-1 transition-colors">
                            <Trash2 className="h-3 w-3" />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                ))}

                {/* Add new template */}
                {addingNew ? (
                  <div className="flex items-center gap-2 pt-1 border-t border-violet-200 mt-2">
                    <Input
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      className="h-7 text-xs flex-1"
                      placeholder="New leave name…"
                      autoFocus
                    />
                    <Input
                      type="number"
                      value={newDays}
                      onChange={(e) => setNewDays(e.target.value)}
                      className="h-7 text-xs w-16"
                      min="1"
                      placeholder="Days"
                    />
                    <button type="button" onClick={saveNewTemplate} disabled={saving || !newName.trim()}
                      className="text-green-600 hover:text-green-700 p-1 disabled:opacity-40">
                      {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                    </button>
                    <button type="button" onClick={() => { setAddingNew(false); setNewName(''); setNewDays('1') }}
                      className="text-muted-foreground hover:text-foreground p-1">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <button type="button" onClick={() => setAddingNew(true)}
                    className="flex items-center gap-1.5 text-xs text-violet-600 hover:text-violet-700 mt-1 pt-1 border-t border-violet-200 w-full">
                    <Plus className="h-3 w-3" />
                    Add new type
                  </button>
                )}
              </div>
            )}

            {/* Leave type dropdown */}
            <Select value={templateId} onValueChange={handleTemplateChange}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select leave type…" />
              </SelectTrigger>
              <SelectContent>
                {templates.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    <span className="flex items-center gap-2">
                      <span>{t.name}</span>
                      <span className="text-muted-foreground text-xs">— {t.default_days} days</span>
                    </span>
                  </SelectItem>
                ))}
                <div className="mx-2 my-1 border-t" />
                <SelectItem value="custom">
                  <span className="flex items-center gap-2 text-violet-700">
                    <span>✏️</span>
                    <span>Custom (enter manually)</span>
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>

            {/* Editable name + days */}
            {templateId && (
              <div className="rounded-lg border border-dashed border-violet-300 bg-violet-50/30 p-3 space-y-2">
                <p className="text-xs text-violet-700 font-medium">
                  {templateId === 'custom' ? 'Enter leave details' : 'Edit values (optional)'}
                </p>
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2 space-y-1">
                    <Label className="text-[10px] text-muted-foreground uppercase tracking-wide">Leave Name</Label>
                    <Input
                      placeholder="e.g. Hajj Leave"
                      value={leaveName}
                      onChange={(e) => setLeaveName(e.target.value)}
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
            )}
          </div>

          {/* ── Step 2: Staff Member ── */}
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
            <Label className="text-xs font-semibold">
              Notes <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
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
                of <strong>&quot;{leaveName}&quot;</strong> to{' '}
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
            disabled={isPending || !leaveName.trim() || !selectedUserId || !templateId}
            className="bg-violet-600 hover:bg-violet-700 text-white min-w-[100px]"
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Grant Leave'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
