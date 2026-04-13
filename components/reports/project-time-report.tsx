'use client'

import { useState, useEffect } from 'react'
import { getProjectTimeReportAction, ProjectTimeRow } from '@/app/actions/reports'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { StatCard, ExportButton, ReportLoading, ReportEmpty, HorizontalBar, fmtHours } from './report-shell'
import { Space } from '@/types'
import { format, subDays } from 'date-fns'

interface Props { workspaces: Space[]; isAdmin: boolean }

const today = format(new Date(), 'yyyy-MM-dd')
const thirtyDaysAgo = format(subDays(new Date(), 30), 'yyyy-MM-dd')

export function ProjectTimeReport({ workspaces, isAdmin }: Props) {
  const [data, setData] = useState<ProjectTimeRow[]>([])
  const [loading, setLoading] = useState(true)
  const [startDate, setStartDate] = useState(thirtyDaysAgo)
  const [endDate, setEndDate] = useState(today)
  const [groupBy, setGroupBy] = useState<'project' | 'member'>('project')

  async function load() {
    setLoading(true)
    const res = await getProjectTimeReportAction({ startDate, endDate })
    setData(res.data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [startDate, endDate])

  // Aggregate by project
  const byProject = Object.values(
    data.reduce<Record<string, { name: string; minutes: number; billable: number; entries: number }>>((acc, row) => {
      if (!acc[row.project_id]) acc[row.project_id] = { name: row.project_name, minutes: 0, billable: 0, entries: 0 }
      acc[row.project_id].minutes += row.total_minutes
      acc[row.project_id].billable += row.billable_minutes
      acc[row.project_id].entries += row.entry_count
      return acc
    }, {})
  ).sort((a, b) => b.minutes - a.minutes)

  // Aggregate by member
  const byMember = Object.values(
    data.reduce<Record<string, { name: string; minutes: number; billable: number; entries: number }>>((acc, row) => {
      if (!acc[row.user_id]) acc[row.user_id] = { name: row.user_name, minutes: 0, billable: 0, entries: 0 }
      acc[row.user_id].minutes += row.total_minutes
      acc[row.user_id].billable += row.billable_minutes
      acc[row.user_id].entries += row.entry_count
      return acc
    }, {})
  ).sort((a, b) => b.minutes - a.minutes)

  const displayRows = groupBy === 'project' ? byProject : byMember
  const maxMinutes = displayRows[0]?.minutes ?? 1

  const totalMinutes = data.reduce((s, r) => s + r.total_minutes, 0)
  const totalBillable = data.reduce((s, r) => s + r.billable_minutes, 0)
  const totalEntries = data.reduce((s, r) => s + r.entry_count, 0)
  const billablePct = totalMinutes > 0 ? Math.round((totalBillable / totalMinutes) * 100) : 0

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
        <Select value={groupBy} onValueChange={v => setGroupBy(v as 'project' | 'member')}>
          <SelectTrigger className="w-[140px] h-8 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="project">By List</SelectItem>
            <SelectItem value="member">By Member</SelectItem>
          </SelectContent>
        </Select>
        <div className="ml-auto">
          <ExportButton
            title="Project Time Report"
            filename="project-time"
            headers={['Name', 'Total Hours', 'Billable Hours', 'Entries']}
            buildRows={() => displayRows.map(r => [r.name, fmtHours(r.minutes), fmtHours(r.billable), r.entries])}
          />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Total Hours" value={fmtHours(totalMinutes)} />
        <StatCard label="Billable Hours" value={fmtHours(totalBillable)} color="bg-emerald-100 text-emerald-700" />
        <StatCard label="Billable %" value={`${billablePct}%`} color="bg-blue-100 text-blue-700" />
        <StatCard label="Time Entries" value={totalEntries} color="bg-purple-100 text-purple-700" />
      </div>

      {/* Bar list */}
      {loading ? <ReportLoading /> : displayRows.length === 0 ? <ReportEmpty /> : (
        <div className="rounded-xl border bg-card p-5 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {groupBy === 'project' ? 'Time by Project' : 'Time by Member'}
          </p>
          <div className="space-y-3">
            {displayRows.map((row, i) => (
              <div key={i} className="space-y-1">
                <HorizontalBar
                  label={row.name}
                  value={row.minutes}
                  max={maxMinutes}
                  color="#3b82f6"
                />
                <div className="flex justify-between text-[11px] text-muted-foreground pl-0.5">
                  <span>{fmtHours(row.minutes)} total · {fmtHours(row.billable)} billable</span>
                  <span>{row.entries} {row.entries === 1 ? 'entry' : 'entries'}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
