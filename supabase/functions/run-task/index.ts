// Supabase Edge Function: run-task
// ────────────────────────────────────────────────────────────────────────────
// Unified task-engine entry-point for the MTCM Glass Workstation.
//
// Every action in the OS goes through this one function so that:
//   • all executions are logged to task_runs for audit / replay
//   • the frontend calls one predictable endpoint regardless of task type
//   • new task types can be added here without touching the UI
//
// Supported tasks
// ───────────────
//   create_opportunity  – insert a deal into the CRM pipeline
//   advance_deal        – move a deal to the next pipeline stage
//   create_contact      – insert a contact record
//   create_task         – insert a task assigned to the caller
//   complete_task       – mark a task completed
//   draft_email         – create a queued email record
//   generate_proposal   – call the AI to produce a proposal draft, save as email
//   refresh_analytics   – recompute today's analytics_snapshots row
//
// Request shape
// ─────────────
//   POST /functions/v1/run-task
//   Authorization: Bearer <user JWT>  (or service-role key for server triggers)
//   {
//     "task":    "<task name>",
//     "payload": { /* task-specific fields, see each handler below */ }
//   }
//
// Response shape
// ──────────────
//   200 { success: true,  task, result: { … } }
//   400 { success: false, task, error: "…" }          – bad input
//   500 { success: false, task, error: "…" }          – unexpected error
//
// Environment / secrets
// ─────────────────────
//   SUPABASE_URL              – injected automatically
//   SUPABASE_SERVICE_ROLE_KEY – injected automatically
//   AI_API_KEY                – OpenAI-compatible key (only for generate_proposal)
//   AI_BASE_URL               – e.g. https://api.openai.com/v1
//   AI_MODEL                  – e.g. gpt-4o
// ────────────────────────────────────────────────────────────────────────────

import { serve }        from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ── Constants ─────────────────────────────────────────────────────────────────

const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// Deal pipeline stages in order – used by advance_deal
const DEAL_STAGES = [
  'prospecting',
  'qualification',
  'proposal',
  'negotiation',
  'closed_won',
] as const

// ── Helpers ───────────────────────────────────────────────────────────────────

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}

function errorResponse(task: string, message: string, status = 400): Response {
  return jsonResponse({ success: false, task, error: message }, status)
}

// ── Task handlers ─────────────────────────────────────────────────────────────

/**
 * create_opportunity
 * Inserts a new deal into the CRM pipeline.
 *
 * payload: { title, value?, stage?, contact_id?, owner_id? }
 */
async function createOpportunity(
  supabase: ReturnType<typeof createClient>,
  payload: Record<string, unknown>,
  userId: string,
): Promise<Record<string, unknown>> {
  const title = payload.title as string | undefined
  if (!title?.trim()) throw new Error('payload.title is required')

  const { data, error } = await supabase
    .from('deals')
    .insert({
      title:      title.trim(),
      value:      (payload.value as number | undefined) ?? 0,
      stage:      (payload.stage as string | undefined) ?? 'prospecting',
      contact_id: (payload.contact_id as string | undefined) ?? null,
      owner_id:   (payload.owner_id as string | undefined) ?? userId,
    })
    .select('id, title, stage, value')
    .single()

  if (error) throw new Error(error.message)
  return { deal: data }
}

/**
 * advance_deal
 * Moves a deal one stage forward in the pipeline.
 *
 * payload: { deal_id }
 */
async function advanceDeal(
  supabase: ReturnType<typeof createClient>,
  payload: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const dealId = payload.deal_id as string | undefined
  if (!dealId) throw new Error('payload.deal_id is required')

  const { data: deal, error: fetchError } = await supabase
    .from('deals')
    .select('id, stage')
    .eq('id', dealId)
    .single()

  if (fetchError) throw new Error(fetchError.message)
  if (!deal)      throw new Error('Deal not found')

  const currentIndex = DEAL_STAGES.indexOf(deal.stage as typeof DEAL_STAGES[number])
  if (currentIndex === -1)                          throw new Error(`Unknown stage: ${deal.stage}`)
  if (currentIndex === DEAL_STAGES.length - 1)      throw new Error('Deal is already at the final stage')

  const nextStage = DEAL_STAGES[currentIndex + 1]

  const { data: updated, error: updateError } = await supabase
    .from('deals')
    .update({ stage: nextStage, ...(nextStage === 'closed_won' ? { closed_at: new Date().toISOString() } : {}) })
    .eq('id', dealId)
    .select('id, title, stage')
    .single()

  if (updateError) throw new Error(updateError.message)
  return { deal: updated, previous_stage: deal.stage, next_stage: nextStage }
}

/**
 * create_contact
 * Inserts a new contact into the CRM.
 *
 * payload: { first_name, last_name, email?, phone?, company?, status? }
 */
async function createContact(
  supabase: ReturnType<typeof createClient>,
  payload: Record<string, unknown>,
  userId: string,
): Promise<Record<string, unknown>> {
  const firstName = (payload.first_name as string | undefined)?.trim()
  const lastName  = (payload.last_name  as string | undefined)?.trim()
  if (!firstName) throw new Error('payload.first_name is required')
  if (!lastName)  throw new Error('payload.last_name is required')

  const { data, error } = await supabase
    .from('contacts')
    .insert({
      first_name: firstName,
      last_name:  lastName,
      email:      (payload.email   as string | undefined) ?? null,
      phone:      (payload.phone   as string | undefined) ?? null,
      company:    (payload.company as string | undefined) ?? null,
      status:     (payload.status  as string | undefined) ?? 'lead',
      owner_id:   userId,
    })
    .select('id, first_name, last_name, email, status')
    .single()

  if (error) throw new Error(error.message)
  return { contact: data }
}

/**
 * create_task
 * Creates an action-item task assigned to the caller (or an explicit assignee).
 *
 * payload: { title, description?, due_at?, contact_id?, deal_id?, assigned_to? }
 */
async function createTask(
  supabase: ReturnType<typeof createClient>,
  payload: Record<string, unknown>,
  userId: string,
): Promise<Record<string, unknown>> {
  const title = (payload.title as string | undefined)?.trim()
  if (!title) throw new Error('payload.title is required')

  const { data, error } = await supabase
    .from('tasks')
    .insert({
      title,
      description:  (payload.description as string | undefined) ?? null,
      due_at:       (payload.due_at      as string | undefined) ?? null,
      contact_id:   (payload.contact_id  as string | undefined) ?? null,
      deal_id:      (payload.deal_id     as string | undefined) ?? null,
      assigned_to:  (payload.assigned_to as string | undefined) ?? userId,
      completed:    false,
    })
    .select('id, title, due_at, assigned_to')
    .single()

  if (error) throw new Error(error.message)
  return { task: data }
}

/**
 * complete_task
 * Marks an existing task as completed.
 *
 * payload: { task_id }
 */
async function completeTask(
  supabase: ReturnType<typeof createClient>,
  payload: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const taskId = payload.task_id as string | undefined
  if (!taskId) throw new Error('payload.task_id is required')

  const { data, error } = await supabase
    .from('tasks')
    .update({ completed: true })
    .eq('id', taskId)
    .select('id, title, completed')
    .single()

  if (error) throw new Error(error.message)
  if (!data)  throw new Error('Task not found')
  return { task: data }
}

/**
 * draft_email
 * Creates a queued email record (does NOT send – use send-emails for dispatch).
 *
 * payload: { subject, body, contact_id?, campaign_id?, template_id? }
 */
async function draftEmail(
  supabase: ReturnType<typeof createClient>,
  payload: Record<string, unknown>,
  userId: string,
): Promise<Record<string, unknown>> {
  const subject = (payload.subject as string | undefined)?.trim()
  const body    = (payload.body    as string | undefined)?.trim()
  if (!subject) throw new Error('payload.subject is required')
  if (!body)    throw new Error('payload.body is required')

  const { data, error } = await supabase
    .from('emails')
    .insert({
      subject,
      body,
      contact_id:  (payload.contact_id  as string | undefined) ?? null,
      campaign_id: (payload.campaign_id as string | undefined) ?? null,
      template_id: (payload.template_id as string | undefined) ?? null,
      sender_id:   userId,
      direction:   'outbound',
      status:      'queued',
    })
    .select('id, subject, status')
    .single()

  if (error) throw new Error(error.message)
  return { email: data }
}

/**
 * generate_proposal
 * Asks the AI to produce a proposal draft given a deal or opportunity context,
 * then saves the result as a queued email draft.
 *
 * payload: {
 *   deal_id?,          – if provided, deal info is fetched and injected into the prompt
 *   contact_id?,       – likewise for contact name / company
 *   context?,          – free-text context (e.g. RFP summary, key requirements)
 *   tone?              – "professional" | "friendly" | "formal"  (default: professional)
 * }
 */
async function generateProposal(
  supabase: ReturnType<typeof createClient>,
  payload: Record<string, unknown>,
  userId: string,
): Promise<Record<string, unknown>> {
  const apiKey  = Deno.env.get('AI_API_KEY')
  const baseUrl = Deno.env.get('AI_BASE_URL') ?? 'https://api.openai.com/v1'
  const model   = Deno.env.get('AI_MODEL')    ?? 'gpt-4o'

  // Build context block from optional DB lookups
  const contextParts: string[] = []

  if (payload.deal_id) {
    const { data: deal } = await supabase
      .from('deals')
      .select('title, value, stage')
      .eq('id', payload.deal_id as string)
      .single()
    if (deal) {
      contextParts.push(
        `Deal: "${deal.title}" | Value: $${deal.value} | Stage: ${deal.stage}`,
      )
    }
  }

  if (payload.contact_id) {
    const { data: contact } = await supabase
      .from('contacts')
      .select('first_name, last_name, company')
      .eq('id', payload.contact_id as string)
      .single()
    if (contact) {
      contextParts.push(
        `Contact: ${contact.first_name} ${contact.last_name}` +
        (contact.company ? ` at ${contact.company}` : ''),
      )
    }
  }

  if (payload.context) {
    contextParts.push(`Additional context:\n${payload.context}`)
  }

  const tone = (payload.tone as string | undefined) ?? 'professional'
  const systemPrompt = [
    'You are a skilled business development writer for MTCM (Mountain Top Construction Management).',
    `Write a ${tone} proposal email that addresses the prospect's needs and demonstrates MTCM's capabilities.`,
    'Return ONLY the email body — no subject line prefix, no extra commentary.',
    'Keep it concise (300–500 words), persuasive, and end with a clear call to action.',
  ].join(' ')

  const userPrompt = contextParts.length
    ? `Write a proposal based on this context:\n\n${contextParts.join('\n')}`
    : 'Write a general business proposal email for MTCM.'

  // Fallback: when no AI key is set, return a template placeholder
  if (!apiKey) {
    const placeholder =
      `[AI_API_KEY not configured — replace this with your proposal text]\n\n` +
      `Context provided:\n${contextParts.join('\n') || 'None'}`

    const { data: email, error } = await supabase
      .from('emails')
      .insert({
        subject:    'Proposal Draft (placeholder)',
        body:       placeholder,
        contact_id: (payload.contact_id as string | undefined) ?? null,
        sender_id:  userId,
        direction:  'outbound',
        status:     'queued',
      })
      .select('id, subject, status')
      .single()

    if (error) throw new Error(error.message)
    return { email, generated: false, note: 'AI_API_KEY not set; placeholder saved' }
  }

  // Call AI
  let aiResponse: Response
  try {
    aiResponse = await fetch(`${baseUrl}/chat/completions`, {
      method:  'POST',
      headers: {
        Authorization:  `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user',   content: userPrompt   },
        ],
        max_tokens:  800,
        temperature: 0.6,
      }),
    })
  } catch (err) {
    throw new Error(`AI provider unreachable: ${(err as Error).message}`)
  }

  if (!aiResponse.ok) {
    let detail = `AI provider returned HTTP ${aiResponse.status}`
    try {
      const b = await aiResponse.json()
      detail = b?.error?.message ?? detail
    } catch (_) { /* ignore */ }
    throw new Error(detail)
  }

  const completion = await aiResponse.json()
  const proposalBody: string = completion?.choices?.[0]?.message?.content?.trim() ?? ''

  // Derive a subject line from the context
  const dealTitle =
    payload.deal_id
      ? (await supabase.from('deals').select('title').eq('id', payload.deal_id as string).single())
          ?.data?.title
      : null
  const subject = dealTitle
    ? `Proposal: ${dealTitle}`
    : 'MTCM Proposal'

  const { data: email, error: insertError } = await supabase
    .from('emails')
    .insert({
      subject,
      body:       proposalBody,
      contact_id: (payload.contact_id as string | undefined) ?? null,
      sender_id:  userId,
      direction:  'outbound',
      status:     'queued',
    })
    .select('id, subject, status')
    .single()

  if (insertError) throw new Error(insertError.message)
  return { email, generated: true }
}

/**
 * refresh_analytics
 * Recomputes today's analytics_snapshots row from live table counts.
 * Safe to call repeatedly — uses upsert on snapshot_date.
 *
 * payload: {}  (no fields required)
 */
async function refreshAnalytics(
  supabase: ReturnType<typeof createClient>,
): Promise<Record<string, unknown>> {
  const today = new Date().toISOString().split('T')[0]

  // Parallel reads for speed
  const [
    { count: totalContacts },
    { count: totalDeals    },
    { count: dealsClosedWon },
    { data:  openDeals     },
    { count: callsMade     },
    { count: emailsSent    },
  ] = await Promise.all([
    supabase.from('contacts').select('*', { count: 'exact', head: true }),
    supabase.from('deals').select('*', { count: 'exact', head: true }),
    supabase.from('deals').select('*', { count: 'exact', head: true }).eq('stage', 'closed_won'),
    supabase.from('deals').select('value').not('stage', 'eq', 'closed_won'),
    supabase.from('call_logs').select('*', { count: 'exact', head: true }),
    supabase.from('emails').select('*', { count: 'exact', head: true }).eq('status', 'sent'),
  ])

  const openPipeline  = (openDeals ?? []).reduce((sum, d) => sum + Number(d.value ?? 0), 0)

  const { data: closedDeals } = await supabase
    .from('deals')
    .select('value')
    .eq('stage', 'closed_won')

  const revenue = (closedDeals ?? []).reduce((sum, d) => sum + Number(d.value ?? 0), 0)

  const snapshot = {
    snapshot_date:  today,
    total_contacts: totalContacts  ?? 0,
    total_deals:    totalDeals     ?? 0,
    deals_closed:   dealsClosedWon ?? 0,
    open_pipeline:  openPipeline,
    revenue,
    calls_made:     callsMade  ?? 0,
    emails_sent:    emailsSent ?? 0,
  }

  const { data, error } = await supabase
    .from('analytics_snapshots')
    .upsert(snapshot, { onConflict: 'snapshot_date' })
    .select()
    .single()

  if (error) throw new Error(error.message)
  return { snapshot: data }
}

// ── Route table ───────────────────────────────────────────────────────────────

type Handler = (
  supabase: ReturnType<typeof createClient>,
  payload:  Record<string, unknown>,
  userId:   string,
) => Promise<Record<string, unknown>>

const HANDLERS: Record<string, Handler> = {
  create_opportunity: createOpportunity,
  advance_deal:       (sb, p) => advanceDeal(sb, p),
  create_contact:     createContact,
  create_task:        createTask,
  complete_task:      (sb, p) => completeTask(sb, p),
  draft_email:        draftEmail,
  generate_proposal:  generateProposal,
  refresh_analytics:  (sb) => refreshAnalytics(sb),
}

// ── Main handler ──────────────────────────────────────────────────────────────

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  // ── Parse body ──────────────────────────────────────────────────────────────
  let task    = ''
  let payload: Record<string, unknown> = {}

  try {
    const body = await req.json()
    task    = (body.task    as string | undefined) ?? ''
    payload = (body.payload as Record<string, unknown> | undefined) ?? {}
  } catch (_) {
    return errorResponse('unknown', 'Request body must be valid JSON')
  }

  if (!task) {
    return errorResponse('unknown', '"task" field is required')
  }

  const handler = HANDLERS[task]
  if (!handler) {
    return errorResponse(task, `Unknown task "${task}". Valid tasks: ${Object.keys(HANDLERS).join(', ')}`)
  }

  // ── Build Supabase service-role client ──────────────────────────────────────
  const supabaseUrl      = Deno.env.get('SUPABASE_URL')              ?? ''
  const serviceRoleKey   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  })

  // ── Resolve caller identity ──────────────────────────────────────────────────
  // We accept both user JWTs and the service-role key.  When called from the
  // frontend the Authorization header carries the user's JWT.
  let userId = 'service'
  const authHeader = req.headers.get('Authorization') ?? ''
  if (authHeader.startsWith('Bearer ') && authHeader !== `Bearer ${serviceRoleKey}`) {
    const userClient = createClient(supabaseUrl, authHeader.replace('Bearer ', ''), {
      auth: { persistSession: false },
    })
    const { data: { user } } = await userClient.auth.getUser()
    if (user) userId = user.id
  }

  // ── Log the run (pending) ──────────────────────────────────────────────────
  const { data: runRow } = await supabase
    .from('task_runs')
    .insert({
      task,
      status:  'pending',
      user_id: userId === 'service' ? null : userId,
      payload,
    })
    .select('id')
    .single()

  const runId    = runRow?.id ?? null
  const startMs  = Date.now()

  // ── Execute ───────────────────────────────────────────────────────────────
  try {
    const result      = await handler(supabase, payload, userId)
    const durationMs  = Date.now() - startMs

    if (runId) {
      await supabase
        .from('task_runs')
        .update({ status: 'success', result, duration_ms: durationMs })
        .eq('id', runId)
    }

    return jsonResponse({ success: true, task, result, run_id: runId })

  } catch (err) {
    const message    = (err as Error).message ?? 'Unexpected error'
    const durationMs = Date.now() - startMs

    if (runId) {
      await supabase
        .from('task_runs')
        .update({ status: 'error', error_message: message, duration_ms: durationMs })
        .eq('id', runId)
    }

    // Distinguish client errors (bad input) from server errors
    const status = message.includes('not found') || message.includes('required') ? 400 : 500
    return errorResponse(task, message, status)
  }
})
