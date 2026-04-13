'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Task, Profile, Project } from '@/types'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useToast } from '@/components/ui/use-toast'
import {
  X, Check, AlertCircle, Search, ChevronDown,
  Flag, Calendar, Tag, MoreHorizontal, Paperclip,
  Plus, ChevronRight, Hash, User, Users,
} from 'lucide-react'
import { MAX_SUBTASKS, MAX_SUBTASK_DEPTH } from '@/lib/constants'
import { getInitials, cn, formatDate } from '@/lib/utils'
import { useTaskConfig } from '@/hooks/use-task-config'

interface CreateTaskDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projects: Project[]
  profile: Profile
  onCreated: (task: Task) => void
  parentTaskId?: string
  parentTaskDepth?: number
  projectId?: string
  currentSubtaskCount?: number
}

// Quick date options
const QUICK_DATES = [
  { label: 'Today',        days: 0 },
  { label: 'Tomorrow',     days: 1 },
  { label: 'This weekend', days: null, fn: () => { const d = new Date(); d.setDate(d.getDate() + (6 - d.getDay())); return d } },
  { label: 'Next week',    days: 7 },
  { label: 'Next weekend', days: null, fn: () => { const d = new Date(); d.setDate(d.getDate() + (13 - d.getDay())); return d } },
  { label: '2 weeks',      days: 14 },
  { label: '4 weeks',      days: 28 },
]

function toDateStr(d: Date) {
  return d.toISOString().slice(0, 10)
}
function addDays(days: number) {
  const d = new Date(); d.setDate(d.getDate() + days); return d
}

// ─── Predefined tags ──────────────────────────────────────────────────────────
const PRESET_TAGS = [
  { name: 'brainstorm',     color: '#6366f1' },
  { name: 'component',      color: '#06b6d4' },
  { name: 'dark mode',      color: '#8b5cf6' },
  { name: 'dashboard',      color: '#3b82f6' },
  { name: 'design system',  color: '#0ea5e9' },
  { name: 'feedback',       color: '#f97316' },
  { name: 'form',           color: '#14b8a6' },
  { name: 'handoff',        color: '#ec4899' },
  { name: 'ideas',          color: '#84cc16' },
  { name: 'illustration',   color: '#a855f7' },
  { name: 'meeting',        color: '#f59e0b' },
  { name: 'ui design',      color: '#22c55e' },
]

// ─── Month calendar ───────────────────────────────────────────────────────────
function MiniCalendar({ selected, onSelect }: { selected: string; onSelect: (d: string) => void }) {
  const [viewDate, setViewDate] = useState(() => selected ? new Date(selected + 'T00:00:00') : new Date())
  const year  = viewDate.getFullYear()
  const month = viewDate.getMonth()

  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells: (number | null)[] = Array(firstDay).fill(null)
  for (let i = 1; i <= daysInMonth; i++) cells.push(i)
  while (cells.length % 7 !== 0) cells.push(null)

  const todayStr = toDateStr(new Date())

  return (
    <div className="select-none">
      {/* Month nav */}
      <div className="flex items-center justify-between mb-2 px-1">
        <button
          onClick={() => setViewDate(new Date(year, month - 1, 1))}
          className="h-6 w-6 rounded hover:bg-muted flex items-center justify-center text-muted-foreground"
        >
          <ChevronRight className="h-3.5 w-3.5 rotate-180" />
        </button>
        <span className="text-xs font-semibold">
          {viewDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </span>
        <button
          onClick={() => setViewDate(new Date(year, month + 1, 1))}
          className="h-6 w-6 rounded hover:bg-muted flex items-center justify-center text-muted-foreground"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
      {/* Day headers */}
      <div className="grid grid-cols-7 mb-1">
        {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => (
          <div key={d} className="text-center text-[10px] font-medium text-muted-foreground py-0.5">{d}</div>
        ))}
      </div>
      {/* Days */}
      <div className="grid grid-cols-7">
        {cells.map((day, i) => {
          if (!day) return <div key={i} />
          const dateStr = `${year}-${String(month + 1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
          const isSelected = dateStr === selected
          const isToday    = dateStr === todayStr
          return (
            <button
              key={i}
              onClick={() => onSelect(dateStr)}
              className={cn(
                'flex items-center justify-center h-7 w-7 mx-auto rounded-full text-xs transition-colors',
                isSelected && 'bg-primary text-primary-foreground font-semibold',
                !isSelected && isToday && 'border border-primary text-primary font-semibold',
                !isSelected && !isToday && 'hover:bg-muted text-foreground',
              )}
            >
              {day}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function CreateTaskDialog({
  open,
  onOpenChange,
  projects,
  profile,
  onCreated,
  parentTaskId,
  parentTaskDepth = 0,
  projectId: defaultProjectId,
  currentSubtaskCount = 0,
}: CreateTaskDialogProps) {
  const { toast } = useToast()
  const supabase = createClient()
  const titleRef = useRef<HTMLInputElement>(null)
  const { statuses, priorities, defaultStatus, defaultPriority } = useTaskConfig()

  const isSubtask = !!parentTaskId
  const depth     = isSubtask ? (parentTaskDepth ?? 0) + 1 : 0
  const canCreate = !isSubtask || (currentSubtaskCount < MAX_SUBTASKS && depth <= MAX_SUBTASK_DEPTH)

  // ── Core state ──────────────────────────────────────────────────────────────
  const [title,             setTitle]             = useState('')
  const [titleTouched,      setTitleTouched]      = useState(false)
  const [description,       setDescription]       = useState('')
  const [selectedProjectId, setSelectedProjectId] = useState(defaultProjectId ?? '')
  const [dueDate,           setDueDate]           = useState('')
  const [startDate,         setStartDate]         = useState('')
  const [priority,          setPriority]          = useState(defaultPriority || 'medium')
  const [status,            setStatus]            = useState(defaultStatus || 'todo')
  const [assigneeIds,       setAssigneeIds]       = useState<string[]>([])
  const [tags,              setTags]              = useState<string[]>([])
  const [members,           setMembers]           = useState<Profile[]>([])
  const [submitting,        setSubmitting]        = useState(false)

  // ── Popover state ───────────────────────────────────────────────────────────
  const [listOpen,        setListOpen]        = useState(false)
  const [assigneeOpen,    setAssigneeOpen]    = useState(false)
  const [dateOpen,        setDateOpen]        = useState(false)
  const [priorityOpen,    setPriorityOpen]    = useState(false)
  const [tagsOpen,        setTagsOpen]        = useState(false)
  const [listSearch,      setListSearch]      = useState('')
  const [assigneeSearch,  setAssigneeSearch]  = useState('')
  const [tagSearch,       setTagSearch]       = useState('')

  const titleError = titleTouched && !title.trim()
  const currentProject = projects.find(p => p.id === (selectedProjectId || defaultProjectId))
  const selectedStatusCfg   = statuses.find(s => s.slug === status)
  const selectedPriorityCfg = priorities.find(p => p.slug === priority)
  const assignedMembers     = members.filter(m => assigneeIds.includes(m.id))

  // ── Fetch members ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return
    ;(async () => {
      const profileSelect = 'id, full_name, email, avatar_url, role, is_temp_password, onboarding_completed, created_at, updated_at'
      const { data } = await supabase.from('profiles').select(profileSelect).neq('role', 'client').order('full_name')
      setMembers((data ?? []) as Profile[])
    })()
  }, [open])

  useEffect(() => {
    if (open) setTimeout(() => titleRef.current?.focus(), 50)
  }, [open])

  // ── Helpers ─────────────────────────────────────────────────────────────────
  function closeAllPopovers() {
    setListOpen(false); setAssigneeOpen(false)
    setDateOpen(false); setPriorityOpen(false); setTagsOpen(false)
  }

  function toggleAssignee(id: string) {
    setAssigneeIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }
  function toggleTag(name: string) {
    setTags(prev => prev.includes(name) ? prev.filter(x => x !== name) : [...prev, name])
  }

  function reset() {
    setTitle(''); setTitleTouched(false); setDescription('')
    if (!defaultProjectId) setSelectedProjectId('')
    setDueDate(''); setStartDate('')
    setPriority(defaultPriority || 'medium')
    setStatus(defaultStatus || 'todo')
    setAssigneeIds([]); setTags([])
    closeAllPopovers()
  }

  async function handleSubmit() {
    setTitleTouched(true)
    if (!title.trim()) { titleRef.current?.focus(); return }
    const projectId = selectedProjectId || defaultProjectId
    if (!projectId) { setListOpen(true); return }

    setSubmitting(true)
    try {
      const { data: newTask, error } = await supabase.from('tasks').insert({
        title: title.trim(),
        description: description.trim() || null,
        project_id: projectId,
        parent_task_id: parentTaskId ?? null,
        status, priority,
        due_date: dueDate || null,
        start_date: startDate || null,
        created_by: profile.id,
        depth,
      }).select('*').single()

      if (error || !newTask) throw error ?? new Error('Failed to create task')

      if (assigneeIds.length > 0)
        await supabase.from('task_assignees').insert(assigneeIds.map(uid => ({ task_id: newTask.id, user_id: uid })))

      await supabase.from('activity_logs').insert({
        task_id: newTask.id, user_id: profile.id,
        action: 'task_created', old_value: null, new_value: newTask.title,
      })

      const toNotify = assigneeIds.filter(id => id !== profile.id)
      if (toNotify.length > 0)
        await supabase.from('notifications').insert(toNotify.map(uid => ({
          user_id: uid, type: 'task_assigned',
          title: 'Task assigned to you',
          message: `You have been assigned to "${newTask.title}"`,
          link: `/lists/${projectId}/tasks/${newTask.id}`, is_read: false,
        })))

      const assigneeProfiles = members.filter(m => assigneeIds.includes(m.id))
      onCreated({ ...newTask, assignees: assigneeProfiles, subtasks: [] })
      toast({ title: 'Task created', description: `"${newTask.title}" has been created.` })
      onOpenChange(false)
      reset()
    } catch (err) {
      console.error(err)
      toast({ title: 'Failed to create task', variant: 'destructive' })
    } finally {
      setSubmitting(false)
    }
  }

  // ── Guard ────────────────────────────────────────────────────────────────────
  if (!canCreate && isSubtask) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md p-5">
          <h2 className="font-semibold mb-2">Cannot Add Subtask</h2>
          <p className="text-sm text-muted-foreground mb-4">
            {currentSubtaskCount >= MAX_SUBTASKS
              ? `Maximum of ${MAX_SUBTASKS} subtasks reached.`
              : `Maximum subtask depth of ${MAX_SUBTASK_DEPTH} reached.`}
          </p>
          <div className="flex justify-end">
            <button onClick={() => onOpenChange(false)} className="rounded-md bg-muted px-4 py-1.5 text-sm font-medium">Close</button>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  const filteredProjects = projects.filter(p =>
    !listSearch || p.name.toLowerCase().includes(listSearch.toLowerCase())
  )
  const filteredMembers = members.filter(m =>
    !assigneeSearch ||
    m.full_name.toLowerCase().includes(assigneeSearch.toLowerCase()) ||
    m.email.toLowerCase().includes(assigneeSearch.toLowerCase())
  )
  const filteredTags = PRESET_TAGS.filter(t =>
    !tagSearch || t.name.toLowerCase().includes(tagSearch.toLowerCase())
  )

  // Priority colors
  const PRIORITY_CFG: Record<string, { label: string; color: string }> = {
    urgent: { label: 'Urgent',  color: '#ef4444' },
    high:   { label: 'High',    color: '#f97316' },
    medium: { label: 'Normal',  color: '#3b82f6' },
    low:    { label: 'Low',     color: '#94a3b8' },
  }

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) { reset(); onOpenChange(false) } else onOpenChange(true) }}>
      <DialogContent className="max-w-[560px] p-0 gap-0 overflow-visible" onClick={() => closeAllPopovers()}>
        <div className="flex flex-col rounded-lg overflow-hidden">

          {/* ── Header ────────────────────────────────────────────────────── */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/60">
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-semibold text-foreground">Task</span>
              <div className="h-4 w-px bg-border" />

              {/* Select List dropdown */}
              <div className="relative" onClick={e => e.stopPropagation()}>
                <button
                  onClick={() => { setListOpen(o => !o); setListSearch('') }}
                  className={cn(
                    'flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition-colors',
                    currentProject
                      ? 'bg-primary/10 text-primary'
                      : 'bg-muted/60 text-muted-foreground hover:text-foreground hover:bg-muted',
                  )}
                >
                  <Hash className="h-3 w-3" />
                  {currentProject ? currentProject.name : 'Select List...'}
                  <ChevronDown className="h-3 w-3 opacity-60" />
                </button>

                {listOpen && (
                  <div className="absolute left-0 top-full mt-1 z-50 w-72 rounded-lg border border-border bg-background shadow-xl overflow-hidden">
                    {/* Search */}
                    <div className="flex items-center gap-2 px-3 py-2 border-b border-border/60">
                      <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <input
                        autoFocus
                        value={listSearch}
                        onChange={e => setListSearch(e.target.value)}
                        placeholder="Search..."
                        className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/50"
                      />
                    </div>

                    <div className="max-h-64 overflow-y-auto py-1">
                      {/* Personal List */}
                      <button
                        onClick={() => { setSelectedProjectId(''); setListOpen(false) }}
                        className="flex items-center gap-2.5 w-full px-3 py-2 text-sm hover:bg-muted/50 transition-colors text-left"
                      >
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">Personal List</span>
                      </button>

                      {/* Recents */}
                      {projects.slice(0, 2).length > 0 && (
                        <>
                          <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">Recents</p>
                          {projects.slice(0, 2).map(p => (
                            <button
                              key={p.id}
                              onClick={() => { setSelectedProjectId(p.id); setListOpen(false) }}
                              className="flex items-center gap-2.5 w-full px-3 py-2 text-sm hover:bg-muted/50 transition-colors text-left"
                            >
                              <Hash className="h-4 w-4 text-muted-foreground shrink-0" />
                              <span className="truncate">{p.name}</span>
                              {selectedProjectId === p.id && <Check className="h-3.5 w-3.5 text-primary ml-auto shrink-0" />}
                            </button>
                          ))}
                        </>
                      )}

                      {/* All spaces */}
                      {filteredProjects.length > 0 && (
                        <>
                          <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">Spaces</p>
                          {filteredProjects.map(p => (
                            <button
                              key={p.id}
                              onClick={() => { setSelectedProjectId(p.id); setListOpen(false) }}
                              className="flex items-center gap-2.5 w-full px-3 py-2 text-sm hover:bg-muted/50 transition-colors text-left"
                            >
                              <div className="h-5 w-5 rounded shrink-0 flex items-center justify-center bg-blue-100 text-blue-700 text-[9px] font-bold">
                                {p.name.slice(0,2).toUpperCase()}
                              </div>
                              <span className="truncate flex-1">{p.name}</span>
                              {selectedProjectId === p.id && <Check className="h-3.5 w-3.5 text-primary ml-auto shrink-0" />}
                            </button>
                          ))}
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Task type badge */}
              <button className="flex items-center gap-1 rounded-md bg-muted/60 px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted transition-colors">
                <Check className="h-3 w-3" />
                Task
                <ChevronDown className="h-3 w-3 opacity-60" />
              </button>
            </div>

            <button
              onClick={() => { reset(); onOpenChange(false) }}
              className="rounded-md p-1 text-muted-foreground/60 hover:text-foreground hover:bg-muted transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* ── Body ──────────────────────────────────────────────────────── */}
          <div className="px-5 pt-4 pb-2 flex flex-col gap-2" onClick={e => e.stopPropagation()}>
            {/* Title */}
            <input
              ref={titleRef}
              value={title}
              onChange={e => setTitle(e.target.value)}
              onBlur={() => setTitleTouched(true)}
              onKeyDown={e => { if (e.key === 'Enter') e.preventDefault() }}
              placeholder="Task Name"
              className={cn(
                'w-full text-[22px] font-semibold bg-transparent border-0 outline-none placeholder:text-muted-foreground/30 leading-snug py-1',
                titleError && 'placeholder:text-red-300'
              )}
            />
            {titleError && (
              <p className="text-xs text-red-500 flex items-center gap-1 -mt-1">
                <AlertCircle className="h-3 w-3" /> Task name is required
              </p>
            )}

            {/* Description */}
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Add description, or write with ✨ AI"
              rows={3}
              className="w-full bg-transparent text-sm text-foreground/80 border-0 outline-none resize-none placeholder:text-muted-foreground/40 leading-relaxed py-1"
            />

            {/* ── Inline pill toolbar ────────────────────────────────────── */}
            <div className="flex items-center gap-1 flex-wrap pt-1 pb-2 border-t border-border/40 mt-1">

              {/* Status */}
              <div className="relative">
                <button
                  onClick={e => { e.stopPropagation(); closeAllPopovers() }}
                  className="flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[12px] font-bold tracking-wide transition-colors"
                  style={{
                    backgroundColor: (selectedStatusCfg?.color ?? '#94a3b8') + '25',
                    color: selectedStatusCfg?.color ?? '#94a3b8',
                  }}
                >
                  <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: selectedStatusCfg?.color ?? '#94a3b8' }} />
                  {selectedStatusCfg?.name.toUpperCase() ?? 'OPEN'}
                  {/* Status change inline */}
                  <select
                    value={status}
                    onChange={e => setStatus(e.target.value)}
                    onClick={e => e.stopPropagation()}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full"
                  >
                    {statuses.map(s => <option key={s.slug} value={s.slug}>{s.name}</option>)}
                  </select>
                </button>
              </div>

              {/* Assignee */}
              <div className="relative" onClick={e => e.stopPropagation()}>
                <button
                  onClick={() => { closeAllPopovers(); setAssigneeOpen(o => !o); setAssigneeSearch('') }}
                  className={cn(
                    'flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[12px] font-medium transition-colors',
                    assigneeIds.length > 0
                      ? 'bg-muted text-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                  )}
                >
                  {assignedMembers.length > 0 ? (
                    <>
                      <div className="flex -space-x-1">
                        {assignedMembers.slice(0,2).map(m => (
                          <div key={m.id} className="h-4 w-4 rounded-full bg-primary/20 flex items-center justify-center text-[8px] font-bold text-primary border border-background">
                            {getInitials(m.full_name)}
                          </div>
                        ))}
                      </div>
                      <span>{assignedMembers.length === 1 ? assignedMembers[0].full_name.split(' ')[0] : `${assignedMembers.length} people`}</span>
                    </>
                  ) : (
                    <>
                      <Users className="h-3.5 w-3.5" />
                      Assignee
                    </>
                  )}
                </button>

                {assigneeOpen && (
                  <div className="absolute left-0 top-full mt-1 z-50 w-64 rounded-lg border border-border bg-background shadow-xl overflow-hidden">
                    <div className="flex items-center gap-2 px-3 py-2 border-b border-border/60">
                      <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <input
                        autoFocus
                        value={assigneeSearch}
                        onChange={e => setAssigneeSearch(e.target.value)}
                        placeholder="Search or enter email..."
                        className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/50"
                      />
                    </div>
                    <div className="py-1 max-h-56 overflow-y-auto">
                      {/* People section */}
                      <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">People</p>
                      {/* Me first */}
                      <button
                        onClick={() => toggleAssignee(profile.id)}
                        className="flex items-center gap-2.5 w-full px-3 py-2 hover:bg-muted/50 text-sm text-left transition-colors"
                      >
                        <div className="h-6 w-6 rounded-full bg-primary flex items-center justify-center text-[9px] font-bold text-primary-foreground shrink-0">
                          {getInitials(profile.full_name)}
                        </div>
                        <span className="flex-1 font-medium">Me</span>
                        {assigneeIds.includes(profile.id) && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
                      </button>
                      {filteredMembers.filter(m => m.id !== profile.id).map(m => (
                        <button
                          key={m.id}
                          onClick={() => toggleAssignee(m.id)}
                          className="flex items-center gap-2.5 w-full px-3 py-2 hover:bg-muted/50 text-sm text-left transition-colors"
                        >
                          <Avatar className="h-6 w-6 shrink-0">
                            <AvatarImage src={m.avatar_url ?? undefined} />
                            <AvatarFallback className="text-[9px]">{getInitials(m.full_name)}</AvatarFallback>
                          </Avatar>
                          <span className="flex-1 truncate">{m.full_name}</span>
                          {assigneeIds.includes(m.id) && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
                        </button>
                      ))}
                    </div>
                    {assigneeIds.length > 0 && (
                      <div className="border-t border-border/60 px-3 py-2 flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">{assigneeIds.length} selected</span>
                        <button onClick={() => setAssigneeIds([])} className="text-xs text-red-500 hover:text-red-600">Clear</button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Due Date */}
              <div className="relative" onClick={e => e.stopPropagation()}>
                <button
                  onClick={() => { closeAllPopovers(); setDateOpen(o => !o) }}
                  className={cn(
                    'flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[12px] font-medium transition-colors',
                    dueDate
                      ? 'bg-blue-50 text-blue-600'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                  )}
                >
                  <Calendar className="h-3.5 w-3.5" />
                  {dueDate
                    ? new Date(dueDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
                    : 'Due date'}
                  {dueDate && (
                    <button
                      onClick={e => { e.stopPropagation(); setDueDate('') }}
                      className="ml-0.5 rounded-full hover:bg-blue-100 p-0.5"
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  )}
                </button>

                {dateOpen && (
                  <div className="absolute left-0 top-full mt-1 z-50 w-72 rounded-lg border border-border bg-background shadow-xl overflow-hidden">
                    {/* Start / Due tabs */}
                    <div className="flex border-b border-border/60">
                      <div className="flex-1 px-3 py-2 text-xs font-medium text-muted-foreground border-r border-border/60">
                        <span className="text-[10px] uppercase tracking-wide text-muted-foreground/60 block mb-0.5">Start date</span>
                        <input
                          type="date"
                          value={startDate}
                          onChange={e => setStartDate(e.target.value)}
                          className="bg-transparent text-xs outline-none text-foreground w-full"
                        />
                      </div>
                      <div className="flex-1 px-3 py-2 text-xs font-medium">
                        <span className="text-[10px] uppercase tracking-wide text-muted-foreground/60 block mb-0.5">Due date</span>
                        <input
                          type="date"
                          value={dueDate}
                          onChange={e => setDueDate(e.target.value)}
                          className="bg-transparent text-xs outline-none text-foreground w-full"
                        />
                      </div>
                    </div>

                    {/* Quick options */}
                    <div className="flex border-b border-border/60">
                      <div className="flex-1 py-1">
                        {QUICK_DATES.map(q => {
                          const d = q.fn ? q.fn() : addDays(q.days ?? 0)
                          const str = toDateStr(d)
                          return (
                            <button
                              key={q.label}
                              onClick={() => { setDueDate(str); setDateOpen(false) }}
                              className="flex items-center justify-between w-full px-3 py-1.5 text-xs hover:bg-muted/50 transition-colors"
                            >
                              <span className="text-foreground">{q.label}</span>
                              <span className="text-muted-foreground/60">
                                {d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                              </span>
                            </button>
                          )
                        })}
                        <button className="flex items-center gap-2 w-full px-3 py-1.5 text-xs hover:bg-muted/50 transition-colors text-muted-foreground">
                          <ChevronRight className="h-3 w-3" /> Set Recurring
                        </button>
                      </div>

                      {/* Mini calendar */}
                      <div className="w-[180px] border-l border-border/60 p-2">
                        <MiniCalendar selected={dueDate} onSelect={d => { setDueDate(d); setDateOpen(false) }} />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Priority */}
              <div className="relative" onClick={e => e.stopPropagation()}>
                <button
                  onClick={() => { closeAllPopovers(); setPriorityOpen(o => !o) }}
                  className={cn(
                    'flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[12px] font-medium transition-colors',
                    priority
                      ? 'text-foreground hover:bg-muted/60'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                  )}
                >
                  <Flag className="h-3.5 w-3.5" style={{ color: PRIORITY_CFG[priority]?.color ?? '#94a3b8' }} />
                  {PRIORITY_CFG[priority]?.label ?? 'Priority'} priority
                </button>

                {priorityOpen && (
                  <div className="absolute left-0 top-full mt-1 z-50 w-44 rounded-lg border border-border bg-background shadow-xl py-1 overflow-hidden">
                    <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">Task Priority</p>
                    {Object.entries(PRIORITY_CFG).map(([slug, cfg]) => (
                      <button
                        key={slug}
                        onClick={() => { setPriority(slug); setPriorityOpen(false) }}
                        className="flex items-center gap-2.5 w-full px-3 py-2 text-sm hover:bg-muted/50 transition-colors text-left"
                      >
                        <Flag className="h-4 w-4 shrink-0" style={{ color: cfg.color }} />
                        <span className="flex-1">{cfg.label}</span>
                        {priority === slug && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
                      </button>
                    ))}
                    <div className="border-t border-border/60 mt-1">
                      <button
                        onClick={() => { setPriority('medium'); setPriorityOpen(false) }}
                        className="flex items-center gap-2.5 w-full px-3 py-2 text-sm hover:bg-muted/50 transition-colors text-muted-foreground"
                      >
                        <X className="h-4 w-4 shrink-0" />
                        Clear
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Tags */}
              <div className="relative" onClick={e => e.stopPropagation()}>
                <button
                  onClick={() => { closeAllPopovers(); setTagsOpen(o => !o); setTagSearch('') }}
                  className={cn(
                    'flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[12px] font-medium transition-colors',
                    tags.length > 0
                      ? 'bg-muted text-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                  )}
                >
                  <Tag className="h-3.5 w-3.5" />
                  {tags.length > 0 ? `${tags.length} tag${tags.length > 1 ? 's' : ''}` : 'Tags'}
                </button>

                {tagsOpen && (
                  <div className="absolute left-0 top-full mt-1 z-50 w-64 rounded-lg border border-border bg-background shadow-xl overflow-hidden">
                    <div className="flex items-center gap-2 px-3 py-2 border-b border-border/60">
                      <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <input
                        autoFocus
                        value={tagSearch}
                        onChange={e => setTagSearch(e.target.value)}
                        placeholder="Search or add tags..."
                        className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/50"
                      />
                    </div>
                    <div className="p-2 max-h-56 overflow-y-auto">
                      <div className="flex flex-wrap gap-1.5">
                        {filteredTags.map(t => (
                          <button
                            key={t.name}
                            onClick={() => toggleTag(t.name)}
                            className={cn(
                              'rounded-md px-2.5 py-1 text-[12px] font-medium transition-all border',
                              tags.includes(t.name)
                                ? 'ring-2 ring-offset-1'
                                : 'hover:opacity-80'
                            )}
                            style={{
                              backgroundColor: t.color + '20',
                              color: t.color,
                              borderColor: t.color + '40',
                              ...(tags.includes(t.name) ? { ringColor: t.color } : {}),
                            }}
                          >
                            {t.name}
                          </button>
                        ))}
                        {tagSearch && !PRESET_TAGS.find(t => t.name === tagSearch) && (
                          <button
                            onClick={() => { toggleTag(tagSearch); setTagSearch('') }}
                            className="flex items-center gap-1 rounded-md px-2.5 py-1 text-[12px] font-medium bg-muted text-foreground hover:bg-muted/80 border border-dashed border-border"
                          >
                            <Plus className="h-3 w-3" />
                            Add &quot;{tagSearch}&quot;
                          </button>
                        )}
                      </div>
                    </div>
                    {tags.length > 0 && (
                      <div className="border-t border-border/60 px-3 py-1.5 flex items-center justify-between">
                        <div className="flex flex-wrap gap-1">
                          {tags.map(t => {
                            const cfg = PRESET_TAGS.find(p => p.name === t)
                            return (
                              <span
                                key={t}
                                className="rounded px-1.5 py-0.5 text-[11px] font-medium"
                                style={{ backgroundColor: (cfg?.color ?? '#94a3b8') + '20', color: cfg?.color ?? '#94a3b8' }}
                              >
                                {t}
                              </span>
                            )
                          })}
                        </div>
                        <button onClick={() => setTags([])} className="text-[11px] text-red-500 hover:text-red-600 shrink-0 ml-2">Clear</button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* More */}
              <button className="flex items-center justify-center h-7 w-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors">
                <MoreHorizontal className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* ── Footer ────────────────────────────────────────────────────── */}
          <div className="flex items-center justify-between px-4 py-2.5 border-t border-border/60 bg-muted/20" onClick={e => e.stopPropagation()}>
            {/* Left */}
            <div className="flex items-center gap-1">
              <button className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                <Paperclip className="h-3.5 w-3.5" />
                Templates
              </button>
            </div>

            {/* Right */}
            <div className="flex items-center gap-2">
              <button className="flex items-center justify-center h-7 w-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                <Paperclip className="h-3.5 w-3.5" />
              </button>
              {/* Count badge */}
              <span className="flex items-center justify-center h-6 w-6 rounded-full bg-muted text-[11px] font-semibold text-muted-foreground">1</span>

              {/* Split Create Task button */}
              <div className="flex items-center rounded-lg overflow-hidden border border-primary">
                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="px-3.5 py-1.5 text-[13px] font-semibold bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
                >
                  {submitting ? 'Creating…' : 'Create Task'}
                </button>
                <div className="w-px h-full bg-primary-foreground/20" />
                <button
                  className="px-2 py-1.5 bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                  onClick={e => { e.stopPropagation() }}
                >
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
