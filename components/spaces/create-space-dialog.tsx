'use client'

import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { useToast } from '@/components/ui/use-toast'
import { createSpaceAction } from '@/app/actions/spaces'
import { listPermissionTemplatesAction, PermissionTemplate } from '@/app/actions/permission-templates'
import { Profile, Space } from '@/types'
import {
  X, Search, Shield, ChevronDown, Check,
  ChevronRight, ChevronLeft, List, LayoutGrid, CalendarRange,
  CircleDot, CheckCircle, CheckCircle2, GripVertical, Trash2, Plus,
} from 'lucide-react'
import { cn, getInitials } from '@/lib/utils'

type SpaceWithCounts = Space & { member_count: number; list_count: number }

interface CreateSpaceDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: (space: SpaceWithCounts) => void
  staffProfiles: Profile[]
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

// ── Workflow status types ──────────────────────────────────────────────────────
type WfCategory = 'not_started' | 'active' | 'done' | 'closed'
interface WfStatus { id: string; name: string; color: string; category: WfCategory }

const WF_CATEGORY_META: Record<WfCategory, { label: string; defaultColor: string }> = {
  not_started: { label: 'NOT STARTED', defaultColor: '#94a3b8' },
  active:      { label: 'ACTIVE',      defaultColor: '#3b82f6' },
  done:        { label: 'DONE',        defaultColor: '#22c55e' },
  closed:      { label: 'CLOSED',      defaultColor: '#ef4444' },
}
const WF_CATEGORIES: WfCategory[] = ['not_started', 'active', 'done', 'closed']

const DEFAULT_WF_STATUSES: WfStatus[] = [
  { id: 'wf1', name: 'To Do',       color: '#94a3b8', category: 'not_started' },
  { id: 'wf2', name: 'In Progress', color: '#3b82f6', category: 'active' },
  { id: 'wf3', name: 'In Review',   color: '#f59e0b', category: 'active' },
  { id: 'wf4', name: 'Done',        color: '#22c55e', category: 'done' },
  { id: 'wf5', name: 'Cancelled',   color: '#ef4444', category: 'closed' },
]

const WF_PRESET_COLORS = [
  '#94a3b8', '#3b82f6', '#f59e0b', '#22c55e', '#ef4444',
  '#8b5cf6', '#ec4899', '#0ea5e9', '#10b981', '#f97316',
]

function StatusIcon({ category, color }: { category: WfCategory; color: string }) {
  const cls = 'h-4 w-4 shrink-0'
  if (category === 'active')  return <CircleDot   className={cls} style={{ color }} />
  if (category === 'done')    return <CheckCircle  className={cls} style={{ color }} />
  if (category === 'closed')  return <CheckCircle2 className={cls} style={{ color }} />
  return (
    <svg className={cls} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2"
      strokeDasharray="3 3" strokeLinecap="round">
      <circle cx="12" cy="12" r="10" />
    </svg>
  )
}

// ── Role badge colours ────────────────────────────────────────────────────────
const ROLE_OPTIONS = [
  { value: 'account_manager', label: 'Org Admin',  color: '#7c3aed' },
  { value: 'project_manager', label: 'Team Lead',  color: '#0284c7' },
  { value: 'staff',           label: 'Staff',      color: '#059669' },
  { value: 'client',          label: 'Client',     color: '#d97706' },
  { value: 'partner',         label: 'Partner',    color: '#4f46e5' },
]

// ── Permission levels (fallback when no custom templates exist) ───────────────
const PERMISSION_LEVELS = [
  { value: 'full_edit',  label: 'Full edit',  desc: 'Can create, edit and delete everything' },
  { value: 'can_edit',   label: 'Can edit',   desc: 'Can edit tasks and content, not settings' },
  { value: 'view_only',  label: 'View only',  desc: 'Can view everything but not edit' },
  { value: 'no_access',  label: 'No access',  desc: 'Cannot see this space at all' },
]

// ── Step bar ──────────────────────────────────────────────────────────────────
function StepBar({ step }: { step: number }) {
  const labels = ['Info', 'Workflow', 'Settings']
  return (
    <div className="flex items-center px-6 pt-5 pb-3">
      {labels.map((label, i) => {
        const idx     = i + 1
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

// ── Permission popup (portal) ─────────────────────────────────────────────────
function PermissionPopup({
  anchorRef,
  templates,
  selected,
  onSelect,
  onClose,
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

  // Group templates by base_role
  const grouped = ROLE_OPTIONS.map(role => ({
    ...role,
    templates: templates.filter(t => t.base_role === role.value),
  }))

  return createPortal(
    <div
      style={{ position: 'fixed', top: coords.top, left: coords.left, zIndex: 9999, width: coords.width }}
      onMouseDown={e => e.stopPropagation()}
    >
      <div className="rounded-xl border border-border bg-background shadow-2xl overflow-hidden py-1.5">
        <p className="px-3 pt-1 pb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
          Default Permission
        </p>

        {templates.length > 0 ? (
          // Show existing permission templates grouped by role
          grouped.map(group =>
            group.templates.length > 0 ? (
              <div key={group.value}>
                <p className="px-3 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                  {group.label}
                </p>
                {group.templates.map(tmpl => (
                  <button
                    key={tmpl.id}
                    onClick={() => { onSelect(tmpl.id); onClose() }}
                    className="flex items-center justify-between w-full px-3 py-2 text-left hover:bg-muted/60 transition-colors"
                  >
                    <div>
                      <p className="text-[13px] font-semibold text-foreground">{tmpl.name}</p>
                      {tmpl.description && (
                        <p className="text-[11px] text-muted-foreground">{tmpl.description}</p>
                      )}
                    </div>
                    {selected === tmpl.id && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
                  </button>
                ))}
              </div>
            ) : null
          )
        ) : (
          // Fallback: standard permission levels
          PERMISSION_LEVELS.map(level => (
            <button
              key={level.value}
              onClick={() => { onSelect(level.value); onClose() }}
              className="flex items-center justify-between w-full px-3 py-2.5 text-left hover:bg-muted/60 transition-colors"
            >
              <div>
                <p className="text-[13px] font-semibold text-foreground">{level.label}</p>
                <p className="text-[11px] text-muted-foreground">{level.desc}</p>
              </div>
              {selected === level.value && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
            </button>
          ))
        )}
      </div>
    </div>,
    document.body
  )
}

// ── Shared member list sub-component ─────────────────────────────────────────
function MemberPicker({
  staffProfiles,
  selectedStaff,
  onToggle,
  autoFocus = true,
  maxHeight = 220,
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
        ) : (
          filtered.map(m => {
            const selected = selectedStaff.has(m.id)
            return (
              <button
                key={m.id}
                onClick={() => onToggle(m.id)}
                className={cn(
                  'flex items-center gap-3 w-full px-4 py-2.5 text-left transition-colors',
                  selected ? 'bg-primary/5' : 'hover:bg-muted/50'
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
                  selected ? 'bg-primary border-primary' : 'border-muted-foreground/30'
                )}>
                  {selected && <Check className="h-3 w-3 text-white" />}
                </div>
              </button>
            )
          })
        )}
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
export function CreateSpaceDialog({
  open,
  onOpenChange,
  onSuccess,
  staffProfiles,
}: CreateSpaceDialogProps) {
  const { toast } = useToast()

  // Step
  const [step, setStep] = useState(1)

  // Step 1 — Info
  const [name,        setName]        = useState('')
  const [description, setDescription] = useState('')
  const [isPrivate,   setIsPrivate]   = useState(false)
  const [nameError,   setNameError]   = useState('')
  const nameRef = useRef<HTMLInputElement>(null)

  // Step 1 — Permission popup
  const [permOpen,        setPermOpen]        = useState(false)
  const [selectedPerm,    setSelectedPerm]    = useState('full_edit')
  const [permTemplates,   setPermTemplates]   = useState<PermissionTemplate[]>([])
  const [permLoading,     setPermLoading]     = useState(false)
  const permBtnRef = useRef<HTMLButtonElement>(null)

  // Members (shared between step 1 private + step 2)
  const [selectedStaff, setSelectedStaff] = useState<Set<string>>(new Set())

  // Step 2 — Workflow
  const [wfStatuses,      setWfStatuses]      = useState<WfStatus[]>(DEFAULT_WF_STATUSES)
  const [addingCategory,  setAddingCategory]  = useState<WfCategory | null>(null)
  const [newStatusName,   setNewStatusName]   = useState('')
  const [newStatusColor,  setNewStatusColor]  = useState('#94a3b8')

  // Step 4 — Default views
  const [viewList,     setViewList]     = useState(true)
  const [viewBoard,    setViewBoard]    = useState(true)
  const [viewTimeline, setViewTimeline] = useState(false)

  const [isSubmitting, setIsSubmitting] = useState(false)

  // ── Reset on open/close ──────────────────────────────────────────────────
  useEffect(() => {
    if (open) {
      setTimeout(() => nameRef.current?.focus(), 80)
    } else {
      setStep(1)
      setName(''); setDescription(''); setIsPrivate(false); setNameError('')
      setPermOpen(false); setSelectedPerm('full_edit'); setPermTemplates([])
      setSelectedStaff(new Set())
      setWfStatuses(DEFAULT_WF_STATUSES); setAddingCategory(null); setNewStatusName('')
      setViewList(true); setViewBoard(true); setViewTimeline(false)
    }
  }, [open])

  // ── Fetch permission templates when popup opens ──────────────────────────
  useEffect(() => {
    if (permOpen && permTemplates.length === 0 && !permLoading) {
      setPermLoading(true)
      listPermissionTemplatesAction()
        .then(data => setPermTemplates(data))
        .finally(() => setPermLoading(false))
    }
  }, [permOpen])

  // ── Helpers ──────────────────────────────────────────────────────────────
  function confirmAddStatus() {
    if (!newStatusName.trim() || !addingCategory) return
    setWfStatuses(prev => [...prev, {
      id: `wf_${Date.now()}`,
      name: newStatusName.trim(),
      color: newStatusColor,
      category: addingCategory,
    }])
    setNewStatusName('')
    setAddingCategory(null)
  }

  function toggleMember(id: string) {
    setSelectedStaff(prev => {
      const n = new Set(prev)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })
  }

  function goNext() {
    if (step === 1) {
      if (!name.trim()) { setNameError('Space name is required'); nameRef.current?.focus(); return }
      setNameError('')
    }
    setStep(s => Math.min(s + 1, 3))
  }

  function goBack() { setStep(s => Math.max(s - 1, 1)) }

  async function handleSubmit() {
    if (!name.trim()) { setNameError('Space name is required'); return }
    setIsSubmitting(true)
    try {
      const result = await createSpaceAction({
        name: name.trim(),
        description: description.trim() || undefined,
        memberIds: [...selectedStaff],
      })
      if (!result.success || !result.space) {
        toast({ title: 'Failed to create space', description: result.error ?? 'Unknown error', variant: 'destructive' })
        return
      }
      toast({ title: 'Space created', description: `"${name.trim()}" has been created.` })
      onOpenChange(false)
      onSuccess({ ...result.space, member_count: selectedStaff.size, list_count: 0 })
    } finally {
      setIsSubmitting(false)
    }
  }

  // ── Derived ───────────────────────────────────────────────────────────────
  const iconColor  = pickColor(name)
  const iconLetter = name.trim().slice(0, 1).toUpperCase() || 'S'

  const permLabel = (() => {
    if (permTemplates.length > 0) {
      return permTemplates.find(t => t.id === selectedPerm)?.name ?? 'Full edit'
    }
    return PERMISSION_LEVELS.find(l => l.value === selectedPerm)?.label ?? 'Full edit'
  })()

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 gap-0 max-w-[500px] overflow-hidden rounded-xl border border-border shadow-2xl">

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-6 pt-5 pb-0">
          <div>
            <h2 className="text-[17px] font-bold text-foreground">Create a Space</h2>
            <p className="text-[12px] text-muted-foreground mt-0.5">
              {step === 1 && 'Name and configure your new space.'}
              {step === 2 && 'Choose the workflow for this space.'}
              {step === 3 && 'Set default views for this space.'}
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
              <div className="relative">
                <button
                  ref={permBtnRef}
                  onClick={e => { e.stopPropagation(); setPermOpen(o => !o) }}
                  className="flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[13px] font-medium text-foreground hover:bg-muted/60 transition-colors border border-border"
                >
                  {permLoading ? (
                    <span className="h-3 w-3 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                  ) : null}
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

            {/* Make Private */}
            <div className="space-y-3 pb-1">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[13px] font-medium text-foreground">Make Private</p>
                  <p className="text-[12px] text-muted-foreground mt-0.5">Only you and invited members have access</p>
                </div>
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
                  <span className={cn(
                    'pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform duration-200',
                    isPrivate ? 'translate-x-5' : 'translate-x-0'
                  )} />
                </button>
              </div>

              {/* Inline member assignment — only when private */}
              {isPrivate && (
                <MemberPicker
                  staffProfiles={staffProfiles}
                  selectedStaff={selectedStaff}
                  onToggle={toggleMember}
                  autoFocus={false}
                  maxHeight={200}
                />
              )}
            </div>
          </div>
        )}

        {/* ── Step 2: Workflow ── */}
        {step === 2 && (
          <div className="px-6 pb-2" style={{ maxHeight: 340, overflowY: 'auto' }}>
            {WF_CATEGORIES.map(cat => {
              const meta    = WF_CATEGORY_META[cat]
              const entries = wfStatuses.filter(s => s.category === cat)
              const isAdding = addingCategory === cat

              return (
                <div key={cat} className="mb-1">

                  {/* Category header */}
                  <div className="flex items-center justify-between py-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-bold tracking-widest text-muted-foreground">
                        {meta.label}
                      </span>
                      <button className="h-3.5 w-3.5 rounded-full border border-muted-foreground/30 text-[9px] text-muted-foreground/50 flex items-center justify-center leading-none">?</button>
                    </div>
                    <button
                      onClick={() => { setAddingCategory(cat); setNewStatusName(''); setNewStatusColor(meta.defaultColor) }}
                      className="h-6 w-6 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {/* Status rows */}
                  {entries.map(status => (
                    <div key={status.id}
                      className="group flex items-center gap-2.5 rounded-lg border border-border bg-background px-3 py-2.5 mb-1"
                    >
                      <GripVertical className="h-4 w-4 text-muted-foreground/30 shrink-0 cursor-grab" />
                      <StatusIcon category={cat} color={status.color} />
                      <span className="flex-1 text-[13px] font-semibold text-foreground">{status.name}</span>
                      <button
                        onClick={() => setWfStatuses(prev => prev.filter(s => s.id !== status.id))}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded text-muted-foreground hover:text-red-500 hover:bg-red-50 transition-all"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}

                  {/* Inline add row */}
                  {isAdding ? (
                    <div className="flex items-center gap-2 rounded-lg border border-primary/50 bg-background px-3 py-2.5 mb-1">
                      <StatusIcon category={cat} color={newStatusColor} />
                      <input
                        autoFocus
                        value={newStatusName}
                        onChange={e => setNewStatusName(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') confirmAddStatus()
                          if (e.key === 'Escape') setAddingCategory(null)
                        }}
                        placeholder="Status name..."
                        className="flex-1 bg-transparent text-[13px] font-semibold outline-none placeholder:text-muted-foreground/40"
                      />
                      <div className="flex items-center gap-1 shrink-0">
                        {WF_PRESET_COLORS.map(c => (
                          <button
                            key={c}
                            onClick={() => setNewStatusColor(c)}
                            className="h-3.5 w-3.5 rounded-full border-2 transition-transform hover:scale-110 shrink-0"
                            style={{ backgroundColor: c, borderColor: newStatusColor === c ? '#1d4ed8' : 'transparent' }}
                          />
                        ))}
                      </div>
                      <button onClick={confirmAddStatus}
                        className="text-[12px] font-semibold text-primary hover:text-primary/80 shrink-0 ml-1">
                        Add
                      </button>
                      <button onClick={() => setAddingCategory(null)}
                        className="text-[12px] text-muted-foreground hover:text-foreground shrink-0">
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => { setAddingCategory(cat); setNewStatusName(''); setNewStatusColor(meta.defaultColor) }}
                      className="flex items-center gap-1.5 w-full px-3 py-1.5 text-[12px] text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-lg transition-colors"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add status
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* ── Step 3: Settings ── */}
        {step === 3 && (
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

        {/* ── Footer ── */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-border/60 bg-muted/20 mt-2">
          {step > 1 ? (
            <button
              onClick={goBack}
              className="flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              Back
            </button>
          ) : (
            <div />
          )}

          {step < 3 ? (
            <button
              onClick={goNext}
              className="flex items-center gap-1.5 rounded-lg bg-foreground text-background px-5 py-2 text-[13px] font-semibold hover:bg-foreground/90 transition-colors"
            >
              Continue
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="rounded-lg bg-primary text-primary-foreground px-5 py-2 text-[13px] font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {isSubmitting ? 'Creating…' : 'Save'}
            </button>
          )}
        </div>

      </DialogContent>
    </Dialog>
  )
}
