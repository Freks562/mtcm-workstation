import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase.js'
import { useAuth } from '../../auth/AuthProvider.jsx'
import { JamalAIPanel } from '../../shared/components/ui/JamalAIPanel.jsx'
import { cn } from '../../shared/utils/cn.js'
import { useVaOpportunities } from './hooks/useVaOpportunities.js'

// ── constants ─────────────────────────────────────────────────────────────────

const CATEGORY_OPTIONS = [
  { value: '',           label: 'All Categories' },
  { value: 'grant',      label: 'Grants' },
  { value: 'contract',   label: 'Contracts' },
  { value: 'program',    label: 'Programs' },
  { value: 'employment', label: 'Employment' },
]

const STATUS_OPTIONS = [
  { value: '',         label: 'All Statuses' },
  { value: 'open',     label: 'Open' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'closed',   label: 'Closed' },
]

const CATEGORY_BADGE = {
  grant:      'bg-green-100 text-green-700',
  contract:   'bg-blue-100 text-blue-700',
  program:    'bg-purple-100 text-purple-700',
  employment: 'bg-orange-100 text-orange-700',
}

const STATUS_BADGE = {
  open:     'bg-green-100 text-green-700',
  upcoming: 'bg-yellow-100 text-yellow-700',
  closed:   'bg-gray-100 text-gray-500',
}

// ── helpers ───────────────────────────────────────────────────────────────────

function formatAmount(amount) {
  if (amount == null) return null
  const n = Number(amount)
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`
  if (n >= 1_000_000)     return `$${(n / 1_000_000).toFixed(0)}M`
  if (n >= 1_000)         return `$${(n / 1_000).toFixed(0)}K`
  return `$${n.toLocaleString()}`
}

function deadlineLabel(deadline) {
  if (!deadline) return null
  const now   = new Date()
  const end   = new Date(deadline)
  const diff  = Math.ceil((end - now) / (1000 * 60 * 60 * 24))
  if (diff < 0)  return { text: 'Expired', cls: 'text-red-500' }
  if (diff === 0) return { text: 'Due today', cls: 'text-red-600 font-semibold' }
  if (diff <= 30) return { text: `${diff}d left`, cls: 'text-orange-600 font-medium' }
  return {
    text: end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    cls: 'text-gray-500',
  }
}

// ── OpportunityCard ───────────────────────────────────────────────────────────

function OpportunityCard({ opp, onAskJamal, onAddToCrm, onAddToGrants, onGenerateStory, saving, grantSaving }) {
  const dl = deadlineLabel(opp.deadline)

  return (
    <div className="flex flex-col rounded-lg border border-gray-200 bg-white p-5 shadow-sm hover:shadow-md transition-shadow">
      {/* Top row: category + status badges */}
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          <span
            className={cn(
              'rounded-full px-2 py-0.5 text-xs font-medium capitalize',
              CATEGORY_BADGE[opp.category] ?? 'bg-gray-100 text-gray-600'
            )}
          >
            {opp.category}
          </span>
          <span
            className={cn(
              'rounded-full px-2 py-0.5 text-xs font-medium capitalize',
              STATUS_BADGE[opp.status] ?? 'bg-gray-100 text-gray-600'
            )}
          >
            {opp.status}
          </span>
        </div>
        {opp.amount_usd != null && (
          <span className="shrink-0 rounded bg-indigo-600 px-2.5 py-0.5 text-xs font-bold text-white">
            {formatAmount(opp.amount_usd)}
          </span>
        )}
      </div>

      {/* Title + agency */}
      <h3 className="mb-1 text-sm font-semibold text-gray-900 leading-snug">{opp.title}</h3>
      <p className="mb-2 text-xs text-gray-400 uppercase tracking-wide">{opp.agency}</p>

      {/* Description snippet */}
      <p className="mb-3 text-sm text-gray-600 line-clamp-3">{opp.description}</p>

      {/* Tags */}
      {opp.tags && opp.tags.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1">
          {opp.tags.slice(0, 5).map((tag) => (
            <span
              key={tag}
              className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Deadline */}
      {dl && (
        <p className={cn('mb-3 text-xs', dl.cls)}>
          Deadline: {dl.text}
        </p>
      )}

      {/* Action buttons */}
      <div className="mt-auto flex flex-wrap gap-2 pt-2 border-t border-gray-100">
        <button
          onClick={() => onAskJamal(opp)}
          className="rounded bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 transition-colors"
        >
          Ask JamalAI
        </button>
        <button
          onClick={() => onAddToCrm(opp)}
          disabled={saving === opp.id}
          className="rounded border border-indigo-300 px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-50 transition-colors disabled:opacity-50"
        >
          {saving === opp.id ? 'Adding…' : 'Add to CRM'}
        </button>
        <button
          onClick={() => onAddToGrants(opp)}
          disabled={grantSaving === opp.id}
          className="rounded border border-green-300 px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-50 transition-colors disabled:opacity-50"
        >
          {grantSaving === opp.id ? 'Adding…' : 'Add to Grant Pipeline'}
        </button>
        {opp.source_url && (
          <a
            href={opp.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Apply / Learn More
          </a>
        )}
        <button
          onClick={() => onGenerateStory(opp)}
          className="rounded border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-500 hover:bg-gray-50 transition-colors"
        >
          Generate Story
        </button>
      </div>
    </div>
  )
}

// Lyrics template used when generating a FreksFrame story from a VA opportunity.
const storyLyricsTemplate = (opp) =>
  `In the shadows of a broken system\n` +
  `${opp.agency} opens the door\n` +
  `${opp.title} — a chance to rise\n` +
  `For those who served, they'll serve no more in silence\n` +
  `Take the grant, take the step, take the call\n` +
  `Together we stand, we answer for all`

// ── Main page ─────────────────────────────────────────────────────────────────

export default function VaOpportunitiesPage() {
  const { session } = useAuth()
  const navigate = useNavigate()

  const [category, setCategory] = useState('')
  const [status, setStatus]     = useState('open')
  const [keyword, setKeyword]   = useState('')
  const [search, setSearch]     = useState('')  // committed search term

  const { opportunities, loading, error } = useVaOpportunities({ category, status, keyword: search })

  // JamalAI panel state
  const [aiOpp, setAiOpp]       = useState(null)   // opportunity selected for AI help
  const [aiTask, setAiTask]     = useState('')      // pre-filled prompt
  const [aiData, setAiData]     = useState(null)    // data context sent with the prompt

  // CRM deal creation state
  const [saving, setSaving]         = useState(null)    // opportunity id being saved
  const [grantSaving, setGrantSaving] = useState(null)  // opportunity id being added to grants
  const [crmToast, setCrmToast]     = useState(null)    // success/error message

  // ── handlers ──────────────────────────────────────────────────────────────

  function handleAskJamal(opp) {
    setAiOpp(opp)
    setAiTask(
      `Explain this VA opportunity, who qualifies, and what the next steps are:\n\n` +
      `Title: ${opp.title}\nCategory: ${opp.category}\nAmount: ${formatAmount(opp.amount_usd) ?? 'Not specified'}\n` +
      `Description: ${opp.description}`
    )
    setAiData({ opportunity: opp })
    // Scroll to AI panel
    setTimeout(() => {
      document.getElementById('va-ai-panel')?.scrollIntoView({ behavior: 'smooth' })
    }, 50)
  }

  async function handleAddToCrm(opp) {
    if (!session?.user?.id) return
    setSaving(opp.id)
    setCrmToast(null)
    try {
      const { error: dealErr } = await supabase
        .from('deals')
        .insert({
          title:      `VA: ${opp.title}`,
          value:      opp.amount_usd ?? 0,
          stage:      'prospecting',
          owner_id:   session.user.id,
          contact_id: null,
          notes:      JSON.stringify({ va_opportunity_id: opp.id, category: opp.category, source_url: opp.source_url ?? null }),
        })
      if (dealErr) throw dealErr
      setCrmToast({ type: 'success', msg: `Deal "${opp.title}" added to CRM pipeline.` })
    } catch (err) {
      setCrmToast({ type: 'error', msg: err?.message ?? 'Failed to create deal.' })
    } finally {
      setSaving(null)
      setTimeout(() => setCrmToast(null), 5000)
    }
  }

  async function handleGenerateStory(opp) {
    if (!session?.user?.id) return
    try {
      const lyrics = storyLyricsTemplate(opp)
      const { data: project, error: projErr } = await supabase
        .from('freks_projects')
        .insert({
          user_id: session.user.id,
          title:   `VA Story: ${opp.title}`,
          lyrics,
          style:   'cinematic',
          status:  'draft',
        })
        .select()
        .single()
      if (projErr) throw projErr
      navigate('/freksframe')
    } catch (err) {
      setCrmToast({ type: 'error', msg: `Could not create FreksFrame story: ${err?.message ?? 'Unknown error'}` })
      setTimeout(() => setCrmToast(null), 5000)
    }
  }

  // aiPanelResetKey forces the JamalAIPanel to remount when a new opportunity is selected,
  // clearing any previous reply so the user starts fresh for each card.
  const aiPanelResetKey = aiOpp ? aiOpp.id : 'default'

  // ── render ─────────────────────────────────────────────────────────────────

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">VA Opportunity Feed</h1>
          <p className="mt-1 text-sm text-gray-500">
            Grants, contracts, and programs from the Department of Veterans Affairs
          </p>
        </div>
      </div>

      {/* Toast */}
      {crmToast && (
        <div
          className={cn(
            'mb-4 rounded-md px-4 py-3 text-sm',
            crmToast.type === 'success'
              ? 'border border-green-200 bg-green-50 text-green-800'
              : 'border border-red-200 bg-red-50 text-red-700'
          )}
        >
          {crmToast.msg}
        </div>
      )}

      {/* Filters */}
      <div className="mb-6 flex flex-wrap gap-3">
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          {CATEGORY_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        <div className="flex gap-2">
          <input
            type="search"
            placeholder="Search opportunities…"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && setSearch(keyword)}
            className="w-56 rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button
            onClick={() => setSearch(keyword)}
            className="rounded bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Search
          </button>
          {(category || status !== 'open' || search) && (
            <button
              onClick={() => { setCategory(''); setStatus('open'); setKeyword(''); setSearch('') }}
              className="rounded border border-gray-200 px-3 py-2 text-sm text-gray-500 hover:bg-gray-50"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Feed */}
      {error && (
        <p className="mb-4 text-sm text-red-600">{error}</p>
      )}

      {loading ? (
        <p className="text-sm text-gray-500">Loading opportunities…</p>
      ) : opportunities.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 py-16 text-center">
          <p className="text-sm text-gray-500">No opportunities found.</p>
          <p className="mt-1 text-xs text-gray-400">Try changing your filters or check back for new announcements.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {opportunities.map((opp) => (
            <OpportunityCard
              key={opp.id}
              opp={opp}
              onAskJamal={handleAskJamal}
              onAddToCrm={handleAddToCrm}
              onGenerateStory={handleGenerateStory}
              saving={saving}
            />
          ))}
        </div>
      )}

      {/* JamalAI Assistant */}
      <div id="va-ai-panel" className="mt-10">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
          JamalAI — VA Grants Assistant
        </h2>
        <JamalAIPanel
          key={aiPanelResetKey}
          module="grants"
          placeholder={
            aiOpp
              ? `Ask about "${aiOpp.title}"…`
              : 'e.g. "Who qualifies for the suicide prevention grant?", "How do I apply?"'
          }
        />
      </div>
    </div>
  )
}
