// Shared reusable JamalAI assistant panel.
// Calls `jamalai-gateway` with a `module` + `task` payload so every page gets
// context-aware AI help without duplicating function-invoke logic.
//
// Usage:
//   <JamalAIPanel module="crm" placeholder="Ask anything about your contacts…" />
//   <JamalAIPanel module="telemarketing" />
//   <JamalAIPanel module="dotmail" />
//   <JamalAIPanel module="analytics" />

import { useEffect, useRef, useState } from 'react'
import { supabase } from '../../../lib/supabase.js'

const MODULE_LABELS = {
  crm: 'CRM Assistant',
  telemarketing: 'Telemarketing Assistant',
  dotmail: 'Dotmail Assistant',
  analytics: 'Analytics Assistant',
}

const MODULE_PLACEHOLDERS = {
  crm: 'e.g. "Draft a follow-up for a warm lead", "Summarize my open deals"',
  telemarketing: 'e.g. "Write a 30-second cold-call opener", "Best script for a callback"',
  dotmail: 'e.g. "Write a subject line for a re-engagement campaign", "Draft a welcome email"',
  analytics: 'e.g. "What does my pipeline look like?", "Highlight any anomalies this week"',
}

export function JamalAIPanel({ module, placeholder }) {
  const [task, setTask] = useState('')
  const [reply, setReply] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const replyRef = useRef(null)

  const label = MODULE_LABELS[module] ?? 'JamalAI Assistant'
  const hint = placeholder ?? MODULE_PLACEHOLDERS[module] ?? 'Ask anything…'

  async function handleSubmit(e) {
    e.preventDefault()
    if (!task.trim() || loading) return
    setLoading(true)
    setError(null)
    setReply(null)
    try {
      // When no module is given → brain route ({ prompt })
      // When module is given   → assist route ({ module, task })
      const body = module
        ? { module, task: task.trim() }
        : { prompt: task.trim() }
      const { data, error: fnError } = await supabase.functions.invoke('jamalai-gateway', { body })
      if (fnError) throw fnError
      setReply(data?.reply ?? '')
    } catch (err) {
      setError(err?.message ?? 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (reply !== null && replyRef.current) {
      replyRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [reply])

  return (
    <div className="rounded-lg border border-indigo-200 bg-white p-6">
      <div className="mb-4 flex items-center gap-2">
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white">
          AI
        </span>
        <h3 className="text-sm font-semibold text-gray-900">{label}</h3>
        <span className="ml-auto rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700">
          Beta
        </span>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <textarea
          rows={3}
          className="w-full resize-none rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
          placeholder={hint}
          value={task}
          onChange={(e) => setTask(e.target.value)}
          disabled={loading}
        />
        <button
          type="submit"
          disabled={!task.trim() || loading}
          className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <>
              <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              Thinking…
            </>
          ) : (
            `Ask ${label}`
          )}
        </button>
      </form>

      {error && (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {reply !== null && !error && (
        <div
          ref={replyRef}
          className="mt-4 rounded-md border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-800 whitespace-pre-wrap"
        >
          {reply}
        </div>
      )}
    </div>
  )
}
