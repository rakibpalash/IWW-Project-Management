'use client'

import { useState } from 'react'
import { Profile, LeaveBalance, LeaveRequest, OptionalLeave } from '@/types'
import { LeaveBalanceCard } from './leave-balance-card'
import { ApplyLeaveDialog } from './apply-leave-dialog'
import { LeaveRequestsTable } from './leave-requests-table'
import { CreateOptionalLeaveDialog } from './create-optional-leave-dialog'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

import { Plus, Search, Users, FileText, Clock, CalendarPlus, Download, ChevronDown, Pencil, Check, X } from 'lucide-react'
import { format } from 'date-fns'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { updateLeaveAdditionalDaysAction } from '@/app/actions/leave'

export interface LeaveTemplate {
  id: string
  name: string
  default_days: number
  is_builtin: boolean
}

interface LeavePageProps {
  profile: Profile
  isAdmin: boolean
  allRequests: LeaveRequest[]
  allBalances: (LeaveBalance & { user?: Profile })[]
  staffProfiles: Profile[]
  myBalance: LeaveBalance | null
  myRequests: LeaveRequest[]
  myOptionalLeaves?: OptionalLeave[]
  leaveTemplates?: LeaveTemplate[]
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

function StaffView({
  profile,
  balance,
  requests,
  optionalLeaves = [],
}: {
  profile: Profile
  balance: LeaveBalance | null
  requests: LeaveRequest[]
  optionalLeaves?: OptionalLeave[]
}) {
  const [applyOpen, setApplyOpen] = useState(false)

  const yearlyTotal = balance?.yearly_total ?? 18
  const yearlyUsed = balance?.yearly_used ?? 0
  const wfhTotal = balance?.wfh_total ?? 10
  const wfhUsed = balance?.wfh_used ?? 0
  const marriageTotal = balance?.marriage_total ?? 0
  const marriageUsed = balance?.marriage_used ?? 0

  const pendingCount = requests.filter((r) => r.status === 'pending').length

  return (
    <div className="page-inner">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Leave Management</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {new Date().getFullYear()} leave balance and requests
          </p>
        </div>
        <Button onClick={() => setApplyOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Apply for Leave
        </Button>
      </div>

      {/* Balance Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <LeaveBalanceCard type="yearly" allocated={yearlyTotal} used={yearlyUsed} />
        <LeaveBalanceCard type="work_from_home" allocated={wfhTotal} used={wfhUsed} />
        <LeaveBalanceCard type="marriage" allocated={marriageTotal} used={marriageUsed} />
        {optionalLeaves.map((ol) => (
          <LeaveBalanceCard
            key={ol.id}
            type="optional"
            customLabel={ol.name}
            allocated={ol.total_days}
            used={ol.used_days ?? 0}
          />
        ))}
      </div>

      {/* My Requests */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">My Requests</h2>
          {pendingCount > 0 && (
            <Badge variant="secondary" className="bg-yellow-100 text-yellow-700">
              {pendingCount} pending
            </Badge>
          )}
        </div>
        <LeaveRequestsTable
          requests={requests}
          isAdmin={false}
          currentUserId={profile.id}
          showPendingActions={false}
        />
      </div>

      <ApplyLeaveDialog open={applyOpen} onOpenChange={setApplyOpen} balance={balance} optionalLeaves={optionalLeaves} />
    </div>
  )
}

function AdminView({
  allRequests,
  allBalances,
  staffProfiles,
  leaveTemplates = [],
}: {
  allRequests: LeaveRequest[]
  allBalances: (LeaveBalance & { user?: Profile })[]
  staffProfiles: Profile[]
  leaveTemplates?: LeaveTemplate[]
}) {
  const [optionalOpen, setOptionalOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')

  const pendingRequests = allRequests.filter((r) => r.status === 'pending')

  const filteredRequests = allRequests.filter((req) => {
    const matchesSearch =
      search === '' ||
      req.user?.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      req.user?.email?.toLowerCase().includes(search.toLowerCase())
    const matchesType = typeFilter === 'all' || req.leave_type === typeFilter
    const matchesStatus = statusFilter === 'all' || req.status === statusFilter
    return matchesSearch && matchesType && matchesStatus
  })

  const dateSlug = format(new Date(), 'yyyy-MM-dd')

  const leaveTypeLabel = (t: string) =>
    t === 'yearly' ? 'Annual Leave' : t === 'work_from_home' ? 'WFH' : t === 'marriage' ? 'Marriage' : t

  function buildLeaveTableHtml(rows: typeof filteredRequests) {
    const headers = ['Employee', 'Leave Type', 'Start Date', 'End Date', 'Days', 'Status', 'Notes']
    const body = rows.map((r) => `<tr>
      <td>${r.user?.full_name ?? '-'}</td>
      <td>${leaveTypeLabel(r.leave_type)}</td>
      <td>${format(new Date(r.start_date + 'T00:00:00'), 'MMM d, yyyy')}</td>
      <td>${format(new Date(r.end_date + 'T00:00:00'), 'MMM d, yyyy')}</td>
      <td>${r.total_days}</td>
      <td>${r.status}</td>
      <td>${r.review_notes ?? ''}</td>
    </tr>`).join('')
    return `<table><thead><tr>${headers.map((h) => `<th>${h}</th>`).join('')}</tr></thead><tbody>${body}</tbody></table>`
  }

  function exportCsv() {
    const headers = ['Employee', 'Leave Type', 'Start Date', 'End Date', 'Days', 'Status', 'Notes']
    const rows = filteredRequests.map((r) => [
      `"${(r.user?.full_name ?? '').replace(/"/g, '""')}"`,
      leaveTypeLabel(r.leave_type),
      r.start_date,
      r.end_date,
      r.total_days,
      r.status,
      `"${(r.review_notes ?? '').replace(/"/g, '""')}"`,
    ])
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `leave-requests-${dateSlug}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  function exportPdf() {
    const html = `<!DOCTYPE html><html><head><title>Leave Requests ${dateSlug}</title><style>
      body{font-family:Arial,sans-serif;font-size:12px;margin:24px}
      h2{margin-bottom:12px;color:#111}
      table{width:100%;border-collapse:collapse}
      th{background:#f3f4f6;padding:8px 10px;text-align:left;border:1px solid #d1d5db;font-size:11px}
      td{padding:6px 10px;border:1px solid #e5e7eb;vertical-align:top}
      tr:nth-child(even) td{background:#f9fafb}
    </style></head><body>
      <h2>Leave Requests — ${dateSlug}</h2>
      ${buildLeaveTableHtml(filteredRequests)}
    </body></html>`
    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(html); win.document.close(); win.focus(); win.print()
  }

  function exportDoc() {
    const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word"
      xmlns="http://www.w3.org/TR/REC-html40">
      <head><meta charset="utf-8"><title>Leave Requests ${dateSlug}</title>
      <style>
        body{font-family:Arial,sans-serif;font-size:12pt}
        h2{margin-bottom:12pt}
        table{width:100%;border-collapse:collapse}
        th{background:#f3f4f6;padding:6pt 8pt;border:1pt solid #d1d5db;font-size:10pt}
        td{padding:5pt 8pt;border:1pt solid #e5e7eb}
      </style></head>
      <body><h2>Leave Requests — ${dateSlug}</h2>${buildLeaveTableHtml(filteredRequests)}</body></html>`
    const blob = new Blob(['\ufeff', html], { type: 'application/msword' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `leave-requests-${dateSlug}.doc`; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Leave Management</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage team leave requests and balances
          </p>
        </div>
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
          <Button size="sm" onClick={() => setOptionalOpen(true)}
            className="bg-violet-600 hover:bg-violet-700 text-white">
            <CalendarPlus className="mr-2 h-4 w-4" />
            Create Optional Leave
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-yellow-50 p-2">
                <Clock className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{pendingRequests.length}</p>
                <p className="text-xs text-muted-foreground">Pending</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-green-50 p-2">
                <FileText className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {allRequests.filter((r) => r.status === 'approved').length}
                </p>
                <p className="text-xs text-muted-foreground">Approved</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-blue-50 p-2">
                <Users className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{staffProfiles.length}</p>
                <p className="text-xs text-muted-foreground">Staff</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-muted/30 p-2">
                <FileText className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold">{allRequests.length}</p>
                <p className="text-xs text-muted-foreground">Total</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="pending" className="space-y-4">
        <TabsList>
          <TabsTrigger value="pending" className="gap-2">
            Pending
            {pendingRequests.length > 0 && (
              <Badge className="ml-1 bg-yellow-500 text-white text-xs h-5 px-1.5">
                {pendingRequests.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="all">All Requests</TabsTrigger>
          <TabsTrigger value="balances">Leave Balances</TabsTrigger>
        </TabsList>

        {/* Pending Tab */}
        <TabsContent value="pending" className="space-y-4">
          {pendingRequests.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground border rounded-lg bg-muted/30">
              <Clock className="h-8 w-8 mb-2 opacity-40" />
              <p className="text-sm">No pending requests</p>
            </div>
          ) : (
            <LeaveRequestsTable
              requests={pendingRequests}
              isAdmin={true}
              showPendingActions={true}
            />
          )}
        </TabsContent>

        {/* All Requests Tab */}
        <TabsContent value="all" className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="yearly">Annual Leave</SelectItem>
                <SelectItem value="work_from_home">WFH</SelectItem>
                <SelectItem value="marriage">Marriage</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <LeaveRequestsTable requests={filteredRequests} isAdmin={true} showPendingActions={false} />
        </TabsContent>

        {/* Balances Tab */}
        <TabsContent value="balances" className="space-y-4">
          <LeaveBalancesTable allBalances={allBalances} />
        </TabsContent>
      </Tabs>

      <CreateOptionalLeaveDialog
        open={optionalOpen}
        onClose={() => setOptionalOpen(false)}
        staffProfiles={staffProfiles}
        leaveTemplates={leaveTemplates}
      />
    </div>
  )
}

// ─── Leave Balances Table (Excel-style) ──────────────────────────────────────
// Columns: Employee | Annual (Allowed | +Additional | Taken | Remaining) | WFH (Allowed | +Additional | Taken | Remaining)

function LeaveBalancesTable({
  allBalances,
}: {
  allBalances: (LeaveBalance & { user?: Profile })[]
}) {
  const currentYear = new Date().getFullYear()
  // editingId tracks which row is in edit mode
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editYearly, setEditYearly] = useState(0)
  const [editWfh, setEditWfh] = useState(0)
  const [saving, setSaving] = useState(false)
  const [localBalances, setLocalBalances] = useState(allBalances)

  function startEdit(bal: LeaveBalance & { user?: Profile }) {
    setEditingId(bal.id)
    setEditYearly(bal.yearly_additional ?? 0)
    setEditWfh(bal.wfh_additional ?? 0)
  }

  function cancelEdit() {
    setEditingId(null)
  }

  async function saveEdit(bal: LeaveBalance & { user?: Profile }) {
    setSaving(true)
    const res = await updateLeaveAdditionalDaysAction({
      userId: bal.user_id,
      year: currentYear,
      yearlyAdditional: editYearly,
      wfhAdditional: editWfh,
    })
    setSaving(false)
    if (res.success) {
      // Optimistically update local state so the user sees the change immediately
      const oldYearlyAdditional = bal.yearly_additional ?? 0
      const oldWfhAdditional = bal.wfh_additional ?? 0
      setLocalBalances(prev => prev.map(b => {
        if (b.id !== bal.id) return b
        const newYearlyTotal = (b.yearly_total - oldYearlyAdditional) + editYearly
        const newWfhTotal = (b.wfh_total - oldWfhAdditional) + editWfh
        return {
          ...b,
          yearly_additional: editYearly,
          yearly_total: Math.max(newYearlyTotal, b.yearly_used ?? 0),
          wfh_additional: editWfh,
          wfh_total: Math.max(newWfhTotal, b.wfh_used ?? 0),
        }
      }))
      setEditingId(null)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Leave balances for {currentYear} — click <Pencil className="inline h-3 w-3" /> to grant additional days
        </p>
      </div>
      <div className="rounded-md border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/30">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground" rowSpan={2}>Employee</th>
                <th className="text-center px-2 py-1.5 font-medium text-muted-foreground border-l text-xs" colSpan={4}>Annual Leave</th>
                <th className="text-center px-2 py-1.5 font-medium text-muted-foreground border-l text-xs" colSpan={4}>WFH</th>
                <th className="text-center px-2 py-1.5 font-medium text-muted-foreground border-l text-xs" colSpan={2}>Marriage</th>
                <th className="px-2 py-1.5 border-l" rowSpan={2}></th>
              </tr>
              <tr className="border-t">
                <th className="text-center px-3 py-1.5 text-xs font-medium text-muted-foreground border-l">Allowed</th>
                <th className="text-center px-3 py-1.5 text-xs font-medium text-muted-foreground">+Additional</th>
                <th className="text-center px-3 py-1.5 text-xs font-medium text-muted-foreground">Taken</th>
                <th className="text-center px-3 py-1.5 text-xs font-medium text-muted-foreground">Remaining</th>
                <th className="text-center px-3 py-1.5 text-xs font-medium text-muted-foreground border-l">Allowed</th>
                <th className="text-center px-3 py-1.5 text-xs font-medium text-muted-foreground">+Additional</th>
                <th className="text-center px-3 py-1.5 text-xs font-medium text-muted-foreground">Taken</th>
                <th className="text-center px-3 py-1.5 text-xs font-medium text-muted-foreground">Remaining</th>
                <th className="text-center px-3 py-1.5 text-xs font-medium text-muted-foreground border-l">Total</th>
                <th className="text-center px-3 py-1.5 text-xs font-medium text-muted-foreground">Taken</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {localBalances.length === 0 ? (
                <tr>
                  <td colSpan={12} className="text-center text-muted-foreground py-8">
                    No balance records found for this year
                  </td>
                </tr>
              ) : (
                localBalances.map((bal) => {
                  const yearlyAdditional = bal.yearly_additional ?? 0
                  const wfhAdditional = bal.wfh_additional ?? 0
                  const yearlyBase = bal.yearly_total - yearlyAdditional
                  const wfhBase = bal.wfh_total - wfhAdditional
                  const yearlyRemaining = bal.yearly_total - (bal.yearly_used ?? 0)
                  const wfhRemaining = bal.wfh_total - (bal.wfh_used ?? 0)
                  const isEditing = editingId === bal.id

                  return (
                    <tr key={bal.id} className="hover:bg-muted/20 transition-colors">
                      {/* Employee */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Avatar className="h-7 w-7 shrink-0">
                            <AvatarImage src={bal.user?.avatar_url ?? undefined} />
                            <AvatarFallback className="text-xs">
                              {getInitials(bal.user?.full_name ?? 'U')}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{bal.user?.full_name ?? 'Unknown'}</p>
                            <p className="text-xs text-muted-foreground truncate">{bal.user?.email}</p>
                          </div>
                        </div>
                      </td>

                      {/* Annual: Allowed (base) */}
                      <td className="px-3 py-3 text-center text-muted-foreground border-l">{yearlyBase}</td>

                      {/* Annual: +Additional (editable) */}
                      <td className="px-3 py-3 text-center">
                        {isEditing ? (
                          <input
                            type="number" min={0} max={30}
                            value={editYearly}
                            onChange={e => setEditYearly(Math.max(0, Number(e.target.value)))}
                            className="w-14 text-center h-7 rounded border bg-background text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                          />
                        ) : (
                          <span className={yearlyAdditional > 0 ? 'font-medium text-violet-600' : 'text-muted-foreground'}>
                            {yearlyAdditional > 0 ? `+${yearlyAdditional}` : '—'}
                          </span>
                        )}
                      </td>

                      {/* Annual: Taken */}
                      <td className="px-3 py-3 text-center font-medium">{bal.yearly_used ?? 0}</td>

                      {/* Annual: Remaining */}
                      <td className="px-3 py-3 text-center">
                        <span className={yearlyRemaining <= 0 ? 'text-red-600 font-semibold' : yearlyRemaining <= 3 ? 'text-amber-600 font-medium' : 'text-emerald-600 font-medium'}>
                          {yearlyRemaining}
                        </span>
                      </td>

                      {/* WFH: Allowed (base) */}
                      <td className="px-3 py-3 text-center text-muted-foreground border-l">{wfhBase}</td>

                      {/* WFH: +Additional (editable) */}
                      <td className="px-3 py-3 text-center">
                        {isEditing ? (
                          <input
                            type="number" min={0} max={30}
                            value={editWfh}
                            onChange={e => setEditWfh(Math.max(0, Number(e.target.value)))}
                            className="w-14 text-center h-7 rounded border bg-background text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                          />
                        ) : (
                          <span className={wfhAdditional > 0 ? 'font-medium text-violet-600' : 'text-muted-foreground'}>
                            {wfhAdditional > 0 ? `+${wfhAdditional}` : '—'}
                          </span>
                        )}
                      </td>

                      {/* WFH: Taken */}
                      <td className="px-3 py-3 text-center font-medium">{bal.wfh_used ?? 0}</td>

                      {/* WFH: Remaining */}
                      <td className="px-3 py-3 text-center">
                        <span className={wfhRemaining <= 0 ? 'text-red-600 font-semibold' : wfhRemaining <= 2 ? 'text-amber-600 font-medium' : 'text-emerald-600 font-medium'}>
                          {wfhRemaining}
                        </span>
                      </td>

                      {/* Marriage: Total */}
                      <td className="px-3 py-3 text-center text-muted-foreground border-l">
                        {bal.marriage_total > 0 ? bal.marriage_total : <span className="text-xs">—</span>}
                      </td>

                      {/* Marriage: Taken */}
                      <td className="px-3 py-3 text-center">
                        {bal.marriage_total > 0 ? (
                          <span className={bal.marriage_used >= bal.marriage_total ? 'text-red-600 font-medium' : 'font-medium'}>
                            {bal.marriage_used}
                          </span>
                        ) : <span className="text-muted-foreground text-xs">—</span>}
                      </td>

                      {/* Actions */}
                      <td className="px-3 py-3 text-center border-l">
                        {isEditing ? (
                          <div className="flex items-center gap-1 justify-center">
                            <button
                              onClick={() => saveEdit(bal)}
                              disabled={saving}
                              className="inline-flex items-center justify-center rounded-md h-7 w-7 bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50"
                            >
                              <Check className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={cancelEdit}
                              disabled={saving}
                              className="inline-flex items-center justify-center rounded-md h-7 w-7 border hover:bg-muted/50 disabled:opacity-50"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => startEdit(bal)}
                            className="inline-flex items-center justify-center rounded-md h-7 w-7 border hover:bg-muted/50 text-muted-foreground hover:text-foreground"
                            title="Grant additional days"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export function LeavePage({
  profile,
  isAdmin,
  allRequests,
  allBalances,
  staffProfiles,
  myBalance,
  myRequests,
  myOptionalLeaves = [],
  leaveTemplates = [],
}: LeavePageProps) {
  if (isAdmin) {
    return (
      <AdminView
        allRequests={allRequests}
        allBalances={allBalances}
        staffProfiles={staffProfiles}
        leaveTemplates={leaveTemplates}
      />
    )
  }

  return <StaffView profile={profile} balance={myBalance} requests={myRequests} optionalLeaves={myOptionalLeaves} />
}
