-- Add task_deleted to the notifications type enum
ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check
  CHECK (type IN (
    'task_assigned',
    'subtask_assigned',
    'mention',
    'comment_reply',
    'status_changed',
    'task_deleted'
  ));
