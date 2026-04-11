'use client'

import { useState, useCallback, useMemo } from 'react'
import { CardContent } from '@/components/ui/card'
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
} from '@/lib/utils'
import {
  getDayType,
  resolveAppliedRule,
  computeStatusForRule,
} from '@/lib/attendance-rules'
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
  Download,
  ChevronDown,
  Banknote,
  CheckCircle2,
  XCircle,
} from 'lucide-react'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { updateFineStatusAction, adminSaveAttendanceRecordAction } from '@/app/actions/attendance'
import { format } from 'date-fns'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

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
  // Fine management
  const [fineActionId, setFineActionId] = useState<string | null>(null)
  const [fineActionType, setFineActionType] = useState<'paid' | 'waived' | null>(null)
  const [waiveReason, setWaiveReason] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [bkashTxnId, setBkashTxnId] = useState('')
  const [savingFine, setSavingFine] = useState(false)
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
              '*, user:profiles!user_id(id, full_name, avatar_url, email, role, is_temp_password, onboarding_completed, created_at, updated_at)'
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
        .select('*, user:profiles!user_id(id, full_name, avatar_url, email, role, is_temp_password, onboarding_completed, created_at, updated_at)')
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
      const isFootball = footballUserIds.has(editState.userId)
      const targetDate = new Date(selectedDate + 'T00:00:00')
      const dayType = getDayType(targetDate)
      const appliedRule = resolveAppliedRule(dayType, isFootball)

      // Auto-compute status if check-in time provided and settings exist
      let computedStatus = editState.status
      if (editState.checkIn && settings) {
        computedStatus = computeStatusForRule(editState.checkIn, appliedRule, settings)
      }

      const result = await adminSaveAttendanceRecordAction({
        id: editState.id,
        userId: editState.userId,
        date: selectedDate,
        checkIn: editState.checkIn || null,
        checkOut: editState.checkOut || null,
        status: computedStatus,
        appliedRule,
        isFootball,
      })

      if (!result.success || !result.record) {
        throw new Error(result.error ?? 'Save failed')
      }

      if (editState.id) {
        onRecordsChange(records.map((r) => (r.id === editState.id ? result.record! : r)))
      } else {
        onRecordsChange([...records, result.record])
      }

      setEditState(null)
      toast({ title: 'Record saved' })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : (err as { message?: string })?.message ?? 'Unknown error'
      toast({ title: 'Save failed', description: msg, variant: 'destructive' })
    } finally {
      setSavingEdit(false)
    }
  }

  // ── Fine actions ─────────────────────────────────────────────────────────────
  const openFineAction = (recordId: string, type: 'paid' | 'waived') => {
    setFineActionId(recordId)
    setFineActionType(type)
    setWaiveReason('')
    // Pre-fill bKash if staff already reported a TxnID
    const record = records.find((r) => r.id === recordId)
    if (type === 'paid' && record?.fine_reported_txn_id) {
      setPaymentMethod('bkash')
      setBkashTxnId(record.fine_reported_txn_id)
    } else {
      setPaymentMethod('cash')
      setBkashTxnId('')
    }
  }

  const confirmFineAction = async () => {
    if (!fineActionId || !fineActionType) return
    setSavingFine(true)
    const result = await updateFineStatusAction(
      fineActionId,
      fineActionType,
      waiveReason,
      fineActionType === 'paid' ? paymentMethod : undefined,
      fineActionType === 'paid' && paymentMethod === 'bkash' ? bkashTxnId : undefined
    )
    if (result.success) {
      onRecordsChange(records.map((r) =>
        r.id === fineActionId
          ? {
              ...r,
              fine_status: fineActionType,
              fine_paid_at: fineActionType === 'paid' ? new Date().toISOString() : null,
              fine_payment_method: fineActionType === 'paid' ? paymentMethod : null,
              fine_bkash_txn_id: fineActionType === 'paid' && paymentMethod === 'bkash' ? bkashTxnId : null,
            }
          : r
      ))
      toast({ title: fineActionType === 'paid' ? 'Fine marked as paid' : 'Fine waived' })
      setFineActionId(null); setFineActionType(null)
    } else {
      toast({ title: 'Failed', description: result.error, variant: 'destructive' })
    }
    setSavingFine(false)
  }

  function getStatusLabel(status: string) {
    if (status === 'on_time') return 'On Time'
    if (status === 'late_150') return 'Late (1.5x)'
    if (status === 'late_250') return 'Late (2.5x)'
    if (status === 'absent') return 'Absent'
    if (status === 'advance_absence') return 'Advance Absence'
    return status
  }

  function buildAttendanceRows() {
    return staffProfiles.map((staff) => {
      const r = recordMap[staff.id]
      return {
        name: staff.full_name,
        email: staff.email,
        checkIn: r?.check_in_time ?? '',
        checkOut: r?.check_out_time ?? '',
        status: r ? getStatusLabel(r.status) : 'No Record',
        rule: r?.applied_rule ?? '',
      }
    })
  }

  function buildAttendanceTableHtml() {
    const headers = ['Name', 'Email', 'Check In', 'Check Out', 'Status', 'Rule']
    const rows = buildAttendanceRows().map((r) => `<tr>
      <td>${r.name}</td><td>${r.email}</td><td>${r.checkIn || '-'}</td>
      <td>${r.checkOut || '-'}</td><td>${r.status}</td><td>${r.rule}</td>
    </tr>`).join('')
    return `<table><thead><tr>${headers.map((h) => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table>`
  }

  function exportCsv() {
    const headers = ['Name', 'Email', 'Check In', 'Check Out', 'Status', 'Rule']
    const rows = buildAttendanceRows().map((r) => [
      `"${r.name}"`, `"${r.email}"`, r.checkIn || '-', r.checkOut || '-', r.status, r.rule,
    ])
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `attendance-${selectedDate}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  function exportPdf() {
    const html = `<!DOCTYPE html><html><head><title>Attendance ${selectedDate}</title><style>
      body{font-family:Arial,sans-serif;font-size:12px;margin:24px}
      h2{margin-bottom:12px;color:#111}
      table{width:100%;border-collapse:collapse}
      th{background:#f3f4f6;padding:8px 10px;text-align:left;border:1px solid #d1d5db;font-size:11px}
      td{padding:6px 10px;border:1px solid #e5e7eb;vertical-align:top}
      tr:nth-child(even) td{background:#f9fafb}
    </style></head><body>
      <h2>Attendance — ${selectedDate}</h2>
      ${buildAttendanceTableHtml()}
    </body></html>`
    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(html); win.document.close(); win.focus(); win.print()
  }

  function exportDoc() {
    const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word"
      xmlns="http://www.w3.org/TR/REC-html40">
      <head><meta charset="utf-8"><title>Attendance ${selectedDate}</title>
      <style>
        body{font-family:Arial,sans-serif;font-size:12pt}
        h2{margin-bottom:12pt}
        table{width:100%;border-collapse:collapse}
        th{background:#f3f4f6;padding:6pt 8pt;border:1pt solid #d1d5db;font-size:10pt}
        td{padding:5pt 8pt;border:1pt solid #e5e7eb}
      </style></head>
      <body><h2>Attendance — ${selectedDate}</h2>${buildAttendanceTableHtml()}</body></html>`
    const blob = new Blob(['\ufeff', html], { type: 'application/msword' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `attendance-${selectedDate}.doc`; a.click()
    URL.revokeObjectURL(url)
  }

  const presentCount = records.filter((r) => r.check_in_time).length
  const lateCount = records.filter((r) => r.status === 'late_150' || r.status === 'late_250').length
  const absentCount = records.filter((r) => r.status === 'absent' || r.status === 'advance_absence').length
  const noRecord = staffProfiles.length - records.length

  const statCards = [
    { color: 'bg-blue-500',   label: 'Total Staff',    value: staffProfiles.length },
    { color: 'bg-green-500',  label: 'Present',        value: presentCount },
    { color: 'bg-yellow-400', label: 'Late',           value: lateCount },
    { color: 'bg-red-500',    label: 'Absent',         value: absentCount },
    { color: 'bg-gray-300',   label: 'No Record',      value: noRecord },
    ...(footballRule ? [{ color: 'bg-indigo-500', label: 'Football Rule', value: footballRule.user_ids.length }] : []),
  ]

  return (
    <div className="space-y-5">
      {/* ── Header ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Date navigation */}
        <div className="flex items-center gap-2 bg-card border border-border rounded-lg px-3 py-2 shadow-sm">
          <button
            onClick={() => navigateDate(-1)}
            className="p-0.5 hover:text-blue-600 text-muted-foreground transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-2 px-2">
            <CalendarDays className="h-3.5 w-3.5 text-muted-foreground/70 shrink-0" />
            <Input
              type="date"
              value={selectedDate}
              onChange={(e) => handleDateChange(e.target.value)}
              className="w-36 h-7 text-sm border-0 p-0 focus-visible:ring-0 bg-transparent font-medium"
            />
            {loadingDate && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground/70" />}
          </div>
          <button
            onClick={() => navigateDate(1)}
            className="p-0.5 hover:text-blue-600 text-muted-foreground transition-colors"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <span className="text-sm text-muted-foreground hidden sm:inline">
          {format(new Date(selectedDate + 'T00:00:00'), 'EEEE, MMMM d, yyyy')}
        </span>

        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5 h-9 text-xs">
                <Download className="h-3.5 w-3.5" />
                Export
                <ChevronDown className="h-3 w-3 text-muted-foreground/70" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={exportCsv}>Export as CSV</DropdownMenuItem>
              <DropdownMenuItem onClick={exportPdf}>Export as PDF</DropdownMenuItem>
              <DropdownMenuItem onClick={exportDoc}>Export as DOC</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            variant="outline"
            size="sm"
            className="gap-2 h-9"
            onClick={() => setFootballDialogOpen(true)}
          >
            <span>⚽</span> Football Rule
          </Button>
        </div>
      </div>

      {/* ── Stat cards ── */}
      <div className="flex gap-3 flex-wrap">
        {statCards.map((s) => (
          <div key={s.label} className="flex items-center gap-3 bg-card border border-border rounded-xl px-4 py-3 flex-1 min-w-[110px]">
            <div className={cn('h-9 w-9 rounded-lg flex items-center justify-center shrink-0', s.color)}>
              <span className="text-white text-sm font-bold">{s.value}</span>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className="text-base font-semibold text-foreground">{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Table ── */}
      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        {/* Table header label */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/60 bg-muted/20">
          <h3 className="text-sm font-semibold text-foreground/80 flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-muted-foreground/70" />
            Attendance — {format(new Date(selectedDate + 'T00:00:00'), 'EEEE, MMMM d, yyyy')}
          </h3>
        </div>
        <CardContent className="p-0">
          <TooltipProvider>
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableHead className="pl-4 w-52 text-[11px] font-semibold text-muted-foreground/70 uppercase tracking-wide">Name</TableHead>
                  <TableHead className="text-[11px] font-semibold text-muted-foreground/70 uppercase tracking-wide">Check In</TableHead>
                  <TableHead className="text-[11px] font-semibold text-muted-foreground/70 uppercase tracking-wide">Check Out</TableHead>
                  <TableHead className="text-[11px] font-semibold text-muted-foreground/70 uppercase tracking-wide">Status</TableHead>
                  <TableHead className="text-[11px] font-semibold text-amber-600/80 uppercase tracking-wide">Fine</TableHead>
                  <TableHead className="w-28 text-[11px] font-semibold text-muted-foreground/70 uppercase tracking-wide">Rule</TableHead>
                  <TableHead className="text-right pr-4 w-36 text-[11px] font-semibold text-muted-foreground/70 uppercase tracking-wide">Actions</TableHead>
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

                      {/* Fine */}
                      <TableCell>
                        {record && record.fine_amount > 0 ? (
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-1.5">
                              <span className={cn(
                                'text-xs font-semibold tabular-nums',
                                record.fine_status === 'pending' ? 'text-amber-600' :
                                record.fine_status === 'paid'    ? 'text-green-600' : 'text-muted-foreground line-through'
                              )}>
                                ৳{record.fine_amount}
                              </span>
                              {record.fine_status === 'pending' && (
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-5 w-5 text-amber-500 hover:text-amber-700">
                                      <Banknote className="h-3.5 w-3.5" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="start">
                                    <DropdownMenuItem onClick={() => openFineAction(record.id, 'paid')} className="gap-2 text-green-700">
                                      <CheckCircle2 className="h-3.5 w-3.5" /> Mark as Paid
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => openFineAction(record.id, 'waived')} className="gap-2 text-muted-foreground">
                                      <XCircle className="h-3.5 w-3.5" /> Waive Fine
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              )}
                              {record.fine_status === 'paid' && (
                                <Badge className="text-[10px] px-1.5 py-0 bg-green-100 text-green-700 border-green-200">Paid</Badge>
                              )}
                              {record.fine_status === 'waived' && (
                                <Badge className="text-[10px] px-1.5 py-0 bg-muted text-muted-foreground">Waived</Badge>
                              )}
                            </div>
                            {/* Staff-reported TxnID (awaiting admin verification) */}
                            {record.fine_status === 'pending' && record.fine_reported_txn_id && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="flex items-center gap-1 cursor-default">
                                    <span className="inline-flex items-center gap-1 text-[10px] bg-blue-100 text-blue-700 border border-blue-200 rounded px-1.5 py-0.5 font-medium">
                                      ⚡ TxnID: <span className="font-mono">{record.fine_reported_txn_id}</span>
                                    </span>
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="text-xs">
                                  Staff reported bKash payment. Verify and mark as Paid.
                                </TooltipContent>
                              </Tooltip>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground/40">—</span>
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
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-12">
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
      </div>

      {/* Football Rule Dialog */}
      <FootballRuleDialog
        open={footballDialogOpen}
        onOpenChange={setFootballDialogOpen}
        staffProfiles={staffProfiles}
        initialDate={selectedDate}
        currentRule={footballRule}
        onSaved={(rule) => onFootballRuleChange(rule)}
      />

      {/* Fine Action Dialog (Pay / Waive) */}
      <Dialog
        open={!!fineActionId}
        onOpenChange={(o) => { if (!o) { setFineActionId(null); setFineActionType(null) } }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {fineActionType === 'paid' ? (
                <><CheckCircle2 className="h-4 w-4 text-green-600" /> Mark Fine as Paid</>
              ) : (
                <><XCircle className="h-4 w-4 text-muted-foreground" /> Waive Fine</>
              )}
            </DialogTitle>
          </DialogHeader>
          {fineActionType === 'waived' && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Reason <span className="text-muted-foreground font-normal">(optional)</span></label>
              <Input
                placeholder="e.g. Medical emergency, approved by CEO"
                value={waiveReason}
                onChange={(e) => setWaiveReason(e.target.value)}
              />
            </div>
          )}
          {fineActionType === 'paid' && (() => {
            const rec = records.find((r) => r.id === fineActionId)
            return rec?.fine_reported_txn_id ? (
              <div className="flex items-start gap-2 rounded-lg bg-blue-50 border border-blue-200 px-3 py-2.5">
                <span className="text-blue-600 text-sm">⚡</span>
                <p className="text-xs text-blue-700">
                  Staff reported bKash TxnID: <span className="font-semibold font-mono">{rec.fine_reported_txn_id}</span>. TxnID has been pre-filled below.
                </p>
              </div>
            ) : null
          })()}
          {fineActionType === 'paid' && (
            <div className="space-y-3">
              {/* Payment method */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Payment Method</label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="bkash">bKash</SelectItem>
                    <SelectItem value="bank">Bank Transfer</SelectItem>
                    <SelectItem value="salary_deduction">Salary Deduction</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* bKash TxnID */}
              {paymentMethod === 'bkash' && (
                <div className="space-y-1.5">
                  {settings?.org_bkash_number && (
                    <p className="text-xs text-muted-foreground bg-muted rounded px-2 py-1.5">
                      Payment number: <span className="font-semibold">{settings.org_bkash_number}</span>
                    </p>
                  )}
                  <label className="text-sm font-medium">
                    bKash TxnID <span className="text-muted-foreground font-normal">(optional)</span>
                  </label>
                  <Input
                    placeholder="e.g. 8N7K3S9L"
                    value={bkashTxnId}
                    onChange={(e) => setBkashTxnId(e.target.value)}
                    className="font-mono"
                  />
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setFineActionId(null); setFineActionType(null) }} disabled={savingFine}>
              Cancel
            </Button>
            <Button
              onClick={confirmFineAction}
              disabled={savingFine}
              className={fineActionType === 'paid' ? 'bg-green-600 hover:bg-green-700' : ''}
            >
              {savingFine && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {fineActionType === 'paid' ? 'Confirm Paid' : 'Waive Fine'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
