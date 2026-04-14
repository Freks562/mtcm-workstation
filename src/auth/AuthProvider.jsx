import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'

const AuthContext = createContext(null)

async function upsertProfile(user) {
  try {
    const { error } = await supabase.from('profiles').upsert(
      { id: user.id, updated_at: new Date().toISOString() },
      { onConflict: 'id', ignoreDuplicates: false }
    )

    if (error) {
      console.error('[upsertProfile]', error)
    }
  } catch (error) {
    console.error('[upsertProfile]', error)
  }
}

async function fetchProfile(userId) {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle()

    if (error) {
      console.error('[fetchProfile]', error)
      return null
    }

    return data ?? null
  } catch (error) {
    console.error('[fetchProfile]', error)
    return null
  }
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true

    async function initializeAuth() {
      try {
        const TIMEOUT_MS = 5000

        const sessionPromise = supabase.auth.getSession()
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('getSession timeout')), TIMEOUT_MS)
        )

        const { data, error } = await Promise.race([sessionPromise, timeoutPromise])

        if (!mounted) return

        if (error) {
          console.error('[getSession]', error)
          setSession(null)
          setProfile(null)
          return
        }

        const session = data?.session ?? null
        setSession(session)

        if (session?.user) {
          await upsertProfile(session.user)
          const nextProfile = await fetchProfile(session.user.id)
          if (!mounted) return
          setProfile(nextProfile)
        } else {
          setProfile(null)
        }
      } catch (error) {
        console.error('[AuthProvider init]', error)
        if (!mounted) return
        setSession(null)
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

      try {
        setSession(session ?? null)

        if (session?.user) {
          await upsertProfile(session.user)
          const nextProfile = await fetchProfile(session.user.id)
          if (!mounted) return
          setProfile(nextProfile)
        } else {
          setProfile(null)
        }
      } catch (error) {
        console.error('[onAuthStateChange]', error)
        if (!mounted) return
        setProfile(null)
      } finally {
        if (mounted) setLoading(false)
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
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
