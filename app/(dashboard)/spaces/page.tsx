import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/server'
import { WorkspacesPage } from '@/components/workspaces/workspaces-page'
import { Space, Profile } from '@/types'
import { getUser, getProfile } from '@/lib/data/auth'
import { getMyPermissionsAction } from '@/app/actions/permissions'
import { can } from '@/lib/permissions'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Spaces — IWW PM',
}

export default async function SpacesRoute() {
  const user = await getUser()
  if (!user) redirect('/login')

  let profile
  try {
    profile = await getProfile(user.id)
  } catch (err) {
    console.error('[SpacesRoute] getProfile error:', err)
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
        admin.from('spaces').select('*').eq('organization_id', orgId).order('created_at', { ascending: false }),
        admin.from('space_assignments').select('space_id, user_id').in(
          'space_id',
          (await admin.from('spaces').select('id').eq('organization_id', orgId)).data?.map((w) => w.id) ?? []
        ),
        admin.from('lists').select('space_id').in(
          'space_id',
          (await admin.from('spaces').select('id').eq('organization_id', orgId)).data?.map((w) => w.id) ?? []
        ),
        admin.from('profiles').select('id, full_name, email, avatar_url, role').eq('organization_id', orgId).order('full_name'),
      ])

    if (wsErr) {
      console.error('[SpacesRoute] DB error:', wsErr.message)
    }

    const workspacesWithCounts = (workspaces ?? []).map((ws: Space) => ({
      ...ws,
      member_count: (assignments ?? []).filter(
        (a: { space_id: string }) => a.space_id === ws.id
      ).length,
      project_count: (projects ?? []).filter(
        (p: { space_id: string }) => p.space_id === ws.id
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
    console.error('[SpacesRoute] Unexpected error:', err)
    return <WorkspacesPage workspaces={[]} staffProfiles={[]} canCreate={canCreate} canEdit={canEdit} canDelete={canDelete} />
  }
}
