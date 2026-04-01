'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { TimeEntry } from '@/types'

interface UseTimerReturn {
  runningEntry: TimeEntry | null
  isRunning: boolean
  elapsedSeconds: number
  startTimer: (taskId: string) => Promise<void>
  stopTimer: () => Promise<TimeEntry | null>
  loading: boolean
}

export function useTimer(): UseTimerReturn {
  const [runningEntry, setRunningEntry] = useState<TimeEntry | null>(null)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [loading, setLoading] = useState(true)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const supabase = createClient()

  const clearTick = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  const startTick = useCallback((startedAt: string) => {
    clearTick()
    const tick = () => {
      const started = new Date(startedAt).getTime()
      const now = Date.now()
      setElapsedSeconds(Math.floor((now - started) / 1000))
    }
    tick()
    intervalRef.current = setInterval(tick, 1000)
  }, [clearTick])

  // Fetch current running timer on mount
  const fetchRunning = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setLoading(false)
      return
    }

    const { data } = await supabase
      .from('time_entries')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_running', true)
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (data) {
      setRunningEntry(data as TimeEntry)
      startTick(data.started_at)
    }

    setLoading(false)
  }, [startTick])

  useEffect(() => {
    fetchRunning()
    return () => clearTick()
  }, [fetchRunning, clearTick])

  const startTimer = useCallback(async (taskId: string) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const now = new Date().toISOString()

    const { data, error } = await supabase
      .from('time_entries')
      .insert({
        task_id: taskId,
        user_id: user.id,
        started_at: now,
        ended_at: null,
        duration_minutes: null,
        is_running: true,
        description: null,
      })
      .select('*')
      .single()

    if (error || !data) {
      console.error('Failed to start timer', error)
      return
    }

    setRunningEntry(data as TimeEntry)
    startTick(data.started_at)
  }, [startTick])

  const stopTimer = useCallback(async (): Promise<TimeEntry | null> => {
    if (!runningEntry) return null

    const now = new Date()
    const started = new Date(runningEntry.started_at)
    const durationMinutes = Math.round((now.getTime() - started.getTime()) / 60000)

    const { data, error } = await supabase
      .from('time_entries')
      .update({
        ended_at: now.toISOString(),
        duration_minutes: durationMinutes,
        is_running: false,
        updated_at: now.toISOString(),
      })
      .eq('id', runningEntry.id)
      .select('*')
      .single()

    clearTick()
    setRunningEntry(null)
    setElapsedSeconds(0)

    if (error) {
      console.error('Failed to stop timer', error)
      return null
    }

    return data as TimeEntry
  }, [runningEntry, clearTick])

  return {
    runningEntry,
    isRunning: !!runningEntry,
    elapsedSeconds,
    startTimer,
    stopTimer,
    loading,
  }
}
