import { cache } from 'react'
import { unstable_cache } from 'next/cache'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import type { Profile } from '@/types'

// Full select — includes columns added by migrations (organization_id, is_active)
const PROFILE_SELECT =
  'id, full_name, email, role, is_temp_password, is_active, onboarding_completed, avatar_url, organization_id, created_at, updated_at'

// Fallback select — only columns that always exist (pre-migration safe)
const PROFILE_SELECT_BASE =
  'id, full_name, email, role, is_temp_password, onboarding_completed, avatar_url, created_at, updated_at'

/**
 * getUser — deduplicated within a single React render via React cache().
 */
export const getUser = cache(async () => {
  try {
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user) return null
    return user
  } catch {
    return null
  }
})

/**
 * _fetchProfile — cross-request cached via unstable_cache (2 min TTL).
 * Tries the full select first; if columns are missing (migration not run yet),
 * falls back to base columns so the app never crashes with a null profile.
 */
async function fetchProfileFromDb(userId: string): Promise<Profile | null> {
  const admin = createAdminClient()

  // Try full select (with organization_id, is_active)
  const { data, error } = await admin
    .from('profiles')
    .select(PROFILE_SELECT)
    .eq('id', userId)
    .single()

  if (!error && data) return data as Profile

  // Fall back to base columns (migration not yet applied)
  const { data: baseData } = await admin
    .from('profiles')
    .select(PROFILE_SELECT_BASE)
    .eq('id', userId)
    .single()

  return (baseData ?? null) as Profile | null
}

const _fetchProfile = (userId: string): Promise<Profile | null> =>
  unstable_cache(
    () => fetchProfileFromDb(userId),
    ['profile', userId],
    { revalidate: 120, tags: [`profile-${userId}`] }
  )()

/**
 * getProfile — React-cache deduplication on top of unstable_cache.
 */
export const getProfile = cache(async (userId: string): Promise<Profile | null> => {
  try {
    return await _fetchProfile(userId)
  } catch {
    return null
  }
})

export const SIDEBAR_WS_SELECT   = 'id, name, description, created_at, updated_at, created_by'
export const SIDEBAR_PROJ_SELECT = 'id, name, space_id, status, priority, created_at, updated_at, created_by, is_internal, billing_type, progress, actual_hours, estimated_hours, start_date, due_date, description'

/**
 * getSidebarData — mirrors the EXACT same query logic as the Lists page.
 * Explicit space_id filtering (not pure RLS) ensures correct results.
 */
export const getSidebarData = cache(async (userId: string, role: string, orgId: string | null) => {
  try {
    const supabase = await createClient()

    if (role === 'staff') {
      const { data: assignments } = await supabase
        .from('space_assignments').select('space_id').eq('user_id', userId)
      const wsIds = (assignments ?? []).map((a: any) => a.space_id as string)
      if (wsIds.length === 0) return { workspaces: [], projects: [] }
      const [wsRes, projRes] = await Promise.all([
        supabase.from('spaces').select(SIDEBAR_WS_SELECT).in('id', wsIds).order('name'),
        supabase.from('lists').select(SIDEBAR_PROJ_SELECT).in('space_id', wsIds).order('name'),
      ])
      return { workspaces: wsRes.data ?? [], projects: projRes.data ?? [] }
    }

    if (role === 'client') {
      const [wsRes, projRes] = await Promise.all([
        supabase.from('spaces').select(SIDEBAR_WS_SELECT).order('name'),
        supabase.from('lists').select(SIDEBAR_PROJ_SELECT).eq('client_id', userId).order('name'),
      ])
      return { workspaces: wsRes.data ?? [], projects: projRes.data ?? [] }
    }

    // super_admin / account_manager / others — same explicit logic as Lists page
    const wsQuery = orgId
      ? supabase.from('spaces').select(SIDEBAR_WS_SELECT).eq('organization_id', orgId).order('name')
      : supabase.from('spaces').select(SIDEBAR_WS_SELECT).order('name')
    const { data: wsData } = await wsQuery
    const workspaces = wsData ?? []
    const wsIds = workspaces.map((w: any) => w.id as string)

    const { data: projData } = wsIds.length > 0
      ? await supabase.from('lists').select(SIDEBAR_PROJ_SELECT).in('space_id', wsIds).order('name')
      : await supabase.from('lists').select(SIDEBAR_PROJ_SELECT).order('name')

    return { workspaces, projects: projData ?? [] }
  } catch {
    return { workspaces: [], projects: [] }
  }
})

/**
 * requireAuthWithOrg — used by server actions to get caller + their org_id.
 */
export async function requireAuthWithOrg() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) throw new Error('Not authenticated')

  const admin = createAdminClient()

  // Try with organization_id; fall back if column doesn't exist yet
  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('id, role, organization_id')
    .eq('id', user.id)
    .single()

  if (profileError) {
    throw new Error('Organization not set up')
  }

  if (!profile) throw new Error('Profile not found')
  if (!profile.organization_id) throw new Error('Organization not set up')

  return { user, profile, orgId: profile.organization_id as string }
}
