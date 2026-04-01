import { redirect } from 'next/navigation'
import { createClient } from './server'
import { Profile } from '@/types'

/**
 * Gets the authenticated user + profile in one call.
 * Redirects to /login if not authenticated.
 * Returns strongly typed Profile.
 */
export async function requireAuth(): Promise<{ userId: string; profile: Profile }> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data } = await supabase
    .from('profiles')
    .select('id, email, full_name, avatar_url, role, is_temp_password, onboarding_completed, created_at, updated_at')
    .eq('id', user.id)
    .single()

  if (!data) redirect('/login')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { userId: user.id, profile: data as any as Profile }
}
