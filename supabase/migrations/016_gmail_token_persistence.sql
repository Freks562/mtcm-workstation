-- Migration: 016_gmail_token_persistence
-- Purpose: additive schema support for Gmail OAuth token persistence.

create table if not exists public.mail_accounts (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users (id) on delete cascade,
  provider            text not null,
  provider_account_id text not null default 'primary',
  access_token        text not null,
  refresh_token       text,
  expires_at          timestamptz,
  scope               text,
  token_type          text,
  status              text not null default 'connected',
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create table if not exists public.gmail_tokens (
  id             uuid primary key default gen_random_uuid(),
  mail_account_id uuid references public.mail_accounts (id) on delete cascade,
  user_id        uuid not null references auth.users (id) on delete cascade,
  provider       text not null default 'gmail',
  access_token   text not null,
  refresh_token  text,
  expires_at     timestamptz,
  scope          text,
  token_type     text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create unique index if not exists mail_accounts_user_provider_provider_account_uidx
  on public.mail_accounts(user_id, provider, provider_account_id);

create unique index if not exists gmail_tokens_mail_account_id_uidx
  on public.gmail_tokens(mail_account_id);

create unique index if not exists gmail_tokens_user_provider_uidx
  on public.gmail_tokens(user_id, provider);

do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'mail_accounts_updated_at'
  ) then
    create trigger mail_accounts_updated_at
      before update on public.mail_accounts
      for each row execute procedure public.set_updated_at();
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'gmail_tokens_updated_at'
  ) then
    create trigger gmail_tokens_updated_at
      before update on public.gmail_tokens
      for each row execute procedure public.set_updated_at();
  end if;
end
$$;
