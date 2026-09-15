-- Run in Supabase Dashboard -> SQL Editor. This is PostgreSQL, not MySQL.
-- It preserves the old MySQL structure and also keeps one shared JSON snapshot
-- for compatibility with the existing web and Expo clients.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb, updated_at timestamptz not null default now()
);
create table if not exists public.students (
  user_id uuid primary key references auth.users(id) on delete cascade,
  student_id text not null unique check (student_id ~ '^[0-9]{4}-[0-9]{6}$'),
  first_name text not null, last_name text, data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.faculty (
  user_id uuid primary key references auth.users(id) on delete cascade,
  faculty_id text not null unique check (faculty_id ~ '^[A-Za-z]{3}-[0-9]{6}$'),
  first_name text not null, last_name text, data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.workspaces (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb, updated_at timestamptz not null default now()
);
create table if not exists public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  student_number text, course text, year_level text, semester text,
  data jsonb not null default '{}'::jsonb, updated_at timestamptz not null default now()
);
create table if not exists public.subjects (
  id text not null, user_id uuid not null references auth.users(id) on delete cascade,
  title text not null, instructor text, room text, data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(), primary key (id, user_id)
);
create table if not exists public.schedules (
  id text not null, user_id uuid not null references auth.users(id) on delete cascade,
  subject text, day_name text, start_time text, end_time text, room text,
  data jsonb not null default '{}'::jsonb, updated_at timestamptz not null default now(), primary key (id, user_id)
);
create table if not exists public.tasks (
  id text not null, user_id uuid not null references auth.users(id) on delete cascade,
  title text not null, subject text, due_date text, priority text, status text,
  data jsonb not null default '{}'::jsonb, updated_at timestamptz not null default now(), primary key (id, user_id)
);
create table if not exists public.notes (
  id text not null, user_id uuid not null references auth.users(id) on delete cascade,
  title text not null, subject text, content text, data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(), primary key (id, user_id)
);
create table if not exists public.announcements (
  id text not null, user_id uuid not null references auth.users(id) on delete cascade,
  title text not null, announcement_date text, message text, data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(), primary key (id, user_id)
);
create table if not exists public.classrooms (
  id text not null, user_id uuid not null references auth.users(id) on delete cascade,
  name text not null, section text, invite_code text, data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(), primary key (id, user_id)
);
create table if not exists public.classroom_members (
  id text not null, user_id uuid not null references auth.users(id) on delete cascade,
  classroom_id text, member_name text not null, role_name text, data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(), primary key (id, user_id)
);
create table if not exists public.classroom_files (
  id text not null, user_id uuid not null references auth.users(id) on delete cascade,
  file_name text not null, file_url text, subject text, data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(), primary key (id, user_id)
);
create table if not exists public.attendance (
  id text not null, user_id uuid not null references auth.users(id) on delete cascade,
  classroom_id text, data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(), primary key (id, user_id)
);
create table if not exists public.notifications (
  id text not null, user_id uuid not null references auth.users(id) on delete cascade,
  title text, is_read boolean not null default false, data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(), primary key (id, user_id)
);
create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  activity_type text not null, entity_type text, entity_id text, details jsonb,
  created_at timestamptz not null default now()
);

create index if not exists tasks_user_due on public.tasks(user_id, due_date);
create index if not exists schedules_user on public.schedules(user_id);
create index if not exists activity_logs_user_created on public.activity_logs(user_id, created_at desc);

-- RLS: authenticated users can only see and change their own records.
do $$
declare table_name text;
begin
  foreach table_name in array array['profiles','students','faculty','workspaces','user_profiles','subjects','schedules','tasks','notes','announcements','classrooms','classroom_members','classroom_files','attendance','notifications','activity_logs'] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('drop policy if exists "owner select" on public.%I', table_name);
    execute format('drop policy if exists "owner insert" on public.%I', table_name);
    execute format('drop policy if exists "owner update" on public.%I', table_name);
    execute format('drop policy if exists "owner delete" on public.%I', table_name);
    if table_name = 'profiles' then
      execute format('create policy "owner select" on public.%I for select to authenticated using ((select auth.uid()) = id)', table_name);
      execute format('create policy "owner insert" on public.%I for insert to authenticated with check ((select auth.uid()) = id)', table_name);
      execute format('create policy "owner update" on public.%I for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id)', table_name);
      execute format('create policy "owner delete" on public.%I for delete to authenticated using ((select auth.uid()) = id)', table_name);
    else
      execute format('create policy "owner select" on public.%I for select to authenticated using ((select auth.uid()) = user_id)', table_name);
      execute format('create policy "owner insert" on public.%I for insert to authenticated with check ((select auth.uid()) = user_id)', table_name);
      execute format('create policy "owner update" on public.%I for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', table_name);
      execute format('create policy "owner delete" on public.%I for delete to authenticated using ((select auth.uid()) = user_id)', table_name);
    end if;
  end loop;
end $$;

grant select, insert, update, delete on all tables in schema public to authenticated;
do $$ begin
  alter publication supabase_realtime add table public.workspaces;
exception when duplicate_object then null;
end $$;

-- Uploads are made by this server with its secret key.
insert into storage.buckets (id, name, public) values ('remindme-uploads', 'remindme-uploads', true)
on conflict (id) do nothing;
