import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../../../lib/supabase.js'
import { useAuth } from '../../../auth/AuthProvider.jsx'

export function useGrants() {
  const { session } = useAuth()
  const userId = session?.user?.id

  const [grants, setGrants] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    setError(null)
    const { data, error: err } = await supabase
      .from('grants')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    if (err) setError(err.message)
    else setGrants(data ?? [])
    setLoading(false)
  }, [userId])

  useEffect(() => { load() }, [load])

  async function createGrant(fields) {
    if (!userId) throw new Error('Not authenticated')
    const { data, error: err } = await supabase
      .from('grants')
      .insert({ ...fields, user_id: userId })
      .select()
      .single()
    if (err) throw new Error(err.message)
    setGrants((prev) => [data, ...prev])
    return data
  }

  async function updateGrant(id, fields) {
    const { data, error: err } = await supabase
      .from('grants')
      .update(fields)
      .eq('id', id)
      .select()
      .single()
    if (err) throw new Error(err.message)
    setGrants((prev) => prev.map((g) => (g.id === id ? data : g)))
    return data
  }

  async function deleteGrant(id) {
    const { error: err } = await supabase.from('grants').delete().eq('id', id)
    if (err) throw new Error(err.message)
    setGrants((prev) => prev.filter((g) => g.id !== id))
  }

  return { grants, loading, error, load, createGrant, updateGrant, deleteGrant }
}
