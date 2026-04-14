// Supabase Edge Function: jamalai-assist
// ────────────────────────────────────────────────────────────────────────────
// Module-specific AI assistant for the MTCM Workstation.  Provides focused,
// context-aware AI help for each module (CRM, Telemarketing, Dotmail,
// Analytics).  Unlike jamalaibrain (general chat), this function receives a
// structured request with a module name and optional data context so the AI
// can give actionable, data-grounded answers.
//
// Invoke from the frontend:
//   const { data, error } = await supabase.functions.invoke('jamalai-assist', {
//     body: {
//       module: 'crm',           // 'crm' | 'telemarketing' | 'dotmail' | 'analytics'
//       task: 'draft_email',     // free-form task description
//       data: { ... },           // optional structured data (e.g. a contact object)
//     },
//   })
//
// Required Supabase secrets (same as jamalaibrain):
//   AI_API_KEY   – API key for your chosen provider
//   AI_BASE_URL  – Base URL of the OpenAI-compatible endpoint
//   AI_MODEL     – Model name
// ────────────────────────────────────────────────────────────────────────────

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

type Module = 'crm' | 'telemarketing' | 'dotmail' | 'analytics'

const MODULE_SYSTEM_PROMPTS: Record<Module, string> = {
  crm: `You are a CRM assistant for the MTCM Workstation.
You help sales and operations teams manage contacts, track deals through pipeline stages
(lead, qualified, proposal, negotiation, closed_won, closed_lost), and draft outreach.
When given contact or deal data, use it to give specific, actionable advice.
Keep responses brief and practical.`,

  telemarketing: `You are a telemarketing assistant for the MTCM Workstation.
You help agents manage call queues, write call scripts, log outcomes, and run campaigns.
You understand call statuses (pending, called, no_answer, callback, do_not_call) and
campaign types. Give concise scripts and practical coaching tips.`,

  dotmail: `You are an email campaign assistant for the MTCM Workstation.
You help write email templates, compose campaign messages, and suggest subject lines.
When given a template or campaign brief, produce ready-to-send copy that is professional
and persuasive. Keep subject lines under 60 characters.`,

  analytics: `You are an analytics assistant for the MTCM Workstation.
You help interpret CRM pipeline metrics, call volume trends, email campaign performance,
and overall workstation activity. When given data, summarize key insights and highlight
anomalies or opportunities. Be concise and use plain language.`,
}

const FALLBACK_SYSTEM_PROMPT = `You are an AI assistant for the MTCM Workstation.
Help the user with their request concisely and professionally.`

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed. Use POST.' }),
      { status: 405, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    )
  }

  // ── Parse request ──────────────────────────────────────────────────────
  let module: string
  let task: string
  let data: unknown
  try {
    const body = await req.json()
    module = typeof body?.module === 'string' ? body.module.trim() : ''
    task = body?.task
    data = body?.data
    if (!module) {
      throw new Error('module is required (crm | telemarketing | dotmail | analytics)')
    }
    if (typeof task !== 'string' || task.trim() === '') {
      throw new Error('task is required')
    }
  } catch (err) {
    return new Response(
      JSON.stringify({ error: `Invalid request body: ${(err as Error).message}` }),
      { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    )
  }

  // ── Validate secrets ───────────────────────────────────────────────────
  const apiKey = Deno.env.get('AI_API_KEY')
  const baseUrl = Deno.env.get('AI_BASE_URL') ?? 'https://api.openai.com/v1'
  const model = Deno.env.get('AI_MODEL') ?? 'gpt-4o-mini'

  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: 'AI_API_KEY secret is not configured.' }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    )
  }

  // ── Build messages ─────────────────────────────────────────────────────
  const systemPrompt = MODULE_SYSTEM_PROMPTS[module as Module] ?? FALLBACK_SYSTEM_PROMPT

  const userContent = data
    ? `${task.trim()}\n\nContext data:\n${JSON.stringify(data, null, 2)}`
    : task.trim()

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userContent },
  ]

  // ── Call AI provider ───────────────────────────────────────────────────
  let aiResponse: Response
  try {
    aiResponse = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: 1024,
        temperature: 0.4,
      }),
    })
  } catch (err) {
    return new Response(
      JSON.stringify({ error: `Failed to reach AI provider: ${(err as Error).message}` }),
      { status: 502, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    )
  }

  if (!aiResponse.ok) {
    let detail = `AI provider returned HTTP ${aiResponse.status}`
    try {
      const body = await aiResponse.json()
      detail = body?.error?.message ?? detail
    } catch (_) { /* ignore */ }
    return new Response(
      JSON.stringify({ error: detail }),
      { status: 502, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    )
  }

  const completion = await aiResponse.json()
  const reply: string = completion?.choices?.[0]?.message?.content ?? ''

  return new Response(
    JSON.stringify({ reply, module, task, model }),
    { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
  )
})
