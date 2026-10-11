-- ============================================================================
-- LUBRICATION APP - DATABASE SCHEMA
-- ============================================================================

-- STEP 1: Create tables without RLS first

create table if not exists public.profiles (
  id uuid not null primary key references auth.users on delete cascade,
  full_name text,
  is_admin boolean default false,
  created_at timestamptz default now()
);

create table if not exists public.equipment (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text,
  status text default 'active',
  created_at timestamptz default now(),
  created_by uuid references auth.users(id),
  updated_at timestamptz default now(),
  updated_by uuid references auth.users(id)
);

create table if not exists public.schedules (
  id uuid primary key default gen_random_uuid(),
  equipment text,
  component text,
  lubricant text,
  frequency text,
  due_date date,
  created_at timestamptz default now(),
  created_by uuid references auth.users(id)
);

create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  activity_date date,
  equipment text,
  component text,
  qty numeric,
  technician text,
  notes text,
  created_at timestamptz default now(),
  created_by uuid references auth.users(id)
);

create table if not exists public.oil_flags (
  id uuid primary key default gen_random_uuid(),
  flag_date date,
  equipment text,
  component text,
  flag_type text,
  notes text,
  created_at timestamptz default now(),
  created_by uuid references auth.users(id)
);

create table if not exists public.resources (
  id uuid primary key default gen_random_uuid(),
  resource_name text not null unique,
  running_hours numeric default 0,
  last_updated timestamptz,
  created_at timestamptz default now()
);

-- ============================================================================
-- STEP 2: ENABLE RLS
-- ============================================================================

alter table public.profiles enable row level security;
alter table public.equipment enable row level security;
alter table public.schedules enable row level security;
alter table public.activities enable row level security;
alter table public.oil_flags enable row level security;
alter table public.resources enable row level security;

-- ============================================================================
-- STEP 3: RLS POLICIES
-- ============================================================================

-- PROFILES POLICIES
drop policy if exists "profiles_select" on public.profiles;
drop policy if exists "profiles_insert" on public.profiles;
drop policy if exists "profiles_update" on public.profiles;

create policy "profiles_select" on public.profiles for select using (true);
create policy "profiles_insert" on public.profiles for insert with check (true);
create policy "profiles_update" on public.profiles for update using (auth.uid() = id);

-- EQUIPMENT POLICIES
drop policy if exists "equipment_select" on public.equipment;
drop policy if exists "equipment_insert" on public.equipment;
drop policy if exists "equipment_update" on public.equipment;
drop policy if exists "equipment_delete" on public.equipment;

create policy "equipment_select" on public.equipment for select using (true);
create policy "equipment_insert" on public.equipment for insert with check ((select is_admin from profiles where id = auth.uid()) = true);
create policy "equipment_update" on public.equipment for update using ((select is_admin from profiles where id = auth.uid()) = true);
create policy "equipment_delete" on public.equipment for delete using ((select is_admin from profiles where id = auth.uid()) = true);

-- SCHEDULES POLICIES
drop policy if exists "schedules_select" on public.schedules;
drop policy if exists "schedules_insert" on public.schedules;
drop policy if exists "schedules_update" on public.schedules;
drop policy if exists "schedules_delete" on public.schedules;

create policy "schedules_select" on public.schedules for select using (true);
create policy "schedules_insert" on public.schedules for insert with check ((select is_admin from profiles where id = auth.uid()) = true);
create policy "schedules_update" on public.schedules for update using ((select is_admin from profiles where id = auth.uid()) = true);
create policy "schedules_delete" on public.schedules for delete using ((select is_admin from profiles where id = auth.uid()) = true);

-- ACTIVITIES POLICIES
drop policy if exists "activities_select" on public.activities;
drop policy if exists "activities_insert" on public.activities;

create policy "activities_select" on public.activities for select using (true);
create policy "activities_insert" on public.activities for insert with check (true);

-- OIL_FLAGS POLICIES
drop policy if exists "oil_flags_select" on public.oil_flags;
drop policy if exists "oil_flags_insert" on public.oil_flags;
drop policy if exists "oil_flags_update" on public.oil_flags;
drop policy if exists "oil_flags_delete" on public.oil_flags;

create policy "oil_flags_select" on public.oil_flags for select using (true);
create policy "oil_flags_insert" on public.oil_flags for insert with check ((select is_admin from profiles where id = auth.uid()) = true);
create policy "oil_flags_update" on public.oil_flags for update using ((select is_admin from profiles where id = auth.uid()) = true);
create policy "oil_flags_delete" on public.oil_flags for delete using ((select is_admin from profiles where id = auth.uid()) = true);

-- RESOURCES POLICIES
drop policy if exists "resources_select" on public.resources;
drop policy if exists "resources_insert" on public.resources;
drop policy if exists "resources_update" on public.resources;
drop policy if exists "resources_delete" on public.resources;

create policy "resources_select" on public.resources for select using (true);
create policy "resources_insert" on public.resources for insert with check ((select is_admin from profiles where id = auth.uid()) = true);
create policy "resources_update" on public.resources for update using ((select is_admin from profiles where id = auth.uid()) = true);
create policy "resources_delete" on public.resources for delete using ((select is_admin from profiles where id = auth.uid()) = true);

-- ============================================================================
-- STEP 4: TRIGGER TO AUTO-CREATE PROFILE ON SIGNUP
-- ============================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, is_admin)
  values (new.id, new.email, false);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================================
-- DONE - Ready to use!
-- ============================================================================
-- After running this:
-- 1. Create a user via Supabase Auth UI
-- 2. Go to SQL Editor and run this to make them admin:
--    UPDATE public.profiles SET is_admin = true WHERE id = (SELECT id FROM auth.users WHERE email = 'your-email@example.com');
-- 3. The app will work!
