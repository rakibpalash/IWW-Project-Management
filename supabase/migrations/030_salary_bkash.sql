-- =============================================================================
-- Migration 030: Staff Salaries & Bkash Payment Tracking
-- Adds salary management (super_admin only) and Bkash payment recording
-- =============================================================================

-- ── Staff Salaries Table ──────────────────────────────────────────────────────
-- Stores current monthly salary per staff member.
-- Only the super_admin of the same organisation can access this table (RLS).
CREATE TABLE IF NOT EXISTS public.staff_salaries (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  organization_id UUID        NOT NULL,
  monthly_salary  INTEGER     NOT NULL DEFAULT 0 CHECK (monthly_salary >= 0),
  effective_from  DATE        NOT NULL DEFAULT CURRENT_DATE,
  currency        TEXT        NOT NULL DEFAULT 'BDT',
  notes           TEXT,
  created_by      UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS staff_salaries_user_id_idx
  ON public.staff_salaries (user_id);

CREATE INDEX IF NOT EXISTS staff_salaries_org_id_idx
  ON public.staff_salaries (organization_id);

-- RLS: Only super_admin of the same org can manage salaries
ALTER TABLE public.staff_salaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "super_admin_manage_salaries" ON public.staff_salaries
  FOR ALL
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM public.profiles
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.profiles
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

-- ── Fine Payment Method Tracking on attendance_records ────────────────────────
ALTER TABLE public.attendance_records
  ADD COLUMN IF NOT EXISTS fine_payment_method TEXT DEFAULT 'cash'
    CHECK (fine_payment_method IN ('cash', 'bkash', 'bank', 'salary_deduction')),
  ADD COLUMN IF NOT EXISTS fine_bkash_txn_id TEXT;

-- ── Organisation bKash Number in Attendance Settings ─────────────────────────
-- Admins can store their bKash personal/merchant number for payment instructions
ALTER TABLE public.attendance_settings
  ADD COLUMN IF NOT EXISTS org_bkash_number TEXT;
