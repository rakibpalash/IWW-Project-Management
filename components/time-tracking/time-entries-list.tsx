'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { TimeEntry, Profile } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/use-toast'
import { Edit2, Trash2, Clock, Timer } from 'lucide-react'
import { formatDate, formatMinutes, timeAgo } from '@/lib/utils'
import { format, parseISO } from 'date-fns'

interface TimeEntriesListProps {
  timeEntries: TimeEntry[]
  profile: Profile
  onEntryUpdated: (entry: TimeEntry) => void
  onEntryDeleted: (id: string) => void
}

export function TimeEntriesList({
  timeEntries,
  profile,
  onEntryUpdated,
  onEntryDeleted,
}: TimeEntriesListProps) {
  const { toast } = useToast()
  const supabase = createClient()

  const [editingEntry, setEditingEntry] = useState<TimeEntry | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const isAdmin = profile.role === 'super_admin'

  const totalMinutes = timeEntries
    .filter((e) => e.duration_minutes !== null && !e.is_running)
    .reduce((sum, e) => sum + (e.duration_minutes ?? 0), 0)

  async function handleDelete() {
    if (!deletingId) return

    const { error } = await supabase.from('time_entries').delete().eq('id', deletingId)

    if (error) {
      toast({ title: 'Failed to delete entry', variant: 'destructive' })
    } else {
      onEntryDeleted(deletingId)
      toast({ title: 'Time entry deleted' })
    }
    setDeletingId(null)
  }

  if (timeEntries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center">
        <Timer className="h-8 w-8 text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground">No time entries yet.</p>
        <p className="text-xs text-muted-foreground mt-1">
          Use the timer or log time manually.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Total summary */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          {timeEntries.length} {timeEntries.length === 1 ? 'entry' : 'entries'}
        </span>
        <div className="flex items-center gap-1.5 font-medium">
          <Clock className="h-4 w-4 text-muted-foreground" />
          Total: {formatMinutes(totalMinutes)}
        </div>
      </div>

      {/* Entries */}
      <div className="space-y-2">
        {timeEntries.map((entry) => {
          const canModify = isAdmin || entry.user_id === profile.id
          const isRunning = entry.is_running

          return (
            <div
              key={entry.id}
              className="flex items-start gap-3 rounded-lg border p-3 bg-background"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium">
                    {entry.started_at
                      ? format(parseISO(entry.started_at), 'MMM d, yyyy')
                      : '—'}
                  </span>
                  {isRunning ? (
                    <Badge variant="secondary" className="text-xs gap-1">
                      <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                      Running
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-xs">
                      {entry.duration_minutes !== null
                        ? formatMinutes(entry.duration_minutes)
                        : '—'}
                    </Badge>
                  )}
                </div>

                {entry.description && (
                  <p className="text-sm text-muted-foreground mt-1 truncate">
                    {entry.description}
                  </p>
                )}

                <p className="text-xs text-muted-foreground mt-0.5">
                  {entry.started_at
                    ? `${format(parseISO(entry.started_at), 'h:mm a')}${
                        entry.ended_at
                          ? ` – ${format(parseISO(entry.ended_at), 'h:mm a')}`
                          : ''
                      }`
                    : ''}
                </p>
              </div>

              {canModify && !isRunning && (
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={() => setEditingEntry(entry)}
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                    onClick={() => setDeletingId(entry.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Edit dialog */}
      {editingEntry && (
        <EditTimeEntryDialog
          entry={editingEntry}
          onClose={() => setEditingEntry(null)}
          onUpdated={(updated) => {
            onEntryUpdated(updated)
            setEditingEntry(null)
          }}
        />
      )}

      {/* Delete confirm */}
      <AlertDialog open={!!deletingId} onOpenChange={(o) => !o && setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Time Entry</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this time entry? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeletingId(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// Edit dialog component
interface EditTimeEntryDialogProps {
  entry: TimeEntry
  onClose: () => void
  onUpdated: (entry: TimeEntry) => void
}

function EditTimeEntryDialog({ entry, onClose, onUpdated }: EditTimeEntryDialogProps) {
  const { toast } = useToast()
  const supabase = createClient()

  const initialHours = entry.duration_minutes ? Math.floor(entry.duration_minutes / 60) : 0
  const initialMinutes = entry.duration_minutes ? entry.duration_minutes % 60 : 0

  const [hours, setHours] = useState(String(initialHours))
  const [minutes, setMinutes] = useState(String(initialMinutes))
  const [description, setDescription] = useState(entry.description ?? '')
  const [submitting, setSubmitting] = useState(false)

  const totalMinutes = parseInt(hours || '0') * 60 + parseInt(minutes || '0')

  async function handleSave() {
    if (totalMinutes <= 0) {
      toast({ title: 'Duration must be greater than 0', variant: 'destructive' })
      return
    }

    setSubmitting(true)

    try {
      const { data, error } = await supabase
        .from('time_entries')
        .update({
          description: description.trim() || null,
          duration_minutes: totalMinutes,
          updated_at: new Date().toISOString(),
        })
        .eq('id', entry.id)
        .select('*')
        .single()

      if (error) throw error

      onUpdated(data as TimeEntry)
      toast({ title: 'Time entry updated' })
    } catch {
      toast({ title: 'Failed to update entry', variant: 'destructive' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Edit Time Entry</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Duration</Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min="0"
                max="24"
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                className="w-20"
              />
              <span className="text-sm text-muted-foreground">h</span>
              <Input
                type="number"
                min="0"
                max="59"
                value={minutes}
                onChange={(e) => setMinutes(e.target.value)}
                className="w-20"
              />
              <span className="text-sm text-muted-foreground">m</span>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-description">Description</Label>
            <Textarea
              id="edit-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What did you work on?"
              rows={2}
              className="resize-none"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={submitting || totalMinutes <= 0}>
            {submitting ? 'Saving…' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
