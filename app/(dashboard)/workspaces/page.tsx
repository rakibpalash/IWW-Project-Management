import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/server'
import { WorkspacesPage } from '@/components/workspaces/workspaces-page'
import { Workspace } from '@/types'
import { getUser, getProfile } from '@/lib/data/auth'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Workspaces — IWW PM',
}

export default async function WorkspacesRoute() {
  const user = await getUser()
  if (!user) redirect('/login')

  const profile = await getProfile(user.id)
  if (!profile || profile.role !== 'super_admin') redirect('/dashboard')

  try {
    const admin = createAdminClient()
    const [{ data: workspaces, error: wsErr }, { data: assignments }, { data: projects }] =
      await Promise.all([
        admin.from('workspaces').select('*').order('created_at', { ascending: false }),
        admin.from('workspace_assignments').select('workspace_id'),
        admin.from('projects').select('workspace_id'),
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

    return <WorkspacesPage workspaces={workspacesWithCounts} />
  } catch (err) {
    // Re-throw Next.js redirect/notFound signals — they have a digest property
    if (err && typeof err === 'object' && 'digest' in err) throw err
    console.error('[WorkspacesRoute] Unexpected error:', err)
    // Return empty page instead of crashing into error boundary
    return <WorkspacesPage workspaces={[]} />
  }
}
