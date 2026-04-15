-- Migration: 013_freksframe
-- Tables for the FreksFrame AI storyboard / lyric-video module.
-- Depends on: 001_profiles.sql (auth.users FK via profiles)

-- ── freks_projects ────────────────────────────────────────────────────────────
create table if not exists public.freks_projects (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  title       text not null,
  lyrics      text not null default '',
  audio_url   text,
  style       text not null default 'cinematic',
  status      text not null default 'draft'
              check (status in ('draft','generating','ready','rendering','done','failed')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- auto-update updated_at
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger freks_projects_updated_at
  before update on public.freks_projects
  for each row execute procedure public.set_updated_at();

-- ── freks_scenes ──────────────────────────────────────────────────────────────
create table if not exists public.freks_scenes (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid references public.freks_projects(id) on delete cascade not null,
  order_index   integer not null default 0,
  description   text not null default '',
  visual_prompt text not null default '',
  image_url     text,
  clip_url      text,
  status        text not null default 'pending'
                check (status in ('pending','generating','ready','failed')),
  created_at    timestamptz not null default now()
);

create index if not exists freks_scenes_project_id_idx on public.freks_scenes(project_id);

-- ── freks_renders ─────────────────────────────────────────────────────────────
create table if not exists public.freks_renders (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid references public.freks_projects(id) on delete cascade not null,
  format       text not null default 'mp4'
               check (format in ('mp4','gif','frames_zip')),
  status       text not null default 'queued'
               check (status in ('queued','processing','completed','failed')),
  render_url   text,
  manifest_url text,
  error        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create trigger freks_renders_updated_at
  before update on public.freks_renders
  for each row execute procedure public.set_updated_at();

create index if not exists freks_renders_project_id_idx on public.freks_renders(project_id);

-- ── Row-level security ────────────────────────────────────────────────────────
alter table public.freks_projects enable row level security;
alter table public.freks_scenes    enable row level security;
alter table public.freks_renders   enable row level security;

-- freks_projects: users own their own projects
create policy "freks_projects: owner access"
  on public.freks_projects for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- freks_scenes: accessible when the parent project belongs to the current user
create policy "freks_scenes: project owner access"
  on public.freks_scenes for all
  using  (exists (
    select 1 from public.freks_projects p
    where p.id = project_id and p.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.freks_projects p
    where p.id = project_id and p.user_id = auth.uid()
  ));

-- freks_renders: same pattern as freks_scenes
create policy "freks_renders: project owner access"
  on public.freks_renders for all
  using  (exists (
    select 1 from public.freks_projects p
    where p.id = project_id and p.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.freks_projects p
    where p.id = project_id and p.user_id = auth.uid()
  ));

-- ── Storage: freks-assets bucket ─────────────────────────────────────────────
-- Create the bucket used for audio uploads and render manifests.
-- Runs in the storage schema; idempotent via "if not exists" equivalent.
insert into storage.buckets (id, name, public)
  values ('freks-assets', 'freks-assets', false)
  on conflict (id) do nothing;

-- Allow authenticated users to upload/read only within their own project folder.
-- Path convention:  freksframe/{project_id}/...
create policy "freks-assets: authenticated upload"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'freks-assets'
    and (storage.foldername(name))[1] = 'freksframe'
  );

create policy "freks-assets: authenticated read"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'freks-assets');

create policy "freks-assets: authenticated update"
  on storage.objects for update
  to authenticated
  using  (bucket_id = 'freks-assets')
  with check (bucket_id = 'freks-assets');

create policy "freks-assets: authenticated delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'freks-assets');
