'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export interface StatusTemplateRow {
  id: string
  name: string
  statuses: object[]
  created_by: string
  organization_id: string | null
  created_at: string
}

export async function getStatusTemplatesAction(): Promise<{
  success: boolean
  templates?: StatusTemplateRow[]
  error?: string
}> {
  try {
    const supabase = await createClient()
    const admin = createAdminClient()

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) return { success: false, error: 'Not authenticated' }

    // Get user's org
    const { data: profile } = await admin
      .from('profiles')
      .select('organization_id')
      .eq('id', user.id)
      .single()

    const orgId = (profile as any)?.organization_id ?? null

    // Fetch templates for this org (or created by this user if no org)
    let query = admin
      .from('status_templates')
      .select('id, name, statuses, created_by, organization_id, created_at')
      .order('name')

    if (orgId) {
      query = query.eq('organization_id', orgId)
    } else {
      query = query.eq('created_by', user.id)
    }

    const { data, error } = await query
    if (error) return { success: false, error: error.message }

    return { success: true, templates: (data ?? []) as StatusTemplateRow[] }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

export async function saveStatusTemplateAction(data: {
  name: string
  statuses: object[]
}): Promise<{ success: boolean; template?: StatusTemplateRow; error?: string }> {
  try {
    const supabase = await createClient()
    const admin = createAdminClient()

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) return { success: false, error: 'Not authenticated' }

    const { data: profile } = await admin
      .from('profiles')
      .select('organization_id')
      .eq('id', user.id)
      .single()

    const orgId = (profile as any)?.organization_id ?? null

    const { data: template, error } = await admin
      .from('status_templates')
      .insert({
        name: data.name.trim(),
        statuses: data.statuses,
        created_by: user.id,
        organization_id: orgId,
      })
      .select('*')
      .single()

    if (error) return { success: false, error: error.message }
    return { success: true, template: template as StatusTemplateRow }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

export async function deleteStatusTemplateAction(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient()
    const admin = createAdminClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) return { success: false, error: 'Not authenticated' }

    const { error } = await admin.from('status_templates').delete().eq('id', id).eq('created_by', user.id)
    if (error) return { success: false, error: error.message }
    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}
