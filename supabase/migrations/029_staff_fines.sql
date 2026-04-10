-- =============================================================================
-- Migration 029: Staff Late Fine System
-- Adds configurable fine amounts to settings and fine tracking on records
-- =============================================================================

-- ── Fine amounts in settings (configurable per org) ───────────────────────────
ALTER TABLE public.attendance_settings
  ADD COLUMN IF NOT EXISTS fine_late_1 INTEGER NOT NULL DEFAULT 150,
  ADD COLUMN IF NOT EXISTS fine_late_2 INTEGER NOT NULL DEFAULT 250;

-- ── Fine tracking columns on attendance_records ───────────────────────────────
ALTER TABLE public.attendance_records
  ADD COLUMN IF NOT EXISTS fine_amount    INTEGER   NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fine_status    TEXT      NOT NULL DEFAULT 'none'
    CHECK (fine_status IN ('none', 'pending', 'paid', 'waived')),
  ADD COLUMN IF NOT EXISTS fine_paid_at        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS fine_waived_by      UUID REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS fine_waived_reason  TEXT;

-- ── Back-fill fine amounts for existing late records (using default amounts) ──
UPDATE public.attendance_records
SET
  fine_amount = CASE
    WHEN status = 'late_150' THEN 150
    WHEN status = 'late_250' THEN 250
    ELSE 0
  END,
  fine_status = CASE
    WHEN status IN ('late_150', 'late_250') THEN 'pending'
    ELSE 'none'
  END
WHERE status IN ('late_150', 'late_250');
