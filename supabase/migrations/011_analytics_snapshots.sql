-- Migration: 011_analytics_snapshots
-- Table: analytics_snapshots
-- Periodic aggregated metrics snapshot for the analytics module.
-- Populated by a cron job or Edge Function calling INSERT … ON CONFLICT DO UPDATE.

create table if not exists public.analytics_snapshots (
  id              uuid primary key default gen_random_uuid(),
  snapshot_date   date not null unique,
  total_contacts  integer not null default 0,
  total_deals     integer not null default 0,
  deals_closed    integer not null default 0,
  open_pipeline   numeric(14, 2) not null default 0,
  revenue         numeric(14, 2) not null default 0,   -- sum of closed_won deal values
  calls_made      integer not null default 0,
  emails_sent     integer not null default 0,
  created_at      timestamptz not null default now()
);

alter table public.analytics_snapshots enable row level security;

create policy "analytics_snapshots: select authenticated" on public.analytics_snapshots
  for select using (auth.role() = 'authenticated');

create policy "analytics_snapshots: insert service role" on public.analytics_snapshots
  for insert with check (auth.role() = 'service_role');

create policy "analytics_snapshots: update service role" on public.analytics_snapshots
  for update using (auth.role() = 'service_role');

