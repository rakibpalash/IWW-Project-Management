'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Loader2, Copy, CheckCircle2, Eye, EyeOff, RefreshCw } from 'lucide-react'
import { createUserAction } from '@/app/actions/user'

interface CreateUserDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

function generatePassword(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$'
  let password = ''
  for (let i = 0; i < 12; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return password
}

export function CreateUserDialog({ open, onOpenChange }: CreateUserDialogProps) {
  const router = useRouter()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'staff' | 'client'>('staff')
  const [password, setPassword] = useState(() => generatePassword())
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [createdUser, setCreatedUser] = useState<{
    email: string
    fullName: string
    tempPassword: string
  } | null>(null)
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    if (createdUser) {
      await navigator.clipboard.writeText(createdUser.tempPassword)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleSubmit = async () => {
    if (!fullName.trim()) {
      setError('Full name is required')
      return
    }
    if (!email.trim() || !email.includes('@')) {
      setError('Valid email is required')
      return
    }
    if (!password.trim() || password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }

    setLoading(true)
    setError(null)

    const result = await createUserAction({
      email: email.trim(),
      full_name: fullName.trim(),
      role,
      password,
    })

    setLoading(false)

    if (!result.success) {
      setError(result.error ?? 'Failed to create user')
      return
    }

    setCreatedUser({
      email: email.trim(),
      fullName: fullName.trim(),
      tempPassword: result.tempPassword ?? password,
    })

    router.refresh()
  }

  const handleClose = () => {
    if (!loading) {
      onOpenChange(false)
      // Reset after close animation
      setTimeout(() => {
        setFullName('')
        setEmail('')
        setRole('staff')
        setPassword(generatePassword())
        setError(null)
        setCreatedUser(null)
        setCopied(false)
        setShowPassword(false)
      }, 300)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create New User</DialogTitle>
        </DialogHeader>

        {createdUser ? (
          <div className="space-y-4">
            <div className="flex flex-col items-center gap-3 py-2">
              <div className="rounded-full bg-green-50 p-3">
                <CheckCircle2 className="h-8 w-8 text-green-500" />
              </div>
              <div className="text-center">
                <p className="font-semibold">{createdUser.fullName}</p>
                <p className="text-sm text-muted-foreground">{createdUser.email}</p>
              </div>
            </div>

            <div className="rounded-lg border bg-amber-50 border-amber-200 p-4 space-y-2">
              <p className="text-sm font-medium text-amber-800">Temporary Password</p>
              <p className="text-xs text-amber-700">
                Share this password with the user. They will be prompted to change it on first login.
              </p>
              <div className="flex items-center gap-2 mt-2">
                <code className="flex-1 rounded bg-card border border-amber-200 px-3 py-2 text-sm font-mono text-amber-900 select-all">
                  {createdUser.tempPassword}
                </code>
                <Button size="sm" variant="outline" onClick={handleCopy} className="shrink-0">
                  {copied ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label>Full Name *</Label>
              <Input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. John Smith"
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label>Email *</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="john@example.com"
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label>Role *</Label>
              <Select value={role} onValueChange={(v) => setRole(v as 'staff' | 'client')} disabled={loading}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="staff">Staff</SelectItem>
                  <SelectItem value="client">Client</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Temporary Password *</Label>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pr-9 font-mono"
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  onClick={() => setPassword(generatePassword())}
                  disabled={loading}
                  title="Regenerate password"
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Auto-generated. The user must change this on first login.
              </p>
            </div>
          </div>
        )}

        <DialogFooter>
          {createdUser ? (
            <Button onClick={handleClose} className="w-full sm:w-auto">
              Done
            </Button>
          ) : (
            <>
              <Button variant="outline" onClick={handleClose} disabled={loading}>
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create User
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
