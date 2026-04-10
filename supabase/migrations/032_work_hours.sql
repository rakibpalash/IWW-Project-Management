-- =============================================================================
-- Migration 032: Add work_hours_per_week to attendance_settings
-- Used for salary-proportional fine calculation:
--   fine = round(minutes_late × salary / (work_hours_per_week × 4 × 60) × multiplier)
-- =============================================================================

ALTER TABLE public.attendance_settings
  ADD COLUMN IF NOT EXISTS work_hours_per_week INTEGER NOT NULL DEFAULT 30
    CHECK (work_hours_per_week BETWEEN 1 AND 80);
