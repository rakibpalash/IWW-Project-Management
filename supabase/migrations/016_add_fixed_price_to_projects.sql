-- Add fixed_price column to projects table for Fixed Price billing type
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS fixed_price NUMERIC(12, 2) DEFAULT NULL;
