import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { WorkspacesPage } from '@/components/workspaces/workspaces-page'
import { Workspace } from '@/types'

export const metadata = {
  title: 'Workspaces — IWW PM',
}

export default async function WorkspacesRoute() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Only super_admin can access workspaces management
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'super_admin') {
    redirect('/dashboard')
  }

  // Fetch all workspaces
  const { data: workspaces } = await supabase
    .from('workspaces')
    .select('*')
    .order('created_at', { ascending: false })

  // Fetch member counts per workspace
  const { data: assignments } = await supabase
    .from('workspace_assignments')
    .select('workspace_id')

  // Fetch project counts per workspace
  const { data: projects } = await supabase
    .from('projects')
    .select('workspace_id')

  const workspacesWithCounts = (workspaces ?? []).map((ws: Workspace) => {
    const member_count = (assignments ?? []).filter(
      (a: { workspace_id: string }) => a.workspace_id === ws.id
    ).length
    const project_count = (projects ?? []).filter(
      (p: { workspace_id: string }) => p.workspace_id === ws.id
    ).length
    return { ...ws, member_count, project_count }
  })

  return <WorkspacesPage workspaces={workspacesWithCounts} />
}
