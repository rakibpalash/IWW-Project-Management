import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { WorkspaceDetailPage } from '@/components/workspaces/workspace-detail-page'
import { Workspace, Profile, Project } from '@/types'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: workspace } = await supabase
    .from('workspaces')
    .select('name')
    .eq('id', id)
    .single()

  return {
    title: workspace ? `${workspace.name} — IWW PM` : 'Workspace — IWW PM',
  }
}

export default async function WorkspaceDetailRoute({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'super_admin') {
    redirect('/dashboard')
  }

  // Fetch workspace
  const { data: workspace, error: wsError } = await supabase
    .from('workspaces')
    .select('*')
    .eq('id', id)
    .single()

  if (wsError || !workspace) notFound()

  // Fetch assigned member profiles
  const { data: assignments } = await supabase
    .from('workspace_assignments')
    .select('user_id')
    .eq('workspace_id', id)

  const memberIds = (assignments ?? []).map((a: { user_id: string }) => a.user_id)

  let members: Profile[] = []
  if (memberIds.length > 0) {
    const { data: memberProfiles } = await supabase
      .from('profiles')
      .select('id, full_name, email, avatar_url, role, is_temp_password, onboarding_completed, created_at, updated_at')
      .in('id', memberIds)
      .order('full_name', { ascending: true })

    members = (memberProfiles as Profile[]) ?? []
  }

  // Fetch projects in this workspace
  const { data: projects } = await supabase
    .from('projects')
    .select('id, name, description, status, priority, progress, due_date, created_at, workspace_id, client_id, created_by, updated_at')
    .eq('workspace_id', id)
    .order('created_at', { ascending: false })

  return (
    <WorkspaceDetailPage
      workspace={workspace as Workspace}
      members={members}
      projects={(projects as Project[]) ?? []}
      isAdmin={true}
    />
  )
}
