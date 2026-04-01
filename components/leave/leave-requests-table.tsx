'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { format, parseISO } from 'date-fns'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { CheckCircle, XCircle, Ban, MessageSquare } from 'lucide-react'
import { LeaveRequest } from '@/types'
import { ReviewLeaveDialog } from './review-leave-dialog'
import { cancelLeaveAction } from '@/app/actions/leave'

interface LeaveRequestsTableProps {
  requests: LeaveRequest[]
  isAdmin?: boolean
  currentUserId?: string
  showPendingActions?: boolean
}

const leaveTypeLabels: Record<string, string> = {
  yearly: 'Annual Leave',
  work_from_home: 'WFH',
  marriage: 'Marriage',
}

const leaveTypeBadgeVariant: Record<string, string> = {
  yearly: 'bg-blue-100 text-blue-700',
  work_from_home: 'bg-purple-100 text-purple-700',
  marriage: 'bg-pink-100 text-pink-700',
}

const statusConfig: Record<string, { label: string; className: string }> = {
  pending: { label: 'Pending', className: 'bg-yellow-100 text-yellow-700' },
  approved: { label: 'Approved', className: 'bg-green-100 text-green-700' },
  rejected: { label: 'Rejected', className: 'bg-red-100 text-red-700' },
  cancelled: { label: 'Cancelled', className: 'bg-gray-100 text-gray-700' },
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export function LeaveRequestsTable({
  requests,
  isAdmin = false,
  currentUserId,
  showPendingActions = false,
}: LeaveRequestsTableProps) {
  const router = useRouter()
  const [reviewRequest, setReviewRequest] = useState<LeaveRequest | null>(null)
  const [cancelTarget, setCancelTarget] = useState<LeaveRequest | null>(null)
  const [cancelling, setCancelling] = useState(false)

  const handleCancel = async () => {
    if (!cancelTarget) return
    setCancelling(true)
    await cancelLeaveAction(cancelTarget.id)
    setCancelling(false)
    setCancelTarget(null)
    router.refresh()
  }

  if (requests.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <MessageSquare className="h-8 w-8 mb-2 opacity-40" />
        <p className="text-sm">No leave requests found</p>
      </div>
    )
  }

  return (
    <>
      <div className="rounded-md border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              {isAdmin && <TableHead>Employee</TableHead>}
              <TableHead>Type</TableHead>
              <TableHead>Dates</TableHead>
              <TableHead className="text-center">Days</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Notes</TableHead>
              {(isAdmin || currentUserId) && <TableHead className="w-[120px]">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {requests.map((req) => {
              const status = statusConfig[req.status] ?? statusConfig.pending
              const isOwnPending =
                !isAdmin && req.user_id === currentUserId && req.status === 'pending'

              return (
                <TableRow key={req.id}>
                  {isAdmin && (
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Avatar className="h-7 w-7">
                          <AvatarImage src={req.user?.avatar_url ?? undefined} />
                          <AvatarFallback className="text-xs">
                            {getInitials(req.user?.full_name ?? 'U')}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm font-medium leading-none">
                            {req.user?.full_name ?? 'Unknown'}
                          </p>
                          <p className="text-xs text-muted-foreground">{req.user?.email}</p>
                        </div>
                      </div>
                    </TableCell>
                  )}
                  <TableCell>
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${leaveTypeBadgeVariant[req.leave_type] ?? 'bg-gray-100 text-gray-700'}`}
                    >
                      {leaveTypeLabels[req.leave_type] ?? req.leave_type}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm">
                    <div className="whitespace-nowrap">
                      {format(parseISO(req.start_date), 'dd MMM yyyy')}
                    </div>
                    <div className="text-xs text-muted-foreground whitespace-nowrap">
                      to {format(parseISO(req.end_date), 'dd MMM yyyy')}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="secondary">{req.total_days}</Badge>
                  </TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${status.className}`}
                    >
                      {status.label}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-[200px]">
                    {req.review_notes ? (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger className="text-left">
                            <p className="truncate max-w-[160px]">{req.review_notes}</p>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-[300px]">
                            <p>{req.review_notes}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {isAdmin && showPendingActions && req.status === 'pending' && (
                        <>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7 text-green-600 hover:bg-green-50"
                                  onClick={() => setReviewRequest(req)}
                                >
                                  <CheckCircle className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Review</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </>
                      )}
                      {isAdmin && !showPendingActions && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs"
                          onClick={() => setReviewRequest(req)}
                          disabled={req.status !== 'pending'}
                        >
                          Review
                        </Button>
                      )}
                      {isOwnPending && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7 text-red-500 hover:bg-red-50"
                                onClick={() => setCancelTarget(req)}
                              >
                                <Ban className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Cancel Request</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      <ReviewLeaveDialog
        request={reviewRequest}
        open={!!reviewRequest}
        onOpenChange={(open) => !open && setReviewRequest(null)}
      />

      <AlertDialog open={!!cancelTarget} onOpenChange={(open) => !open && setCancelTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Leave Request?</AlertDialogTitle>
            <AlertDialogDescription>
              This will cancel your pending leave request. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelling}>Keep Request</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancel}
              disabled={cancelling}
              className="bg-red-600 hover:bg-red-700"
            >
              {cancelling ? 'Cancelling...' : 'Yes, Cancel'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
