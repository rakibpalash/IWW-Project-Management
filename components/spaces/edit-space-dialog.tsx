'use client'

import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { useToast } from '@/components/ui/use-toast'
import { renameSpaceAction, updateSpaceMembersAction, getSpaceMembersAction } from '@/app/actions/spaces'
import { createClient } from '@/lib/supabase/client'
import { getStatusTemplatesAction, StatusTemplateRow } from '@/app/actions/status-templates'
import { listPermissionTemplatesAction, PermissionTemplate } from '@/app/actions/permission-templates'
import { Profile, Space } from '@/types'
import {
  X, Search, Shield, ChevronDown, Check,
  ChevronRight, ChevronLeft, List, LayoutGrid, CalendarRange, Loader2,
} from 'lucide-react'
import { cn, getInitials } from '@/lib/utils'

interface EditSpaceDialogProps {
  space: Space
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: (name: string, description: string | null) => void
}

// ── Colors ────────────────────────────────────────────────────────────────────
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

// ── Default workflow (matches folder/task statuses) ───────────────────────────
const DEFAULT_WORKFLOW = [
  { slug: 'todo',        name: 'To Do',       color: '#94a3b8' },
  { slug: 'in_progress', name: 'In Progress', color: '#f59e0b' },
  { slug: 'in_review',   name: 'In Review',   color: '#3b82f6' },
  { slug: 'done',        name: 'Done',        color: '#22c55e' },
  { slug: 'cancelled',   name: 'Cancelled',   color: '#ef4444' },
]

// ── Permission levels fallback ────────────────────────────────────────────────
const PERMISSION_LEVELS = [
  { value: 'full_edit', label: 'Full edit',  desc: 'Can create, edit and delete everything' },
  { value: 'can_edit',  label: 'Can edit',   desc: 'Can edit tasks and content, not settings' },
  { value: 'view_only', label: 'View only',  desc: 'Can view everything but not edit' },
  { value: 'no_access', label: 'No access',  desc: 'Cannot see this space at all' },
]

// ── Step bar ──────────────────────────────────────────────────────────────────
function StepBar({ step }: { step: number }) {
  const labels = ['Info', 'Members', 'Workflow', 'Settings']
  return (
    <div className="flex items-center px-6 pt-5 pb-3">
      {labels.map((label, i) => {
        const idx = i + 1
        const done    = idx < step
        const current = idx === step
        return (
          <div key={label} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-1 shrink-0">
              <div className={cn(
                'h-6 w-6 rounded-full flex items-center justify-center text-[11px] font-bold transition-colors',
                done    ? 'bg-primary text-primary-foreground' :
                current ? 'bg-primary text-primary-foreground ring-2 ring-primary/30' :
                          'bg-muted text-muted-foreground',
              )}>
                {done ? <Check className="h-3 w-3" /> : idx}
              </div>
              <span className={cn(
                'text-[10px] font-semibold whitespace-nowrap',
                current ? 'text-foreground' : 'text-muted-foreground',
              )}>{label}</span>
            </div>
            {i < labels.length - 1 && (
              <div className={cn(
                'flex-1 h-[2px] mx-1 mb-4 rounded-full transition-colors',
                idx < step ? 'bg-primary' : 'bg-muted',
              )} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Permission popup ──────────────────────────────────────────────────────────
function PermissionPopup({
  anchorRef, templates, selected, onSelect, onClose,
}: {
  anchorRef: React.RefObject<HTMLButtonElement>
  templates: PermissionTemplate[]
  selected: string
  onSelect: (v: string) => void
  onClose: () => void
}) {
  const [coords, setCoords] = useState<{ top: number; left: number; width: number } | null>(null)

  useEffect(() => {
    if (anchorRef.current) {
      const r = anchorRef.current.getBoundingClientRect()
      setCoords({ top: r.bottom + 4, left: r.left, width: Math.max(r.width, 220) })
    }
  }, [anchorRef])

  useEffect(() => {
    const handler = () => onClose()
    const t = setTimeout(() => document.addEventListener('mousedown', handler), 50)
    return () => { clearTimeout(t); document.removeEventListener('mousedown', handler) }
  }, [onClose])

  if (!coords || typeof document === 'undefined') return null

  const items = templates.length > 0 ? templates.map(t => ({ value: t.id, label: t.name, desc: t.description ?? '' })) : PERMISSION_LEVELS

  return createPortal(
    <div
      style={{ position: 'fixed', top: coords.top, left: coords.left, zIndex: 9999, width: coords.width }}
      onMouseDown={e => e.stopPropagation()}
    >
      <div className="rounded-xl border border-border bg-background shadow-2xl overflow-hidden py-1.5">
        <p className="px-3 pt-1 pb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
          Default Permission
        </p>
        {items.map(item => (
          <button
            key={item.value}
            onClick={() => { onSelect(item.value); onClose() }}
            className="flex items-center justify-between w-full px-3 py-2.5 text-left hover:bg-muted/60 transition-colors"
          >
            <div>
              <p className="text-[13px] font-semibold text-foreground">{item.label}</p>
              {item.desc && <p className="text-[11px] text-muted-foreground">{item.desc}</p>}
            </div>
            {selected === item.value && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
          </button>
        ))}
      </div>
    </div>,
    document.body
  )
}

// ── Member picker ─────────────────────────────────────────────────────────────
function MemberPicker({
  staffProfiles, selectedStaff, onToggle, autoFocus = true, maxHeight = 240,
}: {
  staffProfiles: Profile[]
  selectedStaff: Set<string>
  onToggle: (id: string) => void
  autoFocus?: boolean
  maxHeight?: number
}) {
  const [search, setSearch] = useState('')
  const filtered = staffProfiles.filter(s =>
    !search ||
    s.full_name.toLowerCase().includes(search.toLowerCase()) ||
    s.email.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2">
        <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <input
          autoFocus={autoFocus}
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search or enter email..."
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/50"
        />
      </div>
      <div className="rounded-lg border border-border divide-y divide-border/50 overflow-hidden"
        style={{ maxHeight, overflowY: 'auto' }}
      >
        {filtered.length === 0 ? (
          <p className="px-4 py-4 text-sm text-center text-muted-foreground">No members found</p>
        ) : filtered.map(m => {
          const sel = selectedStaff.has(m.id)
          return (
            <button
              key={m.id}
              onClick={() => onToggle(m.id)}
              className={cn(
                'flex items-center gap-3 w-full px-4 py-2.5 text-left transition-colors',
                sel ? 'bg-primary/5' : 'hover:bg-muted/50'
              )}
            >
              <div
                className="h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                style={{ backgroundColor: pickColor(m.full_name) }}
              >
                {getInitials(m.full_name)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold text-foreground truncate">{m.full_name}</p>
                <p className="text-[11px] text-muted-foreground truncate">{m.email}</p>
              </div>
              <div className={cn(
                'h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors',
                sel ? 'bg-primary border-primary' : 'border-muted-foreground/30'
              )}>
                {sel && <Check className="h-3 w-3 text-white" />}
              </div>
            </button>
          )
        })}
      </div>
      {selectedStaff.size > 0 && (
        <p className="text-[11px] text-muted-foreground px-0.5">
          {selectedStaff.size} member{selectedStaff.size > 1 ? 's' : ''} selected
        </p>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export function EditSpaceDialog({
  space, open, onOpenChange, onSuccess,
}: EditSpaceDialogProps) {
  const { toast } = useToast()
  const supabase = createClient()

  const [step, setStep] = useState(1)
  const [isLoading, setIsLoading] = useState(false)
  const [staffProfiles, setStaffProfiles] = useState<Profile[]>([])

  // Step 1
  const [name,        setName]        = useState(space.name)
  const [description, setDescription] = useState(space.description ?? '')
  const [nameError,   setNameError]   = useState('')
  const nameRef = useRef<HTMLInputElement>(null)

  // Permission popup
  const [permOpen,      setPermOpen]      = useState(false)
  const [selectedPerm,  setSelectedPerm]  = useState('full_edit')
  const [permTemplates, setPermTemplates] = useState<PermissionTemplate[]>([])
  const [permLoading,   setPermLoading]   = useState(false)
  const permBtnRef = useRef<HTMLButtonElement>(null)

  // Step 2 — Members
  const [selectedStaff,   setSelectedStaff]   = useState<Set<string>>(new Set())
  const [originalMembers, setOriginalMembers] = useState<Set<string>>(new Set())
  const [membersLoaded,   setMembersLoaded]   = useState(false)

  // Step 3 — Workflow
  const [templates,        setTemplates]        = useState<StatusTemplateRow[]>([])
  const [selectedWorkflow, setSelectedWorkflow] = useState('__default__')
  const [templatesLoading, setTemplatesLoading] = useState(false)

  // Step 4 — Views
  const [viewList,     setViewList]     = useState(true)
  const [viewBoard,    setViewBoard]    = useState(true)
  const [viewTimeline, setViewTimeline] = useState(false)

  const [isSaving, setIsSaving] = useState(false)

  // ── Load data when opening ────────────────────────────────────────────────
  useEffect(() => {
    if (!open) { setStep(1); setNameError(''); setPermOpen(false); return }
    setName(space.name)
    setDescription(space.description ?? '')
    if (!membersLoaded) {
      setIsLoading(true)
      Promise.all([
        getSpaceMembersAction(space.id),
        supabase
          .from('profiles')
          .select('id, full_name, email, avatar_url, role, is_temp_password, onboarding_completed, created_at, updated_at')
          .neq('role', 'client')
          .order('full_name'),
      ]).then(([membersRes, { data: allProfiles }]) => {
        if (membersRes.success && membersRes.members) {
          const ids = new Set(membersRes.members.map(m => m.id))
          setSelectedStaff(ids)
          setOriginalMembers(ids)
        }
        setStaffProfiles((allProfiles as Profile[]) ?? [])
        setMembersLoaded(true)
        setIsLoading(false)
      })
    }
  }, [open])

  // ── Fetch perm templates on popup open ───────────────────────────────────
  useEffect(() => {
    if (permOpen && permTemplates.length === 0 && !permLoading) {
      setPermLoading(true)
      listPermissionTemplatesAction().then(d => setPermTemplates(d)).finally(() => setPermLoading(false))
    }
  }, [permOpen])

  // ── Fetch status templates on step 3 ────────────────────────────────────
  useEffect(() => {
    if (step === 3 && templates.length === 0) {
      setTemplatesLoading(true)
      getStatusTemplatesAction()
        .then(r => { if (r.success) setTemplates(r.templates ?? []) })
        .finally(() => setTemplatesLoading(false))
    }
  }, [step])

  // ── Helpers ──────────────────────────────────────────────────────────────
  function toggleMember(id: string) {
    setSelectedStaff(prev => {
      const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n
    })
  }

  function goNext() {
    if (step === 1) {
      if (!name.trim()) { setNameError('Space name is required'); nameRef.current?.focus(); return }
      setNameError('')
    }
    setStep(s => Math.min(s + 1, 4))
  }

  function goBack() { setStep(s => Math.max(s - 1, 1)) }

  async function handleSave() {
    if (!name.trim()) { setNameError('Space name is required'); return }
    setIsSaving(true)
    try {
      // 1. Rename / update info
      const renameRes = await renameSpaceAction(space.id, name.trim(), description.trim() || undefined)
      if (!renameRes.success) {
        toast({ title: 'Failed to update space', description: renameRes.error, variant: 'destructive' })
        return
      }

      // 2. Update members (diff from original)
      const toAdd    = [...selectedStaff].filter(id => !originalMembers.has(id))
      const toRemove = [...originalMembers].filter(id => !selectedStaff.has(id))
      if (toAdd.length > 0 || toRemove.length > 0) {
        await updateSpaceMembersAction(space.id, toAdd, toRemove)
      }

      toast({ title: 'Space updated', description: `"${name.trim()}" has been updated.` })
      onSuccess(name.trim(), description.trim() || null)
      onOpenChange(false)
    } finally {
      setIsSaving(false)
    }
  }

  // ── Derived ───────────────────────────────────────────────────────────────
  const iconColor  = pickColor(name)
  const iconLetter = name.trim().slice(0, 1).toUpperCase() || 'S'

  const permLabel = (() => {
    if (permTemplates.length > 0) return permTemplates.find(t => t.id === selectedPerm)?.name ?? 'Full edit'
    return PERMISSION_LEVELS.find(l => l.value === selectedPerm)?.label ?? 'Full edit'
  })()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 gap-0 max-w-[500px] overflow-hidden rounded-xl border border-border shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-0">
          <div>
            <h2 className="text-[17px] font-bold text-foreground">Edit Space</h2>
            <p className="text-[12px] text-muted-foreground mt-0.5">
              {step === 1 && 'Update the name and settings for this space.'}
              {step === 2 && 'Add or remove members from this space.'}
              {step === 3 && 'Change the workflow for this space.'}
              {step === 4 && 'Set default views for this space.'}
            </p>
          </div>
          <button
            onClick={() => onOpenChange(false)}
            className="rounded-md p-1 text-muted-foreground/60 hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <StepBar step={step} />

        {/* Loading overlay */}
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {!isLoading && (
          <>
            {/* ── Step 1: Info ── */}
            {step === 1 && (
              <div className="px-6 pb-2 space-y-4">
                {/* Icon & name */}
                <div>
                  <p className="text-[13px] font-semibold text-foreground mb-2">Icon &amp; name</p>
                  <div className="flex items-center gap-3">
                    <div
                      className="h-9 w-9 shrink-0 rounded-lg flex items-center justify-center text-white text-[15px] font-bold select-none"
                      style={{ backgroundColor: iconColor }}
                    >
                      {iconLetter}
                    </div>
                    <div className="flex-1">
                      <input
                        ref={nameRef}
                        value={name}
                        onChange={e => { setName(e.target.value); if (e.target.value.trim()) setNameError('') }}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); goNext() } }}
                        placeholder="e.g. Marketing, Engineering, HR"
                        className={cn(
                          'w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground/50',
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
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-colors placeholder:text-muted-foreground/40"
                  />
                </div>

                {/* Default permission */}
                <div className="flex items-center justify-between py-0.5">
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-muted-foreground" />
                    <span className="text-[13px] font-medium text-foreground">Default permission</span>
                  </div>
                  <div className="relative">
                    <button
                      ref={permBtnRef}
                      onClick={e => { e.stopPropagation(); setPermOpen(o => !o) }}
                      className="flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[13px] font-medium text-foreground hover:bg-muted/60 transition-colors border border-border"
                    >
                      {permLoading && <span className="h-3 w-3 rounded-full border-2 border-primary border-t-transparent animate-spin" />}
                      {permLabel}
                      <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                    {permOpen && (
                      <PermissionPopup
                        anchorRef={permBtnRef}
                        templates={permTemplates}
                        selected={selectedPerm}
                        onSelect={setSelectedPerm}
                        onClose={() => setPermOpen(false)}
                      />
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ── Step 2: Members ── */}
            {step === 2 && (
              <div className="px-6 pb-2">
                <MemberPicker
                  staffProfiles={staffProfiles}
                  selectedStaff={selectedStaff}
                  onToggle={toggleMember}
                  autoFocus
                  maxHeight={300}
                />
              </div>
            )}

            {/* ── Step 3: Workflow ── */}
            {step === 3 && (
              <div className="px-6 pb-2 space-y-3">
                <p className="text-[13px] text-muted-foreground">
                  Choose the workflow for this space. You can customize it later.
                </p>

                <button
                  onClick={() => setSelectedWorkflow('__default__')}
                  className={cn(
                    'w-full rounded-xl border-2 p-4 text-left transition-all',
                    selectedWorkflow === '__default__' ? 'border-primary bg-primary/5' : 'border-border hover:border-muted-foreground/40'
                  )}
                >
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-[13px] font-semibold text-foreground">Default Workflow</p>
                    {selectedWorkflow === '__default__' && (
                      <div className="h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                        <Check className="h-3 w-3 text-white" />
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {DEFAULT_WORKFLOW.map(s => (
                      <span
                        key={s.slug}
                        className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold text-white"
                        style={{ backgroundColor: s.color }}
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-white/60 shrink-0" />
                        {s.name}
                      </span>
                    ))}
                  </div>
                </button>

                {templatesLoading ? (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : templates.map(tmpl => {
                  const statuses = (tmpl.statuses as any[]) ?? []
                  return (
                    <button
                      key={tmpl.id}
                      onClick={() => setSelectedWorkflow(tmpl.id)}
                      className={cn(
                        'w-full rounded-xl border-2 p-4 text-left transition-all',
                        selectedWorkflow === tmpl.id ? 'border-primary bg-primary/5' : 'border-border hover:border-muted-foreground/40'
                      )}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-[13px] font-semibold text-foreground">{tmpl.name}</p>
                        {selectedWorkflow === tmpl.id && (
                          <div className="h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                            <Check className="h-3 w-3 text-white" />
                          </div>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {statuses.map((s: any, i: number) => (
                          <span
                            key={i}
                            className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold text-white"
                            style={{ backgroundColor: s.color ?? '#94a3b8' }}
                          >
                            <span className="h-1.5 w-1.5 rounded-full bg-white/60 shrink-0" />
                            {s.name}
                          </span>
                        ))}
                      </div>
                    </button>
                  )
                })}
              </div>
            )}

            {/* ── Step 4: Settings ── */}
            {step === 4 && (
              <div className="px-6 pb-2 space-y-2">
                <p className="text-[13px] text-muted-foreground mb-1">
                  Choose which views are available in this space by default.
                </p>
                {[
                  { key: 'list',     label: 'List',     desc: 'Track tasks in a structured list view',       icon: List,          value: viewList,     set: setViewList },
                  { key: 'board',    label: 'Board',    desc: 'Visualize tasks as cards on a kanban board',  icon: LayoutGrid,    value: viewBoard,    set: setViewBoard },
                  { key: 'timeline', label: 'Timeline', desc: 'Plan work on a timeline / Gantt chart',       icon: CalendarRange, value: viewTimeline, set: setViewTimeline },
                ].map(({ key, label, desc, icon: Icon, value, set }) => (
                  <div key={key} className="flex items-center justify-between rounded-xl border border-border px-4 py-3 hover:bg-muted/30 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-[13px] font-semibold text-foreground">{label}</p>
                        <p className="text-[11px] text-muted-foreground">{desc}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={value}
                      onClick={() => set(v => !v)}
                      className={cn(
                        'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200',
                        value ? 'bg-primary' : 'bg-muted-foreground/30'
                      )}
                    >
                      <span className={cn(
                        'pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform duration-200',
                        value ? 'translate-x-4' : 'translate-x-0'
                      )} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-border/60 bg-muted/20 mt-2">
          {step > 1 ? (
            <button
              onClick={goBack}
              className="flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              Back
            </button>
          ) : <div />}

          {step < 4 ? (
            <button
              onClick={goNext}
              disabled={isLoading}
              className="flex items-center gap-1.5 rounded-lg bg-foreground text-background px-5 py-2 text-[13px] font-semibold hover:bg-foreground/90 disabled:opacity-50 transition-colors"
            >
              Continue
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          ) : (
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-2 rounded-lg bg-primary text-primary-foreground px-5 py-2 text-[13px] font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {isSaving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Save changes
            </button>
          )}
        </div>

      </DialogContent>
    </Dialog>
  )
}
