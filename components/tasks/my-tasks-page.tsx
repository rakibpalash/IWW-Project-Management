'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  isToday,
  isThisWeek,
  isBefore,
  parseISO,
  startOfDay,
} from 'date-fns'
import { Task, Profile, Project, TaskStatus, Priority } from '@/types'
import { TaskRow } from './task-row'
import { CreateTaskDialog } from './create-task-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Plus, Search, X, CheckSquare } from 'lucide-react'
import { TASK_STATUSES, PRIORITIES } from '@/lib/constants'
import { cn } from '@/lib/utils'

interface MyTasksPageProps {
  initialTasks: Task[]
  profile: Profile
  projects: Project[]
}

type TaskGroup = {
  label: string
  tasks: Task[]
  className?: string
}

export function MyTasksPage({ initialTasks, profile, projects }: MyTasksPageProps) {
  const router = useRouter()
  const [tasks, setTasks] = useState<Task[]>(initialTasks)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [priorityFilter, setPriorityFilter] = useState<string>('all')
  const [projectFilter, setProjectFilter] = useState<string>('all')
  const [showCreateDialog, setShowCreateDialog] = useState(false)

  const canCreate = profile.role === 'super_admin' || profile.role === 'staff'

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      const matchesSearch =
        search === '' ||
        task.title.toLowerCase().includes(search.toLowerCase()) ||
        task.description?.toLowerCase().includes(search.toLowerCase())

      const matchesStatus = statusFilter === 'all' || task.status === statusFilter
      const matchesPriority = priorityFilter === 'all' || task.priority === priorityFilter
      const matchesProject = projectFilter === 'all' || task.project_id === projectFilter

      return matchesSearch && matchesStatus && matchesPriority && matchesProject
    })
  }, [tasks, search, statusFilter, priorityFilter, projectFilter])

  const groupedTasks = useMemo<TaskGroup[]>(() => {
    const now = new Date()
    const today = startOfDay(now)

    const overdue: Task[] = []
    const todayTasks: Task[] = []
    const thisWeekTasks: Task[] = []
    const laterTasks: Task[] = []

    for (const task of filteredTasks) {
      if (task.status === 'done' || task.status === 'cancelled') {
        laterTasks.push(task)
        continue
      }

      if (!task.due_date) {
        laterTasks.push(task)
        continue
      }

      const due = parseISO(task.due_date)

      if (isBefore(due, today)) {
        overdue.push(task)
      } else if (isToday(due)) {
        todayTasks.push(task)
      } else if (isThisWeek(due, { weekStartsOn: 1 })) {
        thisWeekTasks.push(task)
      } else {
        laterTasks.push(task)
      }
    }

    const groups: TaskGroup[] = []
    if (overdue.length > 0) {
      groups.push({ label: 'Overdue', tasks: overdue, className: 'text-red-600' })
    }
    if (todayTasks.length > 0) {
      groups.push({ label: "Due Today", tasks: todayTasks, className: 'text-orange-600' })
    }
    if (thisWeekTasks.length > 0) {
      groups.push({ label: 'Due This Week', tasks: thisWeekTasks })
    }
    if (laterTasks.length > 0) {
      groups.push({ label: 'Later', tasks: laterTasks })
    }
    return groups
  }, [filteredTasks])

  const hasActiveFilters =
    search !== '' || statusFilter !== 'all' || priorityFilter !== 'all' || projectFilter !== 'all'

  function clearFilters() {
    setSearch('')
    setStatusFilter('all')
    setPriorityFilter('all')
    setProjectFilter('all')
  }

  function handleTaskCreated(newTask: Task) {
    setTasks((prev) => [newTask, ...prev])
    setShowCreateDialog(false)
  }

  function handleTaskUpdated(updated: Task) {
    setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))
  }

  function handleTaskClick(task: Task) {
    router.push(`/projects/${task.project_id}/tasks/${task.id}`)
  }

  const totalCount = tasks.length
  const doneCount = tasks.filter((t) => t.status === 'done').length

  return (
    <div className="page-inner">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">My Tasks</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {doneCount}/{totalCount} completed
          </p>
        </div>
        {canCreate && (
          <Button onClick={() => setShowCreateDialog(true)} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            New Task
          </Button>
        )}
      </div>

      {/* Filter bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search tasks…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {TASK_STATUSES.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={priorityFilter} onValueChange={setPriorityFilter}>
            <SelectTrigger className="w-[130px]">
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Priorities</SelectItem>
              {PRIORITIES.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {projects.length > 0 && (
            <Select value={projectFilter} onValueChange={setProjectFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Project" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Projects</SelectItem>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1">
              <X className="h-3.5 w-3.5" />
              Clear
            </Button>
          )}
        </div>
      </div>

      {/* Task groups */}
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
            <Button variant="outline" size="sm" onClick={clearFilters} className="mt-4">
              Clear filters
            </Button>
          )}
          {!hasActiveFilters && canCreate && (
            <Button size="sm" onClick={() => setShowCreateDialog(true)} className="mt-4">
              <Plus className="h-4 w-4 mr-2" />
              New Task
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {groupedTasks.map((group) => (
            <div key={group.label}>
              <div className="flex items-center gap-2 mb-3">
                <h2 className={cn('text-sm font-semibold uppercase tracking-wider', group.className)}>
                  {group.label}
                </h2>
                <Badge variant="secondary" className="text-xs">
                  {group.tasks.length}
                </Badge>
              </div>
              <div className="space-y-1 rounded-lg border bg-card overflow-hidden">
                {group.tasks.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    profile={profile}
                    onTaskUpdated={handleTaskUpdated}
                    onClick={() => handleTaskClick(task)}
                    showProject
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreateDialog && (
        <CreateTaskDialog
          open={showCreateDialog}
          onOpenChange={setShowCreateDialog}
          projects={projects}
          profile={profile}
          onCreated={handleTaskCreated}
        />
      )}
    </div>
  )
}
