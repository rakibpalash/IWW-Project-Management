-- =============================================================================
-- Migration 001: Advanced Attendance Rule System
-- Adds Friday rule, exit times, applied_rule column
-- =============================================================================

-- ── attendance_settings: Friday rule columns ──────────────────────────────────
ALTER TABLE public.attendance_settings
  ADD COLUMN IF NOT EXISTS friday_on_time_end  TIME NOT NULL DEFAULT '08:30',
  ADD COLUMN IF NOT EXISTS friday_late_150_end TIME NOT NULL DEFAULT '09:00',
  ADD COLUMN IF NOT EXISTS friday_late_250_end TIME NOT NULL DEFAULT '11:00',
  ADD COLUMN IF NOT EXISTS exit_time_friday    TIME NOT NULL DEFAULT '12:15';

-- ── attendance_settings: exit time columns ────────────────────────────────────
ALTER TABLE public.attendance_settings
  ADD COLUMN IF NOT EXISTS exit_time_general  TIME NOT NULL DEFAULT '14:15',
  ADD COLUMN IF NOT EXISTS exit_time_football TIME NOT NULL DEFAULT '14:30';

-- ── attendance_records: applied_rule column ───────────────────────────────────
ALTER TABLE public.attendance_records
  ADD COLUMN IF NOT EXISTS applied_rule TEXT NOT NULL DEFAULT 'general'
    CHECK (applied_rule IN ('general', 'friday', 'football', 'holiday'));

-- ── Back-fill existing football records ───────────────────────────────────────
UPDATE public.attendance_records
SET applied_rule = 'football'
WHERE is_football_rule = true AND applied_rule = 'general';

-- ── Back-fill Friday records (day-of-week = 5) ───────────────────────────────
UPDATE public.attendance_records
SET applied_rule = 'friday'
WHERE EXTRACT(DOW FROM date) = 5
  AND is_football_rule = false
  AND applied_rule = 'general';
