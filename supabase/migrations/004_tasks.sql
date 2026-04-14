-- Migration: 004_tasks
-- Table: tasks
-- Action items assignable to any user, optionally linked to a contact or deal.

create table if not exists public.tasks (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  description  text,
  due_at       timestamptz,
  completed    boolean not null default false,
  assigned_to  uuid references public.profiles (id) on delete set null,
  contact_id   uuid references public.contacts (id) on delete set null,
  deal_id      uuid references public.deals (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table public.tasks enable row level security;

create policy "tasks: select authenticated" on public.tasks
  for select using (auth.role() = 'authenticated');

create policy "tasks: insert authenticated" on public.tasks
  for insert with check (auth.role() = 'authenticated');

create policy "tasks: update own or assigned" on public.tasks
  for update using (
    auth.uid() = assigned_to
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

create policy "tasks: delete own or admin" on public.tasks
  for delete using (
    auth.uid() = assigned_to
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

create trigger tasks_updated_at
  before update on public.tasks
  for each row execute procedure public.set_updated_at();
