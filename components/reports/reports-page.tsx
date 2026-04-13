'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Profile, Space } from '@/types'
import { BarChart2, FolderKanban, CheckSquare, AlertTriangle, PieChart, Timer, Users, Clock, CalendarDays, ChevronRight } from 'lucide-react'
import { ProjectProgressReport } from './project-progress-report'
import { ProjectTimeReport } from './project-time-report'
import { TaskCompletionReport } from './task-completion-report'
import { OverdueTasksReport } from './overdue-tasks-report'
import { TaskDistributionReport } from './task-distribution-report'
import { TimeLogReport } from './time-log-report'
import { MemberProductivityReport } from './member-productivity-report'
import { AttendanceReport } from './attendance-report'
import { LeaveReport } from './leave-report'

interface Props {
  profile: Profile
  isAdmin: boolean
  defaultReport?: string
}

type ReportId =
  | 'project-progress'
  | 'project-time'
  | 'task-completion'
  | 'overdue-tasks'
  | 'task-distribution'
  | 'time-log'
  | 'member-productivity'
  | 'attendance-summary'
  | 'leave-usage'

interface NavItem {
  id: ReportId
  label: string
  icon: React.ReactNode
  description: string
}

interface NavGroup {
  group: string
  items: NavItem[]
}

const NAV_GROUPS: NavGroup[] = [
  {
    group: 'Projects',
    items: [
      { id: 'project-progress', label: 'Project Progress', icon: <FolderKanban className="h-4 w-4" />, description: 'Status, tasks, and timeline health' },
      { id: 'project-time', label: 'Project Time', icon: <Timer className="h-4 w-4" />, description: 'Hours logged per project & member' },
    ],
  },
  {
    group: 'Tasks',
    items: [
      { id: 'task-completion', label: 'Task Completion', icon: <CheckSquare className="h-4 w-4" />, description: 'Completion rates over a date range' },
      { id: 'overdue-tasks', label: 'Overdue Tasks', icon: <AlertTriangle className="h-4 w-4" />, description: 'Tasks past their due date' },
      { id: 'task-distribution', label: 'Task Distribution', icon: <PieChart className="h-4 w-4" />, description: 'By status, priority, and assignee' },
    ],
  },
  {
    group: 'Time',
    items: [
      { id: 'time-log', label: 'Time Log', icon: <Timer className="h-4 w-4" />, description: 'Detailed time entries log' },
    ],
  },
  {
    group: 'HR',
    items: [
      { id: 'member-productivity', label: 'Member Productivity', icon: <Users className="h-4 w-4" />, description: 'Tasks and hours per member' },
      { id: 'attendance-summary', label: 'Attendance Summary', icon: <Clock className="h-4 w-4" />, description: 'Monthly attendance breakdown' },
      { id: 'leave-usage', label: 'Leave Usage', icon: <CalendarDays className="h-4 w-4" />, description: 'Leave balances and usage per member' },
    ],
  },
]

const DEFAULT_REPORT: ReportId = 'project-progress'

export function ReportsPage({ profile, isAdmin, defaultReport }: Props) {
  const [activeReport, setActiveReport] = useState<ReportId>(
    (defaultReport as ReportId) ?? DEFAULT_REPORT
  )
  const [workspaces, setWorkspaces] = useState<Space[]>([])

  // Fetch workspaces for filter dropdowns
  useEffect(() => {
    async function fetchWorkspaces() {
      const supabase = createClient()
      const { data } = await supabase
        .from('spaces')
        .select('id, name, description, created_by, created_at, updated_at')
        .order('name')
      setWorkspaces(data ?? [])
    }
    fetchWorkspaces()
  }, [])

  function handleNavClick(id: ReportId) {
    setActiveReport(id)
    window.history.replaceState(null, '', `/reports?report=${id}`)
  }

  // Find current nav item for title/description
  const allItems = NAV_GROUPS.flatMap((g) => g.items)
  const currentItem = allItems.find((i) => i.id === activeReport)

  return (
    <div className="flex h-full gap-0">
      {/* Sidebar */}
      <aside className="w-56 shrink-0 border-r bg-muted/20 overflow-y-auto">
        <div className="px-3 py-4 border-b">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <BarChart2 className="h-4 w-4 text-primary" />
            Reports
          </div>
        </div>
        <nav className="py-2">
          {NAV_GROUPS.map((group) => (
            <div key={group.group} className="mb-1">
              <p className="px-4 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                {group.group}
              </p>
              {group.items.map((item) => {
                const isActive = activeReport === item.id
                return (
                  <button
                    key={item.id}
                    onClick={() => handleNavClick(item.id)}
                    className={`w-full flex items-center gap-2.5 px-4 py-2 text-sm transition-colors text-left ${
                      isActive
                        ? 'bg-primary/10 text-primary font-medium'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                    }`}
                  >
                    <span className={isActive ? 'text-primary' : ''}>{item.icon}</span>
                    {item.label}
                    {isActive && <ChevronRight className="h-3 w-3 ml-auto shrink-0 text-primary" />}
                  </button>
                )
              })}
            </div>
          ))}
        </nav>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto min-w-0">
        <div className="px-6 py-5">
          {/* Header */}
          <div className="mb-5">
            <h1 className="text-lg font-semibold text-foreground">{currentItem?.label}</h1>
            {currentItem?.description && (
              <p className="text-sm text-muted-foreground mt-0.5">{currentItem.description}</p>
            )}
          </div>

          {/* Report content */}
          {activeReport === 'project-progress' && (
            <ProjectProgressReport workspaces={workspaces} isAdmin={isAdmin} />
          )}
          {activeReport === 'project-time' && (
            <ProjectTimeReport workspaces={workspaces} isAdmin={isAdmin} />
          )}
          {activeReport === 'task-completion' && (
            <TaskCompletionReport workspaces={workspaces} isAdmin={isAdmin} />
          )}
          {activeReport === 'overdue-tasks' && (
            <OverdueTasksReport workspaces={workspaces} isAdmin={isAdmin} />
          )}
          {activeReport === 'task-distribution' && (
            <TaskDistributionReport workspaces={workspaces} isAdmin={isAdmin} />
          )}
          {activeReport === 'time-log' && (
            <TimeLogReport workspaces={workspaces} isAdmin={isAdmin} />
          )}
          {activeReport === 'member-productivity' && (
            <MemberProductivityReport isAdmin={isAdmin} />
          )}
          {activeReport === 'attendance-summary' && (
            <AttendanceReport isAdmin={isAdmin} />
          )}
          {activeReport === 'leave-usage' && (
            <LeaveReport isAdmin={isAdmin} />
          )}
        </div>
      </main>
    </div>
  )
}
