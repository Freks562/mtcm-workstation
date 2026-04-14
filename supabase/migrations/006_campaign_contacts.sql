-- Migration: 006_campaign_contacts
-- Table: campaign_contacts
-- Junction table linking campaigns to contacts (many-to-many).
-- Also tracks per-contact queue status for telemarketing calls.

create table if not exists public.campaign_contacts (
  id           uuid primary key default gen_random_uuid(),
  campaign_id  uuid not null references public.campaigns (id) on delete cascade,
  contact_id   uuid not null references public.contacts (id) on delete cascade,
  status       text not null default 'queued',  -- queued | called | callback | do_not_call | converted
  sent_at      timestamptz,
  opened_at    timestamptz,
  clicked_at   timestamptz,
  unique (campaign_id, contact_id)
);

alter table public.campaign_contacts enable row level security;

create policy "campaign_contacts: select authenticated" on public.campaign_contacts
  for select using (auth.role() = 'authenticated');

create policy "campaign_contacts: insert authenticated" on public.campaign_contacts
  for insert with check (auth.role() = 'authenticated');

create policy "campaign_contacts: update authenticated" on public.campaign_contacts
  for update using (auth.role() = 'authenticated');

create policy "campaign_contacts: delete authenticated" on public.campaign_contacts
  for delete using (auth.role() = 'authenticated');
