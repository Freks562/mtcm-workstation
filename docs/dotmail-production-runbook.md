# DotMail Production Runbook (Resend-First)

This runbook defines the repo-truth operational path for DotMail outbound sends.

## Scope

- Queue and send flow for DotMail only
- Edge function: `/home/runner/work/mtcm-workstation/mtcm-workstation/supabase/functions/send-emails/index.ts`
- No Gmail-connect flow in this runbook

## Required Runtime Secrets

Set in Supabase project secrets (server-side only):

```bash
supabase secrets set RESEND_API_KEY=re_...
supabase secrets set RESEND_FROM_ADDRESS=no-reply@yourdomain.com
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are provided by Supabase runtime.

## Deploy Function

```bash
supabase functions deploy send-emails
```

## Manual Queue Processing

Use this for controlled runs and break-glass operations:

```bash
supabase functions invoke send-emails --no-verify-jwt
```

Expected response shape:

```json
{ "processed": 10, "sent": 9, "failed": 1 }
```

## Concurrency and Idempotency Contract

The function uses a conditional claim strategy:

1. Read queued candidates (`status='queued'`, `direction='outbound'`)
2. Conditionally update only `queued -> sending`
3. Send only rows successfully claimed by this worker

This prevents duplicate sends from concurrent workers.

## Scheduler Guidance

Scheduler cadence is **not fully repo-managed** in `supabase/config.toml`.
Configure scheduler/pg_cron in Supabase SQL/dashboard for production cadence.

Example SQL pattern (set correct project URL and auth headers):

```sql
select cron.schedule(
  'dotmail-send-emails-every-minute',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://<project-ref>.functions.supabase.co/send-emails',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer <service-role-or-internal-token>"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
```

If scheduler is not configured, operators must run manual invocation.

## Operational Verification

1. Queue test emails from DotMail UI.
2. Invoke `send-emails`.
3. Verify in `emails`:
   - `status='sent'` with `provider_id` and `sent_at`, or
   - `status='failed'` with `failure_reason`
4. Verify `events` includes `email_sent` / `email_failed`.

## Known Out-of-Repo Dependencies

- Resend domain verification and sender reputation
- Supabase dashboard scheduler/pg_cron setup
- Live edge-function deploy/version parity checks
