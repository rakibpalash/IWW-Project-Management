-- Add is_active flag to profiles
-- Deactivated users are blocked from using the app (their Supabase auth is also banned)

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

-- All existing users are active
UPDATE public.profiles SET is_active = true WHERE is_active IS NULL;

-- Index for fast filtering of active users
CREATE INDEX IF NOT EXISTS idx_profiles_is_active ON public.profiles(is_active);
