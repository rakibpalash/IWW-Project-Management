'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Notification } from '@/types'
import { useNotifications } from '@/hooks/use-notifications'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  CheckCheck,
  Bell,
  UserPlus,
  MessageSquare,
  AtSign,
  RefreshCw,
  ArrowUpRight,
  GitBranch,
} from 'lucide-react'
import { cn, timeAgo } from '@/lib/utils'
import {
  isToday,
  isYesterday,
  parseISO,
} from 'date-fns'

interface NotificationsPageProps {
  initialNotifications: Notification[]
}

type NotificationGroup = {
  label: string
  notifications: Notification[]
}

function getNotificationIcon(type: Notification['type']) {
  switch (type) {
    case 'task_assigned':
      return <UserPlus className="h-4 w-4" />
    case 'subtask_assigned':
      return <GitBranch className="h-4 w-4" />
    case 'mention':
      return <AtSign className="h-4 w-4" />
    case 'comment_reply':
      return <MessageSquare className="h-4 w-4" />
    case 'status_changed':
      return <RefreshCw className="h-4 w-4" />
    default:
      return <Bell className="h-4 w-4" />
  }
}

function getNotificationIconColor(type: Notification['type']): string {
  switch (type) {
    case 'task_assigned':
      return 'bg-blue-100 text-blue-600'
    case 'subtask_assigned':
      return 'bg-purple-100 text-purple-600'
    case 'mention':
      return 'bg-orange-100 text-orange-600'
    case 'comment_reply':
      return 'bg-green-100 text-green-600'
    case 'status_changed':
      return 'bg-yellow-100 text-yellow-600'
    default:
      return 'bg-gray-100 text-gray-600'
  }
}

export function NotificationsPage({ initialNotifications }: NotificationsPageProps) {
  const router = useRouter()
  const { notifications, unreadCount, markAsRead, markAllRead } = useNotifications()

  // Use live notifications from the hook, fallback to initial
  const allNotifications =
    notifications.length > 0 || !initialNotifications.length
      ? notifications
      : initialNotifications

  const groupedNotifications = useMemo<NotificationGroup[]>(() => {
    const today: Notification[] = []
    const yesterday: Notification[] = []
    const earlier: Notification[] = []

    for (const n of allNotifications) {
      const date = parseISO(n.created_at)
      if (isToday(date)) {
        today.push(n)
      } else if (isYesterday(date)) {
        yesterday.push(n)
      } else {
        earlier.push(n)
      }
    }

    const groups: NotificationGroup[] = []
    if (today.length > 0) groups.push({ label: 'Today', notifications: today })
    if (yesterday.length > 0) groups.push({ label: 'Yesterday', notifications: yesterday })
    if (earlier.length > 0) groups.push({ label: 'Earlier', notifications: earlier })
    return groups
  }, [allNotifications])

  async function handleNotificationClick(notification: Notification) {
    if (!notification.is_read) {
      await markAsRead(notification.id)
    }
    if (notification.link) {
      router.push(notification.link)
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Notifications</h1>
          {unreadCount > 0 && (
            <p className="text-sm text-muted-foreground mt-1">
              {unreadCount} unread notification{unreadCount !== 1 ? 's' : ''}
            </p>
          )}
        </div>

        {unreadCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => markAllRead()}
          >
            <CheckCheck className="h-4 w-4" />
            Mark all read
          </Button>
        )}
      </div>

      {/* Notification list */}
      {allNotifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-20 text-center">
          <div className="mb-4 rounded-full bg-muted p-4">
            <Bell className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold">All caught up!</h3>
          <p className="text-sm text-muted-foreground mt-1">
            You have no notifications yet.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {groupedNotifications.map((group, groupIdx) => (
            <div key={group.label}>
              {/* Group label */}
              <div className="flex items-center gap-3 mb-3">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {group.label}
                </h2>
                <Separator className="flex-1" />
              </div>

              {/* Notifications */}
              <div className="rounded-lg border bg-card overflow-hidden divide-y">
                {group.notifications.map((notification) => (
                  <NotificationItem
                    key={notification.id}
                    notification={notification}
                    onClick={() => handleNotificationClick(notification)}
                    onMarkRead={() => markAsRead(notification.id)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// Individual notification item
interface NotificationItemProps {
  notification: Notification
  onClick: () => void
  onMarkRead: () => void
}

function NotificationItem({ notification, onClick, onMarkRead }: NotificationItemProps) {
  const hasLink = !!notification.link

  return (
    <div
      className={cn(
        'flex items-start gap-4 p-4 transition-colors group',
        !notification.is_read && 'bg-primary/5',
        hasLink && 'cursor-pointer hover:bg-muted/50'
      )}
      onClick={hasLink ? onClick : undefined}
    >
      {/* Icon */}
      <div
        className={cn(
          'rounded-full p-2 shrink-0 mt-0.5',
          getNotificationIconColor(notification.type)
        )}
      >
        {getNotificationIcon(notification.type)}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p
              className={cn(
                'text-sm',
                !notification.is_read ? 'font-semibold' : 'font-medium'
              )}
            >
              {notification.title}
            </p>
            <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">
              {notification.message}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {timeAgo(notification.created_at)}
            </p>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {/* Unread dot */}
            {!notification.is_read && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onMarkRead()
                }}
                className="flex items-center"
                title="Mark as read"
              >
                <div className="h-2.5 w-2.5 rounded-full bg-primary" />
              </button>
            )}

            {/* External link icon */}
            {hasLink && (
              <ArrowUpRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
