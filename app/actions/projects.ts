'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { Project } from '@/types'

type ProjectInput = {
  workspace_id: string
  name: string
  description?: string
  client_id?: string
  start_date?: string
  due_date?: string
  status: string
  priority: string
  estimated_hours?: number
}

// ── Create project ────────────────────────────────────────────────────────────

export async function createProjectAction(
  data: ProjectInput
): Promise<{ success: boolean; project?: Project; error?: string }> {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return { success: false, error: 'Not authenticated' }
    }

    const { data: project, error } = await supabase
      .from('projects')
      .insert({
        workspace_id: data.workspace_id,
        name: data.name,
        description: data.description ?? null,
        client_id: data.client_id ?? null,
        start_date: data.start_date ?? null,
        due_date: data.due_date ?? null,
        status: data.status,
        priority: data.priority,
        estimated_hours: data.estimated_hours ?? null,
        progress: 0,
        created_by: user.id,
      })
      .select('*')
      .single()

    if (error) {
      return { success: false, error: error.message }
    }

    revalidatePath('/projects')
    revalidatePath('/dashboard')

    return { success: true, project: project as Project }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return { success: false, error: message }
  }
}

// ── Update project ────────────────────────────────────────────────────────────

export async function updateProjectAction(
  id: string,
  data: Partial<ProjectInput> & { progress?: number }
): Promise<{ success: boolean; project?: Project; error?: string }> {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return { success: false, error: 'Not authenticated' }
    }

    // Build update payload – only include keys that were provided
    const payload: Record<string, unknown> = { updated_at: new Date().toISOString() }

    if (data.name !== undefined) payload.name = data.name
    if (data.description !== undefined) payload.description = data.description
    if (data.client_id !== undefined) payload.client_id = data.client_id
    if (data.workspace_id !== undefined) payload.workspace_id = data.workspace_id
    if (data.start_date !== undefined) payload.start_date = data.start_date
    if (data.due_date !== undefined) payload.due_date = data.due_date
    if (data.status !== undefined) payload.status = data.status
    if (data.priority !== undefined) payload.priority = data.priority
    if (data.estimated_hours !== undefined) payload.estimated_hours = data.estimated_hours
    if (data.progress !== undefined) payload.progress = data.progress

    const { data: project, error } = await supabase
      .from('projects')
      .update(payload)
      .eq('id', id)
      .select('*')
      .single()

    if (error) {
      return { success: false, error: error.message }
    }

    revalidatePath('/projects')
    revalidatePath(`/projects/${id}`)
    revalidatePath('/dashboard')

    return { success: true, project: project as Project }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return { success: false, error: message }
  }
}

// ── Delete project ────────────────────────────────────────────────────────────

export async function deleteProjectAction(
  id: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return { success: false, error: 'Not authenticated' }
    }

    const { error } = await supabase.from('projects').delete().eq('id', id)

    if (error) {
      return { success: false, error: error.message }
    }

    revalidatePath('/projects')
    revalidatePath('/dashboard')

    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return { success: false, error: message }
  }
}
