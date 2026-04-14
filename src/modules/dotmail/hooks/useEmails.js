import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../../../lib/supabase.js'
import { logEvent } from '../../../lib/logEvent.js'

export function useEmails(campaignId) {
  const [emails, setEmails] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    let query = supabase
      .from('emails')
      .select('*, contacts(first_name, last_name, email), profiles:sender_id(full_name)')
      .order('created_at', { ascending: false })

    if (campaignId) query = query.eq('campaign_id', campaignId)

    const { data, error } = await query
    if (error) setError(error.message)
    else setEmails(data ?? [])
    setLoading(false)
  }, [campaignId])

  useEffect(() => { load() }, [load])

  /**
   * Queue an outbound email for sending.
   *
   * Server-side send path (Resend integration hook):
   * ─────────────────────────────────────────────────
   * This function inserts a row with status='queued' which serves as the
   * send queue entry. A Supabase Edge Function or cron job should:
   *   1. SELECT rows WHERE status = 'queued' ORDER BY created_at LIMIT N
   *   2. Call Resend API: POST https://api.resend.com/emails
   *      with headers: { Authorization: `Bearer ${Deno.env.get('RESEND_API_KEY')}` }
   *   3. On success: UPDATE emails SET status='sent', provider_id=<resend_id>, sent_at=now()
   *   4. On failure: UPDATE emails SET status='failed'
   *
   * Edge Function location (to create): supabase/functions/send-emails/index.ts
   * ─────────────────────────────────────────────────
   */
  async function queueEmail(fields, actorId) {
    const row = {
      ...fields,
      status: 'queued',
      direction: 'outbound',
    }
    const { data, error } = await supabase
      .from('emails')
      .insert(row)
      .select('*, contacts(first_name, last_name, email), profiles:sender_id(full_name)')
      .single()
    if (error) throw new Error(error.message)
    setEmails((prev) => [data, ...prev])
    await logEvent({
      type: 'email_send_queued',
      actorId,
      entityType: 'email',
      entityId: data.id,
      metadata: { subject: data.subject, contact_id: data.contact_id },
    })
    return data
  }

  return { emails, loading, error, load, queueEmail }
}
