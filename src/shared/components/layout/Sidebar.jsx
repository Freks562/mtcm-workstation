import { NavLink } from 'react-router-dom'
import { cn } from '../../utils/cn.js'

const navItems = [
  { to: '/command-center', label: 'Command Center' },
  { to: '/crm', label: 'CRM' },
  { to: '/telemarketing', label: 'Telemarketing' },
  { to: '/dotmail', label: 'DotMail' },
  { to: '/analytics', label: 'Analytics' },
  { to: '/freksframe', label: 'FreksFrame' },
  { to: '/va-opportunities', label: 'VA Opportunities' },

  // 🔥 NEW
  { to: '/vetrights', label: 'VetRights' },
]

export function Sidebar() {
  return (
    <aside className="flex w-56 flex-col bg-gray-900 text-white">
      
      {/* Logo / Title */}
      <div className="px-4 py-5 text-lg font-bold tracking-wide">
        MTCM
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-2 py-2">
        {navItems.map(({ to, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                'block rounded px-3 py-2 text-sm font-medium transition-all duration-150',
                isActive
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-gray-300 hover:bg-gray-700 hover:text-white'
              )
            }
          >
            {label}
          </NavLink>
        ))}
      </nav>

    </aside>
  )
}