'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { AttendanceRecord, AttendanceSettings, FootballRule } from '@/types'
import { computeAttendanceStatus } from '@/lib/utils'
import { useToast } from '@/components/ui/use-toast'

interface UseAttendanceReturn {
  todayRecord: AttendanceRecord | null
  hasCheckedIn: boolean
  hasCheckedOut: boolean
  isFootballDay: boolean
  settings: AttendanceSettings | null
  loading: boolean
  checkIn: () => Promise<void>
  checkOut: () => Promise<void>
  refresh: () => Promise<void>
}

export function useAttendance(userId: string): UseAttendanceReturn {
  const [todayRecord, setTodayRecord] = useState<AttendanceRecord | null>(null)
  const [isFootballDay, setIsFootballDay] = useState(false)
  const [settings, setSettings] = useState<AttendanceSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  const today = new Date().toISOString().slice(0, 10)

  const fetchData = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    try {
      const supabase = createClient()

      const [
        { data: record },
        { data: footballRule },
        { data: settingsData },
      ] = await Promise.all([
        supabase
          .from('attendance_records')
          .select('*')
          .eq('user_id', userId)
          .eq('date', today)
          .maybeSingle(),
        supabase
          .from('football_rules')
          .select('*')
          .eq('date', today)
          .maybeSingle(),
        supabase
          .from('attendance_settings')
          .select('*')
          .single(),
      ])

      setTodayRecord(record as AttendanceRecord | null)
      setSettings(settingsData as AttendanceSettings | null)

      if (footballRule) {
        const rule = footballRule as FootballRule
        setIsFootballDay(Array.isArray(rule.user_ids) && rule.user_ids.includes(userId))
      } else {
        setIsFootballDay(false)
      }
    } catch (err) {
      console.error('useAttendance fetch error:', err)
    } finally {
      setLoading(false)
    }
  }, [userId, today])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const checkIn = useCallback(async () => {
    if (!settings || !userId) return
    const supabase = createClient()
    const checkInTime = new Date().toTimeString().slice(0, 5) // HH:MM

    // For absent (no check-in after 11:00 on non-football day) we still allow check-in
    // but status will reflect the actual time
    const status = computeAttendanceStatus(checkInTime, isFootballDay, settings)

    const { data, error } = await supabase
      .from('attendance_records')
      .insert({
        user_id: userId,
        date: today,
        check_in_time: checkInTime,
        status,
        is_football_rule: isFootballDay,
        notes: null,
      })
      .select('*')
      .single()

    if (error) {
      toast({
        title: 'Check-in failed',
        description: error.message,
        variant: 'destructive',
      })
      return
    }

    setTodayRecord(data as AttendanceRecord)
    toast({
      title: 'Checked in!',
      description: `Status: ${status.replace(/_/g, ' ')} at ${checkInTime}`,
    })
  }, [settings, userId, isFootballDay, today, toast])

  const checkOut = useCallback(async () => {
    if (!todayRecord || !userId) return
    const supabase = createClient()
    const checkOutTime = new Date().toTimeString().slice(0, 5) // HH:MM

    const { data, error } = await supabase
      .from('attendance_records')
      .update({ check_out_time: checkOutTime, updated_at: new Date().toISOString() })
      .eq('id', todayRecord.id)
      .select('*')
      .single()

    if (error) {
      toast({
        title: 'Check-out failed',
        description: error.message,
        variant: 'destructive',
      })
      return
    }

    setTodayRecord(data as AttendanceRecord)
    toast({
      title: 'Checked out!',
      description: `Check-out time: ${checkOutTime}`,
    })
  }, [todayRecord, userId, toast])

  const hasCheckedIn = !!todayRecord?.check_in_time
  const hasCheckedOut = !!todayRecord?.check_out_time

  return {
    todayRecord,
    hasCheckedIn,
    hasCheckedOut,
    isFootballDay,
    settings,
    loading,
    checkIn,
    checkOut,
    refresh: fetchData,
  }
}
