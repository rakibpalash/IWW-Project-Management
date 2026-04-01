-- =============================================================================
-- IWW Project Management Tools — Seed / Bootstrap SQL
-- =============================================================================

-- Ensure attendance_settings singleton exists (schema.sql already inserts it,
-- this is a safety guard in case it was missed)
INSERT INTO public.attendance_settings (
  on_time_end,
  late_150_end,
  late_250_end,
  football_on_time_end,
  football_late_150_end,
  football_late_250_end,
  yearly_leave_days,
  wfh_days
)
SELECT
  '09:00', '09:30', '11:00',
  '09:45', '10:30', '11:00',
  18, 10
WHERE NOT EXISTS (
  SELECT 1 FROM public.attendance_settings LIMIT 1
);

-- =============================================================================
-- HOW TO CREATE THE FIRST SUPER ADMIN (run after this seed)
--
-- Step 1: Go to Supabase Dashboard → Authentication → Users
--         Click "Add user" and create with email + password
--
-- Step 2: Run this SQL (replace with your admin email):
--   UPDATE public.profiles SET role = 'super_admin'
--   WHERE email = 'admin@yourcompany.com';
--
-- That's it! Super Admin can then create Staff and Client accounts
-- from within the app at /settings → Team Management.
-- =============================================================================
