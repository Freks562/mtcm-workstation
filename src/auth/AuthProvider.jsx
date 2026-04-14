import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'

const AuthContext = createContext(null)

async function upsertProfile(user) {
  try {
    await supabase.from('profiles').upsert(
      { id: user.id, updated_at: new Date().toISOString() },
      { onConflict: 'id', ignoreDuplicates: false }
    )
  } catch (error) {
    console.error('[upsertProfile]', error)
  }
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
      .maybeSingle()

    if (error) {
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
  const [session, setSession] = useState(null)
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true

    async function initializeAuth() {
      try {
        const { data, error } = await supabase.auth.getSession()

        if (error) {
          console.error('[getSession]', error)
          setSession(null)
          setUser(null)
          setProfile(null)
          return
        }

        if (!mounted) return

        const session = data?.session ?? null
        setSession(session)
        setUser(session?.user ?? null)

        if (session?.user?.id) {
          const profile = await fetchProfile(session.user.id)
          if (!mounted) return
          setProfile(profile)
        } else {
          setProfile(null)
        }
      } catch (error) {
        console.error('[initializeAuth]', error)
        setSession(null)
        setUser(null)
        setProfile(null)
      } finally {
        if (mounted) setLoading(false)
      }
    }

    initializeAuth()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!mounted) return

      setSession(session ?? null)
      setUser(session?.user ?? null)

      if (session?.user?.id) {
        try {
          await upsertProfile(session.user)
          const profile = await fetchProfile(session.user.id)
          if (!mounted) return
          setProfile(profile)
        } catch (error) {
          console.error('[onAuthStateChange]', error)
          if (!mounted) return
          setProfile(null)
        }
      } else {
        setProfile(null)
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  if (loading) return null

  return (
    <AuthContext.Provider value={{ session, user, profile, loading }}>
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
