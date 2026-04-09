-- Drop hardcoded check constraints on priority and status so that
-- custom values from task_priorities and task_statuses tables are accepted.

ALTER TABLE public.projects DROP CONSTRAINT IF EXISTS projects_priority_check;
ALTER TABLE public.projects DROP CONSTRAINT IF EXISTS projects_status_check;

ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_priority_check;
ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_status_check;
