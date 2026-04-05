import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/server'
import { TimesheetPage } from '@/components/timesheet/timesheet-page'
import { Profile } from '@/types'
import { getTimesheetEntriesAction } from '@/app/actions/timesheet'
import { getUser, getProfile } from '@/lib/data/auth'

export default async function TimesheetServerPage() {
  const user = await getUser()
  if (!user) redirect('/login')

  const profile = await getProfile(user.id)
  if (!profile) redirect('/login')

  // Clients have no time tracking
  if (profile.role === 'client') redirect('/dashboard')

  // Date range: current month as default
  const now = new Date()
  const dateFrom = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const dateTo = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString()

  const admin = createAdminClient()
  const result = await getTimesheetEntriesAction({ dateFrom, dateTo })
  const entries = result.entries ?? []

  // Fetch all projects for board filter
  const { data: projects } = await admin
    .from('projects')
    .select('id, name')
    .order('name')

  // For admin: fetch all profiles for people filter
  let allProfiles: Pick<Profile, 'id' | 'full_name' | 'avatar_url' | 'role'>[] = []
  if (profile.role === 'super_admin') {
    const { data: profilesData } = await admin
      .from('profiles')
      .select('id, full_name, avatar_url, role')
      .neq('role', 'client')
      .order('full_name')
    allProfiles = (profilesData ?? []) as typeof allProfiles
  }

  return (
    <TimesheetPage
      profile={profile as Profile}
      initialEntries={entries}
      initialDateFrom={dateFrom}
      initialDateTo={dateTo}
      allProjects={(projects ?? []) as { id: string; name: string }[]}
      allProfiles={allProfiles}
    />
  )
}
