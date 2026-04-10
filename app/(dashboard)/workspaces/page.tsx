import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/server'
import { WorkspacesPage } from '@/components/workspaces/workspaces-page'
import { Workspace, Profile } from '@/types'
import { getUser, getProfile } from '@/lib/data/auth'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Workspaces — IWW PM',
}

export default async function WorkspacesRoute() {
  const user = await getUser()
  if (!user) redirect('/login')

  let profile
  try {
    profile = await getProfile(user.id)
  } catch (err) {
    console.error('[WorkspacesRoute] getProfile error:', err)
    profile = null
  }

  if (!profile || profile.role !== 'super_admin') redirect('/dashboard')

  const orgId = profile.organization_id

  try {
    const admin = createAdminClient()

    const workspacesQuery = orgId
      ? admin.from('workspaces').select('*').eq('organization_id', orgId).order('created_at', { ascending: false })
      : admin.from('workspaces').select('*').order('created_at', { ascending: false })

    const staffQuery = orgId
      ? admin.from('profiles').select('id, full_name, email, avatar_url, role').eq('role', 'staff').eq('organization_id', orgId).order('full_name')
      : admin.from('profiles').select('id, full_name, email, avatar_url, role').eq('role', 'staff').order('full_name')

    const [{ data: workspaces, error: wsErr }, { data: assignments }, { data: projects }, { data: staffProfiles }] =
      await Promise.all([
        workspacesQuery,
        admin.from('workspace_assignments').select('workspace_id'),
        admin.from('projects').select('workspace_id'),
        staffQuery,
      ])

    if (wsErr) {
      console.error('[WorkspacesRoute] DB error:', wsErr.message)
    }

    const workspacesWithCounts = (workspaces ?? []).map((ws: Workspace) => ({
      ...ws,
      member_count: (assignments ?? []).filter(
        (a: { workspace_id: string }) => a.workspace_id === ws.id
      ).length,
      project_count: (projects ?? []).filter(
        (p: { workspace_id: string }) => p.workspace_id === ws.id
      ).length,
    }))

    return <WorkspacesPage workspaces={workspacesWithCounts} staffProfiles={(staffProfiles as Profile[]) ?? []} />
  } catch (err) {
    if (err && typeof err === 'object' && 'digest' in err) throw err
    console.error('[WorkspacesRoute] Unexpected error:', err)
    return <WorkspacesPage workspaces={[]} staffProfiles={[]} />
  }
}
