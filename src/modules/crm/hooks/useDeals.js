import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../../../lib/supabase.js'

export function useDeals() {
  const [deals, setDeals] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data, error } = await supabase
      .from('deals')
      .select('*, contacts(first_name, last_name)')
      .order('created_at', { ascending: false })
    if (error) setError(error.message)
    else setDeals(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function createDeal(fields) {
    const { data, error } = await supabase
      .from('deals')
      .insert(fields)
      .select('*, contacts(first_name, last_name)')
      .single()
    if (error) throw new Error(error.message)
    setDeals((prev) => [data, ...prev])
    return data
  }

  async function updateDeal(id, fields) {
    const { data, error } = await supabase
      .from('deals')
      .update(fields)
      .eq('id', id)
      .select('*, contacts(first_name, last_name)')
      .single()
    if (error) throw new Error(error.message)
    setDeals((prev) => prev.map((d) => (d.id === id ? data : d)))
    return data
  }

  async function deleteDeal(id) {
    const { error } = await supabase.from('deals').delete().eq('id', id)
    if (error) throw new Error(error.message)
    setDeals((prev) => prev.filter((d) => d.id !== id))
  }

  return { deals, loading, error, load, createDeal, updateDeal, deleteDeal }
}
