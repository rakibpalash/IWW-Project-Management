'use client'

import { useState, useMemo } from 'react'
import { AttendanceRecord, AttendanceSettings } from '@/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Banknote,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Clock,
  Loader2,
  Send,
  AlertCircle,
  Copy,
  Check,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { reportMonthlyFinePaymentAction } from '@/app/actions/attendance'
import { useToast } from '@/components/ui/use-toast'
import { getOnTimeEnd } from '@/lib/attendance-rules'

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatTime12(t: string | null | undefined) {
  if (!t) return '—'
  const [h, m] = t.split(':').map(Number)
  const p = h >= 12 ? 'PM' : 'AM'
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${String(h12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${p}`
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function formatMonthYear(year: number, month: number) {
  return new Date(year, month - 1).toLocaleString('en', { month: 'long', year: 'numeric' })
}

const STATUS_LABEL: Record<string, string> = {
  late_150: 'Late (L1)',
  late_250: 'Late (L2)',
}

const MONTH_NAMES = [
  '', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

interface PayDialogState {
  open: boolean
  year: number
  month: number
  totalAmount: number
  count: number
  existingTxnId: string | null
}

const EMPTY_DIALOG: PayDialogState = {
  open: false, year: 0, month: 0, totalAmount: 0, count: 0, existingTxnId: null,
}

interface StaffFinePanelProps {
  allRecords: AttendanceRecord[]
  settings: AttendanceSettings | null
  onRecordUpdated: (updatedRecord: AttendanceRecord) => void
}

export function StaffFinePanel({ allRecords, settings, onRecordUpdated }: StaffFinePanelProps) {
  const [expanded, setExpanded] = useState(false)
  const [dialog, setDialog] = useState<PayDialogState>(EMPTY_DIALOG)
  const [txnId, setTxnId] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [copied, setCopied] = useState(false)
  const { toast } = useToast()

  // All records with fines
  const fineRecords = allRecords
    .filter((r) => r.fine_amount > 0)
    .sort((a, b) => b.date.localeCompare(a.date))

  const pendingRecords = fineRecords.filter((r) => r.fine_status === 'pending')
  const paidRecords    = fineRecords.filter((r) => r.fine_status === 'paid')
  const waivedRecords  = fineRecords.filter((r) => r.fine_status === 'waived')

  const pendingTotal = pendingRecords.reduce((s, r) => s + r.fine_amount, 0)
  const paidTotal    = paidRecords.reduce((s, r) => s + r.fine_amount, 0)

  // Group pending records by month
  const pendingByMonth = useMemo(() => {
    const map = new Map<string, {
      year: number
      month: number
      key: string
      records: AttendanceRecord[]
      total: number
      unreported: AttendanceRecord[]
      reported: AttendanceRecord[]
      txnId: string | null
    }>()

    for (const r of pendingRecords) {
      const [y, m] = r.date.split('-').map(Number)
      const key = `${y}-${String(m).padStart(2, '0')}`
      if (!map.has(key)) {
        map.set(key, { year: y, month: m, key, records: [], total: 0, unreported: [], reported: [], txnId: null })
      }
      const g = map.get(key)!
      g.records.push(r)
      g.total += r.fine_amount
      if (r.fine_reported_txn_id) {
        g.reported.push(r)
        g.txnId = r.fine_reported_txn_id
      } else {
        g.unreported.push(r)
      }
    }

    return Array.from(map.values()).sort((a, b) => b.key.localeCompare(a.key))
  }, [pendingRecords])

  const hasUnreportedMonths = pendingByMonth.some((g) => g.unreported.length > 0)

  if (fineRecords.length === 0) return null

  function openPayDialog(g: typeof pendingByMonth[number]) {
    setDialog({
      open: true,
      year: g.year,
      month: g.month,
      totalAmount: g.total,
      count: g.records.length,
      existingTxnId: g.txnId,
    })
    setTxnId(g.txnId ?? '')
  }

  function closeDialog() {
    setDialog(EMPTY_DIALOG)
    setTxnId('')
  }

  async function handleSubmit() {
    if (!txnId.trim()) {
      toast({ title: 'Enter your bKash Transaction ID', variant: 'destructive' })
      return
    }
    setSubmitting(true)
    const result = await reportMonthlyFinePaymentAction(dialog.year, dialog.month, txnId.trim())
    setSubmitting(false)
    if (result.success) {
      // Optimistically update all pending records for this month
      const monthStr = `${dialog.year}-${String(dialog.month).padStart(2, '0')}`
      for (const r of allRecords) {
        if (r.fine_status === 'pending' && r.fine_amount > 0 && r.date.startsWith(monthStr)) {
          onRecordUpdated({
            ...r,
            fine_reported_txn_id: txnId.trim(),
            fine_reported_at: new Date().toISOString(),
          })
        }
      }
      toast({
        title: 'Payment reported!',
        description: `${result.count} fine(s) for ${MONTH_NAMES[dialog.month]} ${dialog.year} sent for verification.`,
      })
      closeDialog()
    } else {
      toast({ title: 'Failed to report', description: result.error, variant: 'destructive' })
    }
  }

  function copyBkashNumber() {
    if (!settings?.org_bkash_number) return
    navigator.clipboard.writeText(settings.org_bkash_number)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <>
      <Card className={cn(
        'border-2 transition-colors',
        hasUnreportedMonths
          ? 'border-amber-200 bg-amber-50/30 dark:bg-amber-950/10'
          : 'border-border'
      )}>
        <CardHeader className="pb-0">
          {/* Summary header */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className={cn(
                'h-10 w-10 rounded-xl flex items-center justify-center shrink-0',
                hasUnreportedMonths ? 'bg-amber-100 text-amber-600' : 'bg-muted text-muted-foreground'
              )}>
                <Banknote className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base">
                  {hasUnreportedMonths ? 'Late Fines Outstanding' : 'Late Fines'}
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {hasUnreportedMonths
                    ? `৳${pendingTotal} due · paid once per month`
                    : paidTotal > 0
                    ? `৳${paidTotal} paid · all clear`
                    : 'No pending fines'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {hasUnreportedMonths && (
                <div className="text-right">
                  <p className="text-xl font-bold text-amber-600">৳{pendingTotal}</p>
                  <p className="text-[10px] text-amber-500 uppercase tracking-wide">Pending</p>
                </div>
              )}
              {paidTotal > 0 && (
                <div className="text-right">
                  <p className="text-sm font-semibold text-green-600">৳{paidTotal}</p>
                  <p className="text-[10px] text-green-500 uppercase tracking-wide">Paid</p>
                </div>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setExpanded((v) => !v)}
              >
                {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          {/* Quick action hint */}
          {hasUnreportedMonths && !expanded && (
            <div className="mt-3 flex items-center gap-2 flex-wrap">
              {settings?.org_bkash_number ? (
                <p className="text-xs text-amber-700">
                  Pay monthly total to bKash <span className="font-semibold">{settings.org_bkash_number}</span>, then report the TxnID.
                </p>
              ) : (
                <p className="text-xs text-amber-700">Contact your manager to arrange payment.</p>
              )}
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs border-amber-300 text-amber-700 hover:bg-amber-100"
                onClick={() => setExpanded(true)}
              >
                View & Pay
              </Button>
            </div>
          )}
        </CardHeader>

        {/* Expandable content */}
        {expanded && (
          <CardContent className="pt-4 space-y-4">

            {/* Pending — grouped by month */}
            {pendingByMonth.length > 0 && (
              <div className="space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Pending Payment</p>
                {pendingByMonth.map((g) => {
                  const allReported = g.unreported.length === 0
                  return (
                    <div key={g.key} className={cn(
                      'rounded-lg border px-3 py-3 space-y-2',
                      allReported ? 'bg-blue-50/50 border-blue-200' : 'bg-amber-50/40 border-amber-200'
                    )}>
                      {/* Month header */}
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold">{formatMonthYear(g.year, g.month)}</p>
                          <p className="text-xs text-muted-foreground">{g.records.length} late day{g.records.length !== 1 ? 's' : ''}</p>
                        </div>
                        <div className="text-right">
                          <p className={cn('text-lg font-bold', allReported ? 'text-blue-600' : 'text-amber-600')}>
                            ৳{g.total}
                          </p>
                          {allReported ? (
                            <Badge className="text-[10px] bg-blue-100 text-blue-700 border-blue-200">
                              Awaiting Verification
                            </Badge>
                          ) : (
                            <p className="text-[10px] text-amber-500 uppercase tracking-wide">Total Due</p>
                          )}
                        </div>
                      </div>

                      {/* Days breakdown */}
                      <div className="space-y-1">
                        {g.records.map((r) => (
                          <DayRow key={r.id} record={r} settings={settings} />
                        ))}
                      </div>

                      {/* TxnID if reported */}
                      {allReported && g.txnId && (
                        <div className="flex items-start gap-1.5 text-xs text-blue-600">
                          <Send className="h-3 w-3 mt-0.5 shrink-0" />
                          <span>Reported TxnID: <span className="font-mono font-semibold">{g.txnId}</span></span>
                        </div>
                      )}

                      {/* Pay / Update button */}
                      <Button
                        size="sm"
                        onClick={() => openPayDialog(g)}
                        className={cn(
                          'w-full h-8 text-xs gap-1.5',
                          allReported
                            ? 'bg-blue-600 hover:bg-blue-700'
                            : 'bg-amber-600 hover:bg-amber-700'
                        )}
                      >
                        <Banknote className="h-3.5 w-3.5" />
                        {allReported ? `Update TxnID for ${MONTH_NAMES[g.month]}` : `Pay ৳${g.total} for ${MONTH_NAMES[g.month]}`}
                      </Button>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Paid */}
            {paidRecords.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Paid</p>
                {paidRecords.map((r) => (
                  <PaidRow key={r.id} record={r} settings={settings} />
                ))}
              </div>
            )}

            {/* Waived */}
            {waivedRecords.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Waived</p>
                {waivedRecords.map((r) => (
                  <PaidRow key={r.id} record={r} settings={settings} />
                ))}
              </div>
            )}
          </CardContent>
        )}
      </Card>

      {/* Monthly bKash Payment Dialog */}
      <Dialog open={dialog.open} onOpenChange={(o) => { if (!o) closeDialog() }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Banknote className="h-4 w-4 text-amber-600" />
              Report Monthly Fine Payment
            </DialogTitle>
          </DialogHeader>

          {/* Month summary */}
          <div className="rounded-lg border bg-amber-50/50 px-4 py-3 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Month</span>
              <span className="text-sm font-medium">{MONTH_NAMES[dialog.month]} {dialog.year}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Late days</span>
              <span className="text-sm font-medium">{dialog.count} day{dialog.count !== 1 ? 's' : ''}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Total amount</span>
              <span className="text-xl font-bold text-amber-700">৳{dialog.totalAmount}</span>
            </div>
          </div>

          {/* Already reported notice */}
          {dialog.existingTxnId && (
            <div className="flex items-start gap-2 rounded-lg bg-blue-50 border border-blue-200 px-3 py-2.5">
              <AlertCircle className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
              <p className="text-xs text-blue-700">
                Previously reported TxnID: <span className="font-semibold font-mono">{dialog.existingTxnId}</span>. You can update it below.
              </p>
            </div>
          )}

          {/* Steps */}
          <div className="space-y-3">
            <div className="flex gap-3">
              <div className="h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center shrink-0 font-bold">1</div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">Send ৳{dialog.totalAmount} via bKash</p>
                {settings?.org_bkash_number ? (
                  <div className="flex items-center gap-2 mt-1.5 rounded-lg border bg-muted px-3 py-2">
                    <span className="flex-1 font-semibold text-sm tabular-nums">{settings.org_bkash_number}</span>
                    <Button
                      variant="ghost" size="icon" className="h-6 w-6 shrink-0"
                      onClick={copyBkashNumber}
                    >
                      {copied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5 text-muted-foreground" />}
                    </Button>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground mt-1">Contact your manager for the payment number.</p>
                )}
              </div>
            </div>

            <div className="flex gap-3">
              <div className="h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center shrink-0 font-bold">2</div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">Enter your Transaction ID</p>
                <Input
                  className="mt-1.5 font-mono"
                  placeholder="e.g. 8N7K3S9L"
                  value={txnId}
                  onChange={(e) => setTxnId(e.target.value.toUpperCase())}
                  maxLength={30}
                />
              </div>
            </div>

            <div className="flex gap-3">
              <div className="h-6 w-6 rounded-full bg-muted text-muted-foreground text-xs flex items-center justify-center shrink-0 font-bold">3</div>
              <div className="flex-1">
                <p className="text-sm font-medium text-muted-foreground">Manager verifies & closes all fines</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  All {dialog.count} fine(s) for {MONTH_NAMES[dialog.month]} will be marked paid at once.
                </p>
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={closeDialog} disabled={submitting} className="flex-1">
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={submitting || !txnId.trim()}
              className="flex-1 gap-2 bg-amber-600 hover:bg-amber-700"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Report Payment
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

// ── Day row (inside month group — pending) ────────────────────────────────────

function DayRow({ record, settings }: { record: AttendanceRecord; settings: AttendanceSettings | null }) {
  let minutesLate = 0
  if (record.check_in_time && settings && record.applied_rule !== 'holiday') {
    const onTimeEnd = getOnTimeEnd(record.applied_rule as any, settings)
    const [oh, om] = onTimeEnd.split(':').map(Number)
    const [ch, cm] = record.check_in_time.split(':').map(Number)
    minutesLate = Math.max(0, (ch * 60 + cm) - (oh * 60 + om))
  }

  return (
    <div className="flex items-center gap-2 text-xs py-1 border-t border-dashed border-muted first:border-0">
      <div className="flex-1 flex items-center gap-1.5 flex-wrap">
        <span className="font-medium">{formatDate(record.date)}</span>
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
          {STATUS_LABEL[record.status] ?? record.status}
        </Badge>
        {minutesLate > 0 && (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-amber-300 text-amber-600">
            {minutesLate} min late
          </Badge>
        )}
      </div>
      <div className="flex items-center gap-1 text-muted-foreground shrink-0">
        <Clock className="h-3 w-3" />
        <span>{formatTime12(record.check_in_time)}</span>
      </div>
      <span className="font-semibold text-amber-600 shrink-0">৳{record.fine_amount}</span>
    </div>
  )
}

// ── Paid / Waived row ─────────────────────────────────────────────────────────

function PaidRow({ record, settings }: { record: AttendanceRecord; settings: AttendanceSettings | null }) {
  const isPaid = record.fine_status === 'paid'
  const isWaived = record.fine_status === 'waived'

  return (
    <div className={cn(
      'flex items-center gap-3 rounded-lg border px-3 py-2.5',
      isPaid ? 'bg-green-50/50 border-green-200' : 'bg-muted/40'
    )}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-medium">{formatDate(record.date)}</p>
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
            {STATUS_LABEL[record.status] ?? record.status}
          </Badge>
        </div>
        <div className="flex items-center gap-1.5 mt-0.5">
          <Clock className="h-3 w-3 text-muted-foreground/60" />
          <span className="text-xs text-muted-foreground">Checked in at {formatTime12(record.check_in_time)}</span>
        </div>
        {isPaid && record.fine_payment_method && (
          <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" />
            Paid via {record.fine_payment_method === 'bkash' ? 'bKash' : record.fine_payment_method}
            {record.fine_bkash_txn_id && <span className="font-mono ml-1">({record.fine_bkash_txn_id})</span>}
          </p>
        )}
        {isWaived && record.fine_waived_reason && (
          <p className="text-xs text-muted-foreground mt-1">Reason: {record.fine_waived_reason}</p>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <p className={cn('text-base font-bold tabular-nums', isPaid ? 'text-green-600' : 'text-muted-foreground line-through')}>
          ৳{record.fine_amount}
        </p>
        {isPaid ? (
          <Badge className="text-[10px] bg-green-100 text-green-700 border-green-200">
            <CheckCircle2 className="h-3 w-3 mr-1" /> Paid
          </Badge>
        ) : (
          <Badge className="text-[10px] bg-muted text-muted-foreground">Waived</Badge>
        )}
      </div>
    </div>
  )
}
