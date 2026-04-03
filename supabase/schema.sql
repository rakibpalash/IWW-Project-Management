-- ============================================================
-- IWW Project Management Tools - Complete Database Schema
-- Run this in Supabase SQL Editor
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- PROFILES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  avatar_url TEXT,
  role TEXT NOT NULL DEFAULT 'staff' CHECK (role IN ('super_admin', 'staff', 'client')),
  is_temp_password BOOLEAN NOT NULL DEFAULT false,
  onboarding_completed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- WORKSPACES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.workspaces (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- WORKSPACE ASSIGNMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.workspace_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(workspace_id, user_id)
);

-- ============================================================
-- PROJECTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  client_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  start_date DATE,
  due_date DATE,
  status TEXT NOT NULL DEFAULT 'planning'
    CHECK (status IN ('planning', 'in_progress', 'on_hold', 'completed', 'cancelled')),
  priority TEXT NOT NULL DEFAULT 'medium'
    CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  progress INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  estimated_hours NUMERIC(10,2),
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TASKS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  parent_task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  start_date DATE,
  due_date DATE,
  estimated_hours NUMERIC(10,2),
  priority TEXT NOT NULL DEFAULT 'medium'
    CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  status TEXT NOT NULL DEFAULT 'todo'
    CHECK (status IN ('todo', 'in_progress', 'in_review', 'done', 'cancelled')),
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- depth tracking for subtask nesting
  depth INTEGER NOT NULL DEFAULT 0 CHECK (depth <= 2)
);

-- ============================================================
-- TASK ASSIGNEES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.task_assignees (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(task_id, user_id)
);

-- ============================================================
-- TASK WATCHERS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.task_watchers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(task_id, user_id)
);

-- ============================================================
-- COMMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_internal BOOLEAN NOT NULL DEFAULT false,
  parent_comment_id UUID REFERENCES public.comments(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TIME ENTRIES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.time_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  description TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  duration_minutes INTEGER,
  is_running BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- NOTIFICATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('task_assigned', 'subtask_assigned', 'mention', 'comment_reply', 'status_changed')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  link TEXT,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- ACTIVITY LOGS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- ATTENDANCE SETTINGS (singleton)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.attendance_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  -- General day rule (Sat–Thu, excluding Friday)
  on_time_end TIME NOT NULL DEFAULT '09:00',
  late_150_end TIME NOT NULL DEFAULT '09:30',
  late_250_end TIME NOT NULL DEFAULT '11:00',
  exit_time_general TIME NOT NULL DEFAULT '14:15',
  -- Friday rule
  friday_on_time_end TIME NOT NULL DEFAULT '08:30',
  friday_late_150_end TIME NOT NULL DEFAULT '09:00',
  friday_late_250_end TIME NOT NULL DEFAULT '11:00',
  exit_time_friday TIME NOT NULL DEFAULT '12:15',
  -- Football rule (per-date override for selected staff)
  football_on_time_end TIME NOT NULL DEFAULT '09:45',
  football_late_150_end TIME NOT NULL DEFAULT '10:30',
  football_late_250_end TIME NOT NULL DEFAULT '11:00',
  exit_time_football TIME NOT NULL DEFAULT '14:30',
  -- Leave defaults
  yearly_leave_days INTEGER NOT NULL DEFAULT 18,
  wfh_days INTEGER NOT NULL DEFAULT 10,
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- ATTENDANCE RECORDS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.attendance_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  check_in_time TIME,
  check_out_time TIME,
  status TEXT NOT NULL DEFAULT 'absent'
    CHECK (status IN ('on_time', 'late_150', 'late_250', 'absent', 'advance_absence')),
  applied_rule TEXT NOT NULL DEFAULT 'general'
    CHECK (applied_rule IN ('general', 'friday', 'football', 'holiday')),
  is_football_rule BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, date)
);

-- ============================================================
-- FOOTBALL RULES (per-date overrides)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.football_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  date DATE NOT NULL UNIQUE,
  user_ids UUID[] NOT NULL DEFAULT '{}',
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- LEAVE BALANCES (per user per year)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.leave_balances (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  yearly_total INTEGER NOT NULL DEFAULT 18,
  yearly_used NUMERIC(5,1) NOT NULL DEFAULT 0,
  wfh_total INTEGER NOT NULL DEFAULT 10,
  wfh_used NUMERIC(5,1) NOT NULL DEFAULT 0,
  marriage_total INTEGER NOT NULL DEFAULT 0,
  marriage_used NUMERIC(5,1) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, year)
);

-- ============================================================
-- LEAVE REQUESTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.leave_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  leave_type TEXT NOT NULL CHECK (leave_type IN ('yearly', 'work_from_home', 'marriage')),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  total_days NUMERIC(5,1) NOT NULL,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_workspace_assignments_user ON workspace_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_workspace_assignments_workspace ON workspace_assignments(workspace_id);
CREATE INDEX IF NOT EXISTS idx_projects_workspace ON projects(workspace_id);
CREATE INDEX IF NOT EXISTS idx_projects_client ON projects(client_id);
CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_parent ON tasks(parent_task_id);
CREATE INDEX IF NOT EXISTS idx_task_assignees_task ON task_assignees(task_id);
CREATE INDEX IF NOT EXISTS idx_task_assignees_user ON task_assignees(user_id);
CREATE INDEX IF NOT EXISTS idx_task_watchers_task ON task_watchers(task_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_task ON time_entries(task_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_user ON time_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_running ON time_entries(user_id, is_running) WHERE is_running = true;
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_activity_logs_task ON activity_logs(task_id);
CREATE INDEX IF NOT EXISTS idx_attendance_user_date ON attendance_records(user_id, date);
CREATE INDEX IF NOT EXISTS idx_leave_requests_user ON leave_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_status ON leave_requests(status);
CREATE INDEX IF NOT EXISTS idx_comments_task ON comments(task_id);

-- ============================================================
-- FUNCTIONS
-- ============================================================

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to tables
DROP TRIGGER IF EXISTS profiles_updated_at ON profiles;
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS workspaces_updated_at ON workspaces;
CREATE TRIGGER workspaces_updated_at BEFORE UPDATE ON workspaces FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS projects_updated_at ON projects;
CREATE TRIGGER projects_updated_at BEFORE UPDATE ON projects FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS tasks_updated_at ON tasks;
CREATE TRIGGER tasks_updated_at BEFORE UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS comments_updated_at ON comments;
CREATE TRIGGER comments_updated_at BEFORE UPDATE ON comments FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS time_entries_updated_at ON time_entries;
CREATE TRIGGER time_entries_updated_at BEFORE UPDATE ON time_entries FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS attendance_records_updated_at ON attendance_records;
CREATE TRIGGER attendance_records_updated_at BEFORE UPDATE ON attendance_records FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS leave_balances_updated_at ON leave_balances;
CREATE TRIGGER leave_balances_updated_at BEFORE UPDATE ON leave_balances FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS leave_requests_updated_at ON leave_requests;
CREATE TRIGGER leave_requests_updated_at BEFORE UPDATE ON leave_requests FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Auto-create profile after auth signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, is_temp_password)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'role', 'staff'),
    COALESCE((NEW.raw_user_meta_data->>'is_temp_password')::boolean, false)
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Get actual hours for a task (sum of completed time entries)
CREATE OR REPLACE FUNCTION get_task_actual_hours(p_task_id UUID)
RETURNS NUMERIC AS $$
  SELECT COALESCE(SUM(duration_minutes) / 60.0, 0)
  FROM time_entries
  WHERE task_id = p_task_id AND duration_minutes IS NOT NULL;
$$ LANGUAGE SQL STABLE;

-- Get project actual hours (roll-up from all tasks)
CREATE OR REPLACE FUNCTION get_project_actual_hours(p_project_id UUID)
RETURNS NUMERIC AS $$
  SELECT COALESCE(SUM(te.duration_minutes) / 60.0, 0)
  FROM time_entries te
  JOIN tasks t ON te.task_id = t.id
  WHERE t.project_id = p_project_id AND te.duration_minutes IS NOT NULL;
$$ LANGUAGE SQL STABLE;

-- Validate subtask depth before insert
CREATE OR REPLACE FUNCTION validate_subtask_depth()
RETURNS TRIGGER AS $$
DECLARE
  parent_depth INTEGER;
  sibling_count INTEGER;
BEGIN
  IF NEW.parent_task_id IS NOT NULL THEN
    -- Get parent depth
    SELECT depth INTO parent_depth FROM tasks WHERE id = NEW.parent_task_id;
    IF parent_depth IS NULL THEN
      RAISE EXCEPTION 'Parent task not found';
    END IF;
    NEW.depth := parent_depth + 1;
    IF NEW.depth > 2 THEN
      RAISE EXCEPTION 'Maximum subtask nesting depth (2) exceeded';
    END IF;
    -- Count existing subtasks
    SELECT COUNT(*) INTO sibling_count FROM tasks WHERE parent_task_id = NEW.parent_task_id;
    IF sibling_count >= 10 THEN
      RAISE EXCEPTION 'Maximum subtasks per task (10) exceeded';
    END IF;
  ELSE
    NEW.depth := 0;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS validate_subtask_depth_trigger ON tasks;
CREATE TRIGGER validate_subtask_depth_trigger
  BEFORE INSERT ON tasks
  FOR EACH ROW EXECUTE FUNCTION validate_subtask_depth();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_assignees ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_watchers ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE football_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_settings ENABLE ROW LEVEL SECURITY;

-- Helper function: get current user role
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS TEXT AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- Helper: is super admin
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN AS $$
  SELECT get_my_role() = 'super_admin';
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- Helper: user is in workspace
CREATE OR REPLACE FUNCTION is_in_workspace(p_workspace_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM workspace_assignments
    WHERE workspace_id = p_workspace_id AND user_id = auth.uid()
  ) OR is_super_admin();
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- ---- PROFILES ----
DROP POLICY IF EXISTS "profiles_select" ON profiles;
CREATE POLICY "profiles_select" ON profiles
  FOR SELECT USING (
    auth.uid() = id
    OR is_super_admin()
    OR EXISTS (
      SELECT 1 FROM workspace_assignments wa1
      JOIN workspace_assignments wa2 ON wa1.workspace_id = wa2.workspace_id
      WHERE wa1.user_id = auth.uid() AND wa2.user_id = profiles.id
    )
  );

DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
CREATE POLICY "profiles_update_own" ON profiles
  FOR UPDATE USING (auth.uid() = id OR is_super_admin());

DROP POLICY IF EXISTS "profiles_insert_admin" ON profiles;
CREATE POLICY "profiles_insert_admin" ON profiles
  FOR INSERT WITH CHECK (is_super_admin() OR auth.uid() = id);

-- ---- WORKSPACES ----
DROP POLICY IF EXISTS "workspaces_select" ON workspaces;
CREATE POLICY "workspaces_select" ON workspaces
  FOR SELECT USING (is_in_workspace(id) OR is_super_admin());

DROP POLICY IF EXISTS "workspaces_all_admin" ON workspaces;
CREATE POLICY "workspaces_all_admin" ON workspaces
  FOR ALL USING (is_super_admin());

-- ---- WORKSPACE ASSIGNMENTS ----
DROP POLICY IF EXISTS "wa_select" ON workspace_assignments;
CREATE POLICY "wa_select" ON workspace_assignments
  FOR SELECT USING (user_id = auth.uid() OR is_super_admin());

DROP POLICY IF EXISTS "wa_all_admin" ON workspace_assignments;
CREATE POLICY "wa_all_admin" ON workspace_assignments
  FOR ALL USING (is_super_admin());

-- ---- PROJECTS ----
DROP POLICY IF EXISTS "projects_select_staff" ON projects;
CREATE POLICY "projects_select_staff" ON projects
  FOR SELECT USING (
    is_super_admin()
    OR is_in_workspace(workspace_id)
    OR client_id = auth.uid()
  );

DROP POLICY IF EXISTS "projects_write_admin" ON projects;
CREATE POLICY "projects_write_admin" ON projects
  FOR ALL USING (is_super_admin());

DROP POLICY IF EXISTS "projects_write_staff" ON projects;
CREATE POLICY "projects_write_staff" ON projects
  FOR INSERT WITH CHECK (is_in_workspace(workspace_id));

-- ---- TASKS ----
DROP POLICY IF EXISTS "tasks_select" ON tasks;
CREATE POLICY "tasks_select" ON tasks
  FOR SELECT USING (
    is_super_admin()
    OR EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = tasks.project_id
      AND (is_in_workspace(p.workspace_id) OR p.client_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "tasks_insert" ON tasks;
CREATE POLICY "tasks_insert" ON tasks
  FOR INSERT WITH CHECK (
    is_super_admin()
    OR EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = tasks.project_id AND is_in_workspace(p.workspace_id)
    )
  );

DROP POLICY IF EXISTS "tasks_update" ON tasks;
CREATE POLICY "tasks_update" ON tasks
  FOR UPDATE USING (
    is_super_admin()
    OR created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM task_assignees ta
      WHERE ta.task_id = tasks.id AND ta.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "tasks_delete_admin" ON tasks;
CREATE POLICY "tasks_delete_admin" ON tasks
  FOR DELETE USING (is_super_admin());

-- ---- TASK ASSIGNEES ----
DROP POLICY IF EXISTS "ta_select" ON task_assignees;
CREATE POLICY "ta_select" ON task_assignees
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "ta_write" ON task_assignees;
DROP POLICY IF EXISTS "ta_insert" ON task_assignees;
CREATE POLICY "ta_insert" ON task_assignees
  FOR INSERT WITH CHECK (
    is_super_admin()
    OR EXISTS (
      SELECT 1 FROM tasks t
      WHERE t.id = task_assignees.task_id AND t.created_by = auth.uid()
    )
  );

DROP POLICY IF EXISTS "ta_delete" ON task_assignees;
CREATE POLICY "ta_delete" ON task_assignees
  FOR DELETE USING (
    is_super_admin()
    OR EXISTS (
      SELECT 1 FROM tasks t
      WHERE t.id = task_assignees.task_id AND t.created_by = auth.uid()
    )
  );

-- ---- TASK WATCHERS ----
DROP POLICY IF EXISTS "tw_select" ON task_watchers;
CREATE POLICY "tw_select" ON task_watchers
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "tw_write" ON task_watchers;
CREATE POLICY "tw_write" ON task_watchers
  FOR ALL USING (user_id = auth.uid() OR is_super_admin());

-- ---- COMMENTS ----
DROP POLICY IF EXISTS "comments_select" ON comments;
CREATE POLICY "comments_select" ON comments
  FOR SELECT USING (
    -- internal comments: only super_admin + staff
    (is_internal = false)
    OR (is_internal = true AND get_my_role() IN ('super_admin', 'staff'))
  );

DROP POLICY IF EXISTS "comments_insert" ON comments;
CREATE POLICY "comments_insert" ON comments
  FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "comments_update_own" ON comments;
CREATE POLICY "comments_update_own" ON comments
  FOR UPDATE USING (user_id = auth.uid() OR is_super_admin());

DROP POLICY IF EXISTS "comments_delete" ON comments;
CREATE POLICY "comments_delete" ON comments
  FOR DELETE USING (user_id = auth.uid() OR is_super_admin());

-- ---- TIME ENTRIES ----
DROP POLICY IF EXISTS "time_entries_select" ON time_entries;
CREATE POLICY "time_entries_select" ON time_entries
  FOR SELECT USING (user_id = auth.uid() OR is_super_admin());

DROP POLICY IF EXISTS "time_entries_insert" ON time_entries;
CREATE POLICY "time_entries_insert" ON time_entries
  FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "time_entries_update" ON time_entries;
CREATE POLICY "time_entries_update" ON time_entries
  FOR UPDATE USING (user_id = auth.uid() OR is_super_admin());

-- ---- NOTIFICATIONS ----
DROP POLICY IF EXISTS "notifications_own" ON notifications;
CREATE POLICY "notifications_own" ON notifications
  FOR ALL USING (user_id = auth.uid());

DROP POLICY IF EXISTS "notifications_insert_system" ON notifications;
CREATE POLICY "notifications_insert_system" ON notifications
  FOR INSERT WITH CHECK (true);

-- ---- ACTIVITY LOGS ----
DROP POLICY IF EXISTS "activity_logs_select" ON activity_logs;
CREATE POLICY "activity_logs_select" ON activity_logs
  FOR SELECT USING (
    is_super_admin()
    OR EXISTS (
      SELECT 1 FROM tasks t
      JOIN projects p ON t.project_id = p.id
      WHERE t.id = activity_logs.task_id AND is_in_workspace(p.workspace_id)
    )
  );

DROP POLICY IF EXISTS "activity_logs_insert" ON activity_logs;
CREATE POLICY "activity_logs_insert" ON activity_logs
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- ---- ATTENDANCE RECORDS ----
DROP POLICY IF EXISTS "attendance_select_own" ON attendance_records;
CREATE POLICY "attendance_select_own" ON attendance_records
  FOR SELECT USING (user_id = auth.uid() OR is_super_admin());

DROP POLICY IF EXISTS "attendance_insert_own" ON attendance_records;
CREATE POLICY "attendance_insert_own" ON attendance_records
  FOR INSERT WITH CHECK (user_id = auth.uid() OR is_super_admin());

DROP POLICY IF EXISTS "attendance_update" ON attendance_records;
CREATE POLICY "attendance_update" ON attendance_records
  FOR UPDATE USING (user_id = auth.uid() OR is_super_admin());

-- ---- FOOTBALL RULES ----
DROP POLICY IF EXISTS "football_select" ON football_rules;
CREATE POLICY "football_select" ON football_rules
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "football_write_admin" ON football_rules;
CREATE POLICY "football_write_admin" ON football_rules
  FOR ALL USING (is_super_admin());

-- ---- LEAVE BALANCES ----
DROP POLICY IF EXISTS "leave_balances_own" ON leave_balances;
CREATE POLICY "leave_balances_own" ON leave_balances
  FOR SELECT USING (user_id = auth.uid() OR is_super_admin());

DROP POLICY IF EXISTS "leave_balances_write_admin" ON leave_balances;
CREATE POLICY "leave_balances_write_admin" ON leave_balances
  FOR ALL USING (is_super_admin());

-- ---- LEAVE REQUESTS ----
DROP POLICY IF EXISTS "leave_requests_select" ON leave_requests;
CREATE POLICY "leave_requests_select" ON leave_requests
  FOR SELECT USING (user_id = auth.uid() OR is_super_admin());

DROP POLICY IF EXISTS "leave_requests_insert_own" ON leave_requests;
CREATE POLICY "leave_requests_insert_own" ON leave_requests
  FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "leave_requests_update" ON leave_requests;
CREATE POLICY "leave_requests_update" ON leave_requests
  FOR UPDATE USING (
    (user_id = auth.uid() AND status = 'pending')
    OR is_super_admin()
  );

-- ---- ATTENDANCE SETTINGS ----
DROP POLICY IF EXISTS "settings_select" ON attendance_settings;
CREATE POLICY "settings_select" ON attendance_settings
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "settings_write_admin" ON attendance_settings;
CREATE POLICY "settings_write_admin" ON attendance_settings
  FOR ALL USING (is_super_admin());

-- ============================================================
-- SEED DATA
-- ============================================================

-- Default attendance settings (singleton)
INSERT INTO attendance_settings (
  on_time_end, late_150_end, late_250_end,
  football_on_time_end, football_late_150_end, football_late_250_end,
  yearly_leave_days, wfh_days
)
VALUES (
  '09:00', '09:30', '11:00',
  '09:45', '10:30', '11:00',
  18, 10
)
ON CONFLICT DO NOTHING;
