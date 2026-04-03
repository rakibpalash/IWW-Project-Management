export const APP_NAME = 'IWW Project Management'
export const APP_SHORT_NAME = 'IWW PM'

export const ROLES = {
  SUPER_ADMIN: 'super_admin',
  STAFF: 'staff',
  CLIENT: 'client',
} as const

export const PROJECT_STATUSES = [
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

const STAFF_NAV = [
  { href: '/dashboard', label: 'Dashboard', icon: 'LayoutDashboard' },
  { href: '/projects', label: 'Projects', icon: 'FolderKanban' },
  { href: '/tasks', label: 'My Tasks', icon: 'CheckSquare' },
  { href: '/attendance', label: 'Attendance', icon: 'Clock' },
  { href: '/leave', label: 'Leave', icon: 'CalendarDays' },
]

export const NAV_ITEMS: Record<string, { href: string; label: string; icon: string }[]> = {
  super_admin: [
    { href: '/dashboard', label: 'Dashboard', icon: 'LayoutDashboard' },
    { href: '/workspaces', label: 'Workspaces', icon: 'Building2' },
    { href: '/projects', label: 'Projects', icon: 'FolderKanban' },
    { href: '/tasks', label: 'My Tasks', icon: 'CheckSquare' },
    { href: '/attendance', label: 'Attendance', icon: 'Clock' },
    { href: '/leave', label: 'Leave', icon: 'CalendarDays' },
    { href: '/team', label: 'Team', icon: 'Users' },
    { href: '/settings', label: 'Settings', icon: 'Settings' },
  ],
  account_manager: STAFF_NAV,
  project_manager: STAFF_NAV,
  staff: STAFF_NAV,
  client: [
    { href: '/dashboard', label: 'Dashboard', icon: 'LayoutDashboard' },
    { href: '/projects', label: 'Projects', icon: 'FolderKanban' },
  ],
}
