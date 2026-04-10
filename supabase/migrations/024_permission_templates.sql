-- Migration 024: Permission Templates
-- Org-scoped, user-defined permission templates that can be applied when creating/editing users.

CREATE TABLE IF NOT EXISTS public.permission_templates (
  id              UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID        NOT NULL,
  name            TEXT        NOT NULL,
  description     TEXT,
  base_role       TEXT        NOT NULL DEFAULT 'staff',  -- which role this template is designed for
  permissions     JSONB       NOT NULL DEFAULT '{}',
  is_default      BOOLEAN     NOT NULL DEFAULT false,    -- marks the org's preferred default for that role
  created_by      UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_permission_templates_org ON public.permission_templates(organization_id);

CREATE OR REPLACE FUNCTION update_permission_templates_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_permission_templates_updated_at ON public.permission_templates;
CREATE TRIGGER trg_permission_templates_updated_at
  BEFORE UPDATE ON public.permission_templates
  FOR EACH ROW EXECUTE FUNCTION update_permission_templates_updated_at();

-- ── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE public.permission_templates ENABLE ROW LEVEL SECURITY;

-- Super admins can fully manage templates in their org
CREATE POLICY "super_admin_manage_templates"
  ON public.permission_templates FOR ALL
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'super_admin'
    AND organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
  )
  WITH CHECK (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'super_admin'
    AND organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
  );

-- All org members can read templates (needed for create-user dialog)
CREATE POLICY "org_members_read_templates"
  ON public.permission_templates FOR SELECT
  USING (
    organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
  );
