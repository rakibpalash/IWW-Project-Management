'use client'

import { useState, useEffect } from 'react'
import { getTimeLogReportAction, TimeLogRow } from '@/app/actions/reports'
import { StatCard, ExportButton, ReportLoading, ReportEmpty, fmtHours } from './report-shell'
import { Space } from '@/types'
import { format, parseISO, subDays } from 'date-fns'
import { Clock } from 'lucide-react'

interface Props { spaces: Space[]; isAdmin: boolean }

const today = format(new Date(), 'yyyy-MM-dd')
const thirtyDaysAgo = format(subDays(new Date(), 30), 'yyyy-MM-dd')

export function TimeLogReport({ spaces, isAdmin }: Props) {
  const [data, setData] = useState<TimeLogRow[]>([])
  const [loading, setLoading] = useState(true)
  const [startDate, setStartDate] = useState(thirtyDaysAgo)
  const [endDate, setEndDate] = useState(today)

  async function load() {
    setLoading(true)
    const res = await getTimeLogReportAction({ startDate, endDate })
    setData(res.data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [startDate, endDate])

  const totalMinutes = data.reduce((s, r) => s + r.duration_minutes, 0)
  const billableMinutes = data.filter(r => r.is_billable).reduce((s, r) => s + r.duration_minutes, 0)
  const billablePct = totalMinutes > 0 ? Math.round((billableMinutes / totalMinutes) * 100) : 0
  const uniqueMembers = new Set(data.map(r => r.user_name)).size

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
            title="Time Log Report"
            filename="time-log"
            headers={['Date', 'Member', 'List', 'Task', 'Duration', 'Billable', 'Description']}
            buildRows={() => data.map(r => [
              r.date, r.user_name, r.list_name, r.task_title,
              fmtHours(r.duration_minutes),
              r.is_billable ? 'Yes' : 'No',
              r.description ?? '',
            ])}
          />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Total Hours" value={fmtHours(totalMinutes)} />
        <StatCard label="Billable Hours" value={fmtHours(billableMinutes)} color="bg-emerald-100 text-emerald-700" />
        <StatCard label="Billable %" value={`${billablePct}%`} color="bg-blue-100 text-blue-700" />
        <StatCard label="Members" value={uniqueMembers} color="bg-purple-100 text-purple-700" />
      </div>

      {/* Table */}
      {loading ? <ReportLoading /> : data.length === 0 ? <ReportEmpty /> : (
        <div className="rounded-xl border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Date</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Member</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">List</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Task</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Duration</th>
                  <th className="text-center px-4 py-3 font-medium text-muted-foreground">Billable</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.map(r => (
                  <tr key={r.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                      {format(parseISO(r.date), 'MMM d, yyyy')}
                    </td>
                    <td className="px-4 py-3 font-medium">{r.user_name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{r.list_name}</td>
                    <td className="px-4 py-3">
                      <span className="truncate max-w-[200px] block">{r.task_title}</span>
                      {r.description && (
                        <span className="text-xs text-muted-foreground truncate max-w-[200px] block">{r.description}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-medium">
                      <div className="flex items-center justify-end gap-1">
                        <Clock className="h-3 w-3 text-muted-foreground" />
                        {fmtHours(r.duration_minutes)}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {r.is_billable ? (
                        <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">Yes</span>
                      ) : (
                        <span className="text-muted-foreground text-xs">No</span>
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
