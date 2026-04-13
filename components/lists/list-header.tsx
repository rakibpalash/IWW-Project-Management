'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { List, Profile } from '@/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { EditListDialog } from './edit-list-dialog'
import { TimeSummary } from './time-summary'
import { SmartDeleteDialog } from '@/components/ui/smart-delete-dialog'
import {
  cn,
  formatDate,
  isOverdue,
  getPriorityColor,
  getStatusColor,
  formatStatus,
} from '@/lib/utils'
import { Calendar, Pencil, AlertTriangle, Building2, User, Trash2, Copy, Handshake, Banknote, Lock } from 'lucide-react'
import { deleteListAction, cloneListAction } from '@/app/actions/lists'
import { getListDeleteImpact } from '@/app/actions/delete-impact'
import { useToast } from '@/components/ui/use-toast'

interface ListHeaderProps {
  list: List
  profile: Profile
  onListUpdated?: (updated: List) => void
}

const BILLING_LABELS: Record<string, string> = {
  hourly: 'Hourly',
  fixed: 'Fixed Price',
  retainer: 'Retainer',
  non_billable: 'Non-Billable',
}

const BILLING_COLORS: Record<string, string> = {
  hourly: 'text-blue-600 bg-blue-500/10 border-blue-200 dark:border-blue-800',
  fixed: 'text-emerald-600 bg-emerald-500/10 border-emerald-200 dark:border-emerald-800',
  retainer: 'text-violet-600 bg-violet-500/10 border-violet-200 dark:border-violet-800',
  non_billable: 'text-muted-foreground bg-muted border-border',
}

export function ListHeader({ list, profile, onListUpdated }: ListHeaderProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [isCloning, setIsCloning] = useState(false)
  const isAdmin = profile.role === 'super_admin'
  const canSeePartner = profile.role === 'super_admin' || profile.role === 'account_manager'
  const canSeeBilling = canSeePartner || profile.role === 'project_manager'

  async function handleClone() {
    setIsCloning(true)
    const result = await cloneListAction(list.id)
    setIsCloning(false)
    if (result.success) {
      toast({ title: 'List cloned', description: `"${result.list?.name}" created` })
      router.push(`/lists/${result.list?.id}`)
    } else {
      toast({ title: 'Failed to clone', description: result.error, variant: 'destructive' })
    }
  }

  const overdue =
    isOverdue(list.due_date) &&
    list.status !== 'completed' &&
    list.status !== 'cancelled'

  return (
    <div className="space-y-4">
      {/* Title row */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2 flex-1 min-w-0">
          {/* Breadcrumb-style space */}
          {list.space && (
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Building2 className="h-3.5 w-3.5" />
              <span>{list.space.name}</span>
            </div>
          )}

          {/* List name */}
          <div className="flex items-start gap-2 flex-wrap">
            <h1 className="text-2xl font-bold tracking-tight leading-tight">
              {list.name}
            </h1>
            {overdue && (
              <div className="flex items-center gap-1 text-red-600 mt-1">
                <AlertTriangle className="h-4 w-4" />
                <span className="text-sm font-medium">Overdue</span>
              </div>
            )}
          </div>

          {/* Badges */}
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              className={cn('text-xs', getStatusColor(list.status))}
              variant="outline"
            >
              {formatStatus(list.status)}
            </Badge>
            <Badge
              className={cn('text-xs', getPriorityColor(list.priority))}
              variant="outline"
            >
              {formatStatus(list.priority)} priority
            </Badge>

            {/* Internal badge */}
            {list.is_internal && (
              <Badge variant="outline" className="text-xs text-amber-600 bg-amber-500/10 border-amber-200 dark:border-amber-800 gap-1">
                <Lock className="h-3 w-3" />
                Internal
              </Badge>
            )}

            {/* Billing type (managers+) */}
            {canSeeBilling && list.billing_type && (
              <Badge
                variant="outline"
                className={cn('text-xs gap-1', BILLING_COLORS[list.billing_type] ?? BILLING_COLORS.non_billable)}
              >
                <Banknote className="h-3 w-3" />
                {BILLING_LABELS[list.billing_type] ?? list.billing_type}
              </Badge>
            )}

            {/* Due date */}
            {list.due_date && (
              <div
                className={cn(
                  'flex items-center gap-1 text-xs',
                  overdue ? 'text-red-600 font-semibold' : 'text-muted-foreground'
                )}
              >
                <Calendar className="h-3.5 w-3.5" />
                Due {formatDate(list.due_date)}
              </div>
            )}

            {/* Client */}
            {list.client && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <User className="h-3.5 w-3.5" />
                {list.client.full_name}
              </div>
            )}

            {/* Partner chain (admin only) */}
            {canSeePartner && list.partner && (
              <div className="flex items-center gap-1 text-xs text-violet-600">
                <Handshake className="h-3.5 w-3.5" />
                via {list.partner.full_name}
              </div>
            )}
          </div>
        </div>

        {/* Admin actions */}
        {isAdmin && (
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowEditDialog(true)}
            >
              <Pencil className="h-4 w-4 mr-2" />
              Edit
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleClone}
              disabled={isCloning}
            >
              <Copy className="h-4 w-4 mr-2" />
              {isCloning ? 'Cloning…' : 'Clone'}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowDeleteDialog(true)}
              className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      {/* Progress bar */}
      <div>
        <div className="flex items-center justify-between text-sm mb-1.5">
          <span className="text-muted-foreground">Overall Progress</span>
          <span className="font-semibold">{list.progress}%</span>
        </div>
        <Progress
          value={list.progress}
          className={cn(
            'h-3',
            list.progress >= 100
              ? '[&>div]:bg-green-500'
              : list.progress >= 80
              ? '[&>div]:bg-orange-500'
              : ''
          )}
        />
      </div>

      {/* Time summary */}
      <TimeSummary
        estimatedHours={list.estimated_hours}
        actualHours={list.actual_hours ?? 0}
        showProgressBar
      />

      {/* Description */}
      {list.description && (
        <p className="text-sm text-muted-foreground leading-relaxed">
          {list.description}
        </p>
      )}

      {/* Edit dialog */}
      {showEditDialog && (
        <EditListDialog
          open={showEditDialog}
          onOpenChange={setShowEditDialog}
          list={list}
          isSuperAdmin={profile.role === 'super_admin'}
          onUpdated={(updated) => {
            setShowEditDialog(false)
            onListUpdated?.(updated)
          }}
        />
      )}

      {/* Smart Delete Dialog */}
      <SmartDeleteDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        entityType="list"
        entityName={list.name}
        entityId={list.id}
        allowForceDelete={profile.role === 'super_admin'}
        onFetchImpact={() => getListDeleteImpact(list.id)}
        onConfirmDelete={async (opts) => {
          const result = await deleteListAction(list.id, { moveTasksToListId: opts.moveTasksToListId })
          if (!result.success) {
            toast({ title: 'Delete failed', description: result.error, variant: 'destructive' })
            return
          }
          toast({ title: 'List deleted', description: `"${list.name}" was deleted.` })
          router.push('/lists')
        }}
      />
    </div>
  )
}
