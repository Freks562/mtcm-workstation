import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../../../lib/supabase.js'
import { logEvent } from '../../../lib/logEvent.js'

export function useEmailTemplates() {
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data, error } = await supabase
      .from('email_templates')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) setError(error.message)
    else setTemplates(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function createTemplate(fields, actorId) {
    const { data, error } = await supabase
      .from('email_templates')
      .insert(fields)
      .select()
      .single()
    if (error) throw new Error(error.message)
    setTemplates((prev) => [data, ...prev])
    await logEvent({ type: 'template_created', actorId, entityType: 'email_template', entityId: data.id, metadata: { name: data.name } })
    return data
  }

  async function updateTemplate(id, fields, actorId) {
    const { data, error } = await supabase
      .from('email_templates')
      .update(fields)
      .eq('id', id)
      .select()
      .single()
    if (error) throw new Error(error.message)
    setTemplates((prev) => prev.map((t) => (t.id === id ? data : t)))
    await logEvent({ type: 'template_updated', actorId, entityType: 'email_template', entityId: id, metadata: { name: data.name } })
    return data
  }

  async function deleteTemplate(id) {
    const { error } = await supabase.from('email_templates').delete().eq('id', id)
    if (error) throw new Error(error.message)
    setTemplates((prev) => prev.filter((t) => t.id !== id))
  }

  return { templates, loading, error, load, createTemplate, updateTemplate, deleteTemplate }
}
