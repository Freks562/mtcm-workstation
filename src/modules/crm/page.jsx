import { useState } from 'react'
import { useContacts } from './hooks/useContacts.js'
import { useDeals } from './hooks/useDeals.js'
import { ContactForm } from './components/ContactForm.jsx'
import { DealForm } from './components/DealForm.jsx'
import { Modal } from '../../shared/components/ui/Modal.jsx'
import { JamalAIPanel } from '../../shared/components/ui/JamalAIPanel.jsx'
import { useAuth } from '../../auth/AuthProvider.jsx'
import { cn } from '../../shared/utils/cn.js'

const STATUS_BADGE = {
  lead: 'bg-blue-100 text-blue-700',
  prospect: 'bg-yellow-100 text-yellow-700',
  customer: 'bg-green-100 text-green-700',
  inactive: 'bg-gray-100 text-gray-500',
}

const STAGE_BADGE = {
  prospecting: 'bg-gray-100 text-gray-600',
  qualification: 'bg-blue-100 text-blue-700',
  proposal: 'bg-yellow-100 text-yellow-700',
  negotiation: 'bg-orange-100 text-orange-700',
  closed_won: 'bg-green-100 text-green-700',
  closed_lost: 'bg-red-100 text-red-600',
}

export default function CrmPage() {
  const { session } = useAuth()
  const [tab, setTab] = useState('contacts')
  const [search, setSearch] = useState('')
  const [contactModal, setContactModal] = useState(null) // null | 'new' | contact object
  const [dealModal, setDealModal] = useState(null)
  const [saving, setSaving] = useState(false)

  const {
    contacts, loading: contactsLoading, error: contactsError,
    createContact, updateContact, deleteContact,
  } = useContacts()

  const {
    deals, loading: dealsLoading, error: dealsError,
    createDeal, updateDeal, deleteDeal,
  } = useDeals()

  const displayed = search.trim()
    ? contacts.filter((c) =>
        [c.first_name, c.last_name, c.email, c.company]
          .join(' ')
          .toLowerCase()
          .includes(search.toLowerCase())
      )
    : contacts

  async function handleContactSubmit(fields) {
    setSaving(true)
    try {
      if (contactModal === 'new') {
        await createContact({ ...fields, owner_id: session?.user?.id ?? null })
      } else {
        await updateContact(contactModal.id, fields)
      }
      setContactModal(null)
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteContact(id) {
    if (!window.confirm('Delete this contact?')) return
    await deleteContact(id)
  }

  async function handleDealSubmit(fields) {
    setSaving(true)
    try {
      if (dealModal === 'new') {
        await createDeal({ ...fields, owner_id: session?.user?.id ?? null })
      } else {
        await updateDeal(dealModal.id, fields)
      }
      setDealModal(null)
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteDeal(id) {
    if (!window.confirm('Delete this deal?')) return
    await deleteDeal(id)
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">CRM</h1>
        <div className="flex gap-2">
          {tab === 'contacts' && (
            <button
              onClick={() => setContactModal('new')}
              className="rounded bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
            >
              + Add Contact
            </button>
          )}
          {tab === 'deals' && (
            <button
              onClick={() => setDealModal('new')}
              className="rounded bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
            >
              + Add Deal
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-4 flex gap-4 border-b border-gray-200">
        {['contacts', 'deals'].map((t) => (
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
            {t}
          </button>
        ))}
      </div>

      {/* Contacts tab */}
      {tab === 'contacts' && (
        <div>
          <div className="mb-4">
            <input
              type="search"
              placeholder="Search contacts…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full max-w-sm rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {contactsError && (
            <p className="mb-4 text-sm text-red-600">{contactsError}</p>
          )}

          {contactsLoading ? (
            <p className="text-sm text-gray-500">Loading…</p>
          ) : displayed.length === 0 ? (
            <p className="text-sm text-gray-500">No contacts found.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-xs font-medium uppercase text-gray-500">
                  <tr>
                    <th className="px-4 py-3 text-left">Name</th>
                    <th className="px-4 py-3 text-left">Email</th>
                    <th className="px-4 py-3 text-left">Phone</th>
                    <th className="px-4 py-3 text-left">Company</th>
                    <th className="px-4 py-3 text-left">Status</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {displayed.map((c) => (
                    <tr key={c.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {c.first_name} {c.last_name}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{c.email || '—'}</td>
                      <td className="px-4 py-3 text-gray-600">{c.phone || '—'}</td>
                      <td className="px-4 py-3 text-gray-600">{c.company || '—'}</td>
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
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => setContactModal(c)}
                          className="mr-2 text-indigo-600 hover:underline"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteContact(c.id)}
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

      {/* Deals tab */}
      {tab === 'deals' && (
        <div>
          {dealsError && (
            <p className="mb-4 text-sm text-red-600">{dealsError}</p>
          )}

          {dealsLoading ? (
            <p className="text-sm text-gray-500">Loading…</p>
          ) : deals.length === 0 ? (
            <p className="text-sm text-gray-500">No deals found.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-xs font-medium uppercase text-gray-500">
                  <tr>
                    <th className="px-4 py-3 text-left">Title</th>
                    <th className="px-4 py-3 text-left">Contact</th>
                    <th className="px-4 py-3 text-left">Stage</th>
                    <th className="px-4 py-3 text-right">Value</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {deals.map((d) => (
                    <tr key={d.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">{d.title}</td>
                      <td className="px-4 py-3 text-gray-600">
                        {d.contacts
                          ? `${d.contacts.first_name} ${d.contacts.last_name}`
                          : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            'rounded-full px-2 py-0.5 text-xs font-medium',
                            STAGE_BADGE[d.stage] ?? 'bg-gray-100 text-gray-600'
                          )}
                        >
                          {d.stage.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-gray-900">
                        ${Number(d.value).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => setDealModal(d)}
                          className="mr-2 text-indigo-600 hover:underline"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteDeal(d.id)}
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

      {/* Contact modal */}
      {contactModal && (
        <Modal
          title={contactModal === 'new' ? 'Add Contact' : 'Edit Contact'}
          onClose={() => setContactModal(null)}
        >
          <ContactForm
            initial={contactModal === 'new' ? undefined : contactModal}
            onSubmit={handleContactSubmit}
            onCancel={() => setContactModal(null)}
            saving={saving}
          />
        </Modal>
      )}

      {/* Deal modal */}
      {dealModal && (
        <Modal
          title={dealModal === 'new' ? 'Add Deal' : 'Edit Deal'}
          onClose={() => setDealModal(null)}
        >
          <DealForm
            initial={dealModal === 'new' ? undefined : dealModal}
            contacts={contacts}
            onSubmit={handleDealSubmit}
            onCancel={() => setDealModal(null)}
            saving={saving}
          />
        </Modal>
      )}

      {/* JamalAI CRM Assistant */}
      <h2 className="mb-3 mt-8 text-xs font-semibold uppercase tracking-wide text-gray-400">JamalAI Assistant</h2>
      <JamalAIPanel module="crm" />
    </div>
  )
}
