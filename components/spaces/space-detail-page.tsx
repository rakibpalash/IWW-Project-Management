'use client'

import React, { useState, useTransition, useMemo, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getSpaceMembersAction } from '@/app/actions/spaces'
import {
  format, parseISO, isAfter, isBefore, subDays, addDays,
  startOfMonth, endOfMonth, eachDayOfInterval, getDay,
  differenceInDays, startOfWeek, addMonths, subMonths,
  isSameMonth, isToday,
} from 'date-fns'
import { cloneSpaceAction } from '@/app/actions/spaces'
import { AssignStaffDialog } from './assign-staff-dialog'
import { EditSpaceDialog } from './edit-space-dialog'
import { CreateListDialog } from '@/components/lists/create-list-dialog'
import { CreateTaskDialog } from '@/components/tasks/create-task-dialog'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Space, Profile, List, Task, ActivityLog, Folder } from '@/types'
import { cn, formatStatus, getInitials, timeAgo } from '@/lib/utils'
import { useToast } from '@/components/ui/use-toast'
import {
  Users, Search, Filter, LayoutGrid, List as ListIcon, MoreHorizontal, Loader2, Copy,
  Plus, RefreshCw, ChevronDown, ChevronRight, SlidersHorizontal,
  Share2, Maximize2, UserPlus, FolderKanban, LayoutList, Calendar, Flag, Folder as FolderIcon,
  ExternalLink, CheckCircle2, PenLine, FilePlus2, Clock, Activity,
  BarChart2, Globe, ChevronLeft, Check, Pencil,
} from 'lucide-react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Label } from '@/components/ui/label'

// ─── Space list view column visibility ───────────────────────────────────────
type SpaceVisibleCols = { assignee: boolean; dueDate: boolean; size: boolean; priority: boolean }
const SPACE_DEFAULT_COLS: SpaceVisibleCols = { assignee: true, dueDate: true, size: true, priority: true }
const SPACE_COL_LABELS: Record<keyof SpaceVisibleCols, string> = {
  assignee: 'Assignee', dueDate: 'Due Date', size: 'Size', priority: 'Priority',
}

// ─── Types ────────────────────────────────────────────────────────────────────
type TabType = 'summary' | 'list' | 'board' | 'calendar' | 'timeline'

interface SpaceDetailPageProps {
  space: Space
  members: Profile[]
  folders: Folder[]
  lists: List[]
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

const STATUS_ORDER: Record<string, number> = {
  todo: 0, in_progress: 1, in_review: 2, done: 3, cancelled: 4,
}

const STATUS_COLOR: Record<string, string> = {
  todo: '#94a3b8', in_progress: '#f59e0b', in_review: '#3b82f6', done: '#22c55e', cancelled: '#ef4444',
}
function sortByStatus<T extends { status: string }>(arr: T[]): T[] {
  return [...arr].sort((a, b) => (STATUS_ORDER[a.status] ?? 99) - (STATUS_ORDER[b.status] ?? 99))
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
export function SpaceDetailPage({
  space, members: initialMembers, folders, lists, tasks, activityLogs, isAdmin, profile,
}: SpaceDetailPageProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [, startTransition] = useTransition()
  const [members, setMembers] = useState<Profile[]>(initialMembers)
  const [activeTab, setActiveTab] = useState<TabType>('summary')
  const [showAssign, setShowAssign] = useState(false)
  const [showEditSpace, setShowEditSpace] = useState(false)
  const [isCloning, setIsCloning] = useState(false)
  const [spaceName, setSpaceName] = useState(space.name)
  const [showCreateList, setShowCreateList] = useState(false)
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
  const [expandedListIds, setExpandedListIds] = useState<Set<string>>(new Set())
  function toggleListExpand(id: string) {
    setExpandedListIds(prev => {
      const n = new Set(prev)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })
  }
  const [expandedFolderIds, setExpandedFolderIds] = useState<Set<string>>(new Set())
  function toggleFolderExpand(id: string) {
    setExpandedFolderIds(prev => {
      const n = new Set(prev)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })
  }
  const [expandedTaskIds, setExpandedTaskIds] = useState<Set<string>>(new Set())
  function toggleTaskExpand(id: string) {
    setExpandedTaskIds(prev => {
      const n = new Set(prev)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })
  }
  // key = `${listId}:${statusSlug}` — collapsed by default means open, so we track collapsed ones
  const [collapsedStatusGroups, setCollapsedStatusGroups] = useState<Set<string>>(new Set())
  function toggleStatusGroup(key: string) {
    setCollapsedStatusGroups(prev => {
      const n = new Set(prev)
      n.has(key) ? n.delete(key) : n.add(key)
      return n
    })
  }
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())
  const [spaceColDrawerOpen, setSpaceColDrawerOpen] = useState(false)
  const [spaceVisibleCols, setSpaceVisibleCols] = useState<SpaceVisibleCols>(SPACE_DEFAULT_COLS)
  function toggleSpaceCol(key: keyof SpaceVisibleCols) {
    setSpaceVisibleCols(prev => ({ ...prev, [key]: !prev[key] }))
  }

  // ── Tab customisation (persisted per-user per-space in localStorage) ──
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

  // Unique key per user + space so each user has their own layout
  const storageKey = `ws-tabs:${profile.id}:${space.id}`

  function loadTabPrefs() {
    if (typeof window === 'undefined') return null
    try {
      const raw = localStorage.getItem(storageKey)
      return raw ? JSON.parse(raw) : null
    } catch { return null }
  }

  function saveTabPrefs(order: TabType[], labels: Record<TabType, string>, def: TabType, visible?: TabType[]) {
    try {
      const currentVisible = visible ?? (loadTabPrefs()?.visible ?? ['summary', 'list'])
      localStorage.setItem(storageKey, JSON.stringify({ order, labels, default: def, visible: currentVisible }))
    } catch {}
  }

  const savedPrefs = loadTabPrefs()

  const [tabOrder, setTabOrder] = useState<TabType[]>(savedPrefs?.order ?? DEFAULT_TAB_ORDER)
  const [tabLabels, setTabLabels] = useState<Record<TabType, string>>(savedPrefs?.labels ?? DEFAULT_TAB_LABELS)
  const [defaultTab, setDefaultTab] = useState<TabType>(savedPrefs?.default ?? 'summary')
  const [tabMenuOpen, setTabMenuOpen] = useState<TabType | null>(null)
  const [renamingTab, setRenamingTab] = useState<TabType | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [visibleTabs, setVisibleTabs] = useState<TabType[]>(savedPrefs?.visible ?? ['summary', 'list'])
  const [viewPopupOpen, setViewPopupOpen] = useState(false)
  const viewPopupRef = useRef<HTMLDivElement>(null)

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
      const result = await getSpaceMembersAction(space.id)
      if (result.success && result.members) {
        setMembers(result.members as Profile[])
      }
    }, 300)
  }

  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel(`space:${space.id}`)
      // Member assignments — update member list in-place without page refresh
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'space_assignments',
        filter: `space_id=eq.${space.id}`,
      }, () => syncMembers())
      // Lists / tasks — still need a refresh to get full relational data
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'lists',
        filter: `space_id=eq.${space.id}`,
      }, () => refresh())
      .subscribe()

    return () => {
      if (memberFetchTimer.current) clearTimeout(memberFetchTimer.current)
      supabase.removeChannel(channel)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [space.id])

  // Guard: tasks require a list — redirect to list creation if none exist
  function openCreateTask() {
    if (lists.length === 0) {
      setShowCreateList(true)
      toast({ title: 'Create a list first', description: 'Tasks must belong to a list. Add one to get started.' })
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

  const tabs = tabOrder
    .filter(key => visibleTabs.includes(key))
    .map(key => ({
      ...ALL_TABS.find(t => t.key === key)!,
      label: tabLabels[key],
    }))

  function toggleTabVisible(key: TabType) {
    if (key === 'list') return // required, cannot hide
    setVisibleTabs(prev => {
      const next = prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
      saveTabPrefs(tabOrder, tabLabels, defaultTab, next)
      // if hiding the active tab, switch to first visible
      if (!next.includes(activeTab)) setActiveTab(next[0] ?? 'summary')
      return next
    })
  }

  return (
    <div className="flex flex-col h-[calc(100vh-56px)] overflow-hidden">

      {/* Header */}
      <div className="px-6 pt-4 pb-0">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-md bg-blue-600 flex items-center justify-center shrink-0">
              <FolderKanban className="h-4 w-4 text-white" />
            </div>
            <h1 className="text-xl font-bold">{spaceName}</h1>
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
                  <DropdownMenuItem onClick={() => setShowEditSpace(true)}>
                    <Pencil className="h-3.5 w-3.5 mr-2" />
                    Edit space
                  </DropdownMenuItem>
                )}
                {isAdmin && (
                  <DropdownMenuItem onClick={() => setShowAssign(true)}>
                    Manage members
                  </DropdownMenuItem>
                )}
                {isAdmin && (
                  <DropdownMenuItem onClick={() => setShowCreateList(true)}>
                    New List
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  disabled={isCloning}
                  onClick={async () => {
                    setIsCloning(true)
                    try {
                      const result = await cloneSpaceAction(space.id)
                      if (!result.success) {
                        toast({ title: 'Clone failed', description: result.error, variant: 'destructive' })
                      } else {
                        toast({ title: 'Space cloned', description: `"${spaceName} (Copy)" created.` })
                        router.push('/spaces')
                      }
                    } finally {
                      setIsCloning(false)
                    }
                  }}
                >
                  {isCloning ? <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" /> : <Copy className="h-3.5 w-3.5 mr-2" />}
                  {isCloning ? 'Cloning…' : 'Clone space'}
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

          {/* + View button */}
          <div className="relative ml-1" ref={viewPopupRef}>
            <button
              onClick={() => setViewPopupOpen(v => !v)}
              className="flex items-center gap-1 px-2 py-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors rounded hover:bg-muted/50"
            >
              <Plus className="h-3.5 w-3.5" />
              View
            </button>

            {viewPopupOpen && (
              <>
                {/* backdrop */}
                <div className="fixed inset-0 z-40" onClick={() => setViewPopupOpen(false)} />
                <div className="absolute left-0 top-full mt-1 z-50 w-64 rounded-xl border bg-popover shadow-xl overflow-hidden">
                  <div className="p-1">
                    {ALL_TABS.map(t => {
                      const isRequired = t.key === 'list'
                      const isDefault  = t.key === 'summary'
                      const isOn       = visibleTabs.includes(t.key)
                      return (
                        <div
                          key={t.key}
                          onClick={() => !isRequired && toggleTabVisible(t.key)}
                          className={cn(
                            'flex items-center gap-2 px-3 py-2 rounded-lg transition-colors',
                            isRequired ? 'cursor-default' : 'cursor-pointer hover:bg-muted/60'
                          )}
                        >
                          <span className="text-muted-foreground">{t.icon}</span>
                          <span className="flex-1 text-sm font-medium">{t.label}</span>
                          {(isDefault || isRequired) && (
                            <span className="text-[10px] text-muted-foreground border rounded px-1 py-0.5 mr-1">
                              {isRequired ? 'Required' : 'Default'}
                            </span>
                          )}
                          {/* Toggle */}
                          <button
                            disabled={isRequired}
                            onClick={e => { e.stopPropagation(); if (!isRequired) toggleTabVisible(t.key) }}
                            className={cn(
                              'relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors focus:outline-none',
                              isOn ? 'bg-emerald-500' : 'bg-muted',
                              isRequired && 'opacity-60 cursor-not-allowed'
                            )}
                          >
                            <span className={cn(
                              'inline-block h-4 w-4 rounded-full bg-white shadow transition-transform mt-0.5',
                              isOn ? 'translate-x-4' : 'translate-x-0.5'
                            )} />
                          </button>
                        </div>
                      )
                    })}
                  </div>
                  <div className="px-3 pb-3 pt-1">
                    <button
                      onClick={() => setViewPopupOpen(false)}
                      className="w-full rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold py-2 transition-colors"
                    >
                      Done
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
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
          SUMMARY TAB  — ClickUp-style space overview
      ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'summary' && (
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-5xl mx-auto px-6 py-6 space-y-6">

            {/* ── Stat cards ─────────────────────────────────────────────── */}
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

            {/* ── Recent ─────────────────────────────────────────────────── */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <h2 className="font-semibold text-sm">Recent</h2>
                </div>
                {tasks.length > 0 && (
                  <button onClick={() => setActiveTab('list')}
                    className="text-xs text-blue-600 hover:underline">View all</button>
                )}
              </div>
              {tasks.length === 0 ? (
                <div className="rounded-lg border bg-card px-5 py-8 flex flex-col items-center gap-2 text-center">
                  <Clock className="h-8 w-8 text-muted-foreground/30" />
                  <p className="text-sm font-medium">No recent activity</p>
                  <p className="text-xs text-muted-foreground">Tasks you work on will appear here.</p>
                  <Button size="sm" variant="outline" className="mt-1 h-7 text-xs gap-1.5" onClick={openCreateTask}>
                    <Plus className="h-3 w-3" />New Task
                  </Button>
                </div>
              ) : (
                <div className="rounded-lg border bg-card divide-y">
                  {[...tasks]
                    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
                    .slice(0, 6)
                    .map(task => {
                      const listForTask = lists.find(l => l.id === (task as any).list_id)
                      return (
                        <div key={task.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/40 transition-colors">
                          <span className={cn(
                            'h-2 w-2 rounded-full shrink-0',
                            task.status === 'done' ? 'bg-green-500' :
                            task.status === 'in_progress' ? 'bg-amber-500' :
                            task.status === 'in_review' ? 'bg-blue-500' :
                            task.status === 'cancelled' ? 'bg-red-400' : 'bg-slate-300'
                          )} />
                          <span className="flex-1 truncate text-sm">{task.title}</span>
                          {listForTask && (
                            <span className="text-[11px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded shrink-0">
                              {listForTask.name}
                            </span>
                          )}
                          <div className="flex -space-x-1 shrink-0">
                            {((task as any).assignees ?? []).slice(0, 3).map((a: any) => (
                              <Avatar key={a.id} className="h-5 w-5 border border-background">
                                <AvatarImage src={a.avatar_url ?? undefined} />
                                <AvatarFallback className="text-[9px]">{getInitials(a.full_name)}</AvatarFallback>
                              </Avatar>
                            ))}
                          </div>
                          <span className="text-[11px] text-muted-foreground shrink-0 w-16 text-right">
                            {timeAgo(task.updated_at)}
                          </span>
                        </div>
                      )
                    })}
                </div>
              )}
            </section>

            {/* ── Folders ────────────────────────────────────────────────── */}
            {folders.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <FolderIcon className="h-4 w-4 text-muted-foreground" />
                  <h2 className="font-semibold text-sm">Folders</h2>
                  <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">{folders.length}</span>
                </div>
                <div className="rounded-lg border bg-card divide-y">
                  {folders.map(folder => {
                    const folderLists = lists.filter(l => l.folder_id === folder.id)
                    const folderTasks = tasks.filter(t => folderLists.some(l => l.id === (t as any).list_id))
                    const doneCnt = folderTasks.filter(t => t.status === 'done').length
                    const total = folderTasks.length
                    const pct = total > 0 ? Math.round((doneCnt / total) * 100) : 0
                    const isFolderExpanded = expandedFolderIds.has(folder.id)
                    return (
                      <div key={folder.id}>
                        {/* Folder header row */}
                        <div
                          className="flex items-center gap-4 px-4 py-3 hover:bg-muted/40 transition-colors cursor-pointer group"
                          onClick={() => toggleFolderExpand(folder.id)}
                        >
                          <span className="text-muted-foreground/50 shrink-0">
                            {isFolderExpanded
                              ? <ChevronDown className="h-3.5 w-3.5" />
                              : <ChevronRight className="h-3.5 w-3.5" />}
                          </span>
                          <div className="h-7 w-7 rounded bg-amber-100 flex items-center justify-center shrink-0">
                            <FolderIcon className="h-3.5 w-3.5 text-amber-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium truncate">
                                {folder.name}
                              </span>
                              <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                                {folderLists.length} list{folderLists.length !== 1 ? 's' : ''}
                              </span>
                            </div>
                            {total > 0 && (
                              <div className="flex items-center gap-2 mt-1.5">
                                <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden max-w-[160px]">
                                  <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                                </div>
                                <span className="text-[11px] text-muted-foreground">{pct}%</span>
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-[11px] text-muted-foreground">
                              {total} task{total !== 1 ? 's' : ''}
                            </span>
                          </div>
                          <button
                            onClick={e => { e.stopPropagation(); router.push(`/folders/${folder.id}`) }}
                            className="opacity-0 group-hover:opacity-100 h-6 w-6 flex items-center justify-center rounded hover:bg-muted text-muted-foreground transition-all shrink-0"
                            title="Open folder"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </button>
                        </div>

                        {/* Expanded: lists inside this folder */}
                        {isFolderExpanded && (
                          <div className="bg-muted/20 border-t border-border/40 divide-y divide-border/20">
                            {folderLists.length === 0 ? (
                              <div className="px-12 py-3 flex items-center gap-2">
                                <p className="text-xs text-muted-foreground/60 italic">No lists in this folder</p>
                                {isAdmin && (
                                  <button
                                    onClick={e => { e.stopPropagation(); setShowCreateList(true) }}
                                    className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 hover:underline transition-colors"
                                  >
                                    <Plus className="h-3 w-3" />Add item
                                  </button>
                                )}
                              </div>
                            ) : (
                              folderLists.map(list => {
                                const listTasks = tasks.filter(t => (t as any).list_id === list.id)
                                const topLevelTasks = sortByStatus(listTasks.filter(t => !(t as any).parent_task_id))
                                const listDone = listTasks.filter(t => t.status === 'done').length
                                const listTotal = listTasks.length
                                const listPct = listTotal > 0 ? Math.round((listDone / listTotal) * 100) : 0
                                const isListExpanded = expandedListIds.has(list.id)
                                return (
                                  <div key={list.id}>
                                    {/* List row inside folder */}
                                    <div
                                      className="flex items-center gap-3 pl-10 pr-4 py-2.5 hover:bg-muted/40 transition-colors cursor-pointer group"
                                      onClick={() => toggleListExpand(list.id)}
                                    >
                                      <span className="text-muted-foreground/40 shrink-0">
                                        {isListExpanded
                                          ? <ChevronDown className="h-3 w-3" />
                                          : <ChevronRight className="h-3 w-3" />}
                                      </span>
                                      <div className="h-6 w-6 rounded bg-blue-100 flex items-center justify-center shrink-0">
                                        <LayoutList className="h-3 w-3 text-blue-600" />
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                          <span className="text-sm font-medium truncate">{list.name}</span>
                                          <span className={cn(
                                            'text-[10px] px-1.5 py-0.5 rounded border font-medium shrink-0',
                                            STATUS_STYLES[list.status] ?? 'bg-muted text-muted-foreground border-transparent'
                                          )}>
                                            {STATUS_LABEL[list.status] ?? list.status}
                                          </span>
                                        </div>
                                        {listTotal > 0 && (
                                          <div className="flex items-center gap-2 mt-1">
                                            <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden max-w-[120px]">
                                              <div className="h-full bg-green-500 rounded-full" style={{ width: `${listPct}%` }} />
                                            </div>
                                            <span className="text-[10px] text-muted-foreground">{listPct}%</span>
                                          </div>
                                        )}
                                      </div>
                                      <span className="text-[11px] text-muted-foreground shrink-0">
                                        {listTotal} task{listTotal !== 1 ? 's' : ''}
                                      </span>
                                      <button
                                        onClick={e => { e.stopPropagation(); router.push(`/lists/${list.id}`) }}
                                        className="opacity-0 group-hover:opacity-100 h-5 w-5 flex items-center justify-center rounded hover:bg-muted text-muted-foreground transition-all shrink-0"
                                        title="Open list"
                                      >
                                        <ExternalLink className="h-3 w-3" />
                                      </button>
                                    </div>

                                    {/* Tasks inside list — grouped by status */}
                                    {isListExpanded && (
                                      <div className="border-t border-border/20">
                                        {topLevelTasks.length === 0 ? (
                                          <p className="px-20 py-2 text-xs text-muted-foreground/60 italic">No tasks</p>
                                        ) : (
                                          Object.entries(
                                            topLevelTasks.reduce<Record<string, Task[]>>((acc, t) => {
                                              ;(acc[t.status] ??= []).push(t); return acc
                                            }, {})
                                          ).sort(([a], [b]) => (STATUS_ORDER[a] ?? 99) - (STATUS_ORDER[b] ?? 99))
                                          .map(([status, groupTasks]) => {
                                            const groupKey = `${list.id}:${status}`
                                            const isGroupCollapsed = collapsedStatusGroups.has(groupKey)
                                            const color = STATUS_COLOR[status] ?? '#94a3b8'
                                            return (
                                              <div key={status}>
                                                {/* Status group header */}
                                                <div
                                                  className="flex items-center gap-2 pl-16 pr-4 py-1.5 border-b border-border/20 cursor-pointer hover:bg-muted/30 select-none"
                                                  style={{ borderLeft: `3px solid ${color}` }}
                                                  onClick={() => toggleStatusGroup(groupKey)}
                                                >
                                                  <span className="text-muted-foreground/60">
                                                    {isGroupCollapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                                                  </span>
                                                  <div className="h-3 w-3 rounded-full border-2 shrink-0" style={{ borderColor: color }} />
                                                  <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color }}>
                                                    {STATUS_LABEL[status] ?? status.replace(/_/g, ' ')}
                                                  </span>
                                                  <span className="text-[10px] font-medium rounded-full px-1.5 min-w-[18px] text-center" style={{ background: color + '20', color }}>
                                                    {groupTasks.length}
                                                  </span>
                                                </div>
                                                {/* Tasks in this group */}
                                                {!isGroupCollapsed && groupTasks.map(task => {
                                                  const subtasks = listTasks.filter(t => (t as any).parent_task_id === task.id)
                                                  const isDone = task.status === 'done'
                                                  const isTaskExpanded = expandedTaskIds.has(task.id)
                                                  return (
                                                    <div key={task.id} style={{ borderLeft: `3px solid ${color}25` }}>
                                                      <div className="flex items-center gap-2 pl-20 pr-4 py-2 hover:bg-muted/40 cursor-pointer border-b border-border/10">
                                                        {subtasks.length > 0 ? (
                                                          <button onClick={() => toggleTaskExpand(task.id)} className="text-muted-foreground/40 hover:text-muted-foreground shrink-0">
                                                            {isTaskExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                                                          </button>
                                                        ) : <span className="w-3 shrink-0" />}
                                                        <div className="h-3.5 w-3.5 rounded-full border-2 shrink-0"
                                                          style={{ borderColor: color, backgroundColor: isDone ? color : 'transparent' }} />
                                                        <span className={cn('text-sm flex-1 min-w-0 truncate', isDone && 'line-through text-muted-foreground')}
                                                          onClick={() => router.push(`/lists/${list.id}/tasks/${task.id}`)}>
                                                          {task.title}
                                                        </span>
                                                        {subtasks.length > 0 && (
                                                          <span className="text-[10px] text-muted-foreground/50 shrink-0">
                                                            {subtasks.filter(s => s.status === 'done').length}/{subtasks.length}
                                                          </span>
                                                        )}
                                                      </div>
                                                      {isTaskExpanded && subtasks.map(sub => (
                                                        <div key={sub.id}
                                                          className="flex items-center gap-2 pl-28 pr-4 py-1.5 hover:bg-muted/30 cursor-pointer border-b border-border/10"
                                                          onClick={() => router.push(`/lists/${list.id}/tasks/${task.id}`)}>
                                                          <span className="w-3 shrink-0" />
                                                          <div className="h-3 w-3 rounded-full border-2 shrink-0"
                                                            style={{ borderColor: STATUS_COLOR[sub.status] ?? '#94a3b8', backgroundColor: sub.status === 'done' ? (STATUS_COLOR[sub.status] ?? '#94a3b8') : 'transparent' }} />
                                                          <span className={cn('text-xs flex-1 min-w-0 truncate text-muted-foreground', sub.status === 'done' && 'line-through')}>
                                                            {sub.title}
                                                          </span>
                                                        </div>
                                                      ))}
                                                    </div>
                                                  )
                                                })}
                                              </div>
                                            )
                                          })
                                        )}
                                      </div>
                                    )}
                                  </div>
                                )
                              })
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </section>
            )}

            {/* ── Lists ──────────────────────────────────────────────────── */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <LayoutList className="h-4 w-4 text-muted-foreground" />
                  <h2 className="font-semibold text-sm">Lists</h2>
                  <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">{lists.length}</span>
                </div>
                {isAdmin && (
                  <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5"
                    onClick={() => setShowCreateList(true)}>
                    <Plus className="h-3 w-3" />New List
                  </Button>
                )}
              </div>
              {lists.length === 0 ? (
                <div className="rounded-lg border bg-card px-5 py-8 flex flex-col items-center gap-2 text-center">
                  <LayoutList className="h-8 w-8 text-muted-foreground/30" />
                  <p className="text-sm font-medium">No lists yet</p>
                  <p className="text-xs text-muted-foreground">Organize tasks into lists to track project work.</p>
                  {isAdmin && (
                    <Button size="sm" variant="outline" className="mt-1 h-7 text-xs gap-1.5"
                      onClick={() => setShowCreateList(true)}>
                      <Plus className="h-3 w-3" />New List
                    </Button>
                  )}
                </div>
              ) : (
                <div className="rounded-lg border bg-card divide-y">
                  {lists.map(list => {
                    const listTasks = tasks.filter(t => (t as any).list_id === list.id)
                    const topLevelTasks = listTasks.filter(t => !(t as any).parent_task_id)
                    const doneCnt = listTasks.filter(t => t.status === 'done').length
                    const total = listTasks.length
                    const pct = total > 0 ? Math.round((doneCnt / total) * 100) : 0
                    const statusBreakdown = [
                      { key: 'todo',        color: '#94a3b8', count: listTasks.filter(t => t.status === 'todo').length },
                      { key: 'in_progress', color: '#f59e0b', count: listTasks.filter(t => t.status === 'in_progress').length },
                      { key: 'in_review',   color: '#3b82f6', count: listTasks.filter(t => t.status === 'in_review').length },
                      { key: 'done',        color: '#22c55e', count: doneCnt },
                    ].filter(s => s.count > 0)
                    const isExpanded = expandedListIds.has(list.id)
                    return (
                      <div key={list.id}>
                        {/* ── List header row ── */}
                        <div
                          className="flex items-center gap-4 px-4 py-3 hover:bg-muted/40 transition-colors cursor-pointer group"
                          onClick={() => toggleListExpand(list.id)}
                        >
                          {/* Expand chevron */}
                          <span className="text-muted-foreground/50 shrink-0">
                            {isExpanded
                              ? <ChevronDown className="h-3.5 w-3.5" />
                              : <ChevronRight className="h-3.5 w-3.5" />}
                          </span>
                          <div className="h-7 w-7 rounded bg-blue-100 flex items-center justify-center shrink-0">
                            <LayoutList className="h-3.5 w-3.5 text-blue-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium truncate">
                                {list.name}
                              </span>
                              <span className={cn(
                                'text-[10px] px-1.5 py-0.5 rounded border font-medium shrink-0',
                                STATUS_STYLES[list.status] ?? 'bg-muted text-muted-foreground border-transparent'
                              )}>
                                {STATUS_LABEL[list.status] ?? list.status}
                              </span>
                            </div>
                            {total > 0 && (
                              <div className="flex items-center gap-2 mt-1.5">
                                <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden max-w-[160px]">
                                  <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                                </div>
                                <span className="text-[11px] text-muted-foreground">{pct}%</span>
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            {statusBreakdown.map(s => (
                              <span key={s.key} className="flex items-center gap-1 text-[11px] text-muted-foreground">
                                <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
                                {s.count}
                              </span>
                            ))}
                            <span className="text-[11px] text-muted-foreground">
                              {total} task{total !== 1 ? 's' : ''}
                            </span>
                          </div>
                          {/* Open link */}
                          <button
                            onClick={e => { e.stopPropagation(); router.push(`/lists/${list.id}`) }}
                            className="opacity-0 group-hover:opacity-100 h-6 w-6 flex items-center justify-center rounded hover:bg-muted text-muted-foreground transition-all shrink-0"
                            title="Open list"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </button>
                        </div>

                        {/* ── Expanded task rows — grouped by status ── */}
                        {isExpanded && (
                          <div className="border-t border-border/40">
                            {topLevelTasks.length === 0 ? (
                              <p className="px-12 py-3 text-xs text-muted-foreground/60 italic">No tasks in this list</p>
                            ) : (
                              Object.entries(
                                topLevelTasks.reduce<Record<string, Task[]>>((acc, t) => {
                                  ;(acc[t.status] ??= []).push(t); return acc
                                }, {})
                              ).sort(([a], [b]) => (STATUS_ORDER[a] ?? 99) - (STATUS_ORDER[b] ?? 99))
                              .map(([status, groupTasks]) => {
                                const groupKey = `${list.id}:${status}`
                                const isGroupCollapsed = collapsedStatusGroups.has(groupKey)
                                const color = STATUS_COLOR[status] ?? '#94a3b8'
                                return (
                                  <div key={status}>
                                    {/* Status group header */}
                                    <div
                                      className="flex items-center gap-2 pl-8 pr-4 py-1.5 border-b border-border/20 cursor-pointer hover:bg-muted/30 select-none"
                                      style={{ borderLeft: `3px solid ${color}` }}
                                      onClick={() => toggleStatusGroup(groupKey)}
                                    >
                                      <span className="text-muted-foreground/60">
                                        {isGroupCollapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                                      </span>
                                      <div className="h-3 w-3 rounded-full border-2 shrink-0" style={{ borderColor: color }} />
                                      <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color }}>
                                        {STATUS_LABEL[status] ?? status.replace(/_/g, ' ')}
                                      </span>
                                      <span className="text-[10px] font-medium rounded-full px-1.5 min-w-[18px] text-center" style={{ background: color + '20', color }}>
                                        {groupTasks.length}
                                      </span>
                                    </div>
                                    {/* Tasks in this group */}
                                    {!isGroupCollapsed && groupTasks.map(task => {
                                      const subtasks = listTasks.filter(t => (t as any).parent_task_id === task.id)
                                      const isDone = task.status === 'done'
                                      const isTaskExpanded = expandedTaskIds.has(task.id)
                                      return (
                                        <div key={task.id} style={{ borderLeft: `3px solid ${color}25` }}>
                                          <div className="flex items-center gap-2 pl-12 pr-4 py-2 hover:bg-muted/40 cursor-pointer border-b border-border/10">
                                            {subtasks.length > 0 ? (
                                              <button onClick={() => toggleTaskExpand(task.id)} className="text-muted-foreground/40 hover:text-muted-foreground shrink-0">
                                                {isTaskExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                                              </button>
                                            ) : <span className="w-3 shrink-0" />}
                                            <div className="h-3.5 w-3.5 rounded-full border-2 shrink-0"
                                              style={{ borderColor: color, backgroundColor: isDone ? color : 'transparent' }} />
                                            <span className={cn('text-sm flex-1 min-w-0 truncate', isDone && 'line-through text-muted-foreground')}
                                              onClick={() => router.push(`/lists/${list.id}/tasks/${task.id}`)}>
                                              {task.title}
                                            </span>
                                            {subtasks.length > 0 && (
                                              <span className="text-[10px] text-muted-foreground/50 shrink-0">
                                                {subtasks.filter(s => s.status === 'done').length}/{subtasks.length}
                                              </span>
                                            )}
                                          </div>
                                          {isTaskExpanded && subtasks.map(sub => (
                                            <div key={sub.id}
                                              className="flex items-center gap-2 pl-20 pr-4 py-1.5 hover:bg-muted/30 cursor-pointer border-b border-border/10"
                                              onClick={() => router.push(`/lists/${list.id}/tasks/${task.id}`)}>
                                              <span className="w-3 shrink-0" />
                                              <div className="h-3 w-3 rounded-full border-2 shrink-0"
                                                style={{ borderColor: STATUS_COLOR[sub.status] ?? '#94a3b8', backgroundColor: sub.status === 'done' ? (STATUS_COLOR[sub.status] ?? '#94a3b8') : 'transparent' }} />
                                              <span className={cn('text-xs flex-1 min-w-0 truncate text-muted-foreground', sub.status === 'done' && 'line-through')}>
                                                {sub.title}
                                              </span>
                                            </div>
                                          ))}
                                        </div>
                                      )
                                    })}
                                  </div>
                                )
                              })
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </section>

            {/* ── Workload by Status ─────────────────────────────────────── */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <BarChart2 className="h-4 w-4 text-muted-foreground" />
                  <h2 className="font-semibold text-sm">Workload by Status</h2>
                </div>
                {tasks.length > 0 && (
                  <button onClick={() => setActiveTab('list')}
                    className="text-xs text-blue-600 hover:underline">View all tasks</button>
                )}
              </div>
              <div className="rounded-lg border bg-card p-5">
                {tasks.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-6 text-center">
                    <BarChart2 className="h-8 w-8 text-muted-foreground/30 mb-2" />
                    <p className="text-sm font-medium">No tasks yet</p>
                    <p className="text-xs text-muted-foreground mt-1">The workload chart will appear once tasks are created.</p>
                  </div>
                ) : (
                  <div className="flex items-start gap-8">
                    <DonutChart data={[
                      { label: 'To Do',       value: statusCounts['todo'] ?? 0,        color: '#94a3b8' },
                      { label: 'In Progress', value: statusCounts['in_progress'] ?? 0, color: '#f59e0b' },
                      { label: 'In Review',   value: statusCounts['in_review'] ?? 0,   color: '#3b82f6' },
                      { label: 'Done',        value: statusCounts['done'] ?? 0,         color: '#22c55e' },
                      { label: 'Cancelled',   value: statusCounts['cancelled'] ?? 0,   color: '#ef4444' },
                    ].filter(d => d.value > 0)} />
                    <div className="flex-1 space-y-2.5 min-w-0">
                      {[
                        { key: 'todo',        label: 'To Do',       color: '#94a3b8' },
                        { key: 'in_progress', label: 'In Progress', color: '#f59e0b' },
                        { key: 'in_review',   label: 'In Review',   color: '#3b82f6' },
                        { key: 'done',        label: 'Done',        color: '#22c55e' },
                        { key: 'cancelled',   label: 'Cancelled',   color: '#ef4444' },
                      ].map(s => {
                        const cnt = statusCounts[s.key] ?? 0
                        const pct = tasks.length ? Math.round((cnt / tasks.length) * 100) : 0
                        return (
                          <div key={s.key} className="flex items-center gap-3">
                            <span className="text-xs text-muted-foreground w-20 shrink-0">{s.label}</span>
                            <div className="flex-1 h-5 bg-muted rounded overflow-hidden">
                              <div className="h-full rounded transition-all" style={{ width: `${pct}%`, background: s.color }} />
                            </div>
                            <span className="text-xs text-muted-foreground w-8 text-right shrink-0">{cnt}</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            </section>

          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          LIST TAB
      ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'list' && (
        <div className="flex flex-col flex-1 overflow-hidden">

          {/* ── Toolbar ─────────────────────────────────────────────────── */}
          <div className="flex items-center gap-2 px-4 py-2 border-b">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search tasks…" className="h-8 pl-8 w-44 text-xs" />
            </div>
            <div className="flex -space-x-1.5">
              {members.slice(0, 4).map(m => (
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
            <div className="ml-auto flex items-center gap-2.5">
              <span className="text-xs text-muted-foreground">{filteredTasks.length} task{filteredTasks.length !== 1 ? 's' : ''}</span>
              <button onClick={refresh} className="text-muted-foreground hover:text-foreground transition-colors">
                <RefreshCw className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* ── Table ───────────────────────────────────────────────────── */}
          <div className="flex-1 overflow-auto">
            {filteredTasks.length === 0 && !search ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-16">
                <LayoutList className="h-12 w-12 text-muted-foreground/20 mb-4" />
                <p className="text-sm font-semibold mb-1">No tasks yet</p>
                <p className="text-xs text-muted-foreground mb-4">Create your first task to get started.</p>
                <Button size="sm" onClick={openCreateTask} className="gap-1.5">
                  <Plus className="h-3.5 w-3.5" />Add Task
                </Button>
              </div>
            ) : (
              <table className="w-full border-collapse text-sm">

                {/* ── Column headers ── */}
                <thead className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b">
                  <tr>
                    <th className="w-9 pl-4 py-2.5">
                      <Checkbox
                        checked={selected.size > 0 && selected.size === filteredTasks.length}
                        onCheckedChange={v => setSelected(v ? new Set(filteredTasks.map(t => t.id)) : new Set())}
                      />
                    </th>
                    <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-muted-foreground/60 uppercase tracking-wider">Name</th>
                    {spaceVisibleCols.assignee && <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-muted-foreground/60 uppercase tracking-wider w-32">Assigned</th>}
                    {spaceVisibleCols.dueDate  && <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-muted-foreground/60 uppercase tracking-wider w-28">Due Date</th>}
                    {spaceVisibleCols.size     && <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-muted-foreground/60 uppercase tracking-wider w-20">Size</th>}
                    {spaceVisibleCols.priority && <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-muted-foreground/60 uppercase tracking-wider w-28">Priority</th>}
                    <th className="w-10 px-2 py-2.5">
                      <button
                        onClick={() => setSpaceColDrawerOpen(true)}
                        title="Manage fields"
                        className="h-6 w-6 flex items-center justify-center rounded-full border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                      >
                        <SlidersHorizontal className="h-3 w-3" />
                      </button>
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {([
                    { key: 'todo',        label: 'To Do',       color: '#94a3b8', bg: 'rgba(148,163,184,0.06)' },
                    { key: 'in_progress', label: 'In Progress', color: '#f59e0b', bg: 'rgba(245,158,11,0.06)'  },
                    { key: 'in_review',   label: 'In Review',   color: '#3b82f6', bg: 'rgba(59,130,246,0.06)'  },
                    { key: 'done',        label: 'Done',        color: '#22c55e', bg: 'rgba(34,197,94,0.06)'   },
                    { key: 'cancelled',   label: 'Cancelled',   color: '#ef4444', bg: 'rgba(239,68,68,0.06)'   },
                  ] as const).map(group => {
                    const groupTasks = filteredTasks.filter(t => t.status === group.key)
                    if (groupTasks.length === 0 && search) return null
                    const isCollapsed = collapsedGroups.has(group.key)

                    return (
                      <React.Fragment key={group.key}>

                        {/* ── Status group header row ── */}
                        <tr
                          className="border-b border-border/40 cursor-pointer select-none group/gh hover:bg-muted/20 transition-colors"
                          onClick={() => setCollapsedGroups(prev => {
                            const n = new Set(prev); n.has(group.key) ? n.delete(group.key) : n.add(group.key); return n
                          })}
                        >
                          <td
                            colSpan={7}
                            className="py-2 pl-2 pr-4"
                            style={{ borderLeft: `3px solid ${group.color}` }}
                          >
                            <div className="flex items-center gap-2">
                              <ChevronRight
                                className={cn('h-3.5 w-3.5 text-muted-foreground/60 transition-transform duration-150 shrink-0', !isCollapsed && 'rotate-90')}
                              />
                              <span className="text-[11px] font-bold tracking-widest uppercase" style={{ color: group.color }}>
                                {group.label}
                              </span>
                              <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-semibold bg-black/[0.06] dark:bg-white/10 text-foreground/60">
                                {groupTasks.length}
                              </span>
                              <div className="flex-1" />
                              {/* Add Task hover CTA in header */}
                              <button
                                onClick={e => { e.stopPropagation(); openCreateTask() }}
                                className="opacity-0 group-hover/gh:opacity-100 flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-all px-2 py-0.5 rounded hover:bg-black/[0.06] dark:hover:bg-white/10"
                              >
                                <Plus className="h-3 w-3" />Add Task
                              </button>
                            </div>
                          </td>
                        </tr>

                        {/* ── Task rows ── */}
                        {!isCollapsed && groupTasks.map(task => {
                          const subtasks = subtaskMap[task.id] ?? []
                          const expanded = expandedRows.has(task.id)
                          const listName = task.list?.name ?? lists.find(l => l.id === task.list_id)?.name

                          return (
                            <React.Fragment key={task.id}>
                              <tr
                                className={cn(
                                  'border-b border-border/40 group/row cursor-pointer transition-colors bg-white dark:bg-zinc-900 hover:bg-slate-50 dark:hover:bg-zinc-800',
                                  selected.has(task.id) && 'bg-blue-50 dark:bg-blue-950/30'
                                )}
                              >
                                {/* Checkbox */}
                                <td className="pl-4 py-2.5 w-9" onClick={e => e.stopPropagation()}>
                                  <Checkbox
                                    checked={selected.has(task.id)}
                                    onCheckedChange={() => setSelected(prev => {
                                      const n = new Set(prev); n.has(task.id) ? n.delete(task.id) : n.add(task.id); return n
                                    })}
                                  />
                                </td>

                                {/* Name */}
                                <td className="px-3 py-2.5" onClick={() => router.push(`/lists/${task.list_id}/tasks/${task.id}`)}>
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    {subtasks.length > 0 ? (
                                      <button
                                        onClick={e => {
                                          e.stopPropagation()
                                          setExpandedRows(prev => { const n = new Set(prev); n.has(task.id) ? n.delete(task.id) : n.add(task.id); return n })
                                        }}
                                        className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                                      >
                                        <ChevronRight className={cn('h-3.5 w-3.5 transition-transform duration-150', expanded && 'rotate-90')} />
                                      </button>
                                    ) : (
                                      <span className="w-3.5 shrink-0" />
                                    )}
                                    <span className="font-medium text-[13px] truncate group-hover/row:text-primary transition-colors">
                                      {task.title}
                                    </span>
                                    {listName && (
                                      <span className="shrink-0 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400 border border-blue-100 dark:border-blue-800/50">
                                        {listName}
                                      </span>
                                    )}
                                    {subtasks.length > 0 && (
                                      <span className="shrink-0 inline-flex items-center gap-0.5 text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
                                        <ChevronRight className="h-2.5 w-2.5" />{subtasks.length}
                                      </span>
                                    )}
                                  </div>
                                </td>

                                {/* Assigned */}
                                {spaceVisibleCols.assignee && (
                                <td className="px-3 py-2.5 w-32">
                                  {(task.assignees ?? []).length > 0 ? (
                                    <div className="flex items-center -space-x-1.5">
                                      {(task.assignees ?? []).slice(0, 4).map(a => (
                                        <Avatar key={a.id} className="h-6 w-6 border-2 border-background">
                                          <AvatarImage src={a.avatar_url ?? undefined} />
                                          <AvatarFallback className="text-[9px] bg-slate-300 dark:bg-slate-600">{getInitials(a.full_name)}</AvatarFallback>
                                        </Avatar>
                                      ))}
                                      {(task.assignees ?? []).length > 4 && (
                                        <span className="h-6 w-6 rounded-full bg-muted border-2 border-background flex items-center justify-center text-[9px] font-semibold text-muted-foreground">
                                          +{(task.assignees ?? []).length - 4}
                                        </span>
                                      )}
                                    </div>
                                  ) : (
                                    <span className="text-xs text-muted-foreground/40">—</span>
                                  )}
                                </td>
                                )}

                                {/* Due Date */}
                                {spaceVisibleCols.dueDate && (
                                <td className="px-3 py-2.5 w-28">
                                  {task.due_date ? (
                                    <span className={cn(
                                      'text-xs tabular-nums',
                                      isAfter(new Date(), parseISO(task.due_date)) && task.status !== 'done' && task.status !== 'cancelled'
                                        ? 'text-red-500 font-medium'
                                        : 'text-muted-foreground'
                                    )}>
                                      {format(parseISO(task.due_date), 'MM/dd/yy')}
                                    </span>
                                  ) : (
                                    <span className="text-xs text-muted-foreground/40">—</span>
                                  )}
                                </td>
                                )}

                                {/* Size (estimated hours) */}
                                {spaceVisibleCols.size && (
                                <td className="px-3 py-2.5 w-20">
                                  {task.estimated_hours
                                    ? <span className="text-xs text-muted-foreground tabular-nums">{task.estimated_hours}h</span>
                                    : <span className="text-xs text-muted-foreground/40">—</span>}
                                </td>
                                )}

                                {/* Priority */}
                                {spaceVisibleCols.priority && (
                                <td className="px-3 py-2.5 w-28">
                                  <span className={cn(
                                    'inline-flex items-center gap-1 text-xs font-medium',
                                    task.priority === 'urgent' ? 'text-red-500' :
                                    task.priority === 'high'   ? 'text-orange-500' :
                                    task.priority === 'low'    ? 'text-blue-400' : 'text-muted-foreground'
                                  )}>
                                    <span className="text-[10px] font-bold leading-none">
                                      {task.priority === 'urgent' ? '!!' : task.priority === 'high' ? '↑' : task.priority === 'low' ? '↓' : '—'}
                                    </span>
                                    {task.priority === 'medium' ? 'Normal' : task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
                                  </span>
                                </td>
                                )}

                                {/* Actions */}
                                <td className="px-2 py-2.5 w-10" onClick={e => e.stopPropagation()}>
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover/row:opacity-100 transition-opacity">
                                        <MoreHorizontal className="h-3.5 w-3.5" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                      <DropdownMenuItem onClick={() => router.push(`/lists/${task.list_id}/tasks/${task.id}`)}>Open task</DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </td>
                              </tr>

                              {/* Subtask rows */}
                              {expanded && subtasks.map(sub => (
                                <tr key={sub.id}
                                  className="border-b border-border/30 bg-white dark:bg-zinc-900 hover:bg-slate-50 dark:hover:bg-zinc-800 cursor-pointer group/sub"
                                  onClick={() => router.push(`/lists/${sub.list_id}/tasks/${sub.id}`)}>
                                  <td className="pl-4 py-2 w-9" />
                                  <td className="px-3 py-2 pl-10">
                                    <div className="flex items-center gap-1.5">
                                      <span className="w-3.5 shrink-0" />
                                      <span className="text-xs text-muted-foreground group-hover/sub:text-foreground transition-colors truncate">{sub.title}</span>
                                    </div>
                                  </td>
                                  <td className="px-3 py-2 w-32">
                                    {(sub.assignees ?? []).length > 0 ? (
                                      <div className="flex -space-x-1.5">
                                        {(sub.assignees ?? []).slice(0, 3).map(a => (
                                          <Avatar key={a.id} className="h-5 w-5 border-2 border-background">
                                            <AvatarFallback className="text-[8px]">{getInitials(a.full_name)}</AvatarFallback>
                                          </Avatar>
                                        ))}
                                      </div>
                                    ) : <span className="text-xs text-muted-foreground/40">—</span>}
                                  </td>
                                  <td className="px-3 py-2 w-28 text-xs text-muted-foreground tabular-nums">
                                    {sub.due_date ? format(parseISO(sub.due_date), 'MM/dd/yy') : '—'}
                                  </td>
                                  <td className="px-3 py-2 w-20 text-xs text-muted-foreground">
                                    {sub.estimated_hours ? `${sub.estimated_hours}h` : '—'}
                                  </td>
                                  <td className="px-3 py-2 w-28">
                                    <span className={cn('text-xs font-medium',
                                      sub.priority === 'urgent' ? 'text-red-500' :
                                      sub.priority === 'high'   ? 'text-orange-500' :
                                      sub.priority === 'low'    ? 'text-blue-400' : 'text-muted-foreground'
                                    )}>
                                      {sub.priority === 'medium' ? 'Normal' : sub.priority.charAt(0).toUpperCase() + sub.priority.slice(1)}
                                    </span>
                                  </td>
                                  <td className="w-10 px-2" />
                                </tr>
                              ))}
                            </React.Fragment>
                          )
                        })}

                        {/* ── Add Task row (per status group) ── */}
                        {!isCollapsed && (
                          <tr className="border-b border-border/20">
                            <td
                              colSpan={7}
                              className="py-1 bg-white dark:bg-zinc-900"
                              style={{ borderLeft: `3px solid transparent` }}
                            >
                              <button
                                onClick={openCreateTask}
                                className="flex items-center gap-1.5 text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors py-1.5 pl-9 pr-4 w-full text-left rounded hover:bg-muted/30"
                              >
                                <Plus className="h-3.5 w-3.5 shrink-0" />
                                <span>Add Task</span>
                              </button>
                            </td>
                          </tr>
                        )}

                      </React.Fragment>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>

        </div>
      )}

      {/* ── Space list Fields drawer ──────────────────────────────────────── */}
      <Sheet open={spaceColDrawerOpen} onOpenChange={setSpaceColDrawerOpen}>
        <SheetContent side="right" className="w-80 p-0 flex flex-col gap-0">
          <SheetHeader className="px-4 py-3 border-b shrink-0">
            <SheetTitle className="text-sm font-semibold">Fields</SheetTitle>
          </SheetHeader>
          <div className="px-3 py-2 border-b shrink-0">
            <input
              placeholder="Search for new or existing fields"
              className="w-full rounded-md border border-border bg-muted/30 px-3 py-1.5 text-xs outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/50"
            />
          </div>
          <div className="flex-1 overflow-y-auto">
            {/* Shown */}
            <div className="px-3 pt-3 pb-1">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Shown</span>
                <button
                  onClick={() => setSpaceVisibleCols({ assignee: false, dueDate: false, size: false, priority: false })}
                  className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                >Hide all</button>
              </div>
              {/* Task Name — always shown */}
              <div className="flex items-center justify-between px-2 py-2 rounded-lg">
                <div className="flex items-center gap-2.5">
                  <Flag className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-sm">Task Name</span>
                </div>
                <button className="relative inline-flex h-5 w-9 shrink-0 rounded-full bg-emerald-500 opacity-50 cursor-not-allowed">
                  <span className="inline-block h-4 w-4 rounded-full bg-white shadow mt-0.5 translate-x-4" />
                </button>
              </div>
              {(Object.keys(SPACE_DEFAULT_COLS) as (keyof SpaceVisibleCols)[])
                .filter(k => spaceVisibleCols[k])
                .map(key => (
                  <div key={key} onClick={() => toggleSpaceCol(key)}
                    className="flex items-center justify-between px-2 py-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors">
                    <div className="flex items-center gap-2.5">
                      {key === 'assignee' ? <Users className="h-3.5 w-3.5 text-muted-foreground" /> :
                       key === 'dueDate'  ? <Calendar className="h-3.5 w-3.5 text-muted-foreground" /> :
                       key === 'size'     ? <Clock className="h-3.5 w-3.5 text-muted-foreground" /> :
                                            <Flag className="h-3.5 w-3.5 text-muted-foreground" />}
                      <span className="text-sm">{SPACE_COL_LABELS[key]}</span>
                    </div>
                    <button className="relative inline-flex h-5 w-9 shrink-0 rounded-full bg-emerald-500">
                      <span className="inline-block h-4 w-4 rounded-full bg-white shadow mt-0.5 translate-x-4" />
                    </button>
                  </div>
                ))}
            </div>
            <div className="mx-3 my-1 border-t border-border/50" />
            {/* Hidden */}
            <div className="px-3 pb-3">
              <div className="flex items-center justify-between mb-1 pt-1">
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Hidden</span>
              </div>
              {(Object.keys(SPACE_DEFAULT_COLS) as (keyof SpaceVisibleCols)[])
                .filter(k => !spaceVisibleCols[k])
                .map(key => (
                  <div key={key} onClick={() => toggleSpaceCol(key)}
                    className="flex items-center justify-between px-2 py-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors">
                    <div className="flex items-center gap-2.5">
                      {key === 'assignee' ? <Users className="h-3.5 w-3.5 text-muted-foreground/50" /> :
                       key === 'dueDate'  ? <Calendar className="h-3.5 w-3.5 text-muted-foreground/50" /> :
                       key === 'size'     ? <Clock className="h-3.5 w-3.5 text-muted-foreground/50" /> :
                                            <Flag className="h-3.5 w-3.5 text-muted-foreground/50" />}
                      <span className="text-sm text-muted-foreground">{SPACE_COL_LABELS[key]}</span>
                    </div>
                    <button className="relative inline-flex h-5 w-9 shrink-0 rounded-full bg-muted">
                      <span className="inline-block h-4 w-4 rounded-full bg-white shadow mt-0.5 translate-x-0.5" />
                    </button>
                  </div>
                ))}
              {Object.values(spaceVisibleCols).every(Boolean) && (
                <p className="text-xs text-muted-foreground/50 px-2 py-2">All fields are shown</p>
              )}
            </div>
          </div>
          <div className="px-4 py-3 border-t shrink-0">
            <button onClick={() => setSpaceVisibleCols(SPACE_DEFAULT_COLS)}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2">
              Reset to default
            </button>
          </div>
        </SheetContent>
      </Sheet>

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
                {lists.length === 0 ? (
                  <>
                    <p className="text-sm text-muted-foreground mb-4 max-w-xs">
                      You need a list before you can create tasks. Start by creating a list in this space.
                    </p>
                    <Button onClick={() => setShowCreateList(true)}>
                      <Plus className="h-4 w-4 mr-2" />New List
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
                            onClick={() => router.push(`/lists/${task.list_id}/tasks/${task.id}`)}>
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
                          onClick={() => router.push(`/lists/${t.list_id}/tasks/${t.id}`)}>
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
                  onClick={() => router.push(`/lists/${t.list_id}/tasks/${t.id}`)}>
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
                        onClick={() => router.push(`/lists/${t.list_id}/tasks/${t.id}`)}>
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
      <EditSpaceDialog
        space={{ ...space, name: spaceName }}
        open={showEditSpace}
        onOpenChange={setShowEditSpace}
        onSuccess={(name, description) => {
          setSpaceName(name)
        }}
      />

      <AssignStaffDialog open={showAssign} onOpenChange={setShowAssign}
        spaceId={space.id} currentMemberIds={members.map(m => m.id)}
        onSuccess={refresh} />

      {isAdmin && (
        <CreateListDialog open={showCreateList} onOpenChange={setShowCreateList}
          spaces={[space]} onCreated={refresh} profile={profile} />
      )}

      {lists.length > 0 && (
        <CreateTaskDialog
          open={showCreateTask}
          onOpenChange={setShowCreateTask}
          lists={lists}
          profile={profile}
          onCreated={refresh}
        />
      )}
    </div>
  )
}
