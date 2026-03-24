-- Fish Map Test shared database starter
-- Run this in your Supabase SQL Editor.

create table if not exists public.fish_logs (
  id text primary key,
  app_id text not null default 'fish-map-test',
  owner_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  log_date date not null,
  time_of_day text not null,
  water_name text not null,
  waypoint_name text,
  bait_type text not null,
  bait_subtype text,
  bait_name text not null,
  main_color text,
  additional_color text,
  bait_size text,
  species text not null,
  size_inches numeric not null,
  weight text,
  quantity integer not null default 1,
  air_temp numeric,
  water_temp numeric,
  sky_condition text,
  water_condition text,
  water_clarity text,
  depth_zone text,
  retrieve_speed text,
  presentation_style text,
  structure_type text,
  hatches text,
  notes text,
  location_source text,
  marker_accuracy numeric,
  marker_lat double precision not null,
  marker_lng double precision not null
);

create index if not exists fish_logs_app_id_created_at_idx on public.fish_logs (app_id, created_at desc);

alter table public.fish_logs enable row level security;

drop policy if exists fish_logs_public_read on public.fish_logs;
create policy fish_logs_public_read
  on public.fish_logs
  for select
  using (true);

drop policy if exists fish_logs_public_insert on public.fish_logs;
create policy fish_logs_public_insert
  on public.fish_logs
  for insert
  with check (true);

drop policy if exists fish_logs_public_update on public.fish_logs;
create policy fish_logs_public_update
  on public.fish_logs
  for update
  using (true)
  with check (true);

drop policy if exists fish_logs_public_delete on public.fish_logs;
create policy fish_logs_public_delete
  on public.fish_logs
  for delete
  using (true);

create or replace function public.set_fish_logs_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists fish_logs_set_updated_at on public.fish_logs;
create trigger fish_logs_set_updated_at
before update on public.fish_logs
for each row
execute function public.set_fish_logs_updated_at();
