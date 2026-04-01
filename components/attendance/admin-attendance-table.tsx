'use client'

import { useState, useCallback, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { createClient } from '@/lib/supabase/client'
import { Profile, AttendanceRecord, FootballRule, AttendanceSettings } from '@/types'
import {
  getAttendanceColor,
  formatStatus,
  getInitials,
  computeAttendanceStatus,
} from '@/lib/utils'
import { cn } from '@/lib/utils'
import { useToast } from '@/components/ui/use-toast'
import { FootballRuleDialog } from './football-rule-dialog'
import {
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  UserX,
  Loader2,
  Pencil,
  Check,
  X,
} from 'lucide-react'
import { format } from 'date-fns'

const PAGE_SIZE = 15

interface Props {
  staffProfiles: Profile[]
  records: AttendanceRecord[]
  footballRule: FootballRule | null
  selectedDate: string
  settings: AttendanceSettings | null
  onDateChange: (date: string) => void
  onRecordsChange: (records: AttendanceRecord[]) => void
  onFootballRuleChange: (rule: FootballRule | null) => void
}

interface EditState {
  id: string | null // null = new record for staff with no record
  userId: string
  checkIn: string
  checkOut: string
  status: string
}

export function AdminAttendanceTable({
  staffProfiles,
  records,
  footballRule,
  selectedDate,
  settings,
  onDateChange,
  onRecordsChange,
  onFootballRuleChange,
}: Props) {
  const [footballDialogOpen, setFootballDialogOpen] = useState(false)
  const [loadingDate, setLoadingDate] = useState(false)
  const [loadingMarkAbsent, setLoadingMarkAbsent] = useState<string | null>(null)
  const [editState, setEditState] = useState<EditState | null>(null)
  const [savingEdit, setSavingEdit] = useState(false)
  const [page, setPage] = useState(0)
  const { toast } = useToast()

  // Build record map: userId -> record
  const recordMap = useMemo(() => {
    const map: Record<string, AttendanceRecord> = {}
    for (const r of records) {
      map[r.user_id] = r
    }
    return map
  }, [records])

  const footballUserIds = useMemo(
    () => new Set(footballRule?.user_ids ?? []),
    [footballRule]
  )

  const totalPages = Math.ceil(staffProfiles.length / PAGE_SIZE)
  const pagedStaff = staffProfiles.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  // ── Date navigation ───────────────────────────────────────────────────────
  const navigateDate = (delta: number) => {
    const d = new Date(selectedDate)
    d.setDate(d.getDate() + delta)
    handleDateChange(d.toISOString().slice(0, 10))
  }

  const handleDateChange = useCallback(
    async (newDate: string) => {
      onDateChange(newDate)
      setPage(0)
      setEditState(null)
      setLoadingDate(true)
      try {
        const supabase = createClient()
        const [{ data: newRecords }, { data: newRule }] = await Promise.all([
          supabase
            .from('attendance_records')
            .select(
              '*, user:profiles(id, full_name, avatar_url, email, role, is_temp_password, onboarding_completed, created_at, updated_at)'
            )
            .eq('date', newDate),
          supabase
            .from('football_rules')
            .select('*')
            .eq('date', newDate)
            .maybeSingle(),
        ])
        onRecordsChange((newRecords as unknown as AttendanceRecord[]) ?? [])
        onFootballRuleChange((newRule as FootballRule) ?? null)
      } catch (err) {
        console.error('Date fetch error:', err)
      } finally {
        setLoadingDate(false)
      }
    },
    [onDateChange, onRecordsChange, onFootballRuleChange]
  )

  // ── Mark Absent ───────────────────────────────────────────────────────────
  const markAbsent = async (staff: Profile) => {
    const supabase = createClient()
    setLoadingMarkAbsent(staff.id)
    try {
      const { data: existing } = await supabase
        .from('attendance_records')
        .select('id')
        .eq('user_id', staff.id)
        .eq('date', selectedDate)
        .maybeSingle()

      if (existing) {
        toast({ title: 'Already has a record', description: 'Edit the existing record instead.' })
        return
      }

      const { data, error } = await supabase
        .from('attendance_records')
        .insert({
          user_id: staff.id,
          date: selectedDate,
          status: 'absent',
          is_football_rule: footballUserIds.has(staff.id),
        })
        .select('*, user:profiles(id, full_name, avatar_url, email, role, is_temp_password, onboarding_completed, created_at, updated_at)')
        .single()

      if (error) throw error

      onRecordsChange([...records, data as unknown as AttendanceRecord])
      toast({ title: `${staff.full_name} marked absent` })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      toast({ title: 'Failed', description: msg, variant: 'destructive' })
    } finally {
      setLoadingMarkAbsent(null)
    }
  }

  // ── Edit record inline ────────────────────────────────────────────────────
  const startEdit = (staff: Profile, record?: AttendanceRecord) => {
    setEditState({
      id: record?.id ?? null,
      userId: staff.id,
      checkIn: record?.check_in_time ?? '',
      checkOut: record?.check_out_time ?? '',
      status: record?.status ?? 'absent',
    })
  }

  const cancelEdit = () => setEditState(null)

  const saveEdit = async () => {
    if (!editState) return
    setSavingEdit(true)
    try {
      const supabase = createClient()
      const isFootball = footballUserIds.has(editState.userId)

      // Auto-compute status if check-in time provided and settings exist
      let computedStatus = editState.status
      if (editState.checkIn && settings) {
        computedStatus = computeAttendanceStatus(editState.checkIn, isFootball, settings)
      }

      const payload = {
        check_in_time: editState.checkIn || null,
        check_out_time: editState.checkOut || null,
        status: computedStatus,
        is_football_rule: isFootball,
        updated_at: new Date().toISOString(),
      }

      let updatedRecord: AttendanceRecord

      if (editState.id) {
        // Update existing
        const { data, error } = await supabase
          .from('attendance_records')
          .update(payload)
          .eq('id', editState.id)
          .select(
            '*, user:profiles(id, full_name, avatar_url, email, role, is_temp_password, onboarding_completed, created_at, updated_at)'
          )
          .single()
        if (error) throw error
        updatedRecord = data as unknown as AttendanceRecord
        onRecordsChange(
          records.map((r) => (r.id === editState.id ? updatedRecord : r))
        )
      } else {
        // Insert new
        const { data, error } = await supabase
          .from('attendance_records')
          .insert({
            user_id: editState.userId,
            date: selectedDate,
            ...payload,
          })
          .select(
            '*, user:profiles(id, full_name, avatar_url, email, role, is_temp_password, onboarding_completed, created_at, updated_at)'
          )
          .single()
        if (error) throw error
        updatedRecord = data as unknown as AttendanceRecord
        onRecordsChange([...records, updatedRecord])
      }

      setEditState(null)
      toast({ title: 'Record saved' })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      toast({ title: 'Save failed', description: msg, variant: 'destructive' })
    } finally {
      setSavingEdit(false)
    }
  }

  const presentCount = records.filter((r) => r.check_in_time).length
  const absentCount = staffProfiles.length - presentCount

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Date navigation */}
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => navigateDate(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="relative">
            <Input
              type="date"
              value={selectedDate}
              onChange={(e) => handleDateChange(e.target.value)}
              className="w-40 h-8 text-sm"
            />
          </div>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => navigateDate(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground hidden sm:inline">
            {format(new Date(selectedDate + 'T00:00:00'), 'EEEE, MMMM d, yyyy')}
          </span>
        </div>

        {/* Right side actions */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => setFootballDialogOpen(true)}
          >
            <span>⚽</span> Football Rule
          </Button>
        </div>
      </div>

      {/* Stats bar */}
      <div className="flex gap-4 text-sm">
        <span className="text-muted-foreground">
          Total Staff: <strong>{staffProfiles.length}</strong>
        </span>
        <span className="text-green-700">
          Present: <strong>{presentCount}</strong>
        </span>
        <span className="text-red-700">
          Absent/No record: <strong>{absentCount}</strong>
        </span>
        {footballRule && (
          <span className="text-blue-700">
            ⚽ Football Rule: <strong>{footballRule.user_ids.length}</strong> staff
          </span>
        )}
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <CalendarDays className="h-4 w-4" />
            Attendance for {selectedDate}
            {loadingDate && <Loader2 className="h-3.5 w-3.5 animate-spin ml-1" />}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <TooltipProvider>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4 w-52">Name</TableHead>
                  <TableHead>Check In</TableHead>
                  <TableHead>Check Out</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-28">Rule</TableHead>
                  <TableHead className="text-right pr-4 w-36">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagedStaff.map((staff) => {
                  const record = recordMap[staff.id]
                  const isFootball = footballUserIds.has(staff.id)
                  const isEditing = editState?.userId === staff.id

                  return (
                    <TableRow key={staff.id} className={isEditing ? 'bg-muted/30' : undefined}>
                      {/* Name */}
                      <TableCell className="pl-4">
                        <div className="flex items-center gap-2.5">
                          <Avatar className="h-7 w-7 shrink-0">
                            <AvatarImage src={staff.avatar_url ?? undefined} />
                            <AvatarFallback className="text-xs">
                              {getInitials(staff.full_name)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-sm font-medium">{staff.full_name}</span>
                        </div>
                      </TableCell>

                      {/* Check In */}
                      <TableCell>
                        {isEditing ? (
                          <Input
                            type="time"
                            value={editState.checkIn}
                            onChange={(e) =>
                              setEditState((prev) =>
                                prev ? { ...prev, checkIn: e.target.value } : prev
                              )
                            }
                            className="h-7 w-28 text-xs"
                          />
                        ) : (
                          <span className="text-sm tabular-nums">
                            {record?.check_in_time ?? (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </span>
                        )}
                      </TableCell>

                      {/* Check Out */}
                      <TableCell>
                        {isEditing ? (
                          <Input
                            type="time"
                            value={editState.checkOut}
                            onChange={(e) =>
                              setEditState((prev) =>
                                prev ? { ...prev, checkOut: e.target.value } : prev
                              )
                            }
                            className="h-7 w-28 text-xs"
                          />
                        ) : (
                          <span className="text-sm tabular-nums">
                            {record?.check_out_time ?? (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </span>
                        )}
                      </TableCell>

                      {/* Status */}
                      <TableCell>
                        {isEditing ? (
                          <Select
                            value={editState.status}
                            onValueChange={(v) =>
                              setEditState((prev) =>
                                prev ? { ...prev, status: v } : prev
                              )
                            }
                          >
                            <SelectTrigger className="h-7 text-xs w-36">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {[
                                'on_time',
                                'late_150',
                                'late_250',
                                'absent',
                                'advance_absence',
                              ].map((s) => (
                                <SelectItem key={s} value={s} className="text-xs">
                                  {formatStatus(s)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : record ? (
                          <Badge
                            variant="outline"
                            className={cn(
                              'text-xs font-medium',
                              getAttendanceColor(record.status)
                            )}
                          >
                            {formatStatus(record.status)}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">No record</span>
                        )}
                      </TableCell>

                      {/* Rule indicator */}
                      <TableCell>
                        {isFootball ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="cursor-default text-base">⚽</span>
                            </TooltipTrigger>
                            <TooltipContent>Football rule applies</TooltipContent>
                          </Tooltip>
                        ) : (
                          <span className="text-xs text-muted-foreground">Standard</span>
                        )}
                      </TableCell>

                      {/* Actions */}
                      <TableCell className="text-right pr-4">
                        {isEditing ? (
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7"
                              onClick={saveEdit}
                              disabled={savingEdit}
                            >
                              {savingEdit ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Check className="h-3.5 w-3.5 text-green-600" />
                              )}
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7"
                              onClick={cancelEdit}
                              disabled={savingEdit}
                            >
                              <X className="h-3.5 w-3.5 text-red-500" />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end gap-1">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7"
                                  onClick={() => startEdit(staff, record)}
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>{record ? 'Edit record' : 'Add record'}</TooltipContent>
                            </Tooltip>

                            {!record && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-7 w-7 text-red-500 hover:text-red-600"
                                    onClick={() => markAbsent(staff)}
                                    disabled={loadingMarkAbsent === staff.id}
                                  >
                                    {loadingMarkAbsent === staff.id ? (
                                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    ) : (
                                      <UserX className="h-3.5 w-3.5" />
                                    )}
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Mark as Absent</TooltipContent>
                              </Tooltip>
                            )}
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}

                {staffProfiles.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-12">
                      No staff profiles found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TooltipProvider>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t">
              <span className="text-xs text-muted-foreground">
                Page {page + 1} of {totalPages} ({staffProfiles.length} staff)
              </span>
              <div className="flex gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-7 w-7"
                  disabled={page === 0}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-7 w-7"
                  disabled={page >= totalPages - 1}
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Football Rule Dialog */}
      <FootballRuleDialog
        open={footballDialogOpen}
        onOpenChange={setFootballDialogOpen}
        staffProfiles={staffProfiles}
        initialDate={selectedDate}
        currentRule={footballRule}
        onSaved={(rule) => onFootballRuleChange(rule)}
      />
    </div>
  )
}
