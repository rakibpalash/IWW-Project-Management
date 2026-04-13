import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ProjectsPage } from '@/components/projects/projects-page'
import { List, Profile, Space } from '@/types'
import { getUser, getProfile } from '@/lib/data/auth'

export const metadata = {
  title: 'Lists',
}

export default async function ProjectsServerPage() {
  const user = await getUser()
  if (!user) redirect('/login')

  const profile = await getProfile(user.id)
  if (!profile) redirect('/login')

  const supabase = await createClient()
  const orgId = (profile as Profile).organization_id

  let projects: List[] = []

  const PROJECT_SELECT = `
    *,
    workspace:workspaces(*),
    client:profiles!projects_client_id_fkey(id, full_name, email, avatar_url, role, is_temp_password, onboarding_completed, created_at, updated_at),
    partner:profiles!projects_partner_id_fkey(id, full_name, email, avatar_url, role, is_temp_password, onboarding_completed, created_at, updated_at)
  `

  if (profile.role === 'super_admin') {
    // Get org workspace IDs to scope projects
    const { data: orgWorkspaces } = orgId
      ? await supabase.from('spaces').select('id').eq('organization_id', orgId)
      : await supabase.from('spaces').select('id')
    const orgWorkspaceIds = (orgWorkspaces ?? []).map((w: any) => w.id)

    const { data } = orgWorkspaceIds.length > 0
      ? await supabase.from('lists').select(PROJECT_SELECT).in('space_id', orgWorkspaceIds).order('created_at', { ascending: false })
      : await supabase.from('lists').select(PROJECT_SELECT).order('created_at', { ascending: false })

    projects = (data ?? []) as List[]
  } else if (profile.role === 'staff') {
    // Staff: fetch projects in their assigned workspaces
    const { data: assignments } = await supabase
      .from('space_assignments')
      .select('space_id')
      .eq('user_id', user.id)

    const workspaceIds = (assignments ?? []).map((a) => a.space_id)

    if (workspaceIds.length > 0) {
      const { data } = await supabase
        .from('lists')
        .select(PROJECT_SELECT)
        .in('space_id', workspaceIds)
        .order('created_at', { ascending: false })

      projects = (data ?? []) as List[]
    }
  } else if (profile.role === 'client') {
    const { data } = await supabase
      .from('lists')
      .select(PROJECT_SELECT)
      .eq('client_id', user.id)
      .order('created_at', { ascending: false })

    projects = (data ?? []) as List[]
  }

  // Fetch actual hours per project from time entries via tasks
  const projectIds = projects.map((p) => p.id)
  let actualHoursMap: Record<string, number> = {}

  if (projectIds.length > 0) {
    const { data: timeData } = await supabase
      .from('time_entries')
      .select('duration_minutes, task:tasks!inner(list_id)')
      .not('duration_minutes', 'is', null)
      .in('tasks.list_id', projectIds)

    if (timeData) {
      for (const entry of timeData as any[]) {
        const projectId = entry.task?.list_id
        if (projectId) {
          actualHoursMap[projectId] = (actualHoursMap[projectId] ?? 0) + (entry.duration_minutes ?? 0)
        }
      }
      Object.keys(actualHoursMap).forEach((pid) => {
        actualHoursMap[pid] = actualHoursMap[pid] / 60
      })
    }
  }

  const projectsWithHours = projects.map((p) => ({
    ...p,
    actual_hours: actualHoursMap[p.id] ?? 0,
  }))

  // Fetch workspaces for filter
  let workspaces: Space[] = []
  if (profile.role === 'super_admin') {
    const wsQuery = orgId
      ? supabase.from('spaces').select('*').eq('organization_id', orgId).order('name')
      : supabase.from('spaces').select('*').order('name')
    const { data } = await wsQuery
    workspaces = data ?? []
  } else if (profile.role === 'staff') {
    const { data: assignments } = await supabase
      .from('space_assignments')
      .select('space_id')
      .eq('user_id', user.id)
    const wsIds = (assignments ?? []).map((a) => a.space_id)
    if (wsIds.length > 0) {
      const { data } = await supabase.from('spaces').select('*').in('id', wsIds).order('name')
      workspaces = data ?? []
    }
  }

  return (
    <ProjectsPage
      initialLists={projectsWithHours}
      profile={profile as Profile}
      spaces={workspaces}
    />
  )
}
