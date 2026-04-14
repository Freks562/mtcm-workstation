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
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()
  return data ?? null
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function bootstrap() {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        setSession(session)
        if (session?.user) {
          try {
            await upsertProfile(session.user)
          } catch (err) {
            console.error('[AuthProvider] upsertProfile failed:', err)
          }
          try {
            setProfile(await fetchProfile(session.user.id))
          } catch (err) {
            console.error('[AuthProvider] fetchProfile failed:', err)
            setProfile(null)
          }
        }
      } catch (err) {
        console.error('[AuthProvider] getSession failed:', err)
      } finally {
        setLoading(false)
      }
    }

    bootstrap()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      setSession(session)
      if (event === 'SIGNED_OUT') {
        setProfile(null)
        return
      }
      if (session?.user) {
        try {
          await upsertProfile(session.user)
        } catch (err) {
          console.error('[AuthProvider] onAuthStateChange upsertProfile failed:', err)
        }
        try {
          setProfile(await fetchProfile(session.user.id))
        } catch (err) {
          console.error('[AuthProvider] onAuthStateChange fetchProfile failed:', err)
          setProfile(null)
        }
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
