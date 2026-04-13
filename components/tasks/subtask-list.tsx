'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Task, Profile } from '@/types'
import { TaskRow } from './task-row'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  ChevronDown, ChevronRight, ListTree, Plus, User,
  Flag, Calendar, X, Check,
} from 'lucide-react'
import { MAX_SUBTASKS, MAX_SUBTASK_DEPTH } from '@/lib/constants'
import { cn, getInitials, formatDate } from '@/lib/utils'
import { useTaskConfig } from '@/hooks/use-task-config'
import { useToast } from '@/components/ui/use-toast'

interface SubtaskListProps {
  parentTask: Task
  subtasks: Task[]
  members: Profile[]
  profile: Profile
  onSubtaskCreated: (subtask: Task) => void
  onSubtaskUpdated: (subtask: Task) => void
}

// ── Priority colours ──────────────────────────────────────────────────────────
const PRIORITY_COLORS: Record<string, string> = {
  low: '#3b82f6', medium: '#f59e0b', high: '#f97316', urgent: '#ef4444',
}

// ── Quick date options ─────────────────────────────────────────────────────────
function addDays(n: number) {
  const d = new Date(); d.setDate(d.getDate() + n); return d
}
function toDateStr(d: Date) { return d.toISOString().slice(0, 10) }
const QUICK_DATES = [
  { label: 'Today',     value: () => toDateStr(addDays(0)) },
  { label: 'Tomorrow',  value: () => toDateStr(addDays(1)) },
  { label: 'Next week', value: () => toDateStr(addDays(7)) },
  { label: '2 weeks',   value: () => toDateStr(addDays(14)) },
]

export function SubtaskList({
  parentTask,
  subtasks,
  members,
  profile,
  onSubtaskCreated,
  onSubtaskUpdated,
}: SubtaskListProps) {
  const router  = useRouter()
  const supabase = createClient()
  const { toast } = useToast()
  const { defaultStatus, defaultPriority, priorities } = useTaskConfig()

  const [collapsed,   setCollapsed]   = useState(false)
  const [showInline,  setShowInline]  = useState(false)
  const [title,       setTitle]       = useState('')
  const [assigneeId,  setAssigneeId]  = useState<string | null>(null)
  const [priority,    setPriority]    = useState<string>('')
  const [dueDate,     setDueDate]     = useState('')
  const [submitting,  setSubmitting]  = useState(false)

  // Popover states
  const [assigneeOpen, setAssigneeOpen] = useState(false)
  const [priorityOpen, setPriorityOpen] = useState(false)
  const [dateOpen,     setDateOpen]     = useState(false)
  const [memberSearch, setMemberSearch] = useState('')

  const inputRef     = useRef<HTMLInputElement>(null)
  const assigneeRef  = useRef<HTMLDivElement>(null)
  const priorityRef  = useRef<HTMLDivElement>(null)
  const dateRef      = useRef<HTMLDivElement>(null)

  const canAdd =
    subtasks.length < MAX_SUBTASKS &&
    (parentTask.depth ?? 0) < MAX_SUBTASK_DEPTH

  const isAdmin    = profile.role === 'super_admin'
  const isCreator  = parentTask.created_by === profile.id
  const isAssignee = (parentTask.assignees ?? []).some((a) => a.id === profile.id)
  const canEdit    = isAdmin || isCreator || isAssignee

  const doneCount = subtasks.filter((s) => s.status === 'done' || s.status === 'cancelled').length

  // Click-outside to close popovers
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (assigneeRef.current && !assigneeRef.current.contains(e.target as Node)) setAssigneeOpen(false)
      if (priorityRef.current && !priorityRef.current.contains(e.target as Node)) setPriorityOpen(false)
      if (dateRef.current     && !dateRef.current.contains(e.target as Node))     setDateOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Auto-focus input when inline row opens
  useEffect(() => {
    if (showInline) {
      setTimeout(() => inputRef.current?.focus(), 50)
      setPriority(defaultPriority || 'medium')
    }
  }, [showInline, defaultPriority])

  function resetInline() {
    setTitle(''); setAssigneeId(null); setPriority(''); setDueDate('')
    setAssigneeOpen(false); setPriorityOpen(false); setDateOpen(false)
    setMemberSearch('')
    setShowInline(false)
  }

  async function handleSave() {
    if (!title.trim()) { inputRef.current?.focus(); return }
    setSubmitting(true)
    try {
      const { data: newTask, error } = await supabase.from('tasks').insert({
        title: title.trim(),
        project_id: parentTask.project_id,
        parent_task_id: parentTask.id,
        status: defaultStatus || 'todo',
        priority: priority || defaultPriority || 'medium',
        due_date: dueDate || null,
        created_by: profile.id,
        depth: (parentTask.depth ?? 0) + 1,
      }).select('*').single()

      if (error || !newTask) throw error ?? new Error('Failed to create subtask')

      if (assigneeId) {
        await supabase.from('task_assignees').insert({ task_id: newTask.id, user_id: assigneeId })
      }

      await supabase.from('activity_logs').insert({
        task_id: newTask.id,
        user_id: profile.id,
        action: 'task_created',
        old_value: null,
        new_value: newTask.title,
      })

      const assigneeProfile = assigneeId ? members.find(m => m.id === assigneeId) : null
      onSubtaskCreated({
        ...newTask,
        assignees: assigneeProfile ? [assigneeProfile] : [],
        subtasks: [],
      })

      // Reset for next subtask
      setTitle(''); setAssigneeId(null); setDueDate('')
      setAssigneeOpen(false); setPriorityOpen(false); setDateOpen(false)
      setMemberSearch('')
      setTimeout(() => inputRef.current?.focus(), 50)
    } catch (err) {
      console.error(err)
      toast({ title: 'Failed to create subtask', variant: 'destructive' })
    } finally {
      setSubmitting(false)
    }
  }

  const assignee      = assigneeId ? members.find(m => m.id === assigneeId) : null
  const priorityColor = priority ? (PRIORITY_COLORS[priority] ?? '#94a3b8') : '#94a3b8'
  const filteredMembers = members.filter(m =>
    !memberSearch ||
    m.full_name.toLowerCase().includes(memberSearch.toLowerCase()) ||
    m.email.toLowerCase().includes(memberSearch.toLowerCase())
  )

  return (
    <div>
      {/* ── Section header ── */}
      <div className="flex items-center justify-between mb-2">
        <button
          className="flex items-center gap-2 text-sm font-semibold text-foreground/80 hover:text-foreground transition-colors"
          onClick={() => setCollapsed(v => !v)}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          <ListTree className="h-4 w-4" />
          Subtasks
          {subtasks.length > 0 && (
            <Badge variant="secondary" className="text-xs">
              {doneCount}/{subtasks.length}
            </Badge>
          )}
        </button>

        {canEdit && canAdd && !collapsed && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowInline(true)}
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" /> Add subtask
            </button>
          </div>
        )}
      </div>

      {/* ── Progress bar ── */}
      {subtasks.length > 0 && (
        <div className="mb-3 h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all"
            style={{ width: `${Math.round((doneCount / subtasks.length) * 100)}%` }}
          />
        </div>
      )}

      {!collapsed && (
        <div>
          {/* ── Subtask table ── */}
          {subtasks.length > 0 && (
            <div className="rounded-lg border border-border overflow-hidden mb-1">
              {/* Column headers */}
              <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border/60 bg-muted/30">
                <span className="flex-1 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Name</span>
                <span className="w-24 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide text-center">Assignee</span>
                <span className="w-20 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide text-center">Priority</span>
                <span className="w-24 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide text-center">Due date</span>
                <span className="w-6" />
              </div>

              {subtasks.map((subtask) => (
                <TaskRow
                  key={subtask.id}
                  task={subtask}
                  profile={profile}
                  onTaskUpdated={onSubtaskUpdated}
                  onClick={() => router.push(`/projects/${parentTask.project_id}/tasks/${subtask.id}`)}
                  level={1}
                />
              ))}

              {/* Inline add row — inside the table when subtasks exist */}
              {showInline && (
                <InlineAddRow
                  inputRef={inputRef}
                  title={title} setTitle={setTitle}
                  assignee={assignee}
                  priority={priority} priorityColor={priorityColor}
                  dueDate={dueDate}
                  submitting={submitting}
                  assigneeOpen={assigneeOpen} setAssigneeOpen={setAssigneeOpen}
                  priorityOpen={priorityOpen} setPriorityOpen={setPriorityOpen}
                  dateOpen={dateOpen}     setDateOpen={setDateOpen}
                  assigneeRef={assigneeRef}
                  priorityRef={priorityRef}
                  dateRef={dateRef}
                  members={filteredMembers}
                  memberSearch={memberSearch} setMemberSearch={setMemberSearch}
                  priorities={priorities}
                  onSave={handleSave}
                  onCancel={resetInline}
                  onAssignee={(id) => { setAssigneeId(id); setAssigneeOpen(false); setMemberSearch('') }}
                  onPriority={(p) => { setPriority(p); setPriorityOpen(false) }}
                  onDate={(d) => { setDueDate(d); setDateOpen(false) }}
                />
              )}
            </div>
          )}

          {/* Empty state */}
          {subtasks.length === 0 && !showInline && (
            <div className="flex flex-col items-center justify-center py-8 rounded-lg border border-dashed">
              <p className="text-sm text-muted-foreground">No subtasks yet.</p>
              {canEdit && canAdd && (
                <button
                  onClick={() => setShowInline(true)}
                  className="mt-2 flex items-center gap-1.5 text-sm text-primary hover:underline"
                >
                  <Plus className="h-4 w-4" />
                  Add first subtask
                </button>
              )}
            </div>
          )}

          {/* Inline add row — standalone when no subtasks */}
          {subtasks.length === 0 && showInline && (
            <div className="rounded-lg border border-border overflow-hidden">
              <InlineAddRow
                inputRef={inputRef}
                title={title} setTitle={setTitle}
                assignee={assignee}
                priority={priority} priorityColor={priorityColor}
                dueDate={dueDate}
                submitting={submitting}
                assigneeOpen={assigneeOpen} setAssigneeOpen={setAssigneeOpen}
                priorityOpen={priorityOpen} setPriorityOpen={setPriorityOpen}
                dateOpen={dateOpen}     setDateOpen={setDateOpen}
                assigneeRef={assigneeRef}
                priorityRef={priorityRef}
                dateRef={dateRef}
                members={filteredMembers}
                memberSearch={memberSearch} setMemberSearch={setMemberSearch}
                priorities={priorities}
                onSave={handleSave}
                onCancel={resetInline}
                onAssignee={(id) => { setAssigneeId(id); setAssigneeOpen(false); setMemberSearch('') }}
                onPriority={(p) => { setPriority(p); setPriorityOpen(false) }}
                onDate={(d) => { setDueDate(d); setDateOpen(false) }}
              />
            </div>
          )}

          {/* "Add Task" button shown after saving (subtasks exist, inline closed) */}
          {subtasks.length > 0 && !showInline && canEdit && canAdd && (
            <button
              onClick={() => setShowInline(true)}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/40 rounded-lg transition-colors mt-1"
            >
              <Plus className="h-4 w-4" />
              Add Task
            </button>
          )}

          {!canAdd && subtasks.length >= MAX_SUBTASKS && (
            <p className="text-xs text-muted-foreground mt-2 text-center">
              Maximum of {MAX_SUBTASKS} subtasks reached.
            </p>
          )}
        </div>
      )}
    </div>
  )
}

// ── Inline add row component ──────────────────────────────────────────────────

interface InlineAddRowProps {
  inputRef: React.RefObject<HTMLInputElement>
  title: string
  setTitle: (v: string) => void
  assignee: Profile | null | undefined
  priority: string
  priorityColor: string
  dueDate: string
  submitting: boolean
  assigneeOpen: boolean
  setAssigneeOpen: (v: boolean) => void
  priorityOpen: boolean
  setPriorityOpen: (v: boolean) => void
  dateOpen: boolean
  setDateOpen: (v: boolean) => void
  assigneeRef: React.RefObject<HTMLDivElement>
  priorityRef: React.RefObject<HTMLDivElement>
  dateRef: React.RefObject<HTMLDivElement>
  members: Profile[]
  memberSearch: string
  setMemberSearch: (v: string) => void
  priorities: { id: string; name: string; slug: string; color: string }[]
  onSave: () => void
  onCancel: () => void
  onAssignee: (id: string) => void
  onPriority: (p: string) => void
  onDate: (d: string) => void
}

function InlineAddRow({
  inputRef, title, setTitle,
  assignee, priority, priorityColor, dueDate, submitting,
  assigneeOpen, setAssigneeOpen, priorityOpen, setPriorityOpen, dateOpen, setDateOpen,
  assigneeRef, priorityRef, dateRef,
  members, memberSearch, setMemberSearch,
  priorities, onSave, onCancel, onAssignee, onPriority, onDate,
}: InlineAddRowProps) {
  const hasContent = title.trim().length > 0

  return (
    <div className="flex flex-col gap-0">
      {/* Input row */}
      <div className="flex items-center gap-2 px-3 py-2.5 bg-background">
        {/* Status circle */}
        <div className="h-4 w-4 shrink-0 rounded-full border-2 border-muted-foreground/40 flex items-center justify-center">
        </div>

        {/* Task name input */}
        <input
          ref={inputRef}
          value={title}
          onChange={e => setTitle(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') { e.preventDefault(); onSave() }
            if (e.key === 'Escape') { e.preventDefault(); onCancel() }
          }}
          placeholder="Task Name or type '/' for commands"
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/40"
        />

        {/* Inline action buttons */}
        <div className="flex items-center gap-1 shrink-0">
          {/* Assignee */}
          <div className="relative" ref={assigneeRef}>
            <button
              type="button"
              onClick={() => { setAssigneeOpen(!assigneeOpen); setPriorityOpen(false); setDateOpen(false) }}
              className={cn(
                'flex items-center justify-center h-6 w-6 rounded-full transition-colors',
                assignee
                  ? 'bg-primary text-primary-foreground hover:opacity-80'
                  : 'border border-dashed border-muted-foreground/40 text-muted-foreground/60 hover:border-primary hover:text-primary'
              )}
              title="Assignee"
            >
              {assignee ? (
                <span className="text-[9px] font-bold">{getInitials(assignee.full_name)}</span>
              ) : (
                <User className="h-3 w-3" />
              )}
            </button>
            {assigneeOpen && (
              <div className="absolute right-0 top-full mt-1 z-50 w-56 rounded-xl border border-border bg-background shadow-xl overflow-hidden">
                <div className="flex items-center gap-2 px-3 py-2 border-b border-border/60">
                  <input
                    autoFocus
                    value={memberSearch}
                    onChange={e => setMemberSearch(e.target.value)}
                    placeholder="Search members..."
                    className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/50"
                  />
                </div>
                <div className="max-h-48 overflow-y-auto py-1">
                  {members.map(m => (
                    <button
                      key={m.id}
                      onClick={() => onAssignee(m.id)}
                      className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-left hover:bg-muted/50 transition-colors"
                    >
                      <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center text-[9px] font-bold text-primary shrink-0">
                        {getInitials(m.full_name)}
                      </div>
                      <span className="flex-1 truncate">{m.full_name}</span>
                      {assignee?.id === m.id && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
                    </button>
                  ))}
                  {members.length === 0 && (
                    <p className="px-3 py-3 text-xs text-muted-foreground">No members found</p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Priority */}
          <div className="relative" ref={priorityRef}>
            <button
              type="button"
              onClick={() => { setPriorityOpen(!priorityOpen); setAssigneeOpen(false); setDateOpen(false) }}
              className="flex items-center justify-center h-6 w-6 rounded hover:bg-muted/60 transition-colors"
              title="Priority"
            >
              <Flag
                className="h-3.5 w-3.5"
                style={{ color: priority ? priorityColor : '#94a3b8' }}
              />
            </button>
            {priorityOpen && (
              <div className="absolute right-0 top-full mt-1 z-50 w-44 rounded-xl border border-border bg-background shadow-xl overflow-hidden py-1">
                {priorities.map(p => (
                  <button
                    key={p.id}
                    onClick={() => onPriority(p.slug)}
                    className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-left hover:bg-muted/50 transition-colors"
                  >
                    <Flag className="h-3.5 w-3.5 shrink-0" style={{ color: p.color }} />
                    <span>{p.name}</span>
                    {priority === p.slug && <Check className="h-3.5 w-3.5 text-primary ml-auto shrink-0" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Due date */}
          <div className="relative" ref={dateRef}>
            <button
              type="button"
              onClick={() => { setDateOpen(!dateOpen); setAssigneeOpen(false); setPriorityOpen(false) }}
              className={cn(
                'flex items-center gap-1 h-6 rounded px-1.5 text-xs hover:bg-muted/60 transition-colors',
                dueDate ? 'text-foreground' : 'text-muted-foreground/60'
              )}
              title="Due date"
            >
              <Calendar className="h-3.5 w-3.5" />
              {dueDate && <span>{formatDate(dueDate)}</span>}
            </button>
            {dateOpen && (
              <div className="absolute right-0 top-full mt-1 z-50 w-44 rounded-xl border border-border bg-background shadow-xl overflow-hidden py-1">
                {[{ label: 'No date', value: '' }, ...QUICK_DATES.map(d => ({ label: d.label, value: d.value() }))].map(opt => (
                  <button
                    key={opt.label}
                    onClick={() => onDate(opt.value)}
                    className="flex items-center justify-between w-full px-3 py-2 text-sm text-left hover:bg-muted/50 transition-colors"
                  >
                    <span>{opt.label}</span>
                    {dueDate === opt.value && opt.value && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Cancel / Save */}
        <div className="flex items-center gap-1 shrink-0 ml-1">
          <button
            type="button"
            onClick={onCancel}
            className="px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground rounded-md hover:bg-muted/60 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={submitting || !hasContent}
            className={cn(
              'flex items-center gap-1 px-2.5 py-1 text-xs rounded-md font-medium transition-colors',
              hasContent && !submitting
                ? 'bg-foreground text-background hover:bg-foreground/90'
                : 'bg-muted text-muted-foreground cursor-not-allowed'
            )}
          >
            {submitting ? 'Saving…' : 'Save'}
            {!submitting && <span className="opacity-50">↵</span>}
          </button>
        </div>
      </div>

      {/* Metadata chips row — shown when there's content */}
      {hasContent && (
        <div className="flex items-center gap-2 px-10 pb-2">
          <span className="text-[11px] bg-muted px-2 py-0.5 rounded font-medium text-muted-foreground">Task</span>
          {assignee && (
            <div className="flex items-center gap-1 text-[11px] bg-muted px-2 py-0.5 rounded text-muted-foreground">
              <div className="h-3.5 w-3.5 rounded-full bg-primary/30 flex items-center justify-center text-[8px] font-bold text-primary">
                {getInitials(assignee.full_name)}
              </div>
              <span>{assignee.full_name.split(' ')[0]}</span>
            </div>
          )}
          {priority && (
            <span
              className="text-[11px] px-2 py-0.5 rounded font-medium"
              style={{ backgroundColor: `${PRIORITY_COLORS[priority]}20`, color: PRIORITY_COLORS[priority] }}
            >
              {priority.charAt(0).toUpperCase() + priority.slice(1)}
            </span>
          )}
          {dueDate && (
            <span className="text-[11px] bg-muted px-2 py-0.5 rounded text-muted-foreground flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {formatDate(dueDate)}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
