import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ProjectsPage } from '@/components/projects/projects-page'
import { Project, Profile, Workspace } from '@/types'
import { getUser, getProfile } from '@/lib/data/auth'

export const metadata = {
  title: 'Projects',
}

export default async function ProjectsServerPage() {
  const user = await getUser()
  if (!user) redirect('/login')

  const profile = await getProfile(user.id)
  if (!profile) redirect('/login')

  const supabase = await createClient()

  let projects: Project[] = []

  if (profile.role === 'super_admin') {
    // Super admin: fetch ALL projects with workspace + client joins
    const { data } = await supabase
      .from('projects')
      .select(`
        *,
        workspace:workspaces(*),
        client:profiles!projects_client_id_fkey(id, full_name, email, avatar_url, role, is_temp_password, onboarding_completed, created_at, updated_at)
      `)
      .order('created_at', { ascending: false })

    projects = (data ?? []) as Project[]
  } else if (profile.role === 'staff') {
    // Staff: fetch projects in their assigned workspaces
    const { data: assignments } = await supabase
      .from('workspace_assignments')
      .select('workspace_id')
      .eq('user_id', user.id)

    const workspaceIds = (assignments ?? []).map((a) => a.workspace_id)

    if (workspaceIds.length > 0) {
      const { data } = await supabase
        .from('projects')
        .select(`
          *,
          workspace:workspaces(*),
          client:profiles!projects_client_id_fkey(id, full_name, email, avatar_url, role, is_temp_password, onboarding_completed, created_at, updated_at)
        `)
        .in('workspace_id', workspaceIds)
        .order('created_at', { ascending: false })

      projects = (data ?? []) as Project[]
    }
  } else if (profile.role === 'client') {
    // Client: fetch projects where client_id = user.id
    const { data } = await supabase
      .from('projects')
      .select(`
        *,
        workspace:workspaces(*),
        client:profiles!projects_client_id_fkey(id, full_name, email, avatar_url, role, is_temp_password, onboarding_completed, created_at, updated_at)
      `)
      .eq('client_id', user.id)
      .order('created_at', { ascending: false })

    projects = (data ?? []) as Project[]
  }

  // Fetch actual hours per project from time entries via tasks
  const projectIds = projects.map((p) => p.id)
  let actualHoursMap: Record<string, number> = {}

  if (projectIds.length > 0) {
    const { data: timeData } = await supabase
      .from('time_entries')
      .select('duration_minutes, task:tasks!inner(project_id)')
      .not('duration_minutes', 'is', null)
      .in('tasks.project_id', projectIds)

    if (timeData) {
      for (const entry of timeData as any[]) {
        const projectId = entry.task?.project_id
        if (projectId) {
          actualHoursMap[projectId] = (actualHoursMap[projectId] ?? 0) + (entry.duration_minutes ?? 0)
        }
      }
      // convert minutes to hours
      Object.keys(actualHoursMap).forEach((pid) => {
        actualHoursMap[pid] = actualHoursMap[pid] / 60
      })
    }
  }

  const projectsWithHours = projects.map((p) => ({
    ...p,
    actual_hours: actualHoursMap[p.id] ?? 0,
  }))

  // Fetch workspaces for filter (admins/staff)
  let workspaces: Workspace[] = []
  if (profile.role === 'super_admin') {
    const { data } = await supabase.from('workspaces').select('*').order('name')
    workspaces = data ?? []
  } else if (profile.role === 'staff') {
    const { data: assignments } = await supabase
      .from('workspace_assignments')
      .select('workspace_id')
      .eq('user_id', user.id)
    const wsIds = (assignments ?? []).map((a) => a.workspace_id)
    if (wsIds.length > 0) {
      const { data } = await supabase.from('workspaces').select('*').in('id', wsIds).order('name')
      workspaces = data ?? []
    }
  }

  return (
    <ProjectsPage
      initialProjects={projectsWithHours}
      profile={profile as Profile}
      workspaces={workspaces}
    />
  )
}
