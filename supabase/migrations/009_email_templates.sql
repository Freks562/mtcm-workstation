-- Migration: 009_email_templates
-- Table: email_templates
-- Reusable email templates for campaigns and manual sends.

create table if not exists public.email_templates (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  subject    text not null,
  body       text not null,
  owner_id   uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.email_templates enable row level security;

create policy "email_templates: select authenticated" on public.email_templates
  for select using (auth.role() = 'authenticated');

create policy "email_templates: insert authenticated" on public.email_templates
  for insert with check (auth.role() = 'authenticated');

create policy "email_templates: update owner or admin" on public.email_templates
  for update using (
    auth.uid() = owner_id
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

create policy "email_templates: delete owner or admin" on public.email_templates
  for delete using (
    auth.uid() = owner_id
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

create trigger email_templates_updated_at
  before update on public.email_templates
  for each row execute procedure public.set_updated_at();

-- Add FK from emails.template_id now that email_templates exists
alter table public.emails
  add constraint emails_template_id_fkey
  foreign key (template_id) references public.email_templates (id) on delete set null;
