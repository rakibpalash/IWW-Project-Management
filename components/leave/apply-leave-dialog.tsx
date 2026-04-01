'use client'

import { useState, useEffect } from 'react'
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
import { Loader2, CheckCircle2, InfoIcon } from 'lucide-react'
import { LeaveBalance, LeaveType } from '@/types'
import { applyLeaveAction } from '@/app/actions/leave'

interface ApplyLeaveDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  balance: LeaveBalance | null
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

const leaveTypeLabels: Record<LeaveType, string> = {
  yearly: 'Annual Leave',
  work_from_home: 'Work From Home',
  marriage: 'Marriage Leave',
}

export function ApplyLeaveDialog({ open, onOpenChange, balance }: ApplyLeaveDialogProps) {
  const router = useRouter()
  const [leaveType, setLeaveType] = useState<LeaveType>('yearly')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const totalDays = countWorkdays(startDate, endDate)

  const getAvailableDays = (type: LeaveType): number => {
    if (!balance) return 0
    if (type === 'yearly') return Math.max(0, balance.yearly_total - balance.yearly_used)
    if (type === 'work_from_home') return Math.max(0, balance.wfh_total - balance.wfh_used)
    if (type === 'marriage') return Math.max(0, balance.marriage_total - balance.marriage_used)
    return 0
  }

  const availableDays = getAvailableDays(leaveType)

  const validate = (): string | null => {
    if (!startDate) return 'Please select a start date'
    if (!endDate) return 'Please select an end date'
    if (endDate < startDate) return 'End date must be after start date'
    if (totalDays === 0) return 'Selected dates include no working days'
    if (leaveType !== 'marriage' && totalDays > availableDays) {
      return `Insufficient balance. You have ${availableDays} day(s) available but requested ${totalDays}`
    }
    if (leaveType === 'marriage' && availableDays === 0) {
      return 'No marriage leave allocated. Please contact admin.'
    }
    return null
  }

  const handleSubmit = async () => {
    const validationError = validate()
    if (validationError) {
      setError(validationError)
      return
    }

    setLoading(true)
    setError(null)

    const result = await applyLeaveAction({
      leave_type: leaveType,
      start_date: startDate,
      end_date: endDate,
      total_days: totalDays,
      reason,
    })

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
      setLeaveType('yearly')
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
                value={leaveType}
                onValueChange={(v) => setLeaveType(v as LeaveType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="yearly">Annual Leave</SelectItem>
                  <SelectItem value="work_from_home">Work From Home</SelectItem>
                  <SelectItem value="marriage">Marriage Leave</SelectItem>
                </SelectContent>
              </Select>

              {balance && (
                <div className="flex items-center gap-1.5 rounded-md bg-blue-50 px-3 py-1.5 text-sm text-blue-700">
                  <InfoIcon className="h-3.5 w-3.5 shrink-0" />
                  <span>
                    Available:{' '}
                    <strong>
                      {availableDays} day{availableDays !== 1 ? 's' : ''}
                    </strong>
                  </span>
                </div>
              )}
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
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label>End Date</Label>
                <Input
                  type="date"
                  value={endDate}
                  min={startDate || today}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>

            {totalDays > 0 && (
              <div className="flex items-center gap-2 rounded-md bg-gray-50 px-3 py-2">
                <span className="text-sm text-muted-foreground">Working days:</span>
                <Badge variant="secondary">{totalDays} day{totalDays !== 1 ? 's' : ''}</Badge>
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
            <Button onClick={handleSubmit} disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Submit Request
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}
