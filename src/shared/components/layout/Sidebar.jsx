import { NavLink } from 'react-router-dom'
import { cn } from '../../utils/cn.js'

const CORE_NAV = [
  { to: '/command-center',   label: 'Command Center' },
  { to: '/crm',              label: 'CRM' },
  { to: '/telemarketing',    label: 'Telemarketing' },
  { to: '/dotmail',          label: 'Dotmail' },
  { to: '/analytics',        label: 'Analytics' },
  { to: '/freksframe',       label: 'FreksFrame' },
  { to: '/va-opportunities', label: 'VA Opportunities' },
  { to: '/grants',           label: 'Grant Pipeline' },
]

const OPS_NAV = [
  { to: '/ops/deals',              label: 'Deals' },
  { to: '/ops/metrics',            label: 'Metrics' },
  { to: '/ops/grants',             label: 'Grants' },
  { to: '/ops/meeting-demo',       label: 'Meeting & Demo' },
  { to: '/ops/vetcert-readiness',  label: 'VetCert Readiness' },
]

function NavItem({ to, label }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          'block rounded px-3 py-2 text-sm font-medium transition-colors',
          isActive
            ? 'bg-indigo-600 text-white'
            : 'text-gray-300 hover:bg-gray-700 hover:text-white'
        )
      }
    >
      {label}
    </NavLink>
  )
}

export function Sidebar() {
  return (
    <aside className="flex w-56 flex-col bg-gray-900 text-white overflow-y-auto">
      <div className="px-4 py-5 text-lg font-bold tracking-wide shrink-0">MTCM</div>
      <nav className="flex-1 space-y-1 px-2 py-2">
        {CORE_NAV.map(({ to, label }) => (
          <NavItem key={to} to={to} label={label} />
        ))}

        {/* Ops section */}
        <div className="pt-4 pb-1 px-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
            Ops Pipeline
          </p>
        </div>
        {OPS_NAV.map(({ to, label }) => (
          <NavItem key={to} to={to} label={label} />
        ))}
      </nav>
    </aside>
  )
}

