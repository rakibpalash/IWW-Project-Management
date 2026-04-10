-- Optional leave templates: reusable type catalog for admin
create table if not exists optional_leave_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  default_days int not null default 1,
  is_builtin boolean not null default false,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Seed built-in templates
insert into optional_leave_templates (name, default_days, is_builtin) values
  ('Hajj Leave', 15, true),
  ('Marriage Leave', 7, true)
on conflict do nothing;

-- RLS
alter table optional_leave_templates enable row level security;

-- Everyone can read (so the admin dialog can list them)
create policy "Anyone authenticated can view leave templates"
  on optional_leave_templates for select
  using (auth.role() = 'authenticated');

-- Only super_admin can insert/update/delete
create policy "Super admin can manage leave templates"
  on optional_leave_templates for all
  using (
    exists (
      select 1 from profiles
      where id = auth.uid() and role = 'super_admin'
    )
  );
