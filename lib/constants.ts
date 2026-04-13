export const APP_NAME = 'IWW List Management'
export const APP_SHORT_NAME = 'IWW PM'

export const ROLES = {
  SUPER_ADMIN: 'super_admin',
  ORG_ADMIN: 'account_manager',
  TEAM_LEAD: 'project_manager',
  STAFF: 'staff',
  CLIENT: 'client',
} as const

export const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super Admin',
  account_manager: 'Org Admin',
  project_manager: 'Team Lead',
  staff: 'Staff',
  client: 'Client',
  partner: 'Partner',
}

export const LIST_STATUSES = [
  { value: 'planning', label: 'Planning' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'on_hold', label: 'On Hold' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
]

export const TASK_STATUSES = [
  { value: 'todo', label: 'To Do' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'in_review', label: 'In Review' },
  { value: 'done', label: 'Done' },
  { value: 'cancelled', label: 'Cancelled' },
]

export const PRIORITIES = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
]

export const LEAVE_TYPES = [
  { value: 'yearly', label: 'Yearly Leave' },
  { value: 'work_from_home', label: 'Work From Home' },
  { value: 'marriage', label: 'Marriage Leave' },
]

export const ATTENDANCE_STATUSES = [
  { value: 'on_time', label: 'On Time' },
  { value: 'late_150', label: 'Late (150%)' },
  { value: 'late_250', label: 'Late (250%)' },
  { value: 'absent', label: 'Absent' },
  { value: 'advance_absence', label: 'Advance Absence' },
]

export const MAX_SUBTASKS = 10
export const MAX_SUBTASK_DEPTH = 2

export const DEFAULT_ATTENDANCE_SETTINGS = {
  on_time_end: '09:00',
  late_150_end: '09:30',
  late_250_end: '11:00',
  football_on_time_end: '09:45',
  football_late_150_end: '10:30',
  football_late_250_end: '11:00',
  yearly_leave_days: 18,
  wfh_days: 10,
}

// Staff, Team Lead — no space visibility, task-focused
const STAFF_NAV = [
  { href: '/dashboard', label: 'Dashboard', icon: 'LayoutDashboard' },
  { href: '/lists', label: 'Lists', icon: 'FolderKanban' },
  { href: '/tasks', label: 'My Tasks', icon: 'CheckSquare' },
  { href: '/timesheet', label: 'Timesheet', icon: 'Timer' },
  { href: '/attendance', label: 'Attendance', icon: 'Clock' },
  { href: '/leave', label: 'Leave', icon: 'CalendarDays' },
]

// Org Admin — sees spaces for org oversight, but no Team/Settings management
const ORG_ADMIN_NAV = [
  { href: '/dashboard', label: 'Dashboard', icon: 'LayoutDashboard' },
  { href: '/spaces', label: 'Spaces', icon: 'Building2' },
  { href: '/lists', label: 'Lists', icon: 'FolderKanban' },
  { href: '/tasks', label: 'My Tasks', icon: 'CheckSquare' },
  { href: '/timesheet', label: 'Timesheet', icon: 'Timer' },
  { href: '/attendance', label: 'Attendance', icon: 'Clock' },
  { href: '/leave', label: 'Leave', icon: 'CalendarDays' },
]

export const NAV_ITEMS: Record<string, { href: string; label: string; icon: string }[]> = {
  super_admin: [
    { href: '/dashboard', label: 'Dashboard', icon: 'LayoutDashboard' },
    { href: '/spaces', label: 'Spaces', icon: 'Building2' },
    { href: '/lists', label: 'Lists', icon: 'FolderKanban' },
    { href: '/tasks', label: 'My Tasks', icon: 'CheckSquare' },
    { href: '/timesheet', label: 'Timesheet', icon: 'Timer' },
    { href: '/attendance', label: 'Attendance', icon: 'Clock' },
    { href: '/leave', label: 'Leave', icon: 'CalendarDays' },
    { href: '/team', label: 'Team', icon: 'Users' },
    { href: '/reports', label: 'Reports', icon: 'BarChart2' },
    { href: '/settings', label: 'Settings', icon: 'Settings' },
  ],
  account_manager: ORG_ADMIN_NAV,  // Org Admin sees spaces
  project_manager: STAFF_NAV,       // Team Lead: task-focused, no spaces
  staff: STAFF_NAV,                 // Staff: task-focused, no spaces
  client: [
    { href: '/dashboard', label: 'Dashboard', icon: 'LayoutDashboard' },
    { href: '/lists', label: 'Lists', icon: 'FolderKanban' },
  ],
  partner: [
    { href: '/dashboard', label: 'Dashboard', icon: 'LayoutDashboard' },
    { href: '/lists', label: 'Lists', icon: 'FolderKanban' },
  ],
}
