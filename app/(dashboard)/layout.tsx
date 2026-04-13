import { redirect } from 'next/navigation'
import { DashboardShell } from '@/components/layout/dashboard-shell'
import { Profile, Space, List } from '@/types'
import { getUser, getProfile, getSidebarData } from '@/lib/data/auth'
import { getMyPermissionsAction } from '@/app/actions/permissions'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getUser()
  if (!user) redirect('/login')

  const profile = await getProfile(user.id)
  if (!profile) redirect('/login')

  // Super admin without an org → must set up their organization first
  // Only redirect when organization_id is explicitly null (migration has run but org not yet created).
  // If the column doesn't exist yet (undefined), skip the redirect to avoid loops.
  if (profile.role === 'super_admin' && profile.organization_id === null) {
    redirect('/setup-org')
  }

  const [permissions, { workspaces, projects }] = await Promise.all([
    getMyPermissionsAction(),
    getSidebarData(user.id, profile.role, profile.organization_id ?? null),
  ])

  return (
    <DashboardShell
      profile={profile as Profile}
      permissions={permissions}
      initialSpaces={workspaces as Space[]}
      initialLists={projects as List[]}
    >
      {children}
    </DashboardShell>
  )
}
