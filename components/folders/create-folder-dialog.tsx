'use client'

import { useState, useTransition, useEffect, useRef } from 'react'
import { createFolderAction } from '@/app/actions/folders'
import {
  getStatusTemplatesAction, saveStatusTemplateAction, deleteStatusTemplateAction,
  type StatusTemplateRow,
} from '@/app/actions/status-templates'
import { useToast } from '@/components/ui/use-toast'
import { Switch } from '@/components/ui/switch'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Folder, Profile } from '@/types'
import {
  Loader2, ChevronRight, HelpCircle, ArrowLeft, X, Plus,
  Check, MoreHorizontal, Search, GripVertical, Pencil, Droplets, ChevronDown, Trash2,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

// ─── Status types ──────────────────────────────────────────────────────────────
type StatusGroup = 'not_started' | 'active' | 'done' | 'closed'

interface CustomStatus {
  id: string
  name: string
  color: string
  group: StatusGroup
}

const DEFAULT_STATUSES: CustomStatus[] = [
  { id: 's1', name: 'TO DO',       color: '#94a3b8', group: 'not_started' },
  { id: 's2', name: 'IN PROGRESS', color: '#6366f1', group: 'active'      },
  { id: 's3', name: 'COMPLETE',    color: '#22c55e', group: 'closed'      },
]

const STATUS_COLORS = [
  '#7c3aed', '#3b82f6', '#06b6d4', '#10b981', '#22c55e', '#eab308', '#f97316',
  '#ef4444', '#ec4899', '#a855f7', '#78716c', '#94a3b8',
]

const GROUPS: { key: StatusGroup; label: string }[] = [
  { key: 'not_started', label: 'Not started' },
  { key: 'active',      label: 'Active'      },
  { key: 'done',        label: 'Done'        },
  { key: 'closed',      label: 'Closed'      },
]

// ─── Status icon ──────────────────────────────────────────────────────────────
function StatusIcon({ group, color, size = 16 }: { group: StatusGroup; color: string; size?: number }) {
  if (group === 'not_started') {
    return (
      <svg width={size} height={size} viewBox="0 0 18 18" fill="none" style={{ flexShrink: 0 }}>
        <circle cx="9" cy="9" r="7.5" stroke={color} strokeWidth="1.8" strokeDasharray="3.5 2.5" />
      </svg>
    )
  }
  if (group === 'active') {
    return (
      <svg width={size} height={size} viewBox="0 0 18 18" fill="none" style={{ flexShrink: 0 }}>
        <circle cx="9" cy="9" r="7.5" stroke={color} strokeWidth="1.8" />
        <circle cx="9" cy="9" r="4" fill={color} />
      </svg>
    )
  }
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none" style={{ flexShrink: 0 }}>
      <circle cx="9" cy="9" r="9" fill={color} />
      <path d="M5.5 9.5L7.5 11.5L12.5 6.5" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// ─── Color swatch picker ──────────────────────────────────────────────────────
function ColorPicker({ onSelect, onClose }: { onSelect: (c: string) => void; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    setTimeout(() => document.addEventListener('mousedown', handler), 0)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  return (
    <div
      ref={ref}
      className="absolute z-[200] bg-white border border-gray-200 rounded-xl shadow-xl p-3 w-44"
      style={{ top: '100%', left: 0, marginTop: 4 }}
    >
      <p className="text-[10px] font-semibold text-gray-400 mb-2 uppercase tracking-wider">Color</p>
      <div className="grid grid-cols-7 gap-1.5">
        {STATUS_COLORS.map(c => (
          <button
            key={c}
            type="button"
            onClick={() => { onSelect(c); onClose() }}
            className="h-5 w-5 rounded-full hover:scale-110 transition-transform"
            style={{ background: c }}
          />
        ))}
        <button
          type="button"
          className="h-5 w-5 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-400 hover:border-gray-400 transition-colors"
        >
          <Plus className="h-2.5 w-2.5" />
        </button>
      </div>
    </div>
  )
}

// ─── Props ────────────────────────────────────────────────────────────────────
interface CreateFolderDialogProps {
  open: boolean
  spaceId: string
  spaceName?: string
  onOpenChange: (open: boolean) => void
  onCreated?: (folder: Folder) => void
}

// ─── Component ────────────────────────────────────────────────────────────────
export function CreateFolderDialog({
  open, spaceId, spaceName, onOpenChange, onCreated,
}: CreateFolderDialogProps) {
  const { toast } = useToast()
  const [isPending, startTransition] = useTransition()
  const supabase = createClient()

  const [view, setView] = useState<'main' | 'statuses'>('main')

  // Main form
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [isPrivate, setIsPrivate] = useState(false)
  const [sharedWith, setSharedWith] = useState<Profile[]>([])
  const [memberSearch, setMemberSearch] = useState('')
  const [showMemberSearch, setShowMemberSearch] = useState(false)
  const [spaceMembers, setSpaceMembers] = useState<Profile[]>([])

  // Statuses
  const [statusType, setStatusType] = useState<'inherit' | 'custom'>('inherit')
  const [customStatuses, setCustomStatuses] = useState<CustomStatus[]>(DEFAULT_STATUSES)

  // Template state
  const [templates, setTemplates] = useState<StatusTemplateRow[]>([])
  const [templatesLoaded, setTemplatesLoaded] = useState(false)
  const [showTemplateDropdown, setShowTemplateDropdown] = useState(false)
  const [templateSearch, setTemplateSearch] = useState('')
  const [selectedTemplateName, setSelectedTemplateName] = useState('Custom')
  const [showSaveTemplateModal, setShowSaveTemplateModal] = useState(false)
  const [saveTemplateName, setSaveTemplateName] = useState('')
  const [isSavingTemplate, startSavingTemplate] = useTransition()

  // Status editing
  const [addingGroup, setAddingGroup] = useState<StatusGroup | null>(null)
  const [addingName, setAddingName] = useState('')
  const [addingColor, setAddingColor] = useState('#94a3b8')
  const [showAddColorPicker, setShowAddColorPicker] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null)
  const [colorPickerId, setColorPickerId] = useState<string | null>(null)

  // Fetch space members + status templates when dialog opens
  useEffect(() => {
    if (!open) return
    supabase
      .from('space_assignments')
      .select('user:profiles(id, full_name, email, avatar_url, role, is_temp_password, onboarding_completed, created_at, updated_at)')
      .eq('space_id', spaceId)
      .then(({ data }) => {
        setSpaceMembers(((data ?? []) as any[]).map((d: any) => d.user).filter(Boolean) as Profile[])
      })
    if (!templatesLoaded) {
      getStatusTemplatesAction().then(res => {
        if (res.success) { setTemplates(res.templates ?? []); setTemplatesLoaded(true) }
      })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, spaceId])

  function reset() {
    setName(''); setDescription(''); setIsPrivate(false); setSharedWith([])
    setMemberSearch(''); setShowMemberSearch(false)
    setStatusType('inherit'); setCustomStatuses(DEFAULT_STATUSES)
    setSelectedTemplateName('Custom'); setShowTemplateDropdown(false)
    setShowSaveTemplateModal(false); setSaveTemplateName('')
    setView('main'); setAddingGroup(null); setAddingName('')
    setEditingId(null); setMenuOpenId(null); setColorPickerId(null)
  }

  function handleClose() { reset(); onOpenChange(false) }

  function handleCreate() {
    if (!name.trim() || isPending) return
    startTransition(async () => {
      const result = await createFolderAction({
        space_id: spaceId,
        name: name.trim(),
        description: description.trim() || undefined,
        is_private: isPrivate,
        shared_with: sharedWith.map(m => m.id),
        status_type: statusType,
        custom_statuses: statusType === 'custom' ? customStatuses : [],
      })
      if (!result.success || !result.folder) {
        toast({ title: 'Failed to create folder', description: result.error, variant: 'destructive' })
        return
      }
      toast({ title: 'Folder created', description: `"${result.folder.name}" was created.` })
      onCreated?.(result.folder)
      handleClose()
    })
  }

  function commitAdd(group: StatusGroup) {
    if (!addingName.trim()) { setAddingGroup(null); return }
    setCustomStatuses(prev => [...prev, {
      id: `s${Date.now()}`, name: addingName.trim().toUpperCase(), color: addingColor, group,
    }])
    setAddingName(''); setAddingGroup(null)
  }

  function commitRename(id: string) {
    if (editingName.trim()) setCustomStatuses(prev => prev.map(s => s.id === id ? { ...s, name: editingName.trim().toUpperCase() } : s))
    setEditingId(null)
  }

  function handleSaveTemplate() {
    if (!saveTemplateName.trim() || isSavingTemplate) return
    startSavingTemplate(async () => {
      const res = await saveStatusTemplateAction({ name: saveTemplateName.trim(), statuses: customStatuses })
      if (!res.success || !res.template) {
        toast({ title: 'Failed to save template', description: res.error, variant: 'destructive' })
        return
      }
      setTemplates(prev => [...prev, res.template!])
      setSelectedTemplateName(res.template!.name)
      setShowSaveTemplateModal(false)
      setSaveTemplateName('')
      toast({ title: 'Template saved', description: `"${res.template!.name}" saved.` })
    })
  }

  const filteredMembers = spaceMembers.filter(m =>
    !sharedWith.find(s => s.id === m.id) &&
    (m.full_name.toLowerCase().includes(memberSearch.toLowerCase()) ||
     m.email.toLowerCase().includes(memberSearch.toLowerCase()))
  )

  function inits(n: string) { return n.split(' ').map(x => x[0]).join('').slice(0, 2).toUpperCase() }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        className={cn(
          'p-0 gap-0 overflow-hidden bg-white [&>button:last-child]:hidden',
          view === 'statuses' ? 'sm:max-w-2xl' : 'sm:max-w-[480px]',
        )}
      >

        {/* ═══════════════  MAIN VIEW  ═══════════════ */}
        {view === 'main' && (
          <div>
            {/* Header */}
            <div className="flex items-start justify-between px-6 pt-6 pb-3">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Create Folder</h2>
                <p className="text-sm text-gray-400 mt-1">Use Folders to organize your Lists, Docs, and more.</p>
              </div>
              <button
                type="button" onClick={handleClose}
                className="h-8 w-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 transition-colors shrink-0 mt-0.5"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Body */}
            <div className="px-6 space-y-5 pb-2">
              {/* Name */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Name</label>
                <div className="relative">
                  <input
                    value={name}
                    onChange={e => setName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleCreate() }}
                    placeholder="e.g. Project, Client, Team"
                    autoFocus
                    disabled={isPending}
                    className="w-full h-11 pl-4 pr-10 text-sm rounded-xl border border-gray-200 focus:outline-none focus:border-[#00c4a0] focus:ring-1 focus:ring-[#00c4a0] transition-colors"
                  />
                  <Droplets className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-300 pointer-events-none" />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Description</label>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Tell us a bit about your Folder (optional)"
                  disabled={isPending}
                  rows={2}
                  className="w-full px-4 py-2.5 text-sm rounded-xl border border-gray-200 focus:outline-none focus:border-[#00c4a0] focus:ring-1 focus:ring-[#00c4a0] resize-none transition-colors"
                />
              </div>

              {/* Settings */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Settings</label>
                <button
                  type="button"
                  onClick={() => setView('statuses')}
                  className="w-full flex items-center gap-3 p-3.5 rounded-xl border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-colors text-left"
                >
                  <span className="h-9 w-9 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                      <circle cx="9" cy="9" r="7.5" stroke="#94a3b8" strokeWidth="1.5" />
                      <circle cx="9" cy="9" r="3.5" fill="#94a3b8" />
                    </svg>
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800">Statuses</p>
                    <div className="flex items-center gap-0.5 mt-0.5 overflow-hidden">
                      {statusType === 'inherit' ? (
                        <span className="text-xs text-gray-400">Use Space statuses</span>
                      ) : (
                        customStatuses.slice(0, 3).map((s, i) => (
                          <span key={s.id} className="flex items-center gap-0.5 text-xs text-gray-400 shrink-0">
                            {i > 0 && <span className="text-gray-300 mx-0.5">→</span>}
                            <StatusIcon group={s.group} color={s.color} size={10} />
                            <span>{s.name}</span>
                          </span>
                        ))
                      )}
                      {statusType === 'custom' && customStatuses.length > 3 && (
                        <span className="text-xs text-gray-400 ml-0.5">…</span>
                      )}
                    </div>
                  </div>
                  <HelpCircle className="h-4 w-4 text-gray-300 shrink-0" />
                  <ChevronRight className="h-4 w-4 text-gray-400 shrink-0" />
                </button>
              </div>

              {/* Make private */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-gray-800">Make private</p>
                    <p className="text-xs text-gray-400 mt-0.5">Only you and invited members have access</p>
                  </div>
                  <Switch
                    checked={isPrivate}
                    onCheckedChange={setIsPrivate}
                    className="data-[state=checked]:bg-[#00c4a0]"
                  />
                </div>

                {isPrivate && (
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-gray-600">Share only with</p>
                    <div className="relative flex items-center gap-1.5">
                      <div className="flex -space-x-1.5">
                        {sharedWith.map(m => (
                          <Avatar key={m.id} className="h-7 w-7 border-2 border-white">
                            <AvatarImage src={m.avatar_url ?? undefined} />
                            <AvatarFallback className="text-[10px] bg-teal-100 text-teal-700">{inits(m.full_name)}</AvatarFallback>
                          </Avatar>
                        ))}
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowMemberSearch(o => !o)}
                        className="h-7 w-7 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-400 hover:border-[#00c4a0] hover:text-[#00c4a0] transition-colors"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>

                      {showMemberSearch && (
                        <div className="absolute right-0 bottom-full mb-2 z-50 w-64 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden">
                          <div className="p-2 border-b border-gray-100">
                            <div className="relative">
                              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                              <input
                                value={memberSearch}
                                onChange={e => setMemberSearch(e.target.value)}
                                placeholder="Search or enter email..."
                                autoFocus
                                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-gray-200 focus:outline-none focus:border-[#00c4a0]"
                              />
                            </div>
                          </div>
                          <div className="max-h-44 overflow-y-auto">
                            {filteredMembers.length === 0 ? (
                              <p className="text-xs text-gray-400 text-center py-4">No members found</p>
                            ) : filteredMembers.map(m => (
                              <button
                                key={m.id}
                                type="button"
                                onClick={() => { setSharedWith(prev => [...prev, m]); setMemberSearch(''); setShowMemberSearch(false) }}
                                className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-gray-50 transition-colors text-left"
                              >
                                <Avatar className="h-6 w-6 shrink-0">
                                  <AvatarImage src={m.avatar_url ?? undefined} />
                                  <AvatarFallback className="text-[9px] bg-blue-100 text-blue-700">{inits(m.full_name)}</AvatarFallback>
                                </Avatar>
                                <span className="text-sm text-gray-700 truncate">{m.full_name}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end px-6 py-4 mt-3 border-t border-gray-100">
              <button
                type="button"
                onClick={handleCreate}
                disabled={!name.trim() || isPending}
                className="flex items-center gap-2 px-7 h-10 rounded-xl bg-[#00c4a0] hover:bg-[#00b090] text-white text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Create
              </button>
            </div>
          </div>
        )}

        {/* ═══════════════  STATUSES VIEW  ═══════════════ */}
        {view === 'statuses' && (
          <div className="flex flex-col" style={{ minHeight: 520, maxHeight: '80vh' }}>
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
              <div className="flex items-center gap-3">
                <button
                  type="button" onClick={() => setView('main')}
                  className="h-7 w-7 flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
                <h2 className="text-base font-bold text-gray-900">Statuses</h2>
              </div>
              <button
                type="button" onClick={handleClose}
                className="h-8 w-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Two-panel body */}
            <div className="flex flex-1 overflow-hidden">
              {/* Left panel */}
              <div className="w-60 shrink-0 border-r border-gray-100 p-5 space-y-6 overflow-y-auto">
                <div>
                  <p className="text-[11px] font-semibold text-gray-400 mb-3 uppercase tracking-wider flex items-center gap-1">
                    Status type <HelpCircle className="h-3 w-3 text-gray-300" />
                  </p>
                  <div className="space-y-3">
                    {(['inherit', 'custom'] as const).map(type => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setStatusType(type)}
                        className="flex items-center gap-2.5 w-full text-left"
                      >
                        <span className={cn(
                          'h-4 w-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors',
                          statusType === type ? 'border-[#00c4a0]' : 'border-gray-300'
                        )}>
                          {statusType === type && <span className="h-2 w-2 rounded-full bg-[#00c4a0]" />}
                        </span>
                        <span className="text-sm text-gray-700">
                          {type === 'inherit' ? 'Inherit from Space' : 'Use custom statuses'}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {statusType === 'custom' && (
                  <div className="relative">
                    <p className="text-[11px] font-semibold text-gray-400 mb-2 uppercase tracking-wider">Status template</p>
                    <button
                      type="button"
                      onClick={() => { setShowTemplateDropdown(o => !o); setTemplateSearch('') }}
                      className="w-full flex items-center justify-between px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 bg-white hover:border-gray-300 transition-colors"
                    >
                      <span>{selectedTemplateName}</span>
                      <ChevronDown className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                    </button>

                    {showTemplateDropdown && (
                      <div className="absolute left-0 top-full mt-1 z-50 w-full bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden">
                        {/* Search */}
                        <div className="p-2 border-b border-gray-100">
                          <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                            <input
                              value={templateSearch}
                              onChange={e => setTemplateSearch(e.target.value)}
                              placeholder="Search..."
                              autoFocus
                              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-gray-200 focus:outline-none focus:border-[#00c4a0]"
                            />
                          </div>
                        </div>
                        {/* List */}
                        <div className="max-h-44 overflow-y-auto">
                          {/* "Custom" option */}
                          <button
                            type="button"
                            onClick={() => {
                              setCustomStatuses(DEFAULT_STATUSES)
                              setSelectedTemplateName('Custom')
                              setShowTemplateDropdown(false)
                            }}
                            className="w-full flex items-center justify-between px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                          >
                            <span>Custom</span>
                            {selectedTemplateName === 'Custom' && <Check className="h-3.5 w-3.5 text-[#00c4a0]" />}
                          </button>
                          {templates
                            .filter(t => t.name.toLowerCase().includes(templateSearch.toLowerCase()))
                            .map(t => (
                              <div key={t.id} className="group/tpl flex items-center px-3 py-2 hover:bg-gray-50 transition-colors">
                                <button
                                  type="button"
                                  onClick={() => {
                                    const loaded = (t.statuses as any[]).map((s, i) => ({
                                      ...s,
                                      id: `tpl-${Date.now()}-${i}`,
                                    })) as CustomStatus[]
                                    setCustomStatuses(loaded)
                                    setSelectedTemplateName(t.name)
                                    setShowTemplateDropdown(false)
                                  }}
                                  className="flex-1 text-sm text-gray-700 text-left"
                                >
                                  {t.name}
                                </button>
                                <div className="flex items-center gap-1 opacity-0 group-hover/tpl:opacity-100 transition-opacity shrink-0">
                                  {selectedTemplateName === t.name && <Check className="h-3.5 w-3.5 text-[#00c4a0]" />}
                                  <button
                                    type="button"
                                    onClick={async (e) => {
                                      e.stopPropagation()
                                      const res = await deleteStatusTemplateAction(t.id)
                                      if (res.success) {
                                        setTemplates(prev => prev.filter(x => x.id !== t.id))
                                        if (selectedTemplateName === t.name) setSelectedTemplateName('Custom')
                                      }
                                    }}
                                    className="h-4 w-4 flex items-center justify-center rounded text-gray-400 hover:text-red-500 transition-colors"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          {templates.filter(t => t.name.toLowerCase().includes(templateSearch.toLowerCase())).length === 0 &&
                            templateSearch && (
                            <p className="text-xs text-gray-400 text-center py-3">No templates found</p>
                          )}
                        </div>
                        {/* New template */}
                        <div className="border-t border-gray-100 p-2">
                          <button
                            type="button"
                            onClick={() => { setShowTemplateDropdown(false); setShowSaveTemplateModal(true); setSaveTemplateName('') }}
                            className="w-full flex items-center gap-2 px-2 py-1.5 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
                          >
                            <Plus className="h-3.5 w-3.5" />
                            New template
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Right panel */}
              <div className="flex-1 overflow-y-auto p-5 space-y-5">
                {statusType === 'inherit' ? (
                  <div className="flex flex-col items-center justify-center h-full text-center gap-3 py-12">
                    <svg width="44" height="44" viewBox="0 0 44 44" fill="none" className="opacity-20">
                      <circle cx="22" cy="22" r="20" stroke="#94a3b8" strokeWidth="2" strokeDasharray="6 4" />
                    </svg>
                    <p className="text-sm font-medium text-gray-500">Inheriting from Space</p>
                    <p className="text-xs text-gray-400 max-w-[200px] leading-relaxed">
                      This folder will use the Space's task status settings.
                    </p>
                    <button
                      type="button"
                      onClick={() => setStatusType('custom')}
                      className="text-xs text-[#00c4a0] hover:underline font-medium mt-1"
                    >
                      Use custom statuses instead
                    </button>
                  </div>
                ) : (
                  GROUPS.map(group => {
                    const groupStatuses = customStatuses.filter(s => s.group === group.key)
                    return (
                      <div key={group.key}>
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                            {group.label}
                            <HelpCircle className="h-3 w-3 text-gray-300" />
                          </p>
                          <button
                            type="button"
                            onClick={() => {
                              setAddingGroup(group.key)
                              setAddingColor(group.key === 'not_started' ? '#94a3b8' : group.key === 'closed' ? '#22c55e' : '#6366f1')
                              setAddingName('')
                            }}
                            className="h-5 w-5 flex items-center justify-center rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </div>

                        <div className="space-y-1.5">
                          {groupStatuses.map(status => (
                            <div
                              key={status.id}
                              className={cn(
                                'relative flex items-center gap-2 px-2.5 py-2 rounded-lg border bg-white group/row transition-colors',
                                editingId === status.id
                                  ? 'border-[#00c4a0] ring-1 ring-[#00c4a0]'
                                  : 'border-gray-200 hover:border-gray-300',
                              )}
                            >
                              <GripVertical className="h-3.5 w-3.5 text-gray-300 shrink-0 cursor-grab" />
                              <button
                                type="button"
                                onClick={() => setColorPickerId(id => id === status.id ? null : status.id)}
                                className="shrink-0"
                              >
                                <StatusIcon group={status.group} color={status.color} size={16} />
                              </button>

                              {colorPickerId === status.id && (
                                <div className="absolute left-8 top-full mt-1 z-50">
                                  <ColorPicker
                                    onSelect={color => {
                                      setCustomStatuses(prev => prev.map(s => s.id === status.id ? { ...s, color } : s))
                                      setColorPickerId(null)
                                    }}
                                    onClose={() => setColorPickerId(null)}
                                  />
                                </div>
                              )}

                              {editingId === status.id ? (
                                <input
                                  value={editingName}
                                  onChange={e => setEditingName(e.target.value)}
                                  onBlur={() => commitRename(status.id)}
                                  onKeyDown={e => {
                                    if (e.key === 'Enter') commitRename(status.id)
                                    if (e.key === 'Escape') setEditingId(null)
                                  }}
                                  className="flex-1 text-sm font-medium bg-transparent outline-none min-w-0"
                                  autoFocus
                                />
                              ) : (
                                <span className="flex-1 text-sm font-medium text-gray-800 truncate">{status.name}</span>
                              )}

                              <div className="relative ml-auto shrink-0">
                                <button
                                  type="button"
                                  onClick={() => setMenuOpenId(id => id === status.id ? null : status.id)}
                                  className="h-5 w-5 flex items-center justify-center rounded hover:bg-gray-100 text-gray-400 opacity-0 group-hover/row:opacity-100 transition-opacity"
                                >
                                  <MoreHorizontal className="h-3.5 w-3.5" />
                                </button>
                                {menuOpenId === status.id && (
                                  <div className="absolute right-0 top-full mt-1 z-50 bg-white border border-gray-200 rounded-xl shadow-xl py-1 min-w-[140px]">
                                    <button
                                      type="button"
                                      onClick={() => { setEditingId(status.id); setEditingName(status.name); setMenuOpenId(null) }}
                                      className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                                    >
                                      <Pencil className="h-3.5 w-3.5 text-gray-400" />
                                      Rename
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => { setColorPickerId(status.id); setMenuOpenId(null) }}
                                      className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                                    >
                                      <span className="h-3.5 w-3.5 rounded-full border border-gray-200 shrink-0" style={{ background: status.color }} />
                                      Change Color
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => { setCustomStatuses(prev => prev.filter(s => s.id !== status.id)); setMenuOpenId(null) }}
                                      className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-500 hover:bg-red-50"
                                    >
                                      <X className="h-3.5 w-3.5" />
                                      Delete
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}

                          {/* Inline add */}
                          {addingGroup === group.key ? (
                            <div className="relative flex items-center gap-2 px-2.5 py-2 rounded-lg border border-[#00c4a0] ring-1 ring-[#00c4a0] bg-white">
                              <button
                                type="button"
                                onClick={() => setShowAddColorPicker(o => !o)}
                                className="shrink-0"
                              >
                                <StatusIcon group={group.key} color={addingColor} size={16} />
                              </button>
                              {showAddColorPicker && (
                                <div className="absolute left-8 top-full mt-1 z-50">
                                  <ColorPicker
                                    onSelect={c => { setAddingColor(c); setShowAddColorPicker(false) }}
                                    onClose={() => setShowAddColorPicker(false)}
                                  />
                                </div>
                              )}
                              <input
                                value={addingName}
                                onChange={e => setAddingName(e.target.value)}
                                placeholder="Add status"
                                className="flex-1 text-sm bg-transparent outline-none min-w-0 placeholder:text-gray-300"
                                autoFocus
                                onKeyDown={e => {
                                  if (e.key === 'Enter') commitAdd(group.key)
                                  if (e.key === 'Escape') { setAddingGroup(null); setAddingName('') }
                                }}
                              />
                              <button
                                type="button"
                                onClick={() => commitAdd(group.key)}
                                className="h-5 w-5 flex items-center justify-center rounded bg-[#00c4a0] text-white shrink-0"
                              >
                                <Check className="h-3 w-3" />
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setAddingGroup(group.key)
                                setAddingColor(group.key === 'not_started' ? '#94a3b8' : group.key === 'closed' ? '#22c55e' : '#6366f1')
                                setAddingName('')
                              }}
                              className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg border border-dashed border-gray-200 text-gray-400 text-sm hover:border-gray-300 hover:text-gray-500 transition-colors"
                            >
                              <Plus className="h-3.5 w-3.5" />
                              Add status
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>

            {/* Statuses footer */}
            <div className="flex items-center justify-between px-6 py-3 border-t border-gray-100 bg-gray-50 shrink-0">
              <button type="button" disabled className="text-xs text-gray-400 flex items-center gap-1 cursor-not-allowed select-none">
                <HelpCircle className="h-3.5 w-3.5" />
                Learn more about statuses
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={statusType !== 'custom' || customStatuses.length === 0}
                  onClick={() => { setShowSaveTemplateModal(true); setSaveTemplateName('') }}
                  className="px-4 h-8 rounded-lg border border-gray-200 text-xs text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Save as template
                </button>
                <button
                  type="button"
                  onClick={() => setView('main')}
                  className="px-5 h-8 rounded-lg bg-[#00c4a0] hover:bg-[#00b090] text-white text-xs font-semibold transition-colors"
                >
                  Apply changes
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════  SAVE TEMPLATE MODAL  ═══════════════ */}
        {showSaveTemplateModal && (
          <div className="absolute inset-0 z-[300] flex items-center justify-center bg-black/20 rounded-xl">
            <div className="bg-white rounded-2xl shadow-2xl p-6 w-80 mx-4">
              <h3 className="text-base font-bold text-gray-900 mb-4">New template</h3>
              <div className="mb-5">
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Name</label>
                <input
                  value={saveTemplateName}
                  onChange={e => setSaveTemplateName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleSaveTemplate()
                    if (e.key === 'Escape') setShowSaveTemplateModal(false)
                  }}
                  placeholder="Enter a name..."
                  autoFocus
                  className="w-full h-10 px-3 text-sm rounded-xl border border-[#00c4a0] ring-1 ring-[#00c4a0] focus:outline-none"
                />
              </div>
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowSaveTemplateModal(false)}
                  className="px-4 h-9 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveTemplate}
                  disabled={!saveTemplateName.trim() || isSavingTemplate}
                  className="px-4 h-9 rounded-xl bg-[#00c4a0] hover:bg-[#00b090] text-white text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isSavingTemplate && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Save
                </button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
