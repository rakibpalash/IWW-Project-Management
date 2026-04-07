'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import {
  FolderKanban,
  CheckSquare,
  AlertTriangle,
  Clock,
  Users,
  CalendarDays,
  Plus,
  Timer,
  LogIn,
  Activity,
  TrendingUp,
  Play,
  Square,
  ExternalLink,
} from 'lucide-react'
import { StatCard } from './stat-card'
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
  Project,
  Task,
  AttendanceRecord,
  LeaveBalance,
  ActivityLog,
} from '@/types'

export interface DashboardTimeEntry {
  id: string
  task_id: string
  task_title: string
  project_id: string
  project_name: string
  user_full_name: string
  user_avatar_url: string | null
  duration_minutes: number | null
  started_at: string
  is_running: boolean
}

interface DashboardPageProps {
  profile: Profile
  // Super admin
  totalProjects?: number
  activeProjects?: number
  overdueTasks?: number
  pendingLeaveRequests?: number
  todayAttendanceCount?: number
  totalStaff?: number
  recentActivity?: ActivityLog[]
  recentProjects?: Project[]
  recentTeamTimeEntries?: DashboardTimeEntry[]
  // Staff / Manager
  myTasks?: Task[]
  myAttendanceToday?: AttendanceRecord | null
  myLeaveBalance?: LeaveBalance | null
  timeTrackedTodayMinutes?: number
  myRecentTimeEntries?: DashboardTimeEntry[]
  // Client
  clientProjects?: Project[]
}

export function DashboardPage({
  profile,
  totalProjects,
  activeProjects,
  overdueTasks,
  pendingLeaveRequests,
  todayAttendanceCount,
  totalStaff,
  recentActivity,
  recentProjects,
  recentTeamTimeEntries,
  myTasks,
  myAttendanceToday,
  myLeaveBalance,
  timeTrackedTodayMinutes,
  myRecentTimeEntries,
  clientProjects,
}: DashboardPageProps) {
  const router = useRouter()
  const role = profile.role

  return (
    <div className="page-inner">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          Welcome back, {(profile.full_name ?? 'there').split(' ')[0]}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {new Date().toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </p>
      </div>

      {/* ── SUPER ADMIN ── */}
      {role === 'super_admin' && (
        <>
          {/* Stats row */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6">
            <StatCard
              title="Total Projects"
              value={totalProjects ?? 0}
              icon={FolderKanban}
              variant="blue"
            />
            <StatCard
              title="Active Projects"
              value={activeProjects ?? 0}
              icon={TrendingUp}
              variant="green"
            />
            <StatCard
              title="Overdue Tasks"
              value={overdueTasks ?? 0}
              icon={AlertTriangle}
              variant="red"
            />
            <StatCard
              title="Pending Leaves"
              value={pendingLeaveRequests ?? 0}
              icon={CalendarDays}
              variant="yellow"
            />
            <StatCard
              title="Present Today"
              value={todayAttendanceCount ?? 0}
              subtitle={`of ${totalStaff ?? 0} staff`}
              icon={Users}
              variant="purple"
            />
            <StatCard
              title="Activity (24h)"
              value={recentActivity?.length ?? 0}
              icon={Activity}
              variant="default"
            />
          </div>

          {/* Quick actions */}
          <QuickActions role={role} router={router} />

          {/* Content grid */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <RecentProjectsList projects={recentProjects ?? []} />
            <ActivityFeed activities={recentActivity ?? []} />
          </div>

          {/* Team time log */}
          <TimeLogWidget
            entries={recentTeamTimeEntries ?? []}
            title="Team Time Logs"
            showUser
          />
        </>
      )}

      {/* ── STAFF ── */}
      {(role === 'staff' || role === 'account_manager' || role === 'project_manager') && (
        <>
          {/* Stats row */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              title="My Open Tasks"
              value={myTasks?.filter((t) => t.status !== 'done' && t.status !== 'cancelled').length ?? 0}
              icon={CheckSquare}
              variant="blue"
            />
            <StatCard
              title="Overdue Tasks"
              value={
                myTasks?.filter(
                  (t) =>
                    t.due_date &&
                    new Date() > new Date(t.due_date) &&
                    t.status !== 'done' &&
                    t.status !== 'cancelled'
                ).length ?? 0
              }
              icon={AlertTriangle}
              variant="red"
            />
            <StatCard
              title="Time Tracked Today"
              value={timeTrackedTodayMinutes ? formatMinutes(timeTrackedTodayMinutes) : '0m'}
              icon={Timer}
              variant="green"
            />
            <StatCard
              title="Leave Remaining"
              value={
                myLeaveBalance
                  ? `${myLeaveBalance.yearly_total - myLeaveBalance.yearly_used}d`
                  : '—'
              }
              subtitle="Yearly leave"
              icon={CalendarDays}
              variant="purple"
            />
          </div>

          {/* Today attendance */}
          {myAttendanceToday && (
            <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-foreground/80">Today&apos;s Attendance</h3>
              <div className="mt-3 flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <LogIn className="h-4 w-4 text-muted-foreground/70" />
                  <span className="text-sm text-muted-foreground">
                    Check-in:{' '}
                    <span className="font-medium">
                      {myAttendanceToday.check_in_time
                        ? myAttendanceToday.check_in_time.slice(0, 5)
                        : '—'}
                    </span>
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground/70" />
                  <span className="text-sm text-muted-foreground">
                    Check-out:{' '}
                    <span className="font-medium">
                      {myAttendanceToday.check_out_time
                        ? myAttendanceToday.check_out_time.slice(0, 5)
                        : '—'}
                    </span>
                  </span>
                </div>
                <Badge
                  variant="outline"
                  className={cn('capitalize', getStatusColor(myAttendanceToday.status))}
                >
                  {formatStatus(myAttendanceToday.status)}
                </Badge>
              </div>
            </div>
          )}

          {/* Quick actions */}
          <QuickActions role={role} router={router} />

          {/* Time logs + tasks in 2-col grid */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <TimeLogWidget
              entries={myRecentTimeEntries ?? []}
              title="My Time Logs"
              showUser={false}
            />
            <div />
          </div>

          {/* My tasks */}
          <MyTasksList tasks={myTasks ?? []} />
        </>
      )}

      {/* ── CLIENT ── */}
      {role === 'client' && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard
              title="Total Projects"
              value={clientProjects?.length ?? 0}
              icon={FolderKanban}
              variant="blue"
            />
            <StatCard
              title="In Progress"
              value={
                clientProjects?.filter((p) => p.status === 'in_progress').length ?? 0
              }
              icon={TrendingUp}
              variant="green"
            />
            <StatCard
              title="Completed"
              value={clientProjects?.filter((p) => p.status === 'completed').length ?? 0}
              icon={CheckSquare}
              variant="purple"
            />
          </div>
          <ClientProjectsList projects={clientProjects ?? []} />
        </>
      )}
    </div>
  )
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function QuickActions({
  role,
  router,
}: {
  role: string
  router: ReturnType<typeof useRouter>
}) {
  return (
    <div className="flex flex-wrap gap-3">
      {role === 'super_admin' && (
        <Button
          size="sm"
          onClick={() => router.push('/projects')}
          className="gap-2"
        >
          <Plus className="h-4 w-4" />
          New Project
        </Button>
      )}
      {(role === 'staff' || role === 'account_manager' || role === 'project_manager') && (
        <>
          <Button
            size="sm"
            variant="outline"
            onClick={() => router.push('/attendance')}
            className="gap-2"
          >
            <LogIn className="h-4 w-4" />
            Check In
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => router.push('/tasks')}
            className="gap-2"
          >
            <Timer className="h-4 w-4" />
            Log Time
          </Button>
        </>
      )}
    </div>
  )
}

function RecentProjectsList({ projects }: { projects: Project[] }) {
  const router = useRouter()

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm">
      <div className="flex items-center justify-between border-b border-border/60 px-5 py-4">
        <h3 className="font-semibold text-foreground">Recent Projects</h3>
        <Button
          variant="ghost"
          size="sm"
          className="text-xs text-muted-foreground"
          onClick={() => router.push('/projects')}
        >
          View all
        </Button>
      </div>
      {projects.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-muted-foreground/70">No projects yet</p>
      ) : (
        <ul className="divide-y divide-gray-50">
          {projects.slice(0, 5).map((project) => (
            <li
              key={project.id}
              className="flex cursor-pointer items-center justify-between gap-4 px-5 py-3 transition-colors hover:bg-muted/30"
              onClick={() => router.push(`/projects/${project.id}`)}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{project.name}</p>
                <div className="mt-1 flex items-center gap-2">
                  <Progress value={project.progress} className="h-1.5 w-20" />
                  <span className="text-xs text-muted-foreground/70">{project.progress}%</span>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Badge
                  variant="outline"
                  className={cn('text-xs capitalize', getStatusColor(project.status))}
                >
                  {formatStatus(project.status)}
                </Badge>
                {project.due_date && (
                  <span className="text-xs text-muted-foreground/70">{formatDate(project.due_date)}</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function ActivityFeed({ activities }: { activities: ActivityLog[] }) {
  return (
    <div className="rounded-xl border border-border bg-card shadow-sm">
      <div className="border-b border-border/60 px-5 py-4">
        <h3 className="font-semibold text-foreground">Recent Activity</h3>
      </div>
      {activities.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-muted-foreground/70">No recent activity</p>
      ) : (
        <ul className="divide-y divide-gray-50">
          {activities.slice(0, 5).map((log) => (
            <li key={log.id} className="flex items-start gap-3 px-5 py-3">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-50 text-xs font-semibold text-blue-600">
                {log.user?.full_name?.charAt(0) ?? '?'}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-foreground/80">
                  <span className="font-medium">{log.user?.full_name ?? 'Someone'}</span>{' '}
                  {log.action}
                </p>
                {(log.old_value || log.new_value) && (
                  <p className="mt-0.5 text-xs text-muted-foreground/70 truncate">
                    {log.old_value && <span className="line-through mr-1">{log.old_value}</span>}
                    {log.new_value && <span>{log.new_value}</span>}
                  </p>
                )}
                <p className="mt-0.5 text-xs text-muted-foreground/70">{timeAgo(log.created_at)}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function MyTasksList({ tasks }: { tasks: Task[] }) {
  const router = useRouter()
  const overdueTasks = tasks.filter(
    (t) =>
      t.due_date &&
      new Date() > new Date(t.due_date) &&
      t.status !== 'done' &&
      t.status !== 'cancelled'
  )
  const activeTasks = tasks.filter(
    (t) =>
      t.status !== 'done' &&
      t.status !== 'cancelled' &&
      !(t.due_date && new Date() > new Date(t.due_date))
  )

  return (
    <div className="space-y-4">
      {overdueTasks.length > 0 && (
        <div className="rounded-xl border border-red-100 bg-card shadow-sm">
          <div className="flex items-center gap-2 border-b border-red-100 px-5 py-4">
            <AlertTriangle className="h-4 w-4 text-red-500" />
            <h3 className="font-semibold text-red-700">Overdue Tasks ({overdueTasks.length})</h3>
          </div>
          <ul className="divide-y divide-gray-50">
            {overdueTasks.map((task) => (
              <TaskRow key={task.id} task={task} onClick={() => router.push(`/projects/${task.project_id}/tasks/${task.id}`)} />
            ))}
          </ul>
        </div>
      )}

      <div className="rounded-xl border border-border bg-card shadow-sm">
        <div className="flex items-center justify-between border-b border-border/60 px-5 py-4">
          <h3 className="font-semibold text-foreground">My Tasks</h3>
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-muted-foreground"
            onClick={() => router.push('/tasks')}
          >
            View all
          </Button>
        </div>
        {activeTasks.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-muted-foreground/70">No open tasks</p>
        ) : (
          <ul className="divide-y divide-gray-50">
            {activeTasks.slice(0, 8).map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                onClick={() => router.push(`/projects/${task.project_id}/tasks/${task.id}`)}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function TaskRow({ task, onClick }: { task: Task; onClick: () => void }) {
  return (
    <li
      className="flex cursor-pointer items-center justify-between gap-4 px-5 py-3 transition-colors hover:bg-muted/30"
      onClick={onClick}
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{task.title}</p>
        {task.project && (
          <p className="mt-0.5 truncate text-xs text-muted-foreground/70">{task.project.name}</p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Badge
          variant="outline"
          className={cn('text-xs', getPriorityColor(task.priority))}
        >
          {task.priority}
        </Badge>
        <Badge
          variant="outline"
          className={cn('text-xs capitalize', getStatusColor(task.status))}
        >
          {formatStatus(task.status)}
        </Badge>
        {task.due_date && (
          <span className="text-xs text-muted-foreground/70">{formatDate(task.due_date)}</span>
        )}
      </div>
    </li>
  )
}

// ─── Time Log Widget ──────────────────────────────────────────────────────────

const avatarColors = [
  'bg-pink-500', 'bg-purple-500', 'bg-indigo-500', 'bg-blue-500',
  'bg-cyan-500', 'bg-teal-500', 'bg-green-500', 'bg-orange-500',
]
function getAvatarColor(name: string) {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return avatarColors[Math.abs(hash) % avatarColors.length]
}

function formatDurationDisplay(minutes: number | null): string {
  const m = Math.max(0, minutes ?? 0)
  const h = Math.floor(m / 60)
  const min = m % 60
  if (h === 0 && min === 0) return '0m'
  if (h === 0) return `${min}m`
  if (min === 0) return `${h}h`
  return `${h}h ${min}m`
}

function formatRunningTimer(startedAt: string, tick: number): string {
  const elapsed = Math.max(0, Math.floor((tick - new Date(startedAt).getTime()) / 1000))
  const h = Math.floor(elapsed / 3600)
  const m = Math.floor((elapsed % 3600) / 60)
  const s = elapsed % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function TimeLogWidget({
  entries,
  title,
  showUser,
}: {
  entries: DashboardTimeEntry[]
  title: string
  showUser: boolean
}) {
  const router = useRouter()
  const [tick, setTick] = useState(Date.now())
  const hasRunning = entries.some((e) => e.is_running)

  useEffect(() => {
    if (!hasRunning) return
    const id = setInterval(() => setTick(Date.now()), 1000)
    return () => clearInterval(id)
  }, [hasRunning])

  const runningEntry = entries.find((e) => e.is_running)
  const pastEntries = entries.filter((e) => !e.is_running).slice(0, 6)

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm">
      <div className="flex items-center justify-between border-b border-border/60 px-5 py-4">
        <div className="flex items-center gap-2">
          <Timer className="h-4 w-4 text-muted-foreground/70" />
          <h3 className="font-semibold text-foreground">{title}</h3>
          {hasRunning && (
            <span className="flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
              Live
            </span>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="gap-1 text-xs text-muted-foreground"
          onClick={() => router.push('/timesheet')}
        >
          View all
          <ExternalLink className="h-3 w-3" />
        </Button>
      </div>

      {entries.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-5 py-8 text-center">
          <Timer className="h-8 w-8 text-gray-200" />
          <p className="text-sm text-muted-foreground/70">No time logged yet</p>
        </div>
      ) : (
        <ul className="divide-y divide-gray-50">
          {/* Running entry first */}
          {runningEntry && (
            <li className="flex items-center gap-3 bg-green-50/50 px-5 py-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-green-100">
                <Play className="h-3.5 w-3.5 fill-green-600 text-green-600" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{runningEntry.task_title}</p>
                <p className="truncate text-xs text-muted-foreground/70">
                  {runningEntry.project_name}
                  {showUser && ` · ${runningEntry.user_full_name}`}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="font-mono text-sm font-semibold text-green-600">
                  {formatRunningTimer(runningEntry.started_at, tick)}
                </p>
                <p className="text-[10px] text-muted-foreground/70">Running</p>
              </div>
            </li>
          )}

          {/* Past entries */}
          {pastEntries.map((entry) => (
            <li key={entry.id} className="flex items-center gap-3 px-5 py-3 hover:bg-muted/30 transition-colors">
              {showUser ? (
                <Avatar className="h-7 w-7 shrink-0">
                  <AvatarImage src={entry.user_avatar_url ?? undefined} />
                  <AvatarFallback className={`text-[9px] font-bold text-white ${getAvatarColor(entry.user_full_name)}`}>
                    {getInitials(entry.user_full_name)}
                  </AvatarFallback>
                </Avatar>
              ) : (
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted">
                  <Square className="h-3 w-3 text-muted-foreground/70" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{entry.task_title}</p>
                <p className="truncate text-xs text-muted-foreground/70">
                  {entry.project_name}
                  {showUser && ` · ${entry.user_full_name}`}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <Badge className="bg-orange-500 hover:bg-orange-500 text-white font-mono text-xs px-2">
                  {formatDurationDisplay(entry.duration_minutes)}
                </Badge>
                <p className="mt-0.5 text-[10px] text-muted-foreground/70">{timeAgo(entry.started_at)}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function ClientProjectsList({ projects }: { projects: Project[] }) {
  const router = useRouter()

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm">
      <div className="border-b border-border/60 px-5 py-4">
        <h3 className="font-semibold text-foreground">Your Projects</h3>
      </div>
      {projects.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-muted-foreground/70">No projects assigned</p>
      ) : (
        <ul className="divide-y divide-gray-50">
          {projects.map((project) => (
            <li
              key={project.id}
              className="flex cursor-pointer items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-muted/30"
              onClick={() => router.push(`/projects/${project.id}`)}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-foreground">{project.name}</p>
                {project.description && (
                  <p className="mt-0.5 truncate text-sm text-muted-foreground">{project.description}</p>
                )}
                <div className="mt-2 flex items-center gap-2">
                  <Progress value={project.progress} className="h-1.5 w-32" />
                  <span className="text-xs text-muted-foreground/70">{project.progress}% complete</span>
                </div>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <Badge
                  variant="outline"
                  className={cn('text-xs capitalize', getStatusColor(project.status))}
                >
                  {formatStatus(project.status)}
                </Badge>
                {project.due_date && (
                  <span className="text-xs text-muted-foreground/70">Due {formatDate(project.due_date)}</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
