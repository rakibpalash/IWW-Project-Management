import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ProfileSettingsPage } from '@/components/settings/profile-settings'
import { Profile } from '@/types'

export const metadata = {
  title: 'Profile Settings',
}

export default async function ProfilePage() {
  const supabase = await createClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name, email, avatar_url, role, is_temp_password, onboarding_completed, created_at, updated_at')
    .eq('id', user.id)
    .single()

  if (!profile) {
    redirect('/login')
  }

  return <ProfileSettingsPage profile={profile as Profile} />
}
