# Operator Guide: Fill Supabase Parity Worksheets (Dashboard Order)

## Direction and Rule of Record

- **Target (final):** `mtcm-workstation`
- **Source (legacy truth for extraction):** `mtcmglassworkstation`
- **Do not copy secret values into git.** Record key names, presence, parity, and decisions only.

Use these worksheets while following this guide:

- `/home/runner/work/mtcm-workstation/mtcm-workstation/docs/secret-matrix.md`
- `/home/runner/work/mtcm-workstation/mtcm-workstation/docs/supabase-parity-checklist.md`
- `/home/runner/work/mtcm-workstation/mtcm-workstation/docs/cutover-checklist.md`

---

## Preflight (before dashboard clicks)

1. Open two browser windows side by side:
   - Source project: `mtcmglassworkstation`
   - Target project: `mtcm-workstation`
2. Open all three worksheet docs locally.
3. Set comparison mode for every row: `source vs target`.

---

## Exact dashboard click path order

Perform in this order for both projects, one step at a time:

1. **Project Settings → API**
2. **Project Settings → Secrets**
3. **Authentication → Providers**
4. **Database → Tables**
5. **Storage → Buckets**
6. **Storage → Policies** (for each relevant bucket)
7. **Database → Policies** (RLS per table)
8. **Edge Functions**
9. **SQL Editor** (read-only inventory for schedulers/cron metadata)

---

## What to copy from each page, what to compare, and where to write it

| Step | Click path | Copy from page | Compare (source vs target) | Write into |
|---|---|---|---|---|
| 1 | Project Settings → API | Project URL present, anon key name presence | URL endpoint/project identity alignment; anon key availability | `secret-matrix.md` (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`) |
| 2 | Project Settings → Secrets | Secret key names only, enabled/present status | Presence and expected usage parity for each repo-derived key | `secret-matrix.md` main matrix |
| 3 | Authentication → Providers | Enabled providers, redirect URL settings, provider config presence | Provider parity and redirect parity | `cutover-checklist.md` (pre-cutover auth/config gates) |
| 4 | Database → Tables | Table names, columns summary, constraints/index visibility, row-count sanity | Existence and structural parity for rows already listed in worksheet; add discovered rows only if they exist live | `supabase-parity-checklist.md` table worksheet |
| 5 | Storage → Buckets | Bucket names, public/private setting, limits/metadata | Bucket existence and visibility parity | `supabase-parity-checklist.md` bucket worksheet |
| 6 | Storage → Policies | Bucket object policy names and rule intent | Policy parity for bucket access behavior | `supabase-parity-checklist.md` RLS/policy worksheet |
| 7 | Database → Policies | Table RLS policy names and rule intent by table | Policy parity for read/write behavior | `supabase-parity-checklist.md` RLS worksheet |
| 8 | Edge Functions | Function names, deployed status, last deploy metadata, env key presence (names only) | Deploy parity + runtime dependency parity | `supabase-parity-checklist.md` edge function worksheet |
| 9 | SQL Editor (read-only) | Scheduler/cron inventory metadata (job name, cadence, function target, auth/header strategy) | Job presence, cadence, and auth/header parity | `supabase-parity-checklist.md` scheduler worksheet |

---

## Comparison rules (source vs target)

For each row in each worksheet:

1. Mark **source present** and **target present**.
2. Mark parity as **Match** or **Drift**.
3. If drift exists, record one explicit action:
   - `migrate` (needed in target),
   - `rotate` (secrets/config change required),
   - `remove` (legacy-only and intentionally retired), or
   - `accept` (approved intentional difference).
4. Assign owner/date in notes when action is not immediate.

---

## Blocker vs non-blocker definitions

### Blocker (cannot proceed to migration)

- Any required repo-derived secret missing in target.
- Required table/bucket/function used by current repo behavior missing in target.
- RLS/policy drift that changes effective access for current production flows.
- Required scheduler/cron missing or cadence/auth drift that breaks expected automation.
- Auth provider/redirect mismatch that can block sign-in or callback completion.

### Non-blocker (can proceed if documented and approved)

- Legacy-only items confirmed unused by target runtime and marked `remove`.
- Naming/description metadata differences with no runtime impact.
- Optional/experimental functions not used by target production paths and explicitly accepted.

---

## Final “ready for migration” criteria

Mark ready only when all are true:

- [ ] `secret-matrix.md` completed; required keys present in target; drift actions resolved or formally accepted.
- [ ] `supabase-parity-checklist.md` completed for tables, buckets, RLS, edge functions, and schedulers.
- [ ] Every drift row has explicit action + owner.
- [ ] All blocker-class drifts resolved.
- [ ] `cutover-checklist.md` pre-cutover gates are fully checked.
- [ ] Target remains `mtcm-workstation`; source remains `mtcmglassworkstation` for extraction only.
