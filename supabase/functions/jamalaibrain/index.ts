// Supabase Edge Function: jamalaibrain
// ────────────────────────────────────────────────────────────────────────────
// AI brain endpoint for the MTCM workstation.  Receives a user prompt and an
// optional system context string, forwards them to an OpenAI-compatible chat
// completion API, and returns a structured JSON response.
//
// Invoke from the frontend:
//   const { data, error } = await supabase.functions.invoke('jamalaibrain', {
//     body: { prompt: 'Show my open deals', context: 'optional extra context' },
//   })
//
// Required Supabase secrets (set via `supabase secrets set`):
//   AI_API_KEY    – API key for your chosen provider (OpenAI, Groq, etc.)
//   AI_BASE_URL   – Base URL of the OpenAI-compatible endpoint
//                   e.g. https://api.openai.com/v1  or  https://api.groq.com/openai/v1
//   AI_MODEL      – Model name, e.g. gpt-4o-mini  or  llama3-8b-8192
//
// CORS: this function handles the browser preflight so it can be called
// directly from the Vite dev server and production frontend.
// ────────────────────────────────────────────────────────────────────────────

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const SYSTEM_PROMPT = `You are JamalAIBrain, the intelligent assistant for the MTCM Workstation.
You help operations teams manage CRM contacts and deals, run telemarketing campaigns,
draft and send emails through Dotmail, and understand analytics data.
Respond concisely and professionally. When asked to take an action you cannot perform
directly, explain what the user should do in the UI instead.`

serve(async (req) => {
  // ── Handle CORS preflight ──────────────────────────────────────────────
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed. Use POST.' }),
      { status: 405, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    )
  }

  // ── Read and validate request body ────────────────────────────────────
  let prompt: string
  let context: string | undefined
  try {
    const body = await req.json()
    prompt = body?.prompt
    context = body?.context
    if (typeof prompt !== 'string' || prompt.trim() === '') {
      throw new Error('prompt is required')
    }
  } catch (err) {
    return new Response(
      JSON.stringify({ error: `Invalid request body: ${(err as Error).message}` }),
      { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    )
  }

  // ── Validate required secrets ──────────────────────────────────────────
  const apiKey = Deno.env.get('AI_API_KEY')
  const baseUrl = Deno.env.get('AI_BASE_URL') ?? 'https://api.openai.com/v1'
  const model = Deno.env.get('AI_MODEL') ?? 'gpt-4o-mini'

  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: 'AI_API_KEY secret is not configured.' }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    )
  }

  // ── Build messages array ───────────────────────────────────────────────
  const messages: { role: string; content: string }[] = [
    { role: 'system', content: SYSTEM_PROMPT },
  ]

  if (context && context.trim() !== '') {
    messages.push({ role: 'system', content: `Additional context:\n${context.trim()}` })
  }

  messages.push({ role: 'user', content: prompt.trim() })

  // ── Call the AI provider ───────────────────────────────────────────────
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
        temperature: 0.3,
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

  // ── Extract and return the reply ───────────────────────────────────────
  const completion = await aiResponse.json()
  const reply: string = completion?.choices?.[0]?.message?.content ?? ''

  return new Response(
    JSON.stringify({ reply, model, prompt }),
    { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
  )
})
