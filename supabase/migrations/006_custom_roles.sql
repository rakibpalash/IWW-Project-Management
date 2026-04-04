-- ── Custom Roles (org-level job titles) ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.custom_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  color TEXT NOT NULL DEFAULT '#6366f1',
  description TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.custom_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "custom_roles_select" ON public.custom_roles FOR SELECT USING (true);
CREATE POLICY "custom_roles_insert" ON public.custom_roles FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_admin')
);
CREATE POLICY "custom_roles_update" ON public.custom_roles FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_admin')
);
CREATE POLICY "custom_roles_delete" ON public.custom_roles FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_admin')
);

-- Add custom_role_id to profiles (job title)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS custom_role_id UUID REFERENCES public.custom_roles(id) ON DELETE SET NULL;

-- ── Project Members (project-level team assignments) ──────────────────────────

CREATE TABLE IF NOT EXISTS public.project_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_role TEXT NOT NULL DEFAULT 'member' CHECK (project_role IN ('lead', 'member')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(project_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_project_members_project ON public.project_members(project_id);
CREATE INDEX IF NOT EXISTS idx_project_members_user ON public.project_members(user_id);

ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "project_members_select" ON public.project_members FOR SELECT USING (true);
CREATE POLICY "project_members_insert" ON public.project_members FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "project_members_update" ON public.project_members FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "project_members_delete" ON public.project_members FOR DELETE USING (auth.uid() IS NOT NULL);
