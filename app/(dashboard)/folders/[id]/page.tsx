import { notFound, redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/server'
import { FolderDetailPage } from '@/components/folders/folder-detail-page'
import { Folder, Space, List, Task, Profile } from '@/types'
import { getUser, getProfile } from '@/lib/data/auth'
import { getMyPermissionsAction } from '@/app/actions/permissions'
import { can } from '@/lib/permissions'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const admin = createAdminClient()
  const { data: folder } = await admin.from('folders').select('name').eq('id', id).single()
  return { title: folder ? `${folder.name} — IWW PM` : 'Folder — IWW PM' }
}

const profileSelect =
  'id, full_name, email, avatar_url, role, is_temp_password, onboarding_completed, created_at, updated_at'

export default async function FolderDetailRoute({
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

  // Reuse spaces view permission as the gate for folder access
  if (!can(perms, 'spaces', 'view')) redirect('/dashboard')

  const isAdmin = can(perms, 'spaces', 'edit') || can(perms, 'spaces', 'delete')

  const admin = createAdminClient()

  // Fetch the folder
  const { data: folder, error: folderError } = await admin
    .from('folders')
    .select('*')
    .eq('id', id)
    .single()

  if (folderError || !folder) notFound()

  // Fetch the parent space (soft org isolation: space carries organization_id)
  const { data: space } = await admin
    .from('spaces')
    .select('*')
    .eq('id', folder.space_id)
    .maybeSingle()

  // Soft org isolation — if space belongs to a different org, return 404
  if (space && profile.organization_id && (space as any).organization_id) {
    if ((space as any).organization_id !== profile.organization_id) notFound()
  }

  // Lists in this folder
  const { data: listsRaw } = await admin
    .from('lists')
    .select(
      'id, name, space_id, folder_id, status, priority, progress, estimated_hours, start_date, due_date, created_by, created_at, updated_at'
    )
    .eq('folder_id', id)
    .order('created_at', { ascending: false })

  const lists = (listsRaw as List[]) ?? []
  const listIds = lists.map((l) => l.id)

  // Tasks for those lists
  let tasks: Task[] = []
  if (listIds.length > 0) {
    const { data: tasksRaw } = await admin
      .from('tasks')
      .select(
        `*, assignees:task_assignees(user:profiles(${profileSelect}))`
      )
      .in('list_id', listIds)
      .order('created_at', { ascending: false })

    tasks = (tasksRaw ?? []).map((t: any) => ({
      ...t,
      assignees: (t.assignees ?? []).map((a: any) => a.user).filter(Boolean),
    })) as Task[]
  }

  // Fresh profile for this render
  const { data: profileData } = await admin
    .from('profiles')
    .select(profileSelect)
    .eq('id', user.id)
    .single()

  return (
    <FolderDetailPage
      folder={folder as Folder}
      space={(space as Space) ?? null}
      lists={lists}
      tasks={tasks}
      profile={profileData as Profile}
      isAdmin={isAdmin}
    />
  )
}
