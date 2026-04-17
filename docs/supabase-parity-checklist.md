# Supabase Parity Checklist Worksheet

## Consolidation Direction

- **Target (final source of truth):** `mtcm-workstation`
- **Legacy source (extract truth from):** `mtcmglassworkstation`

---

## 1) Table parity worksheet (code + migrations)

| Table | Referenced in code | Migration-managed in repo | Migration reference | Legacy exists? | Target exists? | Parity status | Action |
|---|---|---|---|---|---|---|---|
| `profiles` | Yes | Yes | `/home/runner/work/mtcm-workstation/mtcm-workstation/supabase/migrations/001_profiles.sql` | [ ] Yes [ ] No | [ ] Yes [ ] No | [ ] Match [ ] Drift | |
| `contacts` | Yes | Yes | `/home/runner/work/mtcm-workstation/mtcm-workstation/supabase/migrations/002_contacts.sql` | [ ] Yes [ ] No | [ ] Yes [ ] No | [ ] Match [ ] Drift | |
| `deals` | Yes | Yes | `/home/runner/work/mtcm-workstation/mtcm-workstation/supabase/migrations/003_deals.sql` | [ ] Yes [ ] No | [ ] Yes [ ] No | [ ] Match [ ] Drift | |
| `tasks` | Yes | Yes | `/home/runner/work/mtcm-workstation/mtcm-workstation/supabase/migrations/004_tasks.sql` | [ ] Yes [ ] No | [ ] Yes [ ] No | [ ] Match [ ] Drift | |
| `campaigns` | Yes | Yes | `/home/runner/work/mtcm-workstation/mtcm-workstation/supabase/migrations/005_campaigns.sql` | [ ] Yes [ ] No | [ ] Yes [ ] No | [ ] Match [ ] Drift | |
| `campaign_contacts` | Yes | Yes | `/home/runner/work/mtcm-workstation/mtcm-workstation/supabase/migrations/006_campaign_contacts.sql` | [ ] Yes [ ] No | [ ] Yes [ ] No | [ ] Match [ ] Drift | |
| `call_logs` | Yes | Yes | `/home/runner/work/mtcm-workstation/mtcm-workstation/supabase/migrations/007_call_logs.sql` | [ ] Yes [ ] No | [ ] Yes [ ] No | [ ] Match [ ] Drift | |
| `emails` | Yes | Yes | `/home/runner/work/mtcm-workstation/mtcm-workstation/supabase/migrations/008_emails.sql` | [ ] Yes [ ] No | [ ] Yes [ ] No | [ ] Match [ ] Drift | |
| `email_templates` | Yes | Yes | `/home/runner/work/mtcm-workstation/mtcm-workstation/supabase/migrations/009_email_templates.sql` | [ ] Yes [ ] No | [ ] Yes [ ] No | [ ] Match [ ] Drift | |
| `events` | Yes | Yes | `/home/runner/work/mtcm-workstation/mtcm-workstation/supabase/migrations/010_events.sql` | [ ] Yes [ ] No | [ ] Yes [ ] No | [ ] Match [ ] Drift | |
| `analytics_snapshots` | Yes | Yes | `/home/runner/work/mtcm-workstation/mtcm-workstation/supabase/migrations/011_analytics_snapshots.sql` | [ ] Yes [ ] No | [ ] Yes [ ] No | [ ] Match [ ] Drift | |
| `task_runs` | Yes | Yes | `/home/runner/work/mtcm-workstation/mtcm-workstation/supabase/migrations/014_task_runs.sql` | [ ] Yes [ ] No | [ ] Yes [ ] No | [ ] Match [ ] Drift | |
| `freks_projects` | Yes | Yes | `/home/runner/work/mtcm-workstation/mtcm-workstation/supabase/migrations/013_freksframe.sql` | [ ] Yes [ ] No | [ ] Yes [ ] No | [ ] Match [ ] Drift | |
| `freks_scenes` | Yes | Yes | `/home/runner/work/mtcm-workstation/mtcm-workstation/supabase/migrations/013_freksframe.sql` | [ ] Yes [ ] No | [ ] Yes [ ] No | [ ] Match [ ] Drift | |
| `freks_renders` | Yes | Yes | `/home/runner/work/mtcm-workstation/mtcm-workstation/supabase/migrations/013_freksframe.sql` | [ ] Yes [ ] No | [ ] Yes [ ] No | [ ] Match [ ] Drift | |
| `va_opportunities` | Yes | Yes | `/home/runner/work/mtcm-workstation/mtcm-workstation/supabase/migrations/015_va_opportunities.sql` | [ ] Yes [ ] No | [ ] Yes [ ] No | [ ] Match [ ] Drift | |
| `va_opportunity_matches` | Yes | Yes | `/home/runner/work/mtcm-workstation/mtcm-workstation/supabase/migrations/015_va_opportunities.sql` | [ ] Yes [ ] No | [ ] Yes [ ] No | [ ] Match [ ] Drift | |
| `vetrights_intakes` | Yes | No | N/A (not found in current migrations) | [ ] Yes [ ] No | [ ] Yes [ ] No | [ ] Match [ ] Drift | Add migration if required for parity |
| `vetrights_evidence` | Yes | No | N/A (not found in current migrations) | [ ] Yes [ ] No | [ ] Yes [ ] No | [ ] Match [ ] Drift | Add migration if required for parity |

---

## 2) Bucket parity worksheet

| Bucket | Referenced in code | Migration-managed in repo | Reference | Legacy exists? | Target exists? | Public/private parity | Policy parity | Action |
|---|---|---|---|---|---|---|---|---|
| `freks-assets` | Yes | Yes | `/home/runner/work/mtcm-workstation/mtcm-workstation/supabase/migrations/013_freksframe.sql` | [ ] Yes [ ] No | [ ] Yes [ ] No | [ ] Match [ ] Drift | [ ] Match [ ] Drift | |
| `vetrights-files` | Yes | No | `/home/runner/work/mtcm-workstation/mtcm-workstation/src/modules/vetrights/page.jsx` | [ ] Yes [ ] No | [ ] Yes [ ] No | [ ] Match [ ] Drift | [ ] Match [ ] Drift | Add migration + policies if required |

---

## 3) RLS policy parity worksheet

Use this table to compare dashboard policy names/definitions for each table and bucket object path.

| Object | Repo migration reference | Legacy RLS/policies captured? | Target RLS/policies captured? | Parity status | Action |
|---|---|---|---|---|---|
| `profiles` | `/home/runner/work/mtcm-workstation/mtcm-workstation/supabase/migrations/001_profiles.sql` | [ ] Yes [ ] No | [ ] Yes [ ] No | [ ] Match [ ] Drift | |
| `contacts` | `/home/runner/work/mtcm-workstation/mtcm-workstation/supabase/migrations/002_contacts.sql` | [ ] Yes [ ] No | [ ] Yes [ ] No | [ ] Match [ ] Drift | |
| `deals` | `/home/runner/work/mtcm-workstation/mtcm-workstation/supabase/migrations/003_deals.sql` | [ ] Yes [ ] No | [ ] Yes [ ] No | [ ] Match [ ] Drift | |
| `tasks` | `/home/runner/work/mtcm-workstation/mtcm-workstation/supabase/migrations/004_tasks.sql` | [ ] Yes [ ] No | [ ] Yes [ ] No | [ ] Match [ ] Drift | |
| `campaigns` | `/home/runner/work/mtcm-workstation/mtcm-workstation/supabase/migrations/005_campaigns.sql` | [ ] Yes [ ] No | [ ] Yes [ ] No | [ ] Match [ ] Drift | |
| `campaign_contacts` | `/home/runner/work/mtcm-workstation/mtcm-workstation/supabase/migrations/006_campaign_contacts.sql` | [ ] Yes [ ] No | [ ] Yes [ ] No | [ ] Match [ ] Drift | |
| `call_logs` | `/home/runner/work/mtcm-workstation/mtcm-workstation/supabase/migrations/007_call_logs.sql` | [ ] Yes [ ] No | [ ] Yes [ ] No | [ ] Match [ ] Drift | |
| `emails` | `/home/runner/work/mtcm-workstation/mtcm-workstation/supabase/migrations/008_emails.sql` | [ ] Yes [ ] No | [ ] Yes [ ] No | [ ] Match [ ] Drift | |
| `email_templates` | `/home/runner/work/mtcm-workstation/mtcm-workstation/supabase/migrations/009_email_templates.sql` | [ ] Yes [ ] No | [ ] Yes [ ] No | [ ] Match [ ] Drift | |
| `events` | `/home/runner/work/mtcm-workstation/mtcm-workstation/supabase/migrations/010_events.sql` | [ ] Yes [ ] No | [ ] Yes [ ] No | [ ] Match [ ] Drift | |
| `analytics_snapshots` | `/home/runner/work/mtcm-workstation/mtcm-workstation/supabase/migrations/011_analytics_snapshots.sql` | [ ] Yes [ ] No | [ ] Yes [ ] No | [ ] Match [ ] Drift | |
| `task_runs` | `/home/runner/work/mtcm-workstation/mtcm-workstation/supabase/migrations/014_task_runs.sql` | [ ] Yes [ ] No | [ ] Yes [ ] No | [ ] Match [ ] Drift | |
| `freksframe tables + storage` | `/home/runner/work/mtcm-workstation/mtcm-workstation/supabase/migrations/013_freksframe.sql` | [ ] Yes [ ] No | [ ] Yes [ ] No | [ ] Match [ ] Drift | |
| `va_opportunities + matches` | `/home/runner/work/mtcm-workstation/mtcm-workstation/supabase/migrations/015_va_opportunities.sql` | [ ] Yes [ ] No | [ ] Yes [ ] No | [ ] Match [ ] Drift | |
| `vetrights_intakes` | N/A (not migration-managed yet) | [ ] Yes [ ] No | [ ] Yes [ ] No | [ ] Match [ ] Drift | Capture and convert to migration |
| `vetrights_evidence` | N/A (not migration-managed yet) | [ ] Yes [ ] No | [ ] Yes [ ] No | [ ] Match [ ] Drift | Capture and convert to migration |
| `vetrights-files` bucket object policies | N/A (not migration-managed yet) | [ ] Yes [ ] No | [ ] Yes [ ] No | [ ] Match [ ] Drift | Capture and convert to migration |

---

## 4) Edge function + scheduler parity worksheet

### 4.1 Edge functions

| Function | Repo path | Invoked by app | Legacy deployed? | Target deployed? | Secret parity checked? | Behavior parity checked? | Action |
|---|---|---|---|---|---|---|---|
| `send-emails` | `/home/runner/work/mtcm-workstation/mtcm-workstation/supabase/functions/send-emails/index.ts` | Yes (`DotMail`) | [ ] Yes [ ] No | [ ] Yes [ ] No | [ ] Yes [ ] No | [ ] Yes [ ] No | |
| `jamalai-gateway` | `/home/runner/work/mtcm-workstation/mtcm-workstation/supabase/functions/jamalai-gateway/index.ts` | Yes (`JamalAIPanel`) | [ ] Yes [ ] No | [ ] Yes [ ] No | [ ] Yes [ ] No | [ ] Yes [ ] No | |
| `freksframe-generate-scene` | `/home/runner/work/mtcm-workstation/mtcm-workstation/supabase/functions/freksframe-generate-scene/index.ts` | Yes (`FreksFrame`) | [ ] Yes [ ] No | [ ] Yes [ ] No | [ ] Yes [ ] No | [ ] Yes [ ] No | |
| `freksframe-render` | `/home/runner/work/mtcm-workstation/mtcm-workstation/supabase/functions/freksframe-render/index.ts` | Yes (`FreksFrame`) | [ ] Yes [ ] No | [ ] Yes [ ] No | [ ] Yes [ ] No | [ ] Yes [ ] No | |
| `run-task` | `/home/runner/work/mtcm-workstation/mtcm-workstation/supabase/functions/run-task/index.ts` | Indirect/ops | [ ] Yes [ ] No | [ ] Yes [ ] No | [ ] Yes [ ] No | [ ] Yes [ ] No | |
| `va-opportunity-feed` | `/home/runner/work/mtcm-workstation/mtcm-workstation/supabase/functions/va-opportunity-feed/index.ts` | Indirect/ops | [ ] Yes [ ] No | [ ] Yes [ ] No | [ ] Yes [ ] No | [ ] Yes [ ] No | |
| `jamalaibrain` | `/home/runner/work/mtcm-workstation/mtcm-workstation/supabase/functions/jamalaibrain/index.ts` | Indirect/legacy path | [ ] Yes [ ] No | [ ] Yes [ ] No | [ ] Yes [ ] No | [ ] Yes [ ] No | |
| `jamalai-assist` | `/home/runner/work/mtcm-workstation/mtcm-workstation/supabase/functions/jamalai-assist/index.ts` | Indirect/legacy path | [ ] Yes [ ] No | [ ] Yes [ ] No | [ ] Yes [ ] No | [ ] Yes [ ] No | |

### 4.2 Scheduler / cron jobs

| Job / automation | Repo or doc reference | Legacy configured? | Target configured? | Cadence parity | Auth/header parity | Action |
|---|---|---|---|---|---|---|
| DotMail send queue scheduler (`send-emails` via pg_cron/net.http_post) | `/home/runner/work/mtcm-workstation/mtcm-workstation/docs/dotmail-production-runbook.md` | [ ] Yes [ ] No | [ ] Yes [ ] No | [ ] Match [ ] Drift | [ ] Match [ ] Drift | |
| Additional legacy schedulers discovered in dashboard | Legacy dashboard inventory | [ ] Yes [ ] No | [ ] Yes [ ] No | [ ] Match [ ] Drift | [ ] Match [ ] Drift | Add rows per discovered job |

---

## 5) Worksheet completion gates

- [ ] All tables, buckets, RLS, functions, and schedulers compared side-by-side.
- [ ] Every drift has a named owner and remediation action.
- [ ] No dashboard-only production dependency remains undocumented.
