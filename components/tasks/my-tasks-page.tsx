'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  isToday,
  isThisWeek,
  isBefore,
  parseISO,
  startOfDay,
  format,
} from 'date-fns'
import { Task, Profile, List, TaskStatus, Priority } from '@/types'
import { TaskRow, VisibleColsRow } from './task-row'
import { CreateTaskDialog } from './create-task-dialog'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Plus,
  Search,
  X,
  CheckSquare,
  Download,
  ChevronDown,
  ChevronRight,
  Users,
  Calendar,
  Flag,
  FolderOpen,
  Columns3,
} from 'lucide-react'
import { TASK_STATUSES, PRIORITIES } from '@/lib/constants'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { toast } from '@/components/ui/use-toast'
import { useTaskConfig } from '@/hooks/use-task-config'

interface MyTasksPageProps {
  initialTasks: Task[]
  profile: Profile
  lists: List[]
}

type TaskGroup = {
  id: string
  label: string
  tasks: Task[]
  color: string
}

// Column header widths — must match task-row.tsx
const COL_ASSIGNEES = 'w-[80px]'
const COL_DUE       = 'w-[90px]'
const COL_PRIORITY  = 'w-[90px]'
const COL_ACTION    = 'w-8'

const COL_LABELS: Record<keyof VisibleColsRow, string> = {
  assignee: 'Assignees',
  dueDate:  'Due Date',
  size:     'Time Estimate',
  priority: 'Priority',
}

const GROUP_COLORS: Record<string, string> = {
  overdue:   '#ef4444',
  today:     '#f97316',
  this_week: '#3b82f6',
  later:     '#94a3b8',
}

export function MyTasksPage({ initialTasks, profile, lists }: MyTasksPageProps) {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const activeFilter = searchParams.get('filter') // 'today' | null
  const supabase     = createClient()
  const { defaultPriority } = useTaskConfig()

  const [tasks, setTasks]               = useState<Task[]>(initialTasks)
  const [search, setSearch]             = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [priorityFilter, setPriorityFilter] = useState<string>('all')
  const [listFilter, setListFilter]   = useState<string>('all')
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [collapsedGroups, setCollapsedGroups]   = useState<Set<string>>(new Set())

  // Inline add state
  const [addingToGroup,   setAddingToGroup]   = useState<string | null>(null)
  const [newTaskName,     setNewTaskName]     = useState('')
  const [newTaskList,  setNewTaskList]  = useState(lists[0]?.id ?? '')
  const [saving,          setSaving]          = useState(false)
  const inlineInputRef = useRef<HTMLInputElement>(null)

  // Fields drawer
  const [fieldsOpen, setFieldsOpen] = useState(false)
  const [visibleCols, setVisibleCols] = useState<VisibleColsRow>({
    assignee: true,
    dueDate:  true,
    size:     true,
    priority: true,
  })
  function toggleCol(key: keyof VisibleColsRow) {
    setVisibleCols(prev => ({ ...prev, [key]: !prev[key] }))
  }


  useEffect(() => {
    if (addingToGroup) setTimeout(() => inlineInputRef.current?.focus(), 30)
  }, [addingToGroup])

  function openInlineAdd(groupId: string) {
    setNewTaskName('')
    setNewTaskList(lists[0]?.id ?? '')
    setCollapsedGroups(prev => { const n = new Set(prev); n.delete(groupId); return n })
    setAddingToGroup(groupId)
  }

  function cancelInlineAdd() { setAddingToGroup(null); setNewTaskName('') }

  async function submitInlineTask() {
    const title = newTaskName.trim()
    if (!title) { cancelInlineAdd(); return }
    if (!newTaskList) { toast({ title: 'Select a list', variant: 'destructive' }); return }
    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data, error } = await supabase.from('tasks').insert({
        title,
        list_id: newTaskList,
        status:     addingToGroup ?? 'todo',
        priority:   defaultPriority || 'medium',
        created_by: user.id,
      }).select('*, assignees:task_assignees(user:profiles(*)), subtasks:tasks!parent_task_id(*)').single()
      if (error) { toast({ title: 'Failed to create task', description: error.message, variant: 'destructive' }); return }
      setTasks(prev => [data as Task, ...prev])
      setNewTaskName('')
      inlineInputRef.current?.focus()
    } finally { setSaving(false) }
  }

  const canCreate = profile.role === 'super_admin' || profile.role === 'staff'

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      const matchesSearch =
        search === '' ||
        task.title.toLowerCase().includes(search.toLowerCase()) ||
        task.description?.toLowerCase().includes(search.toLowerCase())
      const matchesStatus   = statusFilter === 'all'   || task.status === statusFilter
      const matchesPriority = priorityFilter === 'all' || task.priority === priorityFilter
      const matchesList  = listFilter === 'all'  || task.list_id === listFilter
      return matchesSearch && matchesStatus && matchesPriority && matchesList
    })
  }, [tasks, search, statusFilter, priorityFilter, listFilter])

  // For "Today & Overdue" filter — only show overdue + today tasks
  const filterSource = useMemo(() => {
    if (activeFilter === 'today') {
      const now   = new Date()
      const today = startOfDay(now)
      return filteredTasks.filter(t => {
        if (t.status === 'done' || t.status === 'cancelled') return false
        if (!t.due_date) return false
        const due = parseISO(t.due_date)
        return isBefore(due, today) || isToday(due)
      })
    }
    return filteredTasks
  }, [filteredTasks, activeFilter])

  const groupedTasks = useMemo<TaskGroup[]>(() => {
    const now   = new Date()
    const today = startOfDay(now)

    const overdue:   Task[] = []
    const todayList: Task[] = []
    const thisWeek:  Task[] = []
    const later:     Task[] = []

    for (const task of filterSource) {
      if (task.status === 'done' || task.status === 'cancelled') {
        if (activeFilter !== 'today') later.push(task)
        continue
      }
      if (!task.due_date) { if (activeFilter !== 'today') later.push(task); continue }
      const due = parseISO(task.due_date)
      if (isBefore(due, today))                         overdue.push(task)
      else if (isToday(due))                            todayList.push(task)
      else if (isThisWeek(due, { weekStartsOn: 1 }))   thisWeek.push(task)
      else                                              later.push(task)
    }

    const groups: TaskGroup[] = []
    if (overdue.length)   groups.push({ id: 'overdue',   label: 'Overdue',       tasks: overdue,   color: GROUP_COLORS.overdue   })
    if (todayList.length) groups.push({ id: 'today',     label: 'Due Today',     tasks: todayList, color: GROUP_COLORS.today     })
    if (thisWeek.length)  groups.push({ id: 'this_week', label: 'Due This Week', tasks: thisWeek,  color: GROUP_COLORS.this_week })
    if (later.length)     groups.push({ id: 'later',     label: 'Later',         tasks: later,     color: GROUP_COLORS.later     })
    return groups
  }, [filterSource, activeFilter])

  const hasActiveFilters =
    search !== '' || statusFilter !== 'all' || priorityFilter !== 'all' || listFilter !== 'all'

  function clearFilters() {
    setSearch(''); setStatusFilter('all'); setPriorityFilter('all'); setListFilter('all')
  }

  function toggleGroup(id: string) {
    setCollapsedGroups((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function handleTaskCreated(newTask: Task) {
    setTasks((prev) => [newTask, ...prev])
    setShowCreateDialog(false)
  }

  function handleTaskUpdated(updated: Task) {
    setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))
  }

  function handleTaskClick(task: Task) {
    router.push(`/lists/${task.list_id}/tasks/${task.id}`)
  }

  const totalCount = tasks.length
  const doneCount  = tasks.filter((t) => t.status === 'done').length
  const dateSlug   = format(new Date(), 'yyyy-MM-dd')

  // ── Export helpers ────────────────────────────────────────────────────────
  function buildTableHtml() {
    const headers = ['Title', 'List', 'Status', 'Priority', 'Due Date']
    const rows = filteredTasks.map((t) => `<tr>
      <td>${t.title}</td>
      <td>${lists.find((p) => p.id === t.list_id)?.name ?? '-'}</td>
      <td>${t.status.replace(/_/g, ' ')}</td>
      <td>${t.priority}</td>
      <td>${t.due_date ? format(new Date(t.due_date + 'T00:00:00'), 'MMM d, yyyy') : '-'}</td>
    </tr>`).join('')
    return `<table><thead><tr>${headers.map((h) => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table>`
  }

  function exportCsv() {
    const headers = ['Title', 'List', 'Status', 'Priority', 'Due Date']
    const rows = filteredTasks.map((t) => [
      `"${t.title.replace(/"/g, '""')}"`,
      `"${(lists.find((p) => p.id === t.list_id)?.name ?? '').replace(/"/g, '""')}"`,
      t.status.replace(/_/g, ' '),
      t.priority,
      t.due_date ? format(new Date(t.due_date + 'T00:00:00'), 'MMM d, yyyy') : '',
    ])
    const csv  = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = `tasks-${dateSlug}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  function exportPdf() {
    const html = `<!DOCTYPE html><html><head><title>My Tasks ${dateSlug}</title><style>
      body{font-family:Arial,sans-serif;font-size:12px;margin:24px}
      table{width:100%;border-collapse:collapse}
      th{background:#f3f4f6;padding:8px 10px;text-align:left;border:1px solid #d1d5db;font-size:11px}
      td{padding:6px 10px;border:1px solid #e5e7eb}
    </style></head><body><h2>My Tasks — ${dateSlug}</h2>${buildTableHtml()}</body></html>`
    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(html); win.document.close(); win.focus(); win.print()
  }

  function exportDoc() {
    const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
      <head><meta charset="utf-8"><title>My Tasks ${dateSlug}</title>
      <style>body{font-family:Arial;font-size:12pt}table{width:100%;border-collapse:collapse}
      th{background:#f3f4f6;padding:6pt 8pt;border:1pt solid #d1d5db;font-size:10pt}
      td{padding:5pt 8pt;border:1pt solid #e5e7eb}</style></head>
      <body><h2>My Tasks — ${dateSlug}</h2>${buildTableHtml()}</body></html>`
    const blob = new Blob(['\ufeff', html], { type: 'application/msword' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = `tasks-${dateSlug}.doc`; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="page-inner">
      {/* ── Page header ─────────────────────────────────────────────────── */}
      <div className="page-header">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {activeFilter === 'today' ? 'Today & Overdue' : 'My Tasks'}
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {doneCount}/{totalCount} completed
          </p>
        </div>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs">
                <Download className="h-3.5 w-3.5" />
                Export
                <ChevronDown className="h-3 w-3 text-muted-foreground/70" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={exportCsv}>Export as CSV</DropdownMenuItem>
              <DropdownMenuItem onClick={exportPdf}>Export as PDF</DropdownMenuItem>
              <DropdownMenuItem onClick={exportDoc}>Export as DOC</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {canCreate && (
            <Button onClick={() => setShowCreateDialog(true)} size="sm" className="h-8">
              <Plus className="h-4 w-4 mr-1.5" />
              New Task
            </Button>
          )}
        </div>
      </div>

      {/* ── Filter bar ──────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search tasks…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-8 text-sm"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[130px] h-8 text-xs">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {TASK_STATUSES.map((s) => (
                <SelectItem key={s.value} value={s.value} className="text-xs">{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={priorityFilter} onValueChange={setPriorityFilter}>
            <SelectTrigger className="w-[120px] h-8 text-xs">
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Priorities</SelectItem>
              {PRIORITIES.map((p) => (
                <SelectItem key={p.value} value={p.value} className="text-xs">{p.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {lists.length > 0 && (
            <Select value={listFilter} onValueChange={setListFilter}>
              <SelectTrigger className="w-[160px] h-8 text-xs">
                <SelectValue placeholder="List" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Lists</SelectItem>
                {lists.map((p) => (
                  <SelectItem key={p.id} value={p.id} className="text-xs">{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="h-8 gap-1 text-xs">
              <X className="h-3.5 w-3.5" />
              Clear
            </Button>
          )}
        </div>
      </div>

      {/* ── Empty state ─────────────────────────────────────────────────── */}
      {groupedTasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
          <div className="mb-4 rounded-full bg-muted p-4">
            <CheckSquare className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold">No tasks found</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm">
            {hasActiveFilters
              ? 'Try adjusting your filters or search query.'
              : canCreate
              ? 'Create your first task to get started.'
              : 'No tasks have been assigned to you yet.'}
          </p>
          {hasActiveFilters && (
            <Button variant="outline" size="sm" onClick={clearFilters} className="mt-4">Clear filters</Button>
          )}
          {!hasActiveFilters && canCreate && (
            <Button size="sm" onClick={() => setShowCreateDialog(true)} className="mt-4">
              <Plus className="h-4 w-4 mr-2" />New Task
            </Button>
          )}
        </div>
      ) : (
        <div className="rounded-lg border bg-card overflow-hidden">
          {/* ── Column headers ──────────────────────────────────────────── */}
          <div className="flex items-center border-b border-border bg-muted/40 text-xs font-medium text-muted-foreground select-none h-8">
            {/* indent: expand(28) + status(24) = 52px */}
            <div style={{ width: 52 + 12 }} className="shrink-0" />
            <div className="flex-1 min-w-0 px-2">Task Name</div>
            {visibleCols.assignee && (
              <div className={cn(COL_ASSIGNEES, 'shrink-0 flex items-center gap-1 px-1')}>
                <Users className="h-3 w-3" />
                Assignees
              </div>
            )}
            {visibleCols.dueDate && (
              <div className={cn(COL_DUE, 'shrink-0 flex items-center gap-1 px-1')}>
                <Calendar className="h-3 w-3" />
                Due Date
              </div>
            )}
            {visibleCols.size && (
              <div className="w-[70px] shrink-0 flex items-center gap-1 px-1">
                <Calendar className="h-3 w-3" />
                Time Est.
              </div>
            )}
            {visibleCols.priority && (
              <div className={cn(COL_PRIORITY, 'shrink-0 flex items-center gap-1 px-1')}>
                <Flag className="h-3 w-3" />
                Priority
              </div>
            )}
            <div className="w-9 shrink-0 flex items-center justify-center">
              <button
                onClick={() => setFieldsOpen(true)}
                title="Manage fields"
                className="h-6 w-6 flex items-center justify-center rounded-full border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <Columns3 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* ── Groups ──────────────────────────────────────────────────── */}
          {groupedTasks.map((group) => {
            const collapsed = collapsedGroups.has(group.id)
            return (
              <div key={group.id}>
                {/* Group header */}
                <div
                  className="flex items-center gap-2 px-3 py-1.5 border-b border-border/60 cursor-pointer select-none hover:bg-muted/20 transition-colors"
                  style={{ borderLeft: `3px solid ${group.color}` }}
                  onClick={() => toggleGroup(group.id)}
                >
                  <span className="text-muted-foreground">
                    {collapsed
                      ? <ChevronRight className="h-3.5 w-3.5" />
                      : <ChevronDown className="h-3.5 w-3.5" />}
                  </span>
                  <span
                    className="text-xs font-semibold uppercase tracking-wider"
                    style={{ color: group.color }}
                  >
                    {group.label}
                  </span>
                  <span
                    className="text-xs font-medium rounded-full px-1.5 py-0.5 min-w-[20px] text-center"
                    style={{
                      backgroundColor: group.color + '20',
                      color: group.color,
                    }}
                  >
                    {group.tasks.length}
                  </span>
                </div>

                {/* Task rows */}
                {!collapsed && (
                  <>
                    {group.tasks.map((task) => (
                      <div
                        key={task.id}
                        style={{ borderLeft: `3px solid ${group.color}40` }}
                      >
                        <TaskRow
                          task={task}
                          profile={profile}
                          onTaskUpdated={handleTaskUpdated}
                          onClick={() => handleTaskClick(task)}
                          showList
                          visibleCols={visibleCols}
                        />
                      </div>
                    ))}

                    {/* Inline add row */}
                    {addingToGroup === group.id ? (
                      <div
                        className="flex items-center gap-2 border-b border-border/40 bg-muted/10 px-3 py-1.5"
                        style={{ borderLeft: `3px solid ${group.color}` }}
                      >
                        <div className="h-3.5 w-3.5 rounded-full border-2 shrink-0"
                          style={{ borderColor: group.color, backgroundColor: group.color + '30' }} />
                        <input
                          ref={inlineInputRef}
                          value={newTaskName}
                          onChange={e => setNewTaskName(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') { e.preventDefault(); submitInlineTask() }
                            if (e.key === 'Escape') cancelInlineAdd()
                          }}
                          placeholder="Task name"
                          disabled={saving}
                          className="flex-1 min-w-0 bg-transparent text-sm py-1 outline-none placeholder:text-muted-foreground/50"
                        />
                        {lists.length > 1 && (
                          <Select value={newTaskList} onValueChange={setNewTaskList}>
                            <SelectTrigger className="h-7 w-[130px] text-xs border-dashed shrink-0">
                              <FolderOpen className="h-3 w-3 mr-1 shrink-0" />
                              <SelectValue placeholder="List" />
                            </SelectTrigger>
                            <SelectContent>
                              {lists.map(p => (
                                <SelectItem key={p.id} value={p.id} className="text-xs">{p.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                        <button
                          onClick={submitInlineTask}
                          disabled={saving || !newTaskName.trim()}
                          className="text-[10px] font-semibold px-2 py-1 rounded bg-primary text-primary-foreground disabled:opacity-40 hover:bg-primary/90 transition-colors shrink-0"
                        >
                          Save
                        </button>
                        <button onClick={cancelInlineAdd} className="p-1 rounded hover:bg-muted/50 transition-colors text-muted-foreground shrink-0">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : (
                      canCreate && (
                        <div style={{ borderLeft: `3px solid ${group.color}40` }} className="border-b border-border/40">
                          <button
                            onClick={() => openInlineAdd(group.id)}
                            className="flex items-center gap-2 px-4 py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/20 transition-colors w-full group"
                          >
                            <Plus className="h-3.5 w-3.5 opacity-50 group-hover:opacity-100" />
                            Add task
                          </button>
                        </div>
                      )
                    )}
                  </>
                )}
              </div>
            )
          })}
        </div>
      )}

      {showCreateDialog && (
        <CreateTaskDialog
          open={showCreateDialog}
          onOpenChange={setShowCreateDialog}
          lists={lists}
          profile={profile}
          onCreated={handleTaskCreated}
        />
      )}

      {/* ── Fields drawer ───────────────────────────────────────────────── */}
      <Sheet open={fieldsOpen} onOpenChange={setFieldsOpen}>
        <SheetContent side="right" className="w-80 p-0 flex flex-col gap-0">
          <SheetHeader className="px-4 py-3 border-b shrink-0">
            <SheetTitle className="text-sm font-semibold">Fields</SheetTitle>
          </SheetHeader>

          {/* Search */}
          <div className="px-3 py-2 border-b shrink-0">
            <input
              placeholder="Search for new or existing fields"
              className="w-full rounded-md border border-border bg-muted/30 px-3 py-1.5 text-xs outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/50"
            />
          </div>

          <div className="flex-1 overflow-y-auto">
            {/* Shown section */}
            <div className="px-3 pt-3 pb-1">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Shown</span>
                <button
                  onClick={() => setVisibleCols({ assignee: false, dueDate: false, size: false, priority: false })}
                  className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                >
                  Hide all
                </button>
              </div>

              {/* Task Name — always shown */}
              <div className="flex items-center justify-between px-2 py-2 rounded-lg">
                <div className="flex items-center gap-2.5">
                  <span className="h-4 w-4 flex items-center justify-center text-muted-foreground">
                    <Flag className="h-3.5 w-3.5" />
                  </span>
                  <span className="text-sm">Task Name</span>
                </div>
                <button className="relative inline-flex h-5 w-9 shrink-0 rounded-full bg-emerald-500 opacity-50 cursor-not-allowed">
                  <span className="inline-block h-4 w-4 rounded-full bg-white shadow mt-0.5 translate-x-4" />
                </button>
              </div>

              {(Object.keys(COL_LABELS) as (keyof VisibleColsRow)[])
                .filter(key => visibleCols[key])
                .map(key => (
                  <div
                    key={key}
                    onClick={() => toggleCol(key)}
                    className="flex items-center justify-between px-2 py-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="h-4 w-4 flex items-center justify-center text-muted-foreground">
                        {key === 'assignee' ? <Users className="h-3.5 w-3.5" /> :
                         key === 'dueDate'  ? <Calendar className="h-3.5 w-3.5" /> :
                         key === 'priority' ? <Flag className="h-3.5 w-3.5" /> :
                                              <Calendar className="h-3.5 w-3.5" />}
                      </span>
                      <span className="text-sm">{COL_LABELS[key]}</span>
                    </div>
                    <button className="relative inline-flex h-5 w-9 shrink-0 rounded-full bg-emerald-500 transition-colors">
                      <span className="inline-block h-4 w-4 rounded-full bg-white shadow mt-0.5 translate-x-4" />
                    </button>
                  </div>
                ))}
            </div>

            <div className="mx-3 my-1 border-t border-border/50" />

            {/* Hidden section */}
            <div className="px-3 pb-3">
              <div className="flex items-center justify-between mb-1 pt-1">
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Hidden</span>
              </div>

              {(Object.keys(COL_LABELS) as (keyof VisibleColsRow)[])
                .filter(key => !visibleCols[key])
                .map(key => (
                  <div
                    key={key}
                    onClick={() => toggleCol(key)}
                    className="flex items-center justify-between px-2 py-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="h-4 w-4 flex items-center justify-center text-muted-foreground/50">
                        {key === 'assignee' ? <Users className="h-3.5 w-3.5" /> :
                         key === 'dueDate'  ? <Calendar className="h-3.5 w-3.5" /> :
                         key === 'priority' ? <Flag className="h-3.5 w-3.5" /> :
                                              <Calendar className="h-3.5 w-3.5" />}
                      </span>
                      <span className="text-sm text-muted-foreground">{COL_LABELS[key]}</span>
                    </div>
                    <button className="relative inline-flex h-5 w-9 shrink-0 rounded-full bg-muted transition-colors">
                      <span className="inline-block h-4 w-4 rounded-full bg-white shadow mt-0.5 translate-x-0.5" />
                    </button>
                  </div>
                ))}

              {(Object.keys(COL_LABELS) as (keyof VisibleColsRow)[]).filter(k => !visibleCols[k]).length === 0 && (
                <p className="text-xs text-muted-foreground/50 px-2 py-2">All fields are shown</p>
              )}
            </div>
          </div>

          <div className="px-4 py-3 border-t shrink-0">
            <button
              onClick={() => setVisibleCols({ assignee: true, dueDate: true, size: true, priority: true })}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
            >
              Reset to defaults
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
