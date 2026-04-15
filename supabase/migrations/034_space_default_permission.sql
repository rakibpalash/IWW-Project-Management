-- Add default_permission column to spaces table
ALTER TABLE spaces
  ADD COLUMN IF NOT EXISTS default_permission TEXT NOT NULL DEFAULT 'full_edit'
    CHECK (default_permission IN ('full_edit', 'can_edit', 'view_only', 'no_access'));
