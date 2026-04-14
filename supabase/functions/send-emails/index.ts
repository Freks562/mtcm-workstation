// Supabase Edge Function: send-emails
// ────────────────────────────────────────────────────────────────────────────
// Processes outbound emails queued in the `emails` table and delivers them
// via the Resend API.  This function runs server-side only; no provider secret
// ever touches the client.
//
// Invocation options:
//   a) HTTP POST  – call from the UI's "Process Queue" button or a webhook
//   b) pg_cron    – schedule with: select cron.schedule('send-emails', '* * * * *',
//                    $$select net.http_post(url:='<function-url>', ...) $$);
//
// Required Supabase secrets (set via `supabase secrets set`):
//   RESEND_API_KEY      – Resend API key  (never in client code)
//   SUPABASE_URL        – auto-provided by Supabase runtime
//   SUPABASE_SERVICE_ROLE_KEY – auto-provided by Supabase runtime
//
// Status lifecycle handled here:
//   queued  ──► sending ──► sent      (success, provider_id populated)
//                       ──► failed    (Resend error, failure_reason populated)
// ────────────────────────────────────────────────────────────────────────────

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const BATCH_SIZE = 50   // maximum emails to process per invocation
const RESEND_API_URL = 'https://api.resend.com/emails'
const FROM_EMAIL = 'MTCM <ceo@mtcmlive.com>'

serve(async (_req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } }
  )

  const resendKey = Deno.env.get('RESEND_API_KEY')
  if (!resendKey) {
    return new Response(
      JSON.stringify({ error: 'RESEND_API_KEY secret is not configured.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }

  // ── 1. Claim a batch of queued emails atomically ───────────────────────
  // Only process outbound emails (direction = 'outbound').
  // Mark them as 'sending' immediately to prevent double-processing if the
  // function is invoked concurrently.
  const { data: batch, error: fetchErr } = await supabase
    .from('emails')
    .select('id, subject, body, contact_id, contacts(email, first_name, last_name)')
    .eq('status', 'queued')
    .eq('direction', 'outbound')
    .order('created_at', { ascending: true })
    .limit(BATCH_SIZE)

  if (fetchErr) {
    return new Response(
      JSON.stringify({ error: fetchErr.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }

  if (!batch || batch.length === 0) {
    return new Response(
      JSON.stringify({ processed: 0, message: 'No queued emails found.' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  }

  // Claim the batch: set status = 'sending'
  const ids = batch.map((r: any) => r.id)
  await supabase
    .from('emails')
    .update({ status: 'sending' })
    .in('id', ids)

  // ── 2. Send each email via Resend ──────────────────────────────────────
  const results = await Promise.allSettled(
    batch.map((row: any) => sendOne(row, resendKey))
  )

  let sentCount = 0
  let failedCount = 0

  for (let i = 0; i < batch.length; i++) {
    const row = batch[i]
    const result = results[i]

    if (result.status === 'fulfilled' && result.value.ok) {
      // ── Success path ───────────────────────────────────────────────────
      const resendData = result.value.data
      await supabase
        .from('emails')
        .update({
          status: 'sent',
          provider_id: resendData?.id ?? null,
          sent_at: new Date().toISOString(),
        })
        .eq('id', row.id)

      await logEvent(supabase, {
        type: 'email_sent',
        entityId: row.id,
        metadata: { subject: row.subject, provider_id: resendData?.id ?? null },
      })

      sentCount++
    } else {
      // ── Failure path ───────────────────────────────────────────────────
      const reason =
        result.status === 'rejected'
          ? String(result.reason)
          : result.value?.errorMessage ?? 'Unknown Resend error'

      await supabase
        .from('emails')
        .update({
          status: 'failed',
          failure_reason: reason,
        })
        .eq('id', row.id)

      await logEvent(supabase, {
        type: 'email_failed',
        entityId: row.id,
        metadata: { subject: row.subject, failure_reason: reason },
      })

      failedCount++
    }
  }

  return new Response(
    JSON.stringify({ processed: batch.length, sent: sentCount, failed: failedCount }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  )
})

// ── Helpers ────────────────────────────────────────────────────────────────

interface SendResult {
  ok: boolean
  data?: { id: string }
  errorMessage?: string
}

async function sendOne(row: any, resendKey: string): Promise<SendResult> {
  const contact = row.contacts
  const toEmail = contact?.email
  if (!toEmail) {
    return { ok: false, errorMessage: 'Contact has no email address.' }
  }

  const toName =
    contact.first_name || contact.last_name
      ? `${contact.first_name ?? ''} ${contact.last_name ?? ''}`.trim()
      : undefined

  const payload: Record<string, unknown> = {
    from: FROM_EMAIL,
    to: toName ? [`${toName} <${toEmail}>`] : [toEmail],
    subject: row.subject,
    // Detect HTML: if body contains an HTML tag send as html, else as text
    ...(/<[a-z][\s\S]*>/i.test(row.body)
      ? { html: row.body }
      : { text: row.body }),
  }

  const resp = await fetch(RESEND_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  if (resp.ok) {
    const data = await resp.json()
    return { ok: true, data }
  }

  let errorMessage = `Resend HTTP ${resp.status}`
  try {
    const body = await resp.json()
    errorMessage = body?.message ?? errorMessage
  } catch (_) { /* ignore parse errors */ }

  return { ok: false, errorMessage }
}

async function logEvent(
  supabase: ReturnType<typeof createClient>,
  { type, entityId, metadata }: { type: string; entityId: string; metadata: Record<string, unknown> }
) {
  // Events written with service role — actor_id is null (system action)
  await supabase.from('events').insert({
    type,
    actor_id: null,
    entity_type: 'email',
    entity_id: entityId,
    metadata,
  })
}
