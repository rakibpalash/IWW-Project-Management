'use client'

import { useState, useTransition, useMemo, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getWorkspaceMembersAction } from '@/app/actions/workspaces'
import {
  format, parseISO, isAfter, isBefore, subDays, addDays,
  startOfMonth, endOfMonth, eachDayOfInterval, getDay,
  differenceInDays, startOfWeek, addMonths, subMonths,
  isSameMonth, isToday,
} from 'date-fns'
import { cloneWorkspaceAction } from '@/app/actions/workspaces'
import { AssignStaffDialog } from './assign-staff-dialog'
import { RenameWorkspaceDialog } from './rename-workspace-dialog'
import { CreateProjectDialog } from '@/components/projects/create-project-dialog'
import { CreateTaskDialog } from '@/components/tasks/create-task-dialog'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Workspace, Profile, Project, Task, ActivityLog } from '@/types'
import { cn, formatStatus, getInitials, timeAgo } from '@/lib/utils'
import { useToast } from '@/components/ui/use-toast'
import {
  Users, Search, Filter, LayoutGrid, List, MoreHorizontal, Loader2, Copy,
  Plus, RefreshCw, ChevronDown, ChevronRight, SlidersHorizontal,
  Share2, Maximize2, UserPlus, FolderKanban, LayoutList, Calendar,
  ExternalLink, CheckCircle2, PenLine, FilePlus2, Clock, Activity,
  BarChart2, Globe, ChevronLeft, Check, Pencil,
} from 'lucide-react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'

// ─── Types ────────────────────────────────────────────────────────────────────
type TabType = 'summary' | 'list' | 'board' | 'calendar' | 'timeline'

interface WorkspaceDetailPageProps {
  workspace: Workspace
  members: Profile[]
  projects: Project[]
  tasks: Task[]
  activityLogs: ActivityLog[]
  isAdmin: boolean
  profile: Profile
}

// ─── Constants ────────────────────────────────────────────────────────────────
const STATUS_STYLES: Record<string, string> = {
  todo:        'bg-slate-100 text-slate-600 border-slate-200',
  in_progress: 'bg-amber-50 text-amber-700 border-amber-200',
  in_review:   'bg-blue-50 text-blue-700 border-blue-200',
  done:        'bg-green-50 text-green-700 border-green-200',
  cancelled:   'bg-red-50 text-red-600 border-red-200',
}

const STATUS_LABEL: Record<string, string> = {
  todo: 'To Do', in_progress: 'In Progress', in_review: 'In Review',
  done: 'Done', cancelled: 'Cancelled',
}

const STATUS_BAR_COLOR: Record<string, string> = {
  todo: '#94a3b8', in_progress: '#f59e0b', in_review: '#3b82f6',
  done: '#22c55e', cancelled: '#ef4444',
}

const PRIORITY_ICON: Record<string, string> = {
  urgent: '↑↑', high: '↑', medium: '=', low: '↓',
}

const PRIORITY_COLOR: Record<string, string> = {
  urgent: 'text-red-500', high: 'text-orange-500',
  medium: 'text-yellow-500', low: 'text-blue-400',
}

// ─── Donut Chart ──────────────────────────────────────────────────────────────
function DonutChart({ data }: { data: { label: string; value: number; color: string }[] }) {
  const total = data.reduce((s, d) => s + d.value, 0)
  if (total === 0) {
    return (
      <div className="flex items-center justify-center h-40">
        <div className="relative h-32 w-32">
          <svg viewBox="0 0 36 36" className="h-full w-full -rotate-90">
            <circle cx="18" cy="18" r="15.9" fill="none" stroke="#e2e8f0" strokeWidth="3.8" />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center flex-col">
            <span className="text-2xl font-bold">0</span>
            <span className="text-xs text-muted-foreground">Total</span>
          </div>
        </div>
      </div>
    )
  }
  let offset = 0
  const circumference = 2 * Math.PI * 15.9
  return (
    <div className="flex items-center gap-6">
      <div className="relative h-36 w-36 shrink-0">
        <svg viewBox="0 0 36 36" className="h-full w-full -rotate-90">
          <circle cx="18" cy="18" r="15.9" fill="none" stroke="#e2e8f0" strokeWidth="3.8" />
          {data.filter(d => d.value > 0).map((d, i) => {
            const pct = d.value / total
            const dash = pct * circumference
            const el = (
              <circle key={i} cx="18" cy="18" r="15.9" fill="none"
                stroke={d.color} strokeWidth="3.8"
                strokeDasharray={`${dash} ${circumference - dash}`}
                strokeDashoffset={-offset * circumference}
              />
            )
            offset += pct
            return el
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold">{total}</span>
          <span className="text-[10px] text-muted-foreground text-center leading-tight">Total work<br />items</span>
        </div>
      </div>
      <div className="space-y-1.5">
        {data.map((d) => (
          <div key={d.label} className="flex items-center gap-2 text-xs">
            <span className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ background: d.color }} />
            <span className="text-muted-foreground">{d.label}:</span>
            <span className="font-medium">{d.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function WorkspaceDetailPage({
  workspace, members: initialMembers, projects, tasks, activityLogs, isAdmin, profile,
}: WorkspaceDetailPageProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [, startTransition] = useTransition()
  const [members, setMembers] = useState<Profile[]>(initialMembers)
  const [activeTab, setActiveTab] = useState<TabType>('summary')
  const [showAssign, setShowAssign] = useState(false)
  const [showRenameWorkspace, setShowRenameWorkspace] = useState(false)
  const [isCloning, setIsCloning] = useState(false)
  const [workspaceName, setWorkspaceName] = useState(workspace.name)
  const [showCreateProject, setShowCreateProject] = useState(false)
  const [showCreateTask, setShowCreateTask] = useState(false)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())
  const [calendarDate, setCalendarDate] = useState(new Date())
  const [timelineScale, setTimelineScale] = useState<'weeks' | 'months'>('months')
  const [boardSearch, setBoardSearch] = useState('')
  const [calSearch, setCalSearch] = useState('')
  const [tlSearch, setTlSearch] = useState('')
  const [listView, setListView] = useState<'list' | 'grid'>('list')

  // ── Tab customisation (persisted per-user per-workspace in localStorage) ──
  const ALL_TABS: { key: TabType; label: string; icon: React.ReactNode }[] = [
    { key: 'summary',  label: 'Summary',  icon: <Globe className="h-3.5 w-3.5" /> },
    { key: 'list',     label: 'List',     icon: <LayoutList className="h-3.5 w-3.5" /> },
    { key: 'board',    label: 'Board',    icon: <LayoutGrid className="h-3.5 w-3.5" /> },
    { key: 'calendar', label: 'Calendar', icon: <Calendar className="h-3.5 w-3.5" /> },
    { key: 'timeline', label: 'Timeline', icon: <BarChart2 className="h-3.5 w-3.5" /> },
  ]

  const DEFAULT_TAB_ORDER: TabType[] = ['summary', 'list', 'board', 'calendar', 'timeline']
  const DEFAULT_TAB_LABELS: Record<TabType, string> = {
    summary: 'Summary', list: 'List', board: 'Board', calendar: 'Calendar', timeline: 'Timeline',
  }

  // Unique key per user + workspace so each user has their own layout
  const storageKey = `ws-tabs:${profile.id}:${workspace.id}`

  function loadTabPrefs() {
    if (typeof window === 'undefined') return null
    try {
      const raw = localStorage.getItem(storageKey)
      return raw ? JSON.parse(raw) : null
    } catch { return null }
  }

  function saveTabPrefs(order: TabType[], labels: Record<TabType, string>, def: TabType) {
    try {
      localStorage.setItem(storageKey, JSON.stringify({ order, labels, default: def }))
    } catch {}
  }

  const savedPrefs = loadTabPrefs()

  const [tabOrder, setTabOrder] = useState<TabType[]>(savedPrefs?.order ?? DEFAULT_TAB_ORDER)
  const [tabLabels, setTabLabels] = useState<Record<TabType, string>>(savedPrefs?.labels ?? DEFAULT_TAB_LABELS)
  const [defaultTab, setDefaultTab] = useState<TabType>(savedPrefs?.default ?? 'summary')
  const [tabMenuOpen, setTabMenuOpen] = useState<TabType | null>(null)
  const [renamingTab, setRenamingTab] = useState<TabType | null>(null)
  const [renameValue, setRenameValue] = useState('')

  function moveTab(key: TabType, dir: -1 | 1) {
    setTabOrder(prev => {
      const idx = prev.indexOf(key)
      const next = idx + dir
      if (next < 0 || next >= prev.length) return prev
      const arr = [...prev]
      ;[arr[idx], arr[next]] = [arr[next], arr[idx]]
      saveTabPrefs(arr, tabLabels, defaultTab)
      return arr
    })
  }

  function openRename(key: TabType) {
    setRenamingTab(key)
    setRenameValue(tabLabels[key])
  }

  function confirmRename() {
    if (renamingTab && renameValue.trim()) {
      const newLabels = { ...tabLabels, [renamingTab]: renameValue.trim() }
      setTabLabels(newLabels)
      saveTabPrefs(tabOrder, newLabels, defaultTab)
    }
    setRenamingTab(null)
  }

  function handleSetDefaultTab(key: TabType) {
    setDefaultTab(key)
    setActiveTab(key)
    saveTabPrefs(tabOrder, tabLabels, key)
    setTabMenuOpen(null)
  }

  function refresh() { startTransition(() => router.refresh()) }

  // ── Realtime sync ─────────────────────────────────────────────────────────
  // Debounce member fetches so rapid bulk changes only fire one request
  const memberFetchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function syncMembers() {
    if (memberFetchTimer.current) clearTimeout(memberFetchTimer.current)
    memberFetchTimer.current = setTimeout(async () => {
      const result = await getWorkspaceMembersAction(workspace.id)
      if (result.success && result.members) {
        setMembers(result.members as Profile[])
      }
    }, 300)
  }

  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel(`workspace:${workspace.id}`)
      // Member assignments — update member list in-place without page refresh
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'workspace_assignments',
        filter: `workspace_id=eq.${workspace.id}`,
      }, () => syncMembers())
      // Projects / tasks — still need a refresh to get full relational data
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'projects',
        filter: `workspace_id=eq.${workspace.id}`,
      }, () => refresh())
      .subscribe()

    return () => {
      if (memberFetchTimer.current) clearTimeout(memberFetchTimer.current)
      supabase.removeChannel(channel)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspace.id])

  // Guard: tasks require a project — redirect to project creation if none exist
  function openCreateTask() {
    if (projects.length === 0) {
      setShowCreateProject(true)
      toast({ title: 'Create a project first', description: 'Tasks must belong to a project. Add one to get started.' })
    } else {
      setShowCreateTask(true)
    }
  }

  // ── Derived data ──
  const now = new Date()
  const sevenDaysAgo = subDays(now, 7)
  const sevenDaysLater = addDays(now, 7)

  const topLevelTasks = useMemo(() => tasks.filter(t => !t.parent_task_id), [tasks])
  const subtaskMap = useMemo(() => {
    const map: Record<string, Task[]> = {}
    tasks.filter(t => t.parent_task_id).forEach(t => {
      if (!map[t.parent_task_id!]) map[t.parent_task_id!] = []
      map[t.parent_task_id!].push(t)
    })
    return map
  }, [tasks])

  const filteredTasks = useMemo(() => {
    if (!search.trim()) return topLevelTasks
    const q = search.toLowerCase()
    return topLevelTasks.filter(t =>
      t.title.toLowerCase().includes(q) ||
      (t.description ?? '').toLowerCase().includes(q)
    )
  }, [topLevelTasks, search])

  // ── Summary stats ──
  const stats = useMemo(() => ({
    completed: tasks.filter(t => t.status === 'done' && isAfter(parseISO(t.updated_at), sevenDaysAgo)).length,
    updated:   tasks.filter(t => isAfter(parseISO(t.updated_at), sevenDaysAgo)).length,
    created:   tasks.filter(t => isAfter(parseISO(t.created_at), sevenDaysAgo)).length,
    dueSoon:   tasks.filter(t => t.due_date && isAfter(parseISO(t.due_date), now) && isBefore(parseISO(t.due_date), sevenDaysLater)).length,
  }), [tasks])

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    tasks.forEach(t => { counts[t.status] = (counts[t.status] ?? 0) + 1 })
    return counts
  }, [tasks])

  const priorityCounts = useMemo(() => {
    const counts: Record<string, number> = { urgent: 0, high: 0, medium: 0, low: 0 }
    tasks.forEach(t => { counts[t.priority] = (counts[t.priority] ?? 0) + 1 })
    return counts
  }, [tasks])

  const maxPriorityCount = Math.max(...Object.values(priorityCounts), 1)

  const filteredBoardTasks = useMemo(() => {
    if (!boardSearch.trim()) return topLevelTasks
    const q = boardSearch.toLowerCase()
    return topLevelTasks.filter(t => t.title.toLowerCase().includes(q))
  }, [topLevelTasks, boardSearch])

  const filteredCalTasks = useMemo(() => {
    if (!calSearch.trim()) return tasks
    const q = calSearch.toLowerCase()
    return tasks.filter(t => t.title.toLowerCase().includes(q))
  }, [tasks, calSearch])

  const filteredTimelineTasks = useMemo(() => {
    const base = tasks.filter(t => t.start_date || t.due_date)
    if (!tlSearch.trim()) return base
    const q = tlSearch.toLowerCase()
    return base.filter(t => t.title.toLowerCase().includes(q))
  }, [tasks, tlSearch])

  // ── Calendar data ──
  const calendarTasks = useMemo(() => {
    const map: Record<string, Task[]> = {}
    filteredCalTasks.forEach(t => {
      if (!t.due_date) return
      const key = t.due_date.slice(0, 10)
      if (!map[key]) map[key] = []
      map[key].push(t)
    })
    return map
  }, [filteredCalTasks])

  // ── Timeline ──
  const timelineTasks = filteredTimelineTasks

  const tlStart = useMemo(() => {
    if (!timelineTasks.length) return startOfMonth(now)
    const dates = timelineTasks.flatMap(t =>
      [t.start_date, t.due_date].filter(Boolean).map(d => parseISO(d!))
    )
    return startOfMonth(dates.reduce((a, b) => isBefore(a, b) ? a : b))
  }, [timelineTasks])

  const tlEnd = useMemo(() => {
    if (!timelineTasks.length) return addMonths(startOfMonth(now), 3)
    const dates = timelineTasks.flatMap(t =>
      [t.start_date, t.due_date].filter(Boolean).map(d => parseISO(d!))
    )
    return endOfMonth(dates.reduce((a, b) => isAfter(a, b) ? a : b))
  }, [timelineTasks])

  const tlTotalDays = differenceInDays(tlEnd, tlStart) + 1

  function tlPct(date: Date) {
    return ((differenceInDays(date, tlStart)) / tlTotalDays) * 100
  }

  // ── Board columns ──
  const BOARD_COLS: { key: string; label: string }[] = [
    { key: 'todo', label: 'To Do' },
    { key: 'in_progress', label: 'In Progress' },
    { key: 'in_review', label: 'In Review' },
    { key: 'done', label: 'Done' },
  ]

  // ── Calendar helpers ──
  function buildCalendarGrid(date: Date) {
    const first = startOfMonth(date)
    const last = endOfMonth(date)
    const startDay = startOfWeek(first, { weekStartsOn: 1 })
    const days = eachDayOfInterval({ start: startDay, end: last })
    // pad to 6 rows × 7 cols
    while (days.length % 7 !== 0) days.push(addDays(days[days.length - 1], 1))
    return days
  }

  const calDays = buildCalendarGrid(calendarDate)
  const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

  // ── Timeline months ──
  const tlMonths = useMemo(() => {
    const months: { label: string; pct: number; width: number }[] = []
    let cur = startOfMonth(tlStart)
    while (isBefore(cur, tlEnd) || format(cur, 'yyyy-MM') === format(tlEnd, 'yyyy-MM')) {
      const mEnd = endOfMonth(cur)
      const mStart2 = cur
      const from = isAfter(mStart2, tlStart) ? mStart2 : tlStart
      const to = isBefore(mEnd, tlEnd) ? mEnd : tlEnd
      months.push({
        label: format(cur, 'MMM yyyy'),
        pct: tlPct(from),
        width: ((differenceInDays(to, from) + 1) / tlTotalDays) * 100,
      })
      cur = addMonths(cur, 1)
    }
    return months
  }, [tlStart, tlEnd, tlTotalDays])

  // ── Timeline weeks ──
  const tlWeeks = useMemo(() => {
    const weeks: { label: string; pct: number; width: number }[] = []
    let cur = startOfWeek(tlStart, { weekStartsOn: 1 })
    while (isBefore(cur, addDays(tlEnd, 1))) {
      const wEnd = addDays(cur, 6)
      const from = isAfter(cur, tlStart) ? cur : tlStart
      const to = isBefore(wEnd, tlEnd) ? wEnd : tlEnd
      if (!isAfter(from, tlEnd)) {
        weeks.push({
          label: format(from, 'MMM d'),
          pct: tlPct(from),
          width: ((differenceInDays(to, from) + 1) / tlTotalDays) * 100,
        })
      }
      cur = addDays(cur, 7)
    }
    return weeks
  }, [tlStart, tlEnd, tlTotalDays])

  const tabs = tabOrder.map(key => ({
    ...ALL_TABS.find(t => t.key === key)!,
    label: tabLabels[key],
  }))

  return (
    <div className="flex flex-col h-[calc(100vh-56px)] overflow-hidden">

      {/* Header */}
      <div className="px-6 pt-4 pb-0">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-md bg-blue-600 flex items-center justify-center shrink-0">
              <FolderKanban className="h-4 w-4 text-white" />
            </div>
            <h1 className="text-xl font-bold">{workspaceName}</h1>
            <div className="flex -space-x-1.5">
              {members.slice(0, 5).map(m => (
                <Avatar key={m.id} className="h-6 w-6 border-2 border-background">
                  <AvatarImage src={m.avatar_url ?? undefined} />
                  <AvatarFallback className="text-[10px] bg-blue-100 text-blue-700">{getInitials(m.full_name)}</AvatarFallback>
                </Avatar>
              ))}
              {members.length > 5 && (
                <div className="h-6 w-6 rounded-full bg-muted border-2 border-background flex items-center justify-center text-[10px] font-medium">
                  +{members.length - 5}
                </div>
              )}
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {isAdmin && (
                  <DropdownMenuItem onClick={() => setShowRenameWorkspace(true)}>
                    <Pencil className="h-3.5 w-3.5 mr-2" />
                    Edit workspace
                  </DropdownMenuItem>
                )}
                {isAdmin && (
                  <DropdownMenuItem onClick={() => setShowAssign(true)}>
                    Manage members
                  </DropdownMenuItem>
                )}
                {isAdmin && (
                  <DropdownMenuItem onClick={() => setShowCreateProject(true)}>
                    New project
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  disabled={isCloning}
                  onClick={async () => {
                    setIsCloning(true)
                    try {
                      const result = await cloneWorkspaceAction(workspace.id)
                      if (!result.success) {
                        toast({ title: 'Clone failed', description: result.error, variant: 'destructive' })
                      } else {
                        toast({ title: 'Workspace cloned', description: `"${workspaceName} (Copy)" created.` })
                        router.push('/workspaces')
                      }
                    } finally {
                      setIsCloning(false)
                    }
                  }}
                >
                  {isCloning ? <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" /> : <Copy className="h-3.5 w-3.5 mr-2" />}
                  {isCloning ? 'Cloning…' : 'Clone workspace'}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground"
              title="Copy link"
              onClick={() => {
                navigator.clipboard.writeText(window.location.href)
                toast({ title: 'Link copied to clipboard' })
              }}>
              <Share2 className="h-3.5 w-3.5" />
            </Button>
            {isAdmin && (
              <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs text-muted-foreground"
                onClick={() => setShowAssign(true)}>
                <UserPlus className="h-3.5 w-3.5" />Assign Staff
              </Button>
            )}
            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground"
              title="Toggle fullscreen"
              onClick={() => {
                if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {})
                else document.exitFullscreen().catch(() => {})
              }}>
              <Maximize2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div className="px-6 border-b">
        <div className="flex items-center">
          {tabs.map((tab, idx) => (
            <div key={tab.key} className="relative group flex items-center">
              <button
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  'flex items-center gap-1.5 pl-3 pr-1 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px',
                  activeTab === tab.key
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                )}
              >
                {tab.icon}
                {tab.label}
                {defaultTab === tab.key && (
                  <span className="ml-0.5 h-1.5 w-1.5 rounded-full bg-blue-500" title="Default tab" />
                )}
              </button>

              {/* "..." tab menu */}
              <DropdownMenu
                open={tabMenuOpen === tab.key}
                onOpenChange={open => setTabMenuOpen(open ? tab.key : null)}
              >
                <DropdownMenuTrigger asChild>
                  <button
                    onClick={e => { e.stopPropagation(); setTabMenuOpen(tab.key) }}
                    className={cn(
                      'h-5 w-5 flex items-center justify-center rounded hover:bg-muted text-muted-foreground transition-opacity -mb-px mr-1',
                      tabMenuOpen === tab.key ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                    )}
                  >
                    <MoreHorizontal className="h-3 w-3" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-48">
                  <DropdownMenuItem
                    onClick={() => handleSetDefaultTab(tab.key)}
                    className="flex items-center justify-between"
                  >
                    <span>Set as default</span>
                    {defaultTab === tab.key && <Check className="h-3.5 w-3.5 text-blue-600" />}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => { openRename(tab.key); setTabMenuOpen(null) }}
                    className="flex items-center gap-2"
                  >
                    <Pencil className="h-3.5 w-3.5" />Rename
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => { moveTab(tab.key, -1); setTabMenuOpen(null) }}
                    disabled={idx === 0}
                    className="flex items-center gap-2"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />Move tab left
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => { moveTab(tab.key, 1); setTabMenuOpen(null) }}
                    disabled={idx === tabs.length - 1}
                    className="flex items-center gap-2"
                  >
                    <ChevronRight className="h-3.5 w-3.5" />Move tab right
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ))}
        </div>
      </div>

      {/* Rename tab dialog */}
      <Dialog open={!!renamingTab} onOpenChange={open => !open && setRenamingTab(null)}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle>Rename tab</DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-2">
            <Label className="text-xs text-muted-foreground mb-1 block">Tab name</Label>
            <Input
              value={renameValue}
              onChange={e => setRenameValue(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') confirmRename() }}
              autoFocus
            />
            {renamingTab && renameValue !== DEFAULT_TAB_LABELS[renamingTab] && (
              <button
                type="button"
                onClick={() => setRenameValue(DEFAULT_TAB_LABELS[renamingTab])}
                className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
              >
                Reset to default ("{DEFAULT_TAB_LABELS[renamingTab]}")
              </button>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setRenamingTab(null)}>Cancel</Button>
            <Button size="sm" onClick={confirmRename} disabled={!renameValue.trim()}>Rename</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ══════════════════════════════════════════════════════════════════════
          SUMMARY TAB
      ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'summary' && (
        <div className="flex-1 overflow-y-auto p-6 space-y-5">

          {/* Filter bar */}
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
              <Filter className="h-3.5 w-3.5" />Filter
            </Button>
          </div>

          {/* Stat cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { icon: <CheckCircle2 className="h-5 w-5 text-green-500" />, value: stats.completed, label: 'completed', sub: 'in the last 7 days' },
              { icon: <PenLine className="h-5 w-5 text-blue-500" />,       value: stats.updated,   label: 'updated',   sub: 'in the last 7 days' },
              { icon: <FilePlus2 className="h-5 w-5 text-purple-500" />,   value: stats.created,   label: 'created',   sub: 'in the last 7 days' },
              { icon: <Clock className="h-5 w-5 text-orange-500" />,       value: stats.dueSoon,   label: 'due soon',  sub: 'in the next 7 days' },
            ].map((s, i) => (
              <div key={i} className="rounded-lg border bg-card p-4 flex items-center gap-3">
                {s.icon}
                <div>
                  <p className="text-xl font-bold">{s.value} <span className="text-sm font-normal text-foreground">{s.label}</span></p>
                  <p className="text-xs text-muted-foreground">{s.sub}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Status overview */}
            <div className="rounded-lg border bg-card p-5">
              <div className="flex items-center justify-between mb-1">
                <h3 className="font-semibold text-sm">Status overview</h3>
                {tasks.length > 0 && (
                  <button onClick={() => setActiveTab('list')}
                    className="text-xs text-blue-600 hover:underline">View all tasks</button>
                )}
              </div>
              <p className="text-xs text-muted-foreground mb-4">
                {tasks.length === 0
                  ? 'The status overview will display here after you create some tasks'
                  : 'A snapshot of the status of your tasks.'}
              </p>
              <DonutChart data={[
                { label: 'To Do',       value: statusCounts['todo'] ?? 0,        color: '#94a3b8' },
                { label: 'In Progress', value: statusCounts['in_progress'] ?? 0, color: '#f59e0b' },
                { label: 'In Review',   value: statusCounts['in_review'] ?? 0,   color: '#3b82f6' },
                { label: 'Done',        value: statusCounts['done'] ?? 0,         color: '#22c55e' },
                { label: 'Cancelled',   value: statusCounts['cancelled'] ?? 0,   color: '#ef4444' },
              ].filter(d => d.value > 0)} />
            </div>

            {/* Recent activity */}
            <div className="rounded-lg border bg-card p-5">
              <div className="flex items-center justify-between mb-1">
                <h3 className="font-semibold text-sm">Recent activity</h3>
                <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
              <p className="text-xs text-muted-foreground mb-4">Stay up to date with what's happening across the workspace.</p>
              {activityLogs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-6 text-center">
                  <Activity className="h-8 w-8 text-muted-foreground/30 mb-2" />
                  <p className="text-sm font-medium">No activity yet</p>
                  <p className="text-xs text-muted-foreground mt-1">Create some tasks to see activity here.</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-48 overflow-y-auto">
                  {activityLogs.slice(0, 8).map((log) => (
                    <div key={log.id} className="flex items-start gap-2">
                      <Avatar className="h-6 w-6 shrink-0 mt-0.5">
                        <AvatarImage src={log.user?.avatar_url ?? undefined} />
                        <AvatarFallback className="text-[10px]">{getInitials(log.user?.full_name ?? '?')}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs">
                          <span className="font-medium text-blue-600">{log.user?.full_name}</span>
                          {' '}<span className="text-muted-foreground">{log.action.replace(/_/g, ' ')}</span>
                          {(log as any).task?.title && (
                            <span className="font-medium"> "{(log as any).task.title}"</span>
                          )}
                        </p>
                        <p className="text-[10px] text-muted-foreground">{timeAgo(log.created_at)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Priority breakdown */}
            <div className="rounded-lg border bg-card p-5">
              <h3 className="font-semibold text-sm mb-1">Priority breakdown</h3>
              <p className="text-xs text-muted-foreground mb-4">A holistic view of how work is being prioritized.</p>
              <div className="space-y-3">
                {(['urgent', 'high', 'medium', 'low'] as const).map(p => (
                  <div key={p} className="flex items-center gap-3">
                    <span className={cn('text-xs font-mono w-16 shrink-0', PRIORITY_COLOR[p])}>
                      {PRIORITY_ICON[p]} {p.charAt(0).toUpperCase() + p.slice(1)}
                    </span>
                    <div className="flex-1 h-5 bg-muted rounded overflow-hidden">
                      <div
                        className="h-full rounded transition-all"
                        style={{
                          width: `${(priorityCounts[p] / maxPriorityCount) * 100}%`,
                          background: p === 'urgent' ? '#ef4444' : p === 'high' ? '#f97316' : p === 'medium' ? '#eab308' : '#60a5fa',
                        }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground w-6 text-right">{priorityCounts[p]}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Types of work */}
            <div className="rounded-lg border bg-card p-5">
              <h3 className="font-semibold text-sm mb-1">Types of work</h3>
              <p className="text-xs text-muted-foreground mb-4">A breakdown of tasks by type.</p>
              {tasks.length === 0 ? (
                <p className="text-xs text-muted-foreground">Create some tasks to view the breakdown.</p>
              ) : (
                <div className="space-y-3">
                  {[
                    { label: 'Task',    value: topLevelTasks.length },
                    { label: 'Subtask', value: tasks.length - topLevelTasks.length },
                  ].map(({ label, value }) => {
                    const pct = tasks.length ? Math.round((value / tasks.length) * 100) : 0
                    return (
                      <div key={label} className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground w-16 shrink-0">{label}</span>
                        <div className="flex-1 h-4 bg-muted rounded overflow-hidden">
                          <div className="h-full bg-slate-500 rounded" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs text-muted-foreground w-8 text-right">{pct}%</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          LIST TAB
      ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'list' && (
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Toolbar */}
          <div className="flex items-center gap-2 px-4 py-2 border-b">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search work…" className="h-8 pl-8 w-44 text-xs" />
            </div>
            <div className="flex -space-x-1">
              {members.slice(0, 3).map(m => (
                <Avatar key={m.id} className="h-6 w-6 border-2 border-background cursor-pointer">
                  <AvatarImage src={m.avatar_url ?? undefined} />
                  <AvatarFallback className="text-[10px] bg-slate-200">{getInitials(m.full_name)}</AvatarFallback>
                </Avatar>
              ))}
            </div>
            <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs text-muted-foreground">
              <Filter className="h-3.5 w-3.5" />Filter
            </Button>
            <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs text-muted-foreground">
              <SlidersHorizontal className="h-3.5 w-3.5" />Group
            </Button>
            <div className="ml-auto flex items-center gap-1">
              <div className="flex items-center border rounded-md overflow-hidden">
                <button onClick={() => setListView('list')} className={cn('px-2 py-1.5 border-r', listView === 'list' ? 'bg-blue-50 text-blue-600' : 'text-muted-foreground hover:bg-muted')}><List className="h-3.5 w-3.5" /></button>
                <button onClick={() => setListView('grid')} className={cn('px-2 py-1.5', listView === 'grid' ? 'bg-blue-50 text-blue-600' : 'text-muted-foreground hover:bg-muted')}><LayoutGrid className="h-3.5 w-3.5" /></button>
              </div>
            </div>
          </div>

          {/* Grid view */}
          {listView === 'grid' && (
            <div className="flex-1 overflow-auto p-4">
              {filteredTasks.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-16">
                  {search ? 'No tasks match your search.' : 'No tasks in this workspace yet.'}
                </p>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {filteredTasks.map(task => (
                    <div key={task.id}
                      className="rounded-lg border bg-card p-3 cursor-pointer hover:shadow-md hover:border-blue-200 transition-all"
                      onClick={() => router.push(`/projects/${task.project_id}/tasks/${task.id}`)}>
                      <p className="text-sm font-medium mb-2 line-clamp-2">{task.title}</p>
                      <div className="flex items-center gap-1.5 mb-2">
                        <span className={cn('inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold border', STATUS_STYLES[task.status])}>
                          {STATUS_LABEL[task.status]}
                        </span>
                        <span className={cn('text-[10px] font-bold', PRIORITY_COLOR[task.priority])}>
                          {PRIORITY_ICON[task.priority]}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-mono text-blue-500">#{task.id.slice(0, 4).toUpperCase()}</span>
                        {(task.assignees ?? []).length > 0 && (
                          <Avatar className="h-5 w-5">
                            <AvatarImage src={task.assignees![0].avatar_url ?? undefined} />
                            <AvatarFallback className="text-[10px]">{getInitials(task.assignees![0].full_name)}</AvatarFallback>
                          </Avatar>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Table */}
          {listView === 'list' && (
          <div className="flex-1 overflow-auto">
            <table className="w-full text-sm border-collapse">
              <thead className="sticky top-0 z-10 bg-muted/60 backdrop-blur-sm">
                <tr className="border-b">
                  <th className="w-10 px-3 py-2.5">
                    <Checkbox checked={selected.size === filteredTasks.length && filteredTasks.length > 0}
                      onCheckedChange={() => setSelected(selected.size === filteredTasks.length ? new Set() : new Set(filteredTasks.map(t => t.id)))} />
                  </th>
                  <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground min-w-[300px]">Work</th>
                  <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground w-36">Assignee</th>
                  <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground w-28">Priority</th>
                  <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground w-36">Status</th>
                  <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground w-32">Due date</th>
                  <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground w-32">Project</th>
                  <th className="w-10 px-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {filteredTasks.length === 0 ? (
                  <tr><td colSpan={8} className="py-16 text-center text-sm text-muted-foreground">
                    {search ? 'No tasks match your search.' : 'No tasks in this workspace yet.'}
                  </td></tr>
                ) : filteredTasks.map(task => {
                  const subtasks = subtaskMap[task.id] ?? []
                  const expanded = expandedRows.has(task.id)
                  return [
                    <tr key={task.id} className={cn('group hover:bg-muted/40 cursor-pointer', selected.has(task.id) && 'bg-blue-50/50')}>
                      <td className="px-3 py-2.5" onClick={e => e.stopPropagation()}>
                        <Checkbox checked={selected.has(task.id)}
                          onCheckedChange={() => setSelected(prev => { const n = new Set(prev); n.has(task.id) ? n.delete(task.id) : n.add(task.id); return n })} />
                      </td>
                      <td className="px-3 py-2.5" onClick={() => router.push(`/projects/${task.project_id}/tasks/${task.id}`)}>
                        <div className="flex items-center gap-2">
                          {subtasks.length > 0 && (
                            <button onClick={e => { e.stopPropagation(); setExpandedRows(prev => { const n = new Set(prev); n.has(task.id) ? n.delete(task.id) : n.add(task.id); return n }) }}
                              className="text-muted-foreground hover:text-foreground">
                              {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                            </button>
                          )}
                          {subtasks.length === 0 && <span className="w-3.5" />}
                          <span className="text-[10px] font-mono text-blue-600 shrink-0">
                            #{task.id.slice(0, 4).toUpperCase()}
                          </span>
                          <span className="font-medium text-sm group-hover:text-blue-600 transition-colors truncate max-w-[240px]">
                            {task.title}
                          </span>
                          <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 shrink-0" />
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        {(task.assignees ?? []).length > 0 ? (
                          <div className="flex items-center gap-1.5">
                            <Avatar className="h-5 w-5"><AvatarImage src={task.assignees![0].avatar_url ?? undefined} /><AvatarFallback className="text-[10px]">{getInitials(task.assignees![0].full_name)}</AvatarFallback></Avatar>
                            <span className="text-xs truncate max-w-[90px]">{task.assignees![0].full_name}</span>
                          </div>
                        ) : <span className="text-xs text-muted-foreground">Unassigned</span>}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className={cn('text-xs font-medium', PRIORITY_COLOR[task.priority])}>
                          {PRIORITY_ICON[task.priority]} {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className={cn('inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-semibold border', STATUS_STYLES[task.status])}>
                          {STATUS_LABEL[task.status] ?? task.status}
                          <ChevronDown className="h-3 w-3 opacity-60" />
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground">
                        {task.due_date ? format(parseISO(task.due_date), 'MMM dd, yyyy') : '—'}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground truncate max-w-[100px]">
                        {(task as any).project?.name ?? '—'}
                      </td>
                      <td className="px-2 py-2.5" onClick={e => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100">
                              <MoreHorizontal className="h-3.5 w-3.5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => router.push(`/projects/${task.project_id}/tasks/${task.id}`)}>Open task</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>,
                    ...(expanded ? subtasks.map(sub => (
                      <tr key={sub.id} className="group hover:bg-muted/30 bg-muted/10 cursor-pointer"
                        onClick={() => router.push(`/projects/${sub.project_id}/tasks/${sub.id}`)}>
                        <td className="px-3 py-2" />
                        <td className="px-3 py-2 pl-10">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-mono text-blue-400">#{sub.id.slice(0, 4).toUpperCase()}</span>
                            <span className="text-xs text-muted-foreground truncate max-w-[200px]">{sub.title}</span>
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          {(sub.assignees ?? []).length > 0
                            ? <Avatar className="h-5 w-5"><AvatarFallback className="text-[10px]">{getInitials(sub.assignees![0].full_name)}</AvatarFallback></Avatar>
                            : <span className="text-xs text-muted-foreground">—</span>}
                        </td>
                        <td className="px-3 py-2"><span className={cn('text-xs', PRIORITY_COLOR[sub.priority])}>{PRIORITY_ICON[sub.priority]}</span></td>
                        <td className="px-3 py-2">
                          <span className={cn('inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold border', STATUS_STYLES[sub.status])}>
                            {STATUS_LABEL[sub.status]}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">{sub.due_date ? format(parseISO(sub.due_date), 'MMM dd') : '—'}</td>
                        <td colSpan={2} />
                      </tr>
                    )) : [])
                  ]
                })}
              </tbody>
            </table>
          </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between px-4 py-2 border-t bg-background text-xs text-muted-foreground">
            <button className="flex items-center gap-1.5 hover:text-foreground font-medium"
              onClick={openCreateTask}>
              <Plus className="h-3.5 w-3.5" />Create task
            </button>
            <div className="flex items-center gap-2">
              <span>{filteredTasks.length} of {topLevelTasks.length}</span>
              <button onClick={refresh}><RefreshCw className="h-3.5 w-3.5" /></button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          BOARD TAB
      ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'board' && (
        <div className="flex flex-col flex-1 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2 border-b">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input value={boardSearch} onChange={e => setBoardSearch(e.target.value)} placeholder="Search board…" className="h-8 pl-8 w-44 text-xs" />
            </div>
            <div className="flex -space-x-1">
              {members.slice(0, 3).map(m => (
                <Avatar key={m.id} className="h-6 w-6 border-2 border-background cursor-pointer">
                  <AvatarImage src={m.avatar_url ?? undefined} />
                  <AvatarFallback className="text-[10px] bg-slate-200">{getInitials(m.full_name)}</AvatarFallback>
                </Avatar>
              ))}
            </div>
            <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs text-muted-foreground">
              <Filter className="h-3.5 w-3.5" />Filter
            </Button>
            <div className="ml-auto">
              <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
                Group: Status <ChevronDown className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          <div className="flex-1 overflow-auto p-4">
            {topLevelTasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <div className="h-32 w-32 mb-6 opacity-60">
                  <LayoutGrid className="h-full w-full text-blue-200" />
                </div>
                <h3 className="text-lg font-bold mb-2">Visualize your tasks with a board</h3>
                {projects.length === 0 ? (
                  <>
                    <p className="text-sm text-muted-foreground mb-4 max-w-xs">
                      You need a project before you can create tasks. Start by creating a project in this workspace.
                    </p>
                    <Button onClick={() => setShowCreateProject(true)}>
                      <Plus className="h-4 w-4 mr-2" />New project
                    </Button>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-muted-foreground mb-4 max-w-xs">
                      Track, organize and prioritize your team's tasks. Get started by creating a task.
                    </p>
                    <Button onClick={openCreateTask}>
                      <Plus className="h-4 w-4 mr-2" />Create task
                    </Button>
                  </>
                )}
              </div>
            ) : (
              <div className="flex gap-4 h-full min-h-[400px]">
                {BOARD_COLS.map(col => {
                  const colTasks = filteredBoardTasks.filter(t => t.status === col.key)
                  return (
                    <div key={col.key} className="flex flex-col w-64 shrink-0">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          {col.label}
                        </span>
                        <span className="text-xs text-muted-foreground">{colTasks.length}</span>
                      </div>
                      <div className="flex flex-col gap-2 flex-1">
                        {colTasks.map(task => (
                          <div key={task.id}
                            className="rounded-lg border bg-card p-3 cursor-pointer hover:shadow-md hover:border-blue-200 transition-all"
                            onClick={() => router.push(`/projects/${task.project_id}/tasks/${task.id}`)}>
                            <p className="text-sm font-medium mb-2 line-clamp-2">{task.title}</p>
                            <div className="flex items-center gap-2 mb-2">
                              {task.due_date && (
                                <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                  <Calendar className="h-3 w-3" />
                                  {format(parseISO(task.due_date), 'MMM dd, yyyy')}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] font-mono text-blue-500">#{task.id.slice(0, 4).toUpperCase()}</span>
                                {(subtaskMap[task.id] ?? []).length > 0 && (
                                  <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                                    <Users className="h-3 w-3" />{(subtaskMap[task.id] ?? []).length}
                                  </span>
                                )}
                                <span className={cn('text-[10px] font-bold', PRIORITY_COLOR[task.priority])}>
                                  {PRIORITY_ICON[task.priority]}
                                </span>
                              </div>
                              {(task.assignees ?? []).length > 0 && (
                                <Avatar className="h-5 w-5">
                                  <AvatarImage src={task.assignees![0].avatar_url ?? undefined} />
                                  <AvatarFallback className="text-[10px]">{getInitials(task.assignees![0].full_name)}</AvatarFallback>
                                </Avatar>
                              )}
                            </div>
                          </div>
                        ))}
                        <button
                          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground p-2 rounded hover:bg-muted transition-colors"
                          onClick={openCreateTask}>
                          <Plus className="h-3.5 w-3.5" />Create task
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          CALENDAR TAB
      ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'calendar' && (
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Calendar toolbar */}
          <div className="flex items-center gap-2 px-4 py-2 border-b">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input value={calSearch} onChange={e => setCalSearch(e.target.value)} placeholder="Search calendar…" className="h-8 pl-8 w-44 text-xs" />
            </div>
            <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs text-muted-foreground">
              <Filter className="h-3.5 w-3.5" />Filter
            </Button>
            <div className="ml-auto flex items-center gap-2">
              <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setCalendarDate(new Date())}>Today</Button>
              <button onClick={() => setCalendarDate(d => subMonths(d, 1))} className="p-1.5 rounded hover:bg-muted">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-sm font-medium w-24 text-center">{format(calendarDate, 'MMM yyyy')}</span>
              <button onClick={() => setCalendarDate(d => addMonths(d, 1))} className="p-1.5 rounded hover:bg-muted">
                <ChevronRight className="h-4 w-4" />
              </button>
              <Button variant="outline" size="sm" className="h-8 text-xs gap-1">
                Month <ChevronDown className="h-3 w-3" />
              </Button>
            </div>
          </div>

          {/* Calendar grid */}
          <div className="flex-1 overflow-auto">
            <div className="grid grid-cols-7 border-b">
              {DAY_NAMES.map(d => (
                <div key={d} className="px-3 py-2 text-xs font-medium text-muted-foreground text-center border-r last:border-r-0">
                  {d}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 flex-1">
              {calDays.map((day, i) => {
                const key = format(day, 'yyyy-MM-dd')
                const dayTasks = calendarTasks[key] ?? []
                const inMonth = isSameMonth(day, calendarDate)
                const today = isToday(day)
                return (
                  <div key={i} className={cn(
                    'min-h-[100px] border-r border-b last:border-r-0 p-1.5',
                    !inMonth && 'bg-muted/30',
                  )}>
                    <span className={cn(
                      'inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium mb-1',
                      today && 'bg-blue-600 text-white',
                      !today && !inMonth && 'text-muted-foreground/50',
                      !today && inMonth && 'text-foreground',
                    )}>
                      {format(day, 'd')}
                    </span>
                    <div className="space-y-0.5">
                      {dayTasks.slice(0, 3).map(t => (
                        <div key={t.id}
                          className={cn(
                            'rounded px-1.5 py-0.5 text-[10px] font-medium truncate cursor-pointer hover:opacity-80',
                            STATUS_STYLES[t.status],
                          )}
                          onClick={() => router.push(`/projects/${t.project_id}/tasks/${t.id}`)}>
                          {t.title}
                        </div>
                      ))}
                      {dayTasks.length > 3 && (
                        <p className="text-[10px] text-muted-foreground px-1">+{dayTasks.length - 3} more</p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TIMELINE TAB
      ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'timeline' && (
        <div className="flex flex-col flex-1 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2 border-b">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input value={tlSearch} onChange={e => setTlSearch(e.target.value)} placeholder="Search timeline…" className="h-8 pl-8 w-44 text-xs" />
            </div>
            <div className="flex -space-x-1">
              {members.slice(0, 3).map(m => (
                <Avatar key={m.id} className="h-6 w-6 border-2 border-background">
                  <AvatarImage src={m.avatar_url ?? undefined} />
                  <AvatarFallback className="text-[10px] bg-slate-200">{getInitials(m.full_name)}</AvatarFallback>
                </Avatar>
              ))}
            </div>
            <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs text-muted-foreground">
              <Filter className="h-3.5 w-3.5" />Filter
            </Button>
            <div className="ml-auto flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-8 w-8"><SlidersHorizontal className="h-3.5 w-3.5" /></Button>
              <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
            </div>
          </div>

          <div className="flex flex-1 overflow-hidden">
            {/* Left: task list */}
            <div className="w-72 shrink-0 border-r overflow-y-auto">
              <div className="sticky top-0 bg-muted/60 border-b px-3 py-2.5 text-xs font-medium text-muted-foreground">Work</div>
              {timelineTasks.length === 0 ? (
                <p className="text-xs text-muted-foreground p-4">No tasks with dates.</p>
              ) : timelineTasks.map(t => (
                <div key={t.id} className="flex items-center gap-2 px-3 py-2.5 border-b hover:bg-muted/30 cursor-pointer"
                  onClick={() => router.push(`/projects/${t.project_id}/tasks/${t.id}`)}>
                  <Checkbox className="h-3.5 w-3.5 shrink-0" />
                  <span className="text-[10px] font-mono text-blue-500 shrink-0">#{t.id.slice(0, 4).toUpperCase()}</span>
                  <span className="text-xs truncate">{t.title}</span>
                  {t.status !== 'todo' && (
                    <span className={cn('ml-auto shrink-0 text-[10px] rounded px-1 border', STATUS_STYLES[t.status])}>
                      {STATUS_LABEL[t.status]}
                    </span>
                  )}
                </div>
              ))}
              <button className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground px-3 py-2.5"
                onClick={openCreateTask}>
                <Plus className="h-3.5 w-3.5" />Create task
              </button>
            </div>

            {/* Right: Gantt chart */}
            <div className="flex-1 overflow-auto">
              {/* Month/week headers */}
              <div className="sticky top-0 z-10 flex border-b bg-muted/60 backdrop-blur-sm">
                {(timelineScale === 'weeks' ? tlWeeks : tlMonths).map((m, i) => (
                  <div key={i} className="border-r last:border-r-0 px-2 py-2.5 text-xs font-medium text-muted-foreground shrink-0"
                    style={{ width: `${m.width}%`, minWidth: timelineScale === 'weeks' ? 60 : 80 }}>
                    {m.label}
                  </div>
                ))}
              </div>

              {/* Gantt rows */}
              <div className="relative">
                {/* Today line */}
                {isAfter(now, tlStart) && isBefore(now, tlEnd) && (
                  <div className="absolute top-0 bottom-0 w-px bg-blue-500 z-10 pointer-events-none"
                    style={{ left: `${tlPct(now)}%` }} />
                )}

                {timelineTasks.length === 0 ? (
                  <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
                    No tasks with dates to show.
                  </div>
                ) : timelineTasks.map(t => {
                  const start = t.start_date ? parseISO(t.start_date) : (t.due_date ? parseISO(t.due_date) : null)
                  const end = t.due_date ? parseISO(t.due_date) : start
                  if (!start || !end) return null
                  const left = Math.max(0, tlPct(start))
                  const width = Math.max(1, tlPct(end) - left)
                  return (
                    <div key={t.id} className="relative h-10 border-b flex items-center">
                      <div className="absolute h-5 rounded-full cursor-pointer hover:opacity-80 transition-opacity flex items-center px-2"
                        style={{
                          left: `${left}%`,
                          width: `${width}%`,
                          minWidth: 24,
                          background: STATUS_BAR_COLOR[t.status] ?? '#94a3b8',
                          opacity: 0.85,
                        }}
                        onClick={() => router.push(`/projects/${t.project_id}/tasks/${t.id}`)}>
                        <span className="text-[10px] text-white font-medium truncate">{t.title}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Timeline scale switcher */}
          <div className="flex justify-end items-center gap-1 border-t px-4 py-2">
            {(['weeks', 'months'] as const).map(s => (
              <button key={s} onClick={() => setTimelineScale(s)}
                className={cn(
                  'px-3 py-1 text-xs rounded border transition-colors',
                  timelineScale === s ? 'bg-blue-600 text-white border-blue-600' : 'text-muted-foreground border-border hover:bg-muted'
                )}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Dialogs ── */}
      <RenameWorkspaceDialog
        workspace={{ ...workspace, name: workspaceName }}
        open={showRenameWorkspace}
        onOpenChange={setShowRenameWorkspace}
        onSuccess={(_, name) => {
          setWorkspaceName(name)
        }}
      />

      <AssignStaffDialog open={showAssign} onOpenChange={setShowAssign}
        workspaceId={workspace.id} currentMemberIds={members.map(m => m.id)}
        onSuccess={refresh} />

      {isAdmin && (
        <CreateProjectDialog open={showCreateProject} onOpenChange={setShowCreateProject}
          workspaces={[workspace]} onCreated={refresh} profile={profile} />
      )}

      {projects.length > 0 && (
        <CreateTaskDialog
          open={showCreateTask}
          onOpenChange={setShowCreateTask}
          projects={projects}
          profile={profile}
          onCreated={refresh}
        />
      )}
    </div>
  )
}
