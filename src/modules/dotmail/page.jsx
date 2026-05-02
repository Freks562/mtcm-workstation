import { useState } from 'react'
import { useEmailTemplates } from './hooks/useEmailTemplates.js'
import { useEmailCampaigns } from './hooks/useEmailCampaigns.js'
import { useEmails } from './hooks/useEmails.js'
import { useContacts } from '../crm/hooks/useContacts.js'
import { TemplateForm } from './components/TemplateForm.jsx'
import { EmailCampaignForm } from './components/EmailCampaignForm.jsx'
import { SendPanel } from './components/SendPanel.jsx'
import { Modal } from '../../shared/components/ui/Modal.jsx'
import { JamalAIPanel } from '../../shared/components/ui/JamalAIPanel.jsx'
import { useAuth } from '../../auth/AuthProvider.jsx'
import { cn } from '../../shared/utils/cn.js'

const STATUS_BADGE = {
  draft: 'bg-gray-100 text-gray-600',
  active: 'bg-green-100 text-green-700',
  paused: 'bg-yellow-100 text-yellow-700',
  completed: 'bg-blue-100 text-blue-700',
}

const EMAIL_STATUS_BADGE = {
  queued: 'bg-gray-100 text-gray-600',
  sending: 'bg-yellow-100 text-yellow-700',
  sent: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-600',
  bounced: 'bg-red-100 text-red-600',
  opened: 'bg-blue-100 text-blue-700',
  clicked: 'bg-indigo-100 text-indigo-700',
}

const GMAIL_OAUTH_START_URL =
  'https://qvtujdcnzmmdcyxctggb.supabase.co/functions/v1/gmail-oauth'

export default function DotmailPage() {
  const { session } = useAuth()
  const actorId = session?.user?.id ?? null
  const gmailOAuthStartHref = actorId
    ? `${GMAIL_OAUTH_START_URL}?user_id=${encodeURIComponent(actorId)}`
    : GMAIL_OAUTH_START_URL

  const [tab, setTab] = useState('templates')
  const [templateModal, setTemplateModal] = useState(null)   // null | 'new' | template obj
  const [campaignModal, setCampaignModal] = useState(null)   // null | 'new' | campaign obj
  const [sendModal, setSendModal] = useState(null)           // null | campaign obj
  const [selectedCampaignId, setSelectedCampaignId] = useState('')
  const [saving, setSaving] = useState(false)

  const { templates, loading: tplLoading, createTemplate, updateTemplate, deleteTemplate } =
    useEmailTemplates()
  const { campaigns, loading: campLoading, createEmailCampaign, updateEmailCampaign } =
    useEmailCampaigns()
  const { emails, loading: emailsLoading, load: reloadEmails, queueEmail } =
    useEmails(selectedCampaignId || null)
  const { contacts } = useContacts()

  // ── Template handlers ──────────────────────────────────────────
  async function handleTemplateSubmit(fields) {
    setSaving(true)
    try {
      if (templateModal === 'new') {
        await createTemplate({ ...fields, owner_id: actorId }, actorId)
      } else {
        await updateTemplate(templateModal.id, fields, actorId)
      }
      setTemplateModal(null)
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteTemplate(id) {
    if (!confirm('Delete this template?')) return
    await deleteTemplate(id)
  }

  // ── Campaign handlers ──────────────────────────────────────────
  async function handleCampaignSubmit(fields) {
    setSaving(true)
    try {
      if (campaignModal === 'new') {
        await createEmailCampaign({ ...fields, owner_id: actorId }, actorId)
      } else {
        await updateEmailCampaign(campaignModal.id, fields, actorId)
      }
      setCampaignModal(null)
    } finally {
      setSaving(false)
    }
  }

  // ── Send/queue handler ─────────────────────────────────────────
  async function handleQueue({ selectedContacts, subject, body, templateId }) {
    setSaving(true)
    try {
      for (const contactId of selectedContacts) {
        await queueEmail(
          {
            contact_id: contactId,
            campaign_id: sendModal.id,
            template_id: templateId,
            sender_id: actorId,
            subject,
            body,
          },
          actorId
        )
      }
      setSendModal(null)
      setSelectedCampaignId(sendModal.id)
      await reloadEmails()
    } finally {
      setSaving(false)
    }
  }

  const TABS = ['templates', 'campaigns', 'log']

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">DotMail</h1>
        <div className="flex items-center gap-2">
          <a
            href={gmailOAuthStartHref}
            className="rounded border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Connect Gmail
          </a>
          {tab === 'templates' && (
            <button
              onClick={() => setTemplateModal('new')}
              className="rounded bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
            >
              + New Template
            </button>
          )}
          {tab === 'campaigns' && (
            <button
              onClick={() => setCampaignModal('new')}
              className="rounded bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
            >
              + New Campaign
            </button>
          )}
        </div>
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
            {t === 'log' ? 'Email Log' : t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* ── TEMPLATES TAB ── */}
      {tab === 'templates' && (
        <div>
          {tplLoading ? (
            <p className="text-sm text-gray-500">Loading…</p>
          ) : templates.length === 0 ? (
            <p className="text-sm text-gray-500">No templates yet.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-xs font-medium uppercase text-gray-500">
                  <tr>
                    <th className="px-4 py-3 text-left">Name</th>
                    <th className="px-4 py-3 text-left">Subject</th>
                    <th className="px-4 py-3 text-left">Updated</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {templates.map((tpl) => (
                    <tr key={tpl.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">{tpl.name}</td>
                      <td className="px-4 py-3 text-gray-600">{tpl.subject}</td>
                      <td className="px-4 py-3 text-gray-500">
                        {new Date(tpl.updated_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => setTemplateModal(tpl)}
                          className="mr-3 text-indigo-600 hover:underline"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteTemplate(tpl.id)}
                          className="text-red-500 hover:underline"
                        >
                          Delete
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

      {/* ── CAMPAIGNS TAB ── */}
      {tab === 'campaigns' && (
        <div>
          {campLoading ? (
            <p className="text-sm text-gray-500">Loading…</p>
          ) : campaigns.length === 0 ? (
            <p className="text-sm text-gray-500">No email campaigns yet.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-xs font-medium uppercase text-gray-500">
                  <tr>
                    <th className="px-4 py-3 text-left">Name</th>
                    <th className="px-4 py-3 text-left">Status</th>
                    <th className="px-4 py-3 text-left">Created</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {campaigns.map((c) => (
                    <tr key={c.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">{c.name}</td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            'rounded-full px-2 py-0.5 text-xs font-medium',
                            STATUS_BADGE[c.status] ?? 'bg-gray-100 text-gray-600'
                          )}
                        >
                          {c.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {new Date(c.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-right flex justify-end gap-3">
                        <button
                          onClick={() => {
                            setSelectedCampaignId(c.id)
                            setTab('log')
                          }}
                          className="text-gray-500 hover:underline"
                        >
                          View Log
                        </button>
                        <button
                          onClick={() => setSendModal(c)}
                          className="text-green-600 hover:underline"
                        >
                          Send
                        </button>
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

      {/* ── EMAIL LOG TAB ── */}
      {tab === 'log' && (
        <div>
          <div className="mb-4 flex items-center gap-3">
            <label className="text-xs font-medium text-gray-500">Filter by Campaign</label>
            <select
              value={selectedCampaignId}
              onChange={(e) => setSelectedCampaignId(e.target.value)}
              className="rounded border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">All campaigns</option>
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {emailsLoading ? (
            <p className="text-sm text-gray-500">Loading…</p>
          ) : emails.length === 0 ? (
            <p className="text-sm text-gray-500">No emails found.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-xs font-medium uppercase text-gray-500">
                  <tr>
                    <th className="px-4 py-3 text-left">To</th>
                    <th className="px-4 py-3 text-left">Subject</th>
                    <th className="px-4 py-3 text-left">Status</th>
                    <th className="px-4 py-3 text-left">Sent By</th>
                    <th className="px-4 py-3 text-left">Queued At</th>
                    <th className="px-4 py-3 text-left">Provider ID / Error</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {emails.map((em) => (
                    <tr key={em.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-900">
                        {em.contacts
                          ? `${em.contacts.first_name} ${em.contacts.last_name}`
                          : em.contacts?.email ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-700">{em.subject}</td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            'rounded-full px-2 py-0.5 text-xs font-medium',
                            EMAIL_STATUS_BADGE[em.status] ?? 'bg-gray-100 text-gray-600'
                          )}
                        >
                          {em.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {em.profiles?.full_name ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-500">
                        {new Date(em.created_at).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {em.provider_id ? (
                          <span className="font-mono text-gray-500">{em.provider_id}</span>
                        ) : em.failure_reason ? (
                          <span className="text-red-500">{em.failure_reason}</span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Template modal */}
      {templateModal && (
        <Modal
          title={templateModal === 'new' ? 'New Template' : 'Edit Template'}
          onClose={() => setTemplateModal(null)}
        >
          <TemplateForm
            initial={templateModal === 'new' ? undefined : templateModal}
            onSubmit={handleTemplateSubmit}
            onCancel={() => setTemplateModal(null)}
            saving={saving}
          />
        </Modal>
      )}

      {/* Campaign modal */}
      {campaignModal && (
        <Modal
          title={campaignModal === 'new' ? 'New Email Campaign' : 'Edit Email Campaign'}
          onClose={() => setCampaignModal(null)}
        >
          <EmailCampaignForm
            initial={campaignModal === 'new' ? undefined : campaignModal}
            templates={templates}
            onSubmit={handleCampaignSubmit}
            onCancel={() => setCampaignModal(null)}
            saving={saving}
          />
        </Modal>
      )}

      {/* Send / queue modal */}
      {sendModal && (
        <Modal title={`Send — ${sendModal.name}`} onClose={() => setSendModal(null)}>
          <SendPanel
            campaign={sendModal}
            contacts={contacts}
            templates={templates}
            onQueue={handleQueue}
            onClose={() => setSendModal(null)}
            saving={saving}
          />
        </Modal>
      )}

      {/* JamalAI Dotmail Assistant */}
      <h2 className="mb-3 mt-8 text-xs font-semibold uppercase tracking-wide text-gray-400">JamalAI Assistant</h2>
      <JamalAIPanel module="dotmail" />
    </div>
  )
}
