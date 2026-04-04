'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/server'
import { createClient } from '@/lib/supabase/server'

// ── Create ────────────────────────────────────────────────────────────────────
export async function createCustomRoleAction(data: {
  name: string
  color: string
  description?: string
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const admin = createAdminClient()
  const { data: role, error } = await admin
    .from('custom_roles')
    .insert({ ...data, created_by: user.id })
    .select()
    .single()

  if (error) return { error: error.message }
  revalidatePath('/settings')
  return { role }
}

// ── Update ────────────────────────────────────────────────────────────────────
export async function updateCustomRoleAction(
  id: string,
  data: { name?: string; color?: string; description?: string }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const admin = createAdminClient()
  const { data: role, error } = await admin
    .from('custom_roles')
    .update(data)
    .eq('id', id)
    .select()
    .single()

  if (error) return { error: error.message }
  revalidatePath('/settings')
  return { role }
}

// ── Delete ────────────────────────────────────────────────────────────────────
export async function deleteCustomRoleAction(id: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('custom_roles')
    .delete()
    .eq('id', id)

  if (error) return { error: error.message }
  revalidatePath('/settings')
  return { success: true }
}

// ── Assign to user ────────────────────────────────────────────────────────────
export async function assignCustomRoleToUserAction(
  userId: string,
  customRoleId: string | null
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('profiles')
    .update({ custom_role_id: customRoleId })
    .eq('id', userId)

  if (error) return { error: error.message }
  revalidatePath('/settings')
  return { success: true }
}
