import { redirect } from 'next/navigation'
import { unstable_cache } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/server'
import { WorkspacesPage } from '@/components/workspaces/workspaces-page'
import { Workspace } from '@/types'
import { getUser, getProfile } from '@/lib/data/auth'

export const metadata = {
  title: 'Workspaces — IWW PM',
}

const getWorkspaceData = unstable_cache(
  async () => {
    const admin = createAdminClient()
    const [{ data: workspaces }, { data: assignments }, { data: projects }] = await Promise.all([
      admin.from('workspaces').select('*').order('created_at', { ascending: false }),
      admin.from('workspace_assignments').select('workspace_id'),
      admin.from('projects').select('workspace_id'),
    ])
    return { workspaces, assignments, projects }
  },
  ['workspaces-data'],
  { revalidate: 30, tags: ['workspaces'] }
)

export default async function WorkspacesRoute() {
  const user = await getUser()
  if (!user) redirect('/login')

  const profile = await getProfile(user.id)
  if (!profile || profile.role !== 'super_admin') redirect('/dashboard')

  const { workspaces, assignments, projects } = await getWorkspaceData()

  const workspacesWithCounts = (workspaces ?? []).map((ws: Workspace) => ({
    ...ws,
    member_count: (assignments ?? []).filter(
      (a: { workspace_id: string }) => a.workspace_id === ws.id
    ).length,
    project_count: (projects ?? []).filter(
      (p: { workspace_id: string }) => p.workspace_id === ws.id
    ).length,
  }))

  return <WorkspacesPage workspaces={workspacesWithCounts} />
}
