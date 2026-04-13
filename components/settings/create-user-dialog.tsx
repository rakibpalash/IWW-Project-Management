'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useToast } from '@/components/ui/use-toast'
import {
  Loader2, Copy, CheckCircle2, Eye, EyeOff, RefreshCw,
  ArrowRight, ArrowLeft, User, ShieldCheck, KeyRound,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { createUserAction } from '@/app/actions/user'
import { setUserPermissionsAction } from '@/app/actions/permissions'
import { PermissionSet, defaultPermissionsForRole } from '@/lib/permissions'
import { PermissionMatrix } from './user-permissions-dialog'

// ── Types ─────────────────────────────────────────────────────────────────────

type RoleOption = 'account_manager' | 'project_manager' | 'staff' | 'client' | 'partner'

interface CreateUserDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function generatePassword(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$'
  let p = ''
  for (let i = 0; i < 12; i++) p += chars.charAt(Math.floor(Math.random() * chars.length))
  return p
}

const ROLE_OPTIONS: { value: RoleOption; label: string; description: string }[] = [
  { value: 'account_manager', label: 'Org Admin',  description: 'Full org visibility, can manage spaces and team' },
  { value: 'project_manager', label: 'Team Lead',  description: 'Manages lists and tasks, approves leave' },
  { value: 'staff',           label: 'Staff',      description: 'Works on assigned tasks and lists' },
  { value: 'client',          label: 'Client',     description: 'View-only access to their lists' },
  { value: 'partner',         label: 'Partner',    description: 'External collaborator, view-only access' },
]

const ROLE_BADGE: Record<string, string> = {
  account_manager: 'border-purple-200 text-purple-700 bg-purple-50',
  project_manager: 'border-blue-200 text-blue-700 bg-blue-50',
  staff:           'border-green-200 text-green-700 bg-green-50',
  client:          'border-amber-200 text-amber-700 bg-amber-50',
  partner:         'border-indigo-200 text-indigo-700 bg-indigo-50',
}

type Step = 'info' | 'permissions' | 'success'

const STEPS: { key: Step; label: string; Icon: React.ElementType }[] = [
  { key: 'info',        label: 'Basic Info',   Icon: User       },
  { key: 'permissions', label: 'Permissions',  Icon: ShieldCheck },
  { key: 'success',     label: 'Done',         Icon: KeyRound   },
]

// ── Component ─────────────────────────────────────────────────────────────────

export function CreateUserDialog({ open, onOpenChange }: CreateUserDialogProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [isPending, startTransition] = useTransition()

  // Step
  const [step, setStep] = useState<Step>('info')

  // Step 1
  const [fullName, setFullName]     = useState('')
  const [email, setEmail]           = useState('')
  const [role, setRole]             = useState<RoleOption>('staff')
  const [password, setPassword]     = useState(() => generatePassword())
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError]           = useState<string | null>(null)

  // Step 2
  const [permissions, setPermissions] = useState<PermissionSet>(() => defaultPermissionsForRole('staff'))

  // Step 3
  const [createdUserId, setCreatedUserId] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  // When role changes, reset permissions to that role's defaults
  function handleRoleChange(r: RoleOption) {
    setRole(r)
    setPermissions(defaultPermissionsForRole(r))
  }

  // ── Step 1 → 2: create user, then go to permissions ──────────────────────
  function handleNext() {
    if (!fullName.trim()) { setError('Full name is required'); return }
    if (!email.trim() || !email.includes('@')) { setError('Valid email is required'); return }
    if (password.length < 8) { setError('Password must be at least 8 characters'); return }
    setError(null)

    startTransition(async () => {
      const result = await createUserAction({ email: email.trim(), full_name: fullName.trim(), role, password })
      if (!result.success) { setError(result.error ?? 'Failed to create user'); return }
      setCreatedUserId(result.userId ?? null)
      setStep('permissions')
    })
  }

  // ── Step 2 → 3: save permissions ─────────────────────────────────────────
  function handleSavePermissions() {
    if (!createdUserId) { setStep('success'); return }

    startTransition(async () => {
      // Only save custom permissions if they differ from the role default
      const def = defaultPermissionsForRole(role)
      const isDefault = JSON.stringify(permissions) === JSON.stringify(def)
      if (!isDefault) {
        await setUserPermissionsAction(createdUserId, permissions)
      }
      router.refresh()
      setStep('success')
    })
  }

  // ── Close & reset ─────────────────────────────────────────────────────────
  function handleClose() {
    if (isPending) return
    onOpenChange(false)
    setTimeout(() => {
      setStep('info')
      setFullName(''); setEmail(''); setRole('staff')
      setPassword(generatePassword()); setShowPassword(false)
      setError(null); setCreatedUserId(null); setCopied(false)
      setPermissions(defaultPermissionsForRole('staff'))
    }, 300)
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(password)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const stepIndex = STEPS.findIndex((s) => s.key === step)

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className={cn('flex flex-col', step === 'permissions' ? 'max-w-2xl max-h-[90vh]' : 'sm:max-w-lg max-h-[90vh]')}>

        {/* ── Step indicator ── */}
        {step !== 'success' && (
          <div className="flex items-center gap-0 mb-1">
            {STEPS.filter((s) => s.key !== 'success').map((s, i) => {
              const active  = s.key === step
              const done    = STEPS.findIndex((x) => x.key === step) > i
              return (
                <div key={s.key} className="flex items-center gap-0 flex-1">
                  <div className={cn(
                    'flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full transition-colors',
                    active ? 'bg-primary text-primary-foreground'
                    : done  ? 'text-emerald-600' : 'text-muted-foreground'
                  )}>
                    {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : <s.Icon className="h-3.5 w-3.5" />}
                    {s.label}
                  </div>
                  {i < 1 && <div className={cn('flex-1 h-px mx-1', done ? 'bg-emerald-400' : 'bg-border')} />}
                </div>
              )
            })}
          </div>
        )}

        <DialogHeader>
          <DialogTitle>
            {step === 'info'        && 'Create New User'}
            {step === 'permissions' && 'Set Permissions'}
            {step === 'success'     && 'User Created!'}
          </DialogTitle>
        </DialogHeader>

        {/* ── Step 1: Basic Info ── */}
        {step === 'info' && (
          <div className="space-y-3">
            {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm">Full Name *</Label>
                <Input value={fullName} onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. John Smith" disabled={isPending} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">Email *</Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder="john@example.com" disabled={isPending} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm">Role *</Label>
              {/* First 4 roles in a 2×2 grid, Partner spans full width */}
              <div className="grid grid-cols-2 gap-2">
                {ROLE_OPTIONS.slice(0, 4).map((r) => (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => handleRoleChange(r.value)}
                    className={cn(
                      'flex items-center gap-2.5 px-3 py-2.5 rounded-lg border text-left transition-colors',
                      role === r.value ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/40'
                    )}
                  >
                    <div className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full border shrink-0 whitespace-nowrap', ROLE_BADGE[r.value])}>
                      {r.label}
                    </div>
                    <span className="text-[11px] text-muted-foreground leading-tight flex-1">{r.description}</span>
                    {role === r.value && <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />}
                  </button>
                ))}
                {/* Partner spans full width */}
                <button
                  type="button"
                  onClick={() => handleRoleChange('partner')}
                  className={cn(
                    'col-span-2 flex items-center gap-2.5 px-3 py-2.5 rounded-lg border text-left transition-colors',
                    role === 'partner' ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/40'
                  )}
                >
                  <div className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full border shrink-0', ROLE_BADGE['partner'])}>
                    Partner
                  </div>
                  <span className="text-[11px] text-muted-foreground leading-tight flex-1">External collaborator, view-only access</span>
                  {role === 'partner' && <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm">Temporary Password *</Label>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Input type={showPassword ? 'text' : 'password'} value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pr-9 font-mono" disabled={isPending} />
                  <button type="button" onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <Button type="button" size="icon" variant="outline"
                  onClick={() => setPassword(generatePassword())} disabled={isPending}>
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">Auto-generated. User must change on first login.</p>
            </div>
          </div>
        )}

        {/* ── Step 2: Permissions ── */}
        {step === 'permissions' && (
          <div className="flex-1 overflow-y-auto min-h-0 space-y-3 pr-1">
            <p className="text-sm text-muted-foreground">
              Permissions are pre-filled from the <strong>{ROLE_OPTIONS.find((r) => r.value === role)?.label}</strong> template.
              Customise as needed — amber highlights show overrides.
            </p>
            <PermissionMatrix role={role} permissions={permissions} onChange={setPermissions} />
          </div>
        )}

        {/* ── Step 3: Success ── */}
        {step === 'success' && (
          <div className="space-y-4">
            <div className="flex flex-col items-center gap-3 py-2">
              <div className="rounded-full bg-green-50 p-3">
                <CheckCircle2 className="h-8 w-8 text-green-500" />
              </div>
              <div className="text-center">
                <p className="font-semibold">{fullName}</p>
                <p className="text-sm text-muted-foreground">{email}</p>
                <span className={cn('mt-1.5 inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full border', ROLE_BADGE[role])}>
                  {ROLE_OPTIONS.find((r) => r.value === role)?.label}
                </span>
              </div>
            </div>
            <div className="rounded-lg border bg-amber-50 border-amber-200 p-4 space-y-2">
              <p className="text-sm font-medium text-amber-800">Temporary Password</p>
              <p className="text-xs text-amber-700">
                Share this with the user. They will be prompted to change it on first login.
              </p>
              <div className="flex items-center gap-2 mt-2">
                <code className="flex-1 rounded bg-card border border-amber-200 px-3 py-2 text-sm font-mono text-amber-900 select-all">
                  {password}
                </code>
                <Button size="sm" variant="outline" onClick={handleCopy}>
                  {copied ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ── Footer ── */}
        <DialogFooter className="shrink-0">
          {step === 'info' && (
            <>
              <Button variant="outline" onClick={handleClose} disabled={isPending}>Cancel</Button>
              <Button onClick={handleNext} disabled={isPending}>
                {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Next: Permissions <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </>
          )}
          {step === 'permissions' && (
            <>
              <Button variant="outline" onClick={() => setStep('info')} disabled={isPending}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Back
              </Button>
              <Button onClick={handleSavePermissions} disabled={isPending}>
                {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Save & Finish
              </Button>
            </>
          )}
          {step === 'success' && (
            <Button onClick={handleClose} className="w-full sm:w-auto">Done</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
