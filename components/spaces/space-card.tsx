'use client'

import { Building2, Users, FolderKanban, ChevronRight, MoreHorizontal, Pencil, Copy, Trash2 } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { Space } from '@/types'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'

interface SpaceCardProps {
  space: Space & {
    member_count: number
    list_count: number
  }
  onClick: () => void
  onRename: (space: Space) => void
  onClone: (space: Space) => void
  onDelete: (space: Space) => void
  canEdit?: boolean
  canDelete?: boolean
}

export function SpaceCard({
  space,
  onClick,
  onRename,
  onClone,
  onDelete,
  canEdit = false,
  canDelete = false,
}: SpaceCardProps) {
  return (
    <div className="group relative w-full rounded-xl border border-border bg-card shadow-sm text-left transition-all hover:border-blue-200 hover:shadow-md">
      {/* Clickable main area */}
      <button
        onClick={onClick}
        className="w-full p-5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 group-hover:bg-blue-100 transition-colors">
              <Building2 className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h3 className="truncate font-semibold text-foreground group-hover:text-blue-700 transition-colors">
                {space.name}
              </h3>
              {space.description && (
                <p className="mt-0.5 truncate text-sm text-muted-foreground">{space.description}</p>
              )}
            </div>
          </div>
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/70 transition-transform group-hover:translate-x-0.5 group-hover:text-blue-500 mt-1 mr-7" />
        </div>

        <div className="mt-4 flex items-center gap-4 border-t border-border/50 pt-4">
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Users className="h-4 w-4 text-muted-foreground/70" />
            <span>{space.member_count} member{space.member_count !== 1 ? 's' : ''}</span>
          </div>
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <FolderKanban className="h-4 w-4 text-muted-foreground/70" />
            <span>{space.list_count} list{space.list_count !== 1 ? 's' : ''}</span>
          </div>
          <div className="ml-auto text-xs text-muted-foreground/70">
            Created {formatDate(space.created_at)}
          </div>
        </div>
      </button>

      {/* 3-dot menu — shown only when at least one action is permitted */}
      {(canEdit || canDelete) && (
        <div className="absolute right-3 top-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground/70 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              {canEdit && (
                <>
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation()
                      onRename(space)
                    }}
                    className="gap-2"
                  >
                    <Pencil className="h-4 w-4" />
                    Rename
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation()
                      onClone(space)
                    }}
                    className="gap-2"
                  >
                    <Copy className="h-4 w-4" />
                    Clone
                  </DropdownMenuItem>
                </>
              )}
              {canEdit && canDelete && <DropdownMenuSeparator />}
              {canDelete && (
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation()
                    onDelete(space)
                  }}
                  className="gap-2 text-red-600 focus:text-red-600 focus:bg-red-50"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </div>
  )
}
