import { notFound, redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/server'
import { SpaceDetailPage } from '@/components/spaces/space-detail-page'
import { Space, Profile, List, Task, ActivityLog, Folder } from '@/types'
import { getUser, getProfile } from '@/lib/data/auth'
import { getMyPermissionsAction } from '@/app/actions/permissions'
import { can } from '@/lib/permissions'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const admin = createAdminClient()
  const { data: space } = await admin.from('spaces').select('name').eq('id', id).single()
  return { title: space ? `${space.name} — IWW PM` : 'Space — IWW PM' }
}

const profileSelect =
  'id, full_name, email, avatar_url, role, is_temp_password, onboarding_completed, created_at, updated_at'

export default async function SpaceDetailRoute({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const user = await getUser()
  if (!user) redirect('/login')

  const profile = await getProfile(user.id)
  if (!profile) redirect('/login')

  const perms = await getMyPermissionsAction()

  if (!can(perms, 'spaces', 'view')) redirect('/dashboard')

  const isAdmin = can(perms, 'spaces', 'edit') || can(perms, 'spaces', 'delete')

  const admin = createAdminClient()

  const { data: space, error: wsError } = await admin
    .from('spaces')
    .select('*')
    .eq('id', id)
    .eq('organization_id', profile.organization_id)
    .single()

  if (wsError || !space) notFound()

  const { data: assignments } = await admin
    .from('space_assignments')
    .select('user_id')
    .eq('space_id', id)

  const memberIds = (assignments ?? []).map((a: { user_id: string }) => a.user_id)
  let members: Profile[] = []
  if (memberIds.length > 0) {
    const { data: memberProfiles } = await admin
      .from('profiles')
      .select(profileSelect)
      .in('id', memberIds)
      .order('full_name')
    members = (memberProfiles as Profile[]) ?? []
  }

  const { data: foldersRaw } = await admin
    .from('folders')
    .select('*')
    .eq('space_id', id)
    .order('created_at', { ascending: true })
  const folders = (foldersRaw as Folder[]) ?? []

  const { data: lists } = await admin
    .from('lists')
    .select('*')
    .eq('space_id', id)
    .order('created_at', { ascending: false })

  const listList = (lists as List[]) ?? []
  const listIds = listList.map((p) => p.id)

  let tasks: Task[] = []
  if (listIds.length > 0) {
    const { data: tasksRaw } = await admin
      .from('tasks')
      .select(`
        *,
        list:lists(id, name),
        assignees:task_assignees(user:profiles(${profileSelect})),
        creator:profiles!tasks_created_by_fkey(${profileSelect})
      `)
      .in('list_id', listIds)
      .order('created_at', { ascending: false })

    tasks = (tasksRaw ?? []).map((t: any) => ({
      ...t,
      assignees: (t.assignees ?? []).map((a: any) => a.user).filter(Boolean),
    })) as Task[]
  }

  let activityLogs: ActivityLog[] = []
  if (listIds.length > 0) {
    const taskIds = tasks.map((t) => t.id)
    if (taskIds.length > 0) {
      const { data: logsRaw } = await admin
        .from('activity_logs')
        .select(`*, user:profiles(${profileSelect}), task:tasks(id, title)`)
        .in('task_id', taskIds)
        .order('created_at', { ascending: false })
        .limit(50)
      activityLogs = (logsRaw as ActivityLog[]) ?? []
    }
  }

  const { data: profileData } = await admin
    .from('profiles')
    .select(profileSelect)
    .eq('id', user.id)
    .single()

  return (
    <SpaceDetailPage
      space={space as Space}
      members={members}
      folders={folders}
      lists={listList}
      tasks={tasks}
      activityLogs={activityLogs}
      isAdmin={isAdmin}
      profile={profileData as any}
    />
  )
}
