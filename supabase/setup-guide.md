# IWW Project Management Tools — Supabase Setup Guide

Follow these steps in order to get your Supabase backend up and running.

---

## Step 1: Create a Supabase Project

1. Go to [https://supabase.com](https://supabase.com) and sign in.
2. Click **New project**.
3. Fill in the project name, database password, and select a region.
4. Wait for the project to finish provisioning (roughly 1–2 minutes).
5. Navigate to **Project Settings → API** and copy:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon / public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role key** → `SUPABASE_SERVICE_ROLE_KEY` *(keep this secret!)*

---

## Step 2: Run the Database Schema

1. In your Supabase project, open the **SQL Editor** (left sidebar).
2. Click **New query**.
3. Open `supabase/schema.sql` from this repository, copy the entire contents, and paste it into the editor.
4. Click **Run** (or press `Ctrl+Enter`).
5. Verify there are no errors in the output panel.

---

## Step 3: Run the Seed / Bootstrap SQL

1. In the SQL Editor, create another new query.
2. Open `supabase/seed.sql`, copy its contents, and paste them into the editor.
3. Click **Run**.
4. This will:
   - Ensure the `attendance_settings` singleton row exists.
   - Create a default workspace if none exists.

---

## Step 4: Create the First Super Admin

### 4a — Create the Auth User

Navigate to **Authentication → Users** in your Supabase dashboard.

- Click **Add user → Create new user**.
- Enter the admin email address and a strong password.
- Enable **Auto Confirm User** so the account is immediately active.

Alternatively, use the Supabase CLI:

```bash
supabase auth admin create-user \
  --email admin@yourcompany.com \
  --password 'TemporaryPassword123!' \
  --email-confirm
```

### 4b — Promote to super_admin

Once the user exists, open the **SQL Editor** and run:

```sql
-- Replace with the actual admin email address
UPDATE public.profiles
SET role = 'super_admin'
WHERE email = 'your-admin@email.com';
```

### 4c — Assign to the Default Workspace

```sql
INSERT INTO public.workspace_members (workspace_id, user_id, role)
SELECT
  w.id,
  p.id,
  'owner'
FROM public.workspaces w, public.profiles p
WHERE p.email = 'your-admin@email.com'
LIMIT 1;
```

---

## Step 5: Configure Authentication

1. Go to **Authentication → Providers** and make sure **Email** is enabled.
2. Go to **Authentication → URL Configuration** and set:
   - **Site URL**: `https://your-domain.com` (or `http://localhost:3000` for local dev)
   - **Redirect URLs**: add `https://your-domain.com/auth/callback`
3. Optionally configure the email templates under **Authentication → Email Templates**.

---

## Step 6: Configure Storage

Open the **SQL Editor** and run `supabase/storage.sql`, or paste the following:

```sql
-- Create avatars bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT DO NOTHING;

-- Public read access
CREATE POLICY "Avatar images are publicly accessible."
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

-- Authenticated users can upload
CREATE POLICY "Anyone can upload an avatar."
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'avatars');

-- Users can update their own avatar
CREATE POLICY "Anyone can update their own avatar."
  ON storage.objects FOR UPDATE
  USING (auth.uid() = owner);
```

---

## Step 7: Deploy to Vercel

### Option A — Vercel CLI

```bash
npm i -g vercel
vercel         # Follow the prompts; link to your Vercel account and project
```

### Option B — Vercel Dashboard

1. Go to [https://vercel.com/new](https://vercel.com/new).
2. Import your Git repository.
3. Vercel will auto-detect Next.js. Keep the default settings.
4. Under **Environment Variables**, add:

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | From Step 1 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | From Step 1 |
| `SUPABASE_SERVICE_ROLE_KEY` | From Step 1 |
| `NEXT_PUBLIC_APP_URL` | Your Vercel deployment URL |

5. Click **Deploy**.

---

## Step 8: Update App URL After First Deploy

After Vercel assigns a URL (e.g., `https://iww-pm.vercel.app`):

1. In Vercel dashboard → **Settings → Environment Variables**, update `NEXT_PUBLIC_APP_URL` to the production URL.
2. Back in Supabase → **Authentication → URL Configuration**:
   - Update **Site URL** to the production URL.
   - Add the production callback: `https://iww-pm.vercel.app/auth/callback`.
3. Trigger a new Vercel deployment so the updated env var takes effect.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| Redirect loop on login | Check Site URL and Redirect URLs in Supabase Auth settings. |
| `Invalid API key` error | Verify env variable names match exactly (case-sensitive). |
| RLS blocking all queries | Ensure the user has a corresponding row in `public.profiles`. |
| Avatar upload 403 | Re-run the storage policies SQL in Step 6. |
| Build fails on Vercel | Run `npm run type-check` locally to catch TypeScript errors first. |
