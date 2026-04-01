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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Loader2, Heart } from 'lucide-react'
import { Profile } from '@/types'
import { grantMarriageLeaveAction } from '@/app/actions/leave'

interface GrantMarriageLeaveDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  staffProfiles: Profile[]
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export function GrantMarriageLeaveDialog({
  open,
  onOpenChange,
  staffProfiles,
}: GrantMarriageLeaveDialogProps) {
  const router = useRouter()
  const [selectedUserId, setSelectedUserId] = useState('')
  const [days, setDays] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const selectedUser = staffProfiles.find((p) => p.id === selectedUserId)

  const handleSubmit = async () => {
    if (!selectedUserId) {
      setError('Please select a staff member')
      return
    }
    const daysNum = parseInt(days, 10)
    if (!days || isNaN(daysNum) || daysNum <= 0) {
      setError('Please enter a valid number of days (minimum 1)')
      return
    }

    setLoading(true)
    setError(null)

    const result = await grantMarriageLeaveAction(selectedUserId, daysNum)

    setLoading(false)

    if (!result.success) {
      setError(result.error ?? 'Failed to grant marriage leave')
      return
    }

    setSuccess(true)
    setTimeout(() => {
      setSuccess(false)
      onOpenChange(false)
      setSelectedUserId('')
      setDays('')
      router.refresh()
    }, 1500)
  }

  const handleClose = () => {
    if (!loading) {
      onOpenChange(false)
      setError(null)
      setSuccess(false)
      setSelectedUserId('')
      setDays('')
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Heart className="h-5 w-5 text-pink-500" />
            Grant Marriage Leave
          </DialogTitle>
        </DialogHeader>

        {success ? (
          <div className="flex flex-col items-center gap-3 py-6">
            <div className="rounded-full bg-pink-50 p-3">
              <Heart className="h-8 w-8 text-pink-500" />
            </div>
            <p className="text-center font-medium">
              Marriage leave granted successfully!
            </p>
            <p className="text-center text-sm text-muted-foreground">
              {days} day{parseInt(days) !== 1 ? 's' : ''} added to{' '}
              {selectedUser?.full_name}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label>Staff Member</Label>
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select staff member..." />
                </SelectTrigger>
                <SelectContent>
                  {staffProfiles.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      <div className="flex items-center gap-2">
                        <Avatar className="h-5 w-5">
                          <AvatarImage src={p.avatar_url ?? undefined} />
                          <AvatarFallback className="text-[10px]">
                            {getInitials(p.full_name)}
                          </AvatarFallback>
                        </Avatar>
                        <span>{p.full_name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Days to Grant</Label>
              <Input
                type="number"
                min="1"
                max="365"
                value={days}
                onChange={(e) => setDays(e.target.value)}
                placeholder="e.g. 3"
              />
              <p className="text-xs text-muted-foreground">
                These days will be added to the staff member&apos;s marriage leave allocation for
                the current year.
              </p>
            </div>
          </div>
        )}

        {!success && (
          <DialogFooter>
            <Button variant="outline" onClick={handleClose} disabled={loading}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Grant Leave
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}
