'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Project, Task, Profile, ActivityLog, ProjectMember, CustomRole } from '@/types'
import { ProjectHeader } from './project-header'
import { TimeSummary } from './time-summary'
import { ProjectTeamSection } from './project-team-section'
import { CreateTaskDialog } from '@/components/tasks/create-task-dialog'
import { TaskRow } from '@/components/tasks/task-row'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/client'
import { toast } from '@/components/ui/use-toast'
import { useTaskConfig } from '@/hooks/use-task-config'
import {
  cn,
  formatDate,
  isOverdue,
  getInitials,
  timeAgo,
} from '@/lib/utils'
import {
  ChevronRight,
  ChevronDown,
  Calendar,
  Clock,
  User,
  Building2,
  CheckCircle2,
  Circle,
  AlertTriangle,
  Activity,
  Users,
  ListTodo,
  BarChart2,
  Plus,
  Flag,
  X,
  Trash2,
  Copy,
  MoveRight,
  Tag,
  CalendarDays,
  UserCheck,
} from 'lucide-react'

// ─── ClickUp-style task list helpers ─────────────────────────────────────────

const COL_ASSIGNEES = 'w-[80px]'
const COL_DUE       = 'w-[90px]'
const COL_PRIORITY  = 'w-[90px]'
const COL_ACTION    = 'w-8'

function ProjectTaskList({
  tasks,
  profile,
  projectId,
  onTaskUpdated,
  onTaskCreated,
  onOpenDialog,
}: {
  tasks: Task[]
  profile: Profile
  projectId: string
  onTaskUpdated: (t: Task) => void
  onTaskCreated: (t: Task) => void
  onOpenDialog: () => void
}) {
  const router   = useRouter()
  const supabase = createClient()
  const { statuses: orgStatuses, defaultPriority } = useTaskConfig()

  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())
  const [addingToGroup,   setAddingToGroup]   = useState<string | null>(null)
  const [newTaskName,     setNewTaskName]     = useState('')
  const [saving,          setSaving]          = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // ── Bulk selection ──────────────────────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  function handleSelectTask(id: string, checked: boolean) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      checked ? next.add(id) : next.delete(id)
      return next
    })
  }

  function handleSelectGroup(groupTaskIds: string[], checked: boolean) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      groupTaskIds.forEach(id => checked ? next.add(id) : next.delete(id))
      return next
    })
  }

  function clearSelection() { setSelectedIds(new Set()) }

  async function deleteSelected() {
    if (selectedIds.size === 0) return
    const ids = [...selectedIds]
    try {
      await supabase.from('tasks').delete().in('id', ids)
      ids.forEach(id => onTaskUpdated({ ...tasks.find(t => t.id === id)!, status: 'cancelled' as any }))
      clearSelection()
      toast({ title: `${ids.length} task${ids.length > 1 ? 's' : ''} deleted` })
    } catch {
      toast({ title: 'Failed to delete tasks', variant: 'destructive' })
    }
  }

  useEffect(() => {
    if (addingToGroup) {
      setTimeout(() => inputRef.current?.focus(), 30)
    }
  }, [addingToGroup])

  function toggleGroup(id: string) {
    setCollapsedGroups((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function openInlineAdd(groupId: string) {
    // Expand the group first if collapsed
    setCollapsedGroups(prev => { const n = new Set(prev); n.delete(groupId); return n })
    setNewTaskName('')
    setAddingToGroup(groupId)
  }

  function cancelInlineAdd() {
    setAddingToGroup(null)
    setNewTaskName('')
  }

  async function submitInlineTask(statusId: string) {
    const title = newTaskName.trim()
    if (!title) { cancelInlineAdd(); return }
    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data, error } = await supabase.from('tasks').insert({
        title,
        project_id:  projectId,
        status:      statusId,
        priority:    defaultPriority || 'medium',
        created_by:  user.id,
      }).select('*, assignees:task_assignees(user:profiles(*)), subtasks:tasks!parent_task_id(*)').single()
      if (error) { toast({ title: 'Failed to create task', description: error.message, variant: 'destructive' }); return }
      onTaskCreated(data as Task)
      // Keep row open for rapid multi-task entry — reset name only
      setNewTaskName('')
      inputRef.current?.focus()
    } finally { setSaving(false) }
  }

  const canManage = profile.role === 'super_admin' || profile.role === 'staff'

  // Build groups from org's dynamic statuses
  const groups = useMemo(() => {
    return orgStatuses.map((s) => ({
      id:    s.slug,
      label: s.name.toUpperCase(),
      color: s.color,
      tasks: tasks.filter((t) => t.status === s.slug),
    })).filter((g) => g.tasks.length > 0 || g.id === addingToGroup)
  }, [tasks, addingToGroup, orgStatuses])

  if (tasks.length === 0 && !addingToGroup) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12 text-center">
        <div className="mb-3 rounded-full bg-muted p-4">
          <ListTodo className="h-10 w-10 text-muted-foreground" />
        </div>
        <h3 className="text-base font-semibold">No tasks yet</h3>
        <p className="text-sm text-muted-foreground mt-1 max-w-xs">
          Click below to add your first task to this project.
        </p>
        {canManage && (
          <Button className="mt-4" onClick={() => openInlineAdd('todo')}>
            <Plus className="mr-2 h-4 w-4" />Add Task
          </Button>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Top action bar */}
      {canManage && (
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="outline" onClick={onOpenDialog} className="h-8 text-xs">
            <Plus className="mr-1.5 h-3.5 w-3.5" />New Task (Full Form)
          </Button>
          <Button size="sm" onClick={() => openInlineAdd('todo')} className="h-8 text-xs">
            <Plus className="mr-1.5 h-3.5 w-3.5" />Add Task
          </Button>
        </div>
      )}

      {/* Table */}
      <div className="rounded-lg border bg-card overflow-hidden">
        {/* Column headers */}
        <div className="flex items-center border-b border-border bg-muted/40 text-xs font-medium text-muted-foreground select-none h-8">
          <div style={{ width: 52 + 12 }} className="shrink-0" />
          <div className="flex-1 min-w-0 px-2">Task Name</div>
          <div className={cn(COL_ASSIGNEES, 'shrink-0 flex items-center gap-1 px-1')}>
            <Users className="h-3 w-3" />Assignees
          </div>
          <div className={cn(COL_DUE, 'shrink-0 flex items-center gap-1 px-1')}>
            <Calendar className="h-3 w-3" />Due Date
          </div>
          <div className={cn(COL_PRIORITY, 'shrink-0 flex items-center gap-1 px-1')}>
            <Flag className="h-3 w-3" />Priority
          </div>
          <div className={cn(COL_ACTION, 'shrink-0')} />
        </div>

        {/* Groups */}
        {groups.map((group) => {
          const collapsed  = collapsedGroups.has(group.id)
          const isAdding   = addingToGroup === group.id
          const groupIds   = group.tasks.map(t => t.id)
          const allSelected = groupIds.length > 0 && groupIds.every(id => selectedIds.has(id))
          const someSelected = groupIds.some(id => selectedIds.has(id))

          return (
            <div key={group.id}>
              {/* Group header — ClickUp pill style */}
              <div
                className="flex items-center gap-2.5 px-3 py-2 border-b border-border/50 cursor-pointer select-none hover:bg-muted/20 transition-colors bg-muted/10"
                onClick={() => toggleGroup(group.id)}
              >
                {/* Group-level checkbox */}
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={(el) => { if (el) el.indeterminate = someSelected && !allSelected }}
                  onChange={(e) => { e.stopPropagation(); handleSelectGroup(groupIds, e.target.checked) }}
                  onClick={(e) => e.stopPropagation()}
                  className="h-3.5 w-3.5 cursor-pointer accent-primary rounded shrink-0"
                />
                <span className="text-muted-foreground/60">
                  {collapsed
                    ? <ChevronRight className="h-3 w-3" />
                    : <ChevronDown className="h-3 w-3" />}
                </span>
                {/* Colored pill badge */}
                <span
                  className="flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-bold text-white tracking-wide"
                  style={{ backgroundColor: group.color }}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-white/50 shrink-0" />
                  {group.label}
                </span>
                <span className="text-xs text-muted-foreground font-medium">
                  {group.tasks.length}
                </span>
              </div>

              {/* Task rows + inline add */}
              {!collapsed && (
                <>
                  {group.tasks.map((task) => (
                    <div key={task.id} style={{ borderLeft: `3px solid ${group.color}25` }}>
                      <TaskRow
                        task={task}
                        profile={profile}
                        onTaskUpdated={onTaskUpdated}
                        onClick={() => router.push(`/lists/${projectId}/tasks/${task.id}`)}
                        selected={selectedIds.has(task.id)}
                        onSelect={handleSelectTask}
                      />
                    </div>
                  ))}

                  {/* Inline add row */}
                  {isAdding ? (
                    <div
                      className="flex items-center border-b border-border/40 bg-muted/5"
                      style={{ borderLeft: `3px solid ${group.color}` }}
                    >
                      {/* indent to match task rows */}
                      <div style={{ width: 52 + 12 }} className="shrink-0 flex items-center justify-center">
                        <div
                          className="h-3.5 w-3.5 rounded-full border-2"
                          style={{ borderColor: group.color, backgroundColor: group.color + '30' }}
                        />
                      </div>
                      <input
                        ref={inputRef}
                        value={newTaskName}
                        onChange={e => setNewTaskName(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') { e.preventDefault(); submitInlineTask(group.id) }
                          if (e.key === 'Escape') cancelInlineAdd()
                        }}
                        placeholder="Task name"
                        disabled={saving}
                        className="flex-1 min-w-0 bg-transparent text-sm py-2 outline-none placeholder:text-muted-foreground/50"
                      />
                      <div className="flex items-center gap-1 pr-2">
                        <button
                          onClick={() => submitInlineTask(group.id)}
                          disabled={saving || !newTaskName.trim()}
                          className="text-[10px] font-semibold px-2 py-1 rounded bg-primary text-primary-foreground disabled:opacity-40 hover:bg-primary/90 transition-colors"
                        >
                          Save
                        </button>
                        <button
                          onClick={cancelInlineAdd}
                          className="p-1 rounded hover:bg-muted/50 transition-colors text-muted-foreground"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    canManage && (
                      <div style={{ borderLeft: `3px solid ${group.color}25` }} className="border-b border-border/30">
                        <button
                          onClick={() => openInlineAdd(group.id)}
                          className="flex items-center gap-2 px-4 py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/20 transition-colors w-full group"
                        >
                          <Plus className="h-3.5 w-3.5 opacity-40 group-hover:opacity-100" style={{ color: group.color }} />
                          <span className="group-hover:text-foreground">Add Task</span>
                        </button>
                      </div>
                    )
                  )}
                </>
              )}
            </div>
          )
        })}

        {/* Global add row if no groups yet */}
        {groups.length === 0 && canManage && (
          <button
            onClick={() => openInlineAdd('todo')}
            className="flex items-center gap-2 px-4 py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/20 transition-colors w-full"
          >
            <Plus className="h-3.5 w-3.5" />Add task
          </button>
        )}
      </div>

      {/* ── Bulk action bar ─────────────────────────────────────────────── */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1 rounded-xl border border-border bg-background shadow-2xl shadow-black/20 px-3 py-2 text-sm">
          {/* Count + clear */}
          <div className="flex items-center gap-2 pr-3 border-r border-border mr-1">
            <span className="font-semibold text-foreground text-[13px]">{selectedIds.size} Task{selectedIds.size > 1 ? 's' : ''} selected</span>
            <button onClick={clearSelection} className="rounded-full p-0.5 hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Actions */}
          {[
            { icon: CheckCircle2, label: 'Status' },
            { icon: UserCheck,    label: 'Assignees' },
            { icon: CalendarDays, label: 'Dates' },
            { icon: Tag,          label: 'Tags' },
            { icon: MoveRight,    label: 'Move/Add' },
            { icon: Copy,         label: 'Copy' },
          ].map(({ icon: Icon, label }) => (
            <button
              key={label}
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}

          {/* Divider */}
          <div className="mx-1 h-5 w-px bg-border" />

          {/* Delete */}
          <button
            onClick={deleteSelected}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-medium text-red-500 hover:bg-red-50 hover:text-red-600 transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Filter types ─────────────────────────────────────────────────────────────

interface TaskFilters {
  search:    string
  assignee:  string   // profile id or 'all'
  priority:  string   // priority slug or 'all'
  showClosed: boolean // whether to show done/cancelled
}

// ─── Filter toolbar ───────────────────────────────────────────────────────────

function FilterToolbar({
  filters,
  onChange,
  members,
  view,
  onViewChange,
  canManage,
  onAddTask,
}: {
  filters: TaskFilters
  onChange: (f: TaskFilters) => void
  members: Profile[]
  view: 'list' | 'board'
  onViewChange: (v: 'list' | 'board') => void
  canManage: boolean
  onAddTask: () => void
}) {
  const [searchOpen, setSearchOpen] = useState(false)

  return (
    <div className="flex items-center gap-1.5 flex-wrap border-b border-border/60 pb-2.5 mb-3">
      {/* Left: view + group info */}
      <div className="flex items-center gap-1 mr-2">
        {/* List view */}
        <button
          onClick={() => onViewChange('list')}
          className={cn(
            'flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
            view === 'list' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
          )}
        >
          <ListTodo className="h-3.5 w-3.5" />
          List
        </button>
        {/* Board view */}
        <button
          onClick={() => onViewChange('board')}
          className={cn(
            'flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
            view === 'board' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
          )}
        >
          <BarChart2 className="h-3.5 w-3.5 rotate-90" />
          Board
        </button>
      </div>

      {/* Divider */}
      <div className="h-4 w-px bg-border mx-1" />

      {/* Group: Status label */}
      <button className="flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors">
        <Circle className="h-3.5 w-3.5" />
        Group: Status
      </button>

      {/* Subtasks */}
      <button className="flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors">
        <ListTodo className="h-3.5 w-3.5" />
        Subtasks
      </button>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Right: filter actions */}
      {/* Sort */}
      <button className="flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors">
        <ChevronDown className="h-3.5 w-3.5" />
        Sort
      </button>

      {/* Filter dropdown */}
      <div className="relative">
        <FilterDropdown filters={filters} onChange={onChange} members={members} />
      </div>

      {/* Closed toggle */}
      <button
        onClick={() => onChange({ ...filters, showClosed: !filters.showClosed })}
        className={cn(
          'flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
          filters.showClosed
            ? 'bg-primary/10 text-primary'
            : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
        )}
      >
        <CheckCircle2 className="h-3.5 w-3.5" />
        Closed
      </button>

      {/* Assignee quick filter */}
      {members.length > 0 && (
        <div className="flex -space-x-1">
          {members.slice(0, 3).map(m => (
            <button
              key={m.id}
              title={m.full_name}
              onClick={() => onChange({ ...filters, assignee: filters.assignee === m.id ? 'all' : m.id })}
              className={cn(
                'h-6 w-6 rounded-full border-2 flex items-center justify-center text-[9px] font-bold transition-all',
                filters.assignee === m.id
                  ? 'border-primary bg-primary text-primary-foreground scale-110'
                  : 'border-background bg-muted text-muted-foreground hover:border-muted-foreground'
              )}
            >
              {getInitials(m.full_name)}
            </button>
          ))}
        </div>
      )}

      {/* Search */}
      <div className={cn('flex items-center transition-all', searchOpen ? 'w-40' : 'w-7')}>
        {searchOpen ? (
          <div className="relative w-full">
            <input
              autoFocus
              value={filters.search}
              onChange={e => onChange({ ...filters, search: e.target.value })}
              onBlur={() => { if (!filters.search) setSearchOpen(false) }}
              placeholder="Search tasks…"
              className="w-full rounded-md border border-border bg-background px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-primary pr-6"
            />
            {filters.search && (
              <button
                className="absolute right-1 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => { onChange({ ...filters, search: '' }); setSearchOpen(false) }}
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        ) : (
          <button
            onClick={() => setSearchOpen(true)}
            className="h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          >
            <Circle className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Add Task button */}
      {canManage && (
        <Button size="sm" onClick={onAddTask} className="h-7 text-xs px-3">
          <Plus className="h-3.5 w-3.5 mr-1" />Add Task
        </Button>
      )}
    </div>
  )
}

// ─── Filter dropdown ──────────────────────────────────────────────────────────

function FilterDropdown({
  filters,
  onChange,
  members,
}: {
  filters: TaskFilters
  onChange: (f: TaskFilters) => void
  members: Profile[]
}) {
  const [open, setOpen] = useState(false)
  const hasFilters = filters.search || filters.assignee !== 'all' || filters.priority !== 'all'

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className={cn(
          'flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
          hasFilters
            ? 'bg-primary/10 text-primary'
            : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
        )}
      >
        <Flag className="h-3.5 w-3.5" />
        Filter
        {hasFilters && (
          <span className="ml-1 h-4 w-4 rounded-full bg-primary text-primary-foreground text-[9px] font-bold flex items-center justify-center">
            {[filters.search, filters.assignee !== 'all', filters.priority !== 'all'].filter(Boolean).length}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 w-64 rounded-lg border border-border bg-background shadow-lg p-3 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-foreground">Filters</p>
            <button
              onClick={() => { onChange({ search: '', assignee: 'all', priority: 'all', showClosed: filters.showClosed }); setOpen(false) }}
              className="text-[10px] text-muted-foreground hover:text-foreground"
            >
              Clear all
            </button>
          </div>

          {/* Search */}
          <div>
            <p className="text-[11px] font-medium text-muted-foreground mb-1">Search</p>
            <input
              value={filters.search}
              onChange={e => onChange({ ...filters, search: e.target.value })}
              placeholder="Task name…"
              className="w-full rounded border border-border bg-muted/40 px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* Priority */}
          <div>
            <p className="text-[11px] font-medium text-muted-foreground mb-1">Priority</p>
            <div className="flex flex-wrap gap-1">
              {['all', 'urgent', 'high', 'medium', 'low'].map(p => (
                <button
                  key={p}
                  onClick={() => onChange({ ...filters, priority: p })}
                  className={cn(
                    'rounded px-2 py-0.5 text-[11px] font-medium capitalize transition-colors',
                    filters.priority === p
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  )}
                >
                  {p === 'all' ? 'All' : p}
                </button>
              ))}
            </div>
          </div>

          {/* Assignee */}
          {members.length > 0 && (
            <div>
              <p className="text-[11px] font-medium text-muted-foreground mb-1">Assignee</p>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                <button
                  onClick={() => onChange({ ...filters, assignee: 'all' })}
                  className={cn(
                    'w-full flex items-center gap-2 rounded px-2 py-1 text-xs text-left transition-colors',
                    filters.assignee === 'all' ? 'bg-primary/10 text-primary' : 'hover:bg-muted/50 text-muted-foreground'
                  )}
                >
                  All assignees
                </button>
                {members.map(m => (
                  <button
                    key={m.id}
                    onClick={() => onChange({ ...filters, assignee: m.id })}
                    className={cn(
                      'w-full flex items-center gap-2 rounded px-2 py-1 text-xs text-left transition-colors',
                      filters.assignee === m.id ? 'bg-primary/10 text-primary' : 'hover:bg-muted/50 text-foreground'
                    )}
                  >
                    <span className="h-5 w-5 rounded-full bg-muted flex items-center justify-center text-[9px] font-bold shrink-0">
                      {getInitials(m.full_name)}
                    </span>
                    {m.full_name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end pt-1">
            <button
              onClick={() => setOpen(false)}
              className="rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Board view ───────────────────────────────────────────────────────────────

function ProjectBoardView({
  tasks,
  profile,
  projectId,
  onTaskUpdated,
  onTaskCreated,
  router,
}: {
  tasks: Task[]
  profile: Profile
  projectId: string
  onTaskUpdated: (t: Task) => void
  onTaskCreated: (t: Task) => void
  router: ReturnType<typeof useRouter>
}) {
  const supabase = createClient()
  const { statuses: orgStatuses, defaultPriority } = useTaskConfig()
  const [addingToCol, setAddingToCol] = useState<string | null>(null)
  const [newTaskName, setNewTaskName] = useState('')
  const [saving, setSaving]           = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (addingToCol) setTimeout(() => inputRef.current?.focus(), 30)
  }, [addingToCol])

  async function submitCard(statusId: string) {
    const title = newTaskName.trim()
    if (!title) { setAddingToCol(null); return }
    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data, error } = await supabase.from('tasks').insert({
        title,
        project_id: projectId,
        status: statusId,
        priority: defaultPriority || 'medium',
        created_by: user.id,
      }).select('*, assignees:task_assignees(user:profiles(*)), subtasks:tasks!parent_task_id(*)').single()
      if (error) { toast({ title: 'Failed to create task', description: error.message, variant: 'destructive' }); return }
      onTaskCreated(data as Task)
      setNewTaskName('')
      inputRef.current?.focus()
    } finally { setSaving(false) }
  }

  const groups = orgStatuses.map(s => ({
    id: s.slug, label: s.name.toUpperCase(), color: s.color,
    tasks: tasks.filter(t => t.status === s.slug),
  }))

  const PRIORITY_COLOR: Record<string, string> = {
    urgent: '#ef4444', high: '#f97316', medium: '#eab308', low: '#3b82f6',
  }
  const PRIORITY_LABEL: Record<string, string> = {
    urgent: 'Urgent', high: 'High', medium: 'Normal', low: 'Low',
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-4 pt-1 scrollbar-thin">
      {groups.map(group => (
        <div key={group.id} className="flex-shrink-0 w-[280px] flex flex-col">
          {/* Column header */}
          <div className="flex items-center gap-2 mb-2.5 px-1">
            <span
              className="flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-bold text-white"
              style={{ backgroundColor: group.color }}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-white/50" />
              {group.label}
            </span>
            <span className="text-xs text-muted-foreground font-medium">{group.tasks.length}</span>
          </div>

          {/* Cards */}
          <div className="flex flex-col gap-2 flex-1">
            {group.tasks.map(task => {
              const overdue = isOverdue(task.due_date) && task.status !== 'done' && task.status !== 'cancelled'
              const subtaskCount = (task.subtasks ?? []).length
              const doneSubtasks = (task.subtasks ?? []).filter(s => s.status === 'done').length

              return (
                <div
                  key={task.id}
                  onClick={() => router.push(`/lists/${projectId}/tasks/${task.id}`)}
                  className="rounded-lg border border-border bg-card p-3 cursor-pointer hover:border-primary/40 hover:shadow-sm transition-all group"
                >
                  {/* Title */}
                  <p className="text-[13px] font-medium text-foreground leading-snug mb-2">{task.title}</p>

                  {/* Meta row 1: assignees + due date */}
                  <div className="flex items-center gap-2 mb-1.5">
                    {/* Assignee avatars */}
                    <div className="flex -space-x-1 flex-1">
                      {(task.assignees ?? []).slice(0, 2).map(a => (
                        <div
                          key={a.id}
                          title={a.full_name}
                          className="h-5 w-5 rounded-full bg-muted border border-background flex items-center justify-center text-[8px] font-bold"
                        >
                          {getInitials(a.full_name)}
                        </div>
                      ))}
                      {(task.assignees ?? []).length > 2 && (
                        <div className="h-5 w-5 rounded-full bg-muted border border-background flex items-center justify-center text-[8px] font-bold text-muted-foreground">
                          +{(task.assignees ?? []).length - 2}
                        </div>
                      )}
                    </div>

                    {/* Due date */}
                    {task.due_date && (
                      <div className={cn('flex items-center gap-1 text-[11px]', overdue ? 'text-red-500 font-medium' : 'text-muted-foreground')}>
                        <Calendar className="h-3 w-3" />
                        {formatDate(task.due_date)}
                      </div>
                    )}

                    {/* Priority */}
                    <div className="flex items-center gap-1 text-[11px]" style={{ color: PRIORITY_COLOR[task.priority] ?? '#94a3b8' }}>
                      <Flag className="h-3 w-3" />
                      <span>{PRIORITY_LABEL[task.priority] ?? task.priority}</span>
                    </div>
                  </div>

                  {/* Subtask progress */}
                  {subtaskCount > 0 && (
                    <div className="flex items-center gap-2 mb-1.5">
                      <div className="flex-1 h-1 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-green-500 transition-all"
                          style={{ width: `${(doneSubtasks / subtaskCount) * 100}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-muted-foreground">{doneSubtasks}/{subtaskCount}</span>
                    </div>
                  )}
                </div>
              )
            })}

            {/* Inline add card */}
            {addingToCol === group.id ? (
              <div className="rounded-lg border border-primary/40 bg-card p-3">
                <input
                  ref={inputRef}
                  value={newTaskName}
                  onChange={e => setNewTaskName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') { e.preventDefault(); submitCard(group.id) }
                    if (e.key === 'Escape') { setAddingToCol(null); setNewTaskName('') }
                  }}
                  placeholder="Task name…"
                  disabled={saving}
                  className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground/50 mb-2"
                />
                <div className="flex gap-1">
                  <button
                    onClick={() => submitCard(group.id)}
                    disabled={saving || !newTaskName.trim()}
                    className="rounded bg-primary px-2.5 py-1 text-[11px] font-semibold text-primary-foreground disabled:opacity-40"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => { setAddingToCol(null); setNewTaskName('') }}
                    className="rounded px-2 py-1 text-[11px] text-muted-foreground hover:bg-muted"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => { setNewTaskName(''); setAddingToCol(group.id) }}
                className="flex items-center gap-1.5 rounded-lg border border-dashed border-border px-3 py-2 text-xs text-muted-foreground hover:text-foreground hover:border-muted-foreground hover:bg-muted/20 transition-colors w-full"
              >
                <Plus className="h-3.5 w-3.5" />Add Task
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

interface ProjectDetailPageProps {
  project: Project
  tasks: Task[]
  activityLogs: ActivityLog[]
  members: Profile[]
  profile: Profile
  projectMembers: ProjectMember[]
  allProfiles: Profile[]
  customRoles: CustomRole[]
}

export function ProjectDetailPage({
  project: initialProject,
  tasks,
  activityLogs,
  members,
  profile,
  projectMembers,
  allProfiles,
  customRoles,
}: ProjectDetailPageProps) {
  const router = useRouter()
  const [project, setProject] = useState<Project>(initialProject)
  const [taskList, setTaskList] = useState<Task[]>(tasks)
  const [showCreateTask, setShowCreateTask] = useState(false)
  const [taskView, setTaskView] = useState<'list' | 'board'>('list')
  const [filters, setFilters] = useState<TaskFilters>({
    search: '', assignee: 'all', priority: 'all', showClosed: false,
  })

  function handleProjectUpdated(updated: Project) {
    setProject(updated)
  }

  function handleTaskCreated(task: Task) {
    setTaskList(prev => [...prev, task])
  }

  const filteredTasks = useMemo(() => {
    return taskList.filter(t => {
      if (!filters.showClosed && (t.status === 'done' || t.status === 'cancelled')) return false
      if (filters.search && !t.title.toLowerCase().includes(filters.search.toLowerCase())) return false
      if (filters.priority !== 'all' && t.priority !== filters.priority) return false
      if (filters.assignee !== 'all' && !(t.assignees ?? []).some(a => a.id === filters.assignee)) return false
      return true
    })
  }, [taskList, filters])

  const completedTasks = taskList.filter((t) => t.status === 'done' || t.status === 'cancelled')
  const activeTasks = taskList.filter((t) => t.status !== 'done' && t.status !== 'cancelled')
  const overdueTasks = taskList.filter(
    (t) =>
      isOverdue(t.due_date) &&
      t.status !== 'done' &&
      t.status !== 'cancelled'
  )

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Project header */}
      <ProjectHeader
        project={project}
        profile={profile}
        onProjectUpdated={handleProjectUpdated}
      />

      <Separator />

      {/* Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4 sm:w-auto sm:grid-cols-none sm:flex">
          <TabsTrigger value="overview" className="gap-1.5">
            <BarChart2 className="h-4 w-4" />
            <span className="hidden sm:inline">Overview</span>
          </TabsTrigger>
          <TabsTrigger value="tasks" className="gap-1.5">
            <ListTodo className="h-4 w-4" />
            <span className="hidden sm:inline">Tasks</span>
            {taskList.length > 0 && (
              <Badge variant="secondary" className="ml-1 hidden sm:inline-flex text-xs px-1.5 py-0">
                {taskList.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="timeline" className="gap-1.5">
            <Activity className="h-4 w-4" />
            <span className="hidden sm:inline">Timeline</span>
          </TabsTrigger>
          <TabsTrigger value="members" className="gap-1.5">
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">Members</span>
          </TabsTrigger>
        </TabsList>

        {/* ---------------------------------------------------------------- */}
        {/* OVERVIEW TAB                                                      */}
        {/* ---------------------------------------------------------------- */}
        <TabsContent value="overview" className="space-y-6">
          {/* Stats cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatsCard
              label="Total Tasks"
              value={tasks.length}
              icon={<ListTodo className="h-5 w-5" />}
            />
            <StatsCard
              label="Completed"
              value={completedTasks.length}
              icon={<CheckCircle2 className="h-5 w-5 text-green-500" />}
              className="text-green-600"
            />
            <StatsCard
              label="In Progress"
              value={activeTasks.length}
              icon={<Circle className="h-5 w-5 text-blue-500" />}
              className="text-blue-600"
            />
            <StatsCard
              label="Overdue Tasks"
              value={overdueTasks.length}
              icon={<AlertTriangle className="h-5 w-5 text-red-500" />}
              className={overdueTasks.length > 0 ? 'text-red-600' : ''}
            />
          </div>

          {/* Time summary */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Time Tracking
              </CardTitle>
            </CardHeader>
            <CardContent>
              <TimeSummary
                estimatedHours={project.estimated_hours}
                actualHours={project.actual_hours ?? 0}
                showProgressBar
              />
            </CardContent>
          </Card>

          {/* Project details */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">List Details</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-3 sm:grid-cols-2">
                <DetailRow
                  label="Space"
                  value={
                    project.workspace ? (
                      <div className="flex items-center gap-1.5">
                        <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                        {project.workspace.name}
                      </div>
                    ) : (
                      '—'
                    )
                  }
                />
                <DetailRow
                  label="Client"
                  value={
                    project.client ? (
                      <div className="flex items-center gap-1.5">
                        <User className="h-3.5 w-3.5 text-muted-foreground" />
                        {project.client.full_name}
                      </div>
                    ) : (
                      'No client'
                    )
                  }
                />
                <DetailRow label="Start Date" value={formatDate(project.start_date)} />
                <DetailRow
                  label="Due Date"
                  value={
                    <span
                      className={cn(
                        isOverdue(project.due_date) &&
                          project.status !== 'completed' &&
                          project.status !== 'cancelled'
                          ? 'text-red-600 font-semibold'
                          : ''
                      )}
                    >
                      {formatDate(project.due_date)}
                    </span>
                  }
                />
                <DetailRow label="Created" value={formatDate(project.created_at)} />
                <DetailRow label="Last Updated" value={formatDate(project.updated_at)} />
              </dl>

              {project.description && (
                <div className="mt-4 pt-4 border-t">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                    Description
                  </p>
                  <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                    {project.description}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---------------------------------------------------------------- */}
        {/* TASKS TAB                                                         */}
        {/* ---------------------------------------------------------------- */}
        <TabsContent value="tasks">
          {/* Filter + view toolbar */}
          <FilterToolbar
            filters={filters}
            onChange={setFilters}
            members={members}
            view={taskView}
            onViewChange={setTaskView}
            canManage={profile.role === 'super_admin' || profile.role === 'staff'}
            onAddTask={() => setShowCreateTask(true)}
          />

          <div className="flex gap-4 items-start">
            {/* Main task area */}
            <div className="flex-1 min-w-0 overflow-hidden">
              {taskView === 'list' ? (
                <ProjectTaskList
                  tasks={filteredTasks}
                  profile={profile}
                  projectId={project.id}
                  onTaskUpdated={(updated) =>
                    setTaskList((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))
                  }
                  onTaskCreated={handleTaskCreated}
                  onOpenDialog={() => setShowCreateTask(true)}
                />
              ) : (
                <ProjectBoardView
                  tasks={filteredTasks}
                  profile={profile}
                  projectId={project.id}
                  onTaskUpdated={(updated) =>
                    setTaskList((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))
                  }
                  onTaskCreated={handleTaskCreated}
                  router={router}
                />
              )}
            </div>

            {/* Right info panel — ClickUp-style project details */}
            <div className="w-[240px] shrink-0 hidden xl:block">
              <div className="rounded-lg border border-border bg-card overflow-hidden">
                {/* Header */}
                <div className="px-4 py-3 border-b border-border bg-muted/30">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">List Info</p>
                </div>

                <div className="divide-y divide-border/60">
                  {/* Status */}
                  <div className="flex items-center gap-2 px-4 py-2.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="text-xs text-muted-foreground w-16 shrink-0">Status</span>
                    <span className="text-xs font-medium capitalize">{project.status?.replace(/_/g, ' ')}</span>
                  </div>

                  {/* Priority */}
                  <div className="flex items-center gap-2 px-4 py-2.5">
                    <Flag className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="text-xs text-muted-foreground w-16 shrink-0">Priority</span>
                    <span className="text-xs font-medium capitalize">{project.priority?.replace(/_/g, ' ') ?? '—'}</span>
                  </div>

                  {/* Workspace */}
                  <div className="flex items-center gap-2 px-4 py-2.5">
                    <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="text-xs text-muted-foreground w-16 shrink-0">Space</span>
                    <span className="text-xs font-medium truncate">{project.workspace?.name ?? '—'}</span>
                  </div>

                  {/* Client */}
                  {project.client && (
                    <div className="flex items-center gap-2 px-4 py-2.5">
                      <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="text-xs text-muted-foreground w-16 shrink-0">Client</span>
                      <span className="text-xs font-medium truncate">{project.client.full_name}</span>
                    </div>
                  )}

                  {/* Start date */}
                  <div className="flex items-center gap-2 px-4 py-2.5">
                    <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="text-xs text-muted-foreground w-16 shrink-0">Start</span>
                    <span className="text-xs font-medium">{formatDate(project.start_date)}</span>
                  </div>

                  {/* Due date */}
                  <div className="flex items-center gap-2 px-4 py-2.5">
                    <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="text-xs text-muted-foreground w-16 shrink-0">Due</span>
                    <span className={cn(
                      'text-xs font-medium',
                      isOverdue(project.due_date) && project.status !== 'completed' && project.status !== 'cancelled'
                        ? 'text-red-500' : ''
                    )}>
                      {formatDate(project.due_date)}
                    </span>
                  </div>

                  {/* Progress */}
                  <div className="px-4 py-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs text-muted-foreground">Progress</span>
                      <span className="text-xs font-semibold">{project.progress ?? 0}%</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary transition-all"
                        style={{ width: `${project.progress ?? 0}%` }}
                      />
                    </div>
                  </div>

                  {/* Task stats */}
                  <div className="px-4 py-3 space-y-1.5">
                    <span className="text-xs text-muted-foreground block mb-2">Tasks</span>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Total</span>
                      <span className="text-xs font-semibold">{taskList.length}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-green-600">Done</span>
                      <span className="text-xs font-semibold text-green-600">
                        {taskList.filter(t => t.status === 'done').length}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-blue-600">In Progress</span>
                      <span className="text-xs font-semibold text-blue-600">
                        {taskList.filter(t => t.status === 'in_progress').length}
                      </span>
                    </div>
                    {taskList.filter(t => isOverdue(t.due_date) && t.status !== 'done' && t.status !== 'cancelled').length > 0 && (
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-red-500">Overdue</span>
                        <span className="text-xs font-semibold text-red-500">
                          {taskList.filter(t => isOverdue(t.due_date) && t.status !== 'done' && t.status !== 'cancelled').length}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Description */}
                  {project.description && (
                    <div className="px-4 py-3">
                      <span className="text-xs text-muted-foreground block mb-1.5">Description</span>
                      <p className="text-xs text-foreground/80 leading-relaxed line-clamp-4">
                        {project.description}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* ---------------------------------------------------------------- */}
        {/* TIMELINE TAB                                                      */}
        {/* ---------------------------------------------------------------- */}
        <TabsContent value="timeline" className="space-y-4">
          {activityLogs.length === 0 ? (
            <EmptyState
              icon={<Activity className="h-10 w-10 text-muted-foreground" />}
              title="No activity yet"
              description="Activity for this project will appear here."
            />
          ) : (
            <div className="relative pl-6 space-y-4">
              {/* Vertical line */}
              <div className="absolute left-2.5 top-0 bottom-0 w-px bg-border" />

              {activityLogs.map((log) => (
                <div key={log.id} className="relative flex gap-3">
                  {/* Dot */}
                  <div className="absolute -left-4 mt-1 h-2 w-2 rounded-full bg-primary ring-2 ring-background" />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        {log.user && (
                          <Avatar className="h-6 w-6 flex-shrink-0">
                            <AvatarFallback className="text-xs">
                              {getInitials(log.user.full_name)}
                            </AvatarFallback>
                          </Avatar>
                        )}
                        <div className="min-w-0">
                          <span className="text-sm font-medium">
                            {log.user?.full_name ?? 'Unknown user'}
                          </span>
                          <span className="text-sm text-muted-foreground ml-1">
                            {log.action}
                          </span>
                          {log.old_value && log.new_value && (
                            <span className="text-sm text-muted-foreground">
                              {' '}
                              from{' '}
                              <span className="font-medium text-foreground">
                                {log.old_value}
                              </span>{' '}
                              to{' '}
                              <span className="font-medium text-foreground">
                                {log.new_value}
                              </span>
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="text-xs text-muted-foreground flex-shrink-0 whitespace-nowrap">
                        {timeAgo(log.created_at)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ---------------------------------------------------------------- */}
        {/* MEMBERS TAB                                                       */}
        {/* ---------------------------------------------------------------- */}
        <TabsContent value="members" className="space-y-4">
          {/* Project team (leads + assigned members) */}
          <ProjectTeamSection
            projectId={project.id}
            initialMembers={projectMembers}
            allProfiles={allProfiles}
            customRoles={customRoles}
            canManage={profile.role === 'super_admin'}
          />

          {/* Workspace members */}
          {members.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                Workspace Members
              </p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {members.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center gap-3 rounded-lg border bg-card p-3"
                >
                  <Avatar className="h-9 w-9 flex-shrink-0">
                    <AvatarFallback className="text-sm">
                      {getInitials(member.full_name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{member.full_name}</p>
                    <p className="text-xs text-muted-foreground truncate">{member.email}</p>
                  </div>
                  <Badge variant="outline" className="ml-auto flex-shrink-0 text-xs capitalize">
                    {member.role.replace('_', ' ')}
                  </Badge>
                </div>
              ))}

              {/* Also show client if present */}
              {project.client && !members.find((m) => m.id === project.client?.id) && (
                <div className="flex items-center gap-3 rounded-lg border bg-card p-3">
                  <Avatar className="h-9 w-9 flex-shrink-0">
                    <AvatarFallback className="text-sm">
                      {getInitials(project.client.full_name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">
                      {project.client.full_name}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {project.client.email}
                    </p>
                  </div>
                  <Badge variant="outline" className="ml-auto flex-shrink-0 text-xs">
                    Client
                  </Badge>
                </div>
              )}
            </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      <CreateTaskDialog
        open={showCreateTask}
        onOpenChange={setShowCreateTask}
        projects={[project]}
        profile={profile}
        onCreated={handleTaskCreated}
        projectId={project.id}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Helper components
// ---------------------------------------------------------------------------

function StatsCard({
  label,
  value,
  icon,
  className,
}: {
  label: string
  value: number
  icon: React.ReactNode
  className?: string
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">{label}</p>
          {icon}
        </div>
        <p className={cn('text-2xl font-bold mt-1', className)}>{value}</p>
      </CardContent>
    </Card>
  )
}

function DetailRow({
  label,
  value,
}: {
  label: string
  value: React.ReactNode
}) {
  return (
    <div>
      <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-0.5">
        {label}
      </dt>
      <dd className="text-sm">{value}</dd>
    </div>
  )
}


function EmptyState({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode
  title: string
  description: string
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12 text-center">
      <div className="mb-3 rounded-full bg-muted p-4">{icon}</div>
      <h3 className="text-base font-semibold">{title}</h3>
      <p className="text-sm text-muted-foreground mt-1 max-w-xs">{description}</p>
    </div>
  )
}
