import { notFound, redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/server'
import { ListDetailPage } from '@/components/lists/list-detail-page'
import { List, Task, Profile, ActivityLog, ListMember, CustomRole } from '@/types'
import { getUser, getProfile } from '@/lib/data/auth'

interface ListPageProps {
  params: Promise<{ id: string }>
}

const PROFILE_SELECT =
  'id, full_name, email, avatar_url, role, is_temp_password, onboarding_completed, created_at, updated_at'

export async function generateMetadata({ params }: ListPageProps) {
  const { id } = await params
  const admin = createAdminClient()
  const { data } = await admin.from('lists').select('name').eq('id', id).single()
  return { title: data?.name ?? 'List' }
}

export default async function ListPage({ params }: ListPageProps) {
  const { id } = await params
  const user = await getUser()
  if (!user) redirect('/login')

  const profile = await getProfile(user.id)
  if (!profile) redirect('/login')

  const admin = createAdminClient()
  const orgId = profile.organization_id

  // ── Fetch list (admin bypasses RLS; we enforce access in code below) ────────
  const { data: listRaw, error: listError } = await admin
    .from('lists')
    .select('*')
    .eq('id', id)
    .single()

  if (listError || !listRaw) {
    console.error('[ListPage] list fetch failed:', listError?.message, 'id:', id)
    notFound()
  }

  // Support both column naming conventions (pre- and post-migration)
  const spaceId: string | null =
    (listRaw as any).space_id ?? (listRaw as any).workspace_id ?? null

  // ── Org isolation: only enforce if BOTH the space and profile have org IDs set ─
  if (orgId && spaceId) {
    const { data: spaceForOrg } = await admin
      .from('spaces')
      .select('id, organization_id')
      .eq('id', spaceId)
      .single()
    // Fail only when the space's org is explicitly set AND doesn't match caller's org
    if (spaceForOrg?.organization_id && spaceForOrg.organization_id !== orgId) {
      console.error('[ListPage] org mismatch. space org:', spaceForOrg.organization_id, 'user org:', orgId)
      notFound()
    }
  }

  // ── Role-based access control ────────────────────────────────────────────────
  const role = profile.role

  if (role === 'client') {
    if ((listRaw as any).client_id !== user.id) {
      console.error('[ListPage] client access denied. list.client_id:', (listRaw as any).client_id, 'user:', user.id)
      notFound()
    }
  } else if (role === 'partner') {
    if ((listRaw as any).partner_id !== user.id) {
      console.error('[ListPage] partner access denied')
      notFound()
    }
  } else if (role === 'staff') {
    const { data: spaceAssign } = await admin
      .from('space_assignments')
      .select('id')
      .eq('user_id', user.id)
      .eq('space_id', spaceId ?? '')
      .single()

    if (!spaceAssign) {
      const { data: spaceAssignFallback } = await admin
        .from('space_assignments')
        .select('id')
        .eq('user_id', user.id)
        .eq('workspace_id', spaceId ?? '')
        .single()
      if (!spaceAssignFallback) {
        console.error('[ListPage] staff not assigned to space:', spaceId)
        notFound()
      }
    }
  } else if (role === 'project_manager') {
    const [{ data: spaceAssign }, { data: listMember }] = await Promise.all([
      admin.from('space_assignments').select('id').eq('user_id', user.id).eq('space_id', spaceId ?? '').single(),
      admin.from('list_members').select('id').eq('user_id', user.id).eq('list_id', id).single(),
    ])
    if (!spaceAssign && !listMember) {
      console.error('[ListPage] project_manager not in space/list:', spaceId, id)
      notFound()
    }
  }
  // super_admin and account_manager: no extra check needed

  // ── Fetch related data: space, client, partner ────────────────────────────────
  const [{ data: spaceData }, { data: clientProfile }, { data: partnerProfile }] =
    await Promise.all([
      spaceId
        ? admin.from('spaces').select('*').eq('id', spaceId).single()
        : Promise.resolve({ data: null }),
      (listRaw as any).client_id
        ? admin.from('profiles').select(PROFILE_SELECT).eq('id', (listRaw as any).client_id).single()
        : Promise.resolve({ data: null }),
      (listRaw as any).partner_id
        ? admin.from('profiles').select(PROFILE_SELECT).eq('id', (listRaw as any).partner_id).single()
        : Promise.resolve({ data: null }),
    ])

  const list = {
    ...listRaw,
    space_id: spaceId,
    space: spaceData,
    client: clientProfile,
    partner: partnerProfile,
  } as any

  // ── Fetch tasks (handle list_id vs project_id column) ────────────────────────
  let { data: tasksRaw, error: tasksErr } = await admin
    .from('tasks')
    .select(`*, assignees:task_assignees(user:profiles(${PROFILE_SELECT}))`)
    .eq('list_id', id)
    .is('parent_task_id', null)
    .order('created_at', { ascending: true })

  if (tasksErr) {
    const fallback = await admin
      .from('tasks')
      .select(`*, assignees:task_assignees(user:profiles(${PROFILE_SELECT}))`)
      .eq('project_id', id)
      .is('parent_task_id', null)
      .order('created_at', { ascending: true })
    tasksRaw = fallback.data
  }

  // ── Fetch subtasks ────────────────────────────────────────────────────────────
  const topLevelTasks: Task[] = []
  if (tasksRaw && tasksRaw.length > 0) {
    const taskIds = tasksRaw.map((t: any) => t.id)

    const { data: subtasksRaw } = await admin
      .from('tasks')
      .select(`*, assignees:task_assignees(user:profiles(${PROFILE_SELECT}))`)
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

  // ── Actual hours via task IDs ─────────────────────────────────────────────────
  let actualHours = 0
  const allTaskIds = topLevelTasks.map((t) => t.id)
  if (allTaskIds.length > 0) {
    const { data: timeEntries } = await admin
      .from('time_entries')
      .select('duration_minutes')
      .in('task_id', allTaskIds)
      .not('duration_minutes', 'is', null)

    for (const entry of (timeEntries ?? []) as any[]) {
      actualHours += (entry.duration_minutes ?? 0) / 60
    }
  }

  // ── Activity logs ─────────────────────────────────────────────────────────────
  const { data: activityLogs } = allTaskIds.length > 0
    ? await admin
        .from('activity_logs')
        .select(`*, user:profiles(${PROFILE_SELECT})`)
        .in('task_id', allTaskIds)
        .order('created_at', { ascending: false })
        .limit(50)
    : { data: [] }

  // ── Space members ─────────────────────────────────────────────────────────────
  let members: Profile[] = []
  if (spaceId) {
    let { data: assignments, error: assignErr } = await admin
      .from('space_assignments')
      .select(`user:profiles(${PROFILE_SELECT})`)
      .eq('space_id', spaceId)

    if (assignErr) {
      const fallback = await admin
        .from('space_assignments')
        .select(`user:profiles(${PROFILE_SELECT})`)
        .eq('workspace_id', spaceId)
      assignments = fallback.data
    }

    members = ((assignments ?? []) as any[]).map((a) => a.user).filter(Boolean) as Profile[]
  }

  // ── List members ──────────────────────────────────────────────────────────────
  const pmProfileSelect = `${PROFILE_SELECT}, custom_role_id`

  let pmResultRaw = await admin.from('list_members').select('*').eq('list_id', id).order('created_at')
  if (pmResultRaw.error) {
    pmResultRaw = await admin.from('list_members').select('*').eq('project_id', id).order('created_at')
  }
  const pmData = pmResultRaw.data ?? []

  const [allProfilesResult, customRolesResult] = await Promise.all([
    admin.from('profiles').select(pmProfileSelect).neq('role', 'client').order('full_name'),
    admin.from('custom_roles').select('*').order('name'),
  ])

  const allProfilesData = allProfilesResult.error
    ? (await admin.from('profiles').select(PROFILE_SELECT).neq('role', 'client').order('full_name')).data
    : allProfilesResult.data

  const pmUserIds = pmData.map((m: any) => m.user_id)
  let pmProfiles: Profile[] = []
  if (pmUserIds.length > 0) {
    const pmProfilesResult = await admin.from('profiles').select(pmProfileSelect).in('id', pmUserIds)
    pmProfiles = (
      pmProfilesResult.error
        ? (await admin.from('profiles').select(PROFILE_SELECT).in('id', pmUserIds)).data
        : pmProfilesResult.data
    ) as Profile[] ?? []
  }

  const pmProfileById: Record<string, Profile> = {}
  for (const p of pmProfiles) pmProfileById[p.id] = p

  const listMembers: ListMember[] = pmData.map((m: any) => ({
    ...m,
    profile: pmProfileById[m.user_id],
  }))

  return (
    <ListDetailPage
      list={{ ...list, actual_hours: actualHours } as List}
      tasks={topLevelTasks}
      activityLogs={(activityLogs as ActivityLog[]) ?? []}
      members={members}
      profile={profile as Profile}
      listMembers={listMembers}
      allProfiles={(allProfilesData as Profile[]) ?? []}
      customRoles={(customRolesResult.data as CustomRole[]) ?? []}
    />
  )
}
