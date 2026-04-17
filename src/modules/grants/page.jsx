import { useState, useMemo } from 'react'
import { cn } from '../../shared/utils/cn.js'
import { JamalAIPanel } from '../../shared/components/ui/JamalAIPanel.jsx'
import { useGrants } from './hooks/useGrants.js'

// ── constants ─────────────────────────────────────────────────────────────────

const STAGES = [
  { value: 'identified', label: 'Identified',  color: 'bg-gray-100 text-gray-700' },
  { value: 'qualifying', label: 'Qualifying',  color: 'bg-yellow-100 text-yellow-700' },
  { value: 'drafting',   label: 'Drafting',    color: 'bg-blue-100 text-blue-700' },
  { value: 'submitted',  label: 'Submitted',   color: 'bg-purple-100 text-purple-700' },
  { value: 'awarded',    label: 'Awarded',     color: 'bg-green-100 text-green-700' },
  { value: 'lost',       label: 'Lost',        color: 'bg-red-100 text-red-700' },
]

const ACTIVE_STAGES = ['identified', 'qualifying', 'drafting', 'submitted', 'awarded']

// ── helpers ───────────────────────────────────────────────────────────────────

function fmt(amount) {
  const n = Number(amount ?? 0)
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`
  if (n >= 1_000_000)     return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)         return `$${(n / 1_000).toFixed(0)}K`
  return `$${n.toLocaleString()}`
}

function stageInfo(value) {
  return STAGES.find((s) => s.value === value) ?? STAGES[0]
}

// ── StatCard ──────────────────────────────────────────────────────────────────

function StatCard({ label, value, loading }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5">
      <p className="text-sm font-medium text-gray-500">{label}</p>
      <p className="mt-2 text-2xl font-bold text-gray-900">
        {loading ? '…' : value}
      </p>
    </div>
  )
}

// ── GrantRow ──────────────────────────────────────────────────────────────────

function GrantRow({ grant, onMove, onDelete, onAskJamal }) {
  const stage = stageInfo(grant.stage)

  return (
    <div className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2 mb-1">
          <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', stage.color)}>
            {stage.label}
          </span>
          {grant.deadline && (
            <span className="text-xs text-gray-400">
              Due {new Date(grant.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
          )}
        </div>
        <h3 className="text-sm font-semibold text-gray-900 truncate">{grant.title}</h3>
        <p className="text-xs text-gray-400 mt-0.5">{grant.agency}</p>
        {grant.notes && (
          <p className="mt-1 text-xs text-gray-500 line-clamp-2">{grant.notes}</p>
        )}
      </div>

      <div className="flex flex-col items-end gap-2 shrink-0">
        {grant.amount > 0 && (
          <span className="rounded bg-indigo-600 px-2.5 py-0.5 text-xs font-bold text-white">
            {fmt(grant.amount)}
          </span>
        )}
        <div className="flex gap-1.5 flex-wrap justify-end">
          {/* Advance stage */}
          {grant.stage !== 'awarded' && grant.stage !== 'lost' && (
            <button
              onClick={() => {
                const idx = STAGES.findIndex((s) => s.value === grant.stage)
                if (idx < STAGES.length - 2) onMove(grant.id, STAGES[idx + 1].value)
              }}
              className="rounded border border-indigo-200 px-2 py-1 text-xs text-indigo-700 hover:bg-indigo-50 transition-colors"
            >
              Advance →
            </button>
          )}
          <button
            onClick={() => onAskJamal(grant)}
            className="rounded bg-indigo-600 px-2 py-1 text-xs font-medium text-white hover:bg-indigo-700 transition-colors"
          >
            Ask JamalAI
          </button>
          <button
            onClick={() => onDelete(grant.id)}
            className="rounded border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50 transition-colors"
          >
            Remove
          </button>
        </div>
      </div>
    </div>
  )
}

// ── GrantForm ─────────────────────────────────────────────────────────────────

function GrantForm({ initial, onSave, onCancel, saving }) {
  const [form, setForm] = useState({
    title:    initial?.title    ?? '',
    agency:   initial?.agency   ?? '',
    amount:   initial?.amount   ?? '',
    deadline: initial?.deadline ? initial.deadline.slice(0, 10) : '',
    stage:    initial?.stage    ?? 'identified',
    notes:    initial?.notes    ?? '',
  })

  function set(key, val) { setForm((f) => ({ ...f, [key]: val })) }

  function handleSubmit(e) {
    e.preventDefault()
    onSave({
      title:    form.title.trim(),
      agency:   form.agency.trim(),
      amount:   Number(form.amount) || 0,
      deadline: form.deadline || null,
      stage:    form.stage,
      notes:    form.notes.trim() || null,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Title *</label>
        <input
          required
          value={form.title}
          onChange={(e) => set('title', e.target.value)}
          className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          placeholder="e.g. VA Rural Transportation Grant"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Agency</label>
          <input
            value={form.agency}
            onChange={(e) => set('agency', e.target.value)}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="Department of Veterans Affairs"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Amount ($)</label>
          <input
            type="number"
            min="0"
            value={form.amount}
            onChange={(e) => set('amount', e.target.value)}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="0"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Stage</label>
          <select
            value={form.stage}
            onChange={(e) => set('stage', e.target.value)}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {STAGES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Deadline</label>
          <input
            type="date"
            value={form.deadline}
            onChange={(e) => set('deadline', e.target.value)}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Notes</label>
        <textarea
          rows={3}
          value={form.notes}
          onChange={(e) => set('notes', e.target.value)}
          className="w-full resize-none rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          placeholder="Eligibility notes, contacts, strategy…"
        />
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="rounded border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save Grant'}
        </button>
      </div>
    </form>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function GrantsPage() {
  const { grants, loading, error, createGrant, updateGrant, deleteGrant } = useGrants()

  const [showForm, setShowForm]   = useState(false)
  const [formSaving, setFormSaving] = useState(false)
  const [toast, setToast]         = useState(null)
  const [stageFilter, setStageFilter] = useState('all')

  // JamalAI panel
  const [aiTask, setAiTask]       = useState('')
  const [aiKey, setAiKey]         = useState(0)

  // ── derived stats ─────────────────────────────────────────────────────────

  const stats = useMemo(() => {
    const active = grants.filter((g) => ACTIVE_STAGES.includes(g.stage))
    const pipelineValue = active.reduce((sum, g) => sum + Number(g.amount ?? 0), 0)
    const byStage = Object.fromEntries(STAGES.map((s) => [s.value, 0]))
    grants.forEach((g) => { byStage[g.stage] = (byStage[g.stage] ?? 0) + 1 })
    return { activeCount: active.length, pipelineValue, byStage }
  }, [grants])

  // ── filtered list ─────────────────────────────────────────────────────────

  const visible = useMemo(
    () => (stageFilter === 'all' ? grants : grants.filter((g) => g.stage === stageFilter)),
    [grants, stageFilter]
  )

  // ── handlers ──────────────────────────────────────────────────────────────

  function showToast(type, msg) {
    setToast({ type, msg })
    setTimeout(() => setToast(null), 5000)
  }

  async function handleSave(fields) {
    setFormSaving(true)
    try {
      await createGrant(fields)
      setShowForm(false)
      showToast('success', `Grant "${fields.title}" added to pipeline.`)
    } catch (err) {
      showToast('error', err?.message ?? 'Failed to create grant.')
    } finally {
      setFormSaving(false)
    }
  }

  async function handleMove(id, newStage) {
    try {
      await updateGrant(id, { stage: newStage })
      showToast('success', `Grant moved to ${stageInfo(newStage).label}.`)
    } catch (err) {
      showToast('error', err?.message ?? 'Failed to update grant.')
    }
  }

  async function handleDelete(id) {
    try {
      await deleteGrant(id)
    } catch (err) {
      showToast('error', err?.message ?? 'Failed to delete grant.')
    }
  }

  function handleAskJamal(grant) {
    setAiTask(
      `I have a federal grant in my pipeline:\n` +
      `Title: ${grant.title}\n` +
      `Agency: ${grant.agency}\n` +
      `Amount: ${fmt(grant.amount)}\n` +
      `Stage: ${grant.stage}\n` +
      `Notes: ${grant.notes ?? 'None'}\n\n` +
      `What should I do next to advance this grant to the next stage?`
    )
    setAiKey((k) => k + 1)
    setTimeout(() => {
      document.getElementById('grants-ai-panel')?.scrollIntoView({ behavior: 'smooth' })
    }, 50)
  }

  function quickPrompt(prompt) {
    setAiTask(prompt)
    setAiKey((k) => k + 1)
    setTimeout(() => {
      document.getElementById('grants-ai-panel')?.scrollIntoView({ behavior: 'smooth' })
    }, 50)
  }

  // ── render ─────────────────────────────────────────────────────────────────

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold text-gray-900">Grant Workflow Engine</h1>
            <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-700">
              Live Pipeline
            </span>
          </div>
          <p className="mt-1 text-sm text-gray-500">
            Track federal grants from identification to award
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="shrink-0 rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
        >
          + Create New Grant
        </button>
      </div>

      {/* Toast */}
      {toast && (
        <div
          className={cn(
            'mb-4 rounded-md px-4 py-3 text-sm',
            toast.type === 'success'
              ? 'border border-green-200 bg-green-50 text-green-800'
              : 'border border-red-200 bg-red-50 text-red-700'
          )}
        >
          {toast.msg}
        </div>
      )}

      {/* Create Grant form (inline panel) */}
      {showForm && (
        <div className="mb-6 rounded-lg border border-indigo-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold text-gray-900">New Grant</h2>
          <GrantForm
            onSave={handleSave}
            onCancel={() => setShowForm(false)}
            saving={formSaving}
          />
        </div>
      )}

      {/* Stats */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Active Grants"   value={stats.activeCount}        loading={loading} />
        <StatCard label="Pipeline Value"  value={fmt(stats.pipelineValue)} loading={loading} />
        <StatCard label="In Drafting"     value={stats.byStage.drafting}   loading={loading} />
        <StatCard label="Submitted"       value={stats.byStage.submitted}  loading={loading} />
      </div>

      {/* Stage filter tabs */}
      <div className="mb-4 flex flex-wrap gap-2">
        <button
          onClick={() => setStageFilter('all')}
          className={cn(
            'rounded-full px-3 py-1 text-xs font-medium transition-colors',
            stageFilter === 'all'
              ? 'bg-indigo-600 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          )}
        >
          All ({grants.length})
        </button>
        {STAGES.map((s) => (
          <button
            key={s.value}
            onClick={() => setStageFilter(s.value)}
            className={cn(
              'rounded-full px-3 py-1 text-xs font-medium transition-colors',
              stageFilter === s.value
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            )}
          >
            {s.label} ({stats.byStage[s.value] ?? 0})
          </button>
        ))}
      </div>

      {/* Grant list */}
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {loading ? (
        <p className="text-sm text-gray-500">Loading grants…</p>
      ) : visible.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 py-16 text-center">
          <p className="text-sm text-gray-500">No grants in pipeline yet.</p>
          <p className="mt-1 text-xs text-gray-400">
            Use <strong>+ Create New Grant</strong> or click <strong>Add to Grant Pipeline</strong> on a VA Opportunity card.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map((g) => (
            <GrantRow
              key={g.id}
              grant={g}
              onMove={handleMove}
              onDelete={handleDelete}
              onAskJamal={handleAskJamal}
            />
          ))}
        </div>
      )}

      {/* JamalAI quick-prompt buttons */}
      <div className="mt-8">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
          JamalAI Quick Actions
        </p>
        <div className="mb-4 flex flex-wrap gap-2">
          <button
            onClick={() => quickPrompt('Generate a capability statement for a veteran-owned small business pursuing VA grants. Highlight past performance, core competencies, and SDVOSB certifications.')}
            className="rounded border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100 transition-colors"
          >
            Generate Capability Statement
          </button>
          <button
            onClick={() => quickPrompt('Draft a federal grant proposal narrative for a VA opportunity. Include an executive summary, problem statement, project description, evaluation plan, and organizational qualifications.')}
            className="rounded border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100 transition-colors"
          >
            Draft Proposal
          </button>
          <button
            onClick={() => quickPrompt('Check eligibility requirements for common VA grant programs. What certifications, registrations (SAM.gov, UEI), and documentation does a small business need to apply?')}
            className="rounded border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100 transition-colors"
          >
            Check Eligibility
          </button>
          <button
            onClick={() => quickPrompt('Summarize the current state of my grant pipeline. What stages are most grants in, and what actions should I prioritize to maximize awards?')}
            className="rounded border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100 transition-colors"
          >
            Summarize Pipeline
          </button>
        </div>
      </div>

      {/* JamalAI panel */}
      <div id="grants-ai-panel">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
          JamalAI — Grant Builder
        </h2>
        <JamalAIPanel
          key={aiKey}
          module="grants"
          initialTask={aiTask}
          placeholder='e.g. "Draft an executive summary for the VA suicide prevention grant"'
        />
      </div>
    </div>
  )
}
