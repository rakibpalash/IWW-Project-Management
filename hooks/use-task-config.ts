'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { CustomTaskStatus, CustomTaskPriority } from '@/types'

// Hardcoded fallbacks — used instantly (no loading flash) and as safety net
// if the DB tables don't exist yet.
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
  /** Find status config for a given slug */
  getStatus: (slug: string) => CustomTaskStatus | undefined
  /** Find priority config for a given slug */
  getPriority: (slug: string) => CustomTaskPriority | undefined
  /** Slug of the default status */
  defaultStatus: string
  /** Slug of the default priority */
  defaultPriority: string
}

export function useTaskConfig(): UseTaskConfigReturn {
  const [statuses, setStatuses] = useState<CustomTaskStatus[]>(FALLBACK_STATUSES)
  const [priorities, setPriorities] = useState<CustomTaskPriority[]>(FALLBACK_PRIORITIES)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    Promise.all([
      supabase.from('task_statuses').select('*').eq('is_active', true).order('sort_order'),
      supabase.from('task_priorities').select('*').eq('is_active', true).order('sort_order'),
    ])
      .then(([{ data: s, error: se }, { data: p, error: pe }]) => {
        if (!se && s && s.length > 0) setStatuses(s as CustomTaskStatus[])
        if (!pe && p && p.length > 0) setPriorities(p as CustomTaskPriority[])
      })
      .catch(() => {
        // Keep fallbacks on error
      })
      .finally(() => setLoading(false))
  }, [])

  const getStatus = (slug: string) => statuses.find((s) => s.slug === slug)
  const getPriority = (slug: string) => priorities.find((p) => p.slug === slug)

  const defaultStatus =
    statuses.find((s) => s.is_default)?.slug ??
    statuses[0]?.slug ??
    'todo'

  const defaultPriority =
    priorities.find((p) => p.is_default)?.slug ??
    priorities[0]?.slug ??
    'medium'

  return { statuses, priorities, loading, getStatus, getPriority, defaultStatus, defaultPriority }
}
