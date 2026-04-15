// Supabase Edge Function: freksframe-generate-scene
// ────────────────────────────────────────────────────────────────────────────
// Generates a scene image for a single FreksFrame scene.
//
// Flow:
//   1. Load the freks_scenes row (scene_id from request body).
//   2. Load the parent project to get the visual style.
//   3. Mark the scene 'generating'.
//   4. Call the image generation API with scene.visual_prompt + style.
//   5. Download the result and upload it to freks-assets Storage.
//   6. Update freks_scenes.image_url and set status → 'ready'.
//   7. On any failure, mark status → 'failed' with a safe error message.
//
// Invoke from the frontend:
//   supabase.functions.invoke('freksframe-generate-scene', {
//     body: { scene_id: '<uuid>' }
//   })
//
// Required Supabase environment (auto-injected in Edge Function runtime):
//   SUPABASE_URL              – injected automatically
//   SUPABASE_SERVICE_ROLE_KEY – injected automatically
//
// Optional secrets for real image generation:
//   IMAGE_PROVIDER – 'openai' | 'replicate' (defaults to 'demo')
//   AI_API_KEY     – OpenAI API key (when IMAGE_PROVIDER = 'openai')
//   AI_BASE_URL    – OpenAI-compatible base URL
//   REPLICATE_API_TOKEN – Replicate token (when IMAGE_PROVIDER = 'replicate')
//
// Demo mode (no secrets set):
//   Returns a deterministic SVG placeholder image so the UI round-trip can be
//   tested without real credentials.  When IMAGE_PROVIDER is set and keys are
//   present, the real provider is called instead.
//
// Storage path convention:
//   freks-assets / freksframe/{project_id}/scenes/{scene_id}.png
//
// Swap in real image generation:
//   Replace the block marked "── Image generation ──" below.  The surrounding
//   upload / status-update scaffolding stays the same.
// ────────────────────────────────────────────────────────────────────────────

import { serve }        from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface FreksScene {
  id:            string
  project_id:    string
  order_index:   number
  description:   string
  visual_prompt: string
  image_url:     string | null
  status:        string
}

interface FreksProject {
  id:    string
  style: string
}

// Replicate polling timeout (milliseconds)
const REPLICATE_POLL_TIMEOUT_MS = 60_000
// Replicate poll interval (milliseconds)
const REPLICATE_POLL_INTERVAL_MS = 2_000

// ── Demo placeholder image ────────────────────────────────────────────────────
//
// Generates a minimal SVG with the first 60 characters of the visual prompt
// embedded as text.  This lets the UI display *something* in every scene card
// without real image-generation credentials.
//
// The SVG is returned as a Uint8Array so the upload helper can treat it
// identically to real image bytes.

function buildPlaceholderSvg(visualPrompt: string, style: string): Uint8Array {
  const label  = visualPrompt.slice(0, 60) + (visualPrompt.length > 60 ? '…' : '')
  const escaped = label.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  const styleLabel = style.charAt(0).toUpperCase() + style.slice(1)

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360">
  <rect width="640" height="360" fill="#1e1b4b"/>
  <rect x="0" y="0" width="640" height="4" fill="#6366f1"/>
  <text x="320" y="150" font-family="sans-serif" font-size="13" fill="#a5b4fc" text-anchor="middle" dominant-baseline="middle">[${styleLabel} — demo placeholder]</text>
  <foreignObject x="40" y="170" width="560" height="120">
    <div xmlns="http://www.w3.org/1999/xhtml" style="font-family:sans-serif;font-size:12px;color:#c7d2fe;word-wrap:break-word;text-align:center;padding:8px;">
      ${escaped}
    </div>
  </foreignObject>
</svg>`

  return new TextEncoder().encode(svg)
}

// ── OpenAI image generation ───────────────────────────────────────────────────
//
// Uses the OpenAI images/generations endpoint (DALL-E).
// Returns raw PNG bytes.

async function generateWithOpenAI(
  visualPrompt: string,
  style: string,
  apiKey: string,
  baseUrl: string,
): Promise<Uint8Array> {
  const prompt = `${style} art style. ${visualPrompt}`

  const res = await fetch(`${baseUrl}/images/generations`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'dall-e-3',
      prompt,
      n: 1,
      size: '1024x576',
      response_format: 'url',
    }),
  })

  if (!res.ok) {
    let detail = `OpenAI images API returned HTTP ${res.status}`
    try { detail = (await res.json())?.error?.message ?? detail } catch (_) { /* ignore */ }
    throw new Error(detail)
  }

  const json = await res.json()
  const imageUrl: string = json?.data?.[0]?.url
  if (!imageUrl) throw new Error('OpenAI returned no image URL')

  const imgRes = await fetch(imageUrl)
  if (!imgRes.ok) throw new Error(`Failed to download generated image: HTTP ${imgRes.status}`)
  const buf = await imgRes.arrayBuffer()
  return new Uint8Array(buf)
}

// ── Replicate image generation ────────────────────────────────────────────────
//
// Uses the Replicate Predictions API with SDXL as the default model.
// Polls for completion (Replicate predictions are async).

async function generateWithReplicate(
  visualPrompt: string,
  style: string,
  apiToken: string,
): Promise<Uint8Array> {
  const prompt = `${style} art style, cinematic lighting, high quality. ${visualPrompt}`

  // Create prediction
  const createRes = await fetch('https://api.replicate.com/v1/models/stability-ai/sdxl/predictions', {
    method: 'POST',
    headers: {
      Authorization: `Token ${apiToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      input: {
        prompt,
        width: 1024,
        height: 576,
        num_outputs: 1,
        num_inference_steps: 25,
      },
    }),
  })

  if (!createRes.ok) {
    let detail = `Replicate API returned HTTP ${createRes.status}`
    try { detail = (await createRes.json())?.detail ?? detail } catch (_) { /* ignore */ }
    throw new Error(detail)
  }

  let prediction = await createRes.json()

  // Poll until succeeded or failed (max REPLICATE_POLL_TIMEOUT_MS)
  const deadline = Date.now() + REPLICATE_POLL_TIMEOUT_MS
  while (prediction.status !== 'succeeded' && prediction.status !== 'failed') {
    if (Date.now() > deadline) throw new Error('Replicate prediction timed out')
    await new Promise((r) => setTimeout(r, REPLICATE_POLL_INTERVAL_MS))
    const pollRes = await fetch(`https://api.replicate.com/v1/predictions/${prediction.id}`, {
      headers: { Authorization: `Token ${apiToken}` },
    })
    if (!pollRes.ok) throw new Error(`Replicate poll returned HTTP ${pollRes.status}`)
    prediction = await pollRes.json()
  }

  if (prediction.status === 'failed') {
    throw new Error(`Replicate prediction failed: ${prediction.error ?? 'unknown error'}`)
  }

  const imageUrl: string = Array.isArray(prediction.output) ? prediction.output[0] : prediction.output
  if (!imageUrl) throw new Error('Replicate returned no output URL')

  const imgRes = await fetch(imageUrl)
  if (!imgRes.ok) throw new Error(`Failed to download Replicate image: HTTP ${imgRes.status}`)
  const buf = await imgRes.arrayBuffer()
  return new Uint8Array(buf)
}

// ── Main handler ──────────────────────────────────────────────────────────────

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

  // ── Parse body ─────────────────────────────────────────────────────────────
  let sceneId: string
  try {
    const body = await req.json()
    if (typeof body?.scene_id !== 'string' || !body.scene_id.trim()) {
      throw new Error('scene_id is required')
    }
    sceneId = body.scene_id.trim()
  } catch (err) {
    return new Response(
      JSON.stringify({ error: `Invalid request body: ${(err as Error).message}` }),
      { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    )
  }

  // ── Supabase admin client ──────────────────────────────────────────────────
  const supabaseUrl    = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(
      JSON.stringify({ error: 'SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not configured.' }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    )
  }

  const sb = createClient(supabaseUrl, serviceRoleKey)

  // ── Helper: mark scene failed ──────────────────────────────────────────────
  async function failScene(id: string, msg: string) {
    await sb.from('freks_scenes').update({ status: 'failed' }).eq('id', id)
    console.error(`[freksframe-generate-scene] scene ${id} failed: ${msg}`)
  }

  // ── Load scene ─────────────────────────────────────────────────────────────
  const { data: scene, error: sceneErr } = await sb
    .from('freks_scenes')
    .select('id, project_id, order_index, description, visual_prompt, image_url, status')
    .eq('id', sceneId)
    .single<FreksScene>()

  if (sceneErr || !scene) {
    return new Response(
      JSON.stringify({ error: `Scene not found: ${sceneErr?.message ?? 'null'}` }),
      { status: 404, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    )
  }

  // ── Load parent project (for style) ───────────────────────────────────────
  const { data: project, error: projectErr } = await sb
    .from('freks_projects')
    .select('id, style')
    .eq('id', scene.project_id)
    .single<FreksProject>()

  if (projectErr || !project) {
    return new Response(
      JSON.stringify({ error: `Project not found: ${projectErr?.message ?? 'null'}` }),
      { status: 404, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    )
  }

  // ── Mark generating ────────────────────────────────────────────────────────
  const { error: markErr } = await sb
    .from('freks_scenes')
    .update({ status: 'generating' })
    .eq('id', sceneId)

  if (markErr) {
    return new Response(
      JSON.stringify({ error: `Failed to mark scene as generating: ${markErr.message}` }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    )
  }

  try {
    // ── Image generation ──────────────────────────────────────────────────
    //
    // To swap in a real provider:
    //   Set the IMAGE_PROVIDER secret to 'openai' or 'replicate' and provide
    //   the matching key (AI_API_KEY or REPLICATE_API_TOKEN).
    //   The surrounding upload + status-update code stays the same.

    const provider   = Deno.env.get('IMAGE_PROVIDER') ?? 'demo'
    const apiKey     = Deno.env.get('AI_API_KEY')
    const baseUrl    = Deno.env.get('AI_BASE_URL') ?? 'https://api.openai.com/v1'
    const repToken   = Deno.env.get('REPLICATE_API_TOKEN')

    let imageBytes: Uint8Array
    let contentType: string
    let fileExt: string

    if (provider === 'openai' && apiKey) {
      imageBytes  = await generateWithOpenAI(scene.visual_prompt, project.style, apiKey, baseUrl)
      contentType = 'image/png'
      fileExt     = 'png'
    } else if (provider === 'replicate' && repToken) {
      imageBytes  = await generateWithReplicate(scene.visual_prompt, project.style, repToken)
      contentType = 'image/png'
      fileExt     = 'png'
    } else {
      // Demo mode: deterministic SVG placeholder
      imageBytes  = buildPlaceholderSvg(scene.visual_prompt, project.style)
      contentType = 'image/svg+xml'
      fileExt     = 'svg'
    }

    // ── Upload image to Storage ───────────────────────────────────────────
    const storagePath = `freksframe/${scene.project_id}/scenes/${sceneId}.${fileExt}`

    const { error: uploadErr } = await sb.storage
      .from('freks-assets')
      .upload(storagePath, imageBytes, { contentType, upsert: true })

    if (uploadErr) throw new Error(`Storage upload failed: ${uploadErr.message}`)

    const { data: urlData } = sb.storage.from('freks-assets').getPublicUrl(storagePath)
    const imageUrl = urlData?.publicUrl ?? null

    // ── Update scene row ──────────────────────────────────────────────────
    const { error: updateErr } = await sb
      .from('freks_scenes')
      .update({ image_url: imageUrl, status: 'ready' })
      .eq('id', sceneId)

    if (updateErr) throw new Error(`Failed to update scene: ${updateErr.message}`)

    return new Response(
      JSON.stringify({
        success:    true,
        scene_id:   sceneId,
        image_url:  imageUrl,
        provider,
      }),
      { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await failScene(sceneId, message)
    return new Response(
      JSON.stringify({ error: 'Image generation failed. Check the scene record for details.' }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    )
  }
})
