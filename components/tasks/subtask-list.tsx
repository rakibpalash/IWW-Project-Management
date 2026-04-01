'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Task, Profile } from '@/types'
import { TaskRow } from './task-row'
import { CreateTaskDialog } from './create-task-dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ChevronDown, ChevronRight, Plus, ListTree } from 'lucide-react'
import { MAX_SUBTASKS, MAX_SUBTASK_DEPTH } from '@/lib/constants'
import { cn } from '@/lib/utils'

interface SubtaskListProps {
  parentTask: Task
  subtasks: Task[]
  members: Profile[]
  profile: Profile
  onSubtaskCreated: (subtask: Task) => void
  onSubtaskUpdated: (subtask: Task) => void
}

export function SubtaskList({
  parentTask,
  subtasks,
  members,
  profile,
  onSubtaskCreated,
  onSubtaskUpdated,
}: SubtaskListProps) {
  const router = useRouter()
  const [collapsed, setCollapsed] = useState(false)
  const [showCreateDialog, setShowCreateDialog] = useState(false)

  const canAdd =
    subtasks.length < MAX_SUBTASKS &&
    (parentTask.depth ?? 0) < MAX_SUBTASK_DEPTH

  const isAdmin = profile.role === 'super_admin'
  const isCreator = parentTask.created_by === profile.id
  const isAssignee = (parentTask.assignees ?? []).some((a) => a.id === profile.id)
  const canEdit = isAdmin || isCreator || isAssignee

  const doneCount = subtasks.filter((s) => s.status === 'done').length

  function handleSubtaskCreated(subtask: Task) {
    onSubtaskCreated(subtask)
    setShowCreateDialog(false)
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <button
          className="flex items-center gap-2 text-sm font-semibold hover:text-foreground/80 transition-colors"
          onClick={() => setCollapsed((v) => !v)}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
          <ListTree className="h-4 w-4" />
          Subtasks
          {subtasks.length > 0 && (
            <Badge variant="secondary" className="text-xs">
              {doneCount}/{subtasks.length}
            </Badge>
          )}
        </button>

        {canEdit && canAdd && (
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 h-7 text-xs"
            onClick={() => setShowCreateDialog(true)}
          >
            <Plus className="h-3.5 w-3.5" />
            Add Subtask
          </Button>
        )}
      </div>

      {/* Progress bar */}
      {subtasks.length > 0 && (
        <div className="mb-3 h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all"
            style={{
              width: `${Math.round((doneCount / subtasks.length) * 100)}%`,
            }}
          />
        </div>
      )}

      {/* Subtask list */}
      {!collapsed && (
        <div>
          {subtasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 rounded-lg border border-dashed">
              <p className="text-sm text-muted-foreground">No subtasks yet.</p>
              {canEdit && canAdd && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-2 gap-1.5"
                  onClick={() => setShowCreateDialog(true)}
                >
                  <Plus className="h-4 w-4" />
                  Add first subtask
                </Button>
              )}
            </div>
          ) : (
            <div className="rounded-lg border bg-card overflow-hidden">
              {subtasks.map((subtask) => (
                <TaskRow
                  key={subtask.id}
                  task={subtask}
                  profile={profile}
                  onTaskUpdated={onSubtaskUpdated}
                  onClick={() =>
                    router.push(
                      `/projects/${parentTask.project_id}/tasks/${subtask.id}`
                    )
                  }
                  level={1}
                />
              ))}
            </div>
          )}

          {!canAdd && subtasks.length > 0 && (
            <p className="text-xs text-muted-foreground mt-2 text-center">
              {subtasks.length >= MAX_SUBTASKS
                ? `Maximum of ${MAX_SUBTASKS} subtasks reached.`
                : `Maximum subtask depth of ${MAX_SUBTASK_DEPTH} reached.`}
            </p>
          )}
        </div>
      )}

      {showCreateDialog && (
        <CreateTaskDialog
          open={showCreateDialog}
          onOpenChange={setShowCreateDialog}
          projects={parentTask.project ? [parentTask.project] : []}
          profile={profile}
          onCreated={handleSubtaskCreated}
          parentTaskId={parentTask.id}
          parentTaskDepth={parentTask.depth ?? 0}
          projectId={parentTask.project_id}
          currentSubtaskCount={subtasks.length}
        />
      )}
    </div>
  )
}
