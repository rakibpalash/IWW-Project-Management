'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { format, parseISO, isWeekend, eachDayOfInterval } from 'date-fns'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Loader2, CheckCircle2 } from 'lucide-react'
import { LeaveBalance, OptionalLeave } from '@/types'
import { applyLeaveAction, applyOptionalLeaveAction } from '@/app/actions/leave'

interface ApplyLeaveDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  balance: LeaveBalance | null
  optionalLeaves?: OptionalLeave[]
}

function countWorkdays(start: string, end: string): number {
  if (!start || !end) return 0
  try {
    const days = eachDayOfInterval({ start: parseISO(start), end: parseISO(end) })
    return days.filter((d) => !isWeekend(d)).length
  } catch {
    return 0
  }
}

// Same fallback defaults as StaffView in leave-page.tsx
const DEFAULTS = {
  yearly_total: 18,
  yearly_used: 0,
  wfh_total: 10,
  wfh_used: 0,
  marriage_total: 0,
  marriage_used: 0,
}

const STANDARD_TYPES = ['yearly', 'work_from_home', 'marriage']

export function ApplyLeaveDialog({ open, onOpenChange, balance, optionalLeaves = [] }: ApplyLeaveDialogProps) {
  const router = useRouter()

  // selectedType = 'yearly' | 'work_from_home' | 'marriage' | <optional-leave-uuid>
  const [selectedType, setSelectedType] = useState('yearly')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const isOptional = !STANDARD_TYPES.includes(selectedType)
  const optionalLeave = isOptional ? optionalLeaves.find((l) => l.id === selectedType) : null

  const totalDays = countWorkdays(startDate, endDate)

  const getBalanceInfo = () => {
    if (isOptional && optionalLeave) {
      const total = optionalLeave.total_days
      const used = optionalLeave.used_days ?? 0
      return { total, used, remaining: Math.max(0, total - used) }
    }
    if (selectedType === 'yearly') {
      const total = balance?.yearly_total ?? DEFAULTS.yearly_total
      const used = balance?.yearly_used ?? DEFAULTS.yearly_used
      return { total, used, remaining: Math.max(0, total - used) }
    }
    if (selectedType === 'work_from_home') {
      const total = balance?.wfh_total ?? DEFAULTS.wfh_total
      const used = balance?.wfh_used ?? DEFAULTS.wfh_used
      return { total, used, remaining: Math.max(0, total - used) }
    }
    if (selectedType === 'marriage') {
      const total = balance?.marriage_total ?? DEFAULTS.marriage_total
      const used = balance?.marriage_used ?? DEFAULTS.marriage_used
      return { total, used, remaining: Math.max(0, total - used) }
    }
    return { total: 0, used: 0, remaining: 0 }
  }

  const { total, used, remaining } = getBalanceInfo()

  const validate = (): string | null => {
    if (!startDate) return 'Please select a start date'
    if (!endDate) return 'Please select an end date'
    if (endDate < startDate) return 'End date must be after start date'
    if (totalDays === 0) return 'Selected dates include no working days'
    if (selectedType === 'marriage' && total === 0) {
      return 'No marriage leave allocated. Please contact admin.'
    }
    if (totalDays > remaining) {
      return `Insufficient balance. You have ${remaining} day(s) available but requested ${totalDays}`
    }
    return null
  }

  const handleSubmit = async () => {
    const validationError = validate()
    if (validationError) { setError(validationError); return }

    setLoading(true)
    setError(null)

    let result: { success: boolean; error?: string }

    if (isOptional && optionalLeave) {
      result = await applyOptionalLeaveAction({
        optionalLeaveId: optionalLeave.id,
        startDate,
        endDate,
        totalDays,
        reason,
      })
    } else {
      result = await applyLeaveAction({
        leave_type: selectedType,
        start_date: startDate,
        end_date: endDate,
        total_days: totalDays,
        reason,
      })
    }

    setLoading(false)

    if (!result.success) {
      setError(result.error ?? 'Failed to submit leave request')
      return
    }

    setSuccess(true)
    setTimeout(() => {
      setSuccess(false)
      onOpenChange(false)
      router.refresh()
      setSelectedType('yearly')
      setStartDate('')
      setEndDate('')
      setReason('')
    }, 1500)
  }

  const handleClose = () => {
    if (!loading) {
      onOpenChange(false)
      setError(null)
      setSuccess(false)
    }
  }

  const today = format(new Date(), 'yyyy-MM-dd')
  const isOverBalance = totalDays > 0 && totalDays > remaining

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Apply for Leave</DialogTitle>
        </DialogHeader>

        {success ? (
          <div className="flex flex-col items-center gap-3 py-6">
            <CheckCircle2 className="h-12 w-12 text-green-500" />
            <p className="text-center font-medium text-green-700">
              Leave request submitted successfully!
            </p>
            <p className="text-center text-sm text-muted-foreground">
              {totalDays} working day(s) requested
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label>Leave Type</Label>
              <Select
                value={selectedType}
                onValueChange={(v) => { setSelectedType(v); setError(null) }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {/* Standard leave types */}
                  <SelectItem value="yearly">Annual Leave</SelectItem>
                  <SelectItem value="work_from_home">Work From Home</SelectItem>
                  <SelectItem value="marriage">Marriage Leave</SelectItem>

                  {/* Optional leaves granted by admin */}
                  {optionalLeaves.length > 0 && (
                    <>
                      <div className="mx-2 my-1 border-t" />
                      <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Special Leaves
                      </div>
                      {optionalLeaves.map((ol) => (
                        <SelectItem key={ol.id} value={ol.id}>
                          <span className="flex items-center gap-2">
                            <span>{ol.name}</span>
                            <span className="text-xs text-muted-foreground">
                              ({Math.max(0, ol.total_days - (ol.used_days ?? 0))} remaining)
                            </span>
                          </span>
                        </SelectItem>
                      ))}
                    </>
                  )}
                </SelectContent>
              </Select>

              {/* Balance summary row */}
              <div className="grid grid-cols-3 gap-2 rounded-md border bg-muted/30 px-3 py-2 text-center text-xs">
                <div>
                  <p className="font-semibold text-foreground">{total}</p>
                  <p className="text-muted-foreground">Total</p>
                </div>
                <div>
                  <p className="font-semibold text-amber-600">{used}</p>
                  <p className="text-muted-foreground">Used</p>
                </div>
                <div>
                  <p className={`font-semibold ${remaining === 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {remaining}
                  </p>
                  <p className="text-muted-foreground">Available</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Start Date</Label>
                <Input
                  type="date"
                  value={startDate}
                  min={today}
                  onChange={(e) => {
                    setStartDate(e.target.value)
                    if (endDate && e.target.value > endDate) setEndDate(e.target.value)
                    setError(null)
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label>End Date</Label>
                <Input
                  type="date"
                  value={endDate}
                  min={startDate || today}
                  onChange={(e) => { setEndDate(e.target.value); setError(null) }}
                />
              </div>
            </div>

            {totalDays > 0 && (
              <div className={`flex items-center gap-2 rounded-md px-3 py-2 ${isOverBalance ? 'bg-red-50' : 'bg-muted/30'}`}>
                <span className="text-sm text-muted-foreground">Working days:</span>
                <Badge variant={isOverBalance ? 'destructive' : 'secondary'}>
                  {totalDays} day{totalDays !== 1 ? 's' : ''}
                </Badge>
                {isOverBalance && (
                  <span className="text-xs text-red-600 ml-auto">Exceeds balance</span>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label>Reason (Optional)</Label>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Briefly describe the reason for your leave..."
                rows={3}
              />
            </div>
          </div>
        )}

        {!success && (
          <DialogFooter>
            <Button variant="outline" onClick={handleClose} disabled={loading}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={loading || isOverBalance}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Submit Request
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}
