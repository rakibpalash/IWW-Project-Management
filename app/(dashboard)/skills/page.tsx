import { redirect } from 'next/navigation'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { SkillsPage } from '@/components/skills/skills-page'
import { Profile, Skill, ProfileSkill } from '@/types'

export const metadata = { title: 'Skills' }

export default async function SkillsServerPage() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) redirect('/login')

  const admin = createAdminClient()

  const { data: profile } = await admin
    .from('profiles')
    .select('id, full_name, email, avatar_url, role, is_temp_password, onboarding_completed, created_at, updated_at')
    .eq('id', user.id)
    .single()
  if (!profile) redirect('/login')

  const [{ data: skills }, { data: allProfileSkills }] = await Promise.all([
    admin.from('skills').select('*').order('category').order('name'),
    admin
      .from('profile_skills')
      .select('*, user:profiles(id, full_name, avatar_url, role)')
      .order('created_at'),
  ])

  return (
    <SkillsPage
      profile={profile as Profile}
      skills={(skills ?? []) as Skill[]}
      allProfileSkills={(allProfileSkills ?? []) as ProfileSkill[]}
    />
  )
}
