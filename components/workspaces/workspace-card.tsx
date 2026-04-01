import { Building2, Users, FolderKanban, ChevronRight } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { Workspace } from '@/types'

interface WorkspaceCardProps {
  workspace: Workspace & {
    member_count: number
    project_count: number
  }
  onClick: () => void
}

export function WorkspaceCard({ workspace, onClick }: WorkspaceCardProps) {
  return (
    <button
      onClick={onClick}
      className="group w-full rounded-xl border border-gray-200 bg-white p-5 shadow-sm text-left transition-all hover:border-blue-200 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 group-hover:bg-blue-100 transition-colors">
            <Building2 className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h3 className="truncate font-semibold text-gray-900 group-hover:text-blue-700 transition-colors">
              {workspace.name}
            </h3>
            {workspace.description && (
              <p className="mt-0.5 truncate text-sm text-gray-500">{workspace.description}</p>
            )}
          </div>
        </div>
        <ChevronRight className="h-4 w-4 shrink-0 text-gray-400 transition-transform group-hover:translate-x-0.5 group-hover:text-blue-500 mt-1" />
      </div>

      <div className="mt-4 flex items-center gap-4 border-t border-gray-50 pt-4">
        <div className="flex items-center gap-1.5 text-sm text-gray-500">
          <Users className="h-4 w-4 text-gray-400" />
          <span>{workspace.member_count} member{workspace.member_count !== 1 ? 's' : ''}</span>
        </div>
        <div className="flex items-center gap-1.5 text-sm text-gray-500">
          <FolderKanban className="h-4 w-4 text-gray-400" />
          <span>{workspace.project_count} project{workspace.project_count !== 1 ? 's' : ''}</span>
        </div>
        <div className="ml-auto text-xs text-gray-400">
          Created {formatDate(workspace.created_at)}
        </div>
      </div>
    </button>
  )
}
