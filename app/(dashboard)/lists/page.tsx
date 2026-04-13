import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/server'
import { ListsPage } from '@/components/lists/lists-page'
import { List, Profile, Space } from '@/types'
import { getUser, getProfile } from '@/lib/data/auth'

export const metadata = { title: 'Lists' }

const PROFILE_SELECT =
  'id, full_name, email, avatar_url, role, is_temp_password, onboarding_completed, created_at, updated_at'

export default async function ListsServerPage() {
  const user = await getUser()
  if (!user) redirect('/login')

  const profile = await getProfile(user.id)
  if (!profile) redirect('/login')

  const admin = createAdminClient()
  const orgId = (profile as Profile).organization_id
  const role = profile.role

  // ── 1. Determine which space IDs this user can access ───────────────────────
  let accessibleSpaceIds: string[] | null = null // null = all spaces in org

  if (role === 'staff') {
    const { data: assignments } = await admin
      .from('space_assignments')
      .select('space_id')
      .eq('user_id', user.id)
    accessibleSpaceIds = (assignments ?? []).map((a: any) => a.space_id as string)
  } else if (role === 'project_manager') {
    // Space assignments + lists they're directly a member of
    const [{ data: assignments }, { data: listMemberships }] = await Promise.all([
      admin.from('space_assignments').select('space_id').eq('user_id', user.id),
      admin.from('list_members').select('list_id').eq('user_id', user.id),
    ])
    accessibleSpaceIds = (assignments ?? []).map((a: any) => a.space_id as string)
    // Project managers also see lists they're directly a member of (handled below)
    const directListIds = (listMemberships ?? []).map((m: any) => m.list_id as string)
    // Store for later use
    ;(profile as any)._directListIds = directListIds
  }
  // super_admin, account_manager → accessibleSpaceIds stays null (all org spaces)
  // client, partner → handled by client_id / partner_id filter

  // ── 2. Fetch lists based on role ─────────────────────────────────────────────
  let lists: List[] = []

  if (role === 'client') {
    const { data } = await admin
      .from('lists')
      .select('*')
      .eq('client_id', user.id)
      .order('created_at', { ascending: false })
    lists = (data ?? []) as List[]
  } else if (role === 'partner') {
    const { data } = await admin
      .from('lists')
      .select('*')
      .eq('partner_id', user.id)
      .order('created_at', { ascending: false })
    lists = (data ?? []) as List[]
  } else {
    // admin roles + staff + project_manager
    let spaceIds: string[] = []

    if (accessibleSpaceIds !== null) {
      spaceIds = accessibleSpaceIds
    } else {
      // super_admin / account_manager: all org spaces
      const wsQuery = orgId
        ? admin.from('spaces').select('id').eq('organization_id', orgId)
        : admin.from('spaces').select('id')
      const { data: orgSpaces } = await wsQuery
      spaceIds = (orgSpaces ?? []).map((w: any) => w.id as string)
    }

    if (spaceIds.length > 0) {
      const { data } = await admin
        .from('lists')
        .select('*')
        .in('space_id', spaceIds)
        .order('created_at', { ascending: false })
      lists = (data ?? []) as List[]
    }

    // project_manager: also include direct list memberships not already in space lists
    const directListIds = (profile as any)._directListIds as string[] | undefined
    if (directListIds && directListIds.length > 0) {
      const existingIds = new Set(lists.map((l) => l.id))
      const missing = directListIds.filter((lid) => !existingIds.has(lid))
      if (missing.length > 0) {
        const { data: extraLists } = await admin
          .from('lists')
          .select('*')
          .in('id', missing)
          .order('created_at', { ascending: false })
        lists = [...lists, ...((extraLists ?? []) as List[])]
      }
    }
  }

  // ── 3. Resolve client + partner profiles separately (no FK hints needed) ─────
  const clientIds = [...new Set(lists.map((l) => (l as any).client_id).filter(Boolean))]
  const partnerIds = [...new Set(lists.map((l) => (l as any).partner_id).filter(Boolean))]
  const allProfileIds = [...new Set([...clientIds, ...partnerIds])]

  let profileMap: Record<string, Profile> = {}
  if (allProfileIds.length > 0) {
    const { data: profileRows } = await admin
      .from('profiles')
      .select(PROFILE_SELECT)
      .in('id', allProfileIds)
    for (const p of profileRows ?? []) profileMap[(p as any).id] = p as Profile
  }

  // ── 4. Resolve spaces ─────────────────────────────────────────────────────────
  const spaceIds = [...new Set(lists.map((l) => (l as any).space_id ?? (l as any).workspace_id).filter(Boolean))]
  let spaceMap: Record<string, Space> = {}
  if (spaceIds.length > 0) {
    const { data: spaceRows } = await admin.from('spaces').select('*').in('id', spaceIds)
    for (const s of spaceRows ?? []) spaceMap[(s as any).id] = s as Space
  }

  // ── 5. Attach related records and normalize space_id ─────────────────────────
  const enrichedLists = lists.map((l: any) => ({
    ...l,
    space_id: l.space_id ?? l.workspace_id ?? null,
    space:    spaceMap[l.space_id ?? l.workspace_id] ?? null,
    client:   l.client_id  ? profileMap[l.client_id]  ?? null : null,
    partner:  l.partner_id ? profileMap[l.partner_id] ?? null : null,
  }))

  // ── 6. Actual hours via task IDs ──────────────────────────────────────────────
  const listIds = enrichedLists.map((l) => l.id)
  let actualHoursMap: Record<string, number> = {}

  if (listIds.length > 0) {
    // Fetch tasks for these lists (handle list_id vs project_id)
    let { data: taskRows, error: taskErr } = await admin
      .from('tasks')
      .select('id, list_id')
      .in('list_id', listIds)

    if (taskErr) {
      const fallback = await admin.from('tasks').select('id, project_id').in('project_id', listIds)
      taskRows = (fallback.data ?? []).map((t: any) => ({ id: t.id, list_id: t.project_id }))
    }

    const taskIds = (taskRows ?? []).map((t: any) => t.id)
    const taskToList: Record<string, string> = {}
    for (const t of taskRows ?? []) taskToList[(t as any).id] = (t as any).list_id

    if (taskIds.length > 0) {
      const { data: timeData } = await admin
        .from('time_entries')
        .select('task_id, duration_minutes')
        .in('task_id', taskIds)
        .not('duration_minutes', 'is', null)

      for (const entry of (timeData ?? []) as any[]) {
        const lid = taskToList[entry.task_id]
        if (lid) actualHoursMap[lid] = (actualHoursMap[lid] ?? 0) + (entry.duration_minutes ?? 0) / 60
      }
    }
  }

  const listsWithHours = enrichedLists.map((l) => ({
    ...l,
    actual_hours: actualHoursMap[l.id] ?? 0,
  }))

  // ── 7. Spaces for filter dropdown ─────────────────────────────────────────────
  let spaces: Space[] = []
  if (role === 'super_admin' || role === 'account_manager') {
    const wsQuery = orgId
      ? admin.from('spaces').select('*').eq('organization_id', orgId).order('name')
      : admin.from('spaces').select('*').order('name')
    const { data } = await wsQuery
    spaces = (data ?? []) as Space[]
  } else if (role === 'staff' || role === 'project_manager') {
    const { data: assignments } = await admin
      .from('space_assignments')
      .select('space_id')
      .eq('user_id', user.id)
    const wsIds = (assignments ?? []).map((a: any) => a.space_id as string)
    if (wsIds.length > 0) {
      const { data } = await admin.from('spaces').select('*').in('id', wsIds).order('name')
      spaces = (data ?? []) as Space[]
    }
  }

  return (
    <ListsPage
      initialLists={listsWithHours as List[]}
      profile={profile as Profile}
      spaces={spaces}
    />
  )
}
