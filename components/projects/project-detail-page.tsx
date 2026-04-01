'use client'

import { useState } from 'react'
import { Project, Task, Profile, ActivityLog } from '@/types'
import { ProjectHeader } from './project-header'
import { TimeSummary } from './time-summary'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  cn,
  formatDate,
  formatDateTime,
  isOverdue,
  getPriorityColor,
  getStatusColor,
  getInitials,
  formatStatus,
  timeAgo,
  formatHours,
} from '@/lib/utils'
import {
  ChevronRight,
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
} from 'lucide-react'

interface ProjectDetailPageProps {
  project: Project
  tasks: Task[]
  activityLogs: ActivityLog[]
  members: Profile[]
  profile: Profile
}

export function ProjectDetailPage({
  project: initialProject,
  tasks,
  activityLogs,
  members,
  profile,
}: ProjectDetailPageProps) {
  const [project, setProject] = useState<Project>(initialProject)

  function handleProjectUpdated(updated: Project) {
    setProject(updated)
  }

  const completedTasks = tasks.filter((t) => t.status === 'done' || t.status === 'cancelled')
  const activeTasks = tasks.filter((t) => t.status !== 'done' && t.status !== 'cancelled')
  const overdueTasks = tasks.filter(
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
            {tasks.length > 0 && (
              <Badge variant="secondary" className="ml-1 hidden sm:inline-flex text-xs px-1.5 py-0">
                {tasks.length}
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
              <CardTitle className="text-base">Project Details</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-3 sm:grid-cols-2">
                <DetailRow
                  label="Workspace"
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
        <TabsContent value="tasks" className="space-y-2">
          {tasks.length === 0 ? (
            <EmptyState
              icon={<ListTodo className="h-10 w-10 text-muted-foreground" />}
              title="No tasks yet"
              description="Tasks for this project will appear here once created."
            />
          ) : (
            tasks.map((task) => <TaskRow key={task.id} task={task} projectId={project.id} />)
          )}
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
          {members.length === 0 ? (
            <EmptyState
              icon={<Users className="h-10 w-10 text-muted-foreground" />}
              title="No members assigned"
              description="Members are assigned via workspace assignments."
            />
          ) : (
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
          )}
        </TabsContent>
      </Tabs>
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

function TaskRow({ task, projectId }: { task: Task; projectId: string }) {
  const [open, setOpen] = useState(false)
  const hasSubtasks = task.subtasks && task.subtasks.length > 0
  const overdue =
    isOverdue(task.due_date) &&
    task.status !== 'done' &&
    task.status !== 'cancelled'

  const statusIcon =
    task.status === 'done' ? (
      <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
    ) : task.status === 'cancelled' ? (
      <Circle className="h-4 w-4 text-muted-foreground flex-shrink-0" />
    ) : (
      <Circle className="h-4 w-4 text-blue-500 flex-shrink-0" />
    )

  return (
    <div
      className={cn(
        'rounded-lg border bg-card',
        overdue && 'border-red-200 dark:border-red-900'
      )}
    >
      <div className="flex items-center gap-3 px-4 py-3">
        {statusIcon}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <a
              href={`/projects/${projectId}/tasks/${task.id}`}
              className="text-sm font-medium hover:underline truncate"
              onClick={(e) => {
                e.preventDefault()
                window.location.href = `/projects/${projectId}/tasks/${task.id}`
              }}
            >
              {task.title}
            </a>
            {overdue && <AlertTriangle className="h-3.5 w-3.5 text-red-500 flex-shrink-0" />}
          </div>
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            <Badge
              className={cn('text-xs', getStatusColor(task.status))}
              variant="outline"
            >
              {formatStatus(task.status)}
            </Badge>
            <Badge
              className={cn('text-xs', getPriorityColor(task.priority))}
              variant="outline"
            >
              {formatStatus(task.priority)}
            </Badge>
            {task.due_date && (
              <span
                className={cn(
                  'flex items-center gap-1 text-xs',
                  overdue ? 'text-red-600 font-medium' : 'text-muted-foreground'
                )}
              >
                <Calendar className="h-3 w-3" />
                {formatDate(task.due_date)}
              </span>
            )}
            {task.estimated_hours && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                {formatHours(task.estimated_hours)}
              </span>
            )}
          </div>
        </div>

        {/* Assignees */}
        {task.assignees && task.assignees.length > 0 && (
          <div className="hidden sm:flex -space-x-1.5">
            {task.assignees.slice(0, 3).map((a) => (
              <Avatar key={a.id} className="h-6 w-6 ring-2 ring-background">
                <AvatarFallback className="text-xs">
                  {getInitials(a.full_name)}
                </AvatarFallback>
              </Avatar>
            ))}
            {task.assignees.length > 3 && (
              <div className="h-6 w-6 rounded-full bg-muted ring-2 ring-background flex items-center justify-center">
                <span className="text-xs text-muted-foreground">
                  +{task.assignees.length - 3}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Subtask toggle */}
        {hasSubtasks && (
          <button
            onClick={() => setOpen(!open)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors ml-1"
          >
            <ChevronRight
              className={cn('h-4 w-4 transition-transform', open && 'rotate-90')}
            />
            <span className="hidden sm:inline">
              {task.subtasks!.length} subtask{task.subtasks!.length !== 1 ? 's' : ''}
            </span>
          </button>
        )}
      </div>

      {/* Subtasks */}
      {hasSubtasks && open && (
        <div className="border-t mx-4 mb-2 pt-2 space-y-1 pl-6">
          {task.subtasks!.map((sub) => {
            const subOverdue =
              isOverdue(sub.due_date) &&
              sub.status !== 'done' &&
              sub.status !== 'cancelled'
            return (
              <div
                key={sub.id}
                className={cn(
                  'flex items-center gap-2 rounded px-2 py-1.5 text-sm',
                  subOverdue && 'text-red-600'
                )}
              >
                {sub.status === 'done' ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />
                ) : (
                  <Circle className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                )}
                <span className="truncate flex-1">{sub.title}</span>
                <Badge
                  className={cn('text-xs', getStatusColor(sub.status))}
                  variant="outline"
                >
                  {formatStatus(sub.status)}
                </Badge>
                {subOverdue && (
                  <AlertTriangle className="h-3.5 w-3.5 text-red-500 flex-shrink-0" />
                )}
              </div>
            )
          })}
        </div>
      )}
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
