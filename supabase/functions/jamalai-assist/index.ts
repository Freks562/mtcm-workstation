const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function getSystemPrompt(moduleName: string) {
  switch (moduleName) {
    case 'crm':
      return 'You are JamalAI Assist for CRM. Help summarize contacts, deals, outreach, and follow-ups.'
    case 'telemarketing':
      return 'You are JamalAI Assist for Telemarketing. Help with call scripts, call outcomes, campaign suggestions, and next actions.'
    case 'dotmail':
      return 'You are JamalAI Assist for Dotmail. Help draft emails, improve subject lines, and organize campaign messaging.'
    case 'analytics':
      return 'You are JamalAI Assist for Analytics. Help summarize metrics, trends, and operational performance.'
    default:
      return 'You are JamalAI Assist for the MTCM workstation. Be practical and concise.'
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
    const moduleName = typeof body?.module === 'string' ? body.module.trim() : ''
    const task = typeof body?.task === 'string' ? body.task.trim() : ''
    const data = body?.data ?? null

    if (!moduleName) {
      return new Response(JSON.stringify({ error: 'module is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!task) {
      return new Response(JSON.stringify({ error: 'task is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const apiKey = Deno.env.get('AI_API_KEY')
    const baseUrl = Deno.env.get('AI_BASE_URL') ?? 'https://api.openai.com/v1'
    const model = Deno.env.get('AI_MODEL') ?? 'gpt-4o-mini'

    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'Missing AI_API_KEY secret' }), {
        status: 500,
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
          { role: 'system', content: getSystemPrompt(moduleName) },
          {
            role: 'user',
            content: `Task: ${task}\n\nModule: ${moduleName}\n\nData:\n${JSON.stringify(data, null, 2)}`,
          },
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
      route: 'assist',
      module: moduleName,
      task,
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
