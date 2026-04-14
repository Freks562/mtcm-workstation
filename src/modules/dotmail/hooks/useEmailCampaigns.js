import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../../../lib/supabase.js'
import { logEvent } from '../../../lib/logEvent.js'

/**
 * Email campaigns = rows in the shared `campaigns` table where type = 'email'.
 */
export function useEmailCampaigns() {
  const [campaigns, setCampaigns] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data, error } = await supabase
      .from('campaigns')
      .select('*')
      .eq('type', 'email')
      .order('created_at', { ascending: false })
    if (error) setError(error.message)
    else setCampaigns(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function createEmailCampaign(fields, actorId) {
    const { data, error } = await supabase
      .from('campaigns')
      .insert({ ...fields, type: 'email' })
      .select()
      .single()
    if (error) throw new Error(error.message)
    setCampaigns((prev) => [data, ...prev])
    await logEvent({ type: 'email_campaign_created', actorId, entityType: 'campaign', entityId: data.id, metadata: { name: data.name } })
    return data
  }

  async function updateEmailCampaign(id, fields, actorId) {
    const { data, error } = await supabase
      .from('campaigns')
      .update(fields)
      .eq('id', id)
      .select()
      .single()
    if (error) throw new Error(error.message)
    setCampaigns((prev) => prev.map((c) => (c.id === id ? data : c)))
    await logEvent({ type: 'email_campaign_updated', actorId, entityType: 'campaign', entityId: id, metadata: { name: data.name } })
    return data
  }

  return { campaigns, loading, error, load, createEmailCampaign, updateEmailCampaign }
}
