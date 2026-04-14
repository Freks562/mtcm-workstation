import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../../../lib/supabase.js'

export function useCallQueue(campaignId, statusFilter) {
  const [queue, setQueue] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    if (!campaignId) {
      setQueue([])
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    let query = supabase
      .from('campaign_contacts')
      .select('*, contacts(id, first_name, last_name, email, phone, company)')
      .eq('campaign_id', campaignId)
      .order('id', { ascending: true })

    if (statusFilter && statusFilter !== 'all') {
      query = query.eq('status', statusFilter)
    }

    const { data, error } = await query
    if (error) setError(error.message)
    else setQueue(data ?? [])
    setLoading(false)
  }, [campaignId, statusFilter])

  useEffect(() => { load() }, [load])

  async function updateQueueStatus(id, status) {
    const { data, error } = await supabase
      .from('campaign_contacts')
      .update({ status })
      .eq('id', id)
      .select()
      .single()
    if (error) throw new Error(error.message)
    setQueue((prev) => prev.map((q) => (q.id === id ? { ...q, status: data.status } : q)))
    return data
  }

  async function addContactToQueue(campaignId, contactId) {
    const { data, error } = await supabase
      .from('campaign_contacts')
      .insert({ campaign_id: campaignId, contact_id: contactId })
      .select('*, contacts(id, first_name, last_name, email, phone, company)')
      .single()
    if (error) throw new Error(error.message)
    setQueue((prev) => [...prev, data])
    return data
  }

  return { queue, loading, error, load, updateQueueStatus, addContactToQueue }
}
