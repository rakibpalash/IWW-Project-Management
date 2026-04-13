'use client'

import { useState, useEffect } from 'react'
import { getProjectProgressReportAction, ProjectProgressRow } from '@/app/actions/reports'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { StatCard, ExportButton, ReportLoading, ReportEmpty, statusColor, priorityColor, MiniProgress } from './report-shell'
import { format, parseISO } from 'date-fns'
import { AlertTriangle } from 'lucide-react'
import { Workspace } from '@/types'

interface Props { workspaces: Workspace[]; isAdmin: boolean }

export function ProjectProgressReport({ workspaces, isAdmin }: Props) {
  const [data, setData] = useState<ProjectProgressRow[]>([])
  const [loading, setLoading] = useState(true)
  const [workspaceId, setWorkspaceId] = useState('all')
  const [status, setStatus] = useState('all')

  async function load() {
    setLoading(true)
    const res = await getProjectProgressReportAction({
      workspaceId: workspaceId === 'all' ? undefined : workspaceId,
      status: status === 'all' ? undefined : status,
    })
    setData(res.data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [workspaceId, status])

  const total = data.length
  const overdue = data.filter(p => p.is_overdue).length
  const avgProgress = total > 0 ? Math.round(data.reduce((s, p) => s + p.progress, 0) / total) : 0
  const completed = data.filter(p => p.status === 'completed').length

  return (
    <div className="space-y-5">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        {isAdmin && workspaces.length > 1 && (
          <Select value={workspaceId} onValueChange={setWorkspaceId}>
            <SelectTrigger className="w-[180px] h-8 text-sm"><SelectValue placeholder="All Spaces" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Spaces</SelectItem>
              {workspaces.map(w => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[150px] h-8 text-sm"><SelectValue placeholder="All Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="planning">Planning</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="on_hold">On Hold</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
        <div className="ml-auto">
          <ExportButton
            title="Project Progress Report"
            filename="project-progress"
            headers={['Project', 'Space', 'Status', 'Priority', 'Progress %', 'Tasks Done', 'Total Tasks', 'Logged Hours', 'Est. Hours', 'Due Date', 'Overdue']}
            buildRows={() => data.map(p => [p.name, p.workspace_name ?? '', p.status, p.priority, p.progress, p.completed_tasks, p.total_tasks, p.logged_hours, p.estimated_hours ?? '', p.due_date ?? '', p.is_overdue ? 'Yes' : 'No'])}
          />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Total Projects" value={total} />
        <StatCard label="Completed" value={completed} color="bg-emerald-100 text-emerald-700" />
        <StatCard label="Overdue" value={overdue} color="bg-red-100 text-red-700" />
        <StatCard label="Avg Progress" value={`${avgProgress}%`} color="bg-blue-100 text-blue-700" />
      </div>

      {/* Table */}
      {loading ? <ReportLoading /> : data.length === 0 ? <ReportEmpty /> : (
        <div className="rounded-xl border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Project</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Priority</th>
                  <th className="text-center px-4 py-3 font-medium text-muted-foreground">Progress</th>
                  <th className="text-center px-4 py-3 font-medium text-muted-foreground">Tasks</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Hours</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Due Date</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.map(p => (
                  <tr key={p.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {p.is_overdue && <AlertTriangle className="h-3.5 w-3.5 text-red-500 shrink-0" />}
                        <span className="font-medium">{p.name}</span>
                      </div>
                      {p.workspace_name && <p className="text-xs text-muted-foreground mt-0.5">{p.workspace_name}</p>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusColor(p.status)}`}>
                        {p.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${priorityColor(p.priority)}`}>
                        {p.priority}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-2">
                        <MiniProgress value={p.progress} color={p.progress >= 80 ? '#22c55e' : p.progress >= 40 ? '#f59e0b' : '#3b82f6'} />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center text-muted-foreground">
                      <span className="font-medium text-foreground">{p.completed_tasks}</span>/{p.total_tasks}
                    </td>
                    <td className="px-4 py-3 text-right text-muted-foreground">
                      <span className="font-medium text-foreground">{p.logged_hours}h</span>
                      {p.estimated_hours && <span className="text-xs"> /{p.estimated_hours}h</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {p.due_date ? (
                        <span className={p.is_overdue ? 'text-red-600 font-medium' : 'text-muted-foreground'}>
                          {format(parseISO(p.due_date), 'MMM d, yyyy')}
                        </span>
                      ) : <span className="text-muted-foreground">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
