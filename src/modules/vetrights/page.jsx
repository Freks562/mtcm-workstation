import React, { useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase.js'
import { requireUser } from '../../shared/utils/requireAuth.js'

const readinessItems = [
  { key: 'dd214', label: 'DD-214 or proof of service' },
  { key: 'decisionLetters', label: 'VA decision letters' },
  { key: 'medicalRecords', label: 'Medical records' },
  { key: 'buddyStatements', label: 'Buddy statements / lay statements' },
  { key: 'timeline', label: 'Incident timeline / claim summary' },
  { key: 'contactInfo', label: 'Current contact info confirmed' },
]

const buildInitialChecklist = () =>
  readinessItems.reduce((acc, item) => {
    acc[item.key] = false
    return acc
  }, {})

export default function VetRightsPage() {
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    claimType: 'va-disability',
    urgency: 'standard',
    caseSummary: '',
    desiredOutcome: '',
  })

  const [checklist, setChecklist] = useState(buildInitialChecklist())
  const [files, setFiles] = useState([])
  const [saving, setSaving] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [submitSuccess, setSubmitSuccess] = useState('')

  const readinessScore = useMemo(() => {
    const total = readinessItems.length
    const completed = Object.values(checklist).filter(Boolean).length
    return Math.round((completed / total) * 100)
  }, [checklist])

  function updateField(e) {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  function toggleChecklist(key) {
    setChecklist((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  function handleFiles(e) {
    setFiles(Array.from(e.target.files || []))
  }

  function resetFormState() {
    setForm({
      fullName: '',
      email: '',
      phone: '',
      claimType: 'va-disability',
      urgency: 'standard',
      caseSummary: '',
      desiredOutcome: '',
    })
    setChecklist(buildInitialChecklist())
    setFiles([])
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitError('')
    setSubmitSuccess('')
    setSaving(true)

    try {
      const user = await requireUser()

      const payload = {
        created_by: user.id,
        full_name: form.fullName,
        email: form.email,
        phone: form.phone,
        claim_type: form.claimType,
        urgency: form.urgency,
        case_summary: form.caseSummary,
        desired_outcome: form.desiredOutcome,
        readiness_score: readinessScore,
        checklist,
      }

      const { data, error } = await supabase
        .from('vetrights_intakes')
        .insert(payload)
        .select('id')
        .single()

      if (error) throw error
      if (!data?.id) throw new Error('Intake saved but no intake ID returned.')

      setSubmitSuccess(`VetRights intake saved. Intake ID: ${data.id}`)

      resetFormState()
    } catch (err) {
      setSubmitError(err?.message || 'Failed to save VetRights intake.')
    } finally {
      setSaving(false)
    }
  }

  function handleReset() {
    resetFormState()
    setSubmitError('')
    setSubmitSuccess('')
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">VetRights</h1>
        <p className="mt-1 text-sm text-gray-500">
          Veteran intake, evidence upload, and case readiness.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-base font-semibold text-gray-900">New Intake</h2>

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Full name
                </label>
                <input
                  name="fullName"
                  value={form.fullName}
                  onChange={updateField}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500"
                  placeholder="Jamal Williams"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Email
                </label>
                <input
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={updateField}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500"
                  placeholder="name@email.com"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Phone
                </label>
                <input
                  name="phone"
                  value={form.phone}
                  onChange={updateField}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500"
                  placeholder="(555) 555-5555"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Claim type
                </label>
                <select
                  name="claimType"
                  value={form.claimType}
                  onChange={updateField}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500"
                >
                  <option value="va-disability">VA Disability</option>
                  <option value="increase">Increase Request</option>
                  <option value="appeal">Appeal</option>
                  <option value="backpay">Back Pay Review</option>
                  <option value="tort-claim">Federal Tort Claim</option>
                  <option value="other">Other Veteran Legal Issue</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Urgency
                </label>
                <select
                  name="urgency"
                  value={form.urgency}
                  onChange={updateField}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500"
                >
                  <option value="standard">Standard</option>
                  <option value="priority">Priority</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Evidence upload
                </label>
                <input
                  type="file"
                  multiple
                  onChange={handleFiles}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Case summary
              </label>
              <textarea
                name="caseSummary"
                value={form.caseSummary}
                onChange={updateField}
                rows={5}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500"
                placeholder="Briefly explain what happened, what has been filed, and what support is needed."
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Desired outcome
              </label>
              <textarea
                name="desiredOutcome"
                value={form.desiredOutcome}
                onChange={updateField}
                rows={3}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500"
                placeholder="Increase, service connection, back pay, review of denial, tort claim support, etc."
              />
            </div>

            {files.length > 0 && (
              <div className="rounded-md border border-gray-200 bg-gray-50 p-3">
                <p className="mb-2 text-sm font-medium text-gray-700">Selected files</p>
                <ul className="space-y-1 text-sm text-gray-600">
                  {files.map((file, idx) => (
                    <li key={`${file.name}-${idx}`}>{file.name}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={saving}
                className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
              >
                {saving ? 'Saving...' : 'Save Intake'}
              </button>
              <button
                type="button"
                className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                onClick={handleReset}
              >
                Reset
              </button>
            </div>

            {submitError && (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {submitError}
              </div>
            )}

            {submitSuccess && (
              <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                {submitSuccess}
              </div>
            )}
          </form>
        </div>

        <div className="space-y-6">
          <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-base font-semibold text-gray-900">Case Readiness</h2>
            <div className="mb-3 flex items-end gap-2">
              <span className="text-3xl font-bold text-indigo-600">{readinessScore}%</span>
              <span className="pb-1 text-sm text-gray-500">ready</span>
            </div>
            <div className="mb-4 h-2 w-full rounded bg-gray-200">
              <div
                className="h-2 rounded bg-indigo-600 transition-all"
                style={{ width: `${readinessScore}%` }}
              />
            </div>

            <div className="space-y-2">
              {readinessItems.map((item) => (
                <label
                  key={item.key}
                  className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 hover:bg-gray-50"
                >
                  <input
                    type="checkbox"
                    checked={checklist[item.key]}
                    onChange={() => toggleChecklist(item.key)}
                  />
                  <span className="text-sm text-gray-700">{item.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-base font-semibold text-gray-900">Recommended Next Step</h2>
            <p className="text-sm text-gray-600">
              {readinessScore < 40 &&
                'Start by gathering core records and writing a clean case timeline.'}
              {readinessScore >= 40 &&
                readinessScore < 80 &&
                'You have a workable start. Fill the remaining evidence gaps before submission.'}
              {readinessScore >= 80 &&
                'Strong intake position. Ready for review, packaging, and submission workflow.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
