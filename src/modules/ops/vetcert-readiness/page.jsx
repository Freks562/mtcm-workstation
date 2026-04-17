import { useState } from 'react'
import { cn } from '../../../shared/utils/cn.js'
import { JamalAIPanel } from '../../../shared/components/ui/JamalAIPanel.jsx'

// ── constants ─────────────────────────────────────────────────────────────────

const CERT_ITEMS = [
  {
    id: 'sdvosb',
    label: 'SDVOSB — Service-Disabled Veteran-Owned Small Business',
    description: 'Self-certify in SAM.gov and verify through SBA CVE. Required for VA set-aside contracts.',
    link: 'https://veterans.certify.sba.gov/',
    linkLabel: 'SBA VetCert Portal',
  },
  {
    id: 'vosb',
    label: 'VOSB — Veteran-Owned Small Business',
    description: 'Certify through SBA CVE. Eligible for VA VOSB set-asides when SDVOSB competition is insufficient.',
    link: 'https://veterans.certify.sba.gov/',
    linkLabel: 'SBA VetCert Portal',
  },
  {
    id: '8a',
    label: '8(a) Business Development Program',
    description: 'SBA program for socially and economically disadvantaged businesses. 9-year program with set-aside benefits.',
    link: 'https://certify.sba.gov/',
    linkLabel: 'SBA Certify',
  },
  {
    id: 'hubzone',
    label: 'HUBZone — Historically Underutilized Business Zone',
    description: 'Must be located in and employ staff from a HUBZone. Provides price preference in federal contracts.',
    link: 'https://certify.sba.gov/certify/hubzone',
    linkLabel: 'HUBZone Map & Application',
  },
  {
    id: 'wosb',
    label: 'WOSB / EDWOSB — Woman-Owned Small Business',
    description: 'Certify through SBA or an approved third-party certifier for set-aside contracts in underrepresented industries.',
    link: 'https://certify.sba.gov/',
    linkLabel: 'SBA Certify',
  },
]

const REG_ITEMS = [
  {
    id: 'sam',
    label: 'SAM.gov Registration (active)',
    description: 'Must be active and renewed annually. Required before any federal award.',
    link: 'https://sam.gov',
    linkLabel: 'SAM.gov',
  },
  {
    id: 'uei',
    label: 'Unique Entity Identifier (UEI)',
    description: 'Replaced DUNS in April 2022. Assigned automatically when you register in SAM.gov.',
    link: 'https://sam.gov',
    linkLabel: 'SAM.gov',
  },
  {
    id: 'naics',
    label: 'NAICS Codes selected',
    description: 'Select all applicable NAICS codes in SAM.gov to match solicitation requirements.',
    link: 'https://www.naics.com/search/',
    linkLabel: 'NAICS Lookup',
  },
  {
    id: 'capability',
    label: 'Capability Statement on file',
    description: '1-2 page document summarizing core competencies, past performance, differentiators, and certifications.',
    link: null,
    linkLabel: null,
  },
  {
    id: 'past_perf',
    label: 'Past Performance references (3+)',
    description: 'Federal contracting officers verify past performance. Maintain 3+ references with contract numbers and POCs.',
    link: 'https://cpars.gov',
    linkLabel: 'CPARS',
  },
  {
    id: 'financial',
    label: 'Financial statements ready',
    description: 'Many grants require 2–3 years of audited or reviewed financial statements.',
    link: null,
    linkLabel: null,
  },
]

// ── ChecklistItem ─────────────────────────────────────────────────────────────

function ChecklistItem({ item, checked, onToggle }) {
  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-lg border p-4 transition-colors cursor-pointer',
        checked
          ? 'border-green-200 bg-green-50'
          : 'border-gray-200 bg-white hover:border-indigo-200 hover:bg-indigo-50/30'
      )}
      onClick={() => onToggle(item.id)}
    >
      <span
        className={cn(
          'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-colors',
          checked ? 'border-green-500 bg-green-500' : 'border-gray-300 bg-white'
        )}
      >
        {checked && (
          <svg className="h-3 w-3 text-white" viewBox="0 0 12 10" fill="none">
            <path d="M1 5l3.5 3.5L11 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </span>
      <div className="flex-1 min-w-0">
        <p className={cn('text-sm font-medium', checked ? 'text-green-800 line-through decoration-green-400' : 'text-gray-900')}>
          {item.label}
        </p>
        <p className="mt-0.5 text-xs text-gray-500">{item.description}</p>
        {item.link && (
          <a
            href={item.link}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="mt-1 inline-block text-xs font-medium text-indigo-600 hover:underline"
          >
            {item.linkLabel} ↗
          </a>
        )}
      </div>
    </div>
  )
}

// ── ReadinessBar ──────────────────────────────────────────────────────────────

function ReadinessBar({ done, total }) {
  const pct = total === 0 ? 0 : Math.round((done / total) * 100)
  const color = pct >= 80 ? 'bg-green-500' : pct >= 50 ? 'bg-yellow-500' : 'bg-red-500'
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-medium text-gray-700">Overall Readiness</p>
        <p className="text-lg font-bold text-gray-900">{pct}%</p>
      </div>
      <div className="h-3 w-full rounded-full bg-gray-100 overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-500', color)}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-2 text-xs text-gray-400">{done} of {total} items complete</p>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function VetCertReadinessPage() {
  const allItems = [...CERT_ITEMS, ...REG_ITEMS]
  const [checked, setChecked] = useState(() => new Set())
  const [aiKey, setAiKey]     = useState(0)
  const [aiTask, setAiTask]   = useState('')

  function toggleItem(id) {
    setChecked((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function quickPrompt(prompt) {
    setAiTask(prompt)
    setAiKey((k) => k + 1)
    setTimeout(() => {
      document.getElementById('vetcert-ai-panel')?.scrollIntoView({ behavior: 'smooth' })
    }, 50)
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">VetCert Readiness Center</h1>
          <p className="mt-1 text-sm text-gray-500">
            Track certification status and document readiness for federal contracting
          </p>
        </div>
        <a
          href="https://veterans.certify.sba.gov/"
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
        >
          Open SBA VetCert Portal ↗
        </a>
      </div>

      {/* Readiness bar */}
      <div className="mb-6">
        <ReadinessBar done={checked.size} total={allItems.length} />
      </div>

      {/* Stats */}
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-gray-200 bg-white p-5">
          <p className="text-sm font-medium text-gray-500">Certifications</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">
            {CERT_ITEMS.filter((i) => checked.has(i.id)).length}
            <span className="text-base font-normal text-gray-400"> / {CERT_ITEMS.length}</span>
          </p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-5">
          <p className="text-sm font-medium text-gray-500">Registrations & Docs</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">
            {REG_ITEMS.filter((i) => checked.has(i.id)).length}
            <span className="text-base font-normal text-gray-400"> / {REG_ITEMS.length}</span>
          </p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-5">
          <p className="text-sm font-medium text-gray-500">Items Remaining</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">
            {allItems.length - checked.size}
          </p>
        </div>
      </div>

      {/* Certifications checklist */}
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
        Certifications
      </h2>
      <div className="mb-6 space-y-2">
        {CERT_ITEMS.map((item) => (
          <ChecklistItem
            key={item.id}
            item={item}
            checked={checked.has(item.id)}
            onToggle={toggleItem}
          />
        ))}
      </div>

      {/* Registrations & Documents checklist */}
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
        Registrations & Documents
      </h2>
      <div className="mb-8 space-y-2">
        {REG_ITEMS.map((item) => (
          <ChecklistItem
            key={item.id}
            item={item}
            checked={checked.has(item.id)}
            onToggle={toggleItem}
          />
        ))}
      </div>

      {/* JamalAI quick actions */}
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
        JamalAI Quick Actions
      </h2>
      <div className="mb-4 flex flex-wrap gap-2">
        <button
          onClick={() => quickPrompt('Walk me through the SDVOSB certification process step by step, including required documents and timelines.')}
          className="rounded border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100 transition-colors"
        >
          SDVOSB Step-by-Step
        </button>
        <button
          onClick={() => quickPrompt('What are the eligibility requirements for the VA SDVOSB and VOSB set-aside programs? How do I qualify?')}
          className="rounded border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100 transition-colors"
        >
          Check My Eligibility
        </button>
        <button
          onClick={() => quickPrompt('Write a one-page capability statement template for a veteran-owned small business targeting VA contracts. Include sections for core competencies, past performance, differentiators, and contact information.')}
          className="rounded border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100 transition-colors"
        >
          Generate Capability Statement
        </button>
        <button
          onClick={() => quickPrompt('What NAICS codes are most relevant for a veteran-owned business pursuing VA healthcare IT, consulting, and facilities contracts?')}
          className="rounded border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100 transition-colors"
        >
          Find NAICS Codes
        </button>
      </div>

      {/* JamalAI panel */}
      <div id="vetcert-ai-panel">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
          JamalAI — Certification Assistant
        </h2>
        <JamalAIPanel
          key={aiKey}
          module="grants"
          initialTask={aiTask}
          placeholder='e.g. "What documents do I need for SDVOSB certification?", "Am I eligible for 8(a)?"'
        />
      </div>
    </div>
  )
}
