import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../../../lib/supabase.js'

export function useFreksScenes(projectId) {
  const [scenes, setScenes] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    if (!projectId) {
      setScenes([])
      return
    }
    setLoading(true)
    setError(null)
    const { data, error } = await supabase
      .from('freks_scenes')
      .select('*')
      .eq('project_id', projectId)
      .order('order_index', { ascending: true })
    if (error) setError(error.message)
    else setScenes(data ?? [])
    setLoading(false)
  }, [projectId])

  useEffect(() => { load() }, [load])

  async function createScene(fields) {
    const { data, error } = await supabase
      .from('freks_scenes')
      .insert({ ...fields, project_id: projectId })
      .select()
      .single()
    if (error) throw new Error(error.message)
    setScenes((prev) => [...prev, data].sort((a, b) => a.order_index - b.order_index))
    return data
  }

  async function updateScene(id, fields) {
    const { data, error } = await supabase
      .from('freks_scenes')
      .update(fields)
      .eq('id', id)
      .select()
      .single()
    if (error) throw new Error(error.message)
    setScenes((prev) => prev.map((s) => (s.id === id ? data : s)))
    return data
  }

  async function deleteScene(id) {
    const { error } = await supabase.from('freks_scenes').delete().eq('id', id)
    if (error) throw new Error(error.message)
    setScenes((prev) => prev.filter((s) => s.id !== id))
  }

  // Bulk-insert scenes (used after AI storyboard generation).
  // Clears any existing scenes for the project first.
  async function replaceScenes(sceneList) {
    const { error: delError } = await supabase
      .from('freks_scenes')
      .delete()
      .eq('project_id', projectId)
    if (delError) throw new Error(delError.message)
    if (!sceneList.length) {
      setScenes([])
      return []
    }
    const rows = sceneList.map((s, i) => ({
      project_id: projectId,
      order_index: i,
      description: s.description ?? '',
      visual_prompt: s.visual_prompt ?? '',
      status: 'pending',
    }))
    const { data, error } = await supabase.from('freks_scenes').insert(rows).select()
    if (error) throw new Error(error.message)
    setScenes(data ?? [])
    return data ?? []
  }

  return { scenes, loading, error, load, createScene, updateScene, deleteScene, replaceScenes }
}
