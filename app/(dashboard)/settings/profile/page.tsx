import { redirect } from 'next/navigation'
import { ProfileSettingsPage } from '@/components/settings/profile-settings'
import { Profile } from '@/types'
import { getUser, getProfile } from '@/lib/data/auth'

export const metadata = {
  title: 'Profile Settings',
}

export default async function ProfilePage() {
  const user = await getUser()
  if (!user) redirect('/login')

  const profile = await getProfile(user.id)
  if (!profile) redirect('/login')

  return <ProfileSettingsPage profile={profile as Profile} />
}
