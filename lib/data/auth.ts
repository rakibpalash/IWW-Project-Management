import { cache } from 'react'
import { unstable_cache } from 'next/cache'
import { createClient, createAdminClient } from '@/lib/supabase/server'

const PROFILE_SELECT =
  'id, full_name, email, role, is_temp_password, onboarding_completed, avatar_url, created_at, updated_at'

/**
 * getUser — deduplicated within a single React render via React cache().
 * Layout and page calling this in the same request only hit Supabase once.
 */
export const getUser = cache(async () => {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  if (error || !user) return null
  return user
})

/**
 * _fetchProfile — cross-request cached via unstable_cache (2 min TTL).
 * Profile rarely changes; safe to cache per user ID.
 */
const _fetchProfile = unstable_cache(
  async (userId: string) => {
    const admin = createAdminClient()
    const { data } = await admin
      .from('profiles')
      .select(PROFILE_SELECT)
      .eq('id', userId)
      .single()
    return data
  },
  ['profile'],
  { revalidate: 120 }
)

/**
 * getProfile — React-cache deduplication on top of unstable_cache.
 */
export const getProfile = cache(_fetchProfile)
