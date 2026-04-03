-- =============================================================================
-- Migration 003: Permanently fix infinite recursion in tasks RLS
--
-- Root cause: ta_write uses FOR ALL (includes SELECT), so any SELECT on
-- task_assignees (from tasks_update policy) triggers ta_write which queries
-- tasks → tasks_update → task_assignees → ta_write → infinite loop.
--
-- Fix: split ta_write into ta_insert + ta_delete (covers writes, never SELECT).
-- Now SELECT on task_assignees only hits ta_select (USING true) — safe.
-- =============================================================================

-- Step 1: Drop the recursive FOR ALL policy
DROP POLICY IF EXISTS "ta_write" ON task_assignees;

-- Step 2: Narrow INSERT policy — admin or task creator only
DROP POLICY IF EXISTS "ta_insert" ON task_assignees;
CREATE POLICY "ta_insert" ON task_assignees
  FOR INSERT WITH CHECK (
    is_super_admin()
    OR EXISTS (
      SELECT 1 FROM tasks t
      WHERE t.id = task_assignees.task_id
        AND t.created_by = auth.uid()
    )
  );

-- Step 3: Narrow DELETE policy — admin or task creator only
DROP POLICY IF EXISTS "ta_delete" ON task_assignees;
CREATE POLICY "ta_delete" ON task_assignees
  FOR DELETE USING (
    is_super_admin()
    OR EXISTS (
      SELECT 1 FROM tasks t
      WHERE t.id = task_assignees.task_id
        AND t.created_by = auth.uid()
    )
  );

-- Step 4: Restore tasks_update to simple inline EXISTS
-- Safe now: SELECT on task_assignees only hits ta_select (USING true),
-- which never queries tasks.
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

-- Step 5: Drop the is_task_assignee() SECURITY DEFINER workaround — no longer needed
DROP FUNCTION IF EXISTS is_task_assignee(UUID);
