-- Migration 025: Enable Realtime for workspace-related tables

DO $$
BEGIN
  -- workspaces
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'workspaces'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.workspaces;
  END IF;

  -- workspace_assignments
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'workspace_assignments'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.workspace_assignments;
  END IF;

  -- projects
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'projects'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.projects;
  END IF;
END $$;
