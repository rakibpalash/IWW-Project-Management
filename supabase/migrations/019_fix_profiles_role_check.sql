-- Fix profiles_role_check constraint to include all valid roles
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('super_admin', 'account_manager', 'project_manager', 'staff', 'client', 'partner'));
