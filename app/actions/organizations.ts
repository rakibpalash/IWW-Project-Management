'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

function slugify(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

export async function createOrganizationAction(data: {
  name: string
  logo_url?: string
}): Promise<{ success: boolean; orgId?: string; error?: string }> {
  try {
    const supabase = await createClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) return { success: false, error: 'Not authenticated' }

    const admin = createAdminClient()

    // Verify caller is super_admin
    const { data: profile } = await admin
      .from('profiles')
      .select('role, organization_id')
      .eq('id', user.id)
      .single()

    if (!profile || profile.role !== 'super_admin') {
      return { success: false, error: 'Only super admins can create organizations' }
    }

    if (profile.organization_id) {
      return { success: false, error: 'You already belong to an organization' }
    }

    // Generate unique slug
    const baseSlug = slugify(data.name) || 'org'
    let slug = baseSlug
    let attempt = 0
    while (true) {
      const { data: existing } = await admin
        .from('organizations')
        .select('id')
        .eq('slug', slug)
        .single()
      if (!existing) break
      attempt++
      slug = `${baseSlug}-${attempt}`
    }

    // Create org
    const { data: org, error: orgError } = await admin
      .from('organizations')
      .insert({ name: data.name.trim(), slug, logo_url: data.logo_url ?? null, created_by: user.id })
      .select('id')
      .single()

    if (orgError || !org) return { success: false, error: orgError?.message ?? 'Failed to create organization' }

    // Assign this super_admin to the new org
    const { error: profileError } = await admin
      .from('profiles')
      .update({ organization_id: org.id })
      .eq('id', user.id)

    if (profileError) return { success: false, error: profileError.message }

    // Seed default attendance settings for the new org
    await admin.from('attendance_settings').insert({
      organization_id: org.id,
      on_time_end: '09:00',
      late_150_end: '09:30',
      late_250_end: '11:00',
      exit_time_general: '18:00',
      friday_on_time_end: '08:30',
      friday_late_150_end: '09:00',
      friday_late_250_end: '11:00',
      exit_time_friday: '13:00',
      football_on_time_end: '09:45',
      football_late_150_end: '10:30',
      football_late_250_end: '11:00',
      exit_time_football: '18:30',
      yearly_leave_days: 18,
      wfh_days: 10,
    })

    // Seed default optional leave templates (copy built-ins)
    const { data: builtinTemplates } = await admin
      .from('optional_leave_templates')
      .select('name, default_days')
      .eq('is_builtin', true)
      .eq('organization_id', '00000000-0000-0000-0000-000000000001')

    if (builtinTemplates && builtinTemplates.length > 0) {
      await admin.from('optional_leave_templates').insert(
        builtinTemplates.map((t) => ({
          name: t.name,
          default_days: t.default_days,
          is_builtin: true,
          organization_id: org.id,
        }))
      )
    }

    revalidatePath('/dashboard')
    return { success: true, orgId: org.id }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

export async function updateOrganizationAction(data: {
  name?: string
  logo_url?: string | null
}): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Not authenticated' }

    const admin = createAdminClient()
    const { data: profile } = await admin
      .from('profiles')
      .select('role, organization_id')
      .eq('id', user.id)
      .single()

    if (!profile || profile.role !== 'super_admin' || !profile.organization_id) {
      return { success: false, error: 'Unauthorized' }
    }

    const { error } = await admin
      .from('organizations')
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq('id', profile.organization_id)

    if (error) return { success: false, error: error.message }
    revalidatePath('/settings')
    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}
