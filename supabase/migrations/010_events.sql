-- Migration: 010_events
-- Table: events
-- Audit/activity event log for all significant user actions.

create table if not exists public.events (
  id           uuid primary key default gen_random_uuid(),
  type         text not null,        -- e.g. call_logged, campaign_created, campaign_updated
  actor_id     uuid references public.profiles (id) on delete set null,
  entity_type  text,                 -- e.g. call_log, campaign, contact
  entity_id    uuid,
  metadata     jsonb,
  occurred_at  timestamptz not null default now()
);

alter table public.events enable row level security;

create policy "events: select authenticated" on public.events
  for select using (auth.role() = 'authenticated');

create policy "events: insert authenticated" on public.events
  for insert with check (auth.role() = 'authenticated');

-- Events are immutable — no update/delete for regular users
