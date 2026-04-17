import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../../../lib/supabase.js'

export function useVaOpportunities({ category = '', status = '', keyword = '' } = {}) {
  const [opportunities, setOpportunities] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)

    let query = supabase
      .from('va_opportunities')
      .select('*')
      .order('deadline', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false })

    if (category) query = query.eq('category', category)
    if (status)   query = query.eq('status', status)
    if (keyword.trim()) {
      const term = `%${keyword.trim()}%`
      query = query.or(`title.ilike.${term},description.ilike.${term}`)
    }

    const { data, error: err } = await query
    if (err) setError(err.message)
    else setOpportunities(data ?? [])
    setLoading(false)
  }, [category, status, keyword])

  useEffect(() => { load() }, [load])

  return { opportunities, loading, error, reload: load }
}
