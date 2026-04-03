-- =============================================================================
-- Migration 002: Fix infinite recursion in tasks RLS policy
--
-- Root cause:
--   tasks_update policy  → queries task_assignees (EXISTS subquery)
--   ta_write policy (FOR ALL, incl. SELECT) → queries back into tasks
--   → infinite loop: tasks → task_assignees → tasks → ...
--
-- Fix:
--   Add is_task_assignee() SECURITY DEFINER function that reads
--   task_assignees without triggering its RLS policies, breaking the cycle.
--   Update tasks_update policy to use this function.
-- =============================================================================

-- 1. Create SECURITY DEFINER helper (bypasses RLS on task_assignees)
CREATE OR REPLACE FUNCTION is_task_assignee(p_task_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM task_assignees
    WHERE task_id = p_task_id AND user_id = auth.uid()
  );
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- 2. Replace the recursive tasks_update policy
DROP POLICY IF EXISTS "tasks_update" ON tasks;
CREATE POLICY "tasks_update" ON tasks
  FOR UPDATE USING (
    is_super_admin()
    OR created_by = auth.uid()
    OR is_task_assignee(id)
  );
