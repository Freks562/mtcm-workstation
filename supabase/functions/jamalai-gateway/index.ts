// Supabase Edge Function: jamalai-gateway
// ----------------------------------------------------------------------------
// Single entry-point gateway for all JamalAI requests.
//
// The frontend can call one function instead of choosing between jamalaibrain
// and jamalai-assist.  The gateway inspects the payload and routes internally:
//
//   * If `module` is present -> delegates to jamalai-assist logic (module-aware)
//   * Otherwise              -> delegates to jamalaibrain logic (general chat)
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
//   AI_API_KEY   - API key for your chosen provider
//   AI_BASE_URL  - Base URL of the OpenAI-compatible endpoint
//   AI_MODEL     - Model name
// ----------------------------------------------------------------------------

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// -- Shared helpers ---------------------------------------------------------

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

// -- Brain system prompt ----------------------------------------------------

const BRAIN_SYSTEM = `You are JamalAIBrain, the intelligent assistant for the MTCM Workstation.
You help operations teams manage CRM contacts and deals, run telemarketing campaigns,
draft and send emails through Dotmail, and understand analytics data.
Respond concisely and professionally. When asked to take an action you cannot perform
directly, explain what the user should do in the UI instead.`

// -- Assist system prompts --------------------------------------------------

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

  grants: `You are a VA Grants and Opportunities assistant for the MTCM Workstation.
You help users understand VA funding announcements, grants, contracts, and programs from
the Department of Veterans Affairs and related federal agencies.
When given an opportunity record, explain what it is, who qualifies, likely next steps
to apply or partner, and how it connects to veteran contacts or CRM deals.
When given a list of contacts, identify which veterans may benefit most and why.
Be specific, practical, and encouraging. Use plain language — no jargon.`,

  freksframe: `You are a creative director AI for FreksFrame, the AI lyric-video storyboard studio
inside the MTCM Workstation.
When asked to generate a storyboard, you receive song lyrics and a visual style.
Your job is to break the lyrics into logical scenes and return a JSON array - nothing else.
Each element must have exactly two keys:
  "description"   - one sentence describing what happens / is shown in the scene
  "visual_prompt" - a concise image-generation prompt (<= 40 words) matching the style

Rules:
- Return ONLY a raw JSON array. Do NOT wrap it in markdown code fences.
- Do NOT include any explanation, preamble, or commentary outside the JSON.
- One scene per meaningful lyric line or couplet; aim for 4-16 scenes total.
- Prompts must be evocative, cinematic, and reference the requested style.
- If lyrics are empty or nonsensical, return an empty array [].`,
}

const ASSIST_FALLBACK = `You are an AI assistant for the MTCM Workstation.
Help the user with their request concisely and professionally.`

// Storyboard generation AI parameters
const STORYBOARD_MAX_TOKENS = 2048
const STORYBOARD_TEMPERATURE = 0.6

// -- FreksFrame structured-output handler --------------------------------------
//
// For module=freksframe + task=generate_storyboard the AI must return a JSON
// array of scenes.  This function calls the AI, strips any accidental markdown
// fences, parses the JSON, validates the shape, and returns the scenes array.

async function generateStoryboard(
  lyrics: string,
  style: string,
  apiKey: string,
  baseUrl: string,
  model: string,
): Promise<{ scenes: Array<{ description: string; visual_prompt: string }>; raw: string }> {
  const systemPrompt = ASSIST_PROMPTS['freksframe']
  const userContent =
    `Generate a storyboard for the following song lyrics.\nVisual style: ${style}\n\nLyrics:\n${lyrics}`

  const aiResult = await callAI(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent },
    ],
    apiKey,
    baseUrl,
    model,
    STORYBOARD_MAX_TOKENS,
    STORYBOARD_TEMPERATURE,
  )

  if ('error' in aiResult) throw aiResult.error

  const raw = aiResult.reply.trim()

  // AI models sometimes wrap JSON in markdown code fences (```json ... ```) even
  // when instructed not to.  Strip the opening and closing fence if present.
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim()

  let parsed: unknown
  try {
    parsed = JSON.parse(cleaned)
  } catch (_) {
    const preview = raw.length > 300 ? `${raw.slice(0, 300)}...` : raw
    throw `AI returned malformed JSON. Raw response:\n${preview}`
  }

  if (!Array.isArray(parsed)) {
    throw `AI response is not a JSON array. Got: ${typeof parsed}`
  }

  const scenes = (parsed as unknown[]).map((item, i) => {
    if (typeof item !== 'object' || item === null) {
      throw `Scene ${i} is not an object`
    }
    const s = item as Record<string, unknown>
    if (typeof s.description !== 'string' || typeof s.visual_prompt !== 'string') {
      throw `Scene ${i} is missing description or visual_prompt`
    }
    return {
      description: (s.description as string).trim(),
      visual_prompt: (s.visual_prompt as string).trim(),
    }
  })

  return { scenes, raw }
}

// -- Main handler -----------------------------------------------------------

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

  // -- Parse body ---------------------------------------------------------
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch (_) {
    return new Response(
      JSON.stringify({ error: 'Invalid JSON body.' }),
      { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    )
  }

  // -- Validate secrets ---------------------------------------------------
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

  // -- Route: module-assist -----------------------------------------------
  if (module !== null) {
    const task = typeof body.task === 'string' ? body.task.trim() : ''
    if (!task) {
      return new Response(
        JSON.stringify({ error: 'task is required when module is provided.' }),
        { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      )
    }

    // -- FreksFrame: generate_storyboard ---------------------------------
    if (module === 'freksframe' && task === 'generate_storyboard') {
      const data = body.data as Record<string, unknown> | undefined
      const lyrics = typeof data?.lyrics === 'string' ? data.lyrics.trim() : ''
      const style  = typeof data?.style  === 'string' ? data.style.trim()  : 'cinematic'

      if (!lyrics) {
        return new Response(
          JSON.stringify({ error: 'data.lyrics is required for generate_storyboard.' }),
          { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
        )
      }

      try {
        const { scenes, raw } = await generateStoryboard(lyrics, style, apiKey, baseUrl, model)
        return new Response(
          JSON.stringify({ scenes, module, task, model, route: 'freksframe_storyboard', raw }),
          { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
        )
      } catch (err) {
        // Return a safe, generic message to the client.  The detailed cause is
        // a string we built ourselves (never a raw stack trace) because
        // generateStoryboard() only throws string literals or AI-provider
        // error text.  Log the full detail server-side for debugging.
        const detail = typeof err === 'string' ? err : (err as Error).message
        console.error('[freksframe/generate_storyboard] error:', detail)
        return new Response(
          JSON.stringify({ error: 'Storyboard generation failed. Please try again.' }),
          { status: 502, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
        )
      }
    }

    // -- All other module-assist requests ---------------------------------
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

  // -- Route: brain (general chat) ----------------------------------------
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
