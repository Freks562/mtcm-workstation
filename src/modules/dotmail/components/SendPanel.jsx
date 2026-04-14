import { useState } from 'react'
import { supabase } from '../../../lib/supabase.js'
import { cn } from '../../../shared/utils/cn.js'

/**
 * SendPanel — shown when clicking "Send" on an email campaign.
 *
 * Queues one email per selected contact to the `emails` table with status='queued'.
 * The "Process Queue" button then invokes the Supabase Edge Function
 * `supabase/functions/send-emails/index.ts` which:
 *   1. Claims queued rows and marks them 'sending'
 *   2. Calls Resend API server-side (RESEND_API_KEY secret never leaves the server)
 *   3. Updates rows to 'sent' (with provider_id) or 'failed' (with failure_reason)
 *   4. Logs email_sent / email_failed events
 */
export function SendPanel({ campaign, contacts, templates, onQueue, onClose, saving }) {
  const [selectedContacts, setSelectedContacts] = useState([])
  const [templateId, setTemplateId] = useState('')
  const [subject, setSubject] = useState(campaign?.subject ?? '')
  const [body, setBody] = useState(campaign?.body ?? '')
  const [error, setError] = useState(null)
  const [processing, setProcessing] = useState(false)
  const [processResult, setProcessResult] = useState(null)

  function toggleContact(id) {
    setSelectedContacts((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    )
  }

  function applyTemplate(id) {
    setTemplateId(id)
    const tpl = templates.find((t) => t.id === id)
    if (tpl) {
      setSubject(tpl.subject)
      setBody(tpl.body)
    }
  }

  async function handleQueue(e) {
    e.preventDefault()
    setError(null)
    if (selectedContacts.length === 0) {
      setError('Select at least one contact.')
      return
    }
    try {
      await onQueue({ selectedContacts, subject, body, templateId: templateId || null })
    } catch (err) {
      setError(err.message)
    }
  }

  /**
   * Invoke the send-emails Edge Function to process queued rows.
   * The function URL is derived from the configured Supabase project URL.
   * RESEND_API_KEY is a server-side secret — it is never present here.
   */
  async function handleProcessQueue() {
    setProcessing(true)
    setProcessResult(null)
    setError(null)
    try {
      const { data, error: fnErr } = await supabase.functions.invoke('send-emails')
      if (fnErr) throw new Error(fnErr.message)
      setProcessResult(data)
    } catch (err) {
      setError(`Process queue failed: ${err.message}`)
    } finally {
      setProcessing(false)
    }
  }

  return (
    <form onSubmit={handleQueue} className="space-y-4">
      <p className="rounded bg-blue-50 px-3 py-2 text-xs text-blue-700">
        Step 1 — Queue emails below. Step 2 — click <strong>Process Queue</strong> to
        deliver via Resend (server-side Edge Function). No API keys in client code.
      </p>

      {error && (
        <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
      )}

      {processResult && (
        <p className="rounded bg-green-50 px-3 py-2 text-xs text-green-700">
          Processed {processResult.processed} — sent: {processResult.sent}, failed: {processResult.failed}
        </p>
      )}

      {templates.length > 0 && (
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Template (optional)</label>
          <select
            value={templateId}
            onChange={(e) => applyTemplate(e.target.value)}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">— no template —</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Subject *</label>
        <input
          required
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Body *</label>
        <textarea
          required
          rows={4}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          className="w-full rounded border border-gray-300 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">
          Recipients ({selectedContacts.length} selected)
        </label>
        <div className="max-h-48 overflow-y-auto rounded border border-gray-200">
          {contacts.length === 0 ? (
            <p className="px-3 py-2 text-sm text-gray-500">No contacts available.</p>
          ) : (
            contacts.map((c) => (
              <label
                key={c.id}
                className={cn(
                  'flex cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-gray-50',
                  selectedContacts.includes(c.id) && 'bg-indigo-50'
                )}
              >
                <input
                  type="checkbox"
                  checked={selectedContacts.includes(c.id)}
                  onChange={() => toggleContact(c.id)}
                  className="accent-indigo-600"
                />
                <span className="font-medium text-gray-800">
                  {c.first_name} {c.last_name}
                </span>
                {c.email && <span className="text-gray-500">&lt;{c.email}&gt;</span>}
              </label>
            ))
          )}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 pt-2">
        <button
          type="button"
          onClick={handleProcessQueue}
          disabled={processing}
          className={cn(
            'rounded border border-indigo-600 px-3 py-2 text-sm font-medium text-indigo-600 hover:bg-indigo-50 disabled:opacity-50'
          )}
        >
          {processing ? 'Processing…' : 'Process Queue'}
        </button>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded px-4 py-2 text-sm text-gray-600 hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className={cn(
              'rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50'
            )}
          >
            {saving ? 'Queuing…' : `Queue ${selectedContacts.length} Email${selectedContacts.length !== 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </form>
  )
}
