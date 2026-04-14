-- Fishing Logbook custom fly sharing add-on for v10.39.19
-- Run this in Supabase SQL Editor if you want custom flies shared across devices.

create table if not exists public.fishing_custom_flies (
  id text primary key,
  app_id text not null,
  owner_name text,
  angler_key text,
  name text not null,
  category text not null,
  primary_colors jsonb not null default '[]'::jsonb,
  secondary_colors jsonb not null default '[]'::jsonb,
  sizes jsonb not null default '[]'::jsonb,
  notes text,
  updated_at timestamptz not null default now()
);

create index if not exists fishing_custom_flies_app_id_idx on public.fishing_custom_flies(app_id);
create index if not exists fishing_custom_flies_name_idx on public.fishing_custom_flies(name);
create index if not exists fishing_custom_flies_category_idx on public.fishing_custom_flies(category);

alter table public.fishing_custom_flies enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'fishing_custom_flies' and policyname = 'Fishing custom flies public read'
  ) then
    create policy "Fishing custom flies public read" on public.fishing_custom_flies
      for select using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'fishing_custom_flies' and policyname = 'Fishing custom flies public write'
  ) then
    create policy "Fishing custom flies public write" on public.fishing_custom_flies
      for insert with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'fishing_custom_flies' and policyname = 'Fishing custom flies public update'
  ) then
    create policy "Fishing custom flies public update" on public.fishing_custom_flies
      for update using (true) with check (true);
  end if;
end $$;

notify pgrst, 'reload schema';
