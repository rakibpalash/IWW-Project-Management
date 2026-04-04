'use client'

import { useState } from 'react'
import { Profile, AttendanceRecord, FootballRule, AttendanceSettings } from '@/types'
import { AdminAttendanceTable } from './admin-attendance-table'
import { AttendanceSummaryPage } from './attendance-summary-page'

// ── Staff props ──────────────────────────────────────────────────────────────
interface StaffProps {
  profile: Profile
  settings: AttendanceSettings | null
  monthRecords: AttendanceRecord[]
  // admin-only (absent so TypeScript is happy)
  staffProfiles?: never
  initialRecords?: never
  initialFootballRule?: never
  initialDate?: never
}

// ── Admin props ──────────────────────────────────────────────────────────────
interface AdminProps {
  profile: Profile
  settings: AttendanceSettings | null
  staffProfiles: Profile[]
  initialRecords: AttendanceRecord[]
  initialFootballRule: FootballRule | null
  initialDate: string
  // staff-only
  monthRecords?: never
}

type Props = StaffProps | AdminProps

export function AttendancePage(props: Props) {
  const { profile, settings } = props
  const isAdmin = profile.role === 'super_admin'

  // ── Admin state ─────────────────────────────────────────────────────────
  const [selectedDate, setSelectedDate] = useState<string>(
    isAdmin ? (props as AdminProps).initialDate : ''
  )
  const [records, setRecords] = useState<AttendanceRecord[]>(
    isAdmin ? (props as AdminProps).initialRecords : []
  )
  const [footballRule, setFootballRule] = useState<FootballRule | null>(
    isAdmin ? (props as AdminProps).initialFootballRule : null
  )

  if (isAdmin) {
    const adminProps = props as AdminProps
    return (
      <div className="space-y-6 p-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Attendance</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage and review staff attendance records.
          </p>
        </div>

        <AdminAttendanceTable
          staffProfiles={adminProps.staffProfiles}
          records={records}
          footballRule={footballRule}
          selectedDate={selectedDate}
          settings={settings}
          onDateChange={setSelectedDate}
          onRecordsChange={setRecords}
          onFootballRuleChange={setFootballRule}
        />
      </div>
    )
  }

  // ── Staff view ───────────────────────────────────────────────────────────
  const staffProps = props as StaffProps
  return (
    <div className="p-6">
      <AttendanceSummaryPage
        profile={profile}
        settings={settings}
        allRecords={staffProps.monthRecords}
      />
    </div>
  )
}
