-- ============================================================================
-- LUBRICATION APP - COMPLETE DATABASE SCHEMA WITH ALL FEATURES
-- ============================================================================

-- STEP 1: Create tables without RLS first

create table if not exists public.profiles (
  id uuid not null primary key references auth.users on delete cascade,
  full_name text,
  is_admin boolean default false,
  assets_edit boolean default false,
  points_edit boolean default false,
  workorders_record boolean default false,
  workorders_edit boolean default false,
  inventory_edit boolean default false,
  created_at timestamptz default now()
);

-- Lubricants Master
create table if not exists public.lubricants (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  lubricant_type text,
  uom text,
  description text,
  created_at timestamptz default now()
);

-- Plant Resources (36 resources for running hours tracking)
create table if not exists public.resources (
  id uuid primary key default gen_random_uuid(),
  resource_name text not null unique,
  running_hours numeric default 0,
  last_updated timestamptz,
  created_at timestamptz default now()
);

-- Type Suggestions (for autocomplete)
create table if not exists public.component_type_suggestions (
  id uuid primary key default gen_random_uuid(),
  component_type text unique,
  created_at timestamptz default now()
);

create table if not exists public.lubrication_point_suggestions (
  id uuid primary key default gen_random_uuid(),
  point_name text unique,
  created_at timestamptz default now()
);

-- Equipment
create table if not exists public.equipment (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sap_equipment_number text unique,
  type text,
  status text default 'active',
  lubrication_criticality text,
  running_hours numeric default 0,
  last_running_hours_update timestamptz,
  created_at timestamptz default now(),
  created_by uuid references auth.users(id),
  updated_at timestamptz default now(),
  updated_by uuid references auth.users(id)
);

-- Equipment Resource Mapping (cascade running hours)
create table if not exists public.equipment_resource_mapping (
  id uuid primary key default gen_random_uuid(),
  equipment_id uuid references public.equipment(id) on delete cascade,
  resource_id uuid references public.resources(id) on delete cascade,
  created_at timestamptz default now(),
  unique(equipment_id, resource_id)
);

-- Components
create table if not exists public.components (
  id uuid primary key default gen_random_uuid(),
  equipment_id uuid not null references public.equipment(id) on delete cascade,
  name text not null,
  type text,
  criticality text,
  status text default 'active',
  created_at timestamptz default now(),
  created_by uuid references auth.users(id)
);

-- Lubrication Points
create table if not exists public.lubrication_points (
  id uuid primary key default gen_random_uuid(),
  component_id uuid not null references public.components(id) on delete cascade,
  name text not null,
  lubrication_type text,
  lubricant_id uuid references public.lubricants(id),
  running_hours_interval numeric,
  calendar_interval_months numeric,
  status text default 'active',
  criticality text,
  special_instructions text,
  created_at timestamptz default now(),
  created_by uuid references auth.users(id)
);

-- Activities/Work Orders (Service Log)
create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  lubrication_point_id uuid references public.lubrication_points(id) on delete cascade,
  activity_date date,
  equipment text,
  component text,
  qty numeric,
  qty_uom text,
  technician text,
  notes text,
  status text default 'completed',
  created_at timestamptz default now(),
  created_by uuid references auth.users(id)
);

-- Oil Analysis Flags
create table if not exists public.oil_flags (
  id uuid primary key default gen_random_uuid(),
  lubrication_point_id uuid references public.lubrication_points(id) on delete cascade,
  flag_date date,
  equipment text,
  component text,
  flag_type text,
  notes text,
  created_at timestamptz default now(),
  created_by uuid references auth.users(id)
);

-- Audit Log
create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  action text,
  table_name text,
  record_id uuid,
  old_values jsonb,
  new_values jsonb,
  performed_by uuid references auth.users(id),
  performed_at timestamptz default now()
);

-- RPC Function: Update Running Hours and Cascade
create or replace function public.update_resource_running_hours(
  res_id uuid,
  new_hours numeric
)
returns table(success boolean, message text)
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Update resource running hours
  update resources set running_hours = new_hours, last_updated = now() where id = res_id;

  -- Cascade to linked equipment
  update equipment set running_hours = new_hours, last_running_hours_update = now()
  where id in (select equipment_id from equipment_resource_mapping where resource_id = res_id);

  return query select true::boolean, 'Running hours updated and cascaded'::text;
end;
$$;

-- Seed 36 Plant Resources
insert into public.resources (resource_name) values
  ('KILN01'), ('KILN02'),
  ('COALM01'), ('COALM02'),
  ('AQCLP01'), ('AQCLP02'), ('AQCMP01'), ('AQCMP02'),
  ('AUXCR01'),
  ('BLKCEM01'),
  ('CLAYCR01'),
  ('CM01'), ('CM02'), ('CM03'),
  ('LSCR01'), ('LSCR02'),
  ('MINLS'),
  ('PACKER01'), ('PACKER02'), ('PACKER03'), ('PACKER04'), ('PACKER05'), ('PACKER06'), ('PACKER07'), ('PACKER08'),
  ('RM01'), ('RM02'), ('RM03'),
  ('SPB01'), ('SPB02'),
  ('WHRTG01'), ('WHRTG02'),
  ('XTBOND01')
on conflict do nothing;

-- Seed Lubricants
insert into public.lubricants (name, lubricant_type, uom, description) values
  ('ISO VG 32', 'Mineral Oil', 'L', 'General purpose hydraulic oil'),
  ('ISO VG 46', 'Mineral Oil', 'L', 'Hydraulic system oil'),
  ('ISO VG 68', 'Mineral Oil', 'L', 'Heavy duty hydraulic oil'),
  ('NLGI 1', 'Grease', 'kg', 'Light consistency grease'),
  ('NLGI 2', 'Grease', 'kg', 'Standard consistency grease')
on conflict do nothing;

-- ============================================================================
-- STEP 2: ENABLE RLS
-- ============================================================================

alter table public.profiles enable row level security;
alter table public.lubricants enable row level security;
alter table public.resources enable row level security;
alter table public.component_type_suggestions enable row level security;
alter table public.lubrication_point_suggestions enable row level security;
alter table public.equipment enable row level security;
alter table public.equipment_resource_mapping enable row level security;
alter table public.components enable row level security;
alter table public.lubrication_points enable row level security;
alter table public.activities enable row level security;
alter table public.oil_flags enable row level security;
alter table public.audit_log enable row level security;

-- ============================================================================
-- STEP 3: RLS POLICIES
-- ============================================================================

-- PROFILES POLICIES
drop policy if exists "profiles_select" on public.profiles;
drop policy if exists "profiles_insert" on public.profiles;
drop policy if exists "profiles_update" on public.profiles;

create policy "profiles_select" on public.profiles for select using (true);
create policy "profiles_insert" on public.profiles for insert with check (true);
create policy "profiles_update" on public.profiles for update using (auth.uid() = id or (select is_admin from profiles where id = auth.uid()) = true);

-- LUBRICANTS POLICIES
drop policy if exists "lubricants_select" on public.lubricants;
drop policy if exists "lubricants_insert" on public.lubricants;

create policy "lubricants_select" on public.lubricants for select using (true);
create policy "lubricants_insert" on public.lubricants for insert with check ((select is_admin from profiles where id = auth.uid()) = true);

-- RESOURCES POLICIES
drop policy if exists "resources_select" on public.resources;
drop policy if exists "resources_update" on public.resources;

create policy "resources_select" on public.resources for select using (true);
create policy "resources_update" on public.resources for update using ((select is_admin from profiles where id = auth.uid()) = true);

-- EQUIPMENT POLICIES
drop policy if exists "equipment_select" on public.equipment;
drop policy if exists "equipment_insert" on public.equipment;
drop policy if exists "equipment_update" on public.equipment;
drop policy if exists "equipment_delete" on public.equipment;

create policy "equipment_select" on public.equipment for select using (true);
create policy "equipment_insert" on public.equipment for insert with check ((select assets_edit from profiles where id = auth.uid()) = true or (select is_admin from profiles where id = auth.uid()) = true);
create policy "equipment_update" on public.equipment for update using ((select assets_edit from profiles where id = auth.uid()) = true or (select is_admin from profiles where id = auth.uid()) = true);
create policy "equipment_delete" on public.equipment for delete using ((select is_admin from profiles where id = auth.uid()) = true);

-- EQUIPMENT RESOURCE MAPPING POLICIES
drop policy if exists "equipment_resource_mapping_select" on public.equipment_resource_mapping;
drop policy if exists "equipment_resource_mapping_insert" on public.equipment_resource_mapping;

create policy "equipment_resource_mapping_select" on public.equipment_resource_mapping for select using (true);
create policy "equipment_resource_mapping_insert" on public.equipment_resource_mapping for insert with check ((select assets_edit from profiles where id = auth.uid()) = true or (select is_admin from profiles where id = auth.uid()) = true);

-- COMPONENTS POLICIES
drop policy if exists "components_select" on public.components;
drop policy if exists "components_insert" on public.components;
drop policy if exists "components_update" on public.components;

create policy "components_select" on public.components for select using (true);
create policy "components_insert" on public.components for insert with check ((select assets_edit from profiles where id = auth.uid()) = true or (select is_admin from profiles where id = auth.uid()) = true);
create policy "components_update" on public.components for update using ((select assets_edit from profiles where id = auth.uid()) = true or (select is_admin from profiles where id = auth.uid()) = true);

-- LUBRICATION POINTS POLICIES
drop policy if exists "lubrication_points_select" on public.lubrication_points;
drop policy if exists "lubrication_points_insert" on public.lubrication_points;
drop policy if exists "lubrication_points_update" on public.lubrication_points;

create policy "lubrication_points_select" on public.lubrication_points for select using (true);
create policy "lubrication_points_insert" on public.lubrication_points for insert with check ((select points_edit from profiles where id = auth.uid()) = true or (select is_admin from profiles where id = auth.uid()) = true);
create policy "lubrication_points_update" on public.lubrication_points for update using ((select points_edit from profiles where id = auth.uid()) = true or (select is_admin from profiles where id = auth.uid()) = true);

-- SUGGESTIONS POLICIES
drop policy if exists "component_type_suggestions_select" on public.component_type_suggestions;
drop policy if exists "component_type_suggestions_insert" on public.component_type_suggestions;

create policy "component_type_suggestions_select" on public.component_type_suggestions for select using (true);
create policy "component_type_suggestions_insert" on public.component_type_suggestions for insert with check (true);

drop policy if exists "lubrication_point_suggestions_select" on public.lubrication_point_suggestions;
drop policy if exists "lubrication_point_suggestions_insert" on public.lubrication_point_suggestions;

create policy "lubrication_point_suggestions_select" on public.lubrication_point_suggestions for select using (true);
create policy "lubrication_point_suggestions_insert" on public.lubrication_point_suggestions for insert with check (true);

-- ACTIVITIES POLICIES
drop policy if exists "activities_select" on public.activities;
drop policy if exists "activities_insert" on public.activities;
drop policy if exists "activities_update" on public.activities;

create policy "activities_select" on public.activities for select using (true);
create policy "activities_insert" on public.activities for insert with check ((select workorders_record from profiles where id = auth.uid()) = true or (select is_admin from profiles where id = auth.uid()) = true);
create policy "activities_update" on public.activities for update using ((select workorders_edit from profiles where id = auth.uid()) = true or (select is_admin from profiles where id = auth.uid()) = true);

-- OIL_FLAGS POLICIES
drop policy if exists "oil_flags_select" on public.oil_flags;
drop policy if exists "oil_flags_insert" on public.oil_flags;

create policy "oil_flags_select" on public.oil_flags for select using (true);
create policy "oil_flags_insert" on public.oil_flags for insert with check (true);

-- AUDIT_LOG POLICIES
alter table public.audit_log enable row level security;

drop policy if exists "audit_log_select" on public.audit_log;
create policy "audit_log_select" on public.audit_log for select using (true);

-- ============================================================================
-- STEP 4: TRIGGER TO AUTO-CREATE PROFILE ON SIGNUP WITH FEATURE TOGGLES
-- ============================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    id, full_name, is_admin,
    assets_edit, points_edit, workorders_record, workorders_edit, inventory_edit
  )
  values (
    new.id, new.email, false,
    false, false, true, false, false
  );
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
