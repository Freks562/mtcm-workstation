const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function getSystemPrompt(moduleName?: string) {
  if (!moduleName) {
    return 'You are JamalAI Gateway for the MTCM workstation. Route freeform prompts helpfully and directly.'
  }

  switch (moduleName) {
    case 'crm':
      return 'You are JamalAI Gateway for CRM. Help summarize contacts, deals, outreach, and follow-ups.'
    case 'telemarketing':
      return 'You are JamalAI Gateway for Telemarketing. Help with call scripts, call outcomes, campaign suggestions, and next actions.'
    case 'dotmail':
      return 'You are JamalAI Gateway for Dotmail. Help draft emails, improve subject lines, and organize campaign messaging.'
    case 'analytics':
      return 'You are JamalAI Gateway for Analytics. Help summarize metrics, trends, and operational performance.'
    default:
      return 'You are JamalAI Gateway for the MTCM workstation. Be practical and concise.'
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    const body = await req.json()
    const prompt = typeof body?.prompt === 'string' ? body.prompt.trim() : ''
    const moduleName = typeof body?.module === 'string' ? body.module.trim() : ''
    const task = typeof body?.task === 'string' ? body.task.trim() : ''
    const data = body?.data ?? null

    const apiKey = Deno.env.get('AI_API_KEY')
    const baseUrl = Deno.env.get('AI_BASE_URL') ?? 'https://api.openai.com/v1'
    const model = Deno.env.get('AI_MODEL') ?? 'gpt-4o-mini'

    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'Missing AI_API_KEY secret' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    let userContent = ''
    let route = 'brain'

    if (moduleName || task) {
      route = 'assist'
      userContent = `Task: ${task || 'Help with this module'}\n\nModule: ${moduleName || 'general'}\n\nData:\n${JSON.stringify(data, null, 2)}`
    } else if (prompt) {
      route = 'brain'
      userContent = prompt
    } else {
      return new Response(JSON.stringify({ error: 'prompt or module/task is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const aiRes = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: getSystemPrompt(moduleName || undefined) },
          { role: 'user', content: userContent },
        ],
        temperature: 0.4,
      }),
    })

    const raw = await aiRes.text()

    if (!aiRes.ok) {
      return new Response(JSON.stringify({
        error: 'AI provider request failed',
        status: aiRes.status,
        details: raw,
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const json = JSON.parse(raw)
    const reply = json?.choices?.[0]?.message?.content ?? ''

    return new Response(JSON.stringify({
      route,
      module: moduleName || null,
      task: task || null,
      prompt: prompt || null,
      reply,
      model,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(JSON.stringify({
      error: error?.message ?? 'Unknown server error',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
