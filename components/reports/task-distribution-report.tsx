'use client'

import { useState, useEffect } from 'react'
import { getTaskDistributionReportAction, TaskDistributionData } from '@/app/actions/reports'
import { StatCard, ExportButton, ReportLoading, ReportEmpty, BarChart, HorizontalBar } from './report-shell'
import { Space } from '@/types'

interface Props { workspaces: Space[]; isAdmin: boolean }

export function TaskDistributionReport({ workspaces, isAdmin }: Props) {
  const [data, setData] = useState<TaskDistributionData | null>(null)
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    const res = await getTaskDistributionReportAction({})
    setData(res.data ?? null)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const totalTasks = (data?.by_status ?? []).reduce((s, i) => s + i.count, 0)
  const doneTasks = (data?.by_status ?? []).find(s => s.label === 'done')?.count ?? 0
  const completionRate = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0
  const maxAssignee = Math.max(...(data?.by_assignee ?? []).map(a => a.total), 1)

  return (
    <div className="space-y-5">
      {/* Export */}
      <div className="flex justify-end">
        <ExportButton
          title="Task Distribution Report"
          filename="task-distribution"
          headers={['Assignee', 'Total Tasks', 'Completed', 'Completion Rate']}
          buildRows={() => (data?.by_assignee ?? []).map(a => [
            a.name, a.total, a.done,
            a.total > 0 ? `${Math.round((a.done / a.total) * 100)}%` : '0%',
          ])}
        />
      </div>

      {loading ? <ReportLoading /> : !data || totalTasks === 0 ? <ReportEmpty /> : (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <StatCard label="Total Tasks" value={totalTasks} />
            <StatCard label="Completed" value={doneTasks} color="bg-emerald-100 text-emerald-700" />
            <StatCard label="Completion Rate" value={`${completionRate}%`} color="bg-blue-100 text-blue-700" />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* By status */}
            <div className="rounded-xl border bg-card p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-4">By Status</p>
              <BarChart
                data={data.by_status.map(s => ({ label: s.label.replace(/_/g, ' '), value: s.count, color: s.color }))}
                height={150}
              />
            </div>

            {/* By priority */}
            <div className="rounded-xl border bg-card p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-4">By Priority</p>
              <BarChart
                data={data.by_priority.map(s => ({ label: s.label, value: s.count, color: s.color }))}
                height={150}
              />
            </div>
          </div>

          {/* By assignee */}
          {data.by_assignee.length > 0 && (
            <div className="rounded-xl border bg-card p-5 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">By Assignee</p>
              <div className="space-y-3">
                {data.by_assignee.sort((a, b) => b.total - a.total).map((row, i) => {
                  const pct = row.total > 0 ? Math.round((row.done / row.total) * 100) : 0
                  return (
                    <div key={i} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-foreground">{row.name}</span>
                        <span className="text-muted-foreground text-xs">{row.done}/{row.total} done · {pct}%</span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${(row.total / maxAssignee) * 100}%`, backgroundColor: '#3b82f6' }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
