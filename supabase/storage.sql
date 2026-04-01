-- =============================================================================
-- IWW Project Management Tools — Storage Setup
-- Run this in the Supabase SQL Editor after schema.sql and seed.sql
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Avatars bucket
-- 5 MB file size limit, common image types only
-- -----------------------------------------------------------------------------
INSERT INTO storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
VALUES (
  'avatars',
  'avatars',
  true,
  5242880, -- 5 MB in bytes
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- RLS policies for the avatars bucket
-- -----------------------------------------------------------------------------

-- Anyone (including anonymous visitors) can view avatars
CREATE POLICY "Avatar images are publicly accessible."
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'avatars');

-- Authenticated users can upload new avatars
CREATE POLICY "Authenticated users can upload an avatar."
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'avatars');

-- Users can only update their own avatar files
-- Avatar files are stored as: avatars/<user_id>/<filename>
CREATE POLICY "Users can update their own avatar."
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Users can only delete their own avatar files
CREATE POLICY "Users can delete their own avatar."
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- -----------------------------------------------------------------------------
-- Project attachments bucket (private — requires signed URLs)
-- 50 MB file size limit
-- -----------------------------------------------------------------------------
INSERT INTO storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
VALUES (
  'project-attachments',
  'project-attachments',
  false,
  52428800, -- 50 MB in bytes
  ARRAY[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
    'text/csv'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- RLS policies for project-attachments bucket
-- -----------------------------------------------------------------------------

-- Authenticated users can view project attachments
-- (fine-grained per-project access is enforced at the application layer)
CREATE POLICY "Authenticated users can view project attachments."
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'project-attachments');

-- Authenticated users can upload project attachments
CREATE POLICY "Authenticated users can upload project attachments."
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'project-attachments');

-- Users can update attachments they uploaded
CREATE POLICY "Users can update their own project attachments."
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'project-attachments'
    AND owner = auth.uid()
  );

-- Users can delete attachments they uploaded; admins handled at app layer
CREATE POLICY "Users can delete their own project attachments."
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'project-attachments'
    AND owner = auth.uid()
  );
