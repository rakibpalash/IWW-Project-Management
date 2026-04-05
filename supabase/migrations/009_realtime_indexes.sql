-- Indexes required for Supabase Realtime filtered subscriptions
-- (filter: 'task_id=eq.xxx' needs the column indexed)
CREATE INDEX IF NOT EXISTS idx_comments_task_id      ON public.comments(task_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_task_id ON public.activity_logs(task_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_task_id  ON public.time_entries(task_id);

-- REPLICA IDENTITY FULL allows Realtime to send the full row on UPDATE/DELETE
-- Required for filtered subscriptions to work reliably
ALTER TABLE public.tasks          REPLICA IDENTITY FULL;
ALTER TABLE public.comments       REPLICA IDENTITY FULL;
ALTER TABLE public.activity_logs  REPLICA IDENTITY FULL;
ALTER TABLE public.time_entries   REPLICA IDENTITY FULL;
ALTER TABLE public.profile_skills REPLICA IDENTITY FULL;
