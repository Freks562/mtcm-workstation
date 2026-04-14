-- Migration: 007_call_logs
-- Table: call_logs
-- Individual call record for the telemarketing module.

create table if not exists public.call_logs (
  id               uuid primary key default gen_random_uuid(),
  contact_id       uuid references public.contacts (id) on delete set null,
  agent_id         uuid references public.profiles (id) on delete set null,
  campaign_id      uuid references public.campaigns (id) on delete set null,
  duration_seconds integer not null default 0,
  outcome          text not null default 'no_answer',
                   -- no_answer | answered | callback | voicemail | do_not_call | converted
  callback_at      timestamptz,
  notes            text,
  called_at        timestamptz not null default now(),
  created_at       timestamptz not null default now()
);

alter table public.call_logs enable row level security;

create policy "call_logs: select authenticated" on public.call_logs
  for select using (auth.role() = 'authenticated');

create policy "call_logs: insert authenticated" on public.call_logs
  for insert with check (auth.role() = 'authenticated');

create policy "call_logs: update own or admin" on public.call_logs
  for update using (
    auth.uid() = agent_id
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

create policy "call_logs: delete admin" on public.call_logs
  for delete using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );
