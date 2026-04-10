'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { CustomTaskStatus, CustomTaskPriority } from '@/types'

// Hardcoded fallbacks — rendered immediately (no loading flash).
// Replaced by real org data as soon as the fetch resolves.
const FALLBACK_STATUSES: CustomTaskStatus[] = [
  { id: 'todo',        name: 'To Do',       slug: 'todo',        color: '#94a3b8', sort_order: 1, is_active: true, is_default: true,  is_completed_status: false, counts_toward_progress: true,  created_by: null, created_at: '' },
  { id: 'in_progress', name: 'In Progress', slug: 'in_progress', color: '#f59e0b', sort_order: 2, is_active: true, is_default: false, is_completed_status: false, counts_toward_progress: true,  created_by: null, created_at: '' },
  { id: 'in_review',   name: 'In Review',   slug: 'in_review',   color: '#3b82f6', sort_order: 3, is_active: true, is_default: false, is_completed_status: false, counts_toward_progress: true,  created_by: null, created_at: '' },
  { id: 'done',        name: 'Done',        slug: 'done',        color: '#22c55e', sort_order: 4, is_active: true, is_default: false, is_completed_status: true,  counts_toward_progress: true,  created_by: null, created_at: '' },
  { id: 'cancelled',   name: 'Cancelled',   slug: 'cancelled',   color: '#ef4444', sort_order: 5, is_active: true, is_default: false, is_completed_status: true,  counts_toward_progress: false, created_by: null, created_at: '' },
]

const FALLBACK_PRIORITIES: CustomTaskPriority[] = [
  { id: 'low',    name: 'Low',    slug: 'low',    color: '#3b82f6', sort_order: 1, is_active: true, is_default: false, created_by: null, created_at: '' },
  { id: 'medium', name: 'Medium', slug: 'medium', color: '#f59e0b', sort_order: 2, is_active: true, is_default: true,  created_by: null, created_at: '' },
  { id: 'high',   name: 'High',   slug: 'high',   color: '#f97316', sort_order: 3, is_active: true, is_default: false, created_by: null, created_at: '' },
  { id: 'urgent', name: 'Urgent', slug: 'urgent', color: '#ef4444', sort_order: 4, is_active: true, is_default: false, created_by: null, created_at: '' },
]

interface UseTaskConfigReturn {
  statuses: CustomTaskStatus[]
  priorities: CustomTaskPriority[]
  loading: boolean
  getStatus: (slug: string) => CustomTaskStatus | undefined
  getPriority: (slug: string) => CustomTaskPriority | undefined
  defaultStatus: string
  defaultPriority: string
}

export function useTaskConfig(): UseTaskConfigReturn {
  const [statuses, setStatuses] = useState<CustomTaskStatus[]>(FALLBACK_STATUSES)
  const [priorities, setPriorities] = useState<CustomTaskPriority[]>(FALLBACK_PRIORITIES)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()

    async function load() {
      // Step 1: get the current user's organization_id
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }

      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('id', user.id)
        .single()

      const orgId: string | null = profile?.organization_id ?? null

      // Step 2: fetch this org's active statuses and priorities
      const statusQ = supabase
        .from('task_statuses')
        .select('*')
        .eq('is_active', true)
        .order('sort_order')

      const priorityQ = supabase
        .from('task_priorities')
        .select('*')
        .eq('is_active', true)
        .order('sort_order')

      // Always scope by org when available — never mix orgs
      if (orgId) {
        statusQ.eq('organization_id', orgId)
        priorityQ.eq('organization_id', orgId)
      }

      const [{ data: s }, { data: p }] = await Promise.all([statusQ, priorityQ])

      if (s && s.length > 0) setStatuses(s as CustomTaskStatus[])
      if (p && p.length > 0) setPriorities(p as CustomTaskPriority[])

      setLoading(false)
    }

    load().catch(() => setLoading(false))
  }, [])

  const getStatus   = (slug: string) => statuses.find((s) => s.slug === slug)
  const getPriority = (slug: string) => priorities.find((p) => p.slug === slug)

  const defaultStatus =
    statuses.find((s) => s.is_default)?.slug ?? statuses[0]?.slug ?? 'todo'

  const defaultPriority =
    priorities.find((p) => p.is_default)?.slug ?? priorities[0]?.slug ?? 'medium'

  return { statuses, priorities, loading, getStatus, getPriority, defaultStatus, defaultPriority }
}
