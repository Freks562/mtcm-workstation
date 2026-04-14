import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../../../lib/supabase.js'
import { logEvent } from '../../../lib/logEvent.js'

export function useCallLogs(campaignId) {
  const [callLogs, setCallLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    let query = supabase
      .from('call_logs')
      .select('*, contacts(first_name, last_name), profiles:agent_id(full_name)')
      .order('called_at', { ascending: false })

    if (campaignId) {
      query = query.eq('campaign_id', campaignId)
    }

    const { data, error } = await query
    if (error) setError(error.message)
    else setCallLogs(data ?? [])
    setLoading(false)
  }, [campaignId])

  useEffect(() => { load() }, [load])

  async function logCall(fields, actorId) {
    const { data, error } = await supabase
      .from('call_logs')
      .insert(fields)
      .select('*, contacts(first_name, last_name), profiles:agent_id(full_name)')
      .single()
    if (error) throw new Error(error.message)
    setCallLogs((prev) => [data, ...prev])
    await logEvent({
      type: 'call_logged',
      actorId,
      entityType: 'call_log',
      entityId: data.id,
      metadata: { outcome: data.outcome, contact_id: data.contact_id },
    })
    return data
  }

  return { callLogs, loading, error, load, logCall }
}
