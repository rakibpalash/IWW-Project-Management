'use client'

import { useState, useMemo, useEffect, useCallback, useTransition } from 'react'
import { Profile } from '@/types'
import { TimesheetRow, getTimesheetEntriesAction, deleteTimesheetEntryAction } from '@/app/actions/timesheet'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Timer,
  Download,
  ChevronDown,
  Search,
  Check,
  Clock,
  Calendar,
  Users,
  MoreHorizontal,
  Trash2,
  Loader2,
  ExternalLink,
} from 'lucide-react'
import Link from 'next/link'
import { cn, getInitials } from '@/lib/utils'
import { useToast } from '@/components/ui/use-toast'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDuration(minutes: number | null): string {
  const m = Math.max(0, minutes ?? 0)
  const h = Math.floor(m / 60)
  const min = m % 60
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}:00`
}

function formatRunningDuration(startedAt: string, tick: number): string {
  const elapsed = Math.max(0, Math.floor((tick - new Date(startedAt).getTime()) / 1000))
  const h = Math.floor(elapsed / 3600)
  const m = Math.floor((elapsed % 3600) / 60)
  const s = elapsed % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function entryDurationMinutes(entry: TimesheetRow): number {
  if (entry.is_running) {
    return Math.floor((Date.now() - new Date(entry.started_at).getTime()) / 60000)
  }
  return entry.duration_minutes ?? 0
}

function formatDateHeader(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
}

function formatTotalMinutes(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

function isSameDay(dateStr: string, now: Date): boolean {
  const d = new Date(dateStr)
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  )
}

function isSameWeek(dateStr: string, now: Date): boolean {
  const d = new Date(dateStr)
  const startOfWeek = new Date(now)
  startOfWeek.setDate(now.getDate() - now.getDay())
  startOfWeek.setHours(0, 0, 0, 0)
  return d >= startOfWeek
}

function isSameMonth(dateStr: string, now: Date): boolean {
  const d = new Date(dateStr)
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
}

const avatarColors = [
  'bg-pink-500', 'bg-purple-500', 'bg-indigo-500', 'bg-blue-500',
  'bg-cyan-500', 'bg-teal-500', 'bg-green-500', 'bg-orange-500',
]
function getAvatarColor(name: string) {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return avatarColors[Math.abs(hash) % avatarColors.length]
}

// ─── Date Preset Types ───────────────────────────────────────────────────────

type DatePreset = 'today' | 'week' | 'month' | 'last_month' | 'custom'

function getPresetRange(preset: DatePreset): { dateFrom: string; dateTo: string } {
  const now = new Date()
  switch (preset) {
    case 'today': {
      const from = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      const to = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)
      return { dateFrom: from.toISOString(), dateTo: to.toISOString() }
    }
    case 'week': {
      const startOfWeek = new Date(now)
      startOfWeek.setDate(now.getDate() - now.getDay())
      startOfWeek.setHours(0, 0, 0, 0)
      const endOfWeek = new Date(startOfWeek)
      endOfWeek.setDate(startOfWeek.getDate() + 6)
      endOfWeek.setHours(23, 59, 59)
      return { dateFrom: startOfWeek.toISOString(), dateTo: endOfWeek.toISOString() }
    }
    case 'last_month': {
      const from = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const to = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59)
      return { dateFrom: from.toISOString(), dateTo: to.toISOString() }
    }
    case 'month':
    default: {
      const from = new Date(now.getFullYear(), now.getMonth(), 1)
      const to = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)
      return { dateFrom: from.toISOString(), dateTo: to.toISOString() }
    }
  }
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, color }: {
  icon: React.ElementType
  label: string
  value: string
  color: string
}) {
  return (
    <div className="flex items-center gap-3 bg-white border border-gray-200 rounded-xl px-4 py-3 flex-1 min-w-0">
      <div className={cn('h-9 w-9 rounded-lg flex items-center justify-center shrink-0', color)}>
        <Icon className="h-4 w-4 text-white" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-gray-500 truncate">{label}</p>
        <p className="text-base font-semibold text-gray-900 truncate">{value}</p>
      </div>
    </div>
  )
}

function BoardFilter({
  projects,
  selected,
  onChange,
}: {
  projects: { id: string; name: string }[]
  selected: string[]
  onChange: (ids: string[]) => void
}) {
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)

  const filtered = projects.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  )

  const allSelected = selected.length === 0
  const label = allSelected
    ? 'All Boards'
    : selected.length === 1
    ? (projects.find((p) => p.id === selected[0])?.name ?? '1 Board')
    : `${selected.length} Boards`

  const toggle = (id: string) => {
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id])
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="gap-2 h-9 text-sm font-medium min-w-[130px] justify-between">
          <span className="truncate">{label}</span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-gray-400" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="start">
        <div className="flex items-center justify-between px-3 pt-3 pb-2">
          <span className="text-sm font-semibold text-gray-800">Boards</span>
          <Button size="sm" className="h-7 text-xs" onClick={() => setOpen(false)}>
            Done
          </Button>
        </div>
        <div className="px-2 pb-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
            <Input
              placeholder="Search for Boards"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 text-sm"
            />
          </div>
        </div>
        <div className="max-h-52 overflow-y-auto pb-2">
          {/* All Boards option */}
          <button
            type="button"
            onClick={() => onChange([])}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-gray-50 transition-colors"
          >
            <div className={cn(
              'h-4 w-4 rounded border-2 flex items-center justify-center',
              allSelected ? 'bg-blue-600 border-blue-600' : 'border-gray-300',
            )}>
              {allSelected && <Check className="h-2.5 w-2.5 text-white" />}
            </div>
            <span className="text-gray-700">All Boards</span>
          </button>
          {filtered.map((p) => {
            const checked = selected.includes(p.id)
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => toggle(p.id)}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-gray-50 transition-colors"
              >
                <div className={cn(
                  'h-4 w-4 rounded border-2 flex items-center justify-center shrink-0',
                  checked ? 'bg-blue-600 border-blue-600' : 'border-gray-300',
                )}>
                  {checked && <Check className="h-2.5 w-2.5 text-white" />}
                </div>
                <span className="text-gray-700 truncate">{p.name}</span>
              </button>
            )
          })}
          {filtered.length === 0 && (
            <p className="text-xs text-gray-400 text-center py-3">No boards found</p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}

function PeopleFilter({
  profiles,
  selected,
  onChange,
}: {
  profiles: { id: string; full_name: string; avatar_url: string | null; role: string }[]
  selected: string[]
  onChange: (ids: string[]) => void
}) {
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)

  const filtered = profiles.filter((p) =>
    p.full_name.toLowerCase().includes(search.toLowerCase())
  )

  const allSelected = selected.length === 0
  const label = allSelected
    ? 'All Members'
    : selected.length === 1
    ? (profiles.find((p) => p.id === selected[0])?.full_name.split(' ')[0] ?? '1 Member')
    : `${selected.length} Members`

  const toggle = (id: string) => {
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id])
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="gap-2 h-9 text-sm font-medium min-w-[130px] justify-between">
          <Users className="h-3.5 w-3.5 shrink-0 text-gray-400" />
          <span className="truncate flex-1 text-left">{label}</span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-gray-400" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="start">
        <div className="flex items-center justify-between px-3 pt-3 pb-2">
          <span className="text-sm font-semibold text-gray-800">Members</span>
          <Button size="sm" className="h-7 text-xs" onClick={() => setOpen(false)}>
            Done
          </Button>
        </div>
        <div className="px-2 pb-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
            <Input
              placeholder="Search members"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 text-sm"
            />
          </div>
        </div>
        <div className="max-h-52 overflow-y-auto pb-2">
          <button
            type="button"
            onClick={() => onChange([])}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-gray-50 transition-colors"
          >
            <div className={cn(
              'h-4 w-4 rounded border-2 flex items-center justify-center',
              allSelected ? 'bg-blue-600 border-blue-600' : 'border-gray-300',
            )}>
              {allSelected && <Check className="h-2.5 w-2.5 text-white" />}
            </div>
            <span className="text-gray-700">All Members</span>
          </button>
          {filtered.map((p) => {
            const checked = selected.includes(p.id)
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => toggle(p.id)}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-gray-50 transition-colors"
              >
                <div className={cn(
                  'h-4 w-4 rounded border-2 flex items-center justify-center shrink-0',
                  checked ? 'bg-blue-600 border-blue-600' : 'border-gray-300',
                )}>
                  {checked && <Check className="h-2.5 w-2.5 text-white" />}
                </div>
                <Avatar className="h-5 w-5 shrink-0">
                  <AvatarFallback className={`text-[8px] text-white ${getAvatarColor(p.full_name)}`}>
                    {getInitials(p.full_name)}
                  </AvatarFallback>
                </Avatar>
                <span className="text-gray-700 truncate">{p.full_name}</span>
              </button>
            )
          })}
          {filtered.length === 0 && (
            <p className="text-xs text-gray-400 text-center py-3">No members found</p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}

// ─── Main Component ──────────────────────────────────────────────────────────

interface TimesheetPageProps {
  profile: Profile
  initialEntries: TimesheetRow[]
  initialDateFrom: string
  initialDateTo: string
  allProjects: { id: string; name: string }[]
  allProfiles: { id: string; full_name: string; avatar_url: string | null; role: string }[]
}

export function TimesheetPage({
  profile,
  initialEntries,
  initialDateFrom,
  initialDateTo,
  allProjects,
  allProfiles,
}: TimesheetPageProps) {
  const { toast } = useToast()
  const isAdmin = profile.role === 'super_admin'
  const [isPending, startTransition] = useTransition()

  // Entries state (refreshed when date range changes)
  const [entries, setEntries] = useState<TimesheetRow[]>(initialEntries)

  // Filters
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([])
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([])
  const [datePreset, setDatePreset] = useState<DatePreset>('month')
  const [customFrom, setCustomFrom] = useState(initialDateFrom.slice(0, 10))
  const [customTo, setCustomTo] = useState(initialDateTo.slice(0, 10))
  const [showCustom, setShowCustom] = useState(false)

  // Live tick for running entries
  const [tick, setTick] = useState(Date.now())
  const hasRunning = entries.some((e) => e.is_running)
  useEffect(() => {
    if (!hasRunning) return
    const id = setInterval(() => setTick(Date.now()), 1000)
    return () => clearInterval(id)
  }, [hasRunning])

  // Delete confirm
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // ── Fetch entries when date range changes ──
  const fetchEntries = useCallback(
    (dateFrom: string, dateTo: string, userIds: string[]) => {
      startTransition(async () => {
        const result = await getTimesheetEntriesAction({
          dateFrom,
          dateTo,
          userIds: isAdmin && userIds.length > 0 ? userIds : undefined,
        })
        if (result.success) setEntries(result.entries ?? [])
        else toast({ title: 'Failed to load entries', description: result.error, variant: 'destructive' })
      })
    },
    [isAdmin, toast]
  )

  const applyDatePreset = (preset: DatePreset) => {
    setDatePreset(preset)
    if (preset === 'custom') {
      setShowCustom(true)
      return
    }
    setShowCustom(false)
    const { dateFrom, dateTo } = getPresetRange(preset)
    fetchEntries(dateFrom, dateTo, selectedUserIds)
  }

  const applyCustomRange = () => {
    if (!customFrom || !customTo) return
    const dateFrom = new Date(customFrom).toISOString()
    const dateTo = new Date(customTo + 'T23:59:59').toISOString()
    fetchEntries(dateFrom, dateTo, selectedUserIds)
  }

  const applyUserFilter = (userIds: string[]) => {
    setSelectedUserIds(userIds)
    const { dateFrom, dateTo } = datePreset !== 'custom'
      ? getPresetRange(datePreset)
      : {
          dateFrom: new Date(customFrom).toISOString(),
          dateTo: new Date(customTo + 'T23:59:59').toISOString(),
        }
    fetchEntries(dateFrom, dateTo, userIds)
  }

  // ── Client-side project filter (fast, no refetch) ──
  const filteredEntries = useMemo(() => {
    if (selectedProjectIds.length === 0) return entries
    return entries.filter((e) => selectedProjectIds.includes(e.project_id))
  }, [entries, selectedProjectIds])

  // ── Group by date ──
  const groupedByDate = useMemo(() => {
    const groups: Record<string, TimesheetRow[]> = {}
    for (const e of filteredEntries) {
      const date = new Date(e.started_at).toLocaleDateString('en-CA') // YYYY-MM-DD
      if (!groups[date]) groups[date] = []
      groups[date].push(e)
    }
    return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a))
  }, [filteredEntries])

  // ── Stats ──
  const now = new Date()
  const todayMinutes = useMemo(
    () => filteredEntries.filter((e) => isSameDay(e.started_at, now)).reduce((s, e) => s + entryDurationMinutes(e), 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filteredEntries, tick]
  )
  const weekMinutes = useMemo(
    () => filteredEntries.filter((e) => isSameWeek(e.started_at, now)).reduce((s, e) => s + entryDurationMinutes(e), 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filteredEntries, tick]
  )
  const monthMinutes = useMemo(
    () => filteredEntries.filter((e) => isSameMonth(e.started_at, now)).reduce((s, e) => s + entryDurationMinutes(e), 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filteredEntries, tick]
  )

  // ── Export CSV ──
  const exportCsv = () => {
    const headers = ['Date', 'Task', 'Project', 'Added By', 'Duration', 'Description']
    const rows = filteredEntries.map((e) => [
      new Date(e.started_at).toLocaleDateString(),
      `"${e.task_title.replace(/"/g, '""')}"`,
      `"${e.project_name.replace(/"/g, '""')}"`,
      `"${e.user_full_name.replace(/"/g, '""')}"`,
      e.is_running
        ? formatRunningDuration(e.started_at, tick)
        : formatDuration(e.duration_minutes),
      `"${(e.description ?? '').replace(/"/g, '""')}"`,
    ])
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `timesheet-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // ── Delete ──
  const handleDelete = async () => {
    if (!deleteId) return
    setIsDeleting(true)
    const result = await deleteTimesheetEntryAction(deleteId)
    setIsDeleting(false)
    setDeleteId(null)
    if (result.success) {
      setEntries((prev) => prev.filter((e) => e.id !== deleteId))
      toast({ title: 'Entry deleted' })
    } else {
      toast({ title: 'Failed to delete', description: result.error, variant: 'destructive' })
    }
  }

  const PRESET_LABELS: Record<DatePreset, string> = {
    today: 'Today',
    week: 'This Week',
    month: 'This Month',
    last_month: 'Last Month',
    custom: 'Custom Range',
  }

  // Board label for breadcrumb
  const boardLabel =
    selectedProjectIds.length === 0
      ? 'All Boards'
      : selectedProjectIds.length === 1
      ? (allProjects.find((p) => p.id === selectedProjectIds[0])?.name ?? 'Board')
      : `${selectedProjectIds.length} Boards`

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* ─── Header ─── */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-gray-800">
            <Timer className="h-5 w-5 text-gray-500" />
            <h1 className="text-lg font-semibold">Timesheet</h1>
            <span className="text-gray-400">/</span>
            <span className="text-gray-600 text-sm font-medium">{boardLabel}</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={exportCsv}
            className="gap-1.5 h-8 text-xs"
          >
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-6 py-6 space-y-5">

          {/* ─── Stats ─── */}
          <div className="flex gap-3 flex-wrap">
            <StatCard icon={Clock} label="Today" value={formatTotalMinutes(todayMinutes)} color="bg-blue-500" />
            <StatCard icon={Calendar} label="This Week" value={formatTotalMinutes(weekMinutes)} color="bg-violet-500" />
            <StatCard icon={Calendar} label="This Month" value={formatTotalMinutes(monthMinutes)} color="bg-orange-500" />
            <StatCard icon={Timer} label="Entries" value={String(filteredEntries.length)} color="bg-emerald-500" />
          </div>

          {/* ─── Filters ─── */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Board filter */}
            <BoardFilter
              projects={allProjects}
              selected={selectedProjectIds}
              onChange={setSelectedProjectIds}
            />

            {/* Date preset */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2 h-9 text-sm font-medium min-w-[130px] justify-between">
                  <span className="truncate">{PRESET_LABELS[datePreset]}</span>
                  <ChevronDown className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {(Object.keys(PRESET_LABELS) as DatePreset[]).map((p) => (
                  <DropdownMenuItem key={p} onClick={() => applyDatePreset(p)}>
                    {datePreset === p && <Check className="h-3.5 w-3.5 mr-2 text-blue-500" />}
                    {datePreset !== p && <span className="w-5 mr-2" />}
                    {PRESET_LABELS[p]}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Custom date range */}
            {showCustom && (
              <div className="flex items-center gap-2">
                <Input
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="h-9 text-sm w-36"
                />
                <span className="text-gray-400 text-sm">→</span>
                <Input
                  type="date"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="h-9 text-sm w-36"
                />
                <Button size="sm" className="h-9 text-sm" onClick={applyCustomRange} disabled={isPending}>
                  Apply
                </Button>
              </div>
            )}

            {/* People filter (admin only) */}
            {isAdmin && allProfiles.length > 0 && (
              <PeopleFilter
                profiles={allProfiles}
                selected={selectedUserIds}
                onChange={applyUserFilter}
              />
            )}

            {isPending && (
              <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
            )}
          </div>

          {/* ─── Entries ─── */}
          {groupedByDate.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 flex flex-col items-center justify-center py-16 gap-3">
              <div className="h-12 w-12 rounded-full bg-gray-100 flex items-center justify-center">
                <Timer className="h-6 w-6 text-gray-400" />
              </div>
              <p className="text-sm font-medium text-gray-600">No time entries found</p>
              <p className="text-xs text-gray-400">Try a different date range or filter</p>
            </div>
          ) : (
            <div className="space-y-4">
              {groupedByDate.map(([date, dateEntries]) => {
                const dayTotal = dateEntries.reduce((s, e) => s + entryDurationMinutes(e), 0)
                return (
                  <div key={date} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    {/* Date header */}
                    <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 border-b border-gray-100">
                      <span className="text-sm font-semibold text-gray-700">
                        {formatDateHeader(date)}
                      </span>
                      <span className="text-xs font-medium text-gray-500">
                        Total: {formatTotalMinutes(dayTotal)}
                      </span>
                    </div>

                    {/* Column headers */}
                    <div className="grid grid-cols-[1fr_180px_180px_120px_40px] gap-4 px-4 py-2 border-b border-gray-100">
                      <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Task Title</span>
                      <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Added By</span>
                      <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Board</span>
                      <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide text-right">Time Recorded</span>
                      <span />
                    </div>

                    {/* Entries */}
                    <div className="divide-y divide-gray-50">
                      {dateEntries.map((entry) => (
                        <EntryRow
                          key={entry.id}
                          entry={entry}
                          tick={tick}
                          isAdmin={isAdmin}
                          currentUserId={profile.id}
                          onDelete={() => setDeleteId(entry.id)}
                        />
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* ─── Delete confirm ─── */}
      <AlertDialog open={!!deleteId} onOpenChange={(v) => !v && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete time entry?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// ─── Entry Row ────────────────────────────────────────────────────────────────

function EntryRow({
  entry,
  tick,
  isAdmin,
  currentUserId,
  onDelete,
}: {
  entry: TimesheetRow
  tick: number
  isAdmin: boolean
  currentUserId: string
  onDelete: () => void
}) {
  const canDelete = isAdmin || entry.user_id === currentUserId
  const timeDisplay = entry.is_running
    ? formatRunningDuration(entry.started_at, tick)
    : formatDuration(entry.duration_minutes)

  return (
    <div className="grid grid-cols-[1fr_180px_180px_120px_40px] gap-4 px-4 py-3 items-center hover:bg-gray-50/60 transition-colors group">
      {/* Task title */}
      <div className="min-w-0">
        <Link
          href={`/tasks/${entry.task_id}`}
          className="inline-flex items-center gap-1 text-sm font-medium text-gray-800 hover:text-blue-600 hover:underline truncate max-w-full group/link"
          onClick={(e) => e.stopPropagation()}
        >
          <span className="truncate">{entry.task_title}</span>
          <ExternalLink className="h-3 w-3 shrink-0 opacity-0 group-hover/link:opacity-100 transition-opacity" />
        </Link>
        {entry.description && (
          <p className="text-xs text-gray-400 truncate mt-0.5">{entry.description}</p>
        )}
      </div>

      {/* Added by */}
      <div className="flex items-center gap-2 min-w-0">
        <Avatar className="h-6 w-6 shrink-0">
          <AvatarFallback className={`text-[9px] text-white ${getAvatarColor(entry.user_full_name)}`}>
            {getInitials(entry.user_full_name)}
          </AvatarFallback>
        </Avatar>
        <span className="text-sm text-gray-700 truncate">{entry.user_full_name}</span>
      </div>

      {/* Board / Project */}
      <div className="min-w-0">
        <span className="text-sm text-gray-600 truncate block">{entry.project_name}</span>
      </div>

      {/* Time */}
      <div className="flex justify-end">
        {entry.is_running ? (
          <Badge className="bg-green-500 hover:bg-green-500 text-white font-mono text-xs gap-1.5 px-2.5 py-1">
            <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
            {timeDisplay}
          </Badge>
        ) : (
          <Badge className="bg-orange-500 hover:bg-orange-500 text-white font-mono text-xs px-2.5 py-1">
            {timeDisplay}
          </Badge>
        )}
      </div>

      {/* Actions */}
      <div className="flex justify-end">
        {canDelete && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                className="text-red-600 focus:text-red-600"
                onClick={onDelete}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete entry
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  )
}
