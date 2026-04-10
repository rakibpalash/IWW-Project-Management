'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Banknote, ChevronLeft, ChevronRight, CheckCircle2, Download, Loader2 } from 'lucide-react'
import { getMonthlyFinesSummaryAction, getMonthlyFinesDetailAction } from '@/app/actions/attendance'
import { cn } from '@/lib/utils'

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function getInitials(name: string) {
  return name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()
}

export function FinesSummaryCard() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [rows, setRows] = useState<Awaited<ReturnType<typeof getMonthlyFinesSummaryAction>>['data']>([])

  useEffect(() => {
    setLoading(true)
    getMonthlyFinesSummaryAction(year, month).then(({ data }) => {
      setRows(data ?? [])
      setLoading(false)
    })
  }, [year, month])

  const navigateMonth = (delta: number) => {
    const d = new Date(year, month - 1 + delta, 1)
    setYear(d.getFullYear())
    setMonth(d.getMonth() + 1)
  }

  const exportReport = async () => {
    setExporting(true)
    const { data } = await getMonthlyFinesDetailAction(year, month)
    setExporting(false)
    if (!data || data.length === 0) return

    const STATUS_LABELS: Record<string, string> = {
      pending: 'Pending', paid: 'Paid', waived: 'Waived', none: 'None',
    }
    const METHOD_LABELS: Record<string, string> = {
      cash: 'Cash', bkash: 'bKash', bank: 'Bank Transfer', salary_deduction: 'Salary Deduction',
    }

    const headers = ['Name', 'Date', 'Check-in', 'Status', 'Fine (BDT)', 'Fine Status', 'Payment Method', 'bKash TxnID', 'Waive Reason']
    const csvRows = data.map((r) => [
      `"${r.fullName}"`,
      r.date,
      r.checkInTime ?? '-',
      r.status,
      r.fineAmount,
      STATUS_LABELS[r.fineStatus] ?? r.fineStatus,
      r.paymentMethod ? (METHOD_LABELS[r.paymentMethod] ?? r.paymentMethod) : '-',
      r.bkashTxnId ?? '-',
      r.waivedReason ? `"${r.waivedReason}"` : '-',
    ])

    const csv = [headers.join(','), ...csvRows.map((r) => r.join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `fine-report-${year}-${String(month).padStart(2, '0')}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const totalPending = rows?.reduce((s, r) => s + r.pendingTotal, 0) ?? 0
  const totalPaid    = rows?.reduce((s, r) => s + r.paidTotal,    0) ?? 0
  const totalWaived  = rows?.reduce((s, r) => s + r.waivedTotal,  0) ?? 0
  const staffWithFines = rows?.filter((r) => r.pendingTotal > 0).length ?? 0

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Banknote className="h-4 w-4" />
            Late Fines Summary
          </CardTitle>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => navigateMonth(-1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium w-28 text-center">
              {MONTH_NAMES[month - 1]} {year}
            </span>
            <Button
              variant="ghost" size="icon" className="h-7 w-7"
              onClick={() => navigateMonth(1)}
              disabled={year === now.getFullYear() && month === now.getMonth() + 1}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              title="Export monthly fine report as CSV"
              onClick={exportReport}
              disabled={exporting || loading}
            >
              {exporting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Download className="h-3.5 w-3.5" />
              )}
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Top stats */}
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-lg border bg-amber-50 border-amber-200 px-3 py-2 text-center">
            <p className="text-[10px] text-amber-700 uppercase tracking-wide font-medium">Pending</p>
            <p className="text-lg font-bold text-amber-700">৳{totalPending}</p>
            <p className="text-[10px] text-amber-600">{staffWithFines} staff</p>
          </div>
          <div className="rounded-lg border bg-green-50 border-green-200 px-3 py-2 text-center">
            <p className="text-[10px] text-green-700 uppercase tracking-wide font-medium">Collected</p>
            <p className="text-lg font-bold text-green-700">৳{totalPaid}</p>
          </div>
          <div className="rounded-lg border bg-muted px-3 py-2 text-center">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">Waived</p>
            <p className="text-lg font-bold text-muted-foreground">৳{totalWaived}</p>
          </div>
        </div>

        {/* Per-staff breakdown */}
        {loading ? (
          <div className="flex justify-center py-4">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : rows?.length === 0 ? (
          <div className="flex flex-col items-center gap-1 py-4 text-center">
            <CheckCircle2 className="h-8 w-8 text-green-500" />
            <p className="text-sm font-medium text-green-700">No late fines this month</p>
          </div>
        ) : (
          <div className="space-y-2">
            {rows?.map((row) => (
              <div key={row.userId} className="flex items-center gap-3 rounded-lg border px-3 py-2.5">
                <Avatar className="h-7 w-7 shrink-0">
                  <AvatarFallback className="text-[10px] font-semibold">{getInitials(row.fullName)}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{row.fullName}</p>
                  <p className="text-xs text-muted-foreground">{row.pendingCount} late day{row.pendingCount !== 1 ? 's' : ''}</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {row.pendingTotal > 0 && (
                    <Badge className="text-xs bg-amber-100 text-amber-700 border-amber-200">
                      ৳{row.pendingTotal} due
                    </Badge>
                  )}
                  {row.paidTotal > 0 && (
                    <Badge className="text-xs bg-green-100 text-green-700 border-green-200">
                      ৳{row.paidTotal} paid
                    </Badge>
                  )}
                  {row.waivedTotal > 0 && (
                    <Badge className="text-xs bg-muted text-muted-foreground">
                      ৳{row.waivedTotal} waived
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
