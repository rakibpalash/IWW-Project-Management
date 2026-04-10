-- Optional / custom leave grants
-- Admin creates a named leave grant for a specific staff member.
-- Staff can then apply against it; admin approves/rejects like normal leave.

CREATE TABLE IF NOT EXISTS optional_leaves (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT         NOT NULL,                          -- e.g. "Paternity Leave"
  user_id       UUID         NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  granted_by    UUID         REFERENCES profiles(id),
  total_days    INTEGER      NOT NULL DEFAULT 1,
  used_days     NUMERIC      NOT NULL DEFAULT 0,
  year          INTEGER      NOT NULL DEFAULT EXTRACT(YEAR FROM now())::INTEGER,
  notes         TEXT,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_optional_leaves_user ON optional_leaves(user_id);
CREATE INDEX IF NOT EXISTS idx_optional_leaves_year ON optional_leaves(year);

-- Allow authenticated users to read their own optional leaves
ALTER TABLE optional_leaves ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own optional leaves"
  ON optional_leaves FOR SELECT
  USING (auth.uid() = user_id OR EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'
  ));

CREATE POLICY "Admins can insert optional leaves"
  ON optional_leaves FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'
  ));

CREATE POLICY "Admins can update optional leaves"
  ON optional_leaves FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'
  ));

CREATE POLICY "Admins can delete optional leaves"
  ON optional_leaves FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'
  ));

-- Add optional_leave_id column to leave_requests (nullable FK)
ALTER TABLE leave_requests
  ADD COLUMN IF NOT EXISTS optional_leave_id UUID REFERENCES optional_leaves(id) ON DELETE SET NULL;
