-- ── Multi-tenancy: Organizations ─────────────────────────────────────────────

-- 1. Organizations table
CREATE TABLE IF NOT EXISTS public.organizations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL UNIQUE,
  logo_url    TEXT,
  created_by  UUID,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- 2. Add organization_id to root tables (nullable first for backfill)
ALTER TABLE public.profiles                ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL;
ALTER TABLE public.workspaces              ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.teams                   ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.attendance_settings     ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.football_rules          ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.optional_leave_templates ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.custom_roles            ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
-- task_statuses and task_priorities are the actual table names used in the app
ALTER TABLE public.task_statuses           ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.task_priorities         ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

-- 3. Seed default org for existing Instawebworks data
INSERT INTO public.organizations (id, name, slug)
VALUES ('00000000-0000-0000-0000-000000000001', 'Instawebworks', 'instawebworks')
ON CONFLICT (id) DO NOTHING;

-- 4. Backfill all existing rows
UPDATE public.profiles               SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE public.workspaces             SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE public.teams                  SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE public.attendance_settings    SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE public.football_rules         SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE public.optional_leave_templates SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE public.custom_roles           SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE public.task_statuses          SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE public.task_priorities        SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;

-- 5. Indexes
CREATE INDEX IF NOT EXISTS idx_profiles_org              ON public.profiles(organization_id);
CREATE INDEX IF NOT EXISTS idx_workspaces_org            ON public.workspaces(organization_id);
CREATE INDEX IF NOT EXISTS idx_teams_org                 ON public.teams(organization_id);
CREATE INDEX IF NOT EXISTS idx_attendance_settings_org   ON public.attendance_settings(organization_id);
CREATE INDEX IF NOT EXISTS idx_football_rules_org        ON public.football_rules(organization_id);
CREATE INDEX IF NOT EXISTS idx_optional_leave_templates_org ON public.optional_leave_templates(organization_id);
CREATE INDEX IF NOT EXISTS idx_custom_roles_org          ON public.custom_roles(organization_id);
CREATE INDEX IF NOT EXISTS idx_task_statuses_org         ON public.task_statuses(organization_id);
CREATE INDEX IF NOT EXISTS idx_task_priorities_org       ON public.task_priorities(organization_id);

-- 6. Helper function to get current user's org_id
CREATE OR REPLACE FUNCTION public.get_my_org_id()
RETURNS UUID AS $$
  SELECT organization_id FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- 7. Organizations RLS policies
CREATE POLICY "orgs_select" ON public.organizations
  FOR SELECT USING (id = public.get_my_org_id());

CREATE POLICY "orgs_update" ON public.organizations
  FOR UPDATE USING (
    id = public.get_my_org_id()
    AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

-- 8. Update profiles RLS to scope by org (drop old policies first)
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update" ON public.profiles;

CREATE POLICY "profiles_select_own_org" ON public.profiles
  FOR SELECT USING (
    organization_id = public.get_my_org_id()
    OR id = auth.uid()
  );

CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE USING (id = auth.uid());
