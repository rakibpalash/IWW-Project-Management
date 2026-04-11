'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { StaffSalary } from '@/types'
import { revalidatePath } from 'next/cache'

// ── Auth helper ────────────────────────────────────────────────────────────────

async function requireSuperAdmin() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, organization_id')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'super_admin') {
    throw new Error('Unauthorized: super_admin only')
  }

  return { callerId: user.id, organizationId: profile.organization_id as string, supabase }
}

// ── Get all salaries for the org ───────────────────────────────────────────────

export async function getSalariesAction(): Promise<{
  data?: (StaffSalary & { user: { id: string; full_name: string; avatar_url: string | null; role: string } | null })[]
  error?: string
}> {
  try {
    const { organizationId } = await requireSuperAdmin()
    const admin = createAdminClient()

    // Use admin client to bypass RLS (authorization already verified above)
    let query = admin
      .from('staff_salaries')
      .select('*, user:profiles(id, full_name, avatar_url, role)')
      .order('created_at', { ascending: false })

    if (organizationId) {
      query = query.eq('organization_id', organizationId)
    }

    const { data, error } = await query

    if (error) return { error: error.message }
    return { data: data as (StaffSalary & { user: { id: string; full_name: string; avatar_url: string | null; role: string } | null })[] }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

// ── Set salary for a staff member ──────────────────────────────────────────────
// Replaces any existing salary record for that user (simple one-record model).

export async function upsertSalaryAction(data: {
  userId: string
  monthlySalary: number
  effectiveFrom: string
  notes?: string
}): Promise<{ error?: string }> {
  try {
    const { callerId, organizationId, supabase } = await requireSuperAdmin()

    if (!organizationId) return { error: 'Organization not found' }

    // Verify target user belongs to the same org
    const { data: targetProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', data.userId)
      .eq('organization_id', organizationId)
      .single()

    if (!targetProfile) {
      return { error: 'Staff member not found in your organization' }
    }

    // Replace existing salary record (delete + insert keeps it simple)
    await supabase
      .from('staff_salaries')
      .delete()
      .eq('user_id', data.userId)
      .eq('organization_id', organizationId)

    const { error } = await supabase.from('staff_salaries').insert({
      user_id: data.userId,
      organization_id: organizationId,
      monthly_salary: data.monthlySalary,
      effective_from: data.effectiveFrom,
      notes: data.notes ?? null,
      created_by: callerId,
    })

    if (error) return { error: error.message }

    revalidatePath('/settings')
    return {}
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

// ── Remove salary for a staff member ──────────────────────────────────────────

export async function deleteSalaryAction(
  userId: string
): Promise<{ error?: string }> {
  try {
    const { organizationId, supabase } = await requireSuperAdmin()

    const { error } = await supabase
      .from('staff_salaries')
      .delete()
      .eq('user_id', userId)
      .eq('organization_id', organizationId)

    if (error) return { error: error.message }

    revalidatePath('/settings')
    return {}
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Unknown error' }
  }
}
