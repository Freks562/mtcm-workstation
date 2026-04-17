-- Migration: 015_va_opportunities
-- Tables for the VA Opportunity Feed module.
-- Depends on: 001_profiles.sql (set_updated_at trigger), 002_contacts.sql, 003_deals.sql

-- ── Extend existing tables ────────────────────────────────────────────────────

-- Flag veteran contacts so the match engine can surface relevant opportunities.
alter table public.contacts
  add column if not exists is_veteran boolean not null default false;

-- Free-text notes field on deals so VA opportunity links can be stored.
alter table public.deals
  add column if not exists notes text;

-- ── va_opportunities ──────────────────────────────────────────────────────────

create table if not exists public.va_opportunities (
  id          uuid        primary key default gen_random_uuid(),
  title       text        not null,
  category    text        not null
              check (category in ('grant', 'contract', 'program', 'employment')),
  agency      text        not null,
  amount_usd  numeric,
  deadline    timestamptz,
  description text        not null default '',
  source_url  text,
  tags        text[]      not null default '{}',
  status      text        not null default 'open'
              check (status in ('open', 'closed', 'upcoming')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger va_opportunities_updated_at
  before update on public.va_opportunities
  for each row execute procedure public.set_updated_at();

-- ── va_opportunity_matches ────────────────────────────────────────────────────

create table if not exists public.va_opportunity_matches (
  id              uuid        primary key default gen_random_uuid(),
  opportunity_id  uuid        references public.va_opportunities(id) on delete cascade not null,
  user_id         uuid        references auth.users(id) on delete cascade,
  contact_id      uuid        references public.contacts(id) on delete cascade,
  match_reason    text        not null default '',
  match_score     numeric     not null default 0,
  created_at      timestamptz not null default now()
);

-- ── Indexes ───────────────────────────────────────────────────────────────────

create index if not exists va_opportunities_category_idx   on public.va_opportunities(category);
create index if not exists va_opportunities_status_idx     on public.va_opportunities(status);
create index if not exists va_opportunities_deadline_idx   on public.va_opportunities(deadline);
create index if not exists va_opp_matches_opp_id_idx       on public.va_opportunity_matches(opportunity_id);
create index if not exists va_opp_matches_user_id_idx      on public.va_opportunity_matches(user_id);
create index if not exists va_opp_matches_contact_id_idx   on public.va_opportunity_matches(contact_id);

-- ── Row-level security ────────────────────────────────────────────────────────

alter table public.va_opportunities       enable row level security;
alter table public.va_opportunity_matches enable row level security;

-- Any authenticated user can read all opportunities (public feed)
create policy "va_opportunities: select authenticated"
  on public.va_opportunities for select
  using (auth.role() = 'authenticated');

-- Service role or admin can insert/update/delete opportunities
create policy "va_opportunities: insert admin or service"
  on public.va_opportunities for insert
  with check (
    auth.role() = 'service_role'
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

create policy "va_opportunities: update admin or service"
  on public.va_opportunities for update
  using (
    auth.role() = 'service_role'
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

create policy "va_opportunities: delete admin or service"
  on public.va_opportunities for delete
  using (
    auth.role() = 'service_role'
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- Users see their own matches; admins see all
create policy "va_opp_matches: select own or admin"
  on public.va_opportunity_matches for select
  using (
    auth.uid() = user_id
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- Service role writes matches (generated server-side by the feed function)
create policy "va_opp_matches: insert service role"
  on public.va_opportunity_matches for insert
  with check (auth.role() = 'service_role');

create policy "va_opp_matches: delete service role"
  on public.va_opportunity_matches for delete
  using (auth.role() = 'service_role');

-- ── Seed data (2026 VA funding cycle) ────────────────────────────────────────

insert into public.va_opportunities
  (title, category, agency, amount_usd, deadline, description, source_url, tags, status)
values
  (
    'Rural Veteran Transportation Services Grant',
    'grant',
    'Department of Veterans Affairs',
    7000000,
    '2026-09-30 23:59:59+00',
    'VA funding to expand transportation services for rural veterans, enabling access to medical appointments, rehabilitation, and community programs. Eligibility open to nonprofits and local government agencies serving elderly and disabled veterans in rural and highly rural areas.',
    'https://www.va.gov/homeless/transportation.asp',
    ARRAY['transportation', 'rural', 'elderly', 'disabled', 'community', 'nonprofit'],
    'open'
  ),
  (
    'Adaptive Sports Program Funding',
    'program',
    'Department of Veterans Affairs',
    16000000,
    '2026-10-31 23:59:59+00',
    'Expanded VA funding for adaptive sports and therapeutic recreation programs supporting veterans with disabilities. Grants available to nonprofits, community organizations, and state agencies offering sports, rehabilitation, and physical activity programs.',
    'https://www.va.gov/adaptive-sports/',
    ARRAY['adaptive sports', 'disability', 'nonprofit', 'rehabilitation', 'recreation', 'physical health'],
    'open'
  ),
  (
    'Suicide Prevention Community Grant Program',
    'grant',
    'Department of Veterans Affairs',
    112000000,
    '2026-12-31 23:59:59+00',
    'Largest-ever VA suicide prevention grant cycle targeting community-based organizations, nonprofits, and mental health providers. Funds outreach, crisis intervention, peer support, and follow-up care programs for at-risk veterans and their families.',
    'https://www.mentalhealth.va.gov/suicide_prevention/',
    ARRAY['suicide prevention', 'mental health', 'nonprofit', 'crisis intervention', 'peer support', 'community'],
    'open'
  ),
  (
    'VA Facility Modernization and Infrastructure Program',
    'contract',
    'Department of Veterans Affairs',
    4800000000,
    '2027-06-30 23:59:59+00',
    'Multi-year VA capital investment program covering facility upgrades, technology modernization, and infrastructure improvements across VA medical centers and community-based outpatient clinics nationwide. Contracting opportunities open to construction, IT services, facility management, and engineering firms.',
    'https://www.va.gov/opal/nac/',
    ARRAY['construction', 'facility', 'infrastructure', 'technology', 'contract', 'it', 'engineering'],
    'open'
  );
