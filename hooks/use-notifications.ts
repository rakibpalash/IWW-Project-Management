'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Notification } from '@/types'
import type { RealtimeChannel } from '@supabase/supabase-js'

interface UseNotificationsReturn {
  notifications: Notification[]
  unreadCount: number
  loading: boolean
  markAsRead: (id: string) => Promise<void>
  markAllRead: () => Promise<void>
}

export function useNotifications(): UseNotificationsReturn {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const channelRef = useRef<RealtimeChannel | null>(null)
  const userIdRef = useRef<string | null>(null)

  const fetchNotifications = useCallback(async (userId: string) => {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50)

    if (!error && data) {
      setNotifications(data as Notification[])
    }
    setLoading(false)
  }, [])

  const subscribeToRealtime = useCallback(
    (userId: string) => {
      const supabase = createClient()

      // Clean up any existing subscription
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
      }

      const channel = supabase
        .channel(`notifications:${userId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${userId}`,
          },
          (payload) => {
            setNotifications((prev) => [payload.new as Notification, ...prev])
          },
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${userId}`,
          },
          (payload) => {
            setNotifications((prev) =>
              prev.map((n) =>
                n.id === (payload.new as Notification).id
                  ? (payload.new as Notification)
                  : n,
              ),
            )
          },
        )
        .on(
          'postgres_changes',
          {
            event: 'DELETE',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${userId}`,
          },
          (payload) => {
            setNotifications((prev) =>
              prev.filter((n) => n.id !== (payload.old as Notification).id),
            )
          },
        )
        .subscribe()

      channelRef.current = channel
    },
    [],
  )

  useEffect(() => {
    const supabase = createClient()

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        setLoading(false)
        return
      }
      userIdRef.current = user.id
      fetchNotifications(user.id)
      subscribeToRealtime(user.id)
    })

    // Re-sync on auth state changes
    const {
      data: { subscription: authSub },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        const uid = session.user.id
        if (uid !== userIdRef.current) {
          userIdRef.current = uid
          fetchNotifications(uid)
          subscribeToRealtime(uid)
        }
      } else {
        userIdRef.current = null
        setNotifications([])
        setLoading(false)
        if (channelRef.current) {
          supabase.removeChannel(channelRef.current)
          channelRef.current = null
        }
      }
    })

    return () => {
      authSub.unsubscribe()
      const supabaseCleanup = createClient()
      if (channelRef.current) {
        supabaseCleanup.removeChannel(channelRef.current)
        channelRef.current = null
      }
    }
  }, [fetchNotifications, subscribeToRealtime])

  const markAsRead = useCallback(async (id: string) => {
    const supabase = createClient()

    // Optimistic update
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)),
    )

    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id)

    if (error) {
      // Rollback on failure
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: false } : n)),
      )
    }
  }, [])

  const markAllRead = useCallback(async () => {
    if (!userIdRef.current) return

    const supabase = createClient()

    // Optimistic update
    const previousState = notifications
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))

    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', userIdRef.current)
      .eq('is_read', false)

    if (error) {
      // Rollback on failure
      setNotifications(previousState)
    }
  }, [notifications])

  const unreadCount = notifications.filter((n) => !n.is_read).length

  return {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllRead,
  }
}
