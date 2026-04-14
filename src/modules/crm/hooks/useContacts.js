import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../../../lib/supabase.js'

export function useContacts() {
  const [contacts, setContacts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async (search = '') => {
    setLoading(true)
    setError(null)
    let query = supabase
      .from('contacts')
      .select('*')
      .order('created_at', { ascending: false })

    if (search.trim()) {
      const term = `%${search.trim()}%`
      query = query.or(
        `first_name.ilike.${term},last_name.ilike.${term},email.ilike.${term},company.ilike.${term}`
      )
    }

    const { data, error } = await query
    if (error) setError(error.message)
    else setContacts(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function createContact(fields) {
    const { data, error } = await supabase.from('contacts').insert(fields).select().single()
    if (error) throw new Error(error.message)
    setContacts((prev) => [data, ...prev])
    return data
  }

  async function updateContact(id, fields) {
    const { data, error } = await supabase
      .from('contacts')
      .update(fields)
      .eq('id', id)
      .select()
      .single()
    if (error) throw new Error(error.message)
    setContacts((prev) => prev.map((c) => (c.id === id ? data : c)))
    return data
  }

  async function deleteContact(id) {
    const { error } = await supabase.from('contacts').delete().eq('id', id)
    if (error) throw new Error(error.message)
    setContacts((prev) => prev.filter((c) => c.id !== id))
  }

  return { contacts, loading, error, load, createContact, updateContact, deleteContact }
}
