-- Migration: 001_profiles
-- Table: profiles
-- One profile row per authenticated user (references auth.users).

create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text,
  avatar_url  text,
  role        text not null default 'agent',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Row-level security
alter table public.profiles enable row level security;

-- Users can read their own profile
create policy "profiles: select own" on public.profiles
  for select using (auth.uid() = id);

-- Users can insert their own profile
create policy "profiles: insert own" on public.profiles
  for insert with check (auth.uid() = id);

-- Users can update their own profile
create policy "profiles: update own" on public.profiles
  for update using (auth.uid() = id);

-- Auto-update updated_at
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute procedure public.set_updated_at();
