'use client'

import { useState, useEffect, useRef } from 'react'
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
import { Checkbox } from '@/components/ui/checkbox'
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useToast } from '@/components/ui/use-toast'
import {
  X, Check, ChevronDown, AlertCircle,
  Bold, List, AlignLeft, Code2, Link2, Minus,
} from 'lucide-react'
import { MAX_SUBTASKS, MAX_SUBTASK_DEPTH } from '@/lib/constants'
import { getInitials, cn } from '@/lib/utils'
import { useTaskConfig } from '@/hooks/use-task-config'

interface CreateTaskDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projects: Project[]
  profile: Profile
  onCreated: (task: Task) => void
  parentTaskId?: string
  parentTaskDepth?: number
  projectId?: string
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
  const titleRef = useRef<HTMLInputElement>(null)
  const descriptionRef = useRef<HTMLTextAreaElement>(null)
  const { statuses, priorities, defaultStatus, defaultPriority } = useTaskConfig()

  const [title, setTitle] = useState('')
  const [titleTouched, setTitleTouched] = useState(false)
  const [description, setDescription] = useState('')
  const [selectedProjectId, setSelectedProjectId] = useState(defaultProjectId ?? '')
  const [startDate, setStartDate] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [estimatedHours, setEstimatedHours] = useState('')
  const [priority, setPriority] = useState<string>('medium')
  const [status, setStatus] = useState<string>('todo')
  const [selectedAssigneeIds, setSelectedAssigneeIds] = useState<string[]>([])
  const [members, setMembers] = useState<Profile[]>([])
  const [loadingMembers, setLoadingMembers] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [createAnother, setCreateAnother] = useState(false)
  const [assigneeOpen, setAssigneeOpen] = useState(false)
  const [mentionQuery, setMentionQuery] = useState<string | null>(null)
  const [mentionOpen, setMentionOpen] = useState(false)

  const isSubtask = !!parentTaskId
  const depth = isSubtask ? (parentTaskDepth ?? 0) + 1 : 0
  const canCreate = !isSubtask || (currentSubtaskCount < MAX_SUBTASKS && depth <= MAX_SUBTASK_DEPTH)

  const currentProject = projects.find((p) => p.id === (selectedProjectId || defaultProjectId))
  const titleError = titleTouched && !title.trim()
  const projectError = titleTouched && !selectedProjectId && !defaultProjectId

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
        .map((a) => a.user).filter(Boolean) as Profile[]
      const memberIds = new Set(workspaceMembers.map((m) => m.id))
      for (const a of (admins ?? []) as Profile[]) {
        if (!memberIds.has(a.id)) workspaceMembers.push(a)
      }
      setMembers(workspaceMembers)
      setLoadingMembers(false)
    }
    fetchMembers()
  }, [selectedProjectId, defaultProjectId, projects])

  function handleDescriptionChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const val = e.target.value
    setDescription(val)
    const cursor = e.target.selectionStart ?? val.length
    const textBefore = val.slice(0, cursor)
    const match = textBefore.match(/@([^\s@]*)$/)
    if (match) {
      setMentionQuery(match[1])
      setMentionOpen(true)
    } else {
      setMentionOpen(false)
      setMentionQuery(null)
    }
  }

  function handleDescriptionKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Escape' && mentionOpen) {
      e.preventDefault()
      setMentionOpen(false)
      setMentionQuery(null)
    }
  }

  function insertMention(member: Profile) {
    const textarea = descriptionRef.current
    if (!textarea) return
    const cursor = textarea.selectionStart ?? description.length
    const textBefore = description.slice(0, cursor)
    const match = textBefore.match(/@([^\s@]*)$/)
    if (match) {
      const start = cursor - match[0].length
      const newText = description.slice(0, start) + `@${member.full_name} ` + description.slice(cursor)
      setDescription(newText)
    }
    setMentionOpen(false)
    setMentionQuery(null)
    setTimeout(() => textarea.focus(), 0)
  }

  const mentionMembers = members.filter((m) =>
    !mentionQuery || m.full_name.toLowerCase().includes(mentionQuery.toLowerCase())
  )

  function toggleAssignee(userId: string) {
    setSelectedAssigneeIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    )
  }

  function assignToMe() {
    if (!selectedAssigneeIds.includes(profile.id)) {
      setSelectedAssigneeIds([profile.id])
    }
  }

  function reset() {
    setTitle('')
    setTitleTouched(false)
    setDescription('')
    if (!defaultProjectId) setSelectedProjectId('')
    setStartDate('')
    setDueDate('')
    setEstimatedHours('')
    setPriority(defaultPriority)
    setStatus(defaultStatus)
    setSelectedAssigneeIds([])
    setAssigneeOpen(false)
    setMentionOpen(false)
    setMentionQuery(null)
  }

  async function handleSubmit() {
    setTitleTouched(true)
    if (!title.trim()) {
      titleRef.current?.focus()
      return
    }
    const projectId = selectedProjectId || defaultProjectId
    if (!projectId) return
    if (!canCreate) {
      toast({
        title: 'Cannot create subtask',
        description: `Maximum ${MAX_SUBTASKS} subtasks or depth ${MAX_SUBTASK_DEPTH} reached.`,
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
          depth,
        })
        .select('*')
        .single()

      if (taskError || !newTask) throw taskError ?? new Error('Failed to create task')

      if (selectedAssigneeIds.length > 0) {
        await supabase.from('task_assignees').insert(
          selectedAssigneeIds.map((userId) => ({ task_id: newTask.id, user_id: userId }))
        )
      }

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
      const fullTask: Task = { ...newTask, assignees: assigneeProfiles, subtasks: [] }

      toast({ title: isSubtask ? 'Subtask created' : 'Task created' })
      onCreated(fullTask)

      if (createAnother) {
        reset()
        setTimeout(() => titleRef.current?.focus(), 50)
      } else {
        onOpenChange(false)
        reset()
      }
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
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Cannot Add Subtask</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {currentSubtaskCount >= MAX_SUBTASKS
              ? `This task already has the maximum of ${MAX_SUBTASKS} subtasks.`
              : `Maximum subtask depth of ${MAX_SUBTASK_DEPTH} reached.`}
          </p>
          <div className="flex justify-end">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  const selectedStatusCfg = statuses.find((s) => s.slug === status)
  const selectedPriorityCfg = priorities.find((p) => p.slug === priority)
  const assignedMembers = members.filter((m) => selectedAssigneeIds.includes(m.id))

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v) }}>
      <DialogContent className="max-w-2xl p-0 gap-0 overflow-hidden max-h-[92vh] flex flex-col">

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
          <h2 className="text-base font-semibold">
            {isSubtask ? 'Add Subtask' : 'Create Task'}
          </h2>
          <button
            onClick={() => { reset(); onOpenChange(false) }}
            className="rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* ── Scrollable body ── */}
        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-5">
          <p className="text-xs text-muted-foreground">
            Required fields are marked with an asterisk <span className="text-red-500 font-semibold">*</span>
          </p>

          {/* Project (Space) */}
          {!defaultProjectId && (
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground">
                Project <span className="text-red-500">*</span>
              </Label>
              <Select
                value={selectedProjectId}
                onValueChange={(v) => { setSelectedProjectId(v); setTitleTouched(false) }}
              >
                <SelectTrigger className={cn('text-sm', projectError && 'border-red-500')}>
                  {currentProject ? (
                    <div className="flex items-center gap-2">
                      <span className="flex h-5 w-5 items-center justify-center rounded bg-primary/10 text-primary text-[10px] font-bold shrink-0">
                        {currentProject.name.slice(0, 2).toUpperCase()}
                      </span>
                      <span className="truncate">{currentProject.name}</span>
                    </div>
                  ) : (
                    <SelectValue placeholder="Select a project" />
                  )}
                </SelectTrigger>
                <SelectContent>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      <div className="flex items-center gap-2">
                        <span className="flex h-5 w-5 items-center justify-center rounded bg-primary/10 text-primary text-[10px] font-bold">
                          {p.name.slice(0, 2).toUpperCase()}
                        </span>
                        {p.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {projectError && (
                <p className="text-xs text-red-500 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" /> Project is required
                </p>
              )}
            </div>
          )}

          {/* Status pill */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-foreground">Status</Label>
            <div className="flex items-center gap-2 flex-wrap">
              {statuses.map((s) => (
                <button
                  key={s.slug}
                  type="button"
                  onClick={() => setStatus(s.slug)}
                  className={cn(
                    'inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold transition-all',
                    status === s.slug
                      ? 'ring-2 ring-offset-1 ring-primary/30'
                      : 'bg-muted/40 text-muted-foreground hover:bg-muted border-transparent'
                  )}
                  style={status === s.slug ? {
                    backgroundColor: s.color + '20',
                    color: s.color,
                    borderColor: s.color + '60',
                  } : {}}
                >
                  {s.name}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground">This is the initial status upon creation</p>
          </div>

          {/* Task Name */}
          <div className="space-y-1.5">
            <Label htmlFor="task-title" className="text-xs font-semibold text-foreground">
              Task Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="task-title"
              ref={titleRef}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={() => setTitleTouched(true)}
              placeholder="Enter task name"
              className={cn(
                'text-sm transition-colors',
                titleError ? 'border-red-500 focus-visible:ring-red-300' : ''
              )}
              autoFocus
            />
            {titleError && (
              <p className="text-xs text-red-500 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" /> Task name is required
              </p>
            )}
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-foreground">Description</Label>
            <Popover open={mentionOpen && mentionMembers.length > 0}>
              <div className="rounded-md border overflow-hidden focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-0">
                {/* Toolbar */}
                <div className="flex items-center gap-0.5 border-b bg-muted/30 px-2 py-1.5">
                  <ToolbarBtn icon={<AlignLeft className="h-3.5 w-3.5" />} title="Paragraph" />
                  <div className="w-px h-4 bg-border mx-1" />
                  <ToolbarBtn icon={<Bold className="h-3.5 w-3.5" />} title="Bold" />
                  <ToolbarBtn icon={<List className="h-3.5 w-3.5" />} title="Bullet list" />
                  <ToolbarBtn icon={<Code2 className="h-3.5 w-3.5" />} title="Code" />
                  <ToolbarBtn icon={<Link2 className="h-3.5 w-3.5" />} title="Link" />
                  <div className="w-px h-4 bg-border mx-1" />
                  <ToolbarBtn icon={<Minus className="h-3.5 w-3.5" />} title="Divider" />
                </div>
                <PopoverAnchor asChild>
                  <Textarea
                    ref={descriptionRef}
                    value={description}
                    onChange={handleDescriptionChange}
                    onKeyDown={handleDescriptionKeyDown}
                    placeholder="Add a description… Use @ to mention someone"
                    rows={4}
                    className="resize-none border-0 rounded-none focus-visible:ring-0 text-sm"
                  />
                </PopoverAnchor>
              </div>
              <PopoverContent
                className="w-56 p-0"
                align="start"
                onOpenAutoFocus={(e) => e.preventDefault()}
                onInteractOutside={() => { setMentionOpen(false); setMentionQuery(null) }}
              >
                <div className="max-h-44 overflow-y-auto py-1">
                  {mentionMembers.map((member) => (
                    <button
                      key={member.id}
                      type="button"
                      onMouseDown={(e) => { e.preventDefault(); insertMention(member) }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted transition-colors text-left"
                    >
                      <Avatar className="h-6 w-6 shrink-0">
                        <AvatarImage src={member.avatar_url ?? undefined} />
                        <AvatarFallback className="text-[10px]">{getInitials(member.full_name)}</AvatarFallback>
                      </Avatar>
                      <span className="truncate">{member.full_name}</span>
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          </div>

          {/* Assignee */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold text-foreground">Assignee</Label>
              <button
                type="button"
                onClick={assignToMe}
                className="text-xs text-primary hover:underline font-medium"
              >
                Assign to me
              </button>
            </div>

            <Popover open={assigneeOpen} onOpenChange={setAssigneeOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  disabled={loadingMembers}
                  className={cn(
                    'w-full flex items-center gap-2 rounded-md border px-3 h-9 text-sm text-left transition-colors',
                    'hover:bg-muted/40 focus:outline-none focus:ring-2 focus:ring-ring',
                    assignedMembers.length === 0 && 'text-muted-foreground'
                  )}
                >
                  {assignedMembers.length === 0 ? (
                    <>
                      <Avatar className="h-5 w-5 shrink-0">
                        <AvatarFallback className="text-[10px] bg-muted">?</AvatarFallback>
                      </Avatar>
                      <span>{loadingMembers ? 'Loading…' : 'Unassigned'}</span>
                    </>
                  ) : (
                    <div className="flex items-center gap-1.5 flex-1 min-w-0">
                      <div className="flex -space-x-1">
                        {assignedMembers.slice(0, 3).map((m) => (
                          <Avatar key={m.id} className="h-5 w-5 ring-1 ring-background">
                            <AvatarImage src={m.avatar_url ?? undefined} />
                            <AvatarFallback className="text-[9px]">{getInitials(m.full_name)}</AvatarFallback>
                          </Avatar>
                        ))}
                      </div>
                      <span className="truncate text-sm">
                        {assignedMembers.length === 1
                          ? assignedMembers[0].full_name
                          : `${assignedMembers.length} assignees`}
                      </span>
                    </div>
                  )}
                  <ChevronDown className="h-3.5 w-3.5 ml-auto shrink-0 text-muted-foreground" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-72 p-0" align="start">
                {members.length === 0 ? (
                  <p className="px-3 py-4 text-center text-sm text-muted-foreground">
                    {loadingMembers ? 'Loading…' : 'No members found. Select a project first.'}
                  </p>
                ) : (
                  <div className="max-h-48 overflow-y-auto py-1">
                    {members.map((member) => {
                      const selected = selectedAssigneeIds.includes(member.id)
                      return (
                        <button
                          key={member.id}
                          type="button"
                          onClick={() => toggleAssignee(member.id)}
                          className="w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-muted transition-colors"
                        >
                          <Avatar className="h-6 w-6 shrink-0">
                            <AvatarImage src={member.avatar_url ?? undefined} />
                            <AvatarFallback className="text-[10px]">{getInitials(member.full_name)}</AvatarFallback>
                          </Avatar>
                          <span className="flex-1 text-left truncate">{member.full_name}</span>
                          {selected && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
                        </button>
                      )
                    })}
                  </div>
                )}
              </PopoverContent>
            </Popover>

            {/* Selected assignee badges */}
            {assignedMembers.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-0.5">
                {assignedMembers.map((m) => (
                  <Badge key={m.id} variant="secondary" className="gap-1 pr-1 h-6">
                    <Avatar className="h-4 w-4">
                      <AvatarImage src={m.avatar_url ?? undefined} />
                      <AvatarFallback className="text-[8px]">{getInitials(m.full_name)}</AvatarFallback>
                    </Avatar>
                    <span className="text-xs">{m.full_name}</span>
                    <button
                      type="button"
                      onClick={() => toggleAssignee(m.id)}
                      className="ml-0.5 rounded-full hover:bg-muted-foreground/20 p-0.5"
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Reporter */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-foreground">
              Reporter <span className="text-red-500">*</span>
            </Label>
            <div className="flex h-9 items-center gap-2 rounded-md border bg-muted/30 px-3 text-sm cursor-default">
              <Avatar className="h-5 w-5 shrink-0">
                <AvatarImage src={profile.avatar_url ?? undefined} />
                <AvatarFallback className="text-[10px]">{getInitials(profile.full_name)}</AvatarFallback>
              </Avatar>
              <span>{profile.full_name}</span>
            </div>
          </div>

          {/* Priority */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-foreground">Priority</Label>
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger className="text-sm">
                <div className="flex items-center gap-2">
                  <div
                    className="h-2.5 w-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: selectedPriorityCfg?.color ?? '#f59e0b' }}
                  />
                  <span>{selectedPriorityCfg?.name ?? priority}</span>
                </div>
              </SelectTrigger>
              <SelectContent>
                {priorities.map((p) => (
                  <SelectItem key={p.slug} value={p.slug}>
                    <div className="flex items-center gap-2">
                      <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                      {p.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="task-start" className="text-xs font-semibold text-foreground">
                Start date
              </Label>
              <Input
                id="task-start"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="text-sm"
              />
              <p className="text-[11px] text-muted-foreground leading-tight">
                Allows the planned start date to be set.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="task-due" className="text-xs font-semibold text-foreground">
                Due date
              </Label>
              <Input
                id="task-due"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="text-sm"
              />
            </div>
          </div>

          {/* Estimated hours */}
          <div className="space-y-1.5">
            <Label htmlFor="task-hours" className="text-xs font-semibold text-foreground">
              Estimated hours
            </Label>
            <Input
              id="task-hours"
              type="number"
              min="0"
              step="0.5"
              value={estimatedHours}
              onChange={(e) => setEstimatedHours(e.target.value)}
              placeholder="e.g. 4"
              className="text-sm"
            />
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="flex items-center justify-between border-t px-6 py-3 bg-muted/20 shrink-0">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <Checkbox
              id="create-another"
              checked={createAnother}
              onCheckedChange={(v) => setCreateAnother(!!v)}
            />
            <span className="text-sm text-foreground">Create another</span>
          </label>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { reset(); onOpenChange(false) }}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={submitting}
              className="min-w-[72px]"
            >
              {submitting ? 'Creating…' : 'Create'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// Small toolbar button helper
function ToolbarBtn({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <button
      type="button"
      title={title}
      className="rounded p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
      onMouseDown={(e) => e.preventDefault()} // prevent textarea blur
    >
      {icon}
    </button>
  )
}
