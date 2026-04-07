-- Add manager_id to profiles for org hierarchy
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS manager_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
