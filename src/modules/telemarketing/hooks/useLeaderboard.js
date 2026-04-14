import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../../../lib/supabase.js'

export function useLeaderboard() {
  const [leaderboard, setLeaderboard] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    // Fetch all call logs from today (UTC day boundary) grouped by agent
    const todayStart = new Date()
    todayStart.setUTCHours(0, 0, 0, 0)

    const { data, error } = await supabase
      .from('call_logs')
      .select('agent_id, outcome, profiles:agent_id(full_name)')
      .gte('called_at', todayStart.toISOString())

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    // Aggregate by agent
    const map = {}
    for (const row of data ?? []) {
      const id = row.agent_id
      if (!id) continue
      if (!map[id]) {
        map[id] = {
          agent_id: id,
          name: row.profiles?.full_name ?? 'Unknown',
          total: 0,
          converted: 0,
        }
      }
      map[id].total += 1
      if (row.outcome === 'converted') map[id].converted += 1
    }

    const sorted = Object.values(map).sort((a, b) => b.total - a.total)
    setLeaderboard(sorted)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  return { leaderboard, loading, error, load }
}
