-- Migration 023: User Permissions System
-- Stores per-user custom permission overrides.
-- When no row exists for a user, the app falls back to their role's default template.

CREATE TABLE IF NOT EXISTS public.user_permissions (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  permissions JSONB       NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_permissions_user_id ON public.user_permissions(user_id);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_user_permissions_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_user_permissions_updated_at ON public.user_permissions;
CREATE TRIGGER trg_user_permissions_updated_at
  BEFORE UPDATE ON public.user_permissions
  FOR EACH ROW EXECUTE FUNCTION update_user_permissions_updated_at();

-- ── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;

-- Super admins can manage permissions for users in the same org
CREATE POLICY "super_admin_manage_permissions"
  ON public.user_permissions FOR ALL
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'super_admin'
    AND (
      SELECT organization_id FROM public.profiles WHERE id = user_id
    ) = (
      SELECT organization_id FROM public.profiles WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'super_admin'
    AND (
      SELECT organization_id FROM public.profiles WHERE id = user_id
    ) = (
      SELECT organization_id FROM public.profiles WHERE id = auth.uid()
    )
  );

-- Every user can read their own permissions row
CREATE POLICY "users_read_own_permissions"
  ON public.user_permissions FOR SELECT
  USING (user_id = auth.uid());
