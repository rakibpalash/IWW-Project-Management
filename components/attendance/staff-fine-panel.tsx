'use client'

import { useState } from 'react'
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
import { reportFinePaymentAction } from '@/app/actions/attendance'
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

const STATUS_LABEL: Record<string, string> = {
  late_150: 'Late (L1)',
  late_250: 'Late (L2)',
}

interface PayDialogState {
  open: boolean
  recordId: string
  date: string
  amount: number
  existingTxnId: string | null
}

const EMPTY_DIALOG: PayDialogState = {
  open: false,
  recordId: '',
  date: '',
  amount: 0,
  existingTxnId: null,
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

  // All records with fines (any status except 'none')
  const fineRecords = allRecords
    .filter((r) => r.fine_amount > 0)
    .sort((a, b) => b.date.localeCompare(a.date))

  const pendingRecords = fineRecords.filter((r) => r.fine_status === 'pending')
  const reportedRecords = fineRecords.filter(
    (r) => r.fine_status === 'pending' && r.fine_reported_txn_id
  )
  const paidRecords = fineRecords.filter((r) => r.fine_status === 'paid')
  const waivedRecords = fineRecords.filter((r) => r.fine_status === 'waived')

  const pendingTotal = pendingRecords.reduce((s, r) => s + r.fine_amount, 0)
  const paidTotal = paidRecords.reduce((s, r) => s + r.fine_amount, 0)
  const unreportedPending = pendingRecords.filter((r) => !r.fine_reported_txn_id)

  if (fineRecords.length === 0) return null

  function openPayDialog(r: AttendanceRecord) {
    setDialog({
      open: true,
      recordId: r.id,
      date: r.date,
      amount: r.fine_amount,
      existingTxnId: r.fine_reported_txn_id,
    })
    setTxnId(r.fine_reported_txn_id ?? '')
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
    const result = await reportFinePaymentAction(dialog.recordId, txnId.trim())
    setSubmitting(false)
    if (result.success) {
      // Optimistically update the record
      const updated = allRecords.find((r) => r.id === dialog.recordId)
      if (updated) {
        onRecordUpdated({
          ...updated,
          fine_reported_txn_id: txnId.trim(),
          fine_reported_at: new Date().toISOString(),
        })
      }
      toast({ title: 'Payment reported!', description: 'Your manager has been notified to verify.' })
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
        unreportedPending.length > 0
          ? 'border-amber-200 bg-amber-50/30 dark:bg-amber-950/10'
          : 'border-border'
      )}>
        <CardHeader className="pb-0">
          {/* Summary header — always visible */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className={cn(
                'h-10 w-10 rounded-xl flex items-center justify-center shrink-0',
                unreportedPending.length > 0 ? 'bg-amber-100 text-amber-600' : 'bg-muted text-muted-foreground'
              )}>
                <Banknote className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base">
                  {unreportedPending.length > 0 ? 'Late Fines Outstanding' : 'Late Fines'}
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {unreportedPending.length > 0
                    ? `৳${pendingTotal} due from ${unreportedPending.length} day${unreportedPending.length !== 1 ? 's' : ''}`
                    : paidTotal > 0
                    ? `৳${paidTotal} paid · all clear`
                    : 'No pending fines'}
                </p>
              </div>
            </div>

            {/* Totals + expand toggle */}
            <div className="flex items-center gap-2 shrink-0">
              {unreportedPending.length > 0 && (
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

          {/* Quick action bar (unreported fines only) */}
          {unreportedPending.length > 0 && !expanded && (
            <div className="mt-3 flex items-center gap-2 flex-wrap">
              {settings?.org_bkash_number ? (
                <p className="text-xs text-amber-700">
                  Pay to bKash: <span className="font-semibold">{settings.org_bkash_number}</span>, then report the TxnID below.
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
                View Details & Pay
              </Button>
            </div>
          )}
        </CardHeader>

        {/* Expandable fine list */}
        {expanded && (
          <CardContent className="pt-4 space-y-2">
            {/* Pending (unreported) */}
            {unreportedPending.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Unpaid</p>
                {unreportedPending.map((r) => (
                  <FineRow
                    key={r.id}
                    record={r}
                    onPay={() => openPayDialog(r)}
                    orgBkash={settings?.org_bkash_number ?? null}
                    settings={settings}
                  />
                ))}
              </div>
            )}

            {/* Pending (reported — awaiting verification) */}
            {reportedRecords.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Awaiting Verification</p>
                {reportedRecords.map((r) => (
                  <FineRow
                    key={r.id}
                    record={r}
                    onPay={() => openPayDialog(r)}
                    orgBkash={settings?.org_bkash_number ?? null}
                    settings={settings}
                  />
                ))}
              </div>
            )}

            {/* Paid */}
            {paidRecords.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Paid</p>
                {paidRecords.map((r) => (
                  <FineRow key={r.id} record={r} onPay={() => {}} orgBkash={null} settings={settings} />
                ))}
              </div>
            )}

            {/* Waived */}
            {waivedRecords.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Waived</p>
                {waivedRecords.map((r) => (
                  <FineRow key={r.id} record={r} onPay={() => {}} orgBkash={null} settings={settings} />
                ))}
              </div>
            )}
          </CardContent>
        )}
      </Card>

      {/* bKash Payment Dialog */}
      <Dialog open={dialog.open} onOpenChange={(o) => { if (!o) closeDialog() }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Banknote className="h-4 w-4 text-amber-600" />
              Report bKash Payment
            </DialogTitle>
          </DialogHeader>

          {/* Fine summary */}
          <div className="rounded-lg border bg-amber-50/50 px-4 py-3 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Fine for</span>
              <span className="text-sm font-medium">{formatDate(dialog.date)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Amount</span>
              <span className="text-xl font-bold text-amber-700">৳{dialog.amount}</span>
            </div>
          </div>

          {/* Already reported */}
          {dialog.existingTxnId && (
            <div className="flex items-start gap-2 rounded-lg bg-blue-50 border border-blue-200 px-3 py-2.5">
              <AlertCircle className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
              <p className="text-xs text-blue-700">
                You previously reported TxnID <span className="font-semibold">{dialog.existingTxnId}</span>. You can update it below.
              </p>
            </div>
          )}

          {/* Step-by-step instructions */}
          <div className="space-y-3">
            {/* Step 1 */}
            <div className="flex gap-3">
              <div className="h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center shrink-0 font-bold">1</div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">Send payment via bKash</p>
                {settings?.org_bkash_number ? (
                  <div className="flex items-center gap-2 mt-1.5 rounded-lg border bg-muted px-3 py-2">
                    <span className="flex-1 font-semibold text-sm tabular-nums">{settings.org_bkash_number}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 shrink-0"
                      onClick={copyBkashNumber}
                      title="Copy number"
                    >
                      {copied ? (
                        <Check className="h-3.5 w-3.5 text-green-600" />
                      ) : (
                        <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                      )}
                    </Button>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground mt-1">
                    Contact your manager for the payment number.
                  </p>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  Send exactly <strong>৳{dialog.amount}</strong> and note the Transaction ID.
                </p>
              </div>
            </div>

            {/* Step 2 */}
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

            {/* Step 3 */}
            <div className="flex gap-3">
              <div className="h-6 w-6 rounded-full bg-muted text-muted-foreground text-xs flex items-center justify-center shrink-0 font-bold">3</div>
              <div className="flex-1">
                <p className="text-sm font-medium text-muted-foreground">Manager verifies & closes the fine</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Your manager will receive a notification to verify your TxnID.
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
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Report Payment
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

// ── Fine Row ───────────────────────────────────────────────────────────────────

function FineRow({
  record,
  onPay,
  orgBkash,
  settings,
}: {
  record: AttendanceRecord
  onPay: () => void
  orgBkash: string | null
  settings: AttendanceSettings | null
}) {
  const isReported = !!record.fine_reported_txn_id && record.fine_status === 'pending'
  const isPaid = record.fine_status === 'paid'
  const isWaived = record.fine_status === 'waived'

  // Compute minutes late so staff know exactly why the fine is what it is
  let minutesLate = 0
  if (record.check_in_time && settings && record.applied_rule !== 'holiday') {
    const onTimeEnd = getOnTimeEnd(record.applied_rule as any, settings)
    const [oh, om] = onTimeEnd.split(':').map(Number)
    const [ch, cm] = record.check_in_time.split(':').map(Number)
    minutesLate = Math.max(0, (ch * 60 + cm) - (oh * 60 + om))
  }

  return (
    <div className={cn(
      'flex items-center gap-3 rounded-lg border px-3 py-2.5',
      isReported ? 'bg-blue-50/50 border-blue-200' :
      isPaid ? 'bg-green-50/50 border-green-200' :
      isWaived ? 'bg-muted/40' : 'bg-card'
    )}>
      {/* Date + check-in */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-medium">{formatDate(record.date)}</p>
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
            {STATUS_LABEL[record.status] ?? record.status}
          </Badge>
          {minutesLate > 0 && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-amber-300 text-amber-600">
              {minutesLate} min late
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1.5 mt-0.5">
          <Clock className="h-3 w-3 text-muted-foreground/60" />
          <span className="text-xs text-muted-foreground">
            Checked in at {formatTime12(record.check_in_time)}
          </span>
        </div>
        {/* TxnID reported */}
        {isReported && (
          <p className="text-xs text-blue-600 mt-1 flex items-center gap-1">
            <Send className="h-3 w-3" />
            Reported TxnID: <span className="font-semibold font-mono">{record.fine_reported_txn_id}</span>
          </p>
        )}
        {/* Paid with method */}
        {isPaid && record.fine_payment_method && (
          <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" />
            Paid via {record.fine_payment_method === 'bkash' ? 'bKash' :
                       record.fine_payment_method === 'bank' ? 'Bank Transfer' :
                       record.fine_payment_method === 'salary_deduction' ? 'Salary Deduction' : 'Cash'}
            {record.fine_bkash_txn_id && (
              <span className="font-mono ml-1">({record.fine_bkash_txn_id})</span>
            )}
          </p>
        )}
        {/* Waived reason */}
        {isWaived && record.fine_waived_reason && (
          <p className="text-xs text-muted-foreground mt-1">
            Reason: {record.fine_waived_reason}
          </p>
        )}
      </div>

      {/* Amount + action */}
      <div className="flex items-center gap-2 shrink-0">
        <div className="text-right">
          <p className={cn(
            'text-base font-bold tabular-nums',
            isReported ? 'text-blue-600' :
            isPaid ? 'text-green-600' :
            isWaived ? 'text-muted-foreground line-through' :
            'text-amber-600'
          )}>
            ৳{record.fine_amount}
          </p>
        </div>

        {/* Status badge / action button */}
        {isReported ? (
          <div className="flex flex-col items-end gap-1">
            <Badge className="text-[10px] bg-blue-100 text-blue-700 border-blue-200">
              Awaiting Verification
            </Badge>
            <button
              onClick={onPay}
              className="text-[10px] text-blue-500 hover:text-blue-700 underline"
            >
              Update TxnID
            </button>
          </div>
        ) : isPaid ? (
          <Badge className="text-[10px] bg-green-100 text-green-700 border-green-200">
            <CheckCircle2 className="h-3 w-3 mr-1" /> Paid
          </Badge>
        ) : isWaived ? (
          <Badge className="text-[10px] bg-muted text-muted-foreground">
            Waived
          </Badge>
        ) : (
          <Button
            size="sm"
            className="h-7 text-xs gap-1.5 bg-amber-600 hover:bg-amber-700"
            onClick={onPay}
          >
            <Banknote className="h-3.5 w-3.5" />
            Pay via bKash
          </Button>
        )}
      </div>
    </div>
  )
}
