'use server'

import { getSidebarData, getUser, getProfile } from '@/lib/data/auth'
import { Space, List, Folder } from '@/types'

export async function getSidebarDataAction(): Promise<{ spaces: Space[]; lists: List[]; folders: Folder[] }> {
  try {
    const user = await getUser()
    if (!user) return { spaces: [], lists: [], folders: [] }

    const profile = await getProfile(user.id)
    if (!profile) return { spaces: [], lists: [], folders: [] }

    const data = await getSidebarData(user.id, profile.role, (profile as any).organization_id ?? null)
    return {
      spaces:  (data.spaces  as Space[])  ?? [],
      lists:   (data.lists   as List[])   ?? [],
      folders: (data.folders as Folder[]) ?? [],
    }
  } catch {
    return { spaces: [], lists: [], folders: [] }
  }
}
