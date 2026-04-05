import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { LeavePage } from '@/components/leave/leave-page'
import { Profile, LeaveBalance, LeaveRequest } from '@/types'
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

  if (isAdmin) {
    // Admin: fetch all leave requests with user info
    const { data: allRequests } = await supabase
      .from('leave_requests')
      .select(
        `
        *,
        user:profiles!leave_requests_user_id_fkey(${profileSelect}),
        reviewer:profiles!leave_requests_reviewed_by_fkey(${profileSelect})
      `
      )
      .order('created_at', { ascending: false })

    // Admin: fetch all staff balances for current year
    const { data: allBalancesRaw } = await supabase
      .from('leave_balances')
      .select(
        `
        *,
        user:profiles!leave_balances_user_id_fkey(${profileSelect})
      `
      )
      .eq('year', currentYear)
      .order('created_at', { ascending: false })

    // Admin: compute used days from approved requests (override stale counters)
    const { data: allApprovedRaw } = await supabase
      .from('leave_requests')
      .select('user_id, leave_type, total_days, start_date')
      .eq('status', 'approved')
      .gte('start_date', `${currentYear}-01-01`)
      .lte('start_date', `${currentYear}-12-31`)

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

    // Fetch all staff profiles for grant marriage dialog
    const { data: staffProfiles } = await supabase
      .from('profiles')
      .select(profileSelect)
      .in('role', ['staff', 'super_admin'])
      .order('full_name')

    return (
      <LeavePage
        profile={profile as Profile}
        isAdmin={true}
        allRequests={(allRequests as LeaveRequest[]) ?? []}
        allBalances={(allBalances as (LeaveBalance & { user?: Profile })[]) ?? []}
        staffProfiles={(staffProfiles as Profile[]) ?? []}
        myBalance={null}
        myRequests={[]}
      />
    )
  } else {
    // Staff: fetch own balance (totals only — used is computed from approved requests)
    const { data: myBalanceRaw } = await supabase
      .from('leave_balances')
      .select('*')
      .eq('user_id', user.id)
      .eq('year', currentYear)
      .single()

    // Staff: fetch own requests (all statuses)
    const { data: myRequestsRaw } = await supabase
      .from('leave_requests')
      .select(
        `
        *,
        reviewer:profiles!leave_requests_reviewed_by_fkey(${profileSelect})
      `
      )
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    const myRequests = (myRequestsRaw ?? []) as LeaveRequest[]

    // Compute used days from approved requests this year (source of truth)
    // This bypasses the leave_balances counter which can get out of sync
    const approvedThisYear = myRequests.filter(
      (r) =>
        r.status === 'approved' &&
        new Date(r.start_date).getFullYear() === currentYear
    )

    const yearlyUsed = approvedThisYear
      .filter((r) => r.leave_type === 'yearly')
      .reduce((sum, r) => sum + (r.total_days ?? 0), 0)

    const wfhUsed = approvedThisYear
      .filter((r) => r.leave_type === 'work_from_home')
      .reduce((sum, r) => sum + (r.total_days ?? 0), 0)

    const marriageUsed = approvedThisYear
      .filter((r) => r.leave_type === 'marriage')
      .reduce((sum, r) => sum + (r.total_days ?? 0), 0)

    // Merge computed used values into balance (override stale counters)
    const myBalance: LeaveBalance | null = myBalanceRaw
      ? {
          ...(myBalanceRaw as LeaveBalance),
          yearly_used: yearlyUsed,
          wfh_used: wfhUsed,
          marriage_used: marriageUsed,
        }
      : {
          // No balance record yet — construct defaults with computed used
          id: '',
          user_id: user.id,
          year: currentYear,
          yearly_total: 18,
          yearly_used: yearlyUsed,
          wfh_total: 10,
          wfh_used: wfhUsed,
          marriage_total: 0,
          marriage_used: marriageUsed,
          created_at: '',
          updated_at: '',
        }

    return (
      <LeavePage
        profile={profile as Profile}
        isAdmin={false}
        allRequests={[]}
        allBalances={[]}
        staffProfiles={[]}
        myBalance={myBalance}
        myRequests={myRequests}
      />
    )
  }
}
