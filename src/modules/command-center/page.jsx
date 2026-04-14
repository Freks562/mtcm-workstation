import { useEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase.js'
import { useAuth } from '../../auth/AuthProvider.jsx'

function StatCard({ label, value, loading }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6">
      <p className="text-sm font-medium text-gray-500">{label}</p>
      <p className="mt-2 text-3xl font-bold text-gray-900">
        {loading ? '…' : value}
      </p>
    </div>
  )
}

const EVENT_LABELS = {
  call_logged: 'Call logged',
  campaign_created: 'Campaign created',
  campaign_updated: 'Campaign updated',
  template_created: 'Email template created',
  template_updated: 'Email template updated',
  email_campaign_created: 'Email campaign created',
  email_campaign_updated: 'Email campaign updated',
  email_send_queued: 'Email queued',
  email_sent: 'Email sent',
  email_failed: 'Email failed',
}

function JamalAIBrainPanel() {
  const [prompt, setPrompt] = useState('')
  const [reply, setReply] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const replyRef = useRef(null)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!prompt.trim() || loading) return
    setLoading(true)
    setError(null)
    setReply(null)
    try {
      const { data, error: fnError } = await supabase.functions.invoke('jamalaibrain', {
        body: { prompt: prompt.trim() },
      })
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
        <h3 className="text-sm font-semibold text-gray-900">JamalAIBrain</h3>
        <span className="ml-auto rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700">
          Beta
        </span>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <textarea
          rows={3}
          className="w-full resize-none rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
          placeholder='Ask anything… e.g. "Summarize open deals", "Draft a follow-up email", "Show inactive campaigns"'
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          disabled={loading}
        />
        <button
          type="submit"
          disabled={!prompt.trim() || loading}
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
            'Ask JamalAIBrain'
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

export default function CommandCenterPage() {
  const { profile, session } = useAuth()
  const [stats, setStats] = useState({
    contactCount: null,
    dealCount: null,
    openDealValue: null,
    callsToday: null,
    activeCampaigns: null,
    emailsToday: null,
    activeEmailCampaigns: null,
  })
  const [recentEvents, setRecentEvents] = useState([])
  const [statsLoading, setStatsLoading] = useState(true)

  useEffect(() => {
    async function loadStats() {
      const todayStart = new Date()
      todayStart.setUTCHours(0, 0, 0, 0)

      const [contactsRes, dealsRes, callsTodayRes, activeCampaignsRes, emailsTodayRes, activeEmailCampRes, eventsRes] =
        await Promise.all([
          supabase.from('contacts').select('id', { count: 'exact', head: true }),
          supabase.from('deals').select('value, stage'),
          supabase
            .from('call_logs')
            .select('id', { count: 'exact', head: true })
            .gte('called_at', todayStart.toISOString()),
          supabase
            .from('campaigns')
            .select('id', { count: 'exact', head: true })
            .eq('status', 'active')
            .eq('type', 'telemarketing'),
          supabase
            .from('emails')
            .select('id', { count: 'exact', head: true })
            .eq('status', 'sent')
            .gte('sent_at', todayStart.toISOString()),
          supabase
            .from('campaigns')
            .select('id', { count: 'exact', head: true })
            .eq('status', 'active')
            .eq('type', 'email'),
          supabase
            .from('events')
            .select('type, occurred_at, metadata')
            .order('occurred_at', { ascending: false })
            .limit(10),
        ])

      const deals = dealsRes.data ?? []
      const openValue = deals
        .filter((d) => !['closed_won', 'closed_lost'].includes(d.stage))
        .reduce((sum, d) => sum + Number(d.value), 0)

      setStats({
        contactCount: contactsRes.count ?? 0,
        dealCount: deals.length,
        openDealValue: openValue,
        callsToday: callsTodayRes.count ?? 0,
        activeCampaigns: activeCampaignsRes.count ?? 0,
        emailsToday: emailsTodayRes.count ?? 0,
        activeEmailCampaigns: activeEmailCampRes.count ?? 0,
      })
      setRecentEvents(eventsRes.data ?? [])
      setStatsLoading(false)
    }
    loadStats()
  }, [])

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Command Center</h1>
        {session?.user && (
          <p className="mt-1 text-sm text-gray-500">
            Welcome back,{' '}
            <span className="font-medium text-gray-700">
              {profile?.full_name || session.user.email}
            </span>
            {profile?.role && (
              <span className="ml-2 rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700">
                {profile.role}
              </span>
            )}
          </p>
        )}
      </div>

      {/* CRM stats */}
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">CRM</h2>
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Total Contacts" value={stats.contactCount} loading={statsLoading} />
        <StatCard label="Total Deals" value={stats.dealCount} loading={statsLoading} />
        <StatCard
          label="Open Pipeline Value"
          value={stats.openDealValue !== null ? `$${stats.openDealValue.toLocaleString()}` : 0}
          loading={statsLoading}
        />
      </div>

      {/* Telemarketing stats */}
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">Telemarketing</h2>
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StatCard label="Calls Today" value={stats.callsToday} loading={statsLoading} />
        <StatCard label="Active Telemarketing Campaigns" value={stats.activeCampaigns} loading={statsLoading} />
      </div>

      {/* DotMail stats */}
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">DotMail</h2>
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StatCard label="Emails Sent Today" value={stats.emailsToday} loading={statsLoading} />
        <StatCard label="Active Email Campaigns" value={stats.activeEmailCampaigns} loading={statsLoading} />
      </div>

      {/* Recent events */}
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">Recent Activity</h2>
      {statsLoading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : recentEvents.length === 0 ? (
        <p className="text-sm text-gray-500">No recent activity.</p>
      ) : (
        <div className="rounded-lg border border-gray-200 bg-white divide-y divide-gray-100">
          {recentEvents.map((ev, i) => (
            <div key={i} className="flex items-center justify-between px-4 py-3">
              <span className="text-sm text-gray-700">
                {EVENT_LABELS[ev.type] ?? ev.type}
                {ev.metadata?.name && (
                  <span className="ml-1 font-medium">— {ev.metadata.name}</span>
                )}
              </span>
              <span className="text-xs text-gray-400">
                {new Date(ev.occurred_at).toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* JamalAIBrain */}
      <h2 className="mb-3 mt-6 text-xs font-semibold uppercase tracking-wide text-gray-400">JamalAIBrain</h2>
      <JamalAIBrainPanel />
    </div>
  )
}
