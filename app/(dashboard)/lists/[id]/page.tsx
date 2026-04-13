import { notFound, redirect } from 'next/navigation'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { ListDetailPage } from '@/components/lists/list-detail-page'
import { List, Task, Profile, ActivityLog, ListMember, CustomRole } from '@/types'
import { getUser, getProfile } from '@/lib/data/auth'

interface ListPageProps {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: ListPageProps) {
  const { id } = await params
  const supabase = await createClient()
  const { data } = await supabase
    .from('lists')
    .select('name')
    .eq('id', id)
    .single()

  return { title: data?.name ?? 'List' }
}

export default async function ListPage({ params }: ListPageProps) {
  const { id } = await params
  const user = await getUser()
  if (!user) redirect('/login')

  const profile = await getProfile(user.id)
  if (!profile) redirect('/login')

  const supabase = await createClient()

  // Fetch list with joins
  const { data: list, error: listError } = await supabase
    .from('lists')
    .select(`
      *,
      space:spaces(*),
      client:profiles!projects_client_id_fkey(id, full_name, email, avatar_url, role, is_temp_password, onboarding_completed, created_at, updated_at),
      partner:profiles!projects_partner_id_fkey(id, full_name, email, avatar_url, role, is_temp_password, onboarding_completed, created_at, updated_at)
    `)
    .eq('id', id)
    .single()

  if (listError || !list) {
    notFound()
  }

  // Access control
  if (profile.role === 'client' && list.client_id !== user.id) {
    notFound()
  }

  if (profile.role === 'staff') {
    const { data: assignment } = await supabase
      .from('space_assignments')
      .select('id')
      .eq('user_id', user.id)
      .eq('space_id', list.space_id)
      .single()

    if (!assignment) {
      notFound()
    }
  }

  // Fetch top-level tasks (depth = 0, no parent)
  const { data: tasksRaw } = await supabase
    .from('tasks')
    .select(`
      *,
      assignees:task_assignees(
        user:profiles(id, full_name, email, avatar_url, role, is_temp_password, onboarding_completed, created_at, updated_at)
      )
    `)
    .eq('list_id', id)
    .is('parent_task_id', null)
    .order('created_at', { ascending: true })

  // Fetch subtasks for each top-level task
  const topLevelTasks: Task[] = []
  if (tasksRaw && tasksRaw.length > 0) {
    const taskIds = tasksRaw.map((t: any) => t.id)

    const { data: subtasksRaw } = await supabase
      .from('tasks')
      .select(`
        *,
        assignees:task_assignees(
          user:profiles(id, full_name, email, avatar_url, role, is_temp_password, onboarding_completed, created_at, updated_at)
        )
      `)
      .in('parent_task_id', taskIds)
      .order('created_at', { ascending: true })

    const subtasksByParent: Record<string, Task[]> = {}
    for (const sub of subtasksRaw ?? []) {
      const parentId = (sub as any).parent_task_id
      if (!subtasksByParent[parentId]) subtasksByParent[parentId] = []
      const assignees = ((sub as any).assignees ?? []).map((a: any) => a.user).filter(Boolean)
      subtasksByParent[parentId].push({ ...sub, assignees } as Task)
    }

    for (const t of tasksRaw) {
      const assignees = ((t as any).assignees ?? []).map((a: any) => a.user).filter(Boolean)
      topLevelTasks.push({
        ...(t as any),
        assignees,
        subtasks: subtasksByParent[t.id] ?? [],
      } as Task)
    }
  }

  // Fetch actual hours via time entries on tasks
  let actualHours = 0
  const { data: timeEntries } = await supabase
    .from('time_entries')
    .select('duration_minutes, task:tasks!inner(list_id)')
    .eq('tasks.list_id', id)
    .not('duration_minutes', 'is', null)

  if (timeEntries) {
    for (const entry of timeEntries as any[]) {
      actualHours += (entry.duration_minutes ?? 0) / 60
    }
  }

  // Fetch activity logs for timeline — filter by task IDs belonging to this list
  const allTaskIds = (tasksRaw ?? []).map((t: any) => t.id)
  const { data: activityLogs } = allTaskIds.length > 0
    ? await supabase
        .from('activity_logs')
        .select(`
          *,
          user:profiles(id, full_name, email, avatar_url, role, is_temp_password, onboarding_completed, created_at, updated_at)
        `)
        .in('task_id', allTaskIds)
        .order('created_at', { ascending: false })
        .limit(50)
    : { data: [] }

  // Fetch space members
  const { data: assignments } = await supabase
    .from('space_assignments')
    .select(`
      user:profiles(id, full_name, email, avatar_url, role, is_temp_password, onboarding_completed, created_at, updated_at)
    `)
    .eq('space_id', list.space_id)

  const members: Profile[] = (assignments ?? [])
    .map((a: any) => a.user)
    .filter(Boolean) as Profile[]

  // Fetch list members (two-step: list_members → profiles)
  // Includes custom_role_id for job title display; columns fall back to null if not yet migrated
  const admin = createAdminClient()
  const pmProfileSelect = 'id, full_name, email, avatar_url, role, is_temp_password, onboarding_completed, created_at, updated_at, custom_role_id'

  const baseProfileSelect = 'id, full_name, email, avatar_url, role, is_temp_password, onboarding_completed, created_at, updated_at'

  const [pmResult, allProfilesResult, customRolesResult] =
    await Promise.all([
      admin.from('list_members').select('*').eq('list_id', id).order('created_at'),
      admin.from('profiles').select(pmProfileSelect).neq('role', 'client').order('full_name'),
      admin.from('custom_roles').select('*').order('name'),
    ])

  // If custom_role_id column not yet migrated, fall back to base select
  const allProfilesData = allProfilesResult.error
    ? (await admin.from('profiles').select(baseProfileSelect).neq('role', 'client').order('full_name')).data
    : allProfilesResult.data

  const pmData = pmResult.data
  const customRolesData = customRolesResult.data

  const pmUserIds = (pmData ?? []).map((m: any) => m.user_id)
  let pmProfiles: Profile[] = []
  if (pmUserIds.length > 0) {
    const pmProfilesResult = await admin.from('profiles').select(pmProfileSelect).in('id', pmUserIds)
    const pmProfilesData = pmProfilesResult.error
      ? (await admin.from('profiles').select(baseProfileSelect).in('id', pmUserIds)).data
      : pmProfilesResult.data
    pmProfiles = (pmProfilesData as Profile[]) ?? []
  }

  const pmProfileById: Record<string, Profile> = {}
  for (const p of pmProfiles) pmProfileById[p.id] = p

  const listMembers: ListMember[] = (pmData ?? []).map((m: any) => ({
    ...m,
    profile: pmProfileById[m.user_id],
  }))

  const listWithHours = {
    ...list,
    actual_hours: actualHours,
  } as List

  return (
    <ListDetailPage
      list={listWithHours}
      tasks={topLevelTasks}
      activityLogs={(activityLogs as ActivityLog[]) ?? []}
      members={members}
      profile={profile as Profile}
      listMembers={listMembers}
      allProfiles={(allProfilesData as Profile[]) ?? []}
      customRoles={(customRolesData as CustomRole[]) ?? []}
    />
  )
}
