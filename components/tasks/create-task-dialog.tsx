'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Task, Profile, Project, TaskStatus, Priority } from '@/types'
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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/use-toast'
import { X, Check, Users } from 'lucide-react'
import { TASK_STATUSES, PRIORITIES, MAX_SUBTASKS, MAX_SUBTASK_DEPTH } from '@/lib/constants'
import { getInitials, cn } from '@/lib/utils'

interface CreateTaskDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projects: Project[]
  profile: Profile
  onCreated: (task: Task) => void
  // If creating a subtask
  parentTaskId?: string
  parentTaskDepth?: number
  projectId?: string
  // Current subtask count for parent
  currentSubtaskCount?: number
}

export function CreateTaskDialog({
  open,
  onOpenChange,
  projects,
  profile,
  onCreated,
  parentTaskId,
  parentTaskDepth = 0,
  projectId: defaultProjectId,
  currentSubtaskCount = 0,
}: CreateTaskDialogProps) {
  const { toast } = useToast()
  const supabase = createClient()

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [selectedProjectId, setSelectedProjectId] = useState(defaultProjectId ?? '')
  const [startDate, setStartDate] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [estimatedHours, setEstimatedHours] = useState('')
  const [priority, setPriority] = useState<Priority>('medium')
  const [status, setStatus] = useState<TaskStatus>('todo')
  const [selectedAssigneeIds, setSelectedAssigneeIds] = useState<string[]>([])
  const [members, setMembers] = useState<Profile[]>([])
  const [loadingMembers, setLoadingMembers] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const isSubtask = !!parentTaskId
  const depth = isSubtask ? (parentTaskDepth ?? 0) + 1 : 0

  // Validate subtask constraints
  const canCreate =
    !isSubtask ||
    (currentSubtaskCount < MAX_SUBTASKS && depth <= MAX_SUBTASK_DEPTH)

  // Fetch workspace members when project changes
  useEffect(() => {
    const projectId = selectedProjectId || defaultProjectId
    if (!projectId) return

    const project = projects.find((p) => p.id === projectId)
    if (!project?.workspace_id) return

    setLoadingMembers(true)

    const fetchMembers = async () => {
      const profileSelect =
        'id, full_name, email, avatar_url, role, is_temp_password, onboarding_completed, created_at, updated_at'

      const { data: assignmentsRaw } = await supabase
        .from('workspace_assignments')
        .select(`user:profiles(${profileSelect})`)
        .eq('workspace_id', project.workspace_id)

      const { data: admins } = await supabase
        .from('profiles')
        .select(profileSelect)
        .eq('role', 'super_admin')

      const workspaceMembers: Profile[] = ((assignmentsRaw ?? []) as any[])
        .map((a) => a.user)
        .filter(Boolean) as Profile[]

      const adminProfiles = (admins ?? []) as Profile[]
      const memberIds = new Set(workspaceMembers.map((m) => m.id))
      for (const a of adminProfiles) {
        if (!memberIds.has(a.id)) workspaceMembers.push(a)
      }

      setMembers(workspaceMembers)
      setLoadingMembers(false)
    }

    fetchMembers()
  }, [selectedProjectId, defaultProjectId, projects])

  function toggleAssignee(userId: string) {
    setSelectedAssigneeIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!title.trim()) {
      toast({ title: 'Title is required', variant: 'destructive' })
      return
    }

    const projectId = selectedProjectId || defaultProjectId

    if (!projectId) {
      toast({ title: 'Please select a project', variant: 'destructive' })
      return
    }

    if (!canCreate) {
      toast({
        title: 'Cannot create subtask',
        description: `Maximum ${MAX_SUBTASKS} subtasks per task, or max depth of ${MAX_SUBTASK_DEPTH} reached.`,
        variant: 'destructive',
      })
      return
    }

    setSubmitting(true)

    try {
      const { data: newTask, error: taskError } = await supabase
        .from('tasks')
        .insert({
          project_id: projectId,
          parent_task_id: parentTaskId ?? null,
          title: title.trim(),
          description: description.trim() || null,
          start_date: startDate || null,
          due_date: dueDate || null,
          estimated_hours: estimatedHours ? parseFloat(estimatedHours) : null,
          priority,
          status,
          created_by: profile.id,
          depth: depth,
        })
        .select('*')
        .single()

      if (taskError || !newTask) {
        throw taskError ?? new Error('Failed to create task')
      }

      // Insert assignees
      if (selectedAssigneeIds.length > 0) {
        await supabase.from('task_assignees').insert(
          selectedAssigneeIds.map((userId) => ({
            task_id: newTask.id,
            user_id: userId,
          }))
        )
      }

      // Log activity
      await supabase.from('activity_logs').insert({
        task_id: newTask.id,
        user_id: profile.id,
        action: 'task_created',
        old_value: null,
        new_value: newTask.title,
      })

      if (isSubtask) {
        await supabase.from('activity_logs').insert({
          task_id: parentTaskId,
          user_id: profile.id,
          action: 'subtask_created',
          old_value: null,
          new_value: newTask.title,
        })
      }

      // Send notifications to assignees
      const assigneesToNotify = selectedAssigneeIds.filter((id) => id !== profile.id)
      if (assigneesToNotify.length > 0) {
        await supabase.from('notifications').insert(
          assigneesToNotify.map((userId) => ({
            user_id: userId,
            type: isSubtask ? 'subtask_assigned' : 'task_assigned',
            title: isSubtask ? 'Subtask assigned to you' : 'Task assigned to you',
            message: `You have been assigned to "${newTask.title}"`,
            link: `/projects/${projectId}/tasks/${newTask.id}`,
            is_read: false,
          }))
        )
      }

      const assigneeProfiles = members.filter((m) => selectedAssigneeIds.includes(m.id))

      const fullTask: Task = {
        ...newTask,
        assignees: assigneeProfiles,
        subtasks: [],
      }

      toast({ title: isSubtask ? 'Subtask created' : 'Task created' })
      onCreated(fullTask)

      // Reset
      setTitle('')
      setDescription('')
      setStartDate('')
      setDueDate('')
      setEstimatedHours('')
      setPriority('medium')
      setStatus('todo')
      setSelectedAssigneeIds([])
    } catch (err) {
      console.error(err)
      toast({ title: 'Failed to create task', variant: 'destructive' })
    } finally {
      setSubmitting(false)
    }
  }

  if (!canCreate && isSubtask) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cannot Add Subtask</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {currentSubtaskCount >= MAX_SUBTASKS
              ? `This task already has the maximum of ${MAX_SUBTASKS} subtasks.`
              : `Maximum subtask depth of ${MAX_SUBTASK_DEPTH} reached.`}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isSubtask ? 'Add Subtask' : 'Create Task'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title */}
          <div className="space-y-1.5">
            <Label htmlFor="task-title">
              Title <span className="text-destructive">*</span>
            </Label>
            <Input
              id="task-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Task title"
              required
            />
          </div>

          {/* Project (only show if not locked) */}
          {!defaultProjectId && (
            <div className="space-y-1.5">
              <Label htmlFor="task-project">Project</Label>
              <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                <SelectTrigger id="task-project">
                  <SelectValue placeholder="Select project" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="task-description">Description</Label>
            <Textarea
              id="task-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
              rows={3}
              className="resize-none"
            />
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="task-start">Start Date</Label>
              <Input
                id="task-start"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="task-due">Due Date</Label>
              <Input
                id="task-due"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>

          {/* Estimated hours */}
          <div className="space-y-1.5">
            <Label htmlFor="task-hours">Estimated Hours</Label>
            <Input
              id="task-hours"
              type="number"
              min="0"
              step="0.5"
              value={estimatedHours}
              onChange={(e) => setEstimatedHours(e.target.value)}
              placeholder="e.g. 4"
            />
          </div>

          {/* Priority + Status */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Priority</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as Priority)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as TaskStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TASK_STATUSES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Assignees */}
          {members.length > 0 && (
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5" />
                Assignees
              </Label>
              <div className="max-h-44 overflow-y-auto space-y-1 rounded-md border p-2">
                {loadingMembers ? (
                  <p className="text-xs text-muted-foreground text-center py-2">
                    Loading members…
                  </p>
                ) : (
                  members.map((member) => {
                    const selected = selectedAssigneeIds.includes(member.id)
                    return (
                      <button
                        key={member.id}
                        type="button"
                        onClick={() => toggleAssignee(member.id)}
                        className={cn(
                          'w-full flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors',
                          selected
                            ? 'bg-primary/10 text-primary'
                            : 'hover:bg-muted text-foreground'
                        )}
                      >
                        <Avatar className="h-6 w-6 shrink-0">
                          <AvatarImage src={member.avatar_url ?? undefined} />
                          <AvatarFallback className="text-xs">
                            {getInitials(member.full_name)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="flex-1 truncate text-left">{member.full_name}</span>
                        {selected && <Check className="h-4 w-4 shrink-0" />}
                      </button>
                    )
                  })
                )}
              </div>

              {selectedAssigneeIds.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {selectedAssigneeIds.map((id) => {
                    const member = members.find((m) => m.id === id)
                    if (!member) return null
                    return (
                      <Badge key={id} variant="secondary" className="gap-1 pr-1">
                        {member.full_name}
                        <button
                          type="button"
                          onClick={() => toggleAssignee(id)}
                          className="rounded-full hover:bg-muted"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Creating…' : isSubtask ? 'Add Subtask' : 'Create Task'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
