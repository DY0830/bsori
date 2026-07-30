-- B.SORI initial Supabase schema
-- Run this file once in Supabase SQL Editor.

create extension if not exists "pgcrypto";

create type public.user_role as enum ('discharger', 'driver', 'facility', 'admin');
create type public.request_status as enum (
  'requested', 'assigned', 'collecting', 'collected',
  'in_transit', 'received', 'processing', 'completed', 'cancelled'
);

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  business_number text,
  address text not null,
  latitude numeric(10,7),
  longitude numeric(10,7),
  organization_type public.user_role not null,
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  organization_id uuid references public.organizations(id),
  role public.user_role not null,
  full_name text not null,
  phone text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid references public.profiles(id),
  plate_number text not null unique,
  capacity_kg integer not null check (capacity_kg > 0),
  status text not null default 'available',
  created_at timestamptz not null default now()
);

create table public.waste_requests (
  id uuid primary key default gen_random_uuid(),
  request_number text not null unique,
  organization_id uuid not null references public.organizations(id),
  created_by uuid not null references public.profiles(id),
  waste_type text not null,
  estimated_weight_kg numeric(10,2) not null check (estimated_weight_kg > 0),
  storage_condition text,
  pickup_address text not null,
  latitude numeric(10,7),
  longitude numeric(10,7),
  preferred_pickup_at timestamptz,
  memo text,
  photo_path text,
  ai_result jsonb,
  ai_verified boolean not null default false,
  status public.request_status not null default 'requested',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.collection_assignments (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique references public.waste_requests(id) on delete cascade,
  driver_id uuid not null references public.profiles(id),
  vehicle_id uuid not null references public.vehicles(id),
  route_order integer,
  route_distance_m integer,
  route_duration_s integer,
  assigned_at timestamptz not null default now(),
  started_at timestamptz,
  arrived_at timestamptz,
  collected_at timestamptz,
  actual_weight_kg numeric(10,2),
  collection_photo_path text,
  driver_note text
);

create table public.facility_receipts (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique references public.waste_requests(id) on delete cascade,
  facility_id uuid not null references public.organizations(id),
  inspected_by uuid not null references public.profiles(id),
  received_at timestamptz not null default now(),
  measured_weight_kg numeric(10,2) not null,
  quality_status text not null,
  foreign_material_status text not null,
  scale_photo_path text,
  inspection_note text
);

create table public.processing_results (
  id uuid primary key default gen_random_uuid(),
  receipt_id uuid not null unique references public.facility_receipts(id) on delete cascade,
  processing_method text not null,
  processing_line text,
  input_weight_kg numeric(10,2) not null,
  output_weight_kg numeric(10,2),
  started_at timestamptz,
  completed_at timestamptz,
  result_note text
);

create table public.status_history (
  id bigint generated always as identity primary key,
  request_id uuid not null references public.waste_requests(id) on delete cascade,
  from_status public.request_status,
  to_status public.request_status not null,
  changed_by uuid references public.profiles(id),
  note text,
  created_at timestamptz not null default now()
);

create index waste_requests_org_idx on public.waste_requests(organization_id, created_at desc);
create index waste_requests_status_idx on public.waste_requests(status, created_at desc);
create index status_history_request_idx on public.status_history(request_id, created_at desc);

alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.vehicles enable row level security;
alter table public.waste_requests enable row level security;
alter table public.collection_assignments enable row level security;
alter table public.facility_receipts enable row level security;
alter table public.processing_results enable row level security;
alter table public.status_history enable row level security;

create or replace function public.current_user_role()
returns public.user_role language sql stable security definer
set search_path = public as $$
  select role from public.profiles where id = auth.uid()
$$;

create policy "profiles read self or admin" on public.profiles for select
using (id = auth.uid() or public.current_user_role() = 'admin');

create policy "organizations read authenticated" on public.organizations for select
to authenticated using (true);

create policy "requests read by role" on public.waste_requests for select
using (
  public.current_user_role() = 'admin'
  or organization_id = (select organization_id from public.profiles where id = auth.uid())
  or exists (select 1 from public.collection_assignments a where a.request_id = id and a.driver_id = auth.uid())
  or public.current_user_role() = 'facility'
);

create policy "discharger creates own requests" on public.waste_requests for insert
with check (
  public.current_user_role() = 'discharger'
  and created_by = auth.uid()
  and organization_id = (select organization_id from public.profiles where id = auth.uid())
);

create policy "admin updates requests" on public.waste_requests for update
using (public.current_user_role() = 'admin')
with check (public.current_user_role() = 'admin');

create policy "assignments visible by role" on public.collection_assignments for select
using (driver_id = auth.uid() or public.current_user_role() in ('admin', 'facility'));

create policy "driver updates own assignments" on public.collection_assignments for update
using (driver_id = auth.uid())
with check (driver_id = auth.uid());

create policy "facility records visible by role" on public.facility_receipts for select
using (public.current_user_role() in ('facility', 'admin'));

create policy "facility inserts receipts" on public.facility_receipts for insert
with check (public.current_user_role() = 'facility' and inspected_by = auth.uid());

create policy "processing visible by role" on public.processing_results for select
using (public.current_user_role() in ('facility', 'admin'));

create policy "facility manages processing" on public.processing_results for all
using (public.current_user_role() = 'facility')
with check (public.current_user_role() = 'facility');

create policy "history visible authenticated" on public.status_history for select
to authenticated using (true);

-- Storage setup to run after creating buckets in the Supabase dashboard:
-- 1. Create private bucket: waste-photos
-- 2. Create private bucket: evidence
-- 3. Add storage.objects policies using the authenticated user's organization and role.

alter publication supabase_realtime add table public.waste_requests;
alter publication supabase_realtime add table public.collection_assignments;
alter publication supabase_realtime add table public.facility_receipts;
