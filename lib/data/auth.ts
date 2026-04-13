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

export const SIDEBAR_WS_SELECT = 'id, name, description, created_at, updated_at, created_by'

// Try space_id first (new column name); fall back to workspace_id (old)
async function fetchLists(admin: ReturnType<typeof createAdminClient>, filter: { spaceIds?: string[]; clientId?: string; partnerId?: string }) {
  // Minimal safe select — avoids columns that may not exist (e.g. actual_hours)
  const BASE = 'id, name, space_id, status, priority, created_at, updated_at, created_by, is_internal, billing_type, progress, estimated_hours, start_date, due_date, description'
  // Fallback select — workspace_id is the old column name
  const FALLBACK = 'id, name, workspace_id, status, priority, created_at, updated_at, created_by, is_internal, billing_type, progress, estimated_hours, start_date, due_date, description'

  let q: any
  if (filter.clientId) {
    q = admin.from('lists').select(BASE).eq('client_id', filter.clientId)
  } else if (filter.partnerId) {
    q = admin.from('lists').select(BASE).eq('partner_id', filter.partnerId)
  } else if (filter.spaceIds && filter.spaceIds.length > 0) {
    q = admin.from('lists').select(BASE).in('space_id', filter.spaceIds)
  } else {
    q = admin.from('lists').select(BASE)
  }

  let { data, error } = await q.order('name')

  if (error) {
    console.error('[fetchLists] space_id query failed, trying workspace_id fallback:', error.message)
    // space_id column not yet renamed — retry with workspace_id
    let q2: any
    if (filter.clientId) {
      q2 = admin.from('lists').select(FALLBACK).eq('client_id', filter.clientId)
    } else if (filter.partnerId) {
      q2 = admin.from('lists').select(FALLBACK).eq('partner_id', filter.partnerId)
    } else if (filter.spaceIds && filter.spaceIds.length > 0) {
      q2 = admin.from('lists').select(FALLBACK).in('workspace_id', filter.spaceIds)
    } else {
      q2 = admin.from('lists').select(FALLBACK)
    }
    const res2 = await q2.order('name')
    data = (res2.data ?? []).map((l: any) => ({ ...l, space_id: l.workspace_id ?? l.space_id }))
  }

  return (data ?? []).map((l: any) => ({ ...l, space_id: l.space_id ?? l.workspace_id }))
}

async function fetchFolders(admin: ReturnType<typeof createAdminClient>, spaceIds: string[]): Promise<any[]> {
  if (spaceIds.length === 0) return []
  const { data, error } = await admin
    .from('folders')
    .select('id, name, space_id, created_by, created_at, updated_at')
    .in('space_id', spaceIds)
    .order('name')
  if (error) {
    console.error('[fetchFolders] error:', error.message)
    return []
  }
  return data ?? []
}

// Fetch space_ids from space_assignments, handling both column names
async function fetchAssignedSpaceIds(admin: ReturnType<typeof createAdminClient>, userId: string): Promise<string[]> {
  let { data, error } = await admin.from('space_assignments').select('space_id').eq('user_id', userId)
  if (error) {
    const res2 = await admin.from('space_assignments').select('workspace_id').eq('user_id', userId)
    return (res2.data ?? []).map((a: any) => a.workspace_id as string).filter(Boolean)
  }
  return (data ?? []).map((a: any) => a.space_id as string).filter(Boolean)
}

/**
 * getSidebarData — uses admin client to bypass RLS, handles both old/new column names.
 */
export const getSidebarData = cache(async (userId: string, role: string, orgId: string | null) => {
  try {
    const admin = createAdminClient()

    if (role === 'staff' || role === 'project_manager') {
      const wsIds = await fetchAssignedSpaceIds(admin, userId)
      if (wsIds.length === 0) return { spaces: [], lists: [], folders: [] }
      const [wsRes, lists, folders] = await Promise.all([
        admin.from('spaces').select(SIDEBAR_WS_SELECT).in('id', wsIds).order('name'),
        fetchLists(admin, { spaceIds: wsIds }),
        fetchFolders(admin, wsIds),
      ])
      return { spaces: wsRes.data ?? [], lists, folders }
    }

    if (role === 'client') {
      const [wsRes, lists] = await Promise.all([
        admin.from('spaces').select(SIDEBAR_WS_SELECT).order('name'),
        fetchLists(admin, { clientId: userId }),
      ])
      const spaceIds = (wsRes.data ?? []).map((w: any) => w.id as string)
      const folders = await fetchFolders(admin, spaceIds)
      return { spaces: wsRes.data ?? [], lists, folders }
    }

    if (role === 'partner') {
      const [wsRes, lists] = await Promise.all([
        admin.from('spaces').select(SIDEBAR_WS_SELECT).order('name'),
        fetchLists(admin, { partnerId: userId }),
      ])
      const spaceIds = (wsRes.data ?? []).map((w: any) => w.id as string)
      const folders = await fetchFolders(admin, spaceIds)
      return { spaces: wsRes.data ?? [], lists, folders }
    }

    // super_admin / account_manager — all org spaces
    const wsQuery = orgId
      ? admin.from('spaces').select(SIDEBAR_WS_SELECT).eq('organization_id', orgId).order('name')
      : admin.from('spaces').select(SIDEBAR_WS_SELECT).order('name')
    const { data: wsData } = await wsQuery
    const spaces = wsData ?? []
    const wsIds = spaces.map((w: any) => w.id as string)
    const [lists, folders] = await Promise.all([
      fetchLists(admin, { spaceIds: wsIds }),
      fetchFolders(admin, wsIds),
    ])

    return { spaces, lists, folders }
  } catch (err) {
    console.error('[getSidebarData] error:', err)
    return { spaces: [], lists: [], folders: [] }
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
