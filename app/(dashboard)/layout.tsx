import { redirect } from 'next/navigation'
import { DashboardShell } from '@/components/layout/dashboard-shell'
import { Profile } from '@/types'
import { getUser, getProfile } from '@/lib/data/auth'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getUser()
  if (!user) redirect('/login')

  const profile = await getProfile(user.id)
  if (!profile) redirect('/login')

  return (
    <DashboardShell profile={profile as Profile}>
      {children}
    </DashboardShell>
  )
}
