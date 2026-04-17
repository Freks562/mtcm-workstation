// Supabase Edge Function: va-opportunity-feed
// ----------------------------------------------------------------------------
// Serves the VA Opportunity Feed module.  Accepts POST with optional filters
// and returns paginated va_opportunities rows from the database.
//
// When match_for_user=true the function also identifies the caller's veteran
// CRM contacts and returns lightweight match suggestions so the frontend can
// show "which of your contacts could benefit from this opportunity".
//
// Request body (all fields optional):
//   {
//     category?:      'grant' | 'contract' | 'program' | 'employment',
//     status?:        'open' | 'closed' | 'upcoming',
//     keyword?:       string,         // searched in title + description
//     page?:          number,         // 1-based, default 1
//     page_size?:     number,         // max 50, default 20
//     match_for_user?: boolean,       // if true, include veteran contact matches
//   }
//
// Response:
//   { items, matches?, page, page_size, total }
//
// Required secrets (auto-injected by Supabase):
//   SUPABASE_URL              – project URL
//   SUPABASE_SERVICE_ROLE_KEY – service role key for DB access
//   SUPABASE_ANON_KEY         – anon key for user auth context
// ----------------------------------------------------------------------------

import { serve }        from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function jsonRes(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS })
  if (req.method !== 'POST') return jsonRes({ error: 'Method not allowed. Use POST.' }, 405)

  // -- Supabase clients -----------------------------------------------------
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const anonKey     = Deno.env.get('SUPABASE_ANON_KEY') ?? ''

  // Service-role client bypasses RLS for reliable reads.
  const adminClient = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  })

  // User-aware client for identifying the caller when match_for_user=true.
  const authHeader = req.headers.get('Authorization')
  const userClient = authHeader
    ? createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
        auth:   { persistSession: false },
      })
    : null

  // -- Parse body -----------------------------------------------------------
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return jsonRes({ error: 'Invalid JSON body.' }, 400)
  }

  const category    = typeof body.category  === 'string' ? body.category.trim()  : null
  const status      = typeof body.status    === 'string' ? body.status.trim()    : null
  const keyword     = typeof body.keyword   === 'string' ? body.keyword.trim()   : null
  const page        = Math.max(1, typeof body.page      === 'number' ? Math.floor(body.page)      : 1)
  const pageSize    = Math.min(50, Math.max(1, typeof body.page_size === 'number' ? Math.floor(body.page_size) : 20))
  const matchForUser = body.match_for_user === true

  const VALID_CATEGORIES = ['grant', 'contract', 'program', 'employment']
  const VALID_STATUSES   = ['open', 'closed', 'upcoming']

  if (category && !VALID_CATEGORIES.includes(category)) {
    return jsonRes({ error: `Invalid category. Must be one of: ${VALID_CATEGORIES.join(', ')}` }, 400)
  }
  if (status && !VALID_STATUSES.includes(status)) {
    return jsonRes({ error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` }, 400)
  }

  // -- Query opportunities --------------------------------------------------
  let query = adminClient
    .from('va_opportunities')
    .select('*', { count: 'exact' })
    .order('deadline', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1)

  if (category) query = query.eq('category', category)
  if (status)   query = query.eq('status', status)
  if (keyword) {
    // Escape PostgREST special chars: % and _ are LIKE wildcards; comma splits
    // `.or()` conditions so it must also be escaped to avoid filter parse errors.
    const safe = keyword.replace(/[%_,]/g, (c) => `\\${c}`)
    query = query.or(`title.ilike.%${safe}%,description.ilike.%${safe}%`)
  }

  const { data: items, error: oppErr, count } = await query
  if (oppErr) {
    console.error('[va-opportunity-feed] query error:', oppErr.message)
    return jsonRes({ error: 'Failed to fetch opportunities.' }, 500)
  }

  // -- Optional: match for user ---------------------------------------------
  let matches: unknown[] | undefined
  if (matchForUser && userClient) {
    try {
      const { data: { user }, error: authErr } = await userClient.auth.getUser()
      if (authErr || !user) throw authErr ?? new Error('Not authenticated')

      // Fetch veteran contacts owned by this user
      const { data: veterans } = await adminClient
        .from('contacts')
        .select('id, first_name, last_name, company, status, is_veteran')
        .eq('owner_id', user.id)
        .eq('is_veteran', true)

      if (veterans && veterans.length > 0 && items && items.length > 0) {
        matches = []
        for (const opp of items) {
          if (opp.status === 'closed') continue
          for (const contact of veterans) {
            const score = opp.status === 'open' ? 0.85 : 0.5
            const reason =
              `${contact.first_name} ${contact.last_name} is a veteran contact who may qualify for ` +
              `this ${opp.category} from the ${opp.agency}.`
            matches.push({
              opportunity_id:    opp.id,
              opportunity_title: opp.title,
              contact_id:        contact.id,
              contact_name:      `${contact.first_name} ${contact.last_name}`,
              match_reason:      reason,
              match_score:       score,
            })
          }
        }
      }
    } catch (err) {
      // Matches are optional — don't fail the entire request.
      console.warn('[va-opportunity-feed] match_for_user error:', (err as Error)?.message ?? err)
      matches = []
    }
  }

  return jsonRes({
    items:     items ?? [],
    ...(matchForUser ? { matches: matches ?? [] } : {}),
    page,
    page_size: pageSize,
    total:     count ?? 0,
  })
})
