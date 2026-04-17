-- Migration: 014_task_runs
-- Table: task_runs
-- Audit log for every execution dispatched through the run-task edge function.
-- Each row captures the task type, the caller, the input payload, the result,
-- and the final status so the Glass Workstation UI can show a live execution
-- history without needing a separate observability service.

create table if not exists public.task_runs (
  id            uuid        primary key default gen_random_uuid(),
  task          text        not null,
                -- create_opportunity | create_task | create_contact
                -- draft_email | generate_proposal | complete_task
                -- advance_deal | refresh_analytics
  status        text        not null default 'pending'
                check (status in ('pending', 'success', 'error')),
  user_id       uuid        references auth.users(id) on delete set null,
  payload       jsonb       not null default '{}',
  result        jsonb,
  error_message text,
  duration_ms   integer,    -- wall-clock time for the task handler
  created_at    timestamptz not null default now()
);

alter table public.task_runs enable row level security;

-- Authenticated users can read their own runs; admins see everything.
create policy "task_runs: select own or admin" on public.task_runs
  for select using (
    auth.uid() = user_id
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- The service role (Edge Function) inserts rows.
create policy "task_runs: insert service role" on public.task_runs
  for insert with check (auth.role() = 'service_role');

-- The service role updates status/result after the task completes.
create policy "task_runs: update service role" on public.task_runs
  for update using (auth.role() = 'service_role');
