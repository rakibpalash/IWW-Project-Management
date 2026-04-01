import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { DashboardPage } from '@/components/dashboard/dashboard-page'
import { Profile, Project, Task, AttendanceRecord, LeaveBalance, ActivityLog } from '@/types'

export const metadata = {
  title: 'Dashboard — IWW PM',
}

export default async function DashboardRoute() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/login')

  const role = profile.role as Profile['role']

  // ── Super Admin ───────────────────────────────────────────────────────────
  if (role === 'super_admin') {
    const today = new Date().toISOString().slice(0, 10)

    const [
      { data: projects },
      { data: overdueTasks },
      { data: pendingLeaves },
      { data: todayAttendance },
      { data: staffProfiles },
      { data: recentActivity },
      { data: recentProjects },
    ] = await Promise.all([
      supabase.from('projects').select('id, status'),
      supabase
        .from('tasks')
        .select('id')
        .lt('due_date', new Date().toISOString())
        .not('status', 'in', '("done","cancelled")'),
      supabase
        .from('leave_requests')
        .select('id')
        .eq('status', 'pending'),
      supabase
        .from('attendance_records')
        .select('id')
        .eq('date', today)
        .not('check_in_time', 'is', null),
      supabase.from('profiles').select('id').eq('role', 'staff'),
      supabase
        .from('activity_logs')
        .select('*, user:profiles(id, full_name, avatar_url)')
        .order('created_at', { ascending: false })
        .limit(5),
      supabase
        .from('projects')
        .select('id, name, status, priority, progress, due_date, created_at')
        .order('created_at', { ascending: false })
        .limit(5),
    ])

    return (
      <DashboardPage
        profile={profile as Profile}
        totalProjects={projects?.length ?? 0}
        activeProjects={projects?.filter((p) => p.status === 'in_progress').length ?? 0}
        overdueTasks={overdueTasks?.length ?? 0}
        pendingLeaveRequests={pendingLeaves?.length ?? 0}
        todayAttendanceCount={todayAttendance?.length ?? 0}
        totalStaff={staffProfiles?.length ?? 0}
        recentActivity={(recentActivity as unknown as ActivityLog[]) ?? []}
        recentProjects={(recentProjects as unknown as Project[]) ?? []}
      />
    )
  }

  // ── Staff ─────────────────────────────────────────────────────────────────
  if (role === 'staff') {
    const today = new Date().toISOString().slice(0, 10)

    // Fetch assigned task IDs first for the staff view
    const { data: assignedRows } = await supabase
      .from('task_assignees')
      .select('task_id')
      .eq('user_id', user.id)

    const assignedTaskIds: string[] = (assignedRows ?? []).map((r: { task_id: string }) => r.task_id)

    const [
      { data: myTasks },
      { data: myAttendanceToday },
      { data: myLeaveBalance },
      { data: timeEntries },
    ] = await Promise.all([
      assignedTaskIds.length > 0
        ? supabase
            .from('tasks')
            .select(
              'id, title, description, status, priority, due_date, created_at, project:projects(id, name)'
            )
            .in('id', assignedTaskIds)
            .not('status', 'in', '("done","cancelled")')
            .order('due_date', { ascending: true, nullsFirst: false })
            .limit(20)
        : Promise.resolve({ data: [] }),
      supabase
        .from('attendance_records')
        .select('*')
        .eq('user_id', user.id)
        .eq('date', today)
        .maybeSingle(),
      supabase
        .from('leave_balances')
        .select('*')
        .eq('user_id', user.id)
        .eq('year', new Date().getFullYear())
        .maybeSingle(),
      supabase
        .from('time_entries')
        .select('duration_minutes, is_running, started_at')
        .eq('user_id', user.id)
        .gte('started_at', `${today}T00:00:00`)
        .lt('started_at', `${today}T23:59:59`),
    ])

    const timeTrackedTodayMinutes =
      timeEntries?.reduce((acc, e) => acc + (e.duration_minutes ?? 0), 0) ?? 0

    return (
      <DashboardPage
        profile={profile as Profile}
        myTasks={(myTasks as unknown as Task[]) ?? []}
        myAttendanceToday={(myAttendanceToday as AttendanceRecord) ?? null}
        myLeaveBalance={(myLeaveBalance as LeaveBalance) ?? null}
        timeTrackedTodayMinutes={timeTrackedTodayMinutes}
      />
    )
  }

  // ── Client ────────────────────────────────────────────────────────────────
  const { data: clientProjects } = await supabase
    .from('projects')
    .select('id, name, description, status, priority, progress, due_date, created_at')
    .eq('client_id', user.id)
    .order('created_at', { ascending: false })

  return (
    <DashboardPage
      profile={profile as Profile}
      clientProjects={(clientProjects as unknown as Project[]) ?? []}
    />
  )
}
