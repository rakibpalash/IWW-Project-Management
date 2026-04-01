import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { NotificationsPage } from '@/components/notifications/notifications-page'
import { Notification } from '@/types'

export const metadata = {
  title: 'Notifications',
}

export default async function NotificationsServerPage() {
  const supabase = await createClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    redirect('/login')
  }

  const { data: notifications } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(100)

  return (
    <NotificationsPage initialNotifications={(notifications ?? []) as Notification[]} />
  )
}
