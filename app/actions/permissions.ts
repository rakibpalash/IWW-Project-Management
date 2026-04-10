'use server'

import { createAdminClient, createClient } from '@/lib/supabase/server'
import { PermissionSet, ROLE_DEFAULT_PERMISSIONS } from '@/lib/permissions'
import { revalidatePath } from 'next/cache'

// ── Get permissions for any user (admin use) ──────────────────────────────────

export async function getUserPermissionsAction(
  userId: string
): Promise<{ permissions: PermissionSet; isCustom: boolean }> {
  const admin = createAdminClient()

  const { data: profile } = await admin
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single()

  const roleDefault = ROLE_DEFAULT_PERMISSIONS[profile?.role ?? ''] ?? {}

  const { data: row } = await admin
    .from('user_permissions')
    .select('permissions')
    .eq('user_id', userId)
    .maybeSingle()

  if (row?.permissions && Object.keys(row.permissions).length > 0) {
    return { permissions: row.permissions as PermissionSet, isCustom: true }
  }

  return { permissions: roleDefault, isCustom: false }
}

// ── Save permissions for a user (super_admin only) ────────────────────────────

export async function setUserPermissionsAction(
  userId: string,
  permissions: PermissionSet
): Promise<{ success: boolean; error?: string }> {
  try {
    const userClient = await createClient()
    const { data: { user } } = await userClient.auth.getUser()
    if (!user) return { success: false, error: 'Not authenticated' }

    const admin = createAdminClient()

    // Caller must be super_admin
    const { data: caller } = await admin
      .from('profiles')
      .select('role, organization_id')
      .eq('id', user.id)
      .single()
    if (caller?.role !== 'super_admin') return { success: false, error: 'Unauthorized' }

    // Target must be in the same org
    const { data: target } = await admin
      .from('profiles')
      .select('organization_id')
      .eq('id', userId)
      .single()
    if (!target || target.organization_id !== caller.organization_id) {
      return { success: false, error: 'Unauthorized' }
    }

    const { error } = await admin
      .from('user_permissions')
      .upsert(
        { user_id: userId, permissions },
        { onConflict: 'user_id' }
      )

    if (error) return { success: false, error: error.message }

    revalidatePath('/settings')
    revalidatePath('/', 'layout')
    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

// ── Reset a user's permissions back to their role defaults ────────────────────

export async function resetUserPermissionsAction(
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const userClient = await createClient()
    const { data: { user } } = await userClient.auth.getUser()
    if (!user) return { success: false, error: 'Not authenticated' }

    const admin = createAdminClient()

    const { data: caller } = await admin
      .from('profiles')
      .select('role, organization_id')
      .eq('id', user.id)
      .single()
    if (caller?.role !== 'super_admin') return { success: false, error: 'Unauthorized' }

    const { error } = await admin
      .from('user_permissions')
      .delete()
      .eq('user_id', userId)

    if (error) return { success: false, error: error.message }

    revalidatePath('/settings')
    revalidatePath('/', 'layout')
    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

// ── Get the current user's own permissions (used in middleware / hooks) ────────

export async function getMyPermissionsAction(): Promise<PermissionSet> {
  try {
    const userClient = await createClient()
    const { data: { user } } = await userClient.auth.getUser()
    if (!user) return {}

    const admin = createAdminClient()

    const { data: profile } = await admin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    // super_admin always gets all permissions — no custom override needed
    if (profile?.role === 'super_admin') {
      return ROLE_DEFAULT_PERMISSIONS.super_admin
    }

    const { data: row } = await admin
      .from('user_permissions')
      .select('permissions')
      .eq('user_id', user.id)
      .maybeSingle()

    if (row?.permissions && Object.keys(row.permissions).length > 0) {
      return row.permissions as PermissionSet
    }

    return ROLE_DEFAULT_PERMISSIONS[profile?.role ?? ''] ?? {}
  } catch {
    return {}
  }
}
