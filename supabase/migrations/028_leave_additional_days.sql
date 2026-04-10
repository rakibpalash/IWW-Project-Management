-- Migration 028: Add additional days tracking to leave_balances
-- Matches the Excel sheet structure: Allowed (base) + Additional = Total
-- yearly_total stays as the combined total; yearly_additional records the extra days granted on top of the base.

ALTER TABLE public.leave_balances
  ADD COLUMN IF NOT EXISTS yearly_additional INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS wfh_additional    INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.leave_balances.yearly_additional IS 'Extra annual leave days granted above the standard allocation';
COMMENT ON COLUMN public.leave_balances.wfh_additional    IS 'Extra WFH days granted above the standard allocation';
