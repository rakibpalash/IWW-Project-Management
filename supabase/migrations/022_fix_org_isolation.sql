-- =============================================================================
-- Migration 022: Fix complete org isolation
--
-- Root causes fixed:
--   1. is_in_workspace() had global is_super_admin() bypass — org A admins
--      could access org B workspaces/projects/tasks
--   2. Many tables had USING (true) for SELECT — leaked all orgs' data
--   3. All is_super_admin() bypasses in policies were unscoped — org A admins
--      could see/write org B attendance, leave, team, config data
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Fix is_in_workspace() — super_admin bypass scoped to own org
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_in_workspace(p_workspace_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_assignments
    WHERE workspace_id = p_workspace_id AND user_id = auth.uid()
  )
  OR (
    public.is_super_admin()
    AND EXISTS (
      SELECT 1 FROM public.workspaces
      WHERE id = p_workspace_id
        AND organization_id = public.get_my_org_id()
    )
  );
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. WORKSPACES — scope SELECT and admin writes to own org
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "workspaces_select"     ON public.workspaces;
DROP POLICY IF EXISTS "workspaces_all_admin"  ON public.workspaces;

CREATE POLICY "workspaces_select" ON public.workspaces
  FOR SELECT USING (
    organization_id = public.get_my_org_id()
    AND (public.is_super_admin() OR public.is_in_workspace(id))
  );

CREATE POLICY "workspaces_all_admin" ON public.workspaces
  FOR ALL USING (
    public.is_super_admin()
    AND organization_id = public.get_my_org_id()
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. WORKSPACE ASSIGNMENTS — scope to own org's workspaces
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "wa_select"    ON public.workspace_assignments;
DROP POLICY IF EXISTS "wa_all_admin" ON public.workspace_assignments;

CREATE POLICY "wa_select" ON public.workspace_assignments
  FOR SELECT USING (
    user_id = auth.uid()
    OR (
      public.is_super_admin()
      AND EXISTS (
        SELECT 1 FROM public.workspaces w
        WHERE w.id = workspace_id AND w.organization_id = public.get_my_org_id()
      )
    )
  );

CREATE POLICY "wa_all_admin" ON public.workspace_assignments
  FOR ALL USING (
    public.is_super_admin()
    AND EXISTS (
      SELECT 1 FROM public.workspaces w
      WHERE w.id = workspace_id AND w.organization_id = public.get_my_org_id()
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. PROJECTS — remove global is_super_admin() bypass; is_in_workspace() now
--    handles org-scoped admin access
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "projects_select_staff" ON public.projects;
DROP POLICY IF EXISTS "projects_write_admin"  ON public.projects;
DROP POLICY IF EXISTS "projects_write_staff"  ON public.projects;

CREATE POLICY "projects_select_staff" ON public.projects
  FOR SELECT USING (
    public.is_in_workspace(workspace_id)
    OR client_id = auth.uid()
  );

CREATE POLICY "projects_write_admin" ON public.projects
  FOR ALL USING (public.is_in_workspace(workspace_id) AND public.is_super_admin());

CREATE POLICY "projects_write_staff" ON public.projects
  FOR INSERT WITH CHECK (public.is_in_workspace(workspace_id));

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. TASKS — remove global is_super_admin() bypass
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "tasks_select"      ON public.tasks;
DROP POLICY IF EXISTS "tasks_insert"      ON public.tasks;
DROP POLICY IF EXISTS "tasks_update"      ON public.tasks;
DROP POLICY IF EXISTS "tasks_delete_admin" ON public.tasks;

CREATE POLICY "tasks_select" ON public.tasks
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = tasks.project_id
        AND (public.is_in_workspace(p.workspace_id) OR p.client_id = auth.uid())
    )
  );

CREATE POLICY "tasks_insert" ON public.tasks
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = tasks.project_id AND public.is_in_workspace(p.workspace_id)
    )
  );

CREATE POLICY "tasks_update" ON public.tasks
  FOR UPDATE USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.task_assignees ta
      WHERE ta.task_id = tasks.id AND ta.user_id = auth.uid()
    )
    OR (
      public.is_super_admin()
      AND EXISTS (
        SELECT 1 FROM public.projects p
        WHERE p.id = tasks.project_id AND public.is_in_workspace(p.workspace_id)
      )
    )
  );

CREATE POLICY "tasks_delete_admin" ON public.tasks
  FOR DELETE USING (
    public.is_super_admin()
    AND EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = tasks.project_id AND public.is_in_workspace(p.workspace_id)
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. TASK ASSIGNEES — replace USING (true) with org-scoped access
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "ta_select" ON public.task_assignees;
DROP POLICY IF EXISTS "ta_insert" ON public.task_assignees;
DROP POLICY IF EXISTS "ta_delete" ON public.task_assignees;

CREATE POLICY "ta_select" ON public.task_assignees
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.tasks t
      JOIN public.projects p ON p.id = t.project_id
      WHERE t.id = task_assignees.task_id
        AND public.is_in_workspace(p.workspace_id)
    )
  );

CREATE POLICY "ta_insert" ON public.task_assignees
  FOR INSERT WITH CHECK (
    public.is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.tasks t
      WHERE t.id = task_assignees.task_id AND t.created_by = auth.uid()
    )
  );

CREATE POLICY "ta_delete" ON public.task_assignees
  FOR DELETE USING (
    public.is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.tasks t
      WHERE t.id = task_assignees.task_id AND t.created_by = auth.uid()
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. TASK WATCHERS — replace USING (true) with org-scoped access
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "tw_select" ON public.task_watchers;
DROP POLICY IF EXISTS "tw_write"  ON public.task_watchers;

CREATE POLICY "tw_select" ON public.task_watchers
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.tasks t
      JOIN public.projects p ON p.id = t.project_id
      WHERE t.id = task_watchers.task_id
        AND public.is_in_workspace(p.workspace_id)
    )
  );

CREATE POLICY "tw_write" ON public.task_watchers
  FOR ALL USING (
    user_id = auth.uid()
    OR (
      public.is_super_admin()
      AND EXISTS (
        SELECT 1 FROM public.tasks t
        JOIN public.projects p ON p.id = t.project_id
        WHERE t.id = task_watchers.task_id
          AND public.is_in_workspace(p.workspace_id)
      )
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. COMMENTS — fix global is_super_admin() in update/delete
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "comments_select"      ON public.comments;
DROP POLICY IF EXISTS "comments_update_own"  ON public.comments;
DROP POLICY IF EXISTS "comments_delete"      ON public.comments;

CREATE POLICY "comments_select" ON public.comments
  FOR SELECT USING (
    (is_internal = false OR public.get_my_role() IN ('super_admin', 'staff'))
    AND EXISTS (
      SELECT 1 FROM public.tasks t
      JOIN public.projects p ON p.id = t.project_id
      WHERE t.id = comments.task_id
        AND public.is_in_workspace(p.workspace_id)
    )
  );

CREATE POLICY "comments_update_own" ON public.comments
  FOR UPDATE USING (
    user_id = auth.uid()
    OR (
      public.is_super_admin()
      AND EXISTS (
        SELECT 1 FROM public.tasks t
        JOIN public.projects p ON p.id = t.project_id
        WHERE t.id = comments.task_id AND public.is_in_workspace(p.workspace_id)
      )
    )
  );

CREATE POLICY "comments_delete" ON public.comments
  FOR DELETE USING (
    user_id = auth.uid()
    OR (
      public.is_super_admin()
      AND EXISTS (
        SELECT 1 FROM public.tasks t
        JOIN public.projects p ON p.id = t.project_id
        WHERE t.id = comments.task_id AND public.is_in_workspace(p.workspace_id)
      )
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. TIME ENTRIES — scope is_super_admin() bypass to own org users
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "time_entries_select" ON public.time_entries;
DROP POLICY IF EXISTS "time_entries_update" ON public.time_entries;

CREATE POLICY "time_entries_select" ON public.time_entries
  FOR SELECT USING (
    user_id = auth.uid()
    OR (
      public.is_super_admin()
      AND EXISTS (
        SELECT 1 FROM public.profiles pr
        WHERE pr.id = time_entries.user_id
          AND pr.organization_id = public.get_my_org_id()
      )
    )
  );

CREATE POLICY "time_entries_update" ON public.time_entries
  FOR UPDATE USING (
    user_id = auth.uid()
    OR (
      public.is_super_admin()
      AND EXISTS (
        SELECT 1 FROM public.profiles pr
        WHERE pr.id = time_entries.user_id
          AND pr.organization_id = public.get_my_org_id()
      )
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 10. ACTIVITY LOGS — scope to own org's workspaces
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "activity_logs_select" ON public.activity_logs;

CREATE POLICY "activity_logs_select" ON public.activity_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.tasks t
      JOIN public.projects p ON t.project_id = p.id
      WHERE t.id = activity_logs.task_id
        AND public.is_in_workspace(p.workspace_id)
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 11. ATTENDANCE RECORDS — scope super_admin to own org users
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "attendance_select_own"  ON public.attendance_records;
DROP POLICY IF EXISTS "attendance_insert_own"  ON public.attendance_records;
DROP POLICY IF EXISTS "attendance_update"      ON public.attendance_records;

CREATE OR REPLACE FUNCTION public.is_same_org_user(p_user_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = p_user_id AND organization_id = public.get_my_org_id()
  );
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

CREATE POLICY "attendance_select_own" ON public.attendance_records
  FOR SELECT USING (
    user_id = auth.uid()
    OR (public.is_super_admin() AND public.is_same_org_user(user_id))
  );

CREATE POLICY "attendance_insert_own" ON public.attendance_records
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    OR (public.is_super_admin() AND public.is_same_org_user(user_id))
  );

CREATE POLICY "attendance_update" ON public.attendance_records
  FOR UPDATE USING (
    user_id = auth.uid()
    OR (public.is_super_admin() AND public.is_same_org_user(user_id))
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 12. ATTENDANCE SETTINGS — replace USING (true) with org-scoped SELECT
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "settings_select"      ON public.attendance_settings;
DROP POLICY IF EXISTS "settings_write_admin" ON public.attendance_settings;

CREATE POLICY "settings_select" ON public.attendance_settings
  FOR SELECT USING (organization_id = public.get_my_org_id());

CREATE POLICY "settings_write_admin" ON public.attendance_settings
  FOR ALL USING (
    public.is_super_admin()
    AND organization_id = public.get_my_org_id()
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 13. FOOTBALL RULES — replace USING (true) with org-scoped SELECT
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "football_select"      ON public.football_rules;
DROP POLICY IF EXISTS "football_write_admin" ON public.football_rules;

CREATE POLICY "football_select" ON public.football_rules
  FOR SELECT USING (organization_id = public.get_my_org_id());

CREATE POLICY "football_write_admin" ON public.football_rules
  FOR ALL USING (
    public.is_super_admin()
    AND organization_id = public.get_my_org_id()
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 14. LEAVE BALANCES — scope super_admin to own org users
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "leave_balances_own"         ON public.leave_balances;
DROP POLICY IF EXISTS "leave_balances_write_admin" ON public.leave_balances;

CREATE POLICY "leave_balances_own" ON public.leave_balances
  FOR SELECT USING (
    user_id = auth.uid()
    OR (public.is_super_admin() AND public.is_same_org_user(user_id))
  );

CREATE POLICY "leave_balances_write_admin" ON public.leave_balances
  FOR ALL USING (
    public.is_super_admin()
    AND public.is_same_org_user(user_id)
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 15. LEAVE REQUESTS — scope super_admin to own org users
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "leave_requests_select"      ON public.leave_requests;
DROP POLICY IF EXISTS "leave_requests_update"      ON public.leave_requests;

CREATE POLICY "leave_requests_select" ON public.leave_requests
  FOR SELECT USING (
    user_id = auth.uid()
    OR (public.is_super_admin() AND public.is_same_org_user(user_id))
  );

CREATE POLICY "leave_requests_update" ON public.leave_requests
  FOR UPDATE USING (
    (user_id = auth.uid() AND status = 'pending')
    OR (public.is_super_admin() AND public.is_same_org_user(user_id))
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 16. TEAMS — replace USING (true) with org-scoped SELECT
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "teams_select" ON public.teams;
DROP POLICY IF EXISTS "teams_update" ON public.teams;
DROP POLICY IF EXISTS "teams_delete" ON public.teams;
DROP POLICY IF EXISTS "teams_insert" ON public.teams;

CREATE POLICY "teams_select" ON public.teams
  FOR SELECT USING (organization_id = public.get_my_org_id());

CREATE POLICY "teams_insert" ON public.teams
  FOR INSERT WITH CHECK (
    public.is_super_admin()
    AND organization_id = public.get_my_org_id()
  );

CREATE POLICY "teams_update" ON public.teams
  FOR UPDATE USING (
    organization_id = public.get_my_org_id()
    AND (auth.uid() = created_by OR public.is_super_admin())
  );

CREATE POLICY "teams_delete" ON public.teams
  FOR DELETE USING (
    organization_id = public.get_my_org_id()
    AND (auth.uid() = created_by OR public.is_super_admin())
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 17. TEAM MEMBERS — replace USING (true) with org-scoped access via team
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "tm_select" ON public.team_members;
DROP POLICY IF EXISTS "tm_insert" ON public.team_members;
DROP POLICY IF EXISTS "tm_delete" ON public.team_members;

CREATE POLICY "tm_select" ON public.team_members
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.teams t
      WHERE t.id = team_members.team_id
        AND t.organization_id = public.get_my_org_id()
    )
  );

CREATE POLICY "tm_insert" ON public.team_members
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.teams t
      WHERE t.id = team_members.team_id
        AND t.organization_id = public.get_my_org_id()
    )
    AND public.is_super_admin()
  );

CREATE POLICY "tm_delete" ON public.team_members
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.teams t
      WHERE t.id = team_members.team_id
        AND t.organization_id = public.get_my_org_id()
    )
    AND public.is_super_admin()
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 18. TASK STATUSES — replace USING (true) with org-scoped SELECT
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "ts_select" ON public.task_statuses;
DROP POLICY IF EXISTS "ts_insert" ON public.task_statuses;
DROP POLICY IF EXISTS "ts_update" ON public.task_statuses;
DROP POLICY IF EXISTS "ts_delete" ON public.task_statuses;

CREATE POLICY "ts_select" ON public.task_statuses
  FOR SELECT USING (organization_id = public.get_my_org_id());

CREATE POLICY "ts_insert" ON public.task_statuses
  FOR INSERT WITH CHECK (
    public.is_super_admin() AND organization_id = public.get_my_org_id()
  );

CREATE POLICY "ts_update" ON public.task_statuses
  FOR UPDATE USING (
    public.is_super_admin() AND organization_id = public.get_my_org_id()
  );

CREATE POLICY "ts_delete" ON public.task_statuses
  FOR DELETE USING (
    public.is_super_admin() AND organization_id = public.get_my_org_id()
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 19. TASK PRIORITIES — replace USING (true) with org-scoped SELECT
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "tp_select" ON public.task_priorities;
DROP POLICY IF EXISTS "tp_insert" ON public.task_priorities;
DROP POLICY IF EXISTS "tp_update" ON public.task_priorities;
DROP POLICY IF EXISTS "tp_delete" ON public.task_priorities;

CREATE POLICY "tp_select" ON public.task_priorities
  FOR SELECT USING (organization_id = public.get_my_org_id());

CREATE POLICY "tp_insert" ON public.task_priorities
  FOR INSERT WITH CHECK (
    public.is_super_admin() AND organization_id = public.get_my_org_id()
  );

CREATE POLICY "tp_update" ON public.task_priorities
  FOR UPDATE USING (
    public.is_super_admin() AND organization_id = public.get_my_org_id()
  );

CREATE POLICY "tp_delete" ON public.task_priorities
  FOR DELETE USING (
    public.is_super_admin() AND organization_id = public.get_my_org_id()
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 20. CUSTOM ROLES — replace USING (true) with org-scoped SELECT
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "custom_roles_select" ON public.custom_roles;
DROP POLICY IF EXISTS "custom_roles_insert" ON public.custom_roles;
DROP POLICY IF EXISTS "custom_roles_update" ON public.custom_roles;
DROP POLICY IF EXISTS "custom_roles_delete" ON public.custom_roles;

CREATE POLICY "custom_roles_select" ON public.custom_roles
  FOR SELECT USING (organization_id = public.get_my_org_id());

CREATE POLICY "custom_roles_insert" ON public.custom_roles
  FOR INSERT WITH CHECK (
    public.is_super_admin() AND organization_id = public.get_my_org_id()
  );

CREATE POLICY "custom_roles_update" ON public.custom_roles
  FOR UPDATE USING (
    public.is_super_admin() AND organization_id = public.get_my_org_id()
  );

CREATE POLICY "custom_roles_delete" ON public.custom_roles
  FOR DELETE USING (
    public.is_super_admin() AND organization_id = public.get_my_org_id()
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 21. OPTIONAL LEAVE TEMPLATES — scope to own org
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can view own optional leaves" ON public.optional_leave_templates;

DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE tablename = 'optional_leave_templates' AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.optional_leave_templates', pol.policyname);
  END LOOP;
END $$;

ALTER TABLE public.optional_leave_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "olt_select" ON public.optional_leave_templates
  FOR SELECT USING (organization_id = public.get_my_org_id());

CREATE POLICY "olt_insert" ON public.optional_leave_templates
  FOR INSERT WITH CHECK (
    public.is_super_admin() AND organization_id = public.get_my_org_id()
  );

CREATE POLICY "olt_update" ON public.optional_leave_templates
  FOR UPDATE USING (
    public.is_super_admin() AND organization_id = public.get_my_org_id()
  );

CREATE POLICY "olt_delete" ON public.optional_leave_templates
  FOR DELETE USING (
    public.is_super_admin() AND organization_id = public.get_my_org_id()
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 22. PROJECT MEMBERS — scope to own org via project workspace
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "project_members_select" ON public.project_members;
DROP POLICY IF EXISTS "project_members_insert" ON public.project_members;
DROP POLICY IF EXISTS "project_members_update" ON public.project_members;
DROP POLICY IF EXISTS "project_members_delete" ON public.project_members;

CREATE POLICY "project_members_select" ON public.project_members
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_members.project_id
        AND public.is_in_workspace(p.workspace_id)
    )
  );

CREATE POLICY "project_members_insert" ON public.project_members
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_members.project_id
        AND public.is_in_workspace(p.workspace_id)
    )
  );

CREATE POLICY "project_members_update" ON public.project_members
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_members.project_id
        AND public.is_in_workspace(p.workspace_id)
    )
  );

CREATE POLICY "project_members_delete" ON public.project_members
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_members.project_id
        AND public.is_in_workspace(p.workspace_id)
    )
  );
