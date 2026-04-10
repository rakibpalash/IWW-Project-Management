-- =============================================================================
-- Migration 031: Staff Fine Payment Reporting
-- Allows staff to submit their bKash TxnID for admin verification
-- =============================================================================

-- Staff-submitted payment report (separate from admin-confirmed payment)
ALTER TABLE public.attendance_records
  ADD COLUMN IF NOT EXISTS fine_reported_txn_id  TEXT,
  ADD COLUMN IF NOT EXISTS fine_reported_at       TIMESTAMPTZ;

-- Index for admin queries: "show me all fines with pending staff reports"
CREATE INDEX IF NOT EXISTS attendance_records_fine_reported_idx
  ON public.attendance_records (fine_reported_txn_id)
  WHERE fine_reported_txn_id IS NOT NULL;
