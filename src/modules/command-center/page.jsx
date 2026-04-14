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

export default function CommandCenterPage() {
  const { profile, session } = useAuth()
  const [contactCount, setContactCount] = useState(null)
  const [dealCount, setDealCount] = useState(null)
  const [openDealValue, setOpenDealValue] = useState(null)
  const [statsLoading, setStatsLoading] = useState(true)

  useEffect(() => {
    async function loadStats() {
      const [contactsRes, dealsRes] = await Promise.all([
        supabase.from('contacts').select('id', { count: 'exact', head: true }),
        supabase.from('deals').select('value, stage'),
      ])

      setContactCount(contactsRes.count ?? 0)

      const deals = dealsRes.data ?? []
      setDealCount(deals.length)
      const open = deals
        .filter((d) => !['closed_won', 'closed_lost'].includes(d.stage))
        .reduce((sum, d) => sum + Number(d.value), 0)
      setOpenDealValue(open)

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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Total Contacts" value={contactCount} loading={statsLoading} />
        <StatCard label="Total Deals" value={dealCount} loading={statsLoading} />
        <StatCard
          label="Open Pipeline Value"
          value={openDealValue !== null ? `$${openDealValue.toLocaleString()}` : 0}
          loading={statsLoading}
        />
      </div>
    </div>
  )
}
