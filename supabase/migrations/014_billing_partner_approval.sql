-- Migration 014: Billing types, partner links, and timesheet approval
-- Adds partner_id + is_internal + billing_type to projects
-- Adds billable flag to tasks
-- Adds approval workflow fields to time_entries

-- ── Projects ──────────────────────────────────────────────────────────────────

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS partner_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS is_internal BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS billing_type TEXT DEFAULT 'hourly'
  CHECK (billing_type IN ('hourly', 'fixed', 'retainer', 'non_billable'));

-- ── Tasks ─────────────────────────────────────────────────────────────────────

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS billable BOOLEAN NOT NULL DEFAULT true;

-- ── Time Entries (approval workflow) ──────────────────────────────────────────

ALTER TABLE public.time_entries
  ADD COLUMN IF NOT EXISTS is_billable BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE public.time_entries
  ADD COLUMN IF NOT EXISTS approval_status TEXT NOT NULL DEFAULT 'pending'
  CHECK (approval_status IN ('pending', 'approved', 'rejected'));

ALTER TABLE public.time_entries
  ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.time_entries
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;

-- Index for approval queries
CREATE INDEX IF NOT EXISTS idx_time_entries_approval ON time_entries(approval_status);
