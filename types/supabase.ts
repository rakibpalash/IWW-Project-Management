export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          full_name: string
          avatar_url: string | null
          role: 'super_admin' | 'staff' | 'client'
          is_temp_password: boolean
          onboarding_completed: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          full_name: string
          avatar_url?: string | null
          role?: 'super_admin' | 'staff' | 'client'
          is_temp_password?: boolean
          onboarding_completed?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          email?: string
          full_name?: string
          avatar_url?: string | null
          role?: 'super_admin' | 'staff' | 'client'
          is_temp_password?: boolean
          onboarding_completed?: boolean
          updated_at?: string
        }
      }
      spaces: {
        Row: {
          id: string
          name: string
          description: string | null
          default_permission: 'full_edit' | 'can_edit' | 'view_only' | 'no_access'
          created_by: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          default_permission?: 'full_edit' | 'can_edit' | 'view_only' | 'no_access'
          created_by: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          name?: string
          description?: string | null
          default_permission?: 'full_edit' | 'can_edit' | 'view_only' | 'no_access'
          updated_at?: string
        }
      }
      space_assignments: {
        Row: {
          id: string
          space_id: string
          user_id: string
          created_at: string
        }
        Insert: {
          id?: string
          space_id: string
          user_id: string
          created_at?: string
        }
        Update: never
      }
      lists: {
        Row: {
          id: string
          space_id: string
          name: string
          description: string | null
          client_id: string | null
          start_date: string | null
          due_date: string | null
          status: string
          priority: string
          progress: number
          estimated_hours: number | null
          created_by: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          space_id: string
          name: string
          description?: string | null
          client_id?: string | null
          start_date?: string | null
          due_date?: string | null
          status?: string
          priority?: string
          progress?: number
          estimated_hours?: number | null
          created_by: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          name?: string
          description?: string | null
          client_id?: string | null
          start_date?: string | null
          due_date?: string | null
          status?: string
          priority?: string
          progress?: number
          estimated_hours?: number | null
          updated_at?: string
        }
      }
      tasks: {
        Row: {
          id: string
          list_id: string
          parent_task_id: string | null
          title: string
          description: string | null
          start_date: string | null
          due_date: string | null
          estimated_hours: number | null
          priority: string
          status: string
          created_by: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          list_id: string
          parent_task_id?: string | null
          title: string
          description?: string | null
          start_date?: string | null
          due_date?: string | null
          estimated_hours?: number | null
          priority?: string
          status?: string
          created_by: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          title?: string
          description?: string | null
          start_date?: string | null
          due_date?: string | null
          estimated_hours?: number | null
          priority?: string
          status?: string
          updated_at?: string
        }
      }
      task_assignees: {
        Row: {
          id: string
          task_id: string
          user_id: string
          created_at: string
        }
        Insert: {
          id?: string
          task_id: string
          user_id: string
          created_at?: string
        }
        Update: never
      }
      task_watchers: {
        Row: {
          id: string
          task_id: string
          user_id: string
          created_at: string
        }
        Insert: {
          id?: string
          task_id: string
          user_id: string
          created_at?: string
        }
        Update: never
      }
      comments: {
        Row: {
          id: string
          task_id: string
          user_id: string
          content: string
          is_internal: boolean
          parent_comment_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          task_id: string
          user_id: string
          content: string
          is_internal?: boolean
          parent_comment_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          content?: string
          is_internal?: boolean
          updated_at?: string
        }
      }
      time_entries: {
        Row: {
          id: string
          task_id: string
          user_id: string
          description: string | null
          started_at: string
          ended_at: string | null
          duration_minutes: number | null
          is_running: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          task_id: string
          user_id: string
          description?: string | null
          started_at: string
          ended_at?: string | null
          duration_minutes?: number | null
          is_running?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          description?: string | null
          ended_at?: string | null
          duration_minutes?: number | null
          is_running?: boolean
          updated_at?: string
        }
      }
      notifications: {
        Row: {
          id: string
          user_id: string
          type: string
          title: string
          message: string
          link: string | null
          is_read: boolean
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          type: string
          title: string
          message: string
          link?: string | null
          is_read?: boolean
          created_at?: string
        }
        Update: {
          is_read?: boolean
        }
      }
      activity_logs: {
        Row: {
          id: string
          task_id: string
          user_id: string
          action: string
          old_value: string | null
          new_value: string | null
          created_at: string
        }
        Insert: {
          id?: string
          task_id: string
          user_id: string
          action: string
          old_value?: string | null
          new_value?: string | null
          created_at?: string
        }
        Update: never
      }
      attendance_records: {
        Row: {
          id: string
          user_id: string
          date: string
          check_in_time: string | null
          check_out_time: string | null
          status: string
          is_football_rule: boolean
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          date: string
          check_in_time?: string | null
          check_out_time?: string | null
          status?: string
          is_football_rule?: boolean
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          check_in_time?: string | null
          check_out_time?: string | null
          status?: string
          is_football_rule?: boolean
          notes?: string | null
          updated_at?: string
        }
      }
      football_rules: {
        Row: {
          id: string
          date: string
          user_ids: string[]
          created_by: string
          created_at: string
        }
        Insert: {
          id?: string
          date: string
          user_ids: string[]
          created_by: string
          created_at?: string
        }
        Update: {
          user_ids?: string[]
        }
      }
      leave_balances: {
        Row: {
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
        Insert: {
          id?: string
          user_id: string
          year: number
          yearly_total?: number
          yearly_used?: number
          wfh_total?: number
          wfh_used?: number
          marriage_total?: number
          marriage_used?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          yearly_total?: number
          yearly_used?: number
          wfh_total?: number
          wfh_used?: number
          marriage_total?: number
          marriage_used?: number
          updated_at?: string
        }
      }
      leave_requests: {
        Row: {
          id: string
          user_id: string
          leave_type: string
          start_date: string
          end_date: string
          total_days: number
          reason: string | null
          status: string
          reviewed_by: string | null
          reviewed_at: string | null
          review_notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          leave_type: string
          start_date: string
          end_date: string
          total_days: number
          reason?: string | null
          status?: string
          reviewed_by?: string | null
          reviewed_at?: string | null
          review_notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          status?: string
          reviewed_by?: string | null
          reviewed_at?: string | null
          review_notes?: string | null
          updated_at?: string
        }
      }
      attendance_settings: {
        Row: {
          id: string
          on_time_end: string
          late_150_end: string
          late_250_end: string
          football_on_time_end: string
          football_late_150_end: string
          football_late_250_end: string
          yearly_leave_days: number
          wfh_days: number
          updated_by: string | null
          updated_at: string
        }
        Insert: {
          id?: string
          on_time_end?: string
          late_150_end?: string
          late_250_end?: string
          football_on_time_end?: string
          football_late_150_end?: string
          football_late_250_end?: string
          yearly_leave_days?: number
          wfh_days?: number
          updated_by?: string | null
          updated_at?: string
        }
        Update: {
          on_time_end?: string
          late_150_end?: string
          late_250_end?: string
          football_on_time_end?: string
          football_late_150_end?: string
          football_late_250_end?: string
          yearly_leave_days?: number
          wfh_days?: number
          updated_by?: string | null
          updated_at?: string
        }
      }
    }
    Views: {}
    Functions: {}
    Enums: {}
  }
}
