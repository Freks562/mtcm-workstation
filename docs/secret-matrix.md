# Supabase Secret Matrix Worksheet

## Consolidation Direction

- **Target (final source of truth):** `mtcm-workstation`
- **Legacy source (extract truth from):** `mtcmglassworkstation`
- **Rule:** fill this worksheet with presence/parity status only; do not paste secret values into git.

## 1) Repo-derived secret inventory (side-by-side)

| Secret / Env Key | Required by repo | Repo reference(s) | Legacy present? (`mtcmglassworkstation`) | Target present? (`mtcm-workstation`) | Parity status | Rotate at cutover? | Notes |
|---|---|---|---|---|---|---|---|
| `VITE_SUPABASE_URL` | Yes | `/home/runner/work/mtcm-workstation/mtcm-workstation/src/lib/supabase.js`, `/home/runner/work/mtcm-workstation/mtcm-workstation/src/auth/LoginPage.jsx` | [ ] Yes [ ] No | [ ] Yes [ ] No | [ ] Match [ ] Drift | [ ] Yes [ ] No | Frontend runtime |
| `VITE_SUPABASE_ANON_KEY` | Yes | `/home/runner/work/mtcm-workstation/mtcm-workstation/src/lib/supabase.js`, `/home/runner/work/mtcm-workstation/mtcm-workstation/src/auth/LoginPage.jsx` | [ ] Yes [ ] No | [ ] Yes [ ] No | [ ] Match [ ] Drift | [ ] Yes [ ] No | Frontend runtime |
| `SUPABASE_URL` | Yes | `/home/runner/work/mtcm-workstation/mtcm-workstation/supabase/functions/send-emails/index.ts`, `/home/runner/work/mtcm-workstation/mtcm-workstation/supabase/functions/run-task/index.ts` | [ ] Yes [ ] No | [ ] Yes [ ] No | [ ] Match [ ] Drift | [ ] Yes [ ] No | Usually runtime-injected |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | `/home/runner/work/mtcm-workstation/mtcm-workstation/supabase/functions/send-emails/index.ts`, `/home/runner/work/mtcm-workstation/mtcm-workstation/supabase/functions/freksframe-render/index.ts` | [ ] Yes [ ] No | [ ] Yes [ ] No | [ ] Match [ ] Drift | [ ] Yes [ ] No | Usually runtime-injected |
| `SUPABASE_ANON_KEY` | Yes | `/home/runner/work/mtcm-workstation/mtcm-workstation/supabase/functions/va-opportunity-feed/index.ts` | [ ] Yes [ ] No | [ ] Yes [ ] No | [ ] Match [ ] Drift | [ ] Yes [ ] No | Function dependency |
| `RESEND_API_KEY` | Yes | `/home/runner/work/mtcm-workstation/mtcm-workstation/supabase/functions/send-emails/index.ts`, `/home/runner/work/mtcm-workstation/mtcm-workstation/docs/dotmail-production-runbook.md` | [ ] Yes [ ] No | [ ] Yes [ ] No | [ ] Match [ ] Drift | [ ] Yes [ ] No | DotMail send path |
| `RESEND_FROM_ADDRESS` | Yes | `/home/runner/work/mtcm-workstation/mtcm-workstation/supabase/functions/send-emails/index.ts`, `/home/runner/work/mtcm-workstation/mtcm-workstation/docs/dotmail-production-runbook.md` | [ ] Yes [ ] No | [ ] Yes [ ] No | [ ] Match [ ] Drift | [ ] Yes [ ] No | DotMail sender |
| `AI_API_KEY` | Yes | `/home/runner/work/mtcm-workstation/mtcm-workstation/supabase/functions/jamalai-gateway/index.ts`, `/home/runner/work/mtcm-workstation/mtcm-workstation/supabase/functions/jamalaibrain/index.ts`, `/home/runner/work/mtcm-workstation/mtcm-workstation/supabase/functions/jamalai-assist/index.ts`, `/home/runner/work/mtcm-workstation/mtcm-workstation/supabase/functions/run-task/index.ts`, `/home/runner/work/mtcm-workstation/mtcm-workstation/supabase/functions/freksframe-generate-scene/index.ts` | [ ] Yes [ ] No | [ ] Yes [ ] No | [ ] Match [ ] Drift | [ ] Yes [ ] No | Shared AI secret |
| `AI_BASE_URL` | Yes | same files as `AI_API_KEY` | [ ] Yes [ ] No | [ ] Yes [ ] No | [ ] Match [ ] Drift | [ ] Yes [ ] No | Shared AI config |
| `AI_MODEL` | Yes | same files as `AI_API_KEY` | [ ] Yes [ ] No | [ ] Yes [ ] No | [ ] Match [ ] Drift | [ ] Yes [ ] No | Shared AI config |
| `IMAGE_PROVIDER` | Conditional | `/home/runner/work/mtcm-workstation/mtcm-workstation/supabase/functions/freksframe-generate-scene/index.ts` | [ ] Yes [ ] No | [ ] Yes [ ] No | [ ] Match [ ] Drift | [ ] Yes [ ] No | FreksFrame image path |
| `REPLICATE_API_TOKEN` | Conditional | `/home/runner/work/mtcm-workstation/mtcm-workstation/supabase/functions/freksframe-generate-scene/index.ts` | [ ] Yes [ ] No | [ ] Yes [ ] No | [ ] Match [ ] Drift | [ ] Yes [ ] No | FreksFrame provider token |

## 2) Observed runtime dependencies not currently repo-referenced

Use this section for keys seen in dashboard/runtime checks that are not currently referenced by repository code.

| Secret / Env Key | Evidence source | Legacy present? | Target present? | Action |
|---|---|---|---|---|
| `SLACK_WEBHOOK_URL` | Provided runtime screenshot/context | [ ] Yes [ ] No | [ ] Yes [ ] No | Confirm if still required; remove or migrate intentionally |
| `ALERT_EMAIL` | Provided runtime screenshot/context | [ ] Yes [ ] No | [ ] Yes [ ] No | Confirm if still required; remove or migrate intentionally |

## 3) Completion gates

- [ ] Every required repo-derived key has presence checked in both projects.
- [ ] Every drift is labeled: `accept`, `rotate`, or `remove`.
- [ ] No secret values stored in repository files.
- [ ] Target (`mtcm-workstation`) has complete runtime parity before cutover.
