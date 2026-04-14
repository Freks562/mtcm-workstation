import { NavLink } from 'react-router-dom'
import { cn } from '../../utils/cn.js'

const navItems = [
  { to: '/command-center', label: 'Command Center' },
  { to: '/crm', label: 'CRM' },
  { to: '/telemarketing', label: 'Telemarketing' },
  { to: '/dotmail', label: 'Dotmail' },
  { to: '/analytics', label: 'Analytics' },
]

export function Sidebar() {
  return (
    <aside className="flex w-56 flex-col bg-gray-900 text-white">
      <div className="px-4 py-5 text-lg font-bold tracking-wide">MTCM</div>
      <nav className="flex-1 space-y-1 px-2 py-2">
        {navItems.map(({ to, label }) => (
          <NavLink
            key={to}
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
        ))}
      </nav>
    </aside>
  )
}
