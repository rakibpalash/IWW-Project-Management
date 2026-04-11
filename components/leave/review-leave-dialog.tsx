'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { format, parseISO } from 'date-fns'
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
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import { Loader2, CheckCircle2, XCircle } from 'lucide-react'
import { LeaveRequest } from '@/types'
import { approveLeaveAction, rejectLeaveAction, approveOptionalLeaveAction } from '@/app/actions/leave'

interface ReviewLeaveDialogProps {
  request: LeaveRequest | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

const leaveTypeLabels: Record<string, string> = {
  yearly: 'Annual Leave',
  work_from_home: 'Work From Home',
  marriage: 'Marriage Leave',
}

export function ReviewLeaveDialog({ request, open, onOpenChange }: ReviewLeaveDialogProps) {
  const router = useRouter()
  const [action, setAction] = useState<'approve' | 'reject'>('approve')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!request) return null

  const handleSubmit = async () => {
    if (action === 'reject' && !notes.trim()) {
      setError('Please provide review notes when rejecting a request')
      return
    }

    setLoading(true)
    setError(null)

    const isOptional = request.leave_type === 'optional'
    const result =
      action === 'approve'
        ? isOptional
          ? await approveOptionalLeaveAction(request.id, notes)
          : await approveLeaveAction(request.id, notes)
        : await rejectLeaveAction(request.id, notes)

    setLoading(false)

    if (!result.success) {
      setError(result.error ?? 'Failed to process request')
      return
    }

    onOpenChange(false)
    setNotes('')
    setAction('approve')
    router.refresh()
  }

  const handleClose = () => {
    if (!loading) {
      onOpenChange(false)
      setError(null)
      setNotes('')
      setAction('approve')
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Review Leave Request</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Request Details */}
          <div className="rounded-lg border p-4 space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-medium">{request.user?.full_name ?? 'Unknown'}</p>
                <p className="text-sm text-muted-foreground">{request.user?.email}</p>
              </div>
              <Badge variant="outline">
                {leaveTypeLabels[request.leave_type] ?? request.leave_type}
              </Badge>
            </div>

            <Separator />

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-muted-foreground">Start Date</p>
                <p className="font-medium">{format(parseISO(request.start_date), 'dd MMM yyyy')}</p>
              </div>
              <div>
                <p className="text-muted-foreground">End Date</p>
                <p className="font-medium">{format(parseISO(request.end_date), 'dd MMM yyyy')}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Duration</p>
                <p className="font-medium">
                  {request.total_days} day{request.total_days !== 1 ? 's' : ''}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Applied</p>
                <p className="font-medium">{format(parseISO(request.created_at), 'dd MMM yyyy')}</p>
              </div>
            </div>

            {request.reason && (
              <>
                <Separator />
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Reason</p>
                  <p className="text-sm">{request.reason}</p>
                </div>
              </>
            )}
          </div>

          {/* Decision */}
          <div className="space-y-2">
            <Label>Decision</Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setAction('approve')}
                className={`flex items-center gap-2 rounded-lg border-2 px-4 py-3 text-sm font-medium transition-colors ${
                  action === 'approve'
                    ? 'border-green-500 bg-green-50 text-green-700'
                    : 'border-border text-muted-foreground hover:bg-muted/30'
                }`}
              >
                <CheckCircle2 className="h-4 w-4" />
                Approve
              </button>
              <button
                type="button"
                onClick={() => setAction('reject')}
                className={`flex items-center gap-2 rounded-lg border-2 px-4 py-3 text-sm font-medium transition-colors ${
                  action === 'reject'
                    ? 'border-red-500 bg-red-50 text-red-700'
                    : 'border-border text-muted-foreground hover:bg-muted/30'
                }`}
              >
                <XCircle className="h-4 w-4" />
                Reject
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <Label>
              Review Notes{' '}
              {action === 'reject' && (
                <span className="text-red-500 text-xs">(required for rejection)</span>
              )}
            </Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={
                action === 'approve'
                  ? 'Optional message to the employee...'
                  : 'Reason for rejection (required)...'
              }
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={loading}
            variant={action === 'approve' ? 'default' : 'destructive'}
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {action === 'approve' ? 'Approve Request' : 'Reject Request'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
