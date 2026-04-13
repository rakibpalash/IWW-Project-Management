'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { Folder } from '@/types'

export async function createFolderAction(data: {
  space_id: string
  name: string
  description?: string
  is_private?: boolean
  shared_with?: string[]
  status_type?: 'inherit' | 'custom'
  custom_statuses?: object[]
}): Promise<{ success: boolean; folder?: Folder; error?: string }> {
  try {
    const supabase = await createClient()
    const admin = createAdminClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) return { success: false, error: 'Not authenticated' }

    const { data: folder, error } = await admin
      .from('folders')
      .insert({
        space_id: data.space_id,
        name: data.name.trim(),
        created_by: user.id,
        description: data.description ?? null,
        is_private: data.is_private ?? false,
        shared_with: data.shared_with ?? [],
        status_type: data.status_type ?? 'inherit',
        custom_statuses: data.custom_statuses ?? [],
      })
      .select('*')
      .single()

    if (error) return { success: false, error: error.message }

    revalidatePath('/spaces')
    revalidatePath(`/spaces/${data.space_id}`)
    return { success: true, folder: folder as Folder }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

export async function renameFolderAction(id: string, name: string): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient()
    const admin = createAdminClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) return { success: false, error: 'Not authenticated' }

    const { error } = await admin
      .from('folders')
      .update({ name: name.trim(), updated_at: new Date().toISOString() })
      .eq('id', id)

    if (error) return { success: false, error: error.message }
    revalidatePath('/spaces')
    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

export async function deleteFolderAction(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient()
    const admin = createAdminClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) return { success: false, error: 'Not authenticated' }

    // Unlink lists from folder before deleting
    await admin.from('lists').update({ folder_id: null }).eq('folder_id', id)

    const { error } = await admin.from('folders').delete().eq('id', id)
    if (error) return { success: false, error: error.message }

    revalidatePath('/spaces')
    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}
