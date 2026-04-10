-- Migration 026: Seed default task statuses & priorities for every org
-- ─────────────────────────────────────────────────────────────────────────────
-- Fix unique constraints first: slug uniqueness must be scoped to org, not global.
-- Then seed defaults for all existing orgs and add a trigger for new orgs.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Fix unique constraints (global slug → per-org slug) ───────────────────

-- task_statuses: drop global unique on slug, add composite unique on (org, slug)
ALTER TABLE public.task_statuses
  DROP CONSTRAINT IF EXISTS task_statuses_slug_key;

ALTER TABLE public.task_statuses
  ADD CONSTRAINT task_statuses_org_slug_key UNIQUE (organization_id, slug);

-- task_priorities: same fix
ALTER TABLE public.task_priorities
  DROP CONSTRAINT IF EXISTS task_priorities_slug_key;

ALTER TABLE public.task_priorities
  ADD CONSTRAINT task_priorities_org_slug_key UNIQUE (organization_id, slug);

-- ── 2. Seed function ──────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.seed_org_defaults(p_org_id UUID)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  -- Task statuses (only if this org has none)
  IF NOT EXISTS (
    SELECT 1 FROM public.task_statuses WHERE organization_id = p_org_id
  ) THEN
    INSERT INTO public.task_statuses
      (organization_id, name, slug, color, sort_order, is_active, is_default, is_completed_status, counts_toward_progress)
    VALUES
      (p_org_id, 'To Do',       'todo',        '#94a3b8', 1, true, true,  false, true),
      (p_org_id, 'In Progress', 'in_progress', '#f59e0b', 2, true, false, false, true),
      (p_org_id, 'In Review',   'in_review',   '#3b82f6', 3, true, false, false, true),
      (p_org_id, 'Done',        'done',        '#22c55e', 4, true, false, true,  true),
      (p_org_id, 'Cancelled',   'cancelled',   '#ef4444', 5, true, false, true,  false);
  END IF;

  -- Task priorities (only if this org has none)
  IF NOT EXISTS (
    SELECT 1 FROM public.task_priorities WHERE organization_id = p_org_id
  ) THEN
    INSERT INTO public.task_priorities
      (organization_id, name, slug, color, sort_order, is_active, is_default)
    VALUES
      (p_org_id, 'Low',    'low',    '#3b82f6', 1, true, false),
      (p_org_id, 'Medium', 'medium', '#f59e0b', 2, true, true),
      (p_org_id, 'High',   'high',   '#f97316', 3, true, false),
      (p_org_id, 'Urgent', 'urgent', '#ef4444', 4, true, false);
  END IF;
END;
$$;

-- ── 3. Back-fill all existing orgs that have no statuses/priorities ───────────

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT DISTINCT organization_id
    FROM public.profiles
    WHERE organization_id IS NOT NULL
  LOOP
    PERFORM public.seed_org_defaults(r.organization_id);
  END LOOP;
END;
$$;

-- ── 4. Auto-seed trigger for new orgs ────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.trg_seed_org_on_admin_insert()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.role = 'super_admin' AND NEW.organization_id IS NOT NULL THEN
    PERFORM public.seed_org_defaults(NEW.organization_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_seed_org_defaults ON public.profiles;
CREATE TRIGGER trg_seed_org_defaults
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_seed_org_on_admin_insert();
