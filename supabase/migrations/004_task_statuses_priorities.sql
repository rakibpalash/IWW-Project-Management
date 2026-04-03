-- =============================================================================
-- Migration 004: Custom Task Statuses and Priorities
-- Creates configurable task_statuses and task_priorities tables.
-- Seeds default values matching current hardcoded constants so existing
-- tasks continue to work without any tasks-table changes.
-- =============================================================================

-- ── task_statuses ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS task_statuses (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                  TEXT NOT NULL,
  slug                  TEXT NOT NULL UNIQUE,   -- value stored in tasks.status
  color                 TEXT NOT NULL DEFAULT '#94a3b8',
  sort_order            INTEGER NOT NULL DEFAULT 0,
  is_active             BOOLEAN NOT NULL DEFAULT true,
  is_default            BOOLEAN NOT NULL DEFAULT false,
  is_completed_status   BOOLEAN NOT NULL DEFAULT false,
  counts_toward_progress BOOLEAN NOT NULL DEFAULT true,
  created_by            UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE task_statuses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ts_select" ON task_statuses;
CREATE POLICY "ts_select" ON task_statuses FOR SELECT USING (true);

DROP POLICY IF EXISTS "ts_insert" ON task_statuses;
CREATE POLICY "ts_insert" ON task_statuses FOR INSERT WITH CHECK (is_super_admin());

DROP POLICY IF EXISTS "ts_update" ON task_statuses;
CREATE POLICY "ts_update" ON task_statuses FOR UPDATE USING (is_super_admin());

DROP POLICY IF EXISTS "ts_delete" ON task_statuses;
CREATE POLICY "ts_delete" ON task_statuses FOR DELETE USING (is_super_admin());

-- Seed defaults (slugs match current hardcoded task.status values)
INSERT INTO task_statuses (name, slug, color, sort_order, is_active, is_default, is_completed_status, counts_toward_progress) VALUES
  ('To Do',       'todo',        '#94a3b8', 1, true, true,  false, true),
  ('In Progress', 'in_progress', '#f59e0b', 2, true, false, false, true),
  ('In Review',   'in_review',   '#3b82f6', 3, true, false, false, true),
  ('Done',        'done',        '#22c55e', 4, true, false, true,  true),
  ('Cancelled',   'cancelled',   '#ef4444', 5, true, false, true,  false)
ON CONFLICT (slug) DO NOTHING;

-- ── task_priorities ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS task_priorities (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL UNIQUE,   -- value stored in tasks.priority
  color       TEXT NOT NULL DEFAULT '#6366f1',
  sort_order  INTEGER NOT NULL DEFAULT 0,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  is_default  BOOLEAN NOT NULL DEFAULT false,
  created_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE task_priorities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tp_select" ON task_priorities;
CREATE POLICY "tp_select" ON task_priorities FOR SELECT USING (true);

DROP POLICY IF EXISTS "tp_insert" ON task_priorities;
CREATE POLICY "tp_insert" ON task_priorities FOR INSERT WITH CHECK (is_super_admin());

DROP POLICY IF EXISTS "tp_update" ON task_priorities;
CREATE POLICY "tp_update" ON task_priorities FOR UPDATE USING (is_super_admin());

DROP POLICY IF EXISTS "tp_delete" ON task_priorities;
CREATE POLICY "tp_delete" ON task_priorities FOR DELETE USING (is_super_admin());

-- Seed defaults (slugs match current hardcoded task.priority values)
INSERT INTO task_priorities (name, slug, color, sort_order, is_active, is_default) VALUES
  ('Low',    'low',    '#3b82f6', 1, true, false),
  ('Medium', 'medium', '#f59e0b', 2, true, true),
  ('High',   'high',   '#f97316', 3, true, false),
  ('Urgent', 'urgent', '#ef4444', 4, true, false)
ON CONFLICT (slug) DO NOTHING;
