-- Migration: 008_emails
-- Table: emails
-- Individual email send record linked to a contact and optionally a campaign.
-- Status lifecycle: queued → sending → sent | failed | bounced | opened | clicked

create table if not exists public.emails (
  id           uuid primary key default gen_random_uuid(),
  contact_id   uuid references public.contacts (id) on delete set null,
  campaign_id  uuid references public.campaigns (id) on delete set null,
  template_id  uuid,                               -- FK to email_templates added in 009_email_templates.sql
  sender_id    uuid references public.profiles (id) on delete set null,
  direction    text not null default 'outbound',   -- outbound | inbound
  subject      text not null,
  body         text not null,
  status       text not null default 'queued',
               -- queued | sending | sent | failed | bounced | opened | clicked
  provider_id  text,                               -- Resend message ID (populated server-side)
  sent_at      timestamptz,
  created_at   timestamptz not null default now()
);

alter table public.emails enable row level security;

create policy "emails: select authenticated" on public.emails
  for select using (auth.role() = 'authenticated');

create policy "emails: insert authenticated" on public.emails
  for insert with check (auth.role() = 'authenticated');

create policy "emails: update authenticated" on public.emails
  for update using (auth.role() = 'authenticated');

create policy "emails: delete admin" on public.emails
  for delete using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );
