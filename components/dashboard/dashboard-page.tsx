'use client'

import { useRouter } from 'next/navigation'
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
} from 'lucide-react'
import { StatCard } from './stat-card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import {
  cn,
  formatDate,
  formatMinutes,
  getStatusColor,
  getPriorityColor,
  timeAgo,
  formatStatus,
} from '@/lib/utils'
import {
  Profile,
  Project,
  Task,
  AttendanceRecord,
  LeaveBalance,
  ActivityLog,
  LeaveRequest,
} from '@/types'

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
  // Staff
  myTasks?: Task[]
  myAttendanceToday?: AttendanceRecord | null
  myLeaveBalance?: LeaveBalance | null
  timeTrackedTodayMinutes?: number
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
  myTasks,
  myAttendanceToday,
  myLeaveBalance,
  timeTrackedTodayMinutes,
  clientProjects,
}: DashboardPageProps) {
  const router = useRouter()
  const role = profile.role

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Welcome back, {profile.full_name.split(' ')[0]}
        </h1>
        <p className="mt-1 text-sm text-gray-500">
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
        </>
      )}

      {/* ── STAFF ── */}
      {role === 'staff' && (
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
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-gray-700">Today&apos;s Attendance</h3>
              <div className="mt-3 flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <LogIn className="h-4 w-4 text-gray-400" />
                  <span className="text-sm text-gray-600">
                    Check-in:{' '}
                    <span className="font-medium">
                      {myAttendanceToday.check_in_time
                        ? myAttendanceToday.check_in_time.slice(0, 5)
                        : '—'}
                    </span>
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-gray-400" />
                  <span className="text-sm text-gray-600">
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
      {(role === 'super_admin' || role === 'staff') && (
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
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
        <h3 className="font-semibold text-gray-900">Recent Projects</h3>
        <Button
          variant="ghost"
          size="sm"
          className="text-xs text-gray-500"
          onClick={() => router.push('/projects')}
        >
          View all
        </Button>
      </div>
      {projects.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-gray-400">No projects yet</p>
      ) : (
        <ul className="divide-y divide-gray-50">
          {projects.slice(0, 5).map((project) => (
            <li
              key={project.id}
              className="flex cursor-pointer items-center justify-between gap-4 px-5 py-3 transition-colors hover:bg-gray-50"
              onClick={() => router.push(`/projects/${project.id}`)}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-gray-900">{project.name}</p>
                <div className="mt-1 flex items-center gap-2">
                  <Progress value={project.progress} className="h-1.5 w-20" />
                  <span className="text-xs text-gray-400">{project.progress}%</span>
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
                  <span className="text-xs text-gray-400">{formatDate(project.due_date)}</span>
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
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-100 px-5 py-4">
        <h3 className="font-semibold text-gray-900">Recent Activity</h3>
      </div>
      {activities.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-gray-400">No recent activity</p>
      ) : (
        <ul className="divide-y divide-gray-50">
          {activities.slice(0, 5).map((log) => (
            <li key={log.id} className="flex items-start gap-3 px-5 py-3">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-50 text-xs font-semibold text-blue-600">
                {log.user?.full_name?.charAt(0) ?? '?'}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-gray-700">
                  <span className="font-medium">{log.user?.full_name ?? 'Someone'}</span>{' '}
                  {log.action}
                </p>
                {(log.old_value || log.new_value) && (
                  <p className="mt-0.5 text-xs text-gray-400 truncate">
                    {log.old_value && <span className="line-through mr-1">{log.old_value}</span>}
                    {log.new_value && <span>{log.new_value}</span>}
                  </p>
                )}
                <p className="mt-0.5 text-xs text-gray-400">{timeAgo(log.created_at)}</p>
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
        <div className="rounded-xl border border-red-100 bg-white shadow-sm">
          <div className="flex items-center gap-2 border-b border-red-100 px-5 py-4">
            <AlertTriangle className="h-4 w-4 text-red-500" />
            <h3 className="font-semibold text-red-700">Overdue Tasks ({overdueTasks.length})</h3>
          </div>
          <ul className="divide-y divide-gray-50">
            {overdueTasks.map((task) => (
              <TaskRow key={task.id} task={task} onClick={() => router.push(`/tasks/${task.id}`)} />
            ))}
          </ul>
        </div>
      )}

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <h3 className="font-semibold text-gray-900">My Tasks</h3>
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-gray-500"
            onClick={() => router.push('/tasks')}
          >
            View all
          </Button>
        </div>
        {activeTasks.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-gray-400">No open tasks</p>
        ) : (
          <ul className="divide-y divide-gray-50">
            {activeTasks.slice(0, 8).map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                onClick={() => router.push(`/tasks/${task.id}`)}
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
      className="flex cursor-pointer items-center justify-between gap-4 px-5 py-3 transition-colors hover:bg-gray-50"
      onClick={onClick}
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-gray-900">{task.title}</p>
        {task.project && (
          <p className="mt-0.5 truncate text-xs text-gray-400">{task.project.name}</p>
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
          <span className="text-xs text-gray-400">{formatDate(task.due_date)}</span>
        )}
      </div>
    </li>
  )
}

function ClientProjectsList({ projects }: { projects: Project[] }) {
  const router = useRouter()

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-100 px-5 py-4">
        <h3 className="font-semibold text-gray-900">Your Projects</h3>
      </div>
      {projects.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-gray-400">No projects assigned</p>
      ) : (
        <ul className="divide-y divide-gray-50">
          {projects.map((project) => (
            <li
              key={project.id}
              className="flex cursor-pointer items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-gray-50"
              onClick={() => router.push(`/projects/${project.id}`)}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-gray-900">{project.name}</p>
                {project.description && (
                  <p className="mt-0.5 truncate text-sm text-gray-500">{project.description}</p>
                )}
                <div className="mt-2 flex items-center gap-2">
                  <Progress value={project.progress} className="h-1.5 w-32" />
                  <span className="text-xs text-gray-400">{project.progress}% complete</span>
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
                  <span className="text-xs text-gray-400">Due {formatDate(project.due_date)}</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
