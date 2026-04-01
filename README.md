# IWW Project Management Tools

A full-featured project management platform built for teams. Manage projects, track tasks, monitor attendance, and handle leave requests — all in one place.

---

## Features

### Project Management
- Create and organise projects with configurable statuses and priorities
- Kanban and list views for task management
- Task assignments, due dates, and progress tracking
- File attachments per task and project
- Team collaboration with role-based access

### Attendance Tracking
- Clock in / clock out with timestamp recording
- Late and early-leave detection against configurable work hours
- Monthly attendance summaries per employee
- Admin override and manual adjustment support

### Leave Management
- Submit leave requests (annual, sick, personal, unpaid)
- Multi-level approval workflow
- Leave balance tracking
- Calendar view for team availability

### Team & Workspace Management
- Multi-workspace support
- Role-based access: Super Admin, Admin, Manager, Member
- User profiles with avatar upload
- Workspace-level settings

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS + shadcn/ui |
| Backend / DB | Supabase (PostgreSQL + Auth + Storage) |
| Auth | Supabase Auth with `@supabase/ssr` |
| Deployment | Vercel |
| Forms | React Hook Form + Zod |
| State | Zustand |

---

## Quick Start

### 1. Clone the repository

```bash
git clone https://github.com/your-org/iww-pm.git
cd iww-pm
```

### 2. Install dependencies

```bash
npm install
```

### 3. Set up environment variables

Copy the example env file and fill in your Supabase credentials:

```bash
cp .env.example .env.local
```

`.env.local` should contain:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 4. Set up the database

Follow the full guide at [`supabase/setup-guide.md`](supabase/setup-guide.md).

Short version:
1. Create a Supabase project at [supabase.com](https://supabase.com).
2. Run `supabase/schema.sql` in the Supabase SQL Editor.
3. Run `supabase/seed.sql` in the SQL Editor.
4. Run `supabase/storage.sql` in the SQL Editor.
5. Create your first super admin user (see setup guide Step 4).

### 5. Start the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anonymous/public API key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase service role key (server-only, never expose to client) |
| `NEXT_PUBLIC_APP_URL` | Yes | Base URL of the app (e.g. `https://your-domain.com`) |

---

## User Roles

| Role | Description |
|---|---|
| `super_admin` | Full access to all workspaces, settings, and user management. Can promote/demote other admins. |
| `admin` | Full access within their workspace. Can manage members, projects, attendance settings, and leave approvals. |
| `manager` | Can manage projects and tasks they own. Can approve leave requests for their team members. |
| `member` | Standard user. Can view and contribute to assigned projects, log attendance, and submit leave requests. |

---

## Deployment

See [`supabase/setup-guide.md`](supabase/setup-guide.md) Steps 7–8 for the full Vercel deployment guide.

Quick deploy:

```bash
npm i -g vercel
vercel
```

Set the four environment variables listed above in the Vercel dashboard under **Settings → Environment Variables**.

---

## Project Structure

```
.
├── app/
│   ├── (auth)/          # Login, signup, callback routes
│   ├── (dashboard)/     # Protected app routes
│   │   ├── attendance/
│   │   ├── leave/
│   │   ├── projects/
│   │   ├── settings/
│   │   └── team/
│   ├── error.tsx        # Global error boundary
│   └── not-found.tsx    # 404 page
├── components/
│   └── ui/              # shadcn/ui components + custom skeletons
├── lib/                 # Supabase clients, utilities
├── hooks/               # Custom React hooks
├── types/               # TypeScript type definitions
└── supabase/
    ├── schema.sql        # Full database schema
    ├── seed.sql          # Bootstrap / seed data
    ├── storage.sql       # Storage bucket setup
    └── setup-guide.md   # Step-by-step setup instructions
```

---

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run type-check` | Run TypeScript type checker |

---

## License

Private — All rights reserved.
