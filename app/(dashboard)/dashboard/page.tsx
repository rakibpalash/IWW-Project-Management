import { redirect } from 'next/navigation'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { DashboardPage } from '@/components/dashboard/dashboard-page'
import { Profile, List, Task, AttendanceRecord, LeaveBalance, ActivityLog } from '@/types'
import { getUser, getProfile } from '@/lib/data/auth'

export const metadata = {
  title: 'Dashboard — IWW PM',
}

const profileSelect = 'id, full_name, email, avatar_url, role, is_temp_password, onboarding_completed, created_at, updated_at'

async function fetchTimeEntriesWithMeta(admin: ReturnType<typeof createAdminClient>, userIds?: string[], limit = 8) {
  const query = admin
    .from('time_entries')
    .select('id, task_id, user_id, duration_minutes, is_running, started_at, task:tasks(id, title, list:lists(id, name))')
    .order('started_at', { ascending: false })
    .limit(limit)

  const { data: entries } = userIds ? await query.in('user_id', userIds) : await query

  if (!entries || entries.length === 0) return []

  const userIdSet = [...new Set(entries.map((e: any) => e.user_id))]
  const { data: profilesData } = await admin.from('profiles').select('id, full_name, avatar_url').in('id', userIdSet)
  const profilesById = Object.fromEntries((profilesData ?? []).map((p: any) => [p.id, p]))

  return entries.map((e: any) => ({
    id: e.id,
    task_id: e.task_id,
    task_title: e.task?.title ?? 'Deleted task',
    list_id: e.task?.list?.id ?? '',
    list_name: e.task?.list?.name ?? 'Unknown list',
    user_full_name: (profilesById[e.user_id] as any)?.full_name ?? 'Unknown',
    user_avatar_url: (profilesById[e.user_id] as any)?.avatar_url ?? null,
    duration_minutes: e.duration_minutes,
    started_at: e.started_at,
    is_running: e.is_running,
  }))
}

export default async function DashboardRoute() {
  const user = await getUser()
  if (!user) redirect('/login')

  const profile = await getProfile(user.id)
  if (!profile) redirect('/login')

  const admin = createAdminClient()
  const supabase = await createClient()
  const orgId = (profile as Profile).organization_id

  const role = (profile as Profile).role

  // ── Super Admin ─────────────────────────────────────────────────────────────
  if (role === 'super_admin') {
    const today = new Date().toISOString().slice(0, 10)

    // Get all user IDs in this org to scope non-directly-org-filtered tables
    const { data: orgUsers } = orgId
      ? await admin.from('profiles').select('id').eq('organization_id', orgId)
      : await admin.from('profiles').select('id')
    const orgUserIds = (orgUsers ?? []).map((u) => u.id)

    // Get space IDs for this org to scope lists
    const { data: orgSpaces } = orgId
      ? await admin.from('spaces').select('id').eq('organization_id', orgId)
      : await admin.from('spaces').select('id')
    const orgSpaceIds = (orgSpaces ?? []).map((w) => w.id)

    // If org has no spaces yet, skip all space-scoped queries
    if (orgSpaceIds.length === 0) {
      return (
        <DashboardPage
          profile={profile as Profile}
          totalLists={0}
          activeLists={0}
          overdueTasks={0}
          pendingLeaveRequests={0}
          todayAttendanceCount={0}
          totalStaff={0}
          recentActivity={[]}
          recentLists={[]}
          recentTeamTimeEntries={[]}
        />
      )
    }

    const [
      { data: lists },
      { data: overdueTasks },
      { data: pendingLeaves },
      { data: todayAttendance },
      { data: staffProfiles },
      { data: recentActivity },
      { data: recentLists },
      recentTeamTimeEntries,
    ] = await Promise.all([
      admin.from('lists').select('id, status').in('space_id', orgSpaceIds),
      // Overdue tasks scoped to org spaces via list join
      admin.from('tasks').select('id, list:lists!inner(space_id)').lt('due_date', new Date().toISOString()).not('status', 'in', '("done","cancelled")').in('list.space_id', orgSpaceIds),
      orgUserIds.length > 0
        ? admin.from('leave_requests').select('id').eq('status', 'pending').in('user_id', orgUserIds)
        : Promise.resolve({ data: [] }),
      orgUserIds.length > 0
        ? admin.from('attendance_records').select('id').eq('date', today).not('check_in_time', 'is', null).in('user_id', orgUserIds)
        : Promise.resolve({ data: [] }),
      orgId
        ? admin.from('profiles').select('id').eq('role', 'staff').eq('organization_id', orgId)
        : Promise.resolve({ data: [] }),
      orgUserIds.length > 0
        ? admin.from('activity_logs').select('*, user:profiles(id, full_name, avatar_url)').in('user_id', orgUserIds).order('created_at', { ascending: false }).limit(5)
        : Promise.resolve({ data: [] }),
      admin.from('lists').select('id, name, status, priority, progress, due_date, created_at').in('space_id', orgSpaceIds).order('created_at', { ascending: false }).limit(5),
      fetchTimeEntriesWithMeta(admin, orgUserIds.length > 0 ? orgUserIds : undefined, 10),
    ])

    return (
      <DashboardPage
        profile={profile as Profile}
        totalLists={lists?.length ?? 0}
        activeLists={lists?.filter((p) => p.status === 'in_progress').length ?? 0}
        overdueTasks={overdueTasks?.length ?? 0}
        pendingLeaveRequests={pendingLeaves?.length ?? 0}
        todayAttendanceCount={todayAttendance?.length ?? 0}
        totalStaff={staffProfiles?.length ?? 0}
        recentActivity={(recentActivity as unknown as ActivityLog[]) ?? []}
        recentLists={(recentLists as unknown as List[]) ?? []}
        recentTeamTimeEntries={recentTeamTimeEntries}
      />
    )
  }

  // ── Staff / Manager ──────────────────────────────────────────────────────────
  if (role !== 'client') {
    const today = new Date().toISOString().slice(0, 10)

    const { data: assignedRows } = await supabase.from('task_assignees').select('task_id').eq('user_id', user.id)
    const assignedTaskIds: string[] = (assignedRows ?? []).map((r: { task_id: string }) => r.task_id)

    const [
      { data: myTasks },
      { data: myAttendanceToday },
      { data: myLeaveBalance },
      myRecentTimeEntries,
      { data: todayTimeEntries },
    ] = await Promise.all([
      assignedTaskIds.length > 0
        ? supabase.from('tasks').select('id, title, description, status, priority, due_date, created_at, list:lists(id, name)').in('id', assignedTaskIds).not('status', 'in', '("done","cancelled")').order('due_date', { ascending: true, nullsFirst: false }).limit(20)
        : Promise.resolve({ data: [] }),
      supabase.from('attendance_records').select('*').eq('user_id', user.id).eq('date', today).maybeSingle(),
      supabase.from('leave_balances').select('*').eq('user_id', user.id).eq('year', new Date().getFullYear()).maybeSingle(),
      fetchTimeEntriesWithMeta(admin, [user.id], 8),
      supabase.from('time_entries').select('duration_minutes, is_running, started_at').eq('user_id', user.id).gte('started_at', `${today}T00:00:00`).lt('started_at', `${today}T23:59:59`),
    ])

    const timeTrackedTodayMinutes =
      todayTimeEntries?.reduce((acc, e) => acc + (e.duration_minutes ?? 0), 0) ?? 0

    return (
      <DashboardPage
        profile={profile as Profile}
        myTasks={(myTasks as unknown as Task[]) ?? []}
        myAttendanceToday={(myAttendanceToday as AttendanceRecord) ?? null}
        myLeaveBalance={(myLeaveBalance as LeaveBalance) ?? null}
        timeTrackedTodayMinutes={timeTrackedTodayMinutes}
        myRecentTimeEntries={myRecentTimeEntries}
      />
    )
  }

  // ── Client ───────────────────────────────────────────────────────────────────
  const { data: clientLists } = await supabase
    .from('lists')
    .select('id, name, description, status, priority, progress, due_date, created_at')
    .eq('client_id', user.id)
    .order('created_at', { ascending: false })

  return (
    <DashboardPage
      profile={profile as Profile}
      clientLists={(clientLists as unknown as List[]) ?? []}
    />
  )
}
