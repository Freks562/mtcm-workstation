import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../../../lib/supabase.js'
import { logEvent } from '../../../lib/logEvent.js'

export function useFreksRenders(projectId) {
  const [renders, setRenders] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    if (!projectId) {
      setRenders([])
      return
    }
    setLoading(true)
    setError(null)
    const { data, error } = await supabase
      .from('freks_renders')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
    if (error) setError(error.message)
    else setRenders(data ?? [])
    setLoading(false)
  }, [projectId])

  useEffect(() => { load() }, [load])

  // createRender inserts a queued row then immediately invokes the
  // freksframe-render edge function to begin processing.  The optimistic
  // local state is refreshed after the function returns so the UI reflects
  // the final status (processing → completed / failed) without a manual reload.
  async function createRender(fields, actorId) {
    const { data, error: insertErr } = await supabase
      .from('freks_renders')
      .insert({ ...fields, project_id: projectId, status: 'queued' })
      .select()
      .single()
    if (insertErr) throw new Error(insertErr.message)
    setRenders((prev) => [data, ...prev])

    await logEvent({
      type: 'freksframe_render_queued',
      actorId,
      entityType: 'freks_render',
      entityId: data.id,
      metadata: { project_id: projectId, format: data.format },
    })

    // Invoke the render worker. Errors are surfaced to the caller; the worker
    // itself also writes the failure to freks_renders.error so it is durable.
    const { error: fnError } = await supabase.functions.invoke('freksframe-render', {
      body: { render_id: data.id },
    })
    if (fnError) throw new Error(`Failed to start render: ${fnError.message}`)

    // Refresh so the caller sees the final status row from DB
    await load()
    return data
  }

  async function updateRender(id, fields) {
    const { data, error } = await supabase
      .from('freks_renders')
      .update(fields)
      .eq('id', id)
      .select()
      .single()
    if (error) throw new Error(error.message)
    setRenders((prev) => prev.map((r) => (r.id === id ? data : r)))
    return data
  }

  return { renders, loading, error, load, createRender, updateRender }
}

