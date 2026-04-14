-- Migration: 003_deals
-- Table: deals
-- Sales pipeline deal record linked to a contact.

create table if not exists public.deals (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  value       numeric(14, 2) not null default 0,
  stage       text not null default 'prospecting',
              -- prospecting | qualification | proposal | negotiation | closed_won | closed_lost
  contact_id  uuid references public.contacts (id) on delete set null,
  owner_id    uuid references public.profiles (id) on delete set null,
  closed_at   timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Row-level security
alter table public.deals enable row level security;

create policy "deals: select authenticated" on public.deals
  for select using (auth.role() = 'authenticated');

create policy "deals: insert authenticated" on public.deals
  for insert with check (auth.role() = 'authenticated');

create policy "deals: update own" on public.deals
  for update using (
    auth.uid() = owner_id
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

create policy "deals: delete own" on public.deals
  for delete using (
    auth.uid() = owner_id
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

create trigger deals_updated_at
  before update on public.deals
  for each row execute procedure public.set_updated_at();
