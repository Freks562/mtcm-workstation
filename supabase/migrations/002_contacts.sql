-- Migration: 002_contacts
-- Table: contacts
-- Core CRM contact record.

create table if not exists public.contacts (
  id          uuid primary key default gen_random_uuid(),
  first_name  text not null,
  last_name   text not null,
  email       text,
  phone       text,
  company     text,
  status      text not null default 'lead',  -- lead | prospect | customer | inactive
  owner_id    uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Row-level security
alter table public.contacts enable row level security;

-- Authenticated users can read all contacts
create policy "contacts: select authenticated" on public.contacts
  for select using (auth.role() = 'authenticated');

-- Authenticated users can insert contacts (owner_id set to self)
create policy "contacts: insert authenticated" on public.contacts
  for insert with check (auth.role() = 'authenticated');

-- Owner or admin can update
create policy "contacts: update own" on public.contacts
  for update using (
    auth.uid() = owner_id
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- Owner or admin can delete
create policy "contacts: delete own" on public.contacts
  for delete using (
    auth.uid() = owner_id
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

create trigger contacts_updated_at
  before update on public.contacts
  for each row execute procedure public.set_updated_at();
