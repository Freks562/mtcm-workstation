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

## 6. Migration Priorities

- **P0 = harden what already exists in repo**
  - DotMail production audit + runtime parity
  - VetRights repo-truth completion (migrations/policies/storage parity)
  - Auth/runtime dependency verification
  - Edge function + storage parity hardening

- **P1 = migrate missing public/business-critical systems**
  - Capability Statements migration
  - Ops/Glass Workstation mapping and migration design
  - Veteran Lawn Rescue migration
  - VetCert migration
  - Veteran Cybertraining migration

- **P2 = scaffold secondary modules**
  - Training Lanes migration/scaffold after definition is fixed

## 7. Recommended Order

Strict order:

1. Complete secret parity worksheet (`docs/secret-matrix.md`)
2. Complete table/bucket/RLS/function/scheduler worksheet (`docs/supabase-parity-checklist.md`)
3. Resolve all parity drifts required for target readiness
4. Execute cutover with runbook gates (`docs/cutover-checklist.md`)

Control rules for this phase:

- Docs/worksheet audit first
- No migrations yet
- No assumptions beyond repo evidence + verified dashboard inventory
- Target remains `mtcm-workstation`; legacy is extraction source only
