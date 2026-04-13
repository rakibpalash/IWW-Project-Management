'use client'

import { useState, useEffect } from 'react'
import { getOverdueTasksReportAction, OverdueTaskRow } from '@/app/actions/reports'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { StatCard, ExportButton, ReportLoading, ReportEmpty, priorityColor } from './report-shell'
import { Space } from '@/types'
import { format, parseISO } from 'date-fns'
import { AlertTriangle } from 'lucide-react'

interface Props { workspaces: Space[]; isAdmin: boolean }

export function OverdueTasksReport({ workspaces, isAdmin }: Props) {
  const [data, setData] = useState<OverdueTaskRow[]>([])
  const [loading, setLoading] = useState(true)
  const [priority, setPriority] = useState('all')

  async function load() {
    setLoading(true)
    const res = await getOverdueTasksReportAction({
      priority: priority === 'all' ? undefined : priority,
    })
    setData(res.data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [priority])

  const urgent = data.filter(t => t.priority === 'urgent').length
  const highPrio = data.filter(t => t.priority === 'high').length
  const maxDaysOverdue = data.length > 0 ? Math.max(...data.map(t => t.days_overdue)) : 0

  return (
    <div className="space-y-5">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={priority} onValueChange={setPriority}>
          <SelectTrigger className="w-[150px] h-8 text-sm"><SelectValue placeholder="All Priorities" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priorities</SelectItem>
            <SelectItem value="urgent">Urgent</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>
        <div className="ml-auto">
          <ExportButton
            title="Overdue Tasks Report"
            filename="overdue-tasks"
            headers={['Task', 'Project', 'Priority', 'Due Date', 'Days Overdue', 'Assignees']}
            buildRows={() => data.map(t => [
              t.title, t.project_name, t.priority,
              format(parseISO(t.due_date), 'yyyy-MM-dd'),
              t.days_overdue,
              t.assignees.map(a => a.name).join(', '),
            ])}
          />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Total Overdue" value={data.length} color="bg-red-100 text-red-700" />
        <StatCard label="Urgent" value={urgent} color="bg-red-100 text-red-700" />
        <StatCard label="High Priority" value={highPrio} color="bg-orange-100 text-orange-700" />
        <StatCard label="Max Days Late" value={maxDaysOverdue} color="bg-amber-100 text-amber-700" />
      </div>

      {/* Table */}
      {loading ? <ReportLoading /> : data.length === 0 ? (
        <ReportEmpty message="No overdue tasks found. Great work!" />
      ) : (
        <div className="rounded-xl border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Task</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">List</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Priority</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Due Date</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Days Late</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Assignees</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.map(t => (
                  <tr key={t.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-3.5 w-3.5 text-red-500 shrink-0" />
                        <span className="font-medium">{t.title}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{t.project_name}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${priorityColor(t.priority)}`}>
                        {t.priority}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-red-600 font-medium">
                      {format(parseISO(t.due_date), 'MMM d, yyyy')}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={`font-semibold ${t.days_overdue > 14 ? 'text-red-600' : t.days_overdue > 7 ? 'text-orange-600' : 'text-amber-600'}`}>
                        {t.days_overdue}d
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {t.assignees.length === 0 ? (
                        <span className="text-muted-foreground text-xs">Unassigned</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {t.assignees.map(a => (
                            <span key={a.id} className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs text-foreground">
                              {a.name}
                            </span>
                          ))}
                        </div>
                      )}
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
