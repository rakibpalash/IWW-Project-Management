-- =============================================================================
-- Migration 033: Fix optional_leaves org isolation
--
-- The original RLS policies only checked role = 'super_admin' without scoping
-- to the admin's own organization. A super_admin from Org A could read/write
-- Org B's optional_leaves records.
-- =============================================================================

-- Drop old unscoped policies
DROP POLICY IF EXISTS "Users can view own optional leaves" ON public.optional_leaves;
DROP POLICY IF EXISTS "Admins can insert optional leaves"  ON public.optional_leaves;
DROP POLICY IF EXISTS "Admins can update optional leaves"  ON public.optional_leaves;
DROP POLICY IF EXISTS "Admins can delete optional leaves"  ON public.optional_leaves;

-- SELECT: own row OR super_admin in same org
CREATE POLICY "optional_leaves_select" ON public.optional_leaves
  FOR SELECT USING (
    user_id = auth.uid()
    OR (
      public.is_super_admin()
      AND public.is_same_org_user(user_id)
    )
  );

-- INSERT: super_admin scoped to own org users only
CREATE POLICY "optional_leaves_insert" ON public.optional_leaves
  FOR INSERT WITH CHECK (
    public.is_super_admin()
    AND public.is_same_org_user(user_id)
  );

-- UPDATE: super_admin scoped to own org users only
CREATE POLICY "optional_leaves_update" ON public.optional_leaves
  FOR UPDATE USING (
    public.is_super_admin()
    AND public.is_same_org_user(user_id)
  );

-- DELETE: super_admin scoped to own org users only
CREATE POLICY "optional_leaves_delete" ON public.optional_leaves
  FOR DELETE USING (
    public.is_super_admin()
    AND public.is_same_org_user(user_id)
  );
