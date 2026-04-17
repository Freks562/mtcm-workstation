# Supabase Consolidation Cutover Checklist

## Consolidation Direction

- **Target (final source of truth):** `mtcm-workstation`
- **Legacy source (extract truth from):** `mtcmglassworkstation`
- **Rule:** cut over only after full parity is demonstrated.

---

## 1) Pre-cutover gates (must all pass)

### 1.1 Secret and config parity

- [ ] `/home/runner/work/mtcm-workstation/mtcm-workstation/docs/secret-matrix.md` is fully completed.
- [ ] All repo-required secrets exist in target (`mtcm-workstation`).
- [ ] Legacy-only runtime keys are either migrated intentionally or explicitly retired.
- [ ] OAuth provider settings and redirect URLs are parity-checked between legacy and target.

### 1.2 Data model and storage parity

- [ ] `/home/runner/work/mtcm-workstation/mtcm-workstation/docs/supabase-parity-checklist.md` table worksheet is complete.
- [ ] Missing repo gaps are documented and approved (e.g., `vetrights_*` table migration plan).
- [ ] Bucket parity is complete (`freks-assets`, `vetrights-files`, and any discovered legacy buckets).
- [ ] RLS policy parity is complete and signed off.

### 1.3 Functions and schedulers parity

- [ ] All repo edge functions are deployed in target and pass smoke checks.
- [ ] Scheduler/pg_cron jobs needed for production are configured in target.
- [ ] Function secrets in target are verified against expected runtime dependencies.

---

## 2) Cutover execution steps

1. [ ] Freeze non-essential production config changes in legacy project.
2. [ ] Take final legacy inventory snapshots (secrets presence, table/bucket/RLS/function/scheduler metadata).
3. [ ] Apply approved parity remediations in target.
4. [ ] Re-run smoke tests in target with production-like data paths.
5. [ ] Switch frontend runtime to target (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`).
6. [ ] Execute immediate post-switch verification.

---

## 3) Immediate post-switch verification

- [ ] Login/auth flows succeed.
- [ ] DotMail queue processing and send path succeed (`send-emails`).
- [ ] File upload/read paths succeed (`freks-assets`, `vetrights-files` where applicable).
- [ ] Opportunities flow succeeds (`va_opportunities` and related feed behavior).
- [ ] JamalAI panel and related function routes respond as expected.
- [ ] No new critical errors in edge function logs.

---

## 4) Stabilization window

- [ ] Define observation window start/end and owner.
- [ ] Monitor auth, email, uploads, and opportunity workflows.
- [ ] Track incident log and parity defects discovered after cutover.
- [ ] Confirm rollback criteria and rollback owner during window.

---

## 5) Legacy decommission gates

- [ ] Target remains stable through observation window.
- [ ] No unresolved P0 parity defects remain.
- [ ] Legacy project access is restricted/read-only before shutdown.
- [ ] Final decommission approval recorded.

---

## 6) Sign-off

| Role | Name | Date | Decision |
|---|---|---|---|
| Engineering |  |  | [ ] Go [ ] No-Go |
| Product/Ops |  |  | [ ] Go [ ] No-Go |
| Security/Compliance |  |  | [ ] Go [ ] No-Go |
