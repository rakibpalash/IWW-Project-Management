'use client'

import { useState, useEffect } from 'react'
import { getTaskCompletionReportAction, TaskCompletionData } from '@/app/actions/reports'
import { StatCard, ExportButton, ReportLoading, ReportEmpty, BarChart, HorizontalBar, statusColor } from './report-shell'
import { Space } from '@/types'
import { format, subDays } from 'date-fns'

interface Props { workspaces: Space[]; isAdmin: boolean }

const today = format(new Date(), 'yyyy-MM-dd')
const thirtyDaysAgo = format(subDays(new Date(), 30), 'yyyy-MM-dd')

const STATUS_COLORS: Record<string, string> = {
  todo: '#94a3b8',
  in_progress: '#3b82f6',
  in_review: '#f59e0b',
  done: '#22c55e',
  cancelled: '#ef4444',
}

export function TaskCompletionReport({ workspaces, isAdmin }: Props) {
  const [data, setData] = useState<TaskCompletionData | null>(null)
  const [loading, setLoading] = useState(true)
  const [startDate, setStartDate] = useState(thirtyDaysAgo)
  const [endDate, setEndDate] = useState(today)

  async function load() {
    setLoading(true)
    const res = await getTaskCompletionReportAction({ startDate, endDate })
    setData(res.data ?? null)
    setLoading(false)
  }

  useEffect(() => { load() }, [startDate, endDate])

  const completionRate = data && data.total > 0
    ? Math.round((data.completed / data.total) * 100)
    : 0

  const statusChartData = (data?.by_status ?? []).map(s => ({
    label: s.status.replace(/_/g, ' '),
    value: s.count,
    color: STATUS_COLORS[s.status] ?? '#94a3b8',
  }))

  const maxProjectTotal = Math.max(...(data?.by_project ?? []).map(p => p.total), 1)

  return (
    <div className="space-y-5">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 text-sm">
          <label className="text-muted-foreground">From</label>
          <input
            type="date" value={startDate} max={endDate}
            onChange={e => setStartDate(e.target.value)}
            className="h-8 rounded-md border bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <div className="flex items-center gap-2 text-sm">
          <label className="text-muted-foreground">To</label>
          <input
            type="date" value={endDate} min={startDate} max={today}
            onChange={e => setEndDate(e.target.value)}
            className="h-8 rounded-md border bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <div className="ml-auto">
          <ExportButton
            title="Task Completion Report"
            filename="task-completion"
            headers={['Project', 'Total Tasks', 'Completed', 'Completion %']}
            buildRows={() => (data?.by_project ?? []).map(p => [
              p.project_name, p.total, p.completed,
              p.total > 0 ? `${Math.round((p.completed / p.total) * 100)}%` : '0%',
            ])}
          />
        </div>
      </div>

      {loading ? <ReportLoading /> : !data || data.total === 0 ? <ReportEmpty /> : (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="Total Tasks" value={data.total} />
            <StatCard label="Completed" value={data.completed} color="bg-emerald-100 text-emerald-700" />
            <StatCard label="In Progress" value={data.in_progress} color="bg-blue-100 text-blue-700" />
            <StatCard label="Completion Rate" value={`${completionRate}%`} color="bg-purple-100 text-purple-700" />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* Status breakdown chart */}
            {statusChartData.length > 0 && (
              <div className="rounded-xl border bg-card p-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-4">By Status</p>
                <BarChart data={statusChartData} height={140} />
              </div>
            )}

            {/* Overdue callout */}
            <div className="rounded-xl border bg-card p-5 flex flex-col gap-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Summary</p>
              <div className="space-y-2">
                {[
                  { label: 'Completed', value: data.completed, color: '#22c55e' },
                  { label: 'In Progress', value: data.in_progress, color: '#3b82f6' },
                  { label: 'Overdue', value: data.overdue, color: '#ef4444' },
                ].map(item => (
                  <HorizontalBar key={item.label} label={item.label} value={item.value} max={data.total} color={item.color} />
                ))}
              </div>
            </div>
          </div>

          {/* By project */}
          {data.by_project.length > 0 && (
            <div className="rounded-xl border bg-card p-5 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Completion by Project</p>
              <div className="space-y-3">
                {data.by_project.sort((a, b) => b.total - a.total).map((p, i) => {
                  const pct = p.total > 0 ? Math.round((p.completed / p.total) * 100) : 0
                  return (
                    <div key={i} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-foreground truncate max-w-[60%]">{p.project_name}</span>
                        <span className="text-muted-foreground font-medium">{p.completed}/{p.total} · {pct}%</span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-500 bg-emerald-500" style={{ width: `${pct}%` }} />
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
