'use server'

import { getSidebarData, getUser, getProfile } from '@/lib/data/auth'
import { Space, List } from '@/types'

export async function getSidebarDataAction(): Promise<{ workspaces: Space[]; projects: List[] }> {
  try {
    const user = await getUser()
    if (!user) return { workspaces: [], projects: [] }

    const profile = await getProfile(user.id)
    if (!profile) return { workspaces: [], projects: [] }

    const data = await getSidebarData(user.id, profile.role, (profile as any).organization_id ?? null)
    return {
      workspaces: (data.workspaces as Space[]) ?? [],
      projects:   (data.projects  as List[])  ?? [],
    }
  } catch {
    return { workspaces: [], projects: [] }
  }
}
