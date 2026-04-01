'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Profile, TimeEntry, Task } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/components/ui/use-toast'
import { format } from 'date-fns'

interface TimeLogDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  profile: Profile
  onCreated: (entry: TimeEntry) => void
  taskId?: string
  tasks?: Task[]
}

export function TimeLogDialog({
  open,
  onOpenChange,
  profile,
  onCreated,
  taskId: defaultTaskId,
  tasks = [],
}: TimeLogDialogProps) {
  const { toast } = useToast()
  const supabase = createClient()

  const today = format(new Date(), 'yyyy-MM-dd')

  const [selectedTaskId, setSelectedTaskId] = useState(defaultTaskId ?? '')
  const [date, setDate] = useState(today)
  const [hours, setHours] = useState('0')
  const [minutes, setMinutes] = useState('30')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const totalMinutes = parseInt(hours || '0') * 60 + parseInt(minutes || '0')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    const taskId = selectedTaskId || defaultTaskId

    if (!taskId) {
      toast({ title: 'Please select a task', variant: 'destructive' })
      return
    }

    if (totalMinutes <= 0) {
      toast({ title: 'Please enter a valid duration', variant: 'destructive' })
      return
    }

    setSubmitting(true)

    try {
      // Build started_at from date (use noon to avoid TZ issues)
      const startedAt = new Date(`${date}T12:00:00`).toISOString()
      const endedAt = new Date(
        new Date(`${date}T12:00:00`).getTime() + totalMinutes * 60 * 1000
      ).toISOString()

      const { data, error } = await supabase
        .from('time_entries')
        .insert({
          task_id: taskId,
          user_id: profile.id,
          description: description.trim() || null,
          started_at: startedAt,
          ended_at: endedAt,
          duration_minutes: totalMinutes,
          is_running: false,
        })
        .select('*')
        .single()

      if (error) throw error

      toast({ title: 'Time logged successfully' })
      onCreated(data as TimeEntry)
      onOpenChange(false)

      // Reset
      setHours('0')
      setMinutes('30')
      setDescription('')
      setDate(today)
    } catch (err) {
      console.error(err)
      toast({ title: 'Failed to log time', variant: 'destructive' })
    } finally {
      setSubmitting(false)
    }
  }

  const hourOptions = Array.from({ length: 25 }, (_, i) => i)
  const minuteOptions = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Log Time</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Task selector (only if no task pre-filled) */}
          {!defaultTaskId && tasks.length > 0 && (
            <div className="space-y-1.5">
              <Label>Task</Label>
              <Select value={selectedTaskId} onValueChange={setSelectedTaskId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a task" />
                </SelectTrigger>
                <SelectContent>
                  {tasks.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Date */}
          <div className="space-y-1.5">
            <Label htmlFor="log-date">Date</Label>
            <Input
              id="log-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              max={today}
              required
            />
          </div>

          {/* Duration */}
          <div className="space-y-1.5">
            <Label>Duration</Label>
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <Select value={hours} onValueChange={setHours}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-48">
                    {hourOptions.map((h) => (
                      <SelectItem key={h} value={String(h)}>
                        {h}h
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <span className="text-muted-foreground">:</span>
              <div className="flex-1">
                <Select value={minutes} onValueChange={setMinutes}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {minuteOptions.map((m) => (
                      <SelectItem key={m} value={String(m)}>
                        {String(m).padStart(2, '0')}m
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {totalMinutes > 0 && (
              <p className="text-xs text-muted-foreground">
                Total: {totalMinutes >= 60
                  ? `${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m`
                  : `${totalMinutes}m`}
              </p>
            )}
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="log-description">Description (optional)</Label>
            <Textarea
              id="log-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What did you work on?"
              rows={2}
              className="resize-none"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting || totalMinutes <= 0}>
              {submitting ? 'Logging…' : 'Log Time'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
