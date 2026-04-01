'use client'

import { useState } from 'react'
import { Profile, TimeEntry } from '@/types'
import { useTimer } from '@/hooks/use-timer'
import { Button } from '@/components/ui/button'
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
import { useToast } from '@/components/ui/use-toast'
import { Play, Square, Timer } from 'lucide-react'
import { cn } from '@/lib/utils'

interface TimerButtonProps {
  taskId: string
  profile: Profile
  onEntryCreated?: (entry: TimeEntry) => void
  onEntryUpdated?: (entry: TimeEntry) => void
  className?: string
}

function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export function TimerButton({
  taskId,
  profile,
  onEntryCreated,
  onEntryUpdated,
  className,
}: TimerButtonProps) {
  const { toast } = useToast()
  const { runningEntry, isRunning, elapsedSeconds, startTimer, stopTimer, loading } = useTimer()

  const [showConflictDialog, setShowConflictDialog] = useState(false)
  const [actionPending, setActionPending] = useState(false)

  const isThisTask = runningEntry?.task_id === taskId
  const isDifferentTask = isRunning && !isThisTask

  async function handleStart() {
    if (isDifferentTask) {
      // Show warning that another timer is running
      setShowConflictDialog(true)
      return
    }
    await doStart()
  }

  async function doStart() {
    setActionPending(true)
    try {
      if (isDifferentTask) {
        // Stop existing timer first
        const stopped = await stopTimer()
        if (stopped && onEntryUpdated) {
          onEntryUpdated(stopped)
        }
      }
      await startTimer(taskId)
      toast({ title: 'Timer started' })
    } catch {
      toast({ title: 'Failed to start timer', variant: 'destructive' })
    } finally {
      setActionPending(false)
    }
  }

  async function handleStop() {
    setActionPending(true)
    try {
      const stopped = await stopTimer()
      if (stopped) {
        if (onEntryUpdated) onEntryUpdated(stopped)
        toast({
          title: 'Timer stopped',
          description: `Logged ${formatElapsed(elapsedSeconds)}`,
        })
      }
    } catch {
      toast({ title: 'Failed to stop timer', variant: 'destructive' })
    } finally {
      setActionPending(false)
    }
  }

  if (loading) {
    return (
      <Button variant="outline" size="sm" disabled className={cn('gap-2', className)}>
        <Timer className="h-4 w-4" />
        Loading…
      </Button>
    )
  }

  return (
    <>
      {isThisTask ? (
        // Running on this task → show elapsed + Stop button
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 rounded-md border bg-primary/5 px-3 py-1.5 text-sm font-mono font-medium text-primary">
            <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
            {formatElapsed(elapsedSeconds)}
          </div>
          <Button
            variant="destructive"
            size="sm"
            className={cn('gap-2', className)}
            onClick={handleStop}
            disabled={actionPending}
          >
            <Square className="h-4 w-4" />
            Stop
          </Button>
        </div>
      ) : (
        // Not running on this task → show Start button
        <Button
          variant="outline"
          size="sm"
          className={cn('gap-2', className)}
          onClick={handleStart}
          disabled={actionPending}
        >
          <Play className="h-4 w-4" />
          {isDifferentTask ? 'Switch Timer' : 'Start Timer'}
        </Button>
      )}

      {/* Conflict dialog */}
      <AlertDialog open={showConflictDialog} onOpenChange={setShowConflictDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Timer Already Running</AlertDialogTitle>
            <AlertDialogDescription>
              You have a timer running on a different task. Starting a new timer
              will automatically stop the current one and log the time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Current Timer</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                setShowConflictDialog(false)
                await doStart()
              }}
            >
              Switch Timer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
