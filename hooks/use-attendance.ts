'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { AttendanceRecord, AttendanceSettings, FootballRule, AppliedRule, DayType } from '@/types'
import {
  getDayType,
  resolveAppliedRule,
  computeStatusForRule,
} from '@/lib/attendance-rules'
import { useToast } from '@/components/ui/use-toast'

interface UseAttendanceReturn {
  todayRecord: AttendanceRecord | null
  hasCheckedIn: boolean
  hasCheckedOut: boolean
  dayType: DayType
  appliedRule: AppliedRule
  /** @deprecated use appliedRule === 'football' instead */
  isFootballDay: boolean
  settings: AttendanceSettings | null
  loading: boolean
  checkIn: () => Promise<void>
  checkOut: () => Promise<void>
  refresh: () => Promise<void>
}

export function useAttendance(userId: string): UseAttendanceReturn {
  const [todayRecord, setTodayRecord] = useState<AttendanceRecord | null>(null)
  const [isFootballAssigned, setIsFootballAssigned] = useState(false)
  const [settings, setSettings] = useState<AttendanceSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  const today = new Date().toISOString().slice(0, 10)
  const dayType = getDayType(new Date())
  const appliedRule = resolveAppliedRule(dayType, isFootballAssigned)

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
        setIsFootballAssigned(Array.isArray(rule.user_ids) && rule.user_ids.includes(userId))
      } else {
        setIsFootballAssigned(false)
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

    // Block Sunday check-in on the client side as well
    if (dayType === 'sunday') {
      toast({
        title: 'Holiday',
        description: 'Today is Sunday — no attendance required.',
        variant: 'destructive',
      })
      return
    }

    const supabase = createClient()
    const checkInTime = new Date().toTimeString().slice(0, 5) // 'HH:MM'
    const rule = resolveAppliedRule(dayType, isFootballAssigned)
    const status = computeStatusForRule(checkInTime, rule, settings)

    const { data, error } = await supabase
      .from('attendance_records')
      .insert({
        user_id: userId,
        date: today,
        check_in_time: checkInTime,
        status,
        applied_rule: rule,
        is_football_rule: rule === 'football',
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
      description: `${status.replace(/_/g, ' ')} · ${rule} rule · ${checkInTime}`,
    })
  }, [settings, userId, dayType, isFootballAssigned, today, toast])

  const checkOut = useCallback(async () => {
    if (!todayRecord || !userId) return
    const supabase = createClient()
    const checkOutTime = new Date().toTimeString().slice(0, 5) // 'HH:MM'

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
    dayType,
    appliedRule,
    isFootballDay: appliedRule === 'football',
    settings,
    loading,
    checkIn,
    checkOut,
    refresh: fetchData,
  }
}
