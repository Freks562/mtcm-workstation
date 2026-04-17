-- Migration: 016_grants
-- Grant Workflow Engine table.
-- Tracks the full lifecycle of a federal grant from identification to award.
-- Depends on: 001_profiles.sql (set_updated_at), 015_va_opportunities.sql

create table if not exists public.grants (
  id              uuid        primary key default gen_random_uuid(),
  title           text        not null,
  agency          text        not null default '',
  amount          numeric     not null default 0,
  stage           text        not null default 'identified'
                  check (stage in ('identified', 'qualifying', 'drafting', 'submitted', 'awarded', 'lost')),
  opportunity_id  uuid        references public.va_opportunities(id) on delete set null,
  user_id         uuid        references auth.users(id) on delete cascade not null,
  deadline        timestamptz,
  notes           text,
  ai_summary      text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create trigger grants_updated_at
  before update on public.grants
  for each row execute procedure public.set_updated_at();

-- ── Indexes ───────────────────────────────────────────────────────────────────

create index if not exists grants_user_id_idx   on public.grants(user_id);
create index if not exists grants_stage_idx     on public.grants(stage);
create index if not exists grants_opp_id_idx    on public.grants(opportunity_id);

-- ── Row-level security ────────────────────────────────────────────────────────

alter table public.grants enable row level security;

create policy "grants: select own"
  on public.grants for select
  using (auth.uid() = user_id);

create policy "grants: insert own"
  on public.grants for insert
  with check (auth.uid() = user_id);

create policy "grants: update own"
  on public.grants for update
  using (auth.uid() = user_id);

create policy "grants: delete own"
  on public.grants for delete
  using (auth.uid() = user_id);
