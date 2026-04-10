import { redirect } from 'next/navigation'
import { getUser, getProfile } from '@/lib/data/auth'
import { Profile } from '@/types'
import { ReportsPage } from '@/components/reports/reports-page'

export const metadata = { title: 'Reports' }

export default async function ReportsServerPage({
  searchParams,
}: {
  searchParams: Promise<{ report?: string }>
}) {
  const { report } = await searchParams
  const user = await getUser()
  if (!user) redirect('/login')
  const profile = await getProfile(user.id)
  if (!profile) redirect('/login')

  const isAdmin = (profile as Profile).role === 'super_admin'

  return (
    <ReportsPage
      profile={profile as Profile}
      isAdmin={isAdmin}
      defaultReport={report}
    />
  )
}
