import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { LeavePage } from '@/components/leave/leave-page'
import { Profile, LeaveBalance, LeaveRequest, OptionalLeave } from '@/types'
import { getUser, getProfile } from '@/lib/data/auth'

export const metadata = {
  title: 'Leave Management',
}

const profileSelect =
  'id, full_name, email, avatar_url, role, is_temp_password, onboarding_completed, created_at, updated_at'

export default async function LeaveServerPage() {
  const user = await getUser()
  if (!user) redirect('/login')

  const profile = await getProfile(user.id)
  if (!profile) redirect('/login')

  if (profile.role === 'client') redirect('/dashboard')

  const supabase = await createClient()
  const currentYear = new Date().getFullYear()
  const isAdmin = profile.role === 'super_admin'
  const orgId = profile.organization_id

  if (isAdmin) {
    // Get all user IDs in this org to scope leave queries
    const { data: orgUsersRaw } = orgId
      ? await supabase.from('profiles').select('id').eq('organization_id', orgId)
      : await supabase.from('profiles').select('id')
    const orgUserIds = (orgUsersRaw ?? []).map((u: any) => u.id)

    // Admin: fetch all leave requests scoped to this org
    const leaveRequestsQuery = orgUserIds.length > 0
      ? supabase
          .from('leave_requests')
          .select(`*, user:profiles!leave_requests_user_id_fkey(${profileSelect})`)
          .in('user_id', orgUserIds)
          .order('created_at', { ascending: false })
      : supabase
          .from('leave_requests')
          .select(`*, user:profiles!leave_requests_user_id_fkey(${profileSelect})`)
          .order('created_at', { ascending: false })
    const { data: allRequests, error: allRequestsError } = await leaveRequestsQuery
    if (allRequestsError) console.error('[Leave page] allRequests query error:', allRequestsError.message)

    // Admin: fetch all staff balances for current year
    const balancesQuery = orgUserIds.length > 0
      ? supabase.from('leave_balances').select(`*, user:profiles!leave_balances_user_id_fkey(${profileSelect})`).in('user_id', orgUserIds).eq('year', currentYear).order('created_at', { ascending: false })
      : supabase.from('leave_balances').select(`*, user:profiles!leave_balances_user_id_fkey(${profileSelect})`).eq('year', currentYear).order('created_at', { ascending: false })
    const { data: allBalancesRaw } = await balancesQuery

    // Admin: compute used days from approved requests
    const approvedQuery = orgUserIds.length > 0
      ? supabase.from('leave_requests').select('user_id, leave_type, total_days, start_date').eq('status', 'approved').gte('start_date', `${currentYear}-01-01`).lte('start_date', `${currentYear}-12-31`).in('user_id', orgUserIds)
      : supabase.from('leave_requests').select('user_id, leave_type, total_days, start_date').eq('status', 'approved').gte('start_date', `${currentYear}-01-01`).lte('start_date', `${currentYear}-12-31`)
    const { data: allApprovedRaw } = await approvedQuery
    const allApproved = allApprovedRaw ?? []

    const allBalances = (allBalancesRaw ?? []).map((bal: any) => {
      const userApproved = allApproved.filter((r) => r.user_id === bal.user_id)
      return {
        ...bal,
        yearly_used: userApproved
          .filter((r) => r.leave_type === 'yearly')
          .reduce((s: number, r: any) => s + (r.total_days ?? 0), 0),
        wfh_used: userApproved
          .filter((r) => r.leave_type === 'work_from_home')
          .reduce((s: number, r: any) => s + (r.total_days ?? 0), 0),
        marriage_used: userApproved
          .filter((r) => r.leave_type === 'marriage')
          .reduce((s: number, r: any) => s + (r.total_days ?? 0), 0),
      }
    })

    // Fetch staff profiles for this org
    const staffQuery = orgId
      ? supabase.from('profiles').select(profileSelect).in('role', ['staff', 'super_admin']).eq('organization_id', orgId).order('full_name')
      : supabase.from('profiles').select(profileSelect).in('role', ['staff', 'super_admin']).order('full_name')
    const { data: staffProfiles } = await staffQuery

    // Fetch optional leave templates for this org
    const templatesQuery = orgId
      ? supabase.from('optional_leave_templates').select('id, name, default_days, is_builtin').eq('organization_id', orgId).order('is_builtin', { ascending: false }).order('created_at', { ascending: true })
      : supabase.from('optional_leave_templates').select('id, name, default_days, is_builtin').order('is_builtin', { ascending: false }).order('created_at', { ascending: true })
    const { data: leaveTemplates } = await templatesQuery

    return (
      <LeavePage
        profile={profile as Profile}
        isAdmin={true}
        allRequests={(allRequests as LeaveRequest[]) ?? []}
        allBalances={(allBalances as (LeaveBalance & { user?: Profile })[]) ?? []}
        staffProfiles={(staffProfiles as Profile[]) ?? []}
        myBalance={null}
        myRequests={[]}
        leaveTemplates={leaveTemplates ?? []}
      />
    )
  } else {
    // Staff: fetch own balance
    const { data: myBalanceRaw } = await supabase
      .from('leave_balances')
      .select('*')
      .eq('user_id', user.id)
      .eq('year', currentYear)
      .single()

    // Staff: fetch own requests
    const { data: myRequestsRaw } = await supabase
      .from('leave_requests')
      .select(`*, reviewer:profiles!leave_requests_reviewed_by_fkey(${profileSelect})`)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    const myRequests = (myRequestsRaw ?? []) as LeaveRequest[]

    const approvedThisYear = myRequests.filter(
      (r) => r.status === 'approved' && new Date(r.start_date).getFullYear() === currentYear
    )

    const yearlyUsed = approvedThisYear.filter((r) => r.leave_type === 'yearly').reduce((sum, r) => sum + (r.total_days ?? 0), 0)
    const wfhUsed = approvedThisYear.filter((r) => r.leave_type === 'work_from_home').reduce((sum, r) => sum + (r.total_days ?? 0), 0)
    const marriageUsed = approvedThisYear.filter((r) => r.leave_type === 'marriage').reduce((sum, r) => sum + (r.total_days ?? 0), 0)

    const myBalance: LeaveBalance | null = myBalanceRaw
      ? { ...(myBalanceRaw as LeaveBalance), yearly_used: yearlyUsed, wfh_used: wfhUsed, marriage_used: marriageUsed }
      : {
          id: '',
          user_id: user.id,
          year: currentYear,
          yearly_total: 18,
          yearly_used: yearlyUsed,
          yearly_additional: 0,
          wfh_total: 10,
          wfh_used: wfhUsed,
          wfh_additional: 0,
          marriage_total: 0,
          marriage_used: marriageUsed,
          created_at: '',
          updated_at: '',
        }

    // Staff: fetch optional leaves granted to them this year
    const { data: myOptionalLeavesRaw } = await supabase
      .from('optional_leaves')
      .select('*')
      .eq('user_id', user.id)
      .eq('year', currentYear)
      .order('created_at', { ascending: true })

    return (
      <LeavePage
        profile={profile as Profile}
        isAdmin={false}
        allRequests={[]}
        allBalances={[]}
        staffProfiles={[]}
        myBalance={myBalance}
        myRequests={myRequests}
        myOptionalLeaves={(myOptionalLeavesRaw ?? []) as OptionalLeave[]}
      />
    )
  }
}
