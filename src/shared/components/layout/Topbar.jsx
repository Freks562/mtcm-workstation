import { supabase } from '../../../lib/supabase.js'
import { useAuth } from '../../../auth/AuthProvider.jsx'

export function Topbar() {
  const { session } = useAuth()

  async function handleSignOut() {
    await supabase.auth.signOut()
  }

  return (
    <header className="flex h-14 items-center justify-between border-b border-gray-200 bg-white px-6">
      <span className="text-sm text-gray-500">MTCM Workstation</span>
      <div className="flex items-center gap-4">
        <span className="text-sm text-gray-700">{session?.user?.email}</span>
        <button
          onClick={handleSignOut}
          className="rounded px-3 py-1 text-sm text-gray-600 hover:bg-gray-100"
        >
          Sign out
        </button>
      </div>
    </header>
  )
}
