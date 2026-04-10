'use client'

import { useState, useEffect } from 'react'
import { getLeaveUsageReportAction, LeaveUsageRow } from '@/app/actions/reports'
import { StatCard, ExportButton, ReportLoading, ReportEmpty } from './report-shell'

interface Props { isAdmin: boolean }

export function LeaveReport({ isAdmin }: Props) {
  const [data, setData] = useState<LeaveUsageRow[]>([])
  const [loading, setLoading] = useState(true)
  const [year, setYear] = useState(new Date().getFullYear())

  async function load() {
    setLoading(true)
    const res = await getLeaveUsageReportAction({ year })
    setData(res.data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [year])

  const totalYearlyUsed = data.reduce((s, r) => s + r.yearly_used, 0)
  const totalWfhUsed = data.reduce((s, r) => s + r.wfh_used, 0)
  const avgUtilization = data.length > 0
    ? Math.round(data.reduce((s, r) => s + (r.yearly_total > 0 ? (r.yearly_used / r.yearly_total) * 100 : 0), 0) / data.length)
    : 0

  const currentYear = new Date().getFullYear()
  const yearOptions = [currentYear - 1, currentYear, currentYear + 1]

  return (
    <div className="space-y-5">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 text-sm">
          <label className="text-muted-foreground">Year</label>
          <select
            value={year}
            onChange={e => setYear(Number(e.target.value))}
            className="h-8 rounded-md border bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          >
            {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div className="ml-auto">
          <ExportButton
            title="Leave Usage Report"
            filename="leave-usage"
            headers={['Member', 'Email', 'Annual Allowed', 'Annual Additional', 'Annual Total', 'Annual Used', 'Annual Remaining', 'WFH Allowed', 'WFH Additional', 'WFH Total', 'WFH Used', 'WFH Remaining', 'Marriage Used']}
            buildRows={() => data.map(r => [
              r.user_name, r.user_email,
              r.yearly_base, r.yearly_additional, r.yearly_total, r.yearly_used, r.yearly_remaining,
              r.wfh_base, r.wfh_additional, r.wfh_total, r.wfh_used, r.wfh_remaining,
              r.marriage_used,
            ])}
          />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Members" value={data.length} />
        <StatCard label="Annual Days Used" value={totalYearlyUsed} color="bg-blue-100 text-blue-700" />
        <StatCard label="WFH Days Used" value={totalWfhUsed} color="bg-purple-100 text-purple-700" />
        <StatCard label="Avg Utilization" value={`${avgUtilization}%`} color="bg-amber-100 text-amber-700" />
      </div>

      {/* Table */}
      {loading ? <ReportLoading /> : data.length === 0 ? <ReportEmpty /> : (
        <div className="rounded-xl border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 border-b">
                <tr>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground" rowSpan={2}>Member</th>
                  <th className="text-center px-2 py-1.5 font-medium text-muted-foreground text-xs border-l" colSpan={5}>Annual Leave</th>
                  <th className="text-center px-2 py-1.5 font-medium text-muted-foreground text-xs border-l" colSpan={5}>WFH</th>
                  <th className="text-center px-2 py-1.5 font-medium text-muted-foreground text-xs border-l" colSpan={2}>Marriage</th>
                </tr>
                <tr className="border-t bg-muted/20">
                  <th className="text-center px-3 py-1.5 text-xs font-medium text-muted-foreground border-l">Allowed</th>
                  <th className="text-center px-3 py-1.5 text-xs font-medium text-muted-foreground">+Additional</th>
                  <th className="text-center px-3 py-1.5 text-xs font-medium text-muted-foreground">Total</th>
                  <th className="text-center px-3 py-1.5 text-xs font-medium text-muted-foreground">Taken</th>
                  <th className="text-center px-3 py-1.5 text-xs font-medium text-muted-foreground">Remaining</th>
                  <th className="text-center px-3 py-1.5 text-xs font-medium text-muted-foreground border-l">Allowed</th>
                  <th className="text-center px-3 py-1.5 text-xs font-medium text-muted-foreground">+Additional</th>
                  <th className="text-center px-3 py-1.5 text-xs font-medium text-muted-foreground">Total</th>
                  <th className="text-center px-3 py-1.5 text-xs font-medium text-muted-foreground">Taken</th>
                  <th className="text-center px-3 py-1.5 text-xs font-medium text-muted-foreground">Remaining</th>
                  <th className="text-center px-3 py-1.5 text-xs font-medium text-muted-foreground border-l">Total</th>
                  <th className="text-center px-3 py-1.5 text-xs font-medium text-muted-foreground">Taken</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.map(r => (
                  <tr key={r.user_id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium">{r.user_name}</div>
                      <div className="text-xs text-muted-foreground">{r.user_email}</div>
                    </td>
                    <td className="px-3 py-3 text-center text-muted-foreground border-l">{r.yearly_base}</td>
                    <td className="px-3 py-3 text-center">
                      {r.yearly_additional > 0
                        ? <span className="font-medium text-violet-600">+{r.yearly_additional}</span>
                        : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-3 py-3 text-center text-muted-foreground">{r.yearly_total}</td>
                    <td className="px-3 py-3 text-center font-medium">{r.yearly_used}</td>
                    <td className="px-3 py-3 text-center">
                      <span className={r.yearly_remaining <= 2 ? 'text-red-600 font-semibold' : 'text-emerald-600 font-medium'}>
                        {r.yearly_remaining}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-center text-muted-foreground border-l">{r.wfh_base}</td>
                    <td className="px-3 py-3 text-center">
                      {r.wfh_additional > 0
                        ? <span className="font-medium text-violet-600">+{r.wfh_additional}</span>
                        : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-3 py-3 text-center text-muted-foreground">{r.wfh_total}</td>
                    <td className="px-3 py-3 text-center font-medium">{r.wfh_used}</td>
                    <td className="px-3 py-3 text-center">
                      <span className={r.wfh_remaining <= 1 ? 'text-red-600 font-semibold' : 'text-emerald-600 font-medium'}>
                        {r.wfh_remaining}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-center text-muted-foreground border-l">
                      {r.marriage_total > 0 ? r.marriage_total : <span className="text-xs">—</span>}
                    </td>
                    <td className="px-3 py-3 text-center">
                      {r.marriage_total > 0 ? <span className="font-medium">{r.marriage_used}</span> : <span className="text-muted-foreground text-xs">—</span>}
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
