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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Plus, Search, Users, FileText, Clock, CalendarPlus } from 'lucide-react'

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Leave Management</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage team leave requests and balances
          </p>
        </div>
        <Button size="sm" onClick={() => setOptionalOpen(true)}
          className="bg-violet-600 hover:bg-violet-700 text-white">
          <CalendarPlus className="mr-2 h-4 w-4" />
          Create Optional Leave
        </Button>
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
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Leave balances for {new Date().getFullYear()}
            </p>
          </div>
          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead>Employee</TableHead>
                  <TableHead className="text-center">Annual (Used/Total)</TableHead>
                  <TableHead className="text-center">WFH (Used/Total)</TableHead>
                  <TableHead className="text-center">Marriage (Used/Total)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allBalances.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                      No balance records found for this year
                    </TableCell>
                  </TableRow>
                ) : (
                  allBalances.map((bal) => (
                    <TableRow key={bal.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-7 w-7">
                            <AvatarImage src={bal.user?.avatar_url ?? undefined} />
                            <AvatarFallback className="text-xs">
                              {getInitials(bal.user?.full_name ?? 'U')}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="text-sm font-medium">{bal.user?.full_name ?? 'Unknown'}</p>
                            <p className="text-xs text-muted-foreground">{bal.user?.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className={`font-medium ${bal.yearly_used >= bal.yearly_total ? 'text-red-600' : 'text-foreground'}`}>
                          {bal.yearly_used}
                        </span>
                        <span className="text-muted-foreground">/{bal.yearly_total}</span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className={`font-medium ${bal.wfh_used >= bal.wfh_total ? 'text-red-600' : 'text-foreground'}`}>
                          {bal.wfh_used}
                        </span>
                        <span className="text-muted-foreground">/{bal.wfh_total}</span>
                      </TableCell>
                      <TableCell className="text-center">
                        {bal.marriage_total > 0 ? (
                          <>
                            <span className={`font-medium ${bal.marriage_used >= bal.marriage_total ? 'text-red-600' : 'text-foreground'}`}>
                              {bal.marriage_used}
                            </span>
                            <span className="text-muted-foreground">/{bal.marriage_total}</span>
                          </>
                        ) : (
                          <span className="text-muted-foreground text-xs">Not granted</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
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
