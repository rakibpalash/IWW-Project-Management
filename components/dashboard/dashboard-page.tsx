'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import {
  CheckSquare,
  AlertTriangle,
  CalendarDays,
  Timer,
  LogIn,
  Activity,
  TrendingUp,
  Play,
  Square,
  ExternalLink,
  FolderKanban,
  ChevronDown,
  ChevronRight,
  Plus,
  Clock,
  Users,
  Hash,
} from 'lucide-react'
import { StatCard } from './stat-card'
import { CreateTaskDialog } from '@/components/tasks/create-task-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  cn,
  formatDate,
  formatMinutes,
  getStatusColor,
  getPriorityColor,
  timeAgo,
  formatStatus,
  getInitials,
} from '@/lib/utils'
import {
  Profile,
  List,
  Task,
  AttendanceRecord,
  LeaveBalance,
  ActivityLog,
} from '@/types'

export interface DashboardTimeEntry {
  id: string
  task_id: string
  task_title: string
  list_id: string
  list_name: string
  user_full_name: string
  user_avatar_url: string | null
  duration_minutes: number | null
  started_at: string
  is_running: boolean
}

interface DashboardPageProps {
  profile: Profile
  // Super admin
  totalLists?: number
  activeLists?: number
  overdueTasks?: number
  pendingLeaveRequests?: number
  todayAttendanceCount?: number
  totalStaff?: number
  recentActivity?: ActivityLog[]
  recentLists?: List[]
  recentTeamTimeEntries?: DashboardTimeEntry[]
  // Staff / Manager
  myTasks?: Task[]
  myAttendanceToday?: AttendanceRecord | null
  myLeaveBalance?: LeaveBalance | null
  timeTrackedTodayMinutes?: number
  myRecentTimeEntries?: DashboardTimeEntry[]
  // Client
  clientLists?: List[]
}

function getGreeting(name: string) {
  const h = new Date().getHours()
  const part = h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening'
  return `Good ${part}, ${name.split(' ')[0]}`
}

export function DashboardPage({
  profile,
  totalLists,
  activeLists,
  overdueTasks,
  pendingLeaveRequests,
  todayAttendanceCount,
  totalStaff,
  recentActivity,
  recentLists,
  recentTeamTimeEntries,
  myTasks,
  myAttendanceToday,
  myLeaveBalance,
  timeTrackedTodayMinutes,
  myRecentTimeEntries,
  clientLists,
}: DashboardPageProps) {
  const router = useRouter()
  const role = profile.role
  const firstName = (profile.full_name ?? 'there').split(' ')[0]

  return (
    <div className="page-inner">
      {/* ── SUPER ADMIN ── */}
      {role === 'super_admin' && (
        <SuperAdminDashboard
          profile={profile}
          totalLists={totalLists ?? 0}
          activeLists={activeLists ?? 0}
          overdueTasks={overdueTasks ?? 0}
          pendingLeaveRequests={pendingLeaveRequests ?? 0}
          todayAttendanceCount={todayAttendanceCount ?? 0}
          totalStaff={totalStaff ?? 0}
          recentActivity={recentActivity ?? []}
          recentLists={recentLists ?? []}
          recentTeamTimeEntries={recentTeamTimeEntries ?? []}
          router={router}
        />
      )}

      {/* ── STAFF / MANAGER ── */}
      {(role === 'staff' || role === 'account_manager' || role === 'project_manager') && (
        <StaffDashboard
          profile={profile}
          firstName={firstName}
          myTasks={myTasks ?? []}
          myAttendanceToday={myAttendanceToday ?? null}
          myLeaveBalance={myLeaveBalance ?? null}
          timeTrackedTodayMinutes={timeTrackedTodayMinutes ?? 0}
          myRecentTimeEntries={myRecentTimeEntries ?? []}
          router={router}
        />
      )}

      {/* ── CLIENT ── */}
      {role === 'client' && (
        <>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{getGreeting(profile.full_name ?? 'there')}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>
          <div data-tour="dashboard-stats" className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard title="Total Lists" value={clientLists?.length ?? 0} icon={FolderKanban} variant="blue" />
            <StatCard title="In Progress" value={clientLists?.filter(p => p.status === 'in_progress').length ?? 0} icon={TrendingUp} variant="green" />
            <StatCard title="Completed" value={clientLists?.filter(p => p.status === 'completed').length ?? 0} icon={CheckSquare} variant="purple" />
          </div>
          <ClientListsList lists={clientLists ?? []} router={router} />
        </>
      )}
    </div>
  )
}

// ─── Super Admin Dashboard ─────────────────────────────────────────────────────

function SuperAdminDashboard({
  profile,
  totalLists,
  activeLists,
  overdueTasks,
  pendingLeaveRequests,
  todayAttendanceCount,
  totalStaff,
  recentActivity,
  recentLists,
  recentTeamTimeEntries,
  router,
}: {
  profile: Profile
  totalLists: number
  activeLists: number
  overdueTasks: number
  pendingLeaveRequests: number
  todayAttendanceCount: number
  totalStaff: number
  recentActivity: ActivityLog[]
  recentLists: List[]
  recentTeamTimeEntries: DashboardTimeEntry[]
  router: ReturnType<typeof useRouter>
}) {
  return (
    <>
      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          {getGreeting(profile.full_name ?? 'there')}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* Recents */}
      {recentLists.length > 0 && (
        <RecentsStrip items={recentLists.map(p => ({ id: p.id, name: p.name, subtitle: formatStatus(p.status), href: `/lists/${p.id}`, type: 'list' as const }))} router={router} />
      )}

      {/* Stats */}
      <div data-tour="dashboard-stats" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard title="Total Lists"  value={totalLists}        icon={FolderKanban}  variant="blue"    />
        <StatCard title="Active"          value={activeLists}       icon={TrendingUp}    variant="green"   />
        <StatCard title="Overdue Tasks"   value={overdueTasks}         icon={AlertTriangle} variant="red"     />
        <StatCard title="Pending Leaves"  value={pendingLeaveRequests} icon={CalendarDays}  variant="yellow"  />
        <StatCard title="Present Today"   value={todayAttendanceCount} subtitle={`of ${totalStaff} staff`} icon={Users} variant="purple" />
        <StatCard title="Activity (24h)"  value={recentActivity.length} icon={Activity}     variant="default" />
      </div>

      {/* Quick actions */}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={() => router.push('/spaces')} className="gap-2 h-8 text-xs">
          <Plus className="h-3.5 w-3.5" /> New Space
        </Button>
      </div>

      {/* Two-col content */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_340px]">
        {/* Left */}
        <div className="space-y-5">
          <RecentListsCard lists={recentLists} router={router} />
          <ActivityFeedCard activities={recentActivity} />
        </div>
        {/* Right */}
        <div className="space-y-5">
          <TimeLogWidget entries={recentTeamTimeEntries} title="Team Time Logs" showUser router={router} />
        </div>
      </div>
    </>
  )
}

// ─── Staff Dashboard ───────────────────────────────────────────────────────────

type WorkTab = 'todo' | 'done' | 'delegated'

function StaffDashboard({
  profile,
  firstName,
  myTasks,
  myAttendanceToday,
  myLeaveBalance,
  timeTrackedTodayMinutes,
  myRecentTimeEntries,
  router,
}: {
  profile: Profile
  firstName: string
  myTasks: Task[]
  myAttendanceToday: AttendanceRecord | null
  myLeaveBalance: LeaveBalance | null
  timeTrackedTodayMinutes: number
  myRecentTimeEntries: DashboardTimeEntry[]
  router: ReturnType<typeof useRouter>
}) {
  const [activeTab, setActiveTab] = useState<WorkTab>('todo')
  const [showCreateTask, setShowCreateTask] = useState(false)
  const [localTasks, setLocalTasks] = useState<Task[]>(myTasks)

  // Derive unique lists from tasks for the create dialog
  const availableLists = Array.from(
    new Map(
      localTasks
        .filter(t => t.list_id && t.list?.name)
        .map(t => [t.list_id, { id: t.list_id, name: t.list!.name } as any])
    ).values()
  )

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const todayTasks = localTasks.filter(t => {
    if (!t.due_date || t.status === 'done' || t.status === 'cancelled') return false
    const d = new Date(t.due_date + 'T00:00:00')
    return d.getTime() === today.getTime()
  })

  const overdueTasks = localTasks.filter(t => {
    if (!t.due_date || t.status === 'done' || t.status === 'cancelled') return false
    const d = new Date(t.due_date + 'T00:00:00')
    return d < today
  })

  const nextTasks = localTasks.filter(t => {
    if (!t.due_date || t.status === 'done' || t.status === 'cancelled') return false
    const d = new Date(t.due_date + 'T00:00:00')
    const next7 = new Date(today); next7.setDate(today.getDate() + 7)
    return d > today && d <= next7
  })

  const unscheduledTasks = localTasks.filter(t =>
    !t.due_date && t.status !== 'done' && t.status !== 'cancelled'
  )

  const doneTasks = localTasks.filter(t => t.status === 'done')

  // Assigned to me — open tasks sorted by priority
  const assignedTasks = localTasks
    .filter(t => t.status !== 'done' && t.status !== 'cancelled')
    .slice(0, 5)

  return (
    <>
      {/* Greeting */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{getGreeting(profile.full_name ?? 'there')}</h1>
        </div>
        {/* Manage cards stub */}
        <Button variant="outline" size="sm" className="h-8 text-xs shrink-0">
          Manage cards
        </Button>
      </div>

      {/* Recents strip */}
      <RecentsStrip
        items={myTasks.slice(0, 6).map(t => ({
          id: t.id,
          name: t.title,
          subtitle: t.list?.name ?? '',
          href: `/lists/${t.list_id}/tasks/${t.id}`,
          type: 'task' as const,
        }))}
        router={router}
      />

      {/* Two-column: My Work + Right Panel */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_320px]">

        {/* ── Left: My Work ── */}
        <div className="rounded-xl border border-border bg-card shadow-sm">
          {/* Card header */}
          <div className="flex items-center justify-between border-b border-border/60 px-5 py-3.5">
            <h2 className="text-[15px] font-semibold text-foreground">My Work</h2>
            {/* Tabs */}
            <div className="flex items-center gap-0.5 rounded-lg bg-muted/60 p-0.5 text-xs">
              {(['todo', 'done', 'delegated'] as WorkTab[]).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={cn(
                    'rounded-md px-3 py-1 font-medium capitalize transition-colors',
                    activeTab === tab
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {tab === 'todo' ? 'To Do' : tab === 'done' ? 'Done' : 'Delegated'}
                </button>
              ))}
            </div>
          </div>

          {/* Tab content */}
          <div className="divide-y divide-border/50">
            {activeTab === 'todo' && (
              <>
                <TaskGroup label="Today"       color="#f97316" tasks={todayTasks}       router={router} defaultOpen                          onAddTask={() => setShowCreateTask(true)} />
                <TaskGroup label="Next"        color="#3b82f6" tasks={nextTasks}        router={router} defaultOpen={nextTasks.length > 0}       onAddTask={() => setShowCreateTask(true)} />
                <TaskGroup label="Overdue"     color="#ef4444" tasks={overdueTasks}     router={router} defaultOpen={overdueTasks.length > 0}    onAddTask={() => setShowCreateTask(true)} />
                <TaskGroup label="Unscheduled" color="#94a3b8" tasks={unscheduledTasks} router={router} defaultOpen={false}                      onAddTask={() => setShowCreateTask(true)} />
              </>
            )}
            {activeTab === 'done' && (
              <TaskGroup label="Completed" color="#22c55e" tasks={doneTasks} router={router} defaultOpen onAddTask={() => setShowCreateTask(true)} />
            )}
            {activeTab === 'delegated' && (
              <div className="flex flex-col items-center gap-2 py-12 text-center">
                <CheckSquare className="h-8 w-8 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground/60">No delegated tasks</p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-border/50 px-5 py-3">
            <button
              onClick={() => router.push('/tasks')}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              View all tasks
            </button>
          </div>
        </div>

        {/* ── Right panel ── */}
        <div className="flex flex-col gap-5">

          {/* Assigned to me */}
          <AssignedToMePanel tasks={assignedTasks} router={router} onAddTask={() => setShowCreateTask(true)} />

          {/* Attendance quick info */}
          {myAttendanceToday && (
            <div className="rounded-xl border border-border bg-card shadow-sm p-4 space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Today&apos;s Attendance</p>
              <div className="flex flex-wrap gap-4 text-sm">
                <div className="flex items-center gap-1.5">
                  <LogIn className="h-3.5 w-3.5 text-muted-foreground/60" />
                  <span className="text-muted-foreground">In: <span className="font-semibold text-foreground">{myAttendanceToday.check_in_time?.slice(0,5) ?? '—'}</span></span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-muted-foreground/60" />
                  <span className="text-muted-foreground">Out: <span className="font-semibold text-foreground">{myAttendanceToday.check_out_time?.slice(0,5) ?? '—'}</span></span>
                </div>
              </div>
            </div>
          )}

          {/* Time tracked today */}
          <div className="rounded-xl border border-border bg-card shadow-sm p-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-50">
                <Timer className="h-4 w-4 text-green-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Time Tracked Today</p>
                <p className="text-sm font-bold text-foreground">{timeTrackedTodayMinutes ? formatMinutes(timeTrackedTodayMinutes) : '0m'}</p>
              </div>
            </div>
            <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => router.push('/timesheet')}>
              Log time
            </Button>
          </div>
        </div>
      </div>

      {/* Create Task Modal */}
      <CreateTaskDialog
        open={showCreateTask}
        onOpenChange={setShowCreateTask}
        lists={availableLists}
        profile={profile}
        onCreated={task => setLocalTasks(prev => [task, ...prev])}
      />
    </>
  )
}

// ─── Recents Strip ─────────────────────────────────────────────────────────────

function RecentsStrip({
  items,
  router,
}: {
  items: { id: string; name: string; subtitle: string; href: string; type: 'list' | 'task' }[]
  router: ReturnType<typeof useRouter>
}) {
  if (items.length === 0) return null
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">Recents</p>
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {items.map(item => (
          <button
            key={item.id}
            onClick={() => router.push(item.href)}
            className="flex shrink-0 items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-left hover:bg-muted/40 hover:border-border/80 transition-colors max-w-[200px]"
          >
            <div className={cn(
              'flex h-5 w-5 shrink-0 items-center justify-center rounded',
              item.type === 'list' ? 'bg-violet-100' : 'bg-blue-100',
            )}>
              {item.type === 'list'
                ? <Hash className="h-3 w-3 text-violet-600" />
                : <CheckSquare className="h-3 w-3 text-blue-600" />
              }
            </div>
            <div className="min-w-0">
              <p className="truncate text-[13px] font-medium text-foreground leading-tight">{item.name}</p>
              {item.subtitle && (
                <p className="truncate text-[11px] text-muted-foreground/70 leading-tight">{item.subtitle}</p>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── Task Group ────────────────────────────────────────────────────────────────

function TaskGroup({
  label,
  color,
  tasks,
  router,
  defaultOpen,
  onAddTask,
}: {
  label: string
  color: string
  tasks: Task[]
  router: ReturnType<typeof useRouter>
  defaultOpen: boolean
  onAddTask: () => void
}) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div>
      {/* Group header */}
      <button
        onClick={() => setOpen(o => !o)}
        className="flex w-full items-center gap-2 px-5 py-2.5 hover:bg-muted/20 transition-colors select-none"
      >
        <span className="text-muted-foreground">
          {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        </span>
        <span className="text-[13px] font-semibold" style={{ color }}>{label}</span>
        <span
          className="ml-1 rounded-full px-1.5 py-0.5 text-[11px] font-semibold min-w-[20px] text-center"
          style={{ backgroundColor: color + '20', color }}
        >
          {tasks.length}
        </span>
      </button>

      {/* Task rows */}
      {open && (
        <div>
          {tasks.length === 0 ? (
            <p className="px-12 py-2 text-xs text-muted-foreground/50 italic">No tasks</p>
          ) : (
            tasks.map(task => (
              <WorkTaskRow key={task.id} task={task} color={color} router={router} />
            ))
          )}
          {/* Add task */}
          <button
            onClick={onAddTask}
            className="flex items-center gap-2 px-12 py-2 text-xs text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted/10 transition-colors w-full"
          >
            <Plus className="h-3.5 w-3.5" /> Add Task
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Work Task Row ─────────────────────────────────────────────────────────────

function WorkTaskRow({ task, color, router }: { task: Task; color: string; router: ReturnType<typeof useRouter> }) {
  return (
    <div
      className="group flex items-center gap-3 px-5 py-2 hover:bg-muted/20 transition-colors cursor-pointer"
      style={{ borderLeft: `2px solid ${color}40` }}
      onClick={() => router.push(`/lists/${task.list_id}/tasks/${task.id}`)}
    >
      {/* Status dot */}
      <div
        className="h-2.5 w-2.5 shrink-0 rounded-full border-2"
        style={{ borderColor: color, backgroundColor: task.status === 'done' ? color : 'transparent' }}
      />

      {/* Title */}
      <p className="flex-1 min-w-0 truncate text-[13px] font-medium text-foreground group-hover:text-foreground/90">
        {task.title}
      </p>

      {/* Tags */}
      <div className="flex items-center gap-1.5 shrink-0">
        {task.list?.name && (
          <span className="rounded px-1.5 py-0.5 text-[11px] font-medium bg-violet-50 text-violet-700 border border-violet-100">
            {task.list.name}
          </span>
        )}
        <StatusChip status={task.status} />
        {task.due_date && (
          <span className="text-[11px] text-muted-foreground/60">{formatDate(task.due_date)}</span>
        )}
        <PriorityDot priority={task.priority} />
      </div>
    </div>
  )
}

// ─── Assigned to Me Panel ──────────────────────────────────────────────────────

function AssignedToMePanel({
  tasks,
  router,
  onAddTask,
}: {
  tasks: Task[]
  router: ReturnType<typeof useRouter>
  onAddTask: () => void
}) {
  return (
    <div className="rounded-xl border border-border bg-card shadow-sm">
      <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground/60" />
          <span className="text-[13px] font-semibold text-foreground">Assigned to me</span>
        </div>
        <div className="flex items-center gap-1 text-muted-foreground/40">
          {/* filter/sort icons placeholder */}
          <span className="text-[10px] font-medium">Priority</span>
        </div>
      </div>

      {tasks.length === 0 ? (
        <div className="px-4 py-8 text-center">
          <CheckSquare className="h-7 w-7 text-muted-foreground/20 mx-auto mb-2" />
          <p className="text-xs text-muted-foreground/50">No tasks assigned</p>
        </div>
      ) : (
        <div className="divide-y divide-border/40">
          {tasks.map(task => (
            <div
              key={task.id}
              className="group flex cursor-pointer items-start gap-3 px-4 py-3 hover:bg-muted/20 transition-colors"
              onClick={() => router.push(`/lists/${task.list_id}/tasks/${task.id}`)}
            >
              <StatusChip status={task.status} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium text-foreground leading-snug">{task.title}</p>
                {task.list?.name && (
                  <p className="mt-0.5 truncate text-[11px] text-muted-foreground/60">{task.list.name}</p>
                )}
              </div>
              <PriorityDot priority={task.priority} />
            </div>
          ))}
        </div>
      )}

      <div className="border-t border-border/50 px-4 py-2">
        <button
          onClick={onAddTask}
          className="text-xs text-muted-foreground/60 hover:text-foreground transition-colors"
        >
          + Add Task
        </button>
      </div>
    </div>
  )
}

// ─── Status Chip ──────────────────────────────────────────────────────────────

const STATUS_CHIP_STYLES: Record<string, string> = {
  done:        'bg-green-100 text-green-700 border-green-200',
  in_progress: 'bg-violet-100 text-violet-700 border-violet-200',
  review:      'bg-blue-100 text-blue-700 border-blue-200',
  todo:        'bg-slate-100 text-slate-600 border-slate-200',
  cancelled:   'bg-red-50 text-red-500 border-red-100',
}
const STATUS_LABELS: Record<string, string> = {
  done:        'Done',
  in_progress: 'In Progress',
  review:      'Review',
  todo:        'To Do',
  cancelled:   'Cancelled',
}

function StatusChip({ status }: { status: string }) {
  const style = STATUS_CHIP_STYLES[status] ?? 'bg-slate-100 text-slate-600 border-slate-200'
  const label = STATUS_LABELS[status] ?? formatStatus(status)
  return (
    <span className={cn('shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide', style)}>
      {label}
    </span>
  )
}

// ─── Priority Dot ─────────────────────────────────────────────────────────────

const PRIORITY_DOT: Record<string, string> = {
  urgent: 'bg-red-500',
  high:   'bg-orange-400',
  medium: 'bg-yellow-400',
  low:    'bg-blue-400',
}

function PriorityDot({ priority }: { priority: string }) {
  const color = PRIORITY_DOT[priority] ?? 'bg-slate-400'
  return (
    <span title={priority} className={cn('h-2 w-2 shrink-0 rounded-full', color)} />
  )
}

// ─── Recent Lists Card ─────────────────────────────────────────────────────

function RecentListsCard({ lists, router }: { lists: List[]; router: ReturnType<typeof useRouter> }) {
  return (
    <div className="rounded-xl border border-border bg-card shadow-sm">
      <div className="flex items-center justify-between border-b border-border/60 px-5 py-4">
        <h3 className="text-[14px] font-semibold text-foreground">Recent Lists</h3>
        <Button variant="ghost" size="sm" className="text-xs text-muted-foreground h-7" onClick={() => router.push('/lists')}>View all</Button>
      </div>
      {lists.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-muted-foreground/70">No lists yet</p>
      ) : (
        <ul className="divide-y divide-border/40">
          {lists.slice(0, 5).map(list => (
            <li
              key={list.id}
              className="flex cursor-pointer items-center justify-between gap-4 px-5 py-3 transition-colors hover:bg-muted/30"
              onClick={() => router.push(`/lists/${list.id}`)}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium text-foreground">{list.name}</p>
                <div className="mt-1 flex items-center gap-2">
                  <Progress value={list.progress} className="h-1.5 w-20" />
                  <span className="text-[11px] text-muted-foreground/70">{list.progress}%</span>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <StatusChip status={list.status} />
                {list.due_date && (
                  <span className="text-[11px] text-muted-foreground/70">{formatDate(list.due_date)}</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ─── Activity Feed Card ───────────────────────────────────────────────────────

function ActivityFeedCard({ activities }: { activities: ActivityLog[] }) {
  return (
    <div className="rounded-xl border border-border bg-card shadow-sm">
      <div className="border-b border-border/60 px-5 py-4">
        <h3 className="text-[14px] font-semibold text-foreground">Recent Activity</h3>
      </div>
      {activities.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-muted-foreground/70">No recent activity</p>
      ) : (
        <ul className="divide-y divide-border/40">
          {activities.slice(0, 5).map(log => (
            <li key={log.id} className="flex items-start gap-3 px-5 py-3">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-50 text-[11px] font-bold text-blue-600">
                {log.user?.full_name?.charAt(0) ?? '?'}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] text-foreground/80">
                  <span className="font-medium">{log.user?.full_name ?? 'Someone'}</span>{' '}{log.action}
                </p>
                {(log.old_value || log.new_value) && (
                  <p className="mt-0.5 text-[11px] text-muted-foreground/70 truncate">
                    {log.old_value && <span className="line-through mr-1">{log.old_value}</span>}
                    {log.new_value && <span>{log.new_value}</span>}
                  </p>
                )}
                <p className="mt-0.5 text-[11px] text-muted-foreground/60">{timeAgo(log.created_at)}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ─── Time Log Widget ──────────────────────────────────────────────────────────

const avatarColors = [
  'bg-pink-500','bg-purple-500','bg-indigo-500','bg-blue-500',
  'bg-cyan-500','bg-teal-500','bg-green-500','bg-orange-500',
]
function getAvatarColor(name: string) {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return avatarColors[Math.abs(hash) % avatarColors.length]
}

function formatDuration(minutes: number | null): string {
  const m = Math.max(0, minutes ?? 0)
  const h = Math.floor(m / 60)
  const min = m % 60
  if (h === 0 && min === 0) return '0m'
  if (h === 0) return `${min}m`
  if (min === 0) return `${h}h`
  return `${h}h ${min}m`
}

function formatTimer(startedAt: string, tick: number): string {
  const elapsed = Math.max(0, Math.floor((tick - new Date(startedAt).getTime()) / 1000))
  const h = Math.floor(elapsed / 3600)
  const m = Math.floor((elapsed % 3600) / 60)
  const s = elapsed % 60
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
}

function TimeLogWidget({
  entries,
  title,
  showUser,
  router,
}: {
  entries: DashboardTimeEntry[]
  title: string
  showUser: boolean
  router: ReturnType<typeof useRouter>
}) {
  const [tick, setTick] = useState(Date.now())
  const hasRunning = entries.some(e => e.is_running)

  useEffect(() => {
    if (!hasRunning) return
    const id = setInterval(() => setTick(Date.now()), 1000)
    return () => clearInterval(id)
  }, [hasRunning])

  const running = entries.find(e => e.is_running)
  const past    = entries.filter(e => !e.is_running).slice(0, 6)

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm">
      <div className="flex items-center justify-between border-b border-border/60 px-5 py-3.5">
        <div className="flex items-center gap-2">
          <Timer className="h-4 w-4 text-muted-foreground/60" />
          <h3 className="text-[14px] font-semibold text-foreground">{title}</h3>
          {hasRunning && (
            <span className="flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-[11px] font-medium text-green-700">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />Live
            </span>
          )}
        </div>
        <Button variant="ghost" size="sm" className="gap-1 text-xs text-muted-foreground h-7" onClick={() => router.push('/timesheet')}>
          View all <ExternalLink className="h-3 w-3" />
        </Button>
      </div>

      {entries.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-5 py-8 text-center">
          <Timer className="h-8 w-8 text-muted-foreground/20" />
          <p className="text-sm text-muted-foreground/60">No time logged yet</p>
        </div>
      ) : (
        <ul className="divide-y divide-border/40">
          {running && (
            <li className="flex items-center gap-3 bg-green-50/50 px-5 py-3">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-green-100">
                <Play className="h-3 w-3 fill-green-600 text-green-600" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium text-foreground">{running.task_title}</p>
                <p className="truncate text-[11px] text-muted-foreground/60">
                  {running.list_name}{showUser && ` · ${running.user_full_name}`}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="font-mono text-[13px] font-semibold text-green-600">{formatTimer(running.started_at, tick)}</p>
                <p className="text-[10px] text-muted-foreground/60">Running</p>
              </div>
            </li>
          )}
          {past.map(entry => (
            <li key={entry.id} className="flex items-center gap-3 px-5 py-3 hover:bg-muted/20 transition-colors">
              {showUser ? (
                <Avatar className="h-7 w-7 shrink-0">
                  <AvatarImage src={entry.user_avatar_url ?? undefined} />
                  <AvatarFallback className={`text-[9px] font-bold text-white ${getAvatarColor(entry.user_full_name)}`}>
                    {getInitials(entry.user_full_name)}
                  </AvatarFallback>
                </Avatar>
              ) : (
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted">
                  <Square className="h-3 w-3 text-muted-foreground/60" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium text-foreground">{entry.task_title}</p>
                <p className="truncate text-[11px] text-muted-foreground/60">
                  {entry.list_name}{showUser && ` · ${entry.user_full_name}`}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <span className="rounded bg-orange-500 px-2 py-0.5 font-mono text-[11px] font-semibold text-white">
                  {formatDuration(entry.duration_minutes)}
                </span>
                <p className="mt-0.5 text-[10px] text-muted-foreground/60">{timeAgo(entry.started_at)}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ─── Client Lists List ─────────────────────────────────────────────────────

function ClientListsList({ lists, router }: { lists: List[]; router: ReturnType<typeof useRouter> }) {
  return (
    <div className="rounded-xl border border-border bg-card shadow-sm">
      <div className="border-b border-border/60 px-5 py-4">
        <h3 className="text-[14px] font-semibold text-foreground">Your Lists</h3>
      </div>
      {lists.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-muted-foreground/70">No lists assigned</p>
      ) : (
        <ul className="divide-y divide-border/40">
          {lists.map(list => (
            <li
              key={list.id}
              className="flex cursor-pointer items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-muted/30"
              onClick={() => router.push(`/lists/${list.id}`)}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-foreground">{list.name}</p>
                {list.description && (
                  <p className="mt-0.5 truncate text-sm text-muted-foreground">{list.description}</p>
                )}
                <div className="mt-2 flex items-center gap-2">
                  <Progress value={list.progress} className="h-1.5 w-32" />
                  <span className="text-[11px] text-muted-foreground/70">{list.progress}% complete</span>
                </div>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <StatusChip status={list.status} />
                {list.due_date && (
                  <span className="text-[11px] text-muted-foreground/70">Due {formatDate(list.due_date)}</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
