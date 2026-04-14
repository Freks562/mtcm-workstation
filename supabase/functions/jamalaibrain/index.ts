const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
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
    const { prompt, context } = await req.json()

    if (!prompt || typeof prompt !== 'string') {
      return new Response(JSON.stringify({ error: 'Missing prompt' }), {
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

    const system = context && typeof context === 'string'
      ? `You are JamalAIBrain for the MTCM workstation.\n\nContext:\n${context}`
      : 'You are JamalAIBrain for the MTCM workstation. Be helpful, direct, and practical.'

    const aiRes = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: prompt },
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
      reply,
      model,
      prompt,
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
