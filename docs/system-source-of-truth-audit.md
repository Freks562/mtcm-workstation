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

## 6. Confirmed Source vs Target Dashboard Facts

### Source (`mtcmglassworkstation`) confirmed

- Auth providers: Email, Google, Zoom enabled; GitHub disabled
- Auth URL configuration:
  - Site URL: not yet captured in this audit pass
  - Redirect URLs (production set includes):
    - `https://www.mtcmglassworkstation.com/auth/callback`
    - `https://www.mtcmglassworkstation.com/ops/login`
    - `https://www.mtcmglassworkstation.com/workstation`
    - `https://mtcmglassworkstation.com/auth/callback`
    - `https://mtcmglassworkstation.com/ops/login`
    - `https://mtcmglassworkstation.com/workstation`
    - `https://www.mtcglassworkstation.com/auth/callback`
    - `http://localhost:5173/auth/callback`
    - `http://localhost:5173`
  - Wildcard/pattern rules: none confirmed (captured entries are exact URLs)
- Storage buckets: `lawn_uploads` (public), `user_ids`, `course_uploads`, `business_assets`
- Broader policy/table truth exists for ops and Gmail reply draft workflows (example: `gmail_reply_drafts`)
- Deployed functions include a wider production integration surface, including:
  - Gmail stack: `gmail-oauth`, `gmail-send`, `gmail-sync`
  - DotMail/Gmail classifiers: `dotmail-ai-classifier`, `dotmail-gmail-classifier`
  - Capability pipeline: `generate-capability-pdf`, `capability-download`
  - Pollers: `sam-gov-poller`, `grants-gov-poller`
  - Public intake: `public-intake`, `public-intake-v2`, `veteran-housing-intake`
  - Payments/telephony examples: `stripe-checkout`, `stripe-webhook`, `twilio-token`, `twilio-status`, `twilio-voice`
  - Plus automation/metrics/heartbeat and JamalAI functions
- Secret categories present include Supabase runtime, Resend/DotMail, Gmail OAuth, SMTP/Postmark/SendGrid, SAM.gov, OpenAI/AI runtime, Stripe, Twilio, Slack alerts, Google OAuth, Plausible, site/donation URLs

### Target (`mtcm-workstation`) confirmed

- Auth providers: Email, Google, Zoom, GitHub enabled
- Auth URL configuration:
  - Site URL: `https://mtcmglassworkstation.com`
  - Redirect URLs:
    - `https://mtcmglassworkstation.com/auth/callback`
    - `https://mtcmglassworkstation.com/ops/login`
    - `https://mtcmglassworkstation.com/workstation`
    - `http://localhost:5173`
    - `http://localhost:5173/auth/callback`
  - Wildcard/pattern rules: none confirmed (captured entries are exact URLs)
- Applied production-parity auth URL target:
  - Canonical production domain: `mtcmglassworkstation.com`
  - Site URL: `https://mtcmglassworkstation.com`
  - Redirect URLs to keep:
    - `https://mtcmglassworkstation.com/auth/callback`
    - `https://mtcmglassworkstation.com/ops/login`
    - `https://mtcmglassworkstation.com/workstation`
    - `http://localhost:5173`
    - `http://localhost:5173/auth/callback`
  - Redirect URLs to remove later (only after verified cutover and clean traffic):
    - `https://www.mtcmglassworkstation.com/auth/callback`
    - `https://www.mtcmglassworkstation.com/ops/login`
    - `https://www.mtcmglassworkstation.com/workstation`
    - `https://www.mtcglassworkstation.com/auth/callback`
- Storage buckets: `vetrights-files`, `freks-assets`
- Policy/table truth is repo-aligned for workstation core; dashboard truth also shows `vetrights_cases` policies
- Deployed functions are the smaller repo-aligned set:
  - `freksframe-generate-scene`
  - `freksframe-render`
  - `jamalai-assist`
  - `jamalai-gateway`
  - `jamalaibrain`
  - `run-task`
  - `send-emails`
  - `va-opportunity-feed`
- Target secret presence currently confirmed for Supabase runtime, AI runtime, and image/Replicate runtime only

## 7. Exact Source-vs-Target Responsibility Split

| Domain | Source responsibility (`mtcmglassworkstation`) | Target responsibility (`mtcm-workstation`) | Consolidation interpretation |
|---|---|---|---|
| Workstation core app/data | Partial, with legacy overlays | Primary repo-aligned ownership | Preserve target as core truth |
| Public intake + external integrations | Primary live truth (broader function/policy surface) | Not fully present yet | Selectively import required production integrations |
| Auth providers + URL config | Email/Google/Zoom active + production redirect set | Email/Google/Zoom + GitHub active + canonical production redirect set | App auth is now aligned enough to remove baseline login as blocker; provider compatibility still must be maintained |
| Storage | Public-service buckets present | Repo-aligned workstation buckets present | Preserve target buckets; import missing public-service buckets if required |
| DotMail/Gmail operations | Broadly present in source | Partially present (`send-emails`) | Import missing Gmail/DotMail operational stack as needed |

## 8. What Must Be Preserved in `mtcm-workstation`

- Repo-aligned workstation database/function/policy baseline
- Existing deployed target function set listed above
- Existing target storage buckets: `vetrights-files`, `freks-assets`
- Existing dashboard policy truth supporting current repo modules (including VetRights-related dashboard truth)
- Target auth provider capability already enabled for Email/Google/Zoom/GitHub

## 9. What Must Be Imported from `mtcmglassworkstation` (high-probability)

- Runtime parity for production integrations not yet evidenced in target:
  - Resend / DotMail runtime
  - Gmail OAuth/send/sync runtime
  - SAM.gov runtime
  - Stripe/Twilio/Slack runtime where production flows still depend on them
- Public-service integration functions and dependencies (only those verified as still required):
  - Capability pipeline (`generate-capability-pdf`, `capability-download`)
  - Public intake functions (`public-intake`, `public-intake-v2`, `veteran-housing-intake`)
  - Poller/integration jobs (`sam-gov-poller`, `grants-gov-poller`) if active
- Public-service storage buckets and policy truth where production still depends on them:
  - `lawn_uploads` (public), `user_ids`, `course_uploads`, `business_assets`

## 10. Blockers Still Preventing Safe Cutover

### Auth blockers (updated)

- **Confirmed resolved for general app auth**:
  - App sign-in succeeds after auth URL remediation in target.
  - This confirms Supabase Auth provider/redirect remediation is working for app login paths.
- **Critical distinction**:
  - App auth success and DotMail Gmail "Connect Gmail" success are separate parity concerns.
  - Current blocker is DotMail Gmail integration parity, not baseline app login parity.
- Provider parity caution still applies:
  - Google/GitHub/Zoom provider app configs in target must remain compatible with `https://mtcmglassworkstation.com` callback/client settings.

### High-risk non-auth blockers

- **DotMail Gmail integration parity is currently blocked**:
  - DotMail "Connect Gmail" still fails in target.
  - Most likely because source Gmail/DotMail function stack is not deployed in target.
- Confirmed source-only deployed Gmail/DotMail functions not shown in target deploy list:
  - `gmail-oauth`
  - `gmail-send`
  - `gmail-sync`
  - `dotmail-gmail-classifier`
- Missing target parity evidence for supporting Gmail/DotMail runtime categories (names/presence only; no values)
- Missing target parity evidence for SAM.gov runtime
- Missing target parity evidence for Stripe/Twilio/Slack runtime dependencies
- Missing target parity evidence for source public-service buckets/functions/policies that power live public flows

### Why app sign-in can work while DotMail Gmail still fails

- App sign-in is handled by Supabase Auth provider + redirect configuration and can pass once Site URL/redirect/callback settings are correct.
- DotMail "Connect Gmail" depends on a separate Gmail OAuth integration stack (dedicated functions + related runtime configuration + callback wiring).
- Therefore auth URL remediation can fix app login without fixing DotMail Gmail connect if Gmail integration functions/runtime are absent or misconfigured in target.

## 11. Exact Cutover Prerequisites Checklist (migration-safe)

1. **Auth URL Configuration parity (source + target)**
   - [x] Site URL captured and compared
   - [x] Redirect URLs / allowed redirect patterns captured and compared
   - [ ] Source Site URL captured explicitly (still missing from confirmed snapshot)
   - [x] Target Site URL updated to `https://mtcmglassworkstation.com`
   - [x] Target redirect keep-list added (3 prod + 2 localhost URLs)
   - [ ] Temporary `www` redirects retained until cutover is verified and traffic is clean
   - [ ] Google/GitHub/Zoom callback config parity confirmed against canonical/non-www domain
   - [x] Post-change baseline app sign-in validation passed after auth URL remediation
   - [ ] Full auth path validation passed (normal login, Google login, logout/return, `/workstation`, `/ops/login`)
2. **Secrets category parity (names/presence only; no values)**
   - [ ] Supabase runtime parity confirmed
   - [ ] Resend/DotMail, Gmail, SAM.gov, Stripe, Twilio, Slack, Plausible, site/donation categories classified as migrate/verify/retire
3. **Function responsibility parity**
   - [ ] Source-only integration functions mapped to required/optional status
   - [ ] Required source-only functions have target implementation/deploy plan
4. **Storage + policy parity for required public flows**
   - [ ] Required source buckets (`lawn_uploads`, `user_ids`, `course_uploads`, `business_assets`) mapped to keep/migrate/retire decisions
   - [ ] Required bucket/table policy parity documented for retained flows
5. **Scheduler/automation parity**
   - [ ] DotMail and integration poller jobs inventoried and compared
   - [ ] Cadence/auth/header parity confirmed for required jobs
6. **E2E readiness gates in target**
   - [ ] Google/Email login succeeds with real redirect paths
   - [ ] DotMail + Gmail send/sync flows succeed where required
   - [ ] Capability/public intake/integration workflows pass smoke checks
   - [ ] No blocker-class parity drifts remain open

7. **DotMail Gmail parity gate (separate from app auth)**
   - [ ] Source Gmail/DotMail function responsibility mapped to target (`gmail-oauth`, `gmail-send`, `gmail-sync`, `dotmail-gmail-classifier`)
   - [ ] Required Gmail/DotMail functions present in target deployed function list
   - [ ] Required Gmail/DotMail runtime secret categories present in target (names/presence only; no values)
   - [ ] DotMail "Connect Gmail" callback/client settings confirmed against canonical domain
   - [ ] DotMail "Connect Gmail" succeeds end-to-end in target

## 12. Updated Migration Priority Order

1. **Auth URL parity + app sign-in validation**  
   - Completed enough to remove app auth as current blocker (app sign-in now works after remediation).
2. **DotMail Gmail parity (current blocked cutover item)**  
   - Separate from app auth; resolve Gmail-connect stack parity first.
   - Confirm required source Gmail/DotMail functions are present/deployed in target:
     - `gmail-oauth`, `gmail-send`, `gmail-sync`, `dotmail-gmail-classifier`
3. **Old vs new function responsibility diff (remaining integrations/public intake/capability)**  
   - Determine exact additional source-only functions that must be retained or ported to target.
4. **Secret presence classification**  
   - Classify presence/parity for runtime categories (names only; no secret values), with dedicated DotMail/Gmail focus first.
5. **Bucket policy diff**  
   - Compare required bucket-level policy behavior for retained production flows.
6. **Actual migration planning**  
   - Plan/execute only after blocker-class parity drifts are closed.

## 13. Exact Next Manual Checks (secrets/functions/callbacks)

1. **Secrets presence checks (names only; no values)**
   - Verify target has required Gmail/DotMail integration secret categories present for:
     - Gmail OAuth client/integration runtime
     - DotMail Gmail connect/send/sync runtime
   - Record presence/missing status only in worksheets; do not copy secret values.

2. **Deployed function checks**
   - In target deployed function list, confirm presence/absence for:
     - `gmail-oauth`
     - `gmail-send`
     - `gmail-sync`
     - `dotmail-gmail-classifier`
   - Mark each as required/optional for cutover and assign remediation owner.

3. **Callback/client compatibility checks**
   - Confirm OAuth callback/client settings for Google/GitHub/Zoom remain compatible with:
     - `https://mtcmglassworkstation.com`
   - For DotMail Gmail connect specifically, confirm callback URI and client project alignment point to the target/canonical production domain flow.

4. **Functional validation checks**
   - Re-validate app auth baseline (email + Google login) to confirm no regression.
   - Run DotMail "Connect Gmail" and capture exact error text and failing step.
   - Track as DotMail Gmail parity blocker until connect succeeds in target.

Control rules for this phase:

- Docs/worksheet audit first
- No migrations yet
- No assumptions beyond repo evidence + verified dashboard inventory
- Target remains `mtcm-workstation`; source remains extraction truth only
