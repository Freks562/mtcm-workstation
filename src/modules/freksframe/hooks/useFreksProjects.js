import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../../../lib/supabase.js'
import { logEvent } from '../../../lib/logEvent.js'

export function useFreksProjects() {
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data, error } = await supabase
      .from('freks_projects')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) setError(error.message)
    else setProjects(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function createProject(fields, actorId) {
    const { data, error } = await supabase
      .from('freks_projects')
      .insert(fields)
      .select()
      .single()
    if (error) throw new Error(error.message)
    setProjects((prev) => [data, ...prev])
    await logEvent({
      type: 'freksframe_project_created',
      actorId,
      entityType: 'freks_project',
      entityId: data.id,
      metadata: { title: data.title },
    })
    return data
  }

  async function updateProject(id, fields, actorId) {
    const { data, error } = await supabase
      .from('freks_projects')
      .update(fields)
      .eq('id', id)
      .select()
      .single()
    if (error) throw new Error(error.message)
    setProjects((prev) => prev.map((p) => (p.id === id ? data : p)))
    await logEvent({
      type: 'freksframe_project_updated',
      actorId,
      entityType: 'freks_project',
      entityId: id,
      metadata: { title: data.title },
    })
    return data
  }

  async function deleteProject(id) {
    const { error } = await supabase.from('freks_projects').delete().eq('id', id)
    if (error) throw new Error(error.message)
    setProjects((prev) => prev.filter((p) => p.id !== id))
  }

  return { projects, loading, error, load, createProject, updateProject, deleteProject }
}
