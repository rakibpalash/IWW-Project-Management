import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/server'
import { SkillsPage } from '@/components/skills/skills-page'
import { Profile, Skill, ProfileSkill } from '@/types'
import { getUser, getProfile } from '@/lib/data/auth'

export const metadata = { title: 'Skills' }

export default async function SkillsServerPage() {
  const user = await getUser()
  if (!user) redirect('/login')

  const profile = await getProfile(user.id)
  if (!profile) redirect('/login')

  const admin = createAdminClient()

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
