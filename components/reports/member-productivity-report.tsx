'use client'

import { useState, useEffect } from 'react'
import { getMemberProductivityReportAction, MemberProductivityRow } from '@/app/actions/reports'
import { StatCard, ExportButton, ReportLoading, ReportEmpty, MiniProgress } from './report-shell'
import { format, subDays } from 'date-fns'

interface Props { isAdmin: boolean }

const today = format(new Date(), 'yyyy-MM-dd')
const thirtyDaysAgo = format(subDays(new Date(), 30), 'yyyy-MM-dd')

export function MemberProductivityReport({ isAdmin }: Props) {
  const [data, setData] = useState<MemberProductivityRow[]>([])
  const [loading, setLoading] = useState(true)
  const [startDate, setStartDate] = useState(thirtyDaysAgo)
  const [endDate, setEndDate] = useState(today)

  async function load() {
    setLoading(true)
    const res = await getMemberProductivityReportAction({ startDate, endDate })
    setData(res.data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [startDate, endDate])

  const totalAssigned = data.reduce((s, r) => s + r.tasks_assigned, 0)
  const totalCompleted = data.reduce((s, r) => s + r.tasks_completed, 0)
  const totalHours = data.reduce((s, r) => s + r.hours_logged, 0)
  const avgCompletion = data.length > 0
    ? Math.round(data.reduce((s, r) => s + r.completion_rate, 0) / data.length)
    : 0

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
            title="Member Productivity Report"
            filename="member-productivity"
            headers={['Member', 'Email', 'Tasks Assigned', 'Tasks Completed', 'Hours Logged', 'Completion Rate']}
            buildRows={() => data.map(r => [
              r.user_name, r.user_email, r.tasks_assigned, r.tasks_completed, r.hours_logged, `${r.completion_rate}%`,
            ])}
          />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Members" value={data.length} />
        <StatCard label="Tasks Assigned" value={totalAssigned} color="bg-blue-100 text-blue-700" />
        <StatCard label="Tasks Completed" value={totalCompleted} color="bg-emerald-100 text-emerald-700" />
        <StatCard label="Avg Completion" value={`${avgCompletion}%`} color="bg-purple-100 text-purple-700" />
      </div>

      {/* Table */}
      {loading ? <ReportLoading /> : data.length === 0 ? <ReportEmpty /> : (
        <div className="rounded-xl border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Member</th>
                  <th className="text-center px-4 py-3 font-medium text-muted-foreground">Assigned</th>
                  <th className="text-center px-4 py-3 font-medium text-muted-foreground">Completed</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Hours</th>
                  <th className="text-center px-4 py-3 font-medium text-muted-foreground">Completion</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.sort((a, b) => b.completion_rate - a.completion_rate).map(r => (
                  <tr key={r.user_id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium">{r.user_name}</div>
                      <div className="text-xs text-muted-foreground">{r.user_email}</div>
                    </td>
                    <td className="px-4 py-3 text-center text-muted-foreground">{r.tasks_assigned}</td>
                    <td className="px-4 py-3 text-center font-medium text-emerald-600">{r.tasks_completed}</td>
                    <td className="px-4 py-3 text-right text-muted-foreground">{r.hours_logged}h</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center">
                        <MiniProgress
                          value={r.completion_rate}
                          color={r.completion_rate >= 80 ? '#22c55e' : r.completion_rate >= 50 ? '#f59e0b' : '#ef4444'}
                        />
                      </div>
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
