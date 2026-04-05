-- ============================================================
-- SKILLS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'General',
  color TEXT NOT NULL DEFAULT '#6366f1',
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(name)
);

CREATE TABLE IF NOT EXISTS public.profile_skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  skill_id UUID NOT NULL REFERENCES public.skills(id) ON DELETE CASCADE,
  proficiency INTEGER NOT NULL DEFAULT 1 CHECK (proficiency BETWEEN 1 AND 4),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, skill_id)
);

-- RLS
ALTER TABLE public.skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_skills ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "skills_select" ON public.skills;
CREATE POLICY "skills_select" ON public.skills FOR SELECT USING (true);

DROP POLICY IF EXISTS "skills_insert" ON public.skills;
CREATE POLICY "skills_insert" ON public.skills FOR INSERT WITH CHECK (
  get_my_role() IN ('super_admin', 'staff', 'account_manager', 'project_manager')
);

DROP POLICY IF EXISTS "skills_update_admin" ON public.skills;
CREATE POLICY "skills_update_admin" ON public.skills FOR UPDATE USING (is_super_admin());

DROP POLICY IF EXISTS "skills_delete_admin" ON public.skills;
CREATE POLICY "skills_delete_admin" ON public.skills FOR DELETE USING (is_super_admin());

DROP POLICY IF EXISTS "profile_skills_select" ON public.profile_skills;
CREATE POLICY "profile_skills_select" ON public.profile_skills FOR SELECT USING (true);

DROP POLICY IF EXISTS "profile_skills_insert_own" ON public.profile_skills;
CREATE POLICY "profile_skills_insert_own" ON public.profile_skills FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "profile_skills_update_own" ON public.profile_skills;
CREATE POLICY "profile_skills_update_own" ON public.profile_skills FOR UPDATE USING (auth.uid() = user_id OR is_super_admin());

DROP POLICY IF EXISTS "profile_skills_delete_own" ON public.profile_skills;
CREATE POLICY "profile_skills_delete_own" ON public.profile_skills FOR DELETE USING (auth.uid() = user_id OR is_super_admin());

-- Realtime
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'profile_skills'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.profile_skills;
  END IF;
END $$;

-- Default skills seed
INSERT INTO public.skills (name, category, color) VALUES
  ('React', 'Development', '#61DAFB'),
  ('TypeScript', 'Development', '#3178C6'),
  ('JavaScript', 'Development', '#F7DF1E'),
  ('Next.js', 'Development', '#000000'),
  ('Node.js', 'Development', '#339933'),
  ('Python', 'Development', '#3776AB'),
  ('PostgreSQL', 'Development', '#4169E1'),
  ('Tailwind CSS', 'Development', '#06B6D4'),
  ('UI/UX Design', 'Design', '#FF6B6B'),
  ('Figma', 'Design', '#F24E1E'),
  ('Graphic Design', 'Design', '#FF7C00'),
  ('Adobe Photoshop', 'Design', '#31A8FF'),
  ('Project Management', 'Management', '#10B981'),
  ('Agile / Scrum', 'Management', '#059669'),
  ('Team Leadership', 'Management', '#0D9488'),
  ('SEO', 'Marketing', '#F59E0B'),
  ('Content Writing', 'Marketing', '#8B5CF6'),
  ('Social Media', 'Marketing', '#EC4899'),
  ('Communication', 'Soft Skills', '#06B6D4'),
  ('Problem Solving', 'Soft Skills', '#6366F1'),
  ('Time Management', 'Soft Skills', '#F43F5E')
ON CONFLICT (name) DO NOTHING;
