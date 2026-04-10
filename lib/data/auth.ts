import { cache } from 'react'
import { unstable_cache } from 'next/cache'
import { createClient, createAdminClient } from '@/lib/supabase/server'

const PROFILE_SELECT =
  'id, full_name, email, role, is_temp_password, onboarding_completed, avatar_url, organization_id, created_at, updated_at'

/**
 * getUser — deduplicated within a single React render via React cache().
 * Layout and page calling this in the same request only hit Supabase once.
 */
export const getUser = cache(async () => {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser()
    if (error || !user) return null
    return user
  } catch {
    return null
  }
})

/**
 * _fetchProfile — cross-request cached via unstable_cache (2 min TTL).
 * Key includes userId so each user gets their own cache entry.
 */
const _fetchProfile = (userId: string) =>
  unstable_cache(
    async () => {
      const admin = createAdminClient()
      const { data } = await admin
        .from('profiles')
        .select(PROFILE_SELECT)
        .eq('id', userId)
        .single()
      return data
    },
    ['profile', userId],
    { revalidate: 120 }
  )()

/**
 * getProfile — React-cache deduplication on top of unstable_cache.
 */
export const getProfile = cache(async (userId: string) => {
  try {
    return await _fetchProfile(userId)
  } catch {
    return null
  }
})

/**
 * requireAuthWithOrg — used by server actions to get caller + their org_id.
 * Throws if not authenticated or org not set up.
 */
export async function requireAuthWithOrg() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) throw new Error('Not authenticated')

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('id, role, organization_id')
    .eq('id', user.id)
    .single()

  if (!profile) throw new Error('Profile not found')
  if (!profile.organization_id) throw new Error('Organization not set up')

  return { user, profile, orgId: profile.organization_id as string }
}
