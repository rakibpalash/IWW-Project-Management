'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { ProficiencyLevel } from '@/types'

// ── Add or update current user's skill ──────────────────────────────────────
export async function upsertProfileSkillAction(data: {
  skill_id: string
  proficiency: ProficiencyLevel
}): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) return { success: false, error: 'Not authenticated' }

    const { error } = await supabase
      .from('profile_skills')
      .upsert({ user_id: user.id, skill_id: data.skill_id, proficiency: data.proficiency }, {
        onConflict: 'user_id,skill_id',
      })

    if (error) return { success: false, error: error.message }

    revalidatePath('/skills')
    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

// ── Remove current user's skill ──────────────────────────────────────────────
export async function removeProfileSkillAction(
  profileSkillId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) return { success: false, error: 'Not authenticated' }

    const { error } = await supabase
      .from('profile_skills')
      .delete()
      .eq('id', profileSkillId)
      .eq('user_id', user.id)

    if (error) return { success: false, error: error.message }

    revalidatePath('/skills')
    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

// ── Create a new skill (any staff+) ─────────────────────────────────────────
export async function createSkillAction(data: {
  name: string
  category: string
  color: string
}): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) return { success: false, error: 'Not authenticated' }

    const { error } = await supabase
      .from('skills')
      .insert({ ...data, created_by: user.id })

    if (error) return { success: false, error: error.message }

    revalidatePath('/skills')
    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

// ── Delete a skill (admin only) ──────────────────────────────────────────────
export async function deleteSkillAction(
  skillId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const admin = createAdminClient()
    const { error } = await admin.from('skills').delete().eq('id', skillId)
    if (error) return { success: false, error: error.message }
    revalidatePath('/skills')
    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}
