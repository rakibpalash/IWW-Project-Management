import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ListsPage } from '@/components/lists/lists-page'
import { List, Profile, Space } from '@/types'
import { getUser, getProfile } from '@/lib/data/auth'

export const metadata = {
  title: 'Lists',
}

export default async function ListsServerPage() {
  const user = await getUser()
  if (!user) redirect('/login')

  const profile = await getProfile(user.id)
  if (!profile) redirect('/login')

  const supabase = await createClient()
  const orgId = (profile as Profile).organization_id

  let lists: List[] = []

  const LIST_SELECT = `
    *,
    space:spaces(*),
    client:profiles!lists_client_id_fkey(id, full_name, email, avatar_url, role, is_temp_password, onboarding_completed, created_at, updated_at),
    partner:profiles!lists_partner_id_fkey(id, full_name, email, avatar_url, role, is_temp_password, onboarding_completed, created_at, updated_at)
  `

  if (profile.role === 'super_admin') {
    // Get org space IDs to scope lists
    const { data: orgSpaces } = orgId
      ? await supabase.from('spaces').select('id').eq('organization_id', orgId)
      : await supabase.from('spaces').select('id')
    const orgSpaceIds = (orgSpaces ?? []).map((w: any) => w.id)

    const { data } = orgSpaceIds.length > 0
      ? await supabase.from('lists').select(LIST_SELECT).in('space_id', orgSpaceIds).order('created_at', { ascending: false })
      : await supabase.from('lists').select(LIST_SELECT).order('created_at', { ascending: false })

    lists = (data ?? []) as List[]
  } else if (profile.role === 'staff') {
    // Staff: fetch lists in their assigned spaces
    const { data: assignments } = await supabase
      .from('space_assignments')
      .select('space_id')
      .eq('user_id', user.id)

    const spaceIds = (assignments ?? []).map((a) => a.space_id)

    if (spaceIds.length > 0) {
      const { data } = await supabase
        .from('lists')
        .select(LIST_SELECT)
        .in('space_id', spaceIds)
        .order('created_at', { ascending: false })

      lists = (data ?? []) as List[]
    }
  } else if (profile.role === 'client') {
    const { data } = await supabase
      .from('lists')
      .select(LIST_SELECT)
      .eq('client_id', user.id)
      .order('created_at', { ascending: false })

    lists = (data ?? []) as List[]
  }

  // Fetch actual hours per list from time entries via tasks
  const listIds = lists.map((p) => p.id)
  let actualHoursMap: Record<string, number> = {}

  if (listIds.length > 0) {
    const { data: timeData } = await supabase
      .from('time_entries')
      .select('duration_minutes, task:tasks!inner(list_id)')
      .not('duration_minutes', 'is', null)
      .in('tasks.list_id', listIds)

    if (timeData) {
      for (const entry of timeData as any[]) {
        const listId = entry.task?.list_id
        if (listId) {
          actualHoursMap[listId] = (actualHoursMap[listId] ?? 0) + (entry.duration_minutes ?? 0)
        }
      }
      Object.keys(actualHoursMap).forEach((pid) => {
        actualHoursMap[pid] = actualHoursMap[pid] / 60
      })
    }
  }

  const listsWithHours = lists.map((p) => ({
    ...p,
    actual_hours: actualHoursMap[p.id] ?? 0,
  }))

  // Fetch spaces for filter
  let spaces: Space[] = []
  if (profile.role === 'super_admin') {
    const wsQuery = orgId
      ? supabase.from('spaces').select('*').eq('organization_id', orgId).order('name')
      : supabase.from('spaces').select('*').order('name')
    const { data } = await wsQuery
    spaces = data ?? []
  } else if (profile.role === 'staff') {
    const { data: assignments } = await supabase
      .from('space_assignments')
      .select('space_id')
      .eq('user_id', user.id)
    const wsIds = (assignments ?? []).map((a) => a.space_id)
    if (wsIds.length > 0) {
      const { data } = await supabase.from('spaces').select('*').in('id', wsIds).order('name')
      spaces = data ?? []
    }
  }

  return (
    <ListsPage
      initialLists={listsWithHours}
      profile={profile as Profile}
      spaces={spaces}
    />
  )
}
