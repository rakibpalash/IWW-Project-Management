-- ============================================================
-- MIGRATION: Rename workspaces→spaces, projects→lists
-- Run this in Supabase SQL Editor
-- BACK UP YOUR DATABASE FIRST!
-- ============================================================

-- Step 1: Rename tables
ALTER TABLE IF EXISTS workspaces RENAME TO spaces;
ALTER TABLE IF EXISTS projects RENAME TO lists;
ALTER TABLE IF EXISTS workspace_assignments RENAME TO space_assignments;
ALTER TABLE IF EXISTS project_members RENAME TO list_members;

-- Step 2: Rename columns
-- In lists (formerly projects): workspace_id → space_id
ALTER TABLE IF EXISTS lists RENAME COLUMN workspace_id TO space_id;

-- In space_assignments (formerly workspace_assignments): workspace_id → space_id
ALTER TABLE IF EXISTS space_assignments RENAME COLUMN workspace_id TO space_id;

-- In tasks: project_id → list_id
ALTER TABLE IF EXISTS tasks RENAME COLUMN project_id TO list_id;

-- In list_members (formerly project_members): project_id → list_id
ALTER TABLE IF EXISTS list_members RENAME COLUMN project_id TO list_id;

-- In task_statuses / task_priorities (if they have project_id)
-- ALTER TABLE IF EXISTS task_statuses RENAME COLUMN project_id TO list_id;

-- Step 3: Update RLS policies
-- Drop and recreate RLS policies that reference old table/column names.
-- NOTE: You may need to check existing policies in the Supabase dashboard
-- under Authentication > Policies and update any that reference
-- 'workspaces', 'projects', 'workspace_id', or 'project_id' by name.

-- Step 4: Update any views or functions that reference old names
-- Check in Database > Functions and Database > Views for references to
-- workspaces, projects, workspace_id, project_id.

-- ============================================================
-- VERIFICATION QUERIES (run after migration to confirm)
-- ============================================================
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'lists';
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'spaces';
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'tasks';
