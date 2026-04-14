// Supabase Edge Function: jamalai-gateway
// ────────────────────────────────────────────────────────────────────────────
// Single entry-point gateway for all JamalAI requests.
//
// The frontend can call one function instead of choosing between jamalaibrain
// and jamalai-assist.  The gateway inspects the payload and routes internally:
//
//   • If `module` is present → delegates to jamalai-assist logic (module-aware)
//   • Otherwise              → delegates to jamalaibrain logic (general chat)
//
// This avoids extra network hops; the routing happens inside a single
// Deno process rather than chaining Edge Function calls.
//
// Invoke from the frontend:
//   // General chat (routes to brain logic)
//   supabase.functions.invoke('jamalai-gateway', {
//     body: { prompt: 'Summarize open deals' }
//   })
//
//   // Module-specific assist (routes to assist logic)
//   supabase.functions.invoke('jamalai-gateway', {
//     body: { module: 'crm', task: 'Draft follow-up for this contact', data: contact }
//   })
//
// Required Supabase secrets (same set as the other AI functions):
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

// ── Shared helpers ─────────────────────────────────────────────────────────

type Message = { role: string; content: string }

async function callAI(
  messages: Message[],
  apiKey: string,
  baseUrl: string,
  model: string,
  maxTokens = 1024,
  temperature = 0.35,
): Promise<{ reply: string } | { error: string; status: number }> {
  let aiResponse: Response
  try {
    aiResponse = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model, messages, max_tokens: maxTokens, temperature }),
    })
  } catch (err) {
    return { error: `Failed to reach AI provider: ${(err as Error).message}`, status: 502 }
  }

  if (!aiResponse.ok) {
    let detail = `AI provider returned HTTP ${aiResponse.status}`
    try {
      const body = await aiResponse.json()
      detail = body?.error?.message ?? detail
    } catch (_) { /* ignore */ }
    return { error: detail, status: 502 }
  }

  const completion = await aiResponse.json()
  const reply: string = completion?.choices?.[0]?.message?.content ?? ''
  return { reply }
}

// ── Brain system prompt ────────────────────────────────────────────────────

const BRAIN_SYSTEM = `You are JamalAIBrain, the intelligent assistant for the MTCM Workstation.
You help operations teams manage CRM contacts and deals, run telemarketing campaigns,
draft and send emails through Dotmail, and understand analytics data.
Respond concisely and professionally. When asked to take an action you cannot perform
directly, explain what the user should do in the UI instead.`

// ── Assist system prompts ──────────────────────────────────────────────────

const ASSIST_PROMPTS: Record<string, string> = {
  crm: `You are a CRM assistant for the MTCM Workstation.
You help sales and operations teams manage contacts, track deals, and draft outreach.
When given contact or deal data, use it to give specific, actionable advice.
Keep responses brief and practical.`,

  telemarketing: `You are a telemarketing assistant for the MTCM Workstation.
You help agents manage call queues, write call scripts, log outcomes, and run campaigns.
Give concise scripts and practical coaching tips.`,

  dotmail: `You are an email campaign assistant for the MTCM Workstation.
You help write email templates, compose campaign messages, and suggest subject lines.
Produce ready-to-send copy that is professional and persuasive.
Keep subject lines under 60 characters.`,

  analytics: `You are an analytics assistant for the MTCM Workstation.
You help interpret CRM pipeline metrics, call volume trends, email campaign performance,
and overall workstation activity. Summarize key insights and highlight anomalies.
Be concise and use plain language.`,
}

const ASSIST_FALLBACK = `You are an AI assistant for the MTCM Workstation.
Help the user with their request concisely and professionally.`

// ── Main handler ───────────────────────────────────────────────────────────

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

  // ── Parse body ─────────────────────────────────────────────────────────
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch (_) {
    return new Response(
      JSON.stringify({ error: 'Invalid JSON body.' }),
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

  const module = typeof body.module === 'string' ? body.module : null

  // ── Route: module-assist ───────────────────────────────────────────────
  if (module !== null) {
    const task = typeof body.task === 'string' ? body.task.trim() : ''
    if (!task) {
      return new Response(
        JSON.stringify({ error: 'task is required when module is provided.' }),
        { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      )
    }

    const systemPrompt = ASSIST_PROMPTS[module] ?? ASSIST_FALLBACK
    const userContent = body.data
      ? `${task}\n\nContext data:\n${JSON.stringify(body.data, null, 2)}`
      : task

    const messages: Message[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent },
    ]

    const result = await callAI(messages, apiKey, baseUrl, model, 1024, 0.4)
    if ('error' in result) {
      return new Response(
        JSON.stringify({ error: result.error }),
        { status: result.status, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      )
    }

    return new Response(
      JSON.stringify({ reply: result.reply, module, task, model, route: 'assist' }),
      { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    )
  }

  // ── Route: brain (general chat) ────────────────────────────────────────
  const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : ''
  if (!prompt) {
    return new Response(
      JSON.stringify({ error: 'prompt is required (or provide module + task for module-specific assist).' }),
      { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    )
  }

  const messages: Message[] = [
    { role: 'system', content: BRAIN_SYSTEM },
  ]

  if (typeof body.context === 'string' && body.context.trim() !== '') {
    messages.push({ role: 'system', content: `Additional context:\n${body.context.trim()}` })
  }

  messages.push({ role: 'user', content: prompt })

  const result = await callAI(messages, apiKey, baseUrl, model, 1024, 0.3)
  if ('error' in result) {
    return new Response(
      JSON.stringify({ error: result.error }),
      { status: result.status, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    )
  }

  return new Response(
    JSON.stringify({ reply: result.reply, model, prompt, route: 'brain' }),
    { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
  )
})
