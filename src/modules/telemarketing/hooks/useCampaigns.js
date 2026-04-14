import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../../../lib/supabase.js'
import { logEvent } from '../../../lib/logEvent.js'

export function useCampaigns() {
  const [campaigns, setCampaigns] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data, error } = await supabase
      .from('campaigns')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) setError(error.message)
    else setCampaigns(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function createCampaign(fields, actorId) {
    const { data, error } = await supabase
      .from('campaigns')
      .insert(fields)
      .select()
      .single()
    if (error) throw new Error(error.message)
    setCampaigns((prev) => [data, ...prev])
    await logEvent({ type: 'campaign_created', actorId, entityType: 'campaign', entityId: data.id, metadata: { name: data.name } })
    return data
  }

  async function updateCampaign(id, fields, actorId) {
    const { data, error } = await supabase
      .from('campaigns')
      .update(fields)
      .eq('id', id)
      .select()
      .single()
    if (error) throw new Error(error.message)
    setCampaigns((prev) => prev.map((c) => (c.id === id ? data : c)))
    await logEvent({ type: 'campaign_updated', actorId, entityType: 'campaign', entityId: id, metadata: { name: data.name } })
    return data
  }

  return { campaigns, loading, error, load, createCampaign, updateCampaign }
}
