'use client'

import { useState, useMemo } from 'react'
import { Profile, StaffSalary, AttendanceSettings } from '@/types'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Banknote,
  Pencil,
  Trash2,
  Plus,
  Loader2,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react'
import { upsertSalaryAction, deleteSalaryAction } from '@/app/actions/salary'
import { cn } from '@/lib/utils'

function getInitials(name: string) {
  return name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

function formatTaka(amount: number) {
  return `৳${amount.toLocaleString('en-BD')}`
}

interface SalaryManagementProps {
  allStaff: Profile[]
  initialSalaries: StaffSalary[]
  settings: AttendanceSettings | null
}

interface SalaryDialogState {
  open: boolean
  userId: string
  fullName: string
  avatarUrl: string | null
  monthlySalary: string
  effectiveFrom: string
  notes: string
}

const EMPTY_DIALOG: SalaryDialogState = {
  open: false,
  userId: '',
  fullName: '',
  avatarUrl: null,
  monthlySalary: '',
  effectiveFrom: new Date().toISOString().slice(0, 10),
  notes: '',
}

export function SalaryManagement({ allStaff, initialSalaries, settings }: SalaryManagementProps) {
  const [salaries, setSalaries] = useState<StaffSalary[]>(initialSalaries)
  const [dialog, setDialog] = useState<SalaryDialogState>(EMPTY_DIALOG)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Build a map userId → salary for fast lookup
  const salaryMap = useMemo(() => {
    const map: Record<string, StaffSalary> = {}
    for (const s of salaries) map[s.user_id] = s
    return map
  }, [salaries])

  // Only show staff (exclude clients, partners)
  const staffMembers = allStaff.filter(
    (p) => p.role !== 'client' && p.role !== 'partner'
  )

  function openEditDialog(staff: Profile) {
    const existing = salaryMap[staff.id]
    setDialog({
      open: true,
      userId: staff.id,
      fullName: staff.full_name,
      avatarUrl: staff.avatar_url,
      monthlySalary: existing ? String(existing.monthly_salary) : '',
      effectiveFrom: existing?.effective_from ?? new Date().toISOString().slice(0, 10),
      notes: existing?.notes ?? '',
    })
    setError(null)
    setSuccess(null)
  }

  function closeDialog() {
    setDialog(EMPTY_DIALOG)
    setError(null)
  }

  async function handleSave() {
    const amount = parseInt(dialog.monthlySalary, 10)
    if (!amount || amount < 0) {
      setError('Please enter a valid monthly salary amount.')
      return
    }
    if (!dialog.effectiveFrom) {
      setError('Please provide an effective date.')
      return
    }

    setSaving(true)
    setError(null)

    const result = await upsertSalaryAction({
      userId: dialog.userId,
      monthlySalary: amount,
      effectiveFrom: dialog.effectiveFrom,
      notes: dialog.notes || undefined,
    })

    if (result.error) {
      setError(result.error)
    } else {
      // Optimistically update local state
      const newEntry: StaffSalary = {
        id: salaryMap[dialog.userId]?.id ?? 'tmp-' + Date.now(),
        user_id: dialog.userId,
        organization_id: '',
        monthly_salary: amount,
        effective_from: dialog.effectiveFrom,
        currency: 'BDT',
        notes: dialog.notes || null,
        created_by: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      setSalaries((prev) => {
        const filtered = prev.filter((s) => s.user_id !== dialog.userId)
        return [...filtered, newEntry]
      })
      setSuccess(`Salary updated for ${dialog.fullName}`)
      setTimeout(() => setSuccess(null), 3000)
      closeDialog()
    }

    setSaving(false)
  }

  async function handleDelete(userId: string, fullName: string) {
    if (!confirm(`Remove salary record for ${fullName}? Fine calculation will fall back to fixed amounts.`)) return
    setDeleting(userId)

    const result = await deleteSalaryAction(userId)
    if (result.error) {
      setError(result.error)
    } else {
      setSalaries((prev) => prev.filter((s) => s.user_id !== userId))
      setSuccess(`Salary removed for ${fullName}`)
      setTimeout(() => setSuccess(null), 3000)
    }
    setDeleting(null)
  }

  // Per-minute salary rate and fine equivalents
  // Formula: fine = round(minutes_late × salary / monthly_work_min × multiplier)
  // L1 = 1.5×, L2 = 2.5×; example: 30 min late (L1) and 90 min late (L2)
  function getFineEquivalents(monthlySalary: number) {
    const workHours = settings?.work_hours_per_week ?? 30
    const monthlyWorkMin = workHours * 4 * 60  // e.g. 7200
    const perMinute = monthlySalary / monthlyWorkMin
    // Example lateness: 30 min for L1, 90 min for L2
    return {
      perMinute,
      // 30 min late, 1.5× multiplier
      level1Example: Math.round(30 * perMinute * 1.5),
      // 90 min late, 2.5× multiplier
      level2Example: Math.round(90 * perMinute * 2.5),
      fallback1: settings?.fine_late_1 ?? 150,
      fallback2: settings?.fine_late_2 ?? 250,
    }
  }

  const staffWithSalary = staffMembers.filter((s) => salaryMap[s.id])
  const staffWithoutSalary = staffMembers.filter((s) => !salaryMap[s.id])

  return (
    <div className="space-y-5">
      {/* Info banner */}
      <Alert className="border-blue-200 bg-blue-50 dark:bg-blue-950/20">
        <TrendingUp className="h-4 w-4 text-blue-600" />
        <AlertDescription className="text-blue-700 dark:text-blue-400 text-sm">
          <strong>Salary-based fines:</strong> When a salary is set, fines are calculated as
          <em> minutes late × (salary ÷ monthly work minutes) × multiplier</em>.
          Level 1 = <strong>1.5×</strong>, Level 2 = <strong>2.5×</strong>.
          Without a salary, the fixed fallback amounts from Attendance Rules apply.
          Salary data is only visible to Super Admin.
        </AlertDescription>
      </Alert>

      {success && (
        <Alert className="border-green-200 bg-green-50">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-700">{success}</AlertDescription>
        </Alert>
      )}

      {error && !dialog.open && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Staff with salaries */}
      {staffWithSalary.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Banknote className="h-4 w-4" />
              Configured Salaries
            </CardTitle>
            <CardDescription>Staff members with salary-based fine calculation</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {staffWithSalary.map((staff) => {
                const salary = salaryMap[staff.id]!
                const { perMinute, level1Example, level2Example } = getFineEquivalents(salary.monthly_salary)
                return (
                  <div
                    key={staff.id}
                    className="flex items-center gap-3 rounded-lg border px-4 py-3 bg-card"
                  >
                    <Avatar className="h-8 w-8 shrink-0">
                      <AvatarFallback className="text-xs font-semibold">
                        {getInitials(staff.full_name)}
                      </AvatarFallback>
                    </Avatar>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{staff.full_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatTaka(Math.round(perMinute * 100) / 100)}/min
                      </p>
                    </div>

                    {/* Salary amount */}
                    <div className="text-right shrink-0">
                      <p className="text-sm font-semibold">{formatTaka(salary.monthly_salary)}</p>
                      <p className="text-[10px] text-muted-foreground">/ month</p>
                    </div>

                    {/* Fine examples */}
                    <div className="hidden sm:flex items-center gap-2 shrink-0">
                      <Badge className="text-[10px] bg-amber-100 text-amber-700 border-amber-200 px-1.5"
                        title="Example: 30 min late × 1.5×">
                        L1≈{formatTaka(level1Example)}
                      </Badge>
                      <Badge className="text-[10px] bg-red-100 text-red-700 border-red-200 px-1.5"
                        title="Example: 90 min late × 2.5×">
                        L2≈{formatTaka(level2Example)}
                      </Badge>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => openEditDialog(staff)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => handleDelete(staff.id, staff.full_name)}
                        disabled={deleting === staff.id}
                      >
                        {deleting === staff.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Staff without salaries */}
      {staffWithoutSalary.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base text-muted-foreground">
              <Banknote className="h-4 w-4" />
              No Salary Configured
            </CardTitle>
            <CardDescription>
              These staff use fixed fine amounts (৳{settings?.fine_late_1 ?? 150} / ৳{settings?.fine_late_2 ?? 250})
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-1.5">
              {staffWithoutSalary.map((staff) => (
                <div
                  key={staff.id}
                  className="flex items-center gap-3 rounded-lg border border-dashed px-4 py-2.5"
                >
                  <Avatar className="h-7 w-7 shrink-0">
                    <AvatarImage src={staff.avatar_url ?? undefined} />
                    <AvatarFallback className="text-[10px]">{getInitials(staff.full_name)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{staff.full_name}</p>
                  </div>
                  <Badge variant="outline" className="text-[10px] text-muted-foreground shrink-0">
                    Fixed fine
                  </Badge>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs gap-1.5 shrink-0"
                    onClick={() => openEditDialog(staff)}
                  >
                    <Plus className="h-3 w-3" />
                    Set Salary
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {staffMembers.length === 0 && (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground text-sm">
            No staff members found.
          </CardContent>
        </Card>
      )}

      {/* Edit / Add Salary Dialog */}
      <Dialog open={dialog.open} onOpenChange={(o) => { if (!o) closeDialog() }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Banknote className="h-4 w-4 text-primary" />
              {salaryMap[dialog.userId] ? 'Update Salary' : 'Set Salary'}
            </DialogTitle>
          </DialogHeader>

          {/* Staff info */}
          <div className="flex items-center gap-3 rounded-lg bg-muted/50 px-3 py-2.5">
            <Avatar className="h-8 w-8 shrink-0">
              <AvatarImage src={dialog.avatarUrl ?? undefined} />
              <AvatarFallback className="text-xs font-semibold">{getInitials(dialog.fullName || 'XX')}</AvatarFallback>
            </Avatar>
            <p className="text-sm font-medium">{dialog.fullName}</p>
          </div>

          {error && (
            <Alert variant="destructive" className="py-2">
              <AlertDescription className="text-xs">{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-4">
            {/* Monthly salary */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Monthly Salary (BDT)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">৳</span>
                <Input
                  type="number"
                  min={0}
                  placeholder="e.g. 30000"
                  value={dialog.monthlySalary}
                  onChange={(e) => setDialog((d) => ({ ...d, monthlySalary: e.target.value }))}
                  className="pl-7"
                />
              </div>
              {dialog.monthlySalary && parseInt(dialog.monthlySalary) > 0 && (
                <div className="rounded-md bg-muted/60 px-3 py-2 mt-2 space-y-1">
                  {(() => {
                    const amt = parseInt(dialog.monthlySalary)
                    const { perMinute, level1Example, level2Example } = getFineEquivalents(amt)
                    const workHours = settings?.work_hours_per_week ?? 30
                    return (
                      <>
                        <p className="text-[11px] text-muted-foreground">
                          Rate: <strong>{formatTaka(Math.round(perMinute * 100) / 100)}/min</strong>
                          {' '}({workHours} hrs/week × 4 × 60 = {workHours * 4 * 60} min/month)
                        </p>
                        <div className="flex gap-3">
                          <span className="text-[11px] text-amber-600">
                            30 min late (L1 · 1.5×): {formatTaka(level1Example)}
                          </span>
                          <span className="text-[11px] text-red-600">
                            90 min late (L2 · 2.5×): {formatTaka(level2Example)}
                          </span>
                        </div>
                      </>
                    )
                  })()}
                </div>
              )}
            </div>

            {/* Effective from */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Effective From</label>
              <Input
                type="date"
                value={dialog.effectiveFrom}
                onChange={(e) => setDialog((d) => ({ ...d, effectiveFrom: e.target.value }))}
              />
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Notes <span className="text-muted-foreground font-normal">(optional)</span></label>
              <Input
                placeholder="e.g. Revised as of promotion"
                value={dialog.notes}
                onChange={(e) => setDialog((d) => ({ ...d, notes: e.target.value }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog} disabled={saving}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Salary
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
