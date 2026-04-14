import { useEffect, useState } from 'react'
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
}

export default function CommandCenterPage() {
  const { profile, session } = useAuth()
  const [stats, setStats] = useState({
    contactCount: null,
    dealCount: null,
    openDealValue: null,
    callsToday: null,
    activeCampaigns: null,
  })
  const [recentEvents, setRecentEvents] = useState([])
  const [statsLoading, setStatsLoading] = useState(true)

  useEffect(() => {
    async function loadStats() {
      const todayStart = new Date()
      todayStart.setUTCHours(0, 0, 0, 0)

      const [contactsRes, dealsRes, callsTodayRes, activeCampaignsRes, eventsRes] =
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
            .eq('status', 'active'),
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
        <StatCard label="Active Campaigns" value={stats.activeCampaigns} loading={statsLoading} />
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
    </div>
  )
}
