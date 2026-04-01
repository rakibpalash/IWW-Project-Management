'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Profile } from '@/types'

interface UseProfileReturn {
  profile: Profile | null
  loading: boolean
  error: Error | null
  refetch: () => Promise<void>
}

export function useProfile(): UseProfileReturn {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const fetchProfile = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const supabase = createClient()

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError) throw userError
      if (!user) {
        setProfile(null)
        return
      }

      const { data, error: profileError } = await supabase
        .from('profiles')
        .select(
          'id, email, full_name, avatar_url, role, is_temp_password, onboarding_completed, created_at, updated_at',
        )
        .eq('id', user.id)
        .single()

      if (profileError) throw profileError

      setProfile(data as Profile)
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch profile'))
      setProfile(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchProfile()

    // Listen to auth state changes so the profile stays fresh
    const supabase = createClient()
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        fetchProfile()
      } else {
        setProfile(null)
        setLoading(false)
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [fetchProfile])

  return { profile, loading, error, refetch: fetchProfile }
}
