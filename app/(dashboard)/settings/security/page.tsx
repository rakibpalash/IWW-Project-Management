import { redirect } from 'next/navigation'
import { SecuritySettingsPage } from '@/components/settings/security-settings'
import { Profile } from '@/types'
import { getUser, getProfile } from '@/lib/data/auth'

export const metadata = {
  title: 'Security Settings',
}

export default async function SecurityPage() {
  const user = await getUser()
  if (!user) redirect('/login')

  const profile = await getProfile(user.id)
  if (!profile) redirect('/login')

  return <SecuritySettingsPage profile={profile as Profile} />
}
