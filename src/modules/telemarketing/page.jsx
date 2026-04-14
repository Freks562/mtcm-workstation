import { useState } from 'react'
import { useCampaigns } from './hooks/useCampaigns.js'
import { useCallQueue } from './hooks/useCallQueue.js'
import { useCallLogs } from './hooks/useCallLogs.js'
import { useLeaderboard } from './hooks/useLeaderboard.js'
import { CampaignForm } from './components/CampaignForm.jsx'
import { CallLogForm } from './components/CallLogForm.jsx'
import { Modal } from '../../shared/components/ui/Modal.jsx'
import { useAuth } from '../../auth/AuthProvider.jsx'
import { cn } from '../../shared/utils/cn.js'
import { supabase } from '../../lib/supabase.js'
import { logEvent } from '../../lib/logEvent.js'

const STATUS_OPTIONS = ['all', 'queued', 'called', 'callback', 'do_not_call', 'converted']

const STATUS_BADGE = {
  queued: 'bg-gray-100 text-gray-600',
  called: 'bg-blue-100 text-blue-700',
  callback: 'bg-yellow-100 text-yellow-700',
  do_not_call: 'bg-red-100 text-red-600',
  converted: 'bg-green-100 text-green-700',
}

const OUTCOME_BADGE = {
  no_answer: 'bg-gray-100 text-gray-600',
  answered: 'bg-blue-100 text-blue-700',
  callback: 'bg-yellow-100 text-yellow-700',
  voicemail: 'bg-purple-100 text-purple-700',
  do_not_call: 'bg-red-100 text-red-600',
  converted: 'bg-green-100 text-green-700',
}

const CAMPAIGN_STATUS_BADGE = {
  draft: 'bg-gray-100 text-gray-600',
  active: 'bg-green-100 text-green-700',
  paused: 'bg-yellow-100 text-yellow-700',
  completed: 'bg-blue-100 text-blue-700',
}

export default function TelemarketingPage() {
  const { session } = useAuth()
  const agentId = session?.user?.id ?? null

  const [tab, setTab] = useState('queue')
  const [selectedCampaignId, setSelectedCampaignId] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [campaignModal, setCampaignModal] = useState(null) // null | 'new' | campaign obj
  const [callModal, setCallModal] = useState(null)         // null | campaign_contact row
  const [saving, setSaving] = useState(false)

  const { campaigns, loading: campaignsLoading, createCampaign, updateCampaign } = useCampaigns()
  const { queue, loading: queueLoading, error: queueError, load: reloadQueue, updateQueueStatus } =
    useCallQueue(selectedCampaignId, statusFilter)
  const { callLogs, loading: logsLoading } = useCallLogs(selectedCampaignId || null)
  const { leaderboard, loading: boardLoading } = useLeaderboard()

  async function handleCampaignSubmit(fields) {
    setSaving(true)
    try {
      if (campaignModal === 'new') {
        await createCampaign({ ...fields, owner_id: agentId }, agentId)
      } else {
        await updateCampaign(campaignModal.id, fields, agentId)
      }
      setCampaignModal(null)
    } finally {
      setSaving(false)
    }
  }

  async function handleCallLog(fields) {
    setSaving(true)
    try {
      const row = {
        contact_id: callModal.contact_id,
        agent_id: agentId,
        campaign_id: selectedCampaignId || null,
        ...fields,
      }

      const { data, error } = await supabase
        .from('call_logs')
        .insert(row)
        .select()
        .single()
      if (error) throw new Error(error.message)

      await logEvent({
        type: 'call_logged',
        actorId: agentId,
        entityType: 'call_log',
        entityId: data.id,
        metadata: { outcome: data.outcome, contact_id: data.contact_id },
      })

      // Update queue item status to match outcome
      const queueStatus =
        fields.outcome === 'callback' ? 'callback'
        : fields.outcome === 'do_not_call' ? 'do_not_call'
        : fields.outcome === 'converted' ? 'converted'
        : 'called'
      await updateQueueStatus(callModal.id, queueStatus)

      setCallModal(null)
      await reloadQueue()
    } finally {
      setSaving(false)
    }
  }

  const TABS = ['queue', 'campaigns', 'leaderboard']

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Telemarketing</h1>
        {tab === 'campaigns' && (
          <button
            onClick={() => setCampaignModal('new')}
            className="rounded bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
          >
            + New Campaign
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="mb-4 flex gap-4 border-b border-gray-200">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'pb-2 text-sm font-medium capitalize transition-colors',
              tab === t
                ? 'border-b-2 border-indigo-600 text-indigo-600'
                : 'text-gray-500 hover:text-gray-700'
            )}
          >
            {t === 'queue' ? 'Call Queue' : t === 'leaderboard' ? 'Leaderboard' : 'Campaigns'}
          </button>
        ))}
      </div>

      {/* ── QUEUE TAB ── */}
      {tab === 'queue' && (
        <div>
          {/* Filters */}
          <div className="mb-4 flex flex-wrap gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">Campaign</label>
              <select
                value={selectedCampaignId}
                onChange={(e) => setSelectedCampaignId(e.target.value)}
                className="rounded border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">— Select campaign —</option>
                {campaigns.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="rounded border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>{s === 'all' ? 'All' : s.replace(/_/g, ' ')}</option>
                ))}
              </select>
            </div>
          </div>

          {!selectedCampaignId && (
            <p className="text-sm text-gray-500">Select a campaign to see the call queue.</p>
          )}

          {selectedCampaignId && queueError && (
            <p className="text-sm text-red-600">{queueError}</p>
          )}

          {selectedCampaignId && queueLoading && (
            <p className="text-sm text-gray-500">Loading…</p>
          )}

          {selectedCampaignId && !queueLoading && queue.length === 0 && (
            <p className="text-sm text-gray-500">No contacts in queue for this filter.</p>
          )}

          {selectedCampaignId && !queueLoading && queue.length > 0 && (
            <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-xs font-medium uppercase text-gray-500">
                  <tr>
                    <th className="px-4 py-3 text-left">Contact</th>
                    <th className="px-4 py-3 text-left">Phone</th>
                    <th className="px-4 py-3 text-left">Company</th>
                    <th className="px-4 py-3 text-left">Status</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {queue.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {item.contacts?.first_name} {item.contacts?.last_name}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{item.contacts?.phone || '—'}</td>
                      <td className="px-4 py-3 text-gray-600">{item.contacts?.company || '—'}</td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            'rounded-full px-2 py-0.5 text-xs font-medium',
                            STATUS_BADGE[item.status] ?? 'bg-gray-100 text-gray-600'
                          )}
                        >
                          {item.status.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => setCallModal(item)}
                          disabled={item.status === 'do_not_call'}
                          className="rounded bg-indigo-600 px-2 py-1 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-40"
                        >
                          Log Call
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Recent call logs for selected campaign */}
          {selectedCampaignId && !logsLoading && callLogs.length > 0 && (
            <div className="mt-8">
              <h3 className="mb-3 text-sm font-semibold text-gray-700">Recent Call Logs</h3>
              <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 text-xs font-medium uppercase text-gray-500">
                    <tr>
                      <th className="px-4 py-3 text-left">Contact</th>
                      <th className="px-4 py-3 text-left">Agent</th>
                      <th className="px-4 py-3 text-left">Outcome</th>
                      <th className="px-4 py-3 text-left">Duration</th>
                      <th className="px-4 py-3 text-left">Called At</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {callLogs.slice(0, 20).map((log) => (
                      <tr key={log.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-gray-900">
                          {log.contacts ? `${log.contacts.first_name} ${log.contacts.last_name}` : '—'}
                        </td>
                        <td className="px-4 py-3 text-gray-600">
                          {log.profiles?.full_name ?? '—'}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={cn(
                              'rounded-full px-2 py-0.5 text-xs font-medium',
                              OUTCOME_BADGE[log.outcome] ?? 'bg-gray-100 text-gray-600'
                            )}
                          >
                            {log.outcome.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-600">{log.duration_seconds}s</td>
                        <td className="px-4 py-3 text-gray-600">
                          {new Date(log.called_at).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── CAMPAIGNS TAB ── */}
      {tab === 'campaigns' && (
        <div>
          {campaignsLoading ? (
            <p className="text-sm text-gray-500">Loading…</p>
          ) : campaigns.length === 0 ? (
            <p className="text-sm text-gray-500">No campaigns yet.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-xs font-medium uppercase text-gray-500">
                  <tr>
                    <th className="px-4 py-3 text-left">Name</th>
                    <th className="px-4 py-3 text-left">Type</th>
                    <th className="px-4 py-3 text-left">Status</th>
                    <th className="px-4 py-3 text-left">Created</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {campaigns.map((c) => (
                    <tr key={c.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">{c.name}</td>
                      <td className="px-4 py-3 text-gray-600 capitalize">{c.type}</td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            'rounded-full px-2 py-0.5 text-xs font-medium',
                            CAMPAIGN_STATUS_BADGE[c.status] ?? 'bg-gray-100 text-gray-600'
                          )}
                        >
                          {c.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {new Date(c.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => setCampaignModal(c)}
                          className="text-indigo-600 hover:underline"
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── LEADERBOARD TAB ── */}
      {tab === 'leaderboard' && (
        <div>
          <p className="mb-3 text-sm text-gray-500">Calls logged today (UTC day).</p>
          {boardLoading ? (
            <p className="text-sm text-gray-500">Loading…</p>
          ) : leaderboard.length === 0 ? (
            <p className="text-sm text-gray-500">No calls logged today yet.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-xs font-medium uppercase text-gray-500">
                  <tr>
                    <th className="px-4 py-3 text-left">#</th>
                    <th className="px-4 py-3 text-left">Agent</th>
                    <th className="px-4 py-3 text-right">Calls Today</th>
                    <th className="px-4 py-3 text-right">Converted</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {leaderboard.map((row, i) => (
                    <tr key={row.agent_id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-bold text-gray-400">{i + 1}</td>
                      <td className="px-4 py-3 font-medium text-gray-900">{row.name}</td>
                      <td className="px-4 py-3 text-right text-gray-900">{row.total}</td>
                      <td className="px-4 py-3 text-right text-green-700">{row.converted}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Campaign modal */}
      {campaignModal && (
        <Modal
          title={campaignModal === 'new' ? 'New Campaign' : 'Edit Campaign'}
          onClose={() => setCampaignModal(null)}
        >
          <CampaignForm
            initial={campaignModal === 'new' ? undefined : campaignModal}
            onSubmit={handleCampaignSubmit}
            onCancel={() => setCampaignModal(null)}
            saving={saving}
          />
        </Modal>
      )}

      {/* Call log modal */}
      {callModal && (
        <Modal title="Log Call" onClose={() => setCallModal(null)}>
          <CallLogForm
            contact={callModal.contacts}
            onSubmit={handleCallLog}
            onCancel={() => setCallModal(null)}
            saving={saving}
          />
        </Modal>
      )}
    </div>
  )
}
