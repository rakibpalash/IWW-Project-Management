export type Role = 'super_admin' | 'account_manager' | 'project_manager' | 'staff' | 'client' | 'partner'

export type ProjectStatus = 'planning' | 'in_progress' | 'on_hold' | 'completed' | 'cancelled'
export type Priority = 'low' | 'medium' | 'high' | 'urgent'
export type TaskStatus = 'todo' | 'in_progress' | 'in_review' | 'done' | 'cancelled'
export type BillingType = 'hourly' | 'fixed' | 'retainer' | 'non_billable'
export type ApprovalStatus = 'pending' | 'approved' | 'rejected'
export type AttendanceStatus = 'on_time' | 'late_150' | 'late_250' | 'absent' | 'advance_absence'
export type AppliedRule = 'general' | 'friday' | 'football' | 'holiday'
export type DayType = 'sunday' | 'friday' | 'general'
export type LeaveType = 'yearly' | 'work_from_home' | 'marriage' | 'optional'
export type LeaveStatus = 'pending' | 'approved' | 'rejected' | 'cancelled'

export interface CustomRole {
  id: string
  name: string
  color: string
  description?: string
  created_by?: string
  created_at: string
}

export interface Profile {
  id: string
  email: string
  full_name: string
  avatar_url: string | null
  role: Role
  is_temp_password: boolean
  onboarding_completed: boolean
  created_at: string
  updated_at: string
  custom_role_id?: string | null
  custom_role?: CustomRole
  manager_id?: string | null
}

export interface Workspace {
  id: string
  name: string
  description: string | null
  created_by: string
  created_at: string
  updated_at: string
}

export interface WorkspaceAssignment {
  id: string
  workspace_id: string
  user_id: string
  created_at: string
}

export interface Project {
  id: string
  workspace_id: string
  name: string
  description: string | null
  client_id: string | null
  partner_id: string | null
  is_internal: boolean
  billing_type: BillingType | null
  start_date: string | null
  due_date: string | null
  status: ProjectStatus
  priority: Priority
  progress: number
  estimated_hours: number | null
  fixed_price: number | null
  created_by: string
  created_at: string
  updated_at: string
  // joined
  workspace?: Workspace
  client?: Profile
  partner?: Profile
  actual_hours?: number
}

export interface Task {
  id: string
  project_id: string
  parent_task_id: string | null
  title: string
  description: string | null
  start_date: string | null
  due_date: string | null
  estimated_hours: number | null
  priority: Priority
  status: TaskStatus
  billable: boolean
  created_by: string
  created_at: string
  updated_at: string
  depth: number
  // joined
  project?: Project
  assignees?: Profile[]
  subtasks?: Task[]
  actual_hours?: number
  watcher_ids?: string[]
}

export interface TaskAssignee {
  id: string
  task_id: string
  user_id: string
  created_at: string
}

export interface TaskWatcher {
  id: string
  task_id: string
  user_id: string
  created_at: string
}

export interface Comment {
  id: string
  task_id: string
  user_id: string
  content: string
  is_internal: boolean
  parent_comment_id: string | null
  created_at: string
  updated_at: string
  // joined
  user?: Profile
  replies?: Comment[]
}

export interface TimeEntry {
  id: string
  task_id: string
  user_id: string
  description: string | null
  started_at: string
  ended_at: string | null
  duration_minutes: number | null
  is_running: boolean
  is_billable: boolean
  approval_status: ApprovalStatus
  approved_by: string | null
  approved_at: string | null
  created_at: string
  updated_at: string
  // joined
  task?: Task
}

export interface Notification {
  id: string
  user_id: string
  type: 'task_assigned' | 'subtask_assigned' | 'mention' | 'comment_reply' | 'status_changed'
  title: string
  message: string
  link: string | null
  is_read: boolean
  created_at: string
}

export interface ActivityLog {
  id: string
  task_id: string
  user_id: string
  action: string
  old_value: string | null
  new_value: string | null
  created_at: string
  // joined
  user?: Profile
}


export interface AttendanceRecord {
  id: string
  user_id: string
  date: string
  check_in_time: string | null
  check_out_time: string | null
  status: AttendanceStatus
  applied_rule: AppliedRule
  is_football_rule: boolean
  notes: string | null
  created_at: string
  updated_at: string
  // joined
  user?: Profile
}

export interface FootballRule {
  id: string
  date: string
  user_ids: string[]
  created_by: string
  created_at: string
}

export interface LeaveBalance {
  id: string
  user_id: string
  year: number
  yearly_total: number
  yearly_used: number
  wfh_total: number
  wfh_used: number
  marriage_total: number
  marriage_used: number
  created_at: string
  updated_at: string
}

export interface OptionalLeave {
  id: string
  user_id: string
  granted_by: string
  name: string
  total_days: number
  used_days: number
  year: number
  notes: string | null
  created_at: string
}

export interface LeaveRequest {
  id: string
  user_id: string
  leave_type: LeaveType
  optional_leave_id: string | null
  start_date: string
  end_date: string
  total_days: number
  reason: string | null
  status: LeaveStatus
  reviewed_by: string | null
  reviewed_at: string | null
  review_notes: string | null
  created_at: string
  updated_at: string
  // joined
  user?: Profile
  reviewer?: Profile
}

export interface AttendanceSettings {
  id: string
  // General day rule (Sat–Thu, excluding Friday)
  on_time_end: string        // '09:00'
  late_150_end: string       // '09:30'
  late_250_end: string       // '11:00'
  exit_time_general: string  // '14:15'
  // Friday rule
  friday_on_time_end: string   // '08:30'
  friday_late_150_end: string  // '09:00'
  friday_late_250_end: string  // '11:00'
  exit_time_friday: string     // '12:15'
  // Football rule (per-date override for selected staff)
  football_on_time_end: string   // '09:45'
  football_late_150_end: string  // '10:30'
  football_late_250_end: string  // '11:00'
  exit_time_football: string     // '14:30'
  // Leave defaults
  yearly_leave_days: number
  wfh_days: number
  updated_by: string | null
  updated_at: string
}

export interface CustomTaskStatus {
  id: string
  name: string
  slug: string
  color: string
  sort_order: number
  is_active: boolean
  is_default: boolean
  is_completed_status: boolean
  counts_toward_progress: boolean
  created_by: string | null
  created_at: string
}

export interface CustomTaskPriority {
  id: string
  name: string
  slug: string
  color: string
  sort_order: number
  is_active: boolean
  is_default: boolean
  created_by: string | null
  created_at: string
}

export interface ProjectMember {
  id: string
  project_id: string
  user_id: string
  project_role: 'lead' | 'member'
  created_at: string
  profile?: Profile
}

export interface DashboardStats {
  total_projects: number
  active_projects: number
  overdue_tasks: number
  my_tasks: number
  pending_leaves: number
  todays_attendance?: AttendanceRecord
}

export interface Team {
  id: string
  name: string
  description: string | null
  team_type: 'official' | 'private' | 'public'
  color: string
  is_archived: boolean
  created_by: string | null
  created_at: string
  updated_at: string
  members?: TeamMember[]
}

export interface TeamMember {
  id: string
  team_id: string
  user_id: string
  role: 'lead' | 'member'
  created_at: string
  profile?: Profile
}
