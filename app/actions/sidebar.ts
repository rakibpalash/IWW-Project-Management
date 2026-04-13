'use server'

import { getSidebarData, getUser, getProfile } from '@/lib/data/auth'
import { Space, List } from '@/types'

export async function getSidebarDataAction(): Promise<{ spaces: Space[]; lists: List[] }> {
  try {
    const user = await getUser()
    if (!user) return { spaces: [], lists: [] }

    const profile = await getProfile(user.id)
    if (!profile) return { spaces: [], lists: [] }

    const data = await getSidebarData(user.id, profile.role, (profile as any).organization_id ?? null)
    return {
      spaces: (data.spaces as Space[]) ?? [],
      lists:   (data.lists  as List[])  ?? [],
    }
  } catch {
    return { spaces: [], lists: [] }
  }
}
