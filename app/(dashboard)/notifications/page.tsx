import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { NotificationsPage } from '@/components/notifications/notifications-page'
import { Notification } from '@/types'
import { getUser } from '@/lib/data/auth'

export const metadata = {
  title: 'Notifications',
}

export default async function NotificationsServerPage() {
  const user = await getUser()
  if (!user) redirect('/login')

  const supabase = await createClient()
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
