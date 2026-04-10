'use server'

import { createAdminClient, createClient } from '@/lib/supabase/server'
import { PermissionSet } from '@/lib/permissions'
import { revalidatePath } from 'next/cache'

export interface PermissionTemplate {
  id: string
  name: string
  description: string | null
  base_role: string
  permissions: PermissionSet
  is_default: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}

async function getCallerAdmin() {
  const userClient = await createClient()
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return null
  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('role, organization_id').eq('id', user.id).single()
  if (!profile || profile.role !== 'super_admin') return null
  return { userId: user.id, orgId: profile.organization_id as string, admin }
}

// ── List ──────────────────────────────────────────────────────────────────────

export async function listPermissionTemplatesAction(): Promise<PermissionTemplate[]> {
  try {
    const caller = await getCallerAdmin()
    if (!caller) return []
    const { data } = await caller.admin
      .from('permission_templates')
      .select('*')
      .eq('organization_id', caller.orgId)
      .order('base_role')
      .order('name')
    return (data ?? []) as PermissionTemplate[]
  } catch {
    return []
  }
}

// ── Create ────────────────────────────────────────────────────────────────────

export async function createPermissionTemplateAction(data: {
  name: string
  description?: string
  base_role: string
  permissions: PermissionSet
  is_default?: boolean
}): Promise<{ success: boolean; template?: PermissionTemplate; error?: string }> {
  try {
    const caller = await getCallerAdmin()
    if (!caller) return { success: false, error: 'Unauthorized' }

    // If marking as default, unset any existing default for this role
    if (data.is_default) {
      await caller.admin
        .from('permission_templates')
        .update({ is_default: false })
        .eq('organization_id', caller.orgId)
        .eq('base_role', data.base_role)
        .eq('is_default', true)
    }

    const { data: template, error } = await caller.admin
      .from('permission_templates')
      .insert({
        organization_id: caller.orgId,
        created_by: caller.userId,
        name: data.name,
        description: data.description ?? null,
        base_role: data.base_role,
        permissions: data.permissions,
        is_default: data.is_default ?? false,
      })
      .select('*')
      .single()

    if (error) return { success: false, error: error.message }
    revalidatePath('/settings')
    return { success: true, template: template as PermissionTemplate }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

// ── Update ────────────────────────────────────────────────────────────────────

export async function updatePermissionTemplateAction(
  templateId: string,
  data: {
    name?: string
    description?: string
    base_role?: string
    permissions?: PermissionSet
    is_default?: boolean
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    const caller = await getCallerAdmin()
    if (!caller) return { success: false, error: 'Unauthorized' }

    // Verify ownership
    const { data: existing } = await caller.admin
      .from('permission_templates')
      .select('organization_id, base_role')
      .eq('id', templateId)
      .single()
    if (existing?.organization_id !== caller.orgId) return { success: false, error: 'Unauthorized' }

    // If marking as default, unset others for this role
    const targetRole = data.base_role ?? existing.base_role
    if (data.is_default) {
      await caller.admin
        .from('permission_templates')
        .update({ is_default: false })
        .eq('organization_id', caller.orgId)
        .eq('base_role', targetRole)
        .eq('is_default', true)
        .neq('id', templateId)
    }

    const { error } = await caller.admin
      .from('permission_templates')
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq('id', templateId)

    if (error) return { success: false, error: error.message }
    revalidatePath('/settings')
    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

// ── Delete ────────────────────────────────────────────────────────────────────

export async function deletePermissionTemplateAction(
  templateId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const caller = await getCallerAdmin()
    if (!caller) return { success: false, error: 'Unauthorized' }

    const { data: existing } = await caller.admin
      .from('permission_templates')
      .select('organization_id')
      .eq('id', templateId)
      .single()
    if (existing?.organization_id !== caller.orgId) return { success: false, error: 'Unauthorized' }

    const { error } = await caller.admin
      .from('permission_templates')
      .delete()
      .eq('id', templateId)

    if (error) return { success: false, error: error.message }
    revalidatePath('/settings')
    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}
