import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/server'
import { WorkspacesPage } from '@/components/workspaces/workspaces-page'
import { Workspace, Profile } from '@/types'
import { getUser, getProfile } from '@/lib/data/auth'
import { getMyPermissionsAction } from '@/app/actions/permissions'
import { can } from '@/lib/permissions'

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

  if (!profile) redirect('/login')

  const perms = await getMyPermissionsAction()

  if (!can(perms, 'workspaces', 'view')) redirect('/dashboard')

  const canCreate = can(perms, 'workspaces', 'create')
  const canEdit   = can(perms, 'workspaces', 'edit')
  const canDelete = can(perms, 'workspaces', 'delete')

  const orgId = profile.organization_id

  try {
    const admin = createAdminClient()

    if (!orgId) return <WorkspacesPage workspaces={[]} staffProfiles={[]} canCreate={canCreate} canEdit={canEdit} canDelete={canDelete} />

    const [{ data: workspaces, error: wsErr }, { data: assignments }, { data: projects }, { data: staffProfiles }] =
      await Promise.all([
        admin.from('workspaces').select('*').eq('organization_id', orgId).order('created_at', { ascending: false }),
        admin.from('workspace_assignments').select('workspace_id, user_id').in(
          'workspace_id',
          (await admin.from('workspaces').select('id').eq('organization_id', orgId)).data?.map((w) => w.id) ?? []
        ),
        admin.from('projects').select('workspace_id').in(
          'workspace_id',
          (await admin.from('workspaces').select('id').eq('organization_id', orgId)).data?.map((w) => w.id) ?? []
        ),
        admin.from('profiles').select('id, full_name, email, avatar_url, role').eq('organization_id', orgId).order('full_name'),
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

    return (
      <WorkspacesPage
        workspaces={workspacesWithCounts}
        staffProfiles={(staffProfiles as Profile[]) ?? []}
        canCreate={canCreate}
        canEdit={canEdit}
        canDelete={canDelete}
      />
    )
  } catch (err) {
    if (err && typeof err === 'object' && 'digest' in err) throw err
    console.error('[WorkspacesRoute] Unexpected error:', err)
    return <WorkspacesPage workspaces={[]} staffProfiles={[]} canCreate={canCreate} canEdit={canEdit} canDelete={canDelete} />
  }
}
