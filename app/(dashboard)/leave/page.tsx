import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { LeavePage } from '@/components/leave/leave-page'
import { Profile, LeaveBalance, LeaveRequest } from '@/types'

export const metadata = {
  title: 'Leave Management',
}

const profileSelect =
  'id, full_name, email, avatar_url, role, is_temp_password, onboarding_completed, created_at, updated_at'

export default async function LeaveServerPage() {
  const supabase = await createClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select(profileSelect)
    .eq('id', user.id)
    .single()

  if (!profile) {
    redirect('/login')
  }

  if (profile.role === 'client') redirect('/dashboard')

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
    const { data: allBalances } = await supabase
      .from('leave_balances')
      .select(
        `
        *,
        user:profiles!leave_balances_user_id_fkey(${profileSelect})
      `
      )
      .eq('year', currentYear)
      .order('created_at', { ascending: false })

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
    // Staff: fetch own balance
    const { data: myBalance } = await supabase
      .from('leave_balances')
      .select('*')
      .eq('user_id', user.id)
      .eq('year', currentYear)
      .single()

    // Staff: fetch own requests
    const { data: myRequests } = await supabase
      .from('leave_requests')
      .select(
        `
        *,
        reviewer:profiles!leave_requests_reviewed_by_fkey(${profileSelect})
      `
      )
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    return (
      <LeavePage
        profile={profile as Profile}
        isAdmin={false}
        allRequests={[]}
        allBalances={[]}
        staffProfiles={[]}
        myBalance={(myBalance as LeaveBalance) ?? null}
        myRequests={(myRequests as LeaveRequest[]) ?? []}
      />
    )
  }
}
