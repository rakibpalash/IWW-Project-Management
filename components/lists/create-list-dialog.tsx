'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { List, Space, Folder, Profile } from '@/types'
import { toast } from '@/components/ui/use-toast'
import { createListAction } from '@/app/actions/lists'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { X, Search, Check, ChevronDown, FolderOpen, ChevronRight } from 'lucide-react'
import { cn, getInitials } from '@/lib/utils'
import { useTaskConfig } from '@/hooks/use-task-config'

// ─── props ────────────────────────────────────────────────────────────────────

interface CreateListDialogProps {
  open:            boolean
  onOpenChange:    (open: boolean) => void
  spaces:          Space[]
  folders?:        Folder[]
  defaultSpaceId?: string | null
  defaultFolderId?: string | null
  onCreated?:      (list: List) => void
  profile?:        Profile
}

// ─── helpers ──────────────────────────────────────────────────────────────────

const SPACE_COLORS = [
  '#7c3aed','#0891b2','#0284c7','#059669',
  '#d97706','#dc2626','#db2777','#4f46e5',
]
function spaceColor(id: string) {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return SPACE_COLORS[h % SPACE_COLORS.length]
}

// ─── component ────────────────────────────────────────────────────────────────

export function CreateListDialog({
  open,
  onOpenChange,
  spaces,
  folders = [],
  defaultSpaceId,
  defaultFolderId,
  onCreated,
  profile,
}: CreateListDialogProps) {
  const router   = useRouter()
  const supabase = createClient()
  const { defaultStatus, defaultPriority } = useTaskConfig()

  // ── Location state ────────────────────────────────────────────────────────
  // We track the selected space_id and optionally a folder_id within that space
  const [selectedSpaceId,  setSelectedSpaceId]  = useState<string>('')
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null)

  // ── Form state ────────────────────────────────────────────────────────────
  const [name,        setName]        = useState('')
  const [description, setDescription] = useState('')
  const [isPrivate,   setIsPrivate]   = useState(false)
  const [nameError,   setNameError]   = useState('')
  const [wsError,     setWsError]     = useState('')
  const [loading,     setLoading]     = useState(false)

  // ── People picker ─────────────────────────────────────────────────────────
  const [allUsers,      setAllUsers]      = useState<Profile[]>([])
  const [memberSearch,  setMemberSearch]  = useState('')
  const [selectedStaff, setSelectedStaff] = useState<Set<string>>(new Set())
  const [shareOpen,     setShareOpen]     = useState(false)
  const shareRef = useRef<HTMLDivElement>(null)
  const nameRef  = useRef<HTMLInputElement>(null)

  // ── Location dropdown ─────────────────────────────────────────────────────
  const [locOpen,   setLocOpen]   = useState(false)
  const [locSearch, setLocSearch] = useState('')
  const locRef   = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  // Pre-select location on open
  useEffect(() => {
    if (open) {
      // Priority: defaultFolderId → defaultSpaceId → first space
      if (defaultFolderId && folders.length > 0) {
        const folder = folders.find(f => f.id === defaultFolderId)
        if (folder) {
          setSelectedSpaceId(folder.space_id)
          setSelectedFolderId(folder.id)
        } else {
          fallbackSpaceSelect()
        }
      } else if (defaultSpaceId) {
        setSelectedSpaceId(defaultSpaceId)
        setSelectedFolderId(null)
      } else {
        fallbackSpaceSelect()
      }

      setTimeout(() => nameRef.current?.focus(), 80)

      // Fetch members lazily
      const baseSelect = 'id, full_name, email, avatar_url, role, is_temp_password, onboarding_completed, created_at, updated_at'
      supabase
        .from('profiles')
        .select(baseSelect)
        .not('role', 'in', '("client","partner")')
        .order('full_name')
        .then(({ data }) => setAllUsers((data as Profile[]) ?? []))
    } else {
      // Reset
      setName(''); setDescription('')
      setIsPrivate(false); setNameError(''); setWsError('')
      setMemberSearch(''); setSelectedStaff(new Set())
      setShareOpen(false); setLocOpen(false); setLocSearch('')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  function fallbackSpaceSelect() {
    if (spaces.length >= 1) {
      setSelectedSpaceId(spaces[0].id)
      setSelectedFolderId(null)
    }
  }

  // Auto-focus the search box when dropdown opens
  useEffect(() => {
    if (locOpen) setTimeout(() => searchRef.current?.focus(), 30)
  }, [locOpen])

  // Click-outside handlers
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (shareRef.current && !shareRef.current.contains(e.target as Node)) setShareOpen(false)
      if (locRef.current && !locRef.current.contains(e.target as Node)) setLocOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  function toggleMember(id: string) {
    setSelectedStaff(prev => {
      const n = new Set(prev)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })
  }

  function selectSpace(spaceId: string) {
    setSelectedSpaceId(spaceId)
    setSelectedFolderId(null)
    setWsError('')
    setLocOpen(false)
    setLocSearch('')
  }

  function selectFolder(folder: Folder) {
    setSelectedSpaceId(folder.space_id)
    setSelectedFolderId(folder.id)
    setWsError('')
    setLocOpen(false)
    setLocSearch('')
  }

  async function handleCreate() {
    let valid = true
    if (!name.trim()) {
      setNameError('List name is required')
      nameRef.current?.focus()
      valid = false
    }
    const spaceId = selectedSpaceId || (spaces.length === 1 ? spaces[0].id : '')
    if (!spaceId) { setWsError('Please select a location'); valid = false }
    if (!valid) return

    setLoading(true)
    try {
      const result = await createListAction({
        space_id:    spaceId,
        folder_id:   selectedFolderId ?? null,
        name:        name.trim(),
        description: description.trim() || undefined,
        status:      defaultStatus || 'planning',
        priority:    defaultPriority || 'medium',
      })

      if (!result.success || !result.list) {
        toast({ title: 'Failed to create list', description: result.error, variant: 'destructive' })
        return
      }

      const data = result.list

      // Add members
      const { data: { user } } = await supabase.auth.getUser()
      if (user && selectedStaff.size > 0) {
        const memberInserts: { list_id: string; user_id: string; list_role: 'member' }[] = []
        selectedStaff.forEach(uid => {
          if (uid !== user.id) memberInserts.push({ list_id: data.id, user_id: uid, list_role: 'member' })
        })
        if (memberInserts.length > 0) await supabase.from('list_members').insert(memberInserts)
      }

      toast({ title: 'List created', description: `"${data.name}" has been created.` })
      onCreated?.(data as List)
      onOpenChange(false)
      router.push(`/lists/${data.id}`)
    } finally { setLoading(false) }
  }

  // ── Derived display values ────────────────────────────────────────────────
  const selectedSpace  = spaces.find(s => s.id === selectedSpaceId)
  const selectedFolder = selectedFolderId ? folders.find(f => f.id === selectedFolderId) : null

  const selectedMembers = allUsers.filter(u => selectedStaff.has(u.id))
  const filteredUsers   = allUsers.filter(u =>
    !memberSearch ||
    u.full_name.toLowerCase().includes(memberSearch.toLowerCase()) ||
    u.email.toLowerCase().includes(memberSearch.toLowerCase())
  )

  // Filtered spaces + folders for dropdown search
  const q = locSearch.toLowerCase()
  const filteredSpaces  = spaces.filter(s => !q || s.name.toLowerCase().includes(q))
  const filteredFolders = folders.filter(f => {
    if (!q) return true
    const space = spaces.find(s => s.id === f.space_id)
    return f.name.toLowerCase().includes(q) || space?.name.toLowerCase().includes(q)
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 gap-0 max-w-[500px] overflow-hidden rounded-xl border border-border shadow-2xl">

        {/* ── Header ── */}
        <div className="px-6 pt-6 pb-4 border-b border-border/50">
          <div className="flex items-start justify-between mb-1">
            <h2 className="text-[18px] font-bold text-foreground">Create List</h2>
            <button
              onClick={() => onOpenChange(false)}
              className="rounded-md p-1 text-muted-foreground/60 hover:text-foreground hover:bg-muted transition-colors -mt-0.5"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <p className="text-[13px] text-muted-foreground">
            All Lists are located within a Space. Lists can house any type of task.
          </p>
        </div>

        {/* ── Body ── */}
        <div className="px-6 py-5 space-y-4">

          {/* Name */}
          <div>
            <label className="text-[13px] font-semibold text-foreground block mb-1.5">
              Name <span className="text-red-500">*</span>
            </label>
            <input
              ref={nameRef}
              value={name}
              onChange={e => { setName(e.target.value); if (e.target.value.trim()) setNameError('') }}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleCreate() } }}
              placeholder="e.g. Project, List of items, Campaign"
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

          {/* Location (Space or Folder) */}
          <div>
            <label className="text-[13px] font-semibold text-foreground block mb-1.5">
              Space (location)
            </label>
            <div className="relative" ref={locRef}>
              {/* Trigger button */}
              <button
                type="button"
                onClick={() => setLocOpen(v => !v)}
                className={cn(
                  'w-full flex items-center gap-2 rounded-lg border bg-background px-3 py-2 text-sm transition-colors text-left',
                  wsError ? 'border-red-400' : 'border-border hover:border-muted-foreground/50',
                )}
              >
                {selectedFolder ? (
                  /* Folder selected */
                  <>
                    <FolderOpen className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="flex-1 flex items-center gap-1 min-w-0 truncate text-foreground">
                      {selectedSpace && (
                        <>
                          <span className="text-muted-foreground truncate shrink-0 max-w-[120px]">{selectedSpace.name}</span>
                          <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
                        </>
                      )}
                      <span className="font-medium truncate">{selectedFolder.name}</span>
                    </span>
                  </>
                ) : selectedSpace ? (
                  /* Space selected */
                  <>
                    <span
                      className="h-5 w-5 shrink-0 rounded flex items-center justify-center text-white text-[10px] font-bold"
                      style={{ backgroundColor: spaceColor(selectedSpace.id) }}
                    >
                      {selectedSpace.name.slice(0, 1).toUpperCase()}
                    </span>
                    <span className="flex-1 truncate font-medium">{selectedSpace.name}</span>
                  </>
                ) : (
                  <span className="flex-1 text-muted-foreground/50">Select a location</span>
                )}
                <ChevronDown className={cn('h-4 w-4 text-muted-foreground shrink-0 transition-transform', locOpen && 'rotate-180')} />
              </button>

              {/* Dropdown */}
              {locOpen && (
                <div className="absolute left-0 top-full mt-1 z-50 w-full rounded-lg border border-border bg-background shadow-xl overflow-hidden">
                  {/* Search */}
                  <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border/60">
                    <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <input
                      ref={searchRef}
                      value={locSearch}
                      onChange={e => setLocSearch(e.target.value)}
                      placeholder="Search..."
                      className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/50"
                    />
                  </div>

                  <div className="max-h-56 overflow-y-auto py-1">
                    {/* Spaces section */}
                    {filteredSpaces.length > 0 && (
                      <>
                        <p className="px-3 pt-1.5 pb-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">
                          Spaces
                        </p>
                        {filteredSpaces.map(ws => (
                          <button
                            key={ws.id}
                            onClick={() => selectSpace(ws.id)}
                            className="flex items-center gap-2.5 w-full px-3 py-2 text-sm hover:bg-muted/50 transition-colors text-left"
                          >
                            <span
                              className="h-5 w-5 shrink-0 rounded flex items-center justify-center text-white text-[10px] font-bold"
                              style={{ backgroundColor: spaceColor(ws.id) }}
                            >
                              {ws.name.slice(0, 1).toUpperCase()}
                            </span>
                            <span className="flex-1 truncate">{ws.name}</span>
                            {selectedSpaceId === ws.id && !selectedFolderId && (
                              <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                            )}
                          </button>
                        ))}
                      </>
                    )}

                    {/* Folders section */}
                    {filteredFolders.length > 0 && (
                      <>
                        <p className="px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">
                          Folders
                        </p>
                        {filteredFolders.map(folder => {
                          const parentSpace = spaces.find(s => s.id === folder.space_id)
                          const isSelected  = selectedFolderId === folder.id
                          return (
                            <button
                              key={folder.id}
                              onClick={() => selectFolder(folder)}
                              className={cn(
                                'flex items-center gap-2.5 w-full px-3 py-2 text-sm hover:bg-muted/50 transition-colors text-left',
                                isSelected && 'bg-primary/8',
                              )}
                            >
                              <FolderOpen className="h-4 w-4 shrink-0 text-muted-foreground" />
                              <span className="flex-1 min-w-0">
                                <span className="block truncate font-medium text-foreground">{folder.name}</span>
                                {parentSpace && (
                                  <span className="block text-[11px] text-muted-foreground truncate">{parentSpace.name}</span>
                                )}
                              </span>
                              {isSelected && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
                            </button>
                          )
                        })}
                      </>
                    )}

                    {filteredSpaces.length === 0 && filteredFolders.length === 0 && (
                      <p className="px-3 py-3 text-xs text-muted-foreground text-center">No results</p>
                    )}
                  </div>
                </div>
              )}
            </div>
            {wsError && <p className="text-xs text-red-500 mt-1">{wsError}</p>}
          </div>

          {/* Make Private */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[13px] font-medium text-foreground">Make private</p>
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

            {/* Share only with — shown when private */}
            {isPrivate && (
              <div>
                <p className="text-[12px] font-medium text-muted-foreground mb-2">Share only with</p>
                <div className="relative" ref={shareRef}>
                  <div className="flex items-center gap-1.5 flex-wrap">
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
                    <button
                      onClick={() => setShareOpen(v => !v)}
                      className="h-7 w-7 rounded-full border-2 border-dashed border-border flex items-center justify-center text-muted-foreground hover:border-primary hover:text-primary transition-colors text-lg leading-none"
                    >
                      +
                    </button>
                  </div>

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
                      <div className="max-h-52 overflow-y-auto py-1">
                        <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">People</p>
                        {profile && (
                          <button
                            onClick={() => { toggleMember(profile.id); setMemberSearch(''); setShareOpen(false) }}
                            className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-left hover:bg-muted/50 transition-colors"
                          >
                            <div className="h-6 w-6 rounded-full bg-primary flex items-center justify-center text-[9px] font-bold text-primary-foreground shrink-0">
                              {getInitials(profile.full_name)}
                            </div>
                            <span className="flex-1">Me</span>
                            {selectedStaff.has(profile.id) && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
                          </button>
                        )}
                        {filteredUsers.filter(u => u.id !== profile?.id).map(u => (
                          <button
                            key={u.id}
                            onClick={() => { toggleMember(u.id); setMemberSearch(''); setShareOpen(false) }}
                            className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-left hover:bg-muted/50 transition-colors"
                          >
                            <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center text-[9px] font-bold text-foreground shrink-0">
                              {getInitials(u.full_name)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="truncate font-medium">{u.full_name}</p>
                              <p className="truncate text-[11px] text-muted-foreground">{u.email}</p>
                            </div>
                            {selectedStaff.has(u.id) && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
                          </button>
                        ))}
                        {filteredUsers.length === 0 && (
                          <p className="px-3 py-2 text-xs text-muted-foreground">No members found</p>
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
        <div className="flex items-center justify-end px-6 py-4 border-t border-border/60">
          <button
            onClick={handleCreate}
            disabled={loading}
            className={cn(
              'rounded-lg px-5 py-2 text-[13px] font-semibold transition-colors',
              name.trim()
                ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                : 'bg-muted text-muted-foreground cursor-not-allowed',
            )}
          >
            {loading ? 'Creating…' : 'Create'}
          </button>
        </div>

      </DialogContent>
    </Dialog>
  )
}
