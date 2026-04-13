// ── Permission System ─────────────────────────────────────────────────────────
// Central definitions for all resources, actions, and role default templates.

export type Resource =
  | 'spaces'
  | 'lists'
  | 'tasks'
  | 'team'
  | 'timesheet'
  | 'attendance'
  | 'leave'
  | 'settings'

export type Action =
  // General CRUD
  | 'view' | 'create' | 'edit' | 'delete'
  // Lists extra
  | 'manage_members'
  // Tasks extra
  | 'assign'
  // Team extra
  | 'invite' | 'remove'
  // Scoped view/edit
  | 'view_own' | 'view_all' | 'edit_all'
  // Leave extra
  | 'approve'
  // Settings
  | 'manage'

export type PermissionSet = Partial<Record<Resource, Action[]>>

// ── Resource + action catalogue (used to render the UI matrix) ────────────────

export interface ActionDef { key: Action; label: string }
export interface ResourceDef { key: Resource; label: string; icon: string; actions: ActionDef[] }

export const RESOURCE_DEFS: ResourceDef[] = [
  {
    key: 'spaces', label: 'Spaces', icon: 'Building2',
    actions: [
      { key: 'view',   label: 'View'   },
      { key: 'create', label: 'Create' },
      { key: 'edit',   label: 'Edit'   },
      { key: 'delete', label: 'Delete' },
    ],
  },
  {
    key: 'lists', label: 'Lists', icon: 'FolderKanban',
    actions: [
      { key: 'view',           label: 'View'            },
      { key: 'create',         label: 'Create'          },
      { key: 'edit',           label: 'Edit'            },
      { key: 'delete',         label: 'Delete'          },
      { key: 'manage_members', label: 'Manage Members'  },
    ],
  },
  {
    key: 'tasks', label: 'Tasks', icon: 'CheckSquare',
    actions: [
      { key: 'view',   label: 'View'   },
      { key: 'create', label: 'Create' },
      { key: 'edit',   label: 'Edit'   },
      { key: 'delete', label: 'Delete' },
      { key: 'assign', label: 'Assign' },
    ],
  },
  {
    key: 'team', label: 'Team', icon: 'Users',
    actions: [
      { key: 'view',   label: 'View'          },
      { key: 'invite', label: 'Invite Users'  },
      { key: 'edit',   label: 'Edit Profiles' },
      { key: 'remove', label: 'Remove Users'  },
    ],
  },
  {
    key: 'timesheet', label: 'Timesheet', icon: 'Timer',
    actions: [
      { key: 'view_own', label: 'View Own'  },
      { key: 'view_all', label: 'View All'  },
      { key: 'edit_all', label: 'Edit All'  },
    ],
  },
  {
    key: 'attendance', label: 'Attendance', icon: 'Clock',
    actions: [
      { key: 'view_own', label: 'View Own'  },
      { key: 'view_all', label: 'View All'  },
      { key: 'edit_all', label: 'Edit All'  },
    ],
  },
  {
    key: 'leave', label: 'Leave', icon: 'CalendarDays',
    actions: [
      { key: 'view_own', label: 'View Own'        },
      { key: 'view_all', label: 'View All'        },
      { key: 'approve',  label: 'Approve / Reject' },
    ],
  },
  {
    key: 'settings', label: 'Settings', icon: 'Settings',
    actions: [
      { key: 'manage', label: 'Manage Settings' },
    ],
  },
]

// ── Role default templates ─────────────────────────────────────────────────────

export const ROLE_DEFAULT_PERMISSIONS: Record<string, PermissionSet> = {
  super_admin: {
    spaces: ['view', 'create', 'edit', 'delete'],
    lists:   ['view', 'create', 'edit', 'delete', 'manage_members'],
    tasks:      ['view', 'create', 'edit', 'delete', 'assign'],
    team:       ['view', 'invite', 'edit', 'remove'],
    timesheet:  ['view_own', 'view_all', 'edit_all'],
    attendance: ['view_own', 'view_all', 'edit_all'],
    leave:      ['view_own', 'view_all', 'approve'],
    settings:   ['manage'],
  },
  account_manager: {
    spaces: ['view', 'create', 'edit'],
    lists:   ['view', 'create', 'edit', 'manage_members'],
    tasks:      ['view', 'create', 'edit', 'assign'],
    team:       ['view', 'invite', 'edit'],
    timesheet:  ['view_own', 'view_all'],
    attendance: ['view_own', 'view_all'],
    leave:      ['view_own', 'view_all', 'approve'],
    settings:   [],
  },
  project_manager: {
    spaces: ['view'],
    lists:   ['view', 'create', 'edit', 'manage_members'],
    tasks:      ['view', 'create', 'edit', 'delete', 'assign'],
    team:       ['view'],
    timesheet:  ['view_own'],
    attendance: ['view_own'],
    leave:      ['view_own', 'approve'],
    settings:   [],
  },
  staff: {
    spaces: [],
    lists:   ['view'],
    tasks:      ['view', 'create', 'edit'],
    team:       ['view'],
    timesheet:  ['view_own'],
    attendance: ['view_own'],
    leave:      ['view_own'],
    settings:   [],
  },
  client: {
    spaces: [],
    lists:   ['view'],
    tasks:      ['view'],
    team:       [],
    timesheet:  ['view_own'],
    attendance: [],
    leave:      [],
    settings:   [],
  },
  partner: {
    spaces: [],
    lists:   ['view'],
    tasks:      ['view'],
    team:       [],
    timesheet:  [],
    attendance: [],
    leave:      [],
    settings:   [],
  },
}

// ── Runtime helpers ────────────────────────────────────────────────────────────

/** Check a single permission against a PermissionSet */
export function can(perms: PermissionSet, resource: Resource, action: Action): boolean {
  return (perms[resource] ?? []).includes(action)
}

/** Return the default PermissionSet for a role (falls back to empty) */
export function defaultPermissionsForRole(role: string): PermissionSet {
  return ROLE_DEFAULT_PERMISSIONS[role] ?? {}
}

/** Deep-equal check to know if a set differs from the role default */
export function isCustomized(role: string, perms: PermissionSet): boolean {
  const def = defaultPermissionsForRole(role)
  return JSON.stringify(perms) !== JSON.stringify(def)
}
