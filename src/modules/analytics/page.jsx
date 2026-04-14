import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../../lib/supabase.js'

// ─── helpers ───────────────────────────────────────────────────────────────

function startOfDayUTC(daysAgo = 0) {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - daysAgo)
  d.setUTCHours(0, 0, 0, 0)
  return d
}

function isoDate(date) {
  return date.toISOString().slice(0, 10)
}

/** Build an ordered list of { date: 'YYYY-MM-DD' } for the last N days */
function buildDays(n) {
  const days = []
  for (let i = n - 1; i >= 0; i--) {
    days.push(isoDate(startOfDayUTC(i)))
  }
  return days
}

// ─── sub-components ────────────────────────────────────────────────────────

function StatCard({ label, value, sub, loading }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-400">{label}</p>
      <p className="mt-2 text-3xl font-bold text-gray-900">
        {loading ? '…' : value ?? '—'}
      </p>
      {sub && !loading && (
        <p className="mt-1 text-xs text-gray-400">{sub}</p>
      )}
    </div>
  )
}

/**
 * Minimal inline SVG bar chart — no external dep.
 * data: Array<{ label: string; value: number }>
 */
function BarChart({ data, color = '#6366f1', height = 120 }) {
  if (!data || data.length === 0) {
    return <p className="text-xs text-gray-400 py-6 text-center">No data for this range.</p>
  }
  const max = Math.max(...data.map((d) => d.value), 1)
  const W = 600
  const padY = 8
  const barAreaH = height - padY * 2
  const barW = Math.max(4, Math.floor((W / data.length) * 0.7))
  const gap = W / data.length

  return (
    <svg
      viewBox={`0 0 ${W} ${height + 20}`}
      className="w-full"
      aria-label="bar chart"
    >
      {data.map((d, i) => {
        const barH = Math.max(2, (d.value / max) * barAreaH)
        const x = i * gap + (gap - barW) / 2
        const y = padY + barAreaH - barH
        return (
          <g key={d.label}>
            <rect x={x} y={y} width={barW} height={barH} fill={color} rx="2" opacity="0.85" />
            {data.length <= 14 && (
              <text
                x={x + barW / 2}
                y={height + 16}
                textAnchor="middle"
                fontSize="9"
                fill="#9ca3af"
              >
                {d.label.slice(5)} {/* MM-DD */}
              </text>
            )}
          </g>
        )
      })}
    </svg>
  )
}

const RANGE_OPTIONS = [
  { label: 'Today', value: 'today' },
  { label: 'Last 7 days', value: '7d' },
  { label: 'Last 30 days', value: '30d' },
  { label: 'All time', value: 'all' },
]

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
  contact_created: 'Contact created',
  deal_created: 'Deal created',
  deal_updated: 'Deal updated',
}

// ─── main page ─────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const [range, setRange] = useState('7d')
  const [kpi, setKpi] = useState(null)
  const [callsChart, setCallsChart] = useState([])
  const [emailsChart, setEmailsChart] = useState([])
  const [recentEvents, setRecentEvents] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)

    // Determine window start based on range
    let windowStart = null
    let chartDays = 7
    if (range === 'today') {
      windowStart = startOfDayUTC(0)
      chartDays = 1
    } else if (range === '7d') {
      windowStart = startOfDayUTC(6)
      chartDays = 7
    } else if (range === '30d') {
      windowStart = startOfDayUTC(29)
      chartDays = 30
    }
    // 'all' => windowStart = null, no chart breakdown

    // ── KPI queries ────────────────────────────────────────────────────────
    const contactsQ = supabase.from('contacts').select('id', { count: 'exact', head: true })
    const dealsQ = supabase.from('deals').select('value, stage')
    const callsQ = supabase
      .from('call_logs')
      .select('id', { count: 'exact', head: true })
      .gte('called_at', windowStart ? windowStart.toISOString() : '1970-01-01')
    const activeTeleCampsQ = supabase
      .from('campaigns')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'active')
      .eq('type', 'telemarketing')
    const emailsSentQ = supabase
      .from('emails')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'sent')
      .gte('sent_at', windowStart ? windowStart.toISOString() : '1970-01-01')
    const activeEmailCampsQ = supabase
      .from('campaigns')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'active')
      .eq('type', 'email')

    // ── Chart data queries ─────────────────────────────────────────────────
    // Fetch raw rows then bucket in JS to avoid needing pg views
    const callsRawQ =
      windowStart
        ? supabase
            .from('call_logs')
            .select('called_at')
            .gte('called_at', windowStart.toISOString())
        : supabase.from('call_logs').select('called_at')

    const emailsRawQ =
      windowStart
        ? supabase
            .from('emails')
            .select('sent_at')
            .eq('status', 'sent')
            .gte('sent_at', windowStart.toISOString())
        : supabase.from('emails').select('sent_at').eq('status', 'sent')

    const eventsQ = supabase
      .from('events')
      .select('type, occurred_at, metadata')
      .order('occurred_at', { ascending: false })
      .limit(15)

    const [
      contactsRes,
      dealsRes,
      callsRes,
      activeTeleCampsRes,
      emailsSentRes,
      activeEmailCampsRes,
      callsRawRes,
      emailsRawRes,
      eventsRes,
    ] = await Promise.all([
      contactsQ, dealsQ, callsQ, activeTeleCampsQ,
      emailsSentQ, activeEmailCampsQ, callsRawQ, emailsRawQ, eventsQ,
    ])

    // ── Process KPIs ───────────────────────────────────────────────────────
    const deals = dealsRes.data ?? []
    const openPipeline = deals
      .filter((d) => !['closed_won', 'closed_lost'].includes(d.stage))
      .reduce((s, d) => s + Number(d.value), 0)
    const revenue = deals
      .filter((d) => d.stage === 'closed_won')
      .reduce((s, d) => s + Number(d.value), 0)

    setKpi({
      contacts: contactsRes.count ?? 0,
      deals: deals.length,
      openPipeline,
      revenue,
      calls: callsRes.count ?? 0,
      activeTeleCamps: activeTeleCampsRes.count ?? 0,
      emailsSent: emailsSentRes.count ?? 0,
      activeEmailCamps: activeEmailCampsRes.count ?? 0,
    })

    // ── Build chart series ─────────────────────────────────────────────────
    if (range !== 'all') {
      const days = buildDays(chartDays)
      const callsMap = {}
      const emailsMap = {}
      days.forEach((d) => { callsMap[d] = 0; emailsMap[d] = 0 })

      ;(callsRawRes.data ?? []).forEach((r) => {
        const d = isoDate(new Date(r.called_at))
        if (d in callsMap) callsMap[d]++
      })
      ;(emailsRawRes.data ?? []).forEach((r) => {
        if (!r.sent_at) return
        const d = isoDate(new Date(r.sent_at))
        if (d in emailsMap) emailsMap[d]++
      })

      setCallsChart(days.map((d) => ({ label: d, value: callsMap[d] })))
      setEmailsChart(days.map((d) => ({ label: d, value: emailsMap[d] })))
    } else {
      setCallsChart([])
      setEmailsChart([])
    }

    setRecentEvents(eventsRes.data ?? [])
    setLoading(false)
  }, [range])

  useEffect(() => { load() }, [load])

  const fmtCurrency = (n) => `$${Number(n).toLocaleString('en-US', { minimumFractionDigits: 0 })}`
  const rangeSuffix = range === 'today' ? 'today' : range === '7d' ? 'last 7d' : range === '30d' ? 'last 30d' : 'all time'

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Analytics</h1>
        <div className="flex gap-1 rounded-lg border border-gray-200 bg-white p-1">
          {RANGE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setRange(opt.value)}
              className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
                range === opt.value
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-500 hover:bg-gray-100'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* CRM KPIs */}
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">CRM</h2>
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Contacts" value={kpi?.contacts} loading={loading} />
        <StatCard label="Total Deals" value={kpi?.deals} loading={loading} />
        <StatCard label="Open Pipeline" value={kpi ? fmtCurrency(kpi.openPipeline) : null} loading={loading} />
        <StatCard label="Closed Revenue" value={kpi ? fmtCurrency(kpi.revenue) : null} loading={loading} />
      </div>

      {/* Telemarketing KPIs */}
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">Telemarketing</h2>
      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StatCard label={`Calls (${rangeSuffix})`} value={kpi?.calls} loading={loading} />
        <StatCard label="Active Telemarketing Campaigns" value={kpi?.activeTeleCamps} loading={loading} />
      </div>

      {/* Calls chart */}
      {range !== 'all' && (
        <div className="mb-6 rounded-lg border border-gray-200 bg-white p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">Calls per day</p>
          {loading ? (
            <p className="text-xs text-gray-400 py-6 text-center">Loading…</p>
          ) : (
            <BarChart data={callsChart} color="#6366f1" />
          )}
        </div>
      )}

      {/* DotMail KPIs */}
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">DotMail</h2>
      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StatCard label={`Emails Sent (${rangeSuffix})`} value={kpi?.emailsSent} loading={loading} />
        <StatCard label="Active Email Campaigns" value={kpi?.activeEmailCamps} loading={loading} />
      </div>

      {/* Emails chart */}
      {range !== 'all' && (
        <div className="mb-6 rounded-lg border border-gray-200 bg-white p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">Emails sent per day</p>
          {loading ? (
            <p className="text-xs text-gray-400 py-6 text-center">Loading…</p>
          ) : (
            <BarChart data={emailsChart} color="#10b981" />
          )}
        </div>
      )}

      {/* Recent activity */}
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">Recent Activity</h2>
      {loading ? (
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
                  <span className="ml-1 font-medium text-gray-900">— {ev.metadata.name}</span>
                )}
                {ev.metadata?.subject && (
                  <span className="ml-1 font-medium text-gray-900">— {ev.metadata.subject}</span>
                )}
              </span>
              <span className="text-xs text-gray-400">
                {new Date(ev.occurred_at).toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

