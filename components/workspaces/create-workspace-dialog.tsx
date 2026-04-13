'use client'

import { useState, useEffect, useRef } from 'react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { useToast } from '@/components/ui/use-toast'
import { createWorkspaceAction } from '@/app/actions/workspaces'
import { Profile, Workspace } from '@/types'
import { X, Search, Shield, ChevronDown, Lock, Check } from 'lucide-react'
import { cn, getInitials } from '@/lib/utils'

type WorkspaceWithCounts = Workspace & { member_count: number; project_count: number }

interface CreateWorkspaceDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: (workspace: WorkspaceWithCounts) => void
  staffProfiles: Profile[]
}

const SPACE_COLORS = [
  '#7c3aed', '#0891b2', '#0284c7', '#059669',
  '#d97706', '#dc2626', '#db2777', '#4f46e5',
  '#0ea5e9', '#10b981', '#f97316', '#8b5cf6',
]

function pickColor(name: string) {
  if (!name) return SPACE_COLORS[0]
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
  return SPACE_COLORS[h % SPACE_COLORS.length]
}

export function CreateWorkspaceDialog({
  open,
  onOpenChange,
  onSuccess,
  staffProfiles,
}: CreateWorkspaceDialogProps) {
  const { toast } = useToast()

  const [name,          setName]          = useState('')
  const [description,   setDescription]   = useState('')
  const [isPrivate,     setIsPrivate]     = useState(false)
  const [memberSearch,  setMemberSearch]  = useState('')
  const [selectedStaff, setSelectedStaff] = useState<Set<string>>(new Set())
  const [shareOpen,     setShareOpen]     = useState(false)
  const [isSubmitting,  setIsSubmitting]  = useState(false)
  const [nameError,     setNameError]     = useState('')
  const shareRef = useRef<HTMLDivElement>(null)
  const nameRef  = useRef<HTMLInputElement>(null)

  // Click-outside for share dropdown
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (shareRef.current && !shareRef.current.contains(e.target as Node)) {
        setShareOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    if (open) {
      setTimeout(() => nameRef.current?.focus(), 80)
    } else {
      setName(''); setDescription(''); setIsPrivate(false)
      setMemberSearch(''); setSelectedStaff(new Set())
      setShareOpen(false); setNameError('')
    }
  }, [open])

  function toggleMember(id: string) {
    setSelectedStaff(prev => {
      const n = new Set(prev)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })
  }

  async function handleSubmit() {
    if (!name.trim()) { setNameError('Space name is required'); nameRef.current?.focus(); return }
    setNameError('')
    setIsSubmitting(true)
    try {
      const result = await createWorkspaceAction({
        name: name.trim(),
        description: description.trim() || undefined,
        memberIds: [...selectedStaff],
      })
      if (!result.success || !result.workspace) {
        toast({ title: 'Failed to create space', description: result.error ?? 'Unknown error', variant: 'destructive' })
        return
      }
      toast({ title: 'Space created', description: `"${name.trim()}" has been created.` })
      onOpenChange(false)
      onSuccess({ ...result.workspace, member_count: selectedStaff.size, project_count: 0 })
    } finally {
      setIsSubmitting(false)
    }
  }

  const iconColor = pickColor(name)
  const iconLetter = name.trim().slice(0, 1).toUpperCase() || 'M'

  const filteredStaff = staffProfiles.filter(s =>
    !memberSearch ||
    s.full_name.toLowerCase().includes(memberSearch.toLowerCase()) ||
    s.email.toLowerCase().includes(memberSearch.toLowerCase())
  )

  const selectedMembers = staffProfiles.filter(s => selectedStaff.has(s.id))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 gap-0 max-w-[500px] overflow-hidden rounded-xl border border-border shadow-2xl">

        {/* ── Header ── */}
        <div className="px-6 pt-6 pb-4">
          <div className="flex items-start justify-between mb-1">
            <h2 className="text-[18px] font-bold text-foreground">Create a Space</h2>
            <button
              onClick={() => onOpenChange(false)}
              className="rounded-md p-1 text-muted-foreground/60 hover:text-foreground hover:bg-muted transition-colors -mt-0.5"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <p className="text-[13px] text-muted-foreground leading-relaxed">
            A Space represents teams, departments, or groups, each with its own Lists, workflows, and settings.
          </p>
        </div>

        {/* ── Body ── */}
        <div className="px-6 pb-2 space-y-4">

          {/* Icon & name */}
          <div>
            <p className="text-[13px] font-semibold text-foreground mb-2">Icon &amp; name</p>
            <div className="flex items-center gap-3">
              {/* Icon badge */}
              <div
                className="h-9 w-9 shrink-0 rounded-lg flex items-center justify-center text-white text-[15px] font-bold select-none"
                style={{ backgroundColor: iconColor }}
              >
                {iconLetter}
              </div>
              {/* Name input */}
              <div className="flex-1">
                <input
                  ref={nameRef}
                  value={name}
                  onChange={e => { setName(e.target.value); if (e.target.value.trim()) setNameError('') }}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleSubmit() } }}
                  placeholder="e.g. Marketing, Engineering, HR"
                  className={cn(
                    'w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none transition-colors',
                    'placeholder:text-muted-foreground/50',
                    nameError
                      ? 'border-red-400 focus:border-red-400'
                      : 'border-border focus:border-primary focus:ring-1 focus:ring-primary/30',
                  )}
                />
                {nameError && <p className="text-xs text-red-500 mt-1">{nameError}</p>}
              </div>
            </div>
          </div>

          {/* Description */}
          <div>
            <p className="text-[13px] font-semibold text-foreground mb-2">
              Description <span className="font-normal text-muted-foreground">(optional)</span>
            </p>
            <input
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder=""
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-colors placeholder:text-muted-foreground/40"
            />
          </div>

          {/* Default permission */}
          <div className="flex items-center justify-between py-0.5">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-muted-foreground" />
              <span className="text-[13px] font-medium text-foreground">Default permission</span>
              <button className="h-4 w-4 rounded-full border border-muted-foreground/40 text-muted-foreground/50 text-[10px] font-bold flex items-center justify-center hover:border-muted-foreground transition-colors">?</button>
            </div>
            <button className="flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[13px] font-medium text-foreground hover:bg-muted/60 transition-colors border border-border">
              Full edit
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          </div>

          {/* Make Private */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[13px] font-medium text-foreground">Make Private</p>
                <p className="text-[12px] text-muted-foreground mt-0.5">Only you and invited members have access</p>
              </div>
              {/* Toggle */}
              <button
                type="button"
                role="switch"
                aria-checked={isPrivate}
                onClick={() => setIsPrivate(v => !v)}
                className={cn(
                  'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200',
                  isPrivate ? 'bg-primary' : 'bg-muted-foreground/30'
                )}
              >
                <span
                  className={cn(
                    'pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform duration-200',
                    isPrivate ? 'translate-x-5' : 'translate-x-0'
                  )}
                />
              </button>
            </div>

            {/* Share only with — visible when private */}
            {isPrivate && (
              <div className="pl-0">
                <p className="text-[12px] font-medium text-muted-foreground mb-2">Share only with:</p>
                <div className="relative" ref={shareRef}>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {/* Selected member avatars */}
                    {selectedMembers.map(m => (
                      <button
                        key={m.id}
                        onClick={() => toggleMember(m.id)}
                        title={`Remove ${m.full_name}`}
                        className="h-7 w-7 rounded-full bg-primary flex items-center justify-center text-[10px] font-bold text-primary-foreground hover:opacity-80 transition-opacity border-2 border-background"
                      >
                        {getInitials(m.full_name)}
                      </button>
                    ))}
                    {/* Add button */}
                    <button
                      onClick={() => setShareOpen(v => !v)}
                      className="h-7 w-7 rounded-full border-2 border-dashed border-border flex items-center justify-center text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                    >
                      <Lock className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {/* Dropdown */}
                  {shareOpen && (
                    <div className="absolute left-0 top-full mt-1 z-50 w-64 rounded-xl border border-border bg-background shadow-xl overflow-hidden">
                      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border/60">
                        <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <input
                          autoFocus
                          value={memberSearch}
                          onChange={e => setMemberSearch(e.target.value)}
                          placeholder="Search or enter email..."
                          className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/50"
                        />
                      </div>
                      <div className="max-h-48 overflow-y-auto py-1">
                        {filteredStaff.map(m => (
                          <button
                            key={m.id}
                            onClick={() => { toggleMember(m.id); setMemberSearch('') }}
                            className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-left hover:bg-muted/50 transition-colors"
                          >
                            <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center text-[9px] font-bold text-primary shrink-0">
                              {getInitials(m.full_name)}
                            </div>
                            <span className="flex-1 truncate">{m.full_name}</span>
                            {selectedStaff.has(m.id) && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
                          </button>
                        ))}
                        {filteredStaff.length === 0 && (
                          <p className="px-3 py-3 text-xs text-muted-foreground">No members found</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-border/60 bg-muted/20">
          <button className="text-[13px] text-muted-foreground hover:text-foreground transition-colors">
            Use Templates
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="rounded-lg bg-foreground text-background px-5 py-2 text-[13px] font-semibold hover:bg-foreground/90 disabled:opacity-50 transition-colors"
          >
            {isSubmitting ? 'Creating…' : 'Continue'}
          </button>
        </div>

      </DialogContent>
    </Dialog>
  )
}
