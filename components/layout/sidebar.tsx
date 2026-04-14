'use client'

import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  LayoutGrid,
  CheckSquare,
  Clock,
  CalendarDays,
  Users,
  Settings,
  Timer,
  BarChart2,
  PanelLeftClose,
  PanelLeftOpen,
  X,
  ChevronDown,
  ChevronRight,
  Plus,
  ListChecks,
  CalendarClock,
  Inbox,
  MoreHorizontal,
  FolderOpen,
  CircleDot,
  Layers,
  Sliders,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Profile, Space, List, Folder } from '@/types'
import { PermissionSet, can } from '@/lib/permissions'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { createClient } from '@/lib/supabase/client'
import { CreateSpaceDialog } from '@/components/spaces/create-space-dialog'
import { CreateListDialog } from '@/components/lists/create-list-dialog'
import { CreateTaskDialog } from '@/components/tasks/create-task-dialog'
import { CreateFolderDialog } from '@/components/folders/create-folder-dialog'
import { getSidebarDataAction } from '@/app/actions/sidebar'

// ─── constants ─────────────────────────────────────────────────────────────────

const ROLE_LABELS: Record<Profile['role'], string> = {
  super_admin:     'CEO',
  account_manager: 'Org Admin',
  project_manager: 'Team Lead',
  staff:           'Staff',
  client:          'Client',
  partner:         'Partner',
}

const SPACE_COLORS = [
  '#7c3aed','#0891b2','#0284c7','#059669',
  '#d97706','#dc2626','#db2777','#4f46e5',
]
function getSpaceColor(id: string) {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return SPACE_COLORS[h % SPACE_COLORS.length]
}
function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
}

// ─── add menu popup (portal) ───────────────────────────────────────────────────

interface AddMenuItem {
  icon: React.ElementType
  label: string
  description: string
  onClick: () => void
}

function AddMenuPortal({
  anchorRef,
  items,
  onClose,
}: {
  anchorRef: React.RefObject<HTMLButtonElement>
  items: AddMenuItem[]
  onClose: () => void
}) {
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null)

  useEffect(() => {
    if (anchorRef.current) {
      const r = anchorRef.current.getBoundingClientRect()
      setCoords({ top: r.bottom + 4, left: r.left })
    }
  }, [anchorRef])

  useEffect(() => {
    function handler(e: MouseEvent) {
      onClose()
    }
    // small delay so the open click doesn't immediately close it
    const t = setTimeout(() => document.addEventListener('mousedown', handler), 50)
    return () => { clearTimeout(t); document.removeEventListener('mousedown', handler) }
  }, [onClose])

  if (!coords || typeof document === 'undefined') return null

  return createPortal(
    <div
      style={{ position: 'fixed', top: coords.top, left: coords.left, zIndex: 9999 }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="w-56 rounded-xl bg-[#1e2130] border border-white/10 shadow-2xl overflow-hidden py-1.5">
        <p className="px-3 pt-1 pb-2 text-[10px] font-bold uppercase tracking-widest text-sidebar-foreground/35">
          Create
        </p>
        {items.map((item) => (
          <button
            key={item.label}
            onClick={item.onClick}
            className="flex w-full items-start gap-3 px-3 py-2 hover:bg-white/8 transition-colors text-left"
          >
            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/8 border border-white/10">
              <item.icon className="h-3.5 w-3.5 text-sidebar-foreground/70" />
            </span>
            <span className="min-w-0">
              <p className="text-[13px] font-semibold text-white leading-tight">{item.label}</p>
              <p className="text-[11px] text-sidebar-foreground/40 leading-tight mt-0.5">{item.description}</p>
            </span>
          </button>
        ))}
      </div>
    </div>,
    document.body
  )
}

// ─── spaces header dropdown (portal) ──────────────────────────────────────────

function SpacesMenuPortal({
  anchorRef,
  onClose,
  onCreateSpace,
  onManageSpaces,
}: {
  anchorRef: React.RefObject<HTMLButtonElement>
  onClose: () => void
  onCreateSpace: () => void
  onManageSpaces: () => void
}) {
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null)

  useEffect(() => {
    if (anchorRef.current) {
      const r = anchorRef.current.getBoundingClientRect()
      setCoords({ top: r.bottom + 4, left: r.left })
    }
  }, [anchorRef])

  useEffect(() => {
    function handler() { onClose() }
    const t = setTimeout(() => document.addEventListener('mousedown', handler), 50)
    return () => { clearTimeout(t); document.removeEventListener('mousedown', handler) }
  }, [onClose])

  if (!coords || typeof document === 'undefined') return null

  const items = [
    { label: 'Create Space',  icon: Layers,  onClick: onCreateSpace },
    { label: 'Manage Spaces', icon: Sliders, onClick: onManageSpaces },
  ]

  return createPortal(
    <div
      style={{ position: 'fixed', top: coords.top, left: coords.left, zIndex: 9999 }}
      onMouseDown={e => e.stopPropagation()}
    >
      <div className="w-44 rounded-xl bg-[#1e2130] border border-white/10 shadow-2xl overflow-hidden py-1">
        {items.map(item => (
          <button
            key={item.label}
            onClick={item.onClick}
            className="flex w-full items-center gap-2.5 px-3 py-2 hover:bg-white/8 transition-colors text-left"
          >
            <item.icon className="h-3.5 w-3.5 text-sidebar-foreground/60 shrink-0" />
            <span className="text-[13px] font-semibold text-white">{item.label}</span>
          </button>
        ))}
      </div>
    </div>,
    document.body
  )
}

// ─── nav item ──────────────────────────────────────────────────────────────────

function NavItem({
  href,
  icon: Icon,
  label,
  active,
  onClick,
  indent = false,
}: {
  href: string
  icon: React.ElementType
  label: string
  active: boolean
  onClick: () => void
  indent?: boolean
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        'group relative flex items-center gap-2.5 rounded-lg transition-colors select-none',
        indent ? 'pl-8 pr-3 py-1.5' : 'px-2 py-1.5',
        active
          ? 'bg-sidebar-primary/15 text-white'
          : 'text-sidebar-foreground/60 hover:bg-white/5 hover:text-sidebar-foreground/90',
      )}
    >
      {/* Left active bar */}
      {active && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-[18px] rounded-r-full bg-sidebar-primary" />
      )}
      <Icon className={cn(
        'shrink-0 transition-colors',
        indent ? 'h-[15px] w-[15px]' : 'h-[17px] w-[17px]',
        active
          ? 'text-sidebar-primary'
          : 'text-sidebar-foreground/40 group-hover:text-sidebar-foreground/70',
      )} />
      <span className={cn(
        'truncate font-semibold leading-tight',
        indent ? 'text-[12px]' : 'text-[13px]',
        active ? 'text-white' : '',
      )}>
        {label}
      </span>
    </Link>
  )
}

// ─── folder item ───────────────────────────────────────────────────────────────

function FolderItem({
  folder,
  lists,
  pathname,
  onClose,
  onCreateTask,
  onCreateList,
}: {
  folder: Folder
  lists: List[]
  pathname: string
  onClose: () => void
  onCreateTask: (listId: string) => void
  onCreateList: (folderId: string) => void
}) {
  const hasActiveList = lists.some(p => pathname.startsWith(`/lists/${p.id}`))
  const [open, setOpen] = useState(true)

  useEffect(() => {
    if (hasActiveList) setOpen(true)
  }, [hasActiveList])

  return (
    <div>
      <div className="group/folder flex w-full items-center gap-1 rounded-lg px-2 py-1 transition-colors hover:bg-white/5 pl-3">
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          className="shrink-0 flex items-center justify-center h-5 w-5 rounded text-sidebar-foreground/40 hover:text-white transition-colors"
        >
          <ChevronDown className={cn('h-3 w-3 transition-transform duration-150', open ? 'rotate-0' : '-rotate-90')} />
        </button>
        <FolderOpen className="h-3.5 w-3.5 shrink-0 text-sidebar-foreground/40 group-hover/folder:text-sidebar-foreground/70" />
        <Link
          href={`/folders/${folder.id}`}
          onClick={onClose}
          className="flex-1 truncate text-[12px] font-semibold text-sidebar-foreground/60 group-hover/folder:text-sidebar-foreground/85 pl-1 hover:text-white transition-colors"
        >
          {folder.name}
        </Link>
        <span className="flex items-center gap-0.5 opacity-0 group-hover/folder:opacity-100 transition-opacity shrink-0">
          <button
            onClick={() => onCreateList(folder.id)}
            className="h-4 w-4 flex items-center justify-center rounded text-sidebar-foreground/40 hover:text-white hover:bg-white/10 transition-colors"
          >
            <Plus className="h-3 w-3" />
          </button>
        </span>
      </div>
      {open && (
        <div>
          {lists.length === 0 ? (
            <p className="py-1 text-[11px] text-sidebar-foreground/25 font-medium pl-14 pr-3">Empty folder</p>
          ) : (
            lists.map(proj => {
              const active = pathname.startsWith(`/lists/${proj.id}`)
              return (
                <div key={proj.id} className="group/list relative flex items-center rounded-lg transition-colors hover:bg-white/5">
                  <Link
                    href={`/lists/${proj.id}`}
                    onClick={onClose}
                    className={cn(
                      'flex items-center gap-2 flex-1 min-w-0 py-1.5 pl-12 pr-2',
                      active ? 'text-white' : 'text-sidebar-foreground/55 hover:text-sidebar-foreground/85',
                    )}
                  >
                    {active && (
                      <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-[16px] rounded-r-full bg-sidebar-primary" />
                    )}
                    <ListChecks className={cn(
                      'h-[13px] w-[13px] shrink-0',
                      active ? 'text-sidebar-primary' : 'text-sidebar-foreground/30 group-hover/list:text-sidebar-foreground/60',
                    )} />
                    <span className="truncate text-[11px] font-semibold">{proj.name}</span>
                  </Link>
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}

// ─── space item ────────────────────────────────────────────────────────────────

function SpaceItem({
  space,
  lists,
  folders,
  pathname,
  onClose,
  onCreateList,
  onCreateTask,
  onCreateFolder,
}: {
  space: Space
  lists: List[]
  folders: Folder[]
  pathname: string
  onClose: () => void
  onCreateList: (spaceId: string, folderId?: string) => void
  onCreateTask: (listId: string) => void
  onCreateFolder: (spaceId: string) => void
}) {
  const hasActiveList = lists.some(p => pathname.startsWith(`/lists/${p.id}`))
  const [open, setOpen] = useState(true)
  const [spaceMenuOpen, setSpaceMenuOpen] = useState(false)
  const [listMenuOpen, setListMenuOpen] = useState<string | null>(null)
  const spacePlusBtnRef = useRef<HTMLButtonElement>(null)
  const listPlusBtnRefs = useRef<Record<string, HTMLButtonElement | null>>({})

  useEffect(() => {
    if (hasActiveList) setOpen(true)
  }, [hasActiveList])

  const color = getSpaceColor(space.id)
  const initial = space.name.slice(0, 1).toUpperCase()

  return (
    <div>
      {/* Space row */}
      <div className="group flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-white/5">

        {/* Colored badge — pure display element, no hover/focus effects */}
        <span
          className="shrink-0 flex h-7 w-7 items-center justify-center rounded-md text-[12px] font-black text-white leading-none select-none pointer-events-none"
          style={{ backgroundColor: color }}
          aria-hidden
        >
          {initial}
        </span>

        {/* Name — clicking navigates to space detail; chevron toggles collapse */}
        <Link
          href={`/spaces/${space.id}`}
          onClick={onClose}
          className="flex-1 min-w-0 truncate text-[13px] font-semibold text-sidebar-foreground/80 group-hover:text-white transition-colors"
        >
          {space.name}
        </Link>
        <button
          type="button"
          onClick={(e) => { e.preventDefault(); setOpen(o => !o) }}
          className="shrink-0 flex items-center justify-center h-5 w-5 rounded text-sidebar-foreground/30 hover:text-white hover:bg-white/10 transition-colors opacity-0 group-hover:opacity-100"
        >
          <ChevronDown
            className={cn(
              'h-3 w-3 transition-transform duration-150',
              open ? 'rotate-0' : '-rotate-90'
            )}
          />
        </button>

        {/* Actions: ... and + */}
        <span className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <button className="h-5 w-5 flex items-center justify-center rounded text-sidebar-foreground/40 hover:text-white hover:bg-white/10 transition-colors">
            <MoreHorizontal className="h-3.5 w-3.5" />
          </button>
          {/* Space + button with portal popup */}
          <button
            ref={spacePlusBtnRef}
            onClick={(e) => { e.stopPropagation(); setSpaceMenuOpen(o => !o) }}
            className="h-5 w-5 flex items-center justify-center rounded text-sidebar-foreground/40 hover:text-white hover:bg-white/10 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
          {spaceMenuOpen && (
            <AddMenuPortal
              anchorRef={spacePlusBtnRef}
              onClose={() => setSpaceMenuOpen(false)}
              items={[
                { icon: ListChecks, label: 'List', description: 'Track tasks, lists, people & more', onClick: () => { setSpaceMenuOpen(false); onCreateList(space.id) } },
                { icon: FolderOpen, label: 'Folder', description: 'Group Lists & more', onClick: () => { setSpaceMenuOpen(false); onCreateFolder(space.id) } },
              ]}
            />
          )}
        </span>
      </div>

      {/* Lists + Folders */}
      {open && (
        <div className="pb-0.5">
          {/* Folders */}
          {folders.map(folder => {
            const folderLists = lists.filter(p => (p as any).folder_id === folder.id)
            return (
              <FolderItem
                key={folder.id}
                folder={folder}
                lists={folderLists}
                pathname={pathname}
                onClose={onClose}
                onCreateTask={onCreateTask}
                onCreateList={(folderId) => onCreateList(space.id, folderId)}
              />
            )
          })}
          {/* Unfiled lists */}
          {lists
            .filter(p => !(p as any).folder_id || !folders.find(f => f.id === (p as any).folder_id))
            .map(proj => {
              const active = pathname.startsWith(`/lists/${proj.id}`)
              return (
                <div key={proj.id} className="group/list relative flex items-center rounded-lg transition-colors hover:bg-white/5">
                  <Link
                    href={`/lists/${proj.id}`}
                    onClick={onClose}
                    className={cn(
                      'flex items-center gap-2 flex-1 min-w-0 py-1.5 pl-9 pr-2',
                      active ? 'text-white' : 'text-sidebar-foreground/55 hover:text-sidebar-foreground/85',
                    )}
                  >
                    {active && (
                      <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-[16px] rounded-r-full bg-sidebar-primary" />
                    )}
                    <ListChecks className={cn(
                      'h-[14px] w-[14px] shrink-0',
                      active ? 'text-sidebar-primary' : 'text-sidebar-foreground/30 group-hover/list:text-sidebar-foreground/60',
                    )} />
                    <span className="truncate text-[12px] font-semibold">{proj.name}</span>
                  </Link>
                  <span className="flex items-center gap-0.5 opacity-0 group-hover/list:opacity-100 transition-opacity pr-2 shrink-0">
                    <button className="h-4 w-4 flex items-center justify-center rounded text-sidebar-foreground/40 hover:text-white hover:bg-white/10 transition-colors">
                      <MoreHorizontal className="h-3 w-3" />
                    </button>
                    {/* List + button with portal popup */}
                    <button
                      ref={el => { listPlusBtnRefs.current[proj.id] = el }}
                      onClick={(e) => { e.stopPropagation(); setListMenuOpen(o => o === proj.id ? null : proj.id) }}
                      className="h-4 w-4 flex items-center justify-center rounded text-sidebar-foreground/40 hover:text-white hover:bg-white/10 transition-colors"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                    {listMenuOpen === proj.id && listPlusBtnRefs.current[proj.id] && (
                      <AddMenuPortal
                        anchorRef={{ current: listPlusBtnRefs.current[proj.id] } as React.RefObject<HTMLButtonElement>}
                        onClose={() => setListMenuOpen(null)}
                        items={[
                          { icon: CircleDot, label: 'Task', description: 'Create individual tasks to manage your work', onClick: () => { setListMenuOpen(null); onCreateTask(proj.id) } },
                          { icon: ListChecks, label: 'List', description: 'Track tasks, lists, people & more', onClick: () => { setListMenuOpen(null); onCreateList(space.id) } },
                        ]}
                      />
                    )}
                  </span>
                </div>
              )
            })
          }
          {lists.length === 0 && folders.length === 0 && (
            <p className="py-1.5 text-[12px] text-sidebar-foreground/25 font-medium pl-9 pr-3">
              No lists yet
            </p>
          )}
        </div>
      )}
    </div>
  )
}

// ─── props ─────────────────────────────────────────────────────────────────────

interface SidebarProps {
  profile: Profile
  permissions?: PermissionSet
  initialSpaces?: Space[]
  initialLists?: List[]
  isOpen: boolean
  isCollapsed: boolean
  onClose: () => void
  onToggleCollapse: () => void
}

// ─── component ─────────────────────────────────────────────────────────────────

export function Sidebar({ profile, permissions, initialSpaces = [], initialLists = [], isOpen, isCollapsed, onClose, onToggleCollapse }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  const [spaces,        setSpaces]        = useState<Space[]>(initialSpaces)
  const [lists,          setLists]          = useState<List[]>(initialLists)
  const [folders,        setFolders]        = useState<Folder[]>([])
  const [showCreateSpace,     setShowCreateSpace]     = useState(false)
  const [staffProfiles,       setStaffProfiles]       = useState<Profile[]>([])
  const [spacesAddMenuOpen,   setSpacesAddMenuOpen]   = useState(false)
  const spacesAddBtnRef = useRef<HTMLButtonElement>(null)
  const [showCreateList,    setShowCreateList]    = useState(false)
  const [createListSpaceId, setCreateListSpaceId] = useState<string | null>(null)
  const [createListFolderId, setCreateListFolderId] = useState<string | null>(null)
  const [showCreateTask,    setShowCreateTask]    = useState(false)
  const [createTaskListId,  setCreateTaskListId]  = useState<string | null>(null)
  const [showCreateFolder,  setShowCreateFolder]  = useState(false)
  const [createFolderSpaceId, setCreateFolderSpaceId] = useState<string | null>(null)

  // Server-action-based fetch — uses admin client, bypasses RLS restrictions
  async function fetchSidebarData() {
    const { spaces: ws, lists: proj, folders: fols } = await getSidebarDataAction()
    if (ws.length > 0 || proj.length > 0 || fols.length > 0) {
      setSpaces(ws)
      setLists(proj)
      setFolders(fols)
    }
  }

  // Refetch on every route change — catches list creation, deletion, rename
  useEffect(() => {
    fetchSidebarData()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  // Real-time subscription for instant in-page updates (no navigation needed)
  useEffect(() => {
    const channel = supabase
      .channel('sidebar-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lists' },
        () => { fetchSidebarData() }
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'spaces' },
        () => { fetchSidebarData() }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function openCreateList(spaceId: string, folderId?: string) {
    setCreateListSpaceId(spaceId)
    setCreateListFolderId(folderId ?? null)
    setShowCreateList(true)
  }

  function openCreateTask(listId: string) {
    setCreateTaskListId(listId)
    setShowCreateTask(true)
  }

  function openCreateFolder(spaceId: string) {
    setCreateFolderSpaceId(spaceId)
    setShowCreateFolder(true)
  }

  function openCreateSpace() {
    if (staffProfiles.length === 0) {
      supabase.from('profiles')
        .select('id, full_name, email, avatar_url, role, is_temp_password, onboarding_completed, created_at, updated_at')
        .neq('role', 'client')
        .order('full_name')
        .then(({ data }) => setStaffProfiles((data as Profile[]) ?? []))
    }
    setShowCreateSpace(true)
  }

  const permsLoaded    = permissions && Object.keys(permissions).length > 0
  const showTimesheet  = !permsLoaded || can(permissions!, 'timesheet',  'view_own') || can(permissions!, 'timesheet',  'view_all')
  const showAttendance = !permsLoaded || can(permissions!, 'attendance', 'view_own') || can(permissions!, 'attendance', 'view_all')
  const showLeave      = !permsLoaded || can(permissions!, 'leave',      'view_own') || can(permissions!, 'leave',      'view_all')
  const showTeam       = !permsLoaded || can(permissions!, 'team',       'view')
  const showReports    = !permsLoaded || can(permissions!, 'settings',   'manage')
  const showSettings   = !permsLoaded || can(permissions!, 'settings',   'manage')

  return (
    <TooltipProvider delayDuration={0}>
      {isOpen && (
        <div className="fixed inset-0 z-20 bg-black/60 backdrop-blur-sm lg:hidden" onClick={onClose} aria-hidden />
      )}

      <aside className={cn(
        'fixed inset-y-0 left-0 z-30 flex flex-col',
        'bg-sidebar border-r border-sidebar-border',
        'transition-all duration-300 ease-in-out',
        'lg:relative lg:translate-x-0',
        isCollapsed ? 'lg:w-[60px]' : 'lg:w-[240px]',
        isOpen ? 'translate-x-0 w-[240px] shadow-2xl' : '-translate-x-full w-[240px] lg:translate-x-0',
      )}>


        {/* ── Logo bar ── */}
        <div className={cn(
          'flex h-11 shrink-0 items-center border-b border-sidebar-border',
          isCollapsed ? 'lg:justify-center px-2' : 'px-4 gap-3',
        )}>
          {/* Logo badge */}
          <Link href="/dashboard" onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sidebar-primary text-white text-[15px] font-black select-none shadow-lg shadow-sidebar-primary/30">
            IW
          </Link>

          {!isCollapsed && (
            <>
              <p className="flex-1 text-[15px] font-bold text-white leading-none truncate">IWW PM</p>
              <div className="flex items-center gap-1">
                <button onClick={onToggleCollapse}
                  className="hidden lg:flex h-7 w-7 items-center justify-center rounded-md text-sidebar-foreground/30 hover:bg-white/10 hover:text-white transition-colors"
                  aria-label="Collapse">
                  <PanelLeftClose className="h-4 w-4" />
                </button>
                <button onClick={onClose}
                  className="lg:hidden h-7 w-7 flex items-center justify-center rounded-md text-sidebar-foreground/40 hover:bg-white/10 hover:text-white transition-colors">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </>
          )}

          {isCollapsed && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button onClick={onToggleCollapse}
                  className="hidden lg:flex h-7 w-7 items-center justify-center rounded-md text-sidebar-foreground/30 hover:bg-white/10 hover:text-white transition-colors">
                  <PanelLeftOpen className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" className="text-xs">Expand</TooltipContent>
            </Tooltip>
          )}
        </div>

        {/* ── Scrollable nav ── */}
        <nav className="flex-1 overflow-y-auto scrollbar-hide" data-tour="sidebar-nav">

          {/* ────── COLLAPSED icon strip ────── */}
          {isCollapsed && (
            <div className="flex flex-col items-center gap-1 py-3 px-2">
              {[
                { href: '/dashboard',    Icon: LayoutGrid,   label: 'Home' },
                { href: '/notifications',Icon: Inbox,        label: 'Inbox' },
                { href: '/tasks',        Icon: CheckSquare,  label: 'My Tasks' },
                { href: '/timesheet',    Icon: Timer,        label: 'Timesheet' },
                { href: '/attendance',   Icon: Clock,        label: 'Attendance' },
                { href: '/leave',        Icon: CalendarDays, label: 'Leave' },
                { href: '/team',         Icon: Users,        label: 'Team' },
                { href: '/reports',      Icon: BarChart2,    label: 'Reports' },
                { href: '/settings',     Icon: Settings,     label: 'Settings' },
              ].map(({ href, Icon, label }) => {
                const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
                return (
                  <Tooltip key={href}>
                    <TooltipTrigger asChild>
                      <Link href={href} onClick={onClose}
                        className={cn(
                          'flex h-10 w-10 items-center justify-center rounded-lg transition-colors relative',
                          active ? 'bg-sidebar-primary/20 text-sidebar-primary' : 'text-sidebar-foreground/45 hover:bg-white/8 hover:text-white'
                        )}>
                        {active && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-sidebar-primary" />}
                        <Icon className="h-5 w-5" />
                      </Link>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="text-xs font-medium">{label}</TooltipContent>
                  </Tooltip>
                )
              })}
            </div>
          )}

          {/* ────── EXPANDED layout ────── */}
          {!isCollapsed && (
            <div className="px-2 py-2 space-y-0.5">

              {/* Home */}
              <NavItem href="/dashboard" icon={LayoutGrid} label="Dashboard"
                active={pathname === '/dashboard'} onClick={onClose} />

              {/* ── MY WORK ── */}
              <div className="pt-2.5">
                <div className="px-1 mb-1">
                  <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-sidebar-foreground/30">
                    My Work
                  </span>
                </div>
                <div className="space-y-0.5">
                  <NavItem href="/tasks"              icon={CheckSquare}   label="My Tasks"        active={pathname === '/tasks' && !searchParams.get('filter')} onClick={onClose} indent />
                  <NavItem href="/tasks?filter=today" icon={CalendarClock} label="Today & Overdue" active={pathname === '/tasks' && searchParams.get('filter') === 'today'} onClick={onClose} indent />
                  {showTimesheet && <NavItem href="/timesheet" icon={Timer} label="Timesheet" active={pathname.startsWith('/timesheet')} onClick={onClose} indent />}
                </div>
              </div>

              {/* ── SPACES ── */}
              <div className="pt-2.5">
                <div className="flex items-center justify-between px-1 mb-1">
                  <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-sidebar-foreground/30">
                    Spaces
                  </span>
                  <span className="flex items-center gap-0.5">
                    {/* ... → dropdown with Create Space / Manage Spaces */}
                    <button
                      ref={spacesAddBtnRef}
                      onClick={e => { e.stopPropagation(); setSpacesAddMenuOpen(o => !o) }}
                      className="flex h-4 w-4 items-center justify-center rounded text-sidebar-foreground/30 hover:text-white hover:bg-white/10 transition-colors"
                      title="Space options"
                    >
                      <MoreHorizontal className="h-3 w-3" />
                    </button>
                    {spacesAddMenuOpen && (
                      <SpacesMenuPortal
                        anchorRef={spacesAddBtnRef}
                        onClose={() => setSpacesAddMenuOpen(false)}
                        onCreateSpace={() => { setSpacesAddMenuOpen(false); openCreateSpace() }}
                        onManageSpaces={() => { setSpacesAddMenuOpen(false); router.push('/spaces') }}
                      />
                    )}
                    {/* + → directly opens Create Space modal */}
                    <button
                      onClick={openCreateSpace}
                      className="flex h-4 w-4 items-center justify-center rounded text-sidebar-foreground/30 hover:text-white hover:bg-white/10 transition-colors"
                      title="Create Space"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  </span>
                </div>

                <div className="space-y-0.5">
                  {/* All Tasks */}
                  <Link href="/tasks" onClick={onClose} className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-white/5 transition-colors text-sidebar-foreground/60 hover:text-sidebar-foreground/90">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-sidebar-foreground/15">
                      <CheckSquare className="h-4 w-4 text-sidebar-foreground/50" />
                    </span>
                    <span className="truncate text-[13px] font-semibold">All Tasks</span>
                  </Link>

                  {/* Space items */}
                  {spaces.map(ws => (
                    <SpaceItem
                      key={ws.id}
                      space={ws}
                      lists={lists.filter(p => (p.space_id ?? (p as any).workspace_id) === ws.id)}
                      folders={folders.filter(f => f.space_id === ws.id)}
                      pathname={pathname}
                      onClose={onClose}
                      onCreateList={openCreateList}
                      onCreateTask={openCreateTask}
                      onCreateFolder={openCreateFolder}
                    />
                  ))}

                  {/* New Space */}
                  <button
                    onClick={openCreateSpace}
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-[12px] font-semibold text-sidebar-foreground/35 hover:text-sidebar-foreground/70 hover:bg-white/5 transition-colors mt-1"
                  >
                    <Plus className="h-[14px] w-[14px] shrink-0" />
                    <span>New Space</span>
                  </button>
                </div>
              </div>

              {/* ── TEAM & HR ── */}
              {(showAttendance || showLeave || showTeam) && (
                <div className="pt-2.5">
                  <div className="px-1 mb-1">
                    <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-sidebar-foreground/30">
                      Team &amp; HR
                    </span>
                  </div>
                  <div className="space-y-0.5">
                    {showAttendance && <NavItem href="/attendance" icon={Clock}        label="Attendance" active={pathname.startsWith('/attendance')} onClick={onClose} indent />}
                    {showLeave      && <NavItem href="/leave"      icon={CalendarDays} label="Leave"      active={pathname.startsWith('/leave')}      onClick={onClose} indent />}
                    {showTeam       && <NavItem href="/team"       icon={Users}        label="Team"       active={pathname.startsWith('/team')}       onClick={onClose} indent />}
                  </div>
                </div>
              )}

              {/* ── Reports + Settings ── */}
              <div className="pt-2.5 space-y-0.5">
                {showReports  && <NavItem href="/reports"  icon={BarChart2} label="Reports"  active={pathname.startsWith('/reports')}  onClick={onClose} />}
                {showSettings && <NavItem href="/settings" icon={Settings}  label="Settings" active={pathname.startsWith('/settings')} onClick={onClose} />}
              </div>

            </div>
          )}
        </nav>

        {/* ── User footer ── */}
        <div className={cn(
          'shrink-0 border-t border-sidebar-border',
          isCollapsed ? 'p-2 flex justify-center' : 'p-3',
        )}>
          {isCollapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Link href="/settings/profile"
                  className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-white/10 transition-colors">
                  <Avatar className="h-7 w-7">
                    <AvatarImage src={profile.avatar_url ?? undefined} />
                    <AvatarFallback className="bg-sidebar-primary text-white text-[11px] font-bold">
                      {getInitials(profile.full_name)}
                    </AvatarFallback>
                  </Avatar>
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right">
                <p className="font-semibold">{profile.full_name}</p>
                <p className="text-xs text-muted-foreground">{ROLE_LABELS[profile.role]}</p>
              </TooltipContent>
            </Tooltip>
          ) : (
            <Link href="/settings/profile"
              className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-white/8 transition-colors">
              <Avatar className="h-8 w-8 shrink-0">
                <AvatarImage src={profile.avatar_url ?? undefined} />
                <AvatarFallback className="bg-sidebar-primary text-white text-[11px] font-bold">
                  {getInitials(profile.full_name)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-bold text-white leading-tight">{profile.full_name}</p>
                <p className="truncate text-[11px] text-sidebar-foreground/45 leading-tight mt-0.5">{ROLE_LABELS[profile.role]}</p>
              </div>
            </Link>
          )}
        </div>
      </aside>

      {/* ── Create Space Dialog ── */}
      <CreateSpaceDialog
        open={showCreateSpace}
        onOpenChange={setShowCreateSpace}
        staffProfiles={staffProfiles}
        onSuccess={(newWs) => {
          setSpaces(prev => [...prev, { ...newWs }])
          setShowCreateSpace(false)
        }}
      />

      {/* ── Create List Dialog ── */}
      <CreateListDialog
        open={showCreateList}
        onOpenChange={(v) => { setShowCreateList(v); if (!v) { setCreateListSpaceId(null); setCreateListFolderId(null) } }}
        spaces={spaces}
        folders={folders}
        defaultSpaceId={createListFolderId ? null : createListSpaceId}
        defaultFolderId={createListFolderId}
        onCreated={(newList) => {
          setLists(prev => [...prev, newList].sort((a, b) => a.name.localeCompare(b.name)))
          setShowCreateList(false)
        }}
        profile={profile}
      />

      {/* ── Create Task Dialog ── */}
      {showCreateTask && createTaskListId && (
        <CreateTaskDialog
          open={showCreateTask}
          onOpenChange={setShowCreateTask}
          lists={lists}
          profile={profile}
          listId={createTaskListId}
          onCreated={() => { setShowCreateTask(false) }}
        />
      )}

      {/* ── Create Folder Dialog ── */}
      {showCreateFolder && createFolderSpaceId && (
        <CreateFolderDialog
          open={showCreateFolder}
          spaceId={createFolderSpaceId}
          onOpenChange={setShowCreateFolder}
          onCreated={(folder) => {
            setFolders(prev => [...prev, folder])
          }}
        />
      )}
    </TooltipProvider>
  )
}
