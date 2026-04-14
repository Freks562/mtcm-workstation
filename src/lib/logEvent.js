import { supabase } from './supabase.js'

/**
 * Write an immutable event row to the events table.
 * Errors are silently swallowed so event logging never breaks the calling flow.
 */
export async function logEvent({ type, actorId, entityType, entityId, metadata = {} }) {
  await supabase.from('events').insert({
    type,
    actor_id: actorId ?? null,
    entity_type: entityType ?? null,
    entity_id: entityId ?? null,
    metadata,
  })
}
