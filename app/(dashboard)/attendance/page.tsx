import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AttendancePage } from '@/components/attendance/attendance-page'
import { getUser, getProfile } from '@/lib/data/auth'
import {
  Profile,
  AttendanceRecord,
  FootballRule,
  AttendanceSettings,
} from '@/types'

export const metadata = {
  title: 'Attendance — IWW PM',
}

export default async function AttendanceRoute() {
  const user = await getUser()
  if (!user) redirect('/login')

  const profileData = await getProfile(user.id)
  if (!profileData) redirect('/login')

  const profile = profileData as Profile
  const supabase = await createClient()

  if (profile.role === 'client') redirect('/dashboard')

  const { data: settingsData } = await supabase
    .from('attendance_settings')
    .select('*')
    .single()

  const settings = settingsData as AttendanceSettings | null

  // ── Super Admin view ─────────────────────────────────────────────────────
  if (profile.role === 'super_admin') {
    const today = new Date().toISOString().slice(0, 10)

    const [
      { data: staffProfiles },
      { data: todayRecords },
      { data: todayFootballRule },
    ] = await Promise.all([
      supabase
        .from('profiles')
        .select('id, full_name, email, avatar_url, role, is_temp_password, onboarding_completed, created_at, updated_at')
        .eq('role', 'staff')
        .order('full_name', { ascending: true }),
      supabase
        .from('attendance_records')
        .select('*, user:profiles(id, full_name, avatar_url, email, role, is_temp_password, onboarding_completed, created_at, updated_at)')
        .eq('date', today),
      supabase
        .from('football_rules')
        .select('*')
        .eq('date', today)
        .maybeSingle(),
    ])

    return (
      <AttendancePage
        profile={profile as Profile}
        settings={settings}
        staffProfiles={(staffProfiles as Profile[]) ?? []}
        initialRecords={(todayRecords as unknown as AttendanceRecord[]) ?? []}
        initialFootballRule={(todayFootballRule as unknown as FootballRule) ?? null}
        initialDate={today}
      />
    )
  }

  // ── Staff / Manager view — fetch 3 months back + 1 month ahead ───────────
  const now = new Date()
  const rangeStart = new Date(now.getFullYear(), now.getMonth() - 2, 1)
    .toLocaleDateString('en-CA')
  const rangeEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    .toLocaleDateString('en-CA')

  const { data: allRecords } = await supabase
    .from('attendance_records')
    .select('*')
    .eq('user_id', user.id)
    .gte('date', rangeStart)
    .lte('date', rangeEnd)
    .order('date', { ascending: true })

  return (
    <AttendancePage
      profile={profile as Profile}
      settings={settings}
      monthRecords={(allRecords as AttendanceRecord[]) ?? []}
    />
  )
}
