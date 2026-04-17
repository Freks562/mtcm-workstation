# System Source-of-Truth Audit

## 1. Executive Summary

- `mtcm-workstation` is the **final Supabase target** and source of truth after consolidation.
- `mtcmglassworkstation` is **legacy source truth** to be extracted and compared, not retained as final backend authority.
- Production runtime state currently includes dashboard-managed dependencies (secrets, provider config, deployed function state, scheduler state) that must be parity-checked before cutover.

## 2. Core Audit Artifacts (live parity worksheets)

Use these docs together for controlled consolidation:

1. Secret inventory worksheet:
   - `/home/runner/work/mtcm-workstation/mtcm-workstation/docs/secret-matrix.md`
2. Table/bucket/RLS + function/scheduler comparison worksheet:
   - `/home/runner/work/mtcm-workstation/mtcm-workstation/docs/supabase-parity-checklist.md`
3. Final production cutover checklist:
   - `/home/runner/work/mtcm-workstation/mtcm-workstation/docs/cutover-checklist.md`
4. Operator dashboard-order guide for filling worksheets:
   - `/home/runner/work/mtcm-workstation/mtcm-workstation/docs/operator-supabase-parity-guide.md`

## 3. System Inventory Table

| system/feature | repo status | production/live status | backend truth location | storage/bucket dependency | auth dependency | migration status | notes |
|---|---|---|---|---|---|---|---|
| command-center | Present (`/home/runner/work/mtcm-workstation/mtcm-workstation/src/modules/command-center/page.jsx`) | Partial (per provided audit context) | Supabase tables via client queries (`contacts`, `deals`, `call_logs`, `campaigns`, `emails`, `events`) | No direct bucket usage in module | Protected route session dependency | P0 harden | Exists as shell/dashboard, not full ops/glass parity |
| crm | Present (`/home/runner/work/mtcm-workstation/mtcm-workstation/src/modules/crm`) | Unknown | Supabase migrations + client hooks (`contacts`, `deals`) | No | Protected route session dependency | P0 harden | Repo-truth implemented |
| telemarketing | Present (`/home/runner/work/mtcm-workstation/mtcm-workstation/src/modules/telemarketing`) | Unknown | Supabase migrations + client hooks (`campaigns`, `call_logs`, `campaign_contacts`) | No | Protected route session dependency | P0 harden | Repo-truth implemented |
| analytics | Present (`/home/runner/work/mtcm-workstation/mtcm-workstation/src/modules/analytics/page.jsx`) | Unknown | Supabase queries over operational tables + snapshots migration | No | Protected route session dependency | P0 harden | Depends on upstream module data quality |
| freksframe | Present (`/home/runner/work/mtcm-workstation/mtcm-workstation/src/modules/freksframe`, `/home/runner/work/mtcm-workstation/mtcm-workstation/supabase/migrations/013_freksframe.sql`) | Unknown | Migrations + edge functions + client hooks | Yes (`freks-assets` bucket migration-managed) | Protected route session dependency | P0 harden | Most storage truth is repo-managed |
| va-opportunities | Present (`/home/runner/work/mtcm-workstation/mtcm-workstation/src/modules/va-opportunities`, `/home/runner/work/mtcm-workstation/mtcm-workstation/supabase/migrations/015_va_opportunities.sql`) | Partial (public-facing “opportunities” described in provided context) | Migrations + function (`va-opportunity-feed`) + client hooks | No direct module bucket usage | Protected route session dependency | P0 harden | Exists in repo, live/public parity still needs mapping |
| vetrights | Present (`/home/runner/work/mtcm-workstation/mtcm-workstation/src/modules/vetrights/page.jsx`) | Partial (per provided context) | Client references `vetrights_intakes` + `vetrights_evidence` (not found in repo migrations) | Yes (`vetrights-files` referenced in code, not migration-managed) | Protected route + `requireUser` | P0 harden (blocked by repo-truth gaps) | DB/storage setup appears partly external |
| dotmail | Present (`/home/runner/work/mtcm-workstation/mtcm-workstation/src/modules/dotmail`, `/home/runner/work/mtcm-workstation/mtcm-workstation/supabase/functions/send-emails/index.ts`) | Partial (per provided context) | Migrations + function + client queue/send flow | No direct module bucket usage | Protected route session dependency | P0 harden | Runtime secrets/provider/scheduler/deploy truth still external |
| capability statements | Missing (no module/function/migration found) | Live-facing in provided context | Unknown (not repo-truth) | Unknown | Unknown | P1 migrate | Critical repo-truth gap |
| ops / glass workstation | Partial (`command-center` exists; no complete glass/ops mapping artifact) | Partial/live broader than repo in provided context | Partly represented by command-center + shared modules | Unknown | Protected route session dependency | P1 map and migrate | Needs explicit system mapping from legacy/live to clean repo |
| veteran-lawn-rescue | Missing | Expected/live in provided context | Unknown (not repo-truth) | Unknown | Unknown | P1 migrate | Ownership unresolved (ops vs public services vs both) |
| vetcert | Missing | Expected/live in provided context | Unknown (not repo-truth) | Unknown | Unknown | P1 migrate | No module/schema contract in repo |
| veteran-cybertraining | Missing | Expected/live in provided context | Unknown (not repo-truth) | Unknown | Unknown | P1 migrate | No module/schema contract in repo |
| training-lanes | Missing | Expected/live in provided context | Unknown (not repo-truth) | Unknown | Unknown | P2 scaffold (blocked by definition) | Must define old glass parity vs new clean module |
| auth | Present (`/home/runner/work/mtcm-workstation/mtcm-workstation/src/auth`, `/home/runner/work/mtcm-workstation/mtcm-workstation/supabase/migrations/001_profiles.sql`) | Partial (providers/runtime config external) | Supabase auth + profile upsert/query pattern | No | Primary system auth dependency | P0 harden | Cleanest repo-managed layer |
| edge functions | Present (`/home/runner/work/mtcm-workstation/mtcm-workstation/supabase/functions/*`) | Partial (deploy/runtime external) | Repo function code + external deployed state | Indirect (function-dependent) | Function auth context + service role usage | P0 harden | Deployment, secrets, and runtime truth not fully in repo |
| supabase storage / buckets | Partial (freks-assets migration-managed; vetrights bucket not migration-managed) | Partial | `013_freksframe.sql` + code refs | Yes (`freks-assets`, `vetrights-files`) | Bucket policy access tied to authenticated/service-role policies | P0 harden (with gap closure) | Bucket/state parity incomplete in repo |

## 4. Repo-Truth Gaps

Features live or expected in business/public surface but not present as real modules in `mtcm-workstation`:

- Capability Statements
- Veteran Lawn Rescue
- VetCert
- Veteran Cybertraining
- Training Lanes

Additional repo-truth incompleteness:

- VetRights references DB tables and storage bucket not represented by repo migrations.
- Ops/Glass Workstation appears broader in provided production context than current `command-center` representation.

## 5. Dashboard-Only Dependencies

Items likely managed outside repo migrations/functions/config:

- Auth provider configuration (GitHub/Google OAuth provider settings and credentials)
- DotMail provider secrets/runtime wiring (`RESEND_API_KEY`, sender identity)
- Gmail/Google OAuth app/provider setup if used for auth or outbound integrations
- Storage bucket/dashboard state for non-migration-managed bucket(s), especially `vetrights-files`
- Edge function deploy state (which function versions are currently deployed/live)
- Schedulers/cron for queue/automation execution (e.g., send queue processing cadence)
- VetRights tables/bucket/policies when not migration-managed (`vetrights_intakes`, `vetrights_evidence`, `vetrights-files`)

## 6. Confirmed Secret Category Inventory (source: `mtcmglassworkstation`)

Confirmed live production secret categories in source:

- Supabase runtime
- Resend / DotMail mail runtime
- Gmail OAuth / Gmail integration
- SMTP / Postmark / SendGrid
- SAM.gov
- OpenAI / AI runtime
- Stripe
- Twilio
- Slack alerts
- Google OAuth
- Plausible analytics
- Site/donation URLs

## 7. Secret Migration Classification Matrix

| Secret category | Classification | Reason now | Required manual verification before final decision |
|---|---|---|---|
| Supabase runtime | Likely must-migrate | Core app + function runtime dependency | Confirm target has all required runtime keys and project URLs aligned |
| Resend / DotMail mail runtime | Likely must-migrate | DotMail send path is repo-present and production-relevant | Confirm send-emails runtime path + scheduler + sender identity parity |
| OpenAI / AI runtime | Likely must-migrate | AI functions are repo-present and secret-backed | Confirm which AI functions are production-active and target-ready |
| Google OAuth | Requires usage verification | Auth/provider critical if enabled, but must match target auth strategy | Confirm provider enabled state + redirect/callback parity |
| Gmail OAuth / Gmail integration | Requires usage verification | Could be auth-adjacent or outbound integration; unclear active runtime ownership | Confirm active usage in production flows vs legacy-only |
| SMTP / Postmark / SendGrid | Requires usage verification | Could overlap with Resend or legacy mail paths | Confirm whether any are actively used by production jobs/functions |
| SAM.gov | Requires usage verification | Potential external integration dependency | Confirm active function/job usage and runtime binding |
| Stripe | Requires usage verification | Payments can be critical but repo/runtime linkage must be confirmed | Confirm target runtime use, webhook paths, and live dependency |
| Twilio | Requires usage verification | Messaging/notifications may be active but not yet repo-parity-confirmed | Confirm active workflow usage and target secret need |
| Slack alerts | Requires usage verification | Alerting can be operationally important but optional for cutover | Confirm active alert jobs/functions and owner acceptance if deferred |
| Plausible analytics | Likely safe to retire (pending check) | Usually non-blocking analytics dependency | Confirm target analytics strategy and whether runtime key is still consumed |
| Site/donation URLs | Likely safe to retire (pending check) | Often config-level and can move to non-secret managed config | Confirm these are not required as protected runtime secrets in target |

## 8. Exact Next Manual Checks Still Required (source + target dashboards)

Run these in order in both projects (`mtcmglassworkstation` source, `mtcm-workstation` target):

1. **Authentication → Providers**
   - Confirm enabled providers list.
   - Confirm redirect URL/callback URL parity for active providers.
   - Confirm site URL behavior expectation for cutover.
2. **Project Settings → Secrets**
   - For every confirmed category, mark present/absent only (no values).
   - For each category, mark: must-migrate / verify / retire.
3. **Edge Functions**
   - Map function-level env dependencies to secret categories.
   - Mark deployed in source vs target; identify unmanaged deployed functions.
4. **SQL Editor / Scheduler inventory**
   - Confirm DotMail queue jobs and any production-active feed jobs.
   - Confirm cadence + auth/header parity for jobs needed in target.
5. **Repository cross-check**
   - Validate each “must-migrate” or “verify” category against real repo usage (`supabase/functions`, frontend runtime usage, documented runbooks).
   - Keep category status as “verification required” until both dashboard evidence and repo evidence agree.

## 9. Updated Migration Priority Order

- **P0 = harden what already exists in repo**
  1. Complete Auth + Secrets worksheet parity (including category classification decisions).
  2. Complete database/storage/function/scheduler worksheet parity.
  3. VetRights backend repo-truth completion planning as first implementation target:
     - VetRights tables migration set
     - `vetrights-files` bucket migration
     - VetRights RLS/policy migration coverage
  4. DotMail/runtime parity finalization after VetRights backend truth is defined.

- **P1 = migrate missing public/business-critical systems**
  - Capability Statements migration
  - Ops/Glass Workstation mapping and migration design
  - Veteran Lawn Rescue migration
  - VetCert migration
  - Veteran Cybertraining migration

- **P2 = scaffold secondary modules**
  - Training Lanes migration/scaffold after definition is fixed

## 10. Recommended Order

Strict order:

1. Complete secret category classification and parity in `/home/runner/work/mtcm-workstation/mtcm-workstation/docs/secret-matrix.md`
2. Complete tables/buckets/RLS/functions/schedulers parity in `/home/runner/work/mtcm-workstation/mtcm-workstation/docs/supabase-parity-checklist.md`
3. Lock VetRights backend gap list from worksheet facts only
4. Approve migration-safe implementation order (VetRights first)
5. Resolve blocker parity drifts in target
6. Execute cutover gates in `/home/runner/work/mtcm-workstation/mtcm-workstation/docs/cutover-checklist.md`

Control rules for this phase:

- Docs/worksheet audit first
- No migrations yet
- No assumptions beyond repo evidence + verified dashboard inventory
- Target remains `mtcm-workstation`; legacy is extraction source only
