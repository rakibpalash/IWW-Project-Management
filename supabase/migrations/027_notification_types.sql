-- Migration 027: Expand notification types
-- Adds: comment_added, time_logged, project_member_added, leave_approved, leave_rejected, due_date_approaching

ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check
  CHECK (type IN (
    'task_assigned',
    'subtask_assigned',
    'mention',
    'comment_reply',
    'comment_added',
    'status_changed',
    'task_deleted',
    'time_logged',
    'project_member_added',
    'leave_approved',
    'leave_rejected',
    'due_date_approaching'
  ));
