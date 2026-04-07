'use server'

import { createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function createUserAction(data: {
  email: string
  full_name: string
  role: string
  password: string
}): Promise<{ success: boolean; userId?: string; tempPassword?: string; error?: string }> {
  try {
    const supabase = createAdminClient()

    // Create auth user via admin API
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: {
        full_name: data.full_name,
      },
    })

    if (authError) {
      return { success: false, error: authError.message }
    }

    if (!authData.user) {
      return { success: false, error: 'Failed to create user' }
    }

    // Update the profile with role and temp password flag
    const { error: profileError } = await supabase
      .from('profiles')
      .update({
        full_name: data.full_name,
        role: data.role,
        is_temp_password: true,
      })
      .eq('id', authData.user.id)

    if (profileError) {
      return { success: false, error: profileError.message }
    }

    revalidatePath('/settings')
    revalidatePath('/team')

    return {
      success: true,
      userId: authData.user.id,
      tempPassword: data.password,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return { success: false, error: message }
  }
}

export async function updateUserRoleAction(
  userId: string,
  role: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createAdminClient()

    // Verify caller is super_admin
    const { createClient: createRegularClient } = await import('@/lib/supabase/server')
    const userClient = await createRegularClient()
    const { data: { user: callerUser } } = await userClient.auth.getUser()
    if (!callerUser) return { success: false, error: 'Not authenticated' }
    const { data: callerProfile } = await supabase.from('profiles').select('role').eq('id', callerUser.id).single()
    if (!callerProfile || callerProfile.role !== 'super_admin') {
      return { success: false, error: 'Unauthorized' }
    }

    const { error } = await supabase
      .from('profiles')
      .update({ role })
      .eq('id', userId)

    if (error) {
      return { success: false, error: error.message }
    }

    revalidatePath('/settings')
    revalidatePath('/team')

    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return { success: false, error: message }
  }
}

export async function deleteUserAction(
  userId: string,
  opts?: { reassignToUserId?: string }
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createAdminClient()
    const { createClient: createRegularClient } = await import('@/lib/supabase/server')
    const userClient = await createRegularClient()
    const { data: { user: callerUser } } = await userClient.auth.getUser()
    if (!callerUser) return { success: false, error: 'Not authenticated' }
    const { data: callerProfile } = await supabase.from('profiles').select('role, full_name').eq('id', callerUser.id).single()
    if (!callerProfile || callerProfile.role !== 'super_admin') return { success: false, error: 'Unauthorized' }

    // Get all task assignments for this user
    const { data: assignedTasks } = await supabase
      .from('task_assignees')
      .select('task_id')
      .eq('user_id', userId)

    const taskIds = (assignedTasks ?? []).map((a) => a.task_id)

    if (opts?.reassignToUserId && taskIds.length > 0) {
      // Remove old assignee and add new one for each task
      for (const taskId of taskIds) {
        await supabase.from('task_assignees').delete().eq('task_id', taskId).eq('user_id', userId)
        await supabase.from('task_assignees').upsert({ task_id: taskId, user_id: opts.reassignToUserId })
      }
      // Notify the new assignee
      await supabase.from('notifications').insert({
        user_id: opts.reassignToUserId,
        type: 'task_assigned',
        title: 'Tasks reassigned to you',
        message: `${taskIds.length} task${taskIds.length === 1 ? ' has' : 's have'} been reassigned to you.`,
        is_read: false,
      })
    } else if (taskIds.length > 0) {
      // Just unassign all tasks
      await supabase.from('task_assignees').delete().eq('user_id', userId)
    }

    const { error } = await supabase.auth.admin.deleteUser(userId)
    if (error) return { success: false, error: error.message }

    revalidatePath('/settings')
    revalidatePath('/team')
    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

export async function updatePersonAction(
  userId: string,
  data: { full_name?: string; role?: string; manager_id?: string | null }
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createAdminClient()
    const { createClient: createRegularClient } = await import('@/lib/supabase/server')
    const userClient = await createRegularClient()
    const { data: { user: callerUser } } = await userClient.auth.getUser()
    if (!callerUser) return { success: false, error: 'Not authenticated' }
    const { data: callerProfile } = await supabase.from('profiles').select('role').eq('id', callerUser.id).single()
    if (!callerProfile || callerProfile.role !== 'super_admin') return { success: false, error: 'Unauthorized' }

    const { error } = await supabase.from('profiles').update(data).eq('id', userId)
    if (error) return { success: false, error: error.message }

    revalidatePath('/settings')
    revalidatePath('/team')
    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

export async function updateUserProfileAction(data: {
  full_name: string
  avatar_url?: string | null
}): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createAdminClient()

    // Get current user from admin client – we need the session from a regular client
    const { createClient } = await import('@/lib/supabase/server')
    const userClient = await createClient()

    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser()

    if (userError || !user) {
      return { success: false, error: 'Not authenticated' }
    }

    const updateData: Record<string, string | null> = {
      full_name: data.full_name,
    }

    if (data.avatar_url !== undefined) {
      updateData.avatar_url = data.avatar_url
    }

    const { error } = await supabase
      .from('profiles')
      .update(updateData)
      .eq('id', user.id)

    if (error) {
      return { success: false, error: error.message }
    }

    revalidatePath('/settings/profile')
    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return { success: false, error: message }
  }
}
