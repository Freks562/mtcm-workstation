import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'

const AuthContext = createContext(null)

async function upsertProfile(user) {
  await supabase.from('profiles').upsert(
    { id: user.id, updated_at: new Date().toISOString() },
    { onConflict: 'id', ignoreDuplicates: false }
  )
}

async function fetchProfile(userId) {
  const TIMEOUT_MS = 5000
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .abortSignal(controller.signal)
      .single()

    if (error) {
      // PGRST116 = no rows found; treat as a missing profile, not an error
      if (error.code === 'PGRST116') return null
      console.error('[fetchProfile]', error)
      return null
    }

    return data ?? null
  } catch (error) {
    console.error('[fetchProfile]', error)
    return null
  } finally {
    clearTimeout(timer)
  }
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session)
      if (session?.user) {
        await upsertProfile(session.user)
        setProfile(await fetchProfile(session.user.id))
      }
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session)
      if (session?.user) {
        await upsertProfile(session.user)
        setProfile(await fetchProfile(session.user.id))
      } else {
        setProfile(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  return (
    <AuthContext.Provider value={{ session, profile, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
