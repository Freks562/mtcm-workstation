import { useState, useMemo } from 'react'
import { cn } from '../../../shared/utils/cn.js'
import { JamalAIPanel } from '../../../shared/components/ui/JamalAIPanel.jsx'

// ── constants ─────────────────────────────────────────────────────────────────

const MEETING_TYPES = ['discovery', 'demo', 'proposal', 'follow-up', 'debrief']

const STATUS_OPTIONS = [
  { value: 'scheduled', label: 'Scheduled',    color: 'bg-blue-100 text-blue-700' },
  { value: 'completed', label: 'Completed',    color: 'bg-green-100 text-green-700' },
  { value: 'follow-up', label: 'Follow-up Due', color: 'bg-yellow-100 text-yellow-700' },
  { value: 'cancelled', label: 'Cancelled',    color: 'bg-gray-100 text-gray-500' },
]

const TYPE_COLOR = {
  discovery:  'bg-indigo-100 text-indigo-700',
  demo:       'bg-purple-100 text-purple-700',
  proposal:   'bg-blue-100 text-blue-700',
  'follow-up':'bg-yellow-100 text-yellow-700',
  debrief:    'bg-gray-100 text-gray-600',
}

const INITIAL_MEETINGS = [
  {
    id: '1',
    title: 'VA Grants Discovery Call',
    contact: 'VA Procurement Officer',
    type: 'discovery',
    status: 'follow-up',
    date: '2026-04-10',
    notes: 'Discussed SDVOSB eligibility and upcoming RFP timeline. Follow up with capability statement.',
  },
  {
    id: '2',
    title: 'CRM Platform Demo',
    contact: 'MTCM Internal',
    type: 'demo',
    status: 'completed',
    date: '2026-04-14',
    notes: 'Full demo of CRM, grants engine, and JamalAI. Well received.',
  },
]

// ── helpers ───────────────────────────────────────────────────────────────────

function statusInfo(value) {
  return STATUS_OPTIONS.find((s) => s.value === value) ?? STATUS_OPTIONS[0]
}

// ── MeetingCard ───────────────────────────────────────────────────────────────

function MeetingCard({ meeting, onStatusChange, onDelete }) {
  const status = statusInfo(meeting.status)

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex flex-wrap gap-1.5">
          <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium capitalize', TYPE_COLOR[meeting.type] ?? 'bg-gray-100 text-gray-600')}>
            {meeting.type}
          </span>
          <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', status.color)}>
            {status.label}
          </span>
        </div>
        <span className="shrink-0 text-xs text-gray-400">
          {new Date(meeting.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
        </span>
      </div>

      <h3 className="text-sm font-semibold text-gray-900">{meeting.title}</h3>
      {meeting.contact && (
        <p className="text-xs text-gray-400 mt-0.5">{meeting.contact}</p>
      )}
      {meeting.notes && (
        <p className="mt-2 text-xs text-gray-500 line-clamp-2">{meeting.notes}</p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-2">
        <select
          value={meeting.status}
          onChange={(e) => onStatusChange(meeting.id, e.target.value)}
          className="rounded border border-gray-200 px-2 py-1 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
        <button
          onClick={() => onDelete(meeting.id)}
          className="ml-auto rounded border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50 transition-colors"
        >
          Remove
        </button>
      </div>
    </div>
  )
}

// ── MeetingForm ───────────────────────────────────────────────────────────────

function MeetingForm({ onSave, onCancel }) {
  const today = new Date().toISOString().slice(0, 10)
  const [form, setForm] = useState({
    title:   '',
    contact: '',
    type:    'discovery',
    status:  'scheduled',
    date:    today,
    notes:   '',
  })

  function set(key, val) { setForm((f) => ({ ...f, [key]: val })) }

  function handleSubmit(e) {
    e.preventDefault()
    onSave({ ...form, id: crypto.randomUUID() })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Meeting Title *</label>
        <input
          required
          value={form.title}
          onChange={(e) => set('title', e.target.value)}
          className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          placeholder="e.g. VA Grants Discovery Call"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Contact / Company</label>
          <input
            value={form.contact}
            onChange={(e) => set('contact', e.target.value)}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="Agency or contact name"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Date</label>
          <input
            type="date"
            value={form.date}
            onChange={(e) => set('date', e.target.value)}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Type</label>
          <select
            value={form.type}
            onChange={(e) => set('type', e.target.value)}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {MEETING_TYPES.map((t) => (
              <option key={t} value={t} className="capitalize">{t}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Status</label>
          <select
            value={form.status}
            onChange={(e) => set('status', e.target.value)}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Notes</label>
        <textarea
          rows={3}
          value={form.notes}
          onChange={(e) => set('notes', e.target.value)}
          className="w-full resize-none rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          placeholder="Agenda, outcomes, follow-up actions…"
        />
      </div>
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          Save Meeting
        </button>
      </div>
    </form>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function MeetingDemoPage() {
  const [meetings, setMeetings]   = useState(INITIAL_MEETINGS)
  const [showForm, setShowForm]   = useState(false)
  const [statusFilter, setStatusFilter] = useState('all')
  const [aiKey, setAiKey]         = useState(0)
  const [aiTask, setAiTask]       = useState('')

  // ── derived stats ─────────────────────────────────────────────────────────

  const stats = useMemo(() => ({
    total:      meetings.length,
    scheduled:  meetings.filter((m) => m.status === 'scheduled').length,
    followUp:   meetings.filter((m) => m.status === 'follow-up').length,
    completed:  meetings.filter((m) => m.status === 'completed').length,
    demos:      meetings.filter((m) => m.type === 'demo').length,
  }), [meetings])

  const visible = useMemo(
    () => statusFilter === 'all' ? meetings : meetings.filter((m) => m.status === statusFilter),
    [meetings, statusFilter]
  )

  // ── handlers ──────────────────────────────────────────────────────────────

  function handleSave(fields) {
    setMeetings((prev) => [fields, ...prev])
    setShowForm(false)
  }

  function handleStatusChange(id, newStatus) {
    setMeetings((prev) => prev.map((m) => m.id === id ? { ...m, status: newStatus } : m))
  }

  function handleDelete(id) {
    setMeetings((prev) => prev.filter((m) => m.id !== id))
  }

  function quickPrompt(prompt) {
    setAiTask(prompt)
    setAiKey((k) => k + 1)
    setTimeout(() => {
      document.getElementById('meetingdemo-ai-panel')?.scrollIntoView({ behavior: 'smooth' })
    }, 50)
  }

  // ── render ─────────────────────────────────────────────────────────────────

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Meeting & Demo Tracker</h1>
          <p className="mt-1 text-sm text-gray-500">
            Track discovery calls, demos, and follow-ups for federal opportunities
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="shrink-0 rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
        >
          + Log Meeting
        </button>
      </div>

      {/* New meeting form */}
      {showForm && (
        <div className="mb-6 rounded-lg border border-indigo-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold text-gray-900">New Meeting / Demo</h2>
          <MeetingForm onSave={handleSave} onCancel={() => setShowForm(false)} />
        </div>
      )}

      {/* Stats */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-gray-200 bg-white p-5">
          <p className="text-sm font-medium text-gray-500">Total Meetings</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">{stats.total}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-5">
          <p className="text-sm font-medium text-gray-500">Scheduled</p>
          <p className="mt-2 text-2xl font-bold text-blue-600">{stats.scheduled}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-5">
          <p className="text-sm font-medium text-gray-500">Follow-up Due</p>
          <p className="mt-2 text-2xl font-bold text-yellow-600">{stats.followUp}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-5">
          <p className="text-sm font-medium text-gray-500">Demos Conducted</p>
          <p className="mt-2 text-2xl font-bold text-purple-600">{stats.demos}</p>
        </div>
      </div>

      {/* Status filter tabs */}
      <div className="mb-4 flex flex-wrap gap-2">
        {[
          { value: 'all', label: `All (${meetings.length})` },
          ...STATUS_OPTIONS.map((s) => ({
            value: s.value,
            label: `${s.label} (${meetings.filter((m) => m.status === s.value).length})`,
          })),
        ].map((opt) => (
          <button
            key={opt.value}
            onClick={() => setStatusFilter(opt.value)}
            className={cn(
              'rounded-full px-3 py-1 text-xs font-medium transition-colors',
              statusFilter === opt.value
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Meeting list */}
      {visible.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 py-16 text-center">
          <p className="text-sm text-gray-500">No meetings logged yet.</p>
          <p className="mt-1 text-xs text-gray-400">Click <strong>+ Log Meeting</strong> to add your first entry.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((m) => (
            <MeetingCard
              key={m.id}
              meeting={m}
              onStatusChange={handleStatusChange}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* JamalAI quick actions */}
      <div className="mt-8">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
          JamalAI Quick Actions
        </h2>
        <div className="mb-4 flex flex-wrap gap-2">
          <button
            onClick={() => quickPrompt('Write a compelling demo script for a veteran-owned SaaS platform targeting VA contracting officers. Cover CRM, grants pipeline, and AI capabilities in 10 minutes.')}
            className="rounded border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100 transition-colors"
          >
            Write Demo Script
          </button>
          <button
            onClick={() => quickPrompt('Write a professional follow-up email after a VA discovery call. Reference our SDVOSB certification, demonstrate understanding of their needs, and propose a next step.')}
            className="rounded border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100 transition-colors"
          >
            Draft Follow-up Email
          </button>
          <button
            onClick={() => quickPrompt('What questions should I ask during a VA discovery call to qualify the opportunity and understand their contracting timeline?')}
            className="rounded border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100 transition-colors"
          >
            Discovery Call Questions
          </button>
          <button
            onClick={() => quickPrompt('How do I prepare for a VA proposal debrief? What questions should I ask to improve future submissions?')}
            className="rounded border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100 transition-colors"
          >
            Debrief Prep
          </button>
        </div>
      </div>

      {/* JamalAI panel */}
      <div id="meetingdemo-ai-panel">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
          JamalAI — Meeting & Demo Assistant
        </h2>
        <JamalAIPanel
          key={aiKey}
          module="grants"
          initialTask={aiTask}
          placeholder='e.g. "Write a follow-up email after my VA demo", "What questions should I ask in discovery?"'
        />
      </div>
    </div>
  )
}
