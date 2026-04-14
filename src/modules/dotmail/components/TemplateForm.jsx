import { useState } from 'react'
import { cn } from '../../../shared/utils/cn.js'

const EMPTY = { name: '', subject: '', body: '' }

export function TemplateForm({ initial = EMPTY, onSubmit, onCancel, saving }) {
  const [fields, setFields] = useState({ ...EMPTY, ...initial })
  const [error, setError] = useState(null)

  function set(key, value) {
    setFields((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    try {
      await onSubmit(fields)
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
      )}

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Template Name *</label>
        <input
          required
          value={fields.name}
          onChange={(e) => set('name', e.target.value)}
          className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Subject *</label>
        <input
          required
          value={fields.subject}
          onChange={(e) => set('subject', e.target.value)}
          className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Body *</label>
        <textarea
          required
          rows={6}
          value={fields.body}
          onChange={(e) => set('body', e.target.value)}
          placeholder="Plain text or HTML body…"
          className="w-full rounded border border-gray-300 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
          {saving ? 'Saving…' : 'Save Template'}
        </button>
      </div>
    </form>
  )
}
