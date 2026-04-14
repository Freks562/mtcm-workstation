import { useState } from 'react'
import { cn } from '../../../shared/utils/cn.js'

const OUTCOMES = [
  { value: 'no_answer', label: 'No Answer' },
  { value: 'answered', label: 'Answered' },
  { value: 'callback', label: 'Callback Requested' },
  { value: 'voicemail', label: 'Voicemail' },
  { value: 'do_not_call', label: 'Do Not Call' },
  { value: 'converted', label: 'Converted' },
]

const EMPTY = {
  duration_seconds: '',
  outcome: 'no_answer',
  notes: '',
  callback_at: '',
}

export function CallLogForm({ contact, onSubmit, onCancel, saving }) {
  const [fields, setFields] = useState(EMPTY)
  const [error, setError] = useState(null)

  function set(key, value) {
    setFields((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    try {
      await onSubmit({
        ...fields,
        duration_seconds: fields.duration_seconds ? parseInt(fields.duration_seconds, 10) : 0,
        callback_at: fields.callback_at || null,
      })
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {contact && (
        <p className="rounded bg-gray-50 px-3 py-2 text-sm text-gray-700">
          Logging call for{' '}
          <span className="font-medium">{contact.first_name} {contact.last_name}</span>
          {contact.phone && <span className="ml-2 text-gray-500">({contact.phone})</span>}
        </p>
      )}

      {error && (
        <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
      )}

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Outcome *</label>
        <select
          value={fields.outcome}
          onChange={(e) => set('outcome', e.target.value)}
          className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          {OUTCOMES.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Duration (seconds)</label>
        <input
          type="number"
          min="0"
          value={fields.duration_seconds}
          onChange={(e) => set('duration_seconds', e.target.value)}
          className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      {fields.outcome === 'callback' && (
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Callback Date/Time</label>
          <input
            type="datetime-local"
            value={fields.callback_at}
            onChange={(e) => set('callback_at', e.target.value)}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      )}

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Notes</label>
        <textarea
          rows={3}
          value={fields.notes}
          onChange={(e) => set('notes', e.target.value)}
          className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
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
          {saving ? 'Logging…' : 'Log Call'}
        </button>
      </div>
    </form>
  )
}
