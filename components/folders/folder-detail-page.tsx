'use client'

import { useState } from 'react'
import Link from 'next/link'
import { format, parseISO } from 'date-fns'
import {
  FolderOpen,
  GripVertical,
  CalendarDays,
  User,
  Share2,
  Plus,
  Upload,
  AlignLeft,
  Flag,
  BarChart2,
  ChevronRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/use-toast'
import { Folder, Space, List, Task, Profile } from '@/types'

// ─── Types ────────────────────────────────────────────────────────────────────

interface FolderDetailPageProps {
  folder: Folder
  space: Space | null
  lists: List[]
  tasks: Task[]
  profile: Profile
  isAdmin: boolean
}

type TabType = 'overview' | 'list'

// ─── Constants ────────────────────────────────────────────────────────────────

const SPACE_COLORS = [
  '#7c3aed', '#0891b2', '#0284c7', '#059669',
  '#d97706', '#dc2626', '#db2777', '#4f46e5',
]

function getSpaceColor(id: string) {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return SPACE_COLORS[h % SPACE_COLORS.length]
}

function getInitials(name: string) {
  return name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

function formatDate(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null
  try {
    return format(parseISO(dateStr), 'MMM d')
  } catch {
    return null
  }
}

const PRIORITY_STYLES: Record<string, string> = {
  urgent: 'bg-red-50 text-red-600 border-red-200',
  high:   'bg-orange-50 text-orange-600 border-orange-200',
  medium: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  low:    'bg-blue-50 text-blue-600 border-blue-200',
}

const TASK_STATUS_STYLES: Record<string, string> = {
  todo:        'bg-slate-100 text-slate-600 border-slate-200',
  in_progress: 'bg-amber-50 text-amber-700 border-amber-200',
  in_review:   'bg-blue-50 text-blue-700 border-blue-200',
  done:        'bg-green-50 text-green-700 border-green-200',
  cancelled:   'bg-red-50 text-red-600 border-red-200',
}

const TASK_STATUS_LABEL: Record<string, string> = {
  todo: 'To Do', in_progress: 'In Progress', in_review: 'In Review',
  done: 'Done', cancelled: 'Cancelled',
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ProgressBar({ done, total }: { done: number; total: number }) {
  const pct = total === 0 ? 0 : Math.round((done / total) * 100)
  return (
    <div className="flex items-center gap-2 min-w-[110px]">
      <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, background: '#00c4a0' }}
        />
      </div>
      <span className="text-[11px] text-muted-foreground whitespace-nowrap">
        {done}/{total}
      </span>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function FolderDetailPage({
  folder,
  space,
  lists,
  tasks,
  profile,
  isAdmin,
}: FolderDetailPageProps) {
  const { toast } = useToast()
  const [activeTab, setActiveTab] = useState<TabType>('overview')

  const folderColor = getSpaceColor(folder.id)

  // Pre-compute task counts per list
  const tasksByList = tasks.reduce<Record<string, Task[]>>((acc, t) => {
    if (!acc[t.list_id]) acc[t.list_id] = []
    acc[t.list_id].push(t)
    return acc
  }, {})

  function doneCount(listId: string) {
    return (tasksByList[listId] ?? []).filter((t) => t.status === 'done').length
  }
  function totalCount(listId: string) {
    return (tasksByList[listId] ?? []).length
  }

  // Tasks by assignee for the chart
  const assigneeMap = new Map<string, { profile: Profile; count: number }>()
  for (const task of tasks) {
    for (const assignee of task.assignees ?? []) {
      if (!assignee) continue
      const existing = assigneeMap.get(assignee.id)
      if (existing) {
        existing.count++
      } else {
        assigneeMap.set(assignee.id, { profile: assignee, count: 1 })
      }
    }
  }
  const assigneeEntries = Array.from(assigneeMap.values()).sort((a, b) => b.count - a.count)
  const maxAssigneeCount = assigneeEntries[0]?.count ?? 1

  // Handle share link
  function handleShare() {
    const url = typeof window !== 'undefined' ? window.location.href : ''
    navigator.clipboard.writeText(url).then(() => {
      toast({ title: 'Link copied', description: 'Folder link copied to clipboard.' })
    })
  }

  // ── Tabs ──────────────────────────────────────────────────────────────────

  const tabs: { key: TabType; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'list', label: 'List' },
  ]

  return (
    <div className="flex flex-col h-full min-h-0 bg-background">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-6 pt-4 pb-0 border-b border-border/50 pb-3">
        <div className="flex items-center gap-3 min-w-0">
          {/* Folder color badge */}
          <span
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md"
            style={{ background: folderColor }}
          >
            <FolderOpen className="h-4 w-4 text-white" />
          </span>

          {/* Breadcrumb */}
          <div className="flex items-center gap-1.5 text-sm min-w-0">
            {space ? (
              <>
                <Link
                  href={`/spaces/${space.id}`}
                  className="text-muted-foreground hover:text-foreground transition-colors truncate"
                >
                  {space.name}
                </Link>
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              </>
            ) : null}
            <span className="font-semibold text-foreground truncate">{folder.name}</span>
          </div>
        </div>

        {/* Right-side actions */}
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs gap-1.5"
            onClick={handleShare}
          >
            <Share2 className="h-3.5 w-3.5" />
            Share
          </Button>
          {isAdmin && (
            <Button size="sm" className="h-7 text-xs gap-1.5">
              <Plus className="h-3.5 w-3.5" />
              New List
            </Button>
          )}
        </div>
      </div>

      {/* ── Tab bar ────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-0 px-6 border-b border-border/50">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              'px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
              activeTab === tab.key
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            {tab.label}
          </button>
        ))}
        <button className="px-3 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground border-b-2 border-transparent -mb-px transition-colors flex items-center gap-1">
          <Plus className="h-3.5 w-3.5" />
          View
        </button>
      </div>

      {/* ── Tab content ────────────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {activeTab === 'overview' && (
          <OverviewTab
            lists={lists}
            tasks={tasks}
            tasksByList={tasksByList}
            doneCount={doneCount}
            totalCount={totalCount}
            assigneeEntries={assigneeEntries}
            maxAssigneeCount={maxAssigneeCount}
          />
        )}
        {activeTab === 'list' && (
          <ListTab lists={lists} tasks={tasks} />
        )}
      </div>
    </div>
  )
}

// ─── Overview Tab ─────────────────────────────────────────────────────────────

function OverviewTab({
  lists,
  tasks,
  tasksByList,
  doneCount,
  totalCount,
  assigneeEntries,
  maxAssigneeCount,
}: {
  lists: List[]
  tasks: Task[]
  tasksByList: Record<string, Task[]>
  doneCount: (id: string) => number
  totalCount: (id: string) => number
  assigneeEntries: { profile: Profile; count: number }[]
  maxAssigneeCount: number
}) {
  return (
    <div className="p-6 space-y-6">

      {/* ── Lists table ──────────────────────────────────────────────────── */}
      <div>
        <h2 className="text-sm font-semibold text-foreground mb-3">Lists</h2>

        {lists.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <FolderOpen className="h-10 w-10 mb-3 opacity-30" />
            <p className="text-sm font-medium">No lists in this folder yet</p>
            <p className="text-xs mt-1 opacity-60">Create a list to get started</p>
          </div>
        ) : (
          <div className="rounded-lg border border-border/60 overflow-hidden">
            {/* Table header */}
            <div className="grid bg-slate-50/80 dark:bg-muted/30 border-b border-border/50 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide"
              style={{ gridTemplateColumns: '28px 1fr 60px 140px 90px 90px 90px 60px 32px' }}>
              <div className="py-2 px-2" /> {/* drag handle */}
              <div className="py-2 px-3 flex items-center gap-1.5">
                <AlignLeft className="h-3 w-3" /> Name
              </div>
              <div className="py-2 px-2 flex items-center gap-1.5">Color</div>
              <div className="py-2 px-2 flex items-center gap-1.5">
                <BarChart2 className="h-3 w-3" /> Progress
              </div>
              <div className="py-2 px-2 flex items-center gap-1.5">
                <CalendarDays className="h-3 w-3" /> Start
              </div>
              <div className="py-2 px-2 flex items-center gap-1.5">
                <CalendarDays className="h-3 w-3" /> End
              </div>
              <div className="py-2 px-2 flex items-center gap-1.5">
                <Flag className="h-3 w-3" /> Priority
              </div>
              <div className="py-2 px-2 flex items-center gap-1.5">
                <User className="h-3 w-3" /> Owner
              </div>
              <div className="py-2 px-2" /> {/* + button */}
            </div>

            {/* Rows */}
            {lists.map((list, idx) => {
              const done = doneCount(list.id)
              const total = totalCount(list.id)
              const startFmt = formatDate(list.start_date)
              const endFmt = formatDate(list.due_date)

              return (
                <div
                  key={list.id}
                  className={cn(
                    'group grid items-center hover:bg-slate-50/60 dark:hover:bg-muted/20 transition-colors',
                    idx < lists.length - 1 && 'border-b border-border/40'
                  )}
                  style={{ gridTemplateColumns: '28px 1fr 60px 140px 90px 90px 90px 60px 32px' }}
                >
                  {/* Drag handle */}
                  <div className="flex items-center justify-center opacity-0 group-hover:opacity-40 transition-opacity cursor-grab py-2.5">
                    <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>

                  {/* Name */}
                  <div className="py-2.5 px-3 min-w-0">
                    <Link
                      href={`/lists/${list.id}`}
                      className="text-sm font-medium text-foreground hover:text-blue-600 truncate block transition-colors"
                    >
                      {list.name}
                    </Link>
                  </div>

                  {/* Color */}
                  <div className="py-2.5 px-2 text-xs text-muted-foreground">—</div>

                  {/* Progress */}
                  <div className="py-2.5 px-2">
                    <ProgressBar done={done} total={total} />
                  </div>

                  {/* Start */}
                  <div className="py-2.5 px-2 text-xs text-muted-foreground">
                    {startFmt ?? (
                      <CalendarDays className="h-3.5 w-3.5 opacity-30" />
                    )}
                  </div>

                  {/* End */}
                  <div className="py-2.5 px-2 text-xs text-muted-foreground">
                    {endFmt ?? (
                      <CalendarDays className="h-3.5 w-3.5 opacity-30" />
                    )}
                  </div>

                  {/* Priority */}
                  <div className="py-2.5 px-2">
                    {list.priority ? (
                      <Badge
                        variant="outline"
                        className={cn(
                          'text-[10px] px-1.5 py-0 h-4 capitalize',
                          PRIORITY_STYLES[list.priority] ?? ''
                        )}
                      >
                        {list.priority}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </div>

                  {/* Owner */}
                  <div className="py-2.5 px-2 flex items-center">
                    <OwnerAvatar userId={list.created_by} />
                  </div>

                  {/* + button */}
                  <div className="py-2.5 px-1 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <button className="h-5 w-5 flex items-center justify-center rounded hover:bg-slate-200 dark:hover:bg-muted transition-colors">
                      <Plus className="h-3 w-3 text-muted-foreground" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Bottom panels ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Resources */}
        <div className="rounded-lg border border-border/60 p-4 flex flex-col gap-3">
          <h3 className="text-sm font-semibold text-foreground">Resources</h3>
          <div className="flex-1 flex flex-col items-center justify-center py-8 border-2 border-dashed border-border/50 rounded-lg gap-2 text-muted-foreground">
            <Upload className="h-8 w-8 opacity-30" />
            <p className="text-sm">Drop files here or attach</p>
            <p className="text-xs opacity-60">No files yet</p>
          </div>
        </div>

        {/* Tasks by Assignee */}
        <div className="rounded-lg border border-border/60 p-4 flex flex-col gap-3">
          <h3 className="text-sm font-semibold text-foreground">Tasks by Assignee</h3>

          {assigneeEntries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground gap-2">
              <User className="h-8 w-8 opacity-30" />
              <p className="text-sm">No assigned tasks yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {assigneeEntries.map(({ profile: p, count }) => (
                <div key={p.id} className="flex items-center gap-3">
                  <Avatar className="h-6 w-6 shrink-0">
                    <AvatarImage src={p.avatar_url ?? undefined} />
                    <AvatarFallback className="text-[10px]">
                      {getInitials(p.full_name)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="w-28 shrink-0 text-xs text-foreground truncate">
                    {p.full_name}
                  </span>
                  <div className="flex-1 flex items-center gap-2">
                    <div className="flex-1 h-2 rounded-full bg-slate-100 dark:bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${(count / maxAssigneeCount) * 100}%`,
                          background: '#00c4a0',
                        }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground w-4 text-right shrink-0">
                      {count}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── List Tab ────────────────────────────────────────────────────────────────

function ListTab({ lists, tasks }: { lists: List[]; tasks: Task[] }) {
  // Build a list id → name lookup
  const listName = Object.fromEntries(lists.map((l) => [l.id, l.name]))

  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
        <BarChart2 className="h-10 w-10 mb-3 opacity-30" />
        <p className="text-sm font-medium">No tasks in this folder yet</p>
        <p className="text-xs mt-1 opacity-60">Tasks will appear here once lists have tasks</p>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="rounded-lg border border-border/60 overflow-hidden">
        {/* Header */}
        <div
          className="grid bg-slate-50/80 dark:bg-muted/30 border-b border-border/50 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide"
          style={{ gridTemplateColumns: '1fr 110px 90px 100px 140px 120px' }}
        >
          <div className="py-2 px-4">Title</div>
          <div className="py-2 px-3">Status</div>
          <div className="py-2 px-3">Priority</div>
          <div className="py-2 px-3">Due date</div>
          <div className="py-2 px-3">Assignees</div>
          <div className="py-2 px-3">List</div>
        </div>

        {/* Rows */}
        {tasks.map((task, idx) => {
          const dueFmt = formatDate(task.due_date)
          return (
            <div
              key={task.id}
              className={cn(
                'group grid items-center hover:bg-slate-50/60 dark:hover:bg-muted/20 transition-colors',
                idx < tasks.length - 1 && 'border-b border-border/40'
              )}
              style={{ gridTemplateColumns: '1fr 110px 90px 100px 140px 120px' }}
            >
              {/* Title */}
              <div className="py-2.5 px-4 min-w-0">
                <span className="text-sm font-medium text-foreground truncate block">
                  {task.title}
                </span>
              </div>

              {/* Status */}
              <div className="py-2.5 px-3">
                <Badge
                  variant="outline"
                  className={cn(
                    'text-[10px] px-1.5 py-0 h-4',
                    TASK_STATUS_STYLES[task.status] ?? ''
                  )}
                >
                  {TASK_STATUS_LABEL[task.status] ?? task.status}
                </Badge>
              </div>

              {/* Priority */}
              <div className="py-2.5 px-3">
                {task.priority ? (
                  <Badge
                    variant="outline"
                    className={cn(
                      'text-[10px] px-1.5 py-0 h-4 capitalize',
                      PRIORITY_STYLES[task.priority] ?? ''
                    )}
                  >
                    {task.priority}
                  </Badge>
                ) : (
                  <span className="text-xs text-muted-foreground">—</span>
                )}
              </div>

              {/* Due date */}
              <div className="py-2.5 px-3 text-xs text-muted-foreground">
                {dueFmt ?? '—'}
              </div>

              {/* Assignees */}
              <div className="py-2.5 px-3 flex items-center -space-x-1.5">
                {(task.assignees ?? []).length === 0 ? (
                  <span className="text-xs text-muted-foreground">—</span>
                ) : (
                  (task.assignees ?? []).slice(0, 4).map((a) => (
                    <Avatar key={a.id} className="h-5 w-5 border-2 border-background">
                      <AvatarImage src={a.avatar_url ?? undefined} />
                      <AvatarFallback className="text-[9px]">
                        {getInitials(a.full_name)}
                      </AvatarFallback>
                    </Avatar>
                  ))
                )}
                {(task.assignees ?? []).length > 4 && (
                  <span className="ml-2 text-[10px] text-muted-foreground">
                    +{(task.assignees ?? []).length - 4}
                  </span>
                )}
              </div>

              {/* List name */}
              <div className="py-2.5 px-3 min-w-0">
                <Link
                  href={`/lists/${task.list_id}`}
                  className="text-xs text-muted-foreground hover:text-blue-600 transition-colors truncate block"
                >
                  {listName[task.list_id] ?? '—'}
                </Link>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Owner Avatar ─────────────────────────────────────────────────────────────
// Shows a placeholder person icon — we don't have the profile object here,
// just the ID. A full implementation would join the profile in the query.

function OwnerAvatar({ userId }: { userId: string }) {
  if (!userId) return <User className="h-4 w-4 text-muted-foreground opacity-30" />
  return (
    <Avatar className="h-5 w-5">
      <AvatarFallback className="text-[9px] bg-slate-200 text-slate-600">
        {userId.slice(0, 2).toUpperCase()}
      </AvatarFallback>
    </Avatar>
  )
}
