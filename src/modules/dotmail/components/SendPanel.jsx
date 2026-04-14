import { useState } from 'react'
import { cn } from '../../../shared/utils/cn.js'

/**
 * SendPanel — shown when clicking "Send" on an email campaign.
 *
 * Queues one email per selected contact to the `emails` table with status='queued'.
 * A Supabase Edge Function (supabase/functions/send-emails/index.ts) is the
 * intended server-side hook that picks up queued rows and calls Resend.
 */
export function SendPanel({ campaign, contacts, templates, onQueue, onClose, saving }) {
  const [selectedContacts, setSelectedContacts] = useState([])
  const [templateId, setTemplateId] = useState('')
  const [subject, setSubject] = useState(campaign?.subject ?? '')
  const [body, setBody] = useState(campaign?.body ?? '')
  const [error, setError] = useState(null)

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

  return (
    <form onSubmit={handleQueue} className="space-y-4">
      <p className="rounded bg-amber-50 px-3 py-2 text-xs text-amber-700">
        Emails will be queued (status = <code>queued</code>). A server-side Supabase
        Edge Function must call Resend to deliver them.
        Hook point: <code>supabase/functions/send-emails/index.ts</code>
      </p>

      {error && (
        <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
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

      <div className="flex justify-end gap-3 pt-2">
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
    </form>
  )
}
