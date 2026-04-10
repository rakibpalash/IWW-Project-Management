'use client'

import { useState, useEffect } from 'react'
import { getAttendanceSummaryReportAction, AttendanceSummaryRow } from '@/app/actions/reports'
import { StatCard, ExportButton, ReportLoading, ReportEmpty, MiniProgress } from './report-shell'
import { format } from 'date-fns'

interface Props { isAdmin: boolean }

export function AttendanceReport({ isAdmin }: Props) {
  const [data, setData] = useState<AttendanceSummaryRow[]>([])
  const [loading, setLoading] = useState(true)
  const [month, setMonth] = useState(format(new Date(), 'yyyy-MM'))

  async function load() {
    setLoading(true)
    const res = await getAttendanceSummaryReportAction({ month })
    setData(res.data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [month])

  const totalDays = data[0]?.total_working_days ?? 0
  const avgAttendance = data.length > 0
    ? Math.round(data.reduce((s, r) => s + r.attendance_rate, 0) / data.length)
    : 0
  const totalAbsent = data.reduce((s, r) => s + r.absent, 0)
  const totalLate = data.reduce((s, r) => s + r.late_150 + r.late_250, 0)

  return (
    <div className="space-y-5">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 text-sm">
          <label className="text-muted-foreground">Month</label>
          <input
            type="month" value={month}
            onChange={e => setMonth(e.target.value)}
            className="h-8 rounded-md border bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <div className="ml-auto">
          <ExportButton
            title="Attendance Summary Report"
            filename="attendance-summary"
            headers={['Member', 'On Time', 'Late (<1.5h)', 'Late (>2.5h)', 'Absent', 'No Record', 'Working Days', 'Attendance %']}
            buildRows={() => data.map(r => [
              r.user_name, r.on_time, r.late_150, r.late_250, r.absent, r.no_record, r.total_working_days, `${r.attendance_rate}%`,
            ])}
          />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Members" value={data.length} />
        <StatCard label="Working Days" value={totalDays} color="bg-blue-100 text-blue-700" />
        <StatCard label="Avg Attendance" value={`${avgAttendance}%`} color="bg-emerald-100 text-emerald-700" />
        <StatCard label="Total Absences" value={totalAbsent} color="bg-red-100 text-red-700" />
      </div>

      {/* Table */}
      {loading ? <ReportLoading /> : data.length === 0 ? <ReportEmpty /> : (
        <div className="rounded-xl border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Member</th>
                  <th className="text-center px-4 py-3 font-medium text-muted-foreground">On Time</th>
                  <th className="text-center px-4 py-3 font-medium text-muted-foreground">Late &lt;1.5h</th>
                  <th className="text-center px-4 py-3 font-medium text-muted-foreground">Late &gt;2.5h</th>
                  <th className="text-center px-4 py-3 font-medium text-muted-foreground">Absent</th>
                  <th className="text-center px-4 py-3 font-medium text-muted-foreground">No Record</th>
                  <th className="text-center px-4 py-3 font-medium text-muted-foreground">Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.sort((a, b) => b.attendance_rate - a.attendance_rate).map(r => (
                  <tr key={r.user_id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-medium">{r.user_name}</td>
                    <td className="px-4 py-3 text-center text-emerald-600 font-medium">{r.on_time}</td>
                    <td className="px-4 py-3 text-center text-amber-600">{r.late_150}</td>
                    <td className="px-4 py-3 text-center text-orange-600">{r.late_250}</td>
                    <td className="px-4 py-3 text-center text-red-600 font-medium">{r.absent}</td>
                    <td className="px-4 py-3 text-center text-muted-foreground">{r.no_record}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center">
                        <MiniProgress
                          value={r.attendance_rate}
                          color={r.attendance_rate >= 90 ? '#22c55e' : r.attendance_rate >= 75 ? '#f59e0b' : '#ef4444'}
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
