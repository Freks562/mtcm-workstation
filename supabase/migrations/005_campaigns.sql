-- Migration: 005_campaigns
-- Table: campaigns
-- Telemarketing / email campaign record.

create table if not exists public.campaigns (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  type          text not null default 'telemarketing',  -- telemarketing | email
  status        text not null default 'draft',          -- draft | active | paused | completed
  subject       text,
  body          text,
  scheduled_at  timestamptz,
  sent_at       timestamptz,
  owner_id      uuid references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table public.campaigns enable row level security;

create policy "campaigns: select authenticated" on public.campaigns
  for select using (auth.role() = 'authenticated');

create policy "campaigns: insert authenticated" on public.campaigns
  for insert with check (auth.role() = 'authenticated');

create policy "campaigns: update owner or admin" on public.campaigns
  for update using (
    auth.uid() = owner_id
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

create policy "campaigns: delete owner or admin" on public.campaigns
  for delete using (
    auth.uid() = owner_id
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

create trigger campaigns_updated_at
  before update on public.campaigns
  for each row execute procedure public.set_updated_at();
