// Supabase Edge Function: freksframe-render
// ────────────────────────────────────────────────────────────────────────────
// MVP render worker for the FreksFrame module.
//
// Accepts a render job row ID (render_id).  The job row must already exist in
// freks_renders with status = 'queued'.  The function:
//
//   1. Marks the render as 'processing'.
//   2. Loads the project and its scenes from Supabase.
//   3. Builds a render manifest (JSON) that describes every scene + audio.
//   4. Uploads the manifest to the freks-assets Storage bucket.
//   5. Marks the render 'completed' and stores the manifest_url.
//      (When a real FFmpeg / Remotion worker is attached it can read the
//       manifest and set render_url to the finished video URL.)
//   6. On any error, marks the render 'failed' and stores the error text.
//
// Invoke from the frontend or a webhook:
//   supabase.functions.invoke('freksframe-render', {
//     body: { render_id: '<uuid>' }
//   })
//
// Required Supabase secrets / environment:
//   SUPABASE_URL      – set automatically in the Edge Function runtime
//   SUPABASE_SERVICE_ROLE_KEY – set automatically in the Edge Function runtime
//
// Storage convention (same bucket used for audio uploads):
//   freks-assets / freksframe/{project_id}/renders/{render_id}/manifest.json
//
// Extending for real video generation:
//   Replace the TODO block below with a call to an external render service
//   (e.g. Remotion Lambda, FFmpeg worker, Replicate) and then update
//   freks_renders.render_url when the video is ready.
// ────────────────────────────────────────────────────────────────────────────

import { serve }        from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface FreksProject {
  id:        string
  title:     string
  lyrics:    string
  audio_url: string | null
  style:     string
  status:    string
}

interface FreksScene {
  id:           string
  order_index:  number
  description:  string
  visual_prompt: string
  image_url:    string | null
  clip_url:     string | null
  status:       string
}

interface FreksRender {
  id:         string
  project_id: string
  format:     string
  status:     string
}

interface RenderManifest {
  version:    '1'
  render_id:  string
  project_id: string
  format:     string
  style:      string
  audio_url:  string | null
  scenes:     Array<{
    index:         number
    description:   string
    visual_prompt: string
    image_url:     string | null
    clip_url:      string | null
  }>
  generated_at: string
  note:         string
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
  let renderId: string
  try {
    const body = await req.json()
    if (typeof body?.render_id !== 'string' || !body.render_id.trim()) {
      throw new Error('render_id is required')
    }
    renderId = body.render_id.trim()
  } catch (err) {
    return new Response(
      JSON.stringify({ error: `Invalid request body: ${(err as Error).message}` }),
      { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    )
  }

  // ── Supabase admin client (service role, bypasses RLS) ────────────────────
  const supabaseUrl    = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(
      JSON.stringify({ error: 'SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not configured.' }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    )
  }

  const sb = createClient(supabaseUrl, serviceRoleKey)

  // ── Helper: mark render failed ────────────────────────────────────────────
  async function failRender(id: string, errorMsg: string) {
    await sb.from('freks_renders').update({ status: 'failed', error: errorMsg }).eq('id', id)
  }

  // ── Load render row ────────────────────────────────────────────────────────
  const { data: render, error: renderErr } = await sb
    .from('freks_renders')
    .select('id, project_id, format, status')
    .eq('id', renderId)
    .single<FreksRender>()

  if (renderErr || !render) {
    return new Response(
      JSON.stringify({ error: `Render job not found: ${renderErr?.message ?? 'null'}` }),
      { status: 404, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    )
  }

  if (render.status !== 'queued') {
    return new Response(
      JSON.stringify({ error: `Render is not in 'queued' state (current: ${render.status}).` }),
      { status: 409, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    )
  }

  // ── Mark processing ────────────────────────────────────────────────────────
  const { error: processingErr } = await sb
    .from('freks_renders')
    .update({ status: 'processing' })
    .eq('id', renderId)

  if (processingErr) {
    return new Response(
      JSON.stringify({ error: `Failed to mark render processing: ${processingErr.message}` }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    )
  }

  try {
    // ── Load project ──────────────────────────────────────────────────────
    const { data: project, error: projectErr } = await sb
      .from('freks_projects')
      .select('id, title, lyrics, audio_url, style, status')
      .eq('id', render.project_id)
      .single<FreksProject>()

    if (projectErr || !project) {
      throw new Error(`Project not found: ${projectErr?.message ?? 'null'}`)
    }

    // ── Load scenes ───────────────────────────────────────────────────────
    const { data: scenes, error: scenesErr } = await sb
      .from('freks_scenes')
      .select('id, order_index, description, visual_prompt, image_url, clip_url, status')
      .eq('project_id', render.project_id)
      .order('order_index', { ascending: true })

    if (scenesErr) {
      throw new Error(`Failed to load scenes: ${scenesErr.message}`)
    }

    const sceneList = (scenes ?? []) as FreksScene[]

    // ── Build render manifest ─────────────────────────────────────────────
    const manifest: RenderManifest = {
      version:    '1',
      render_id:  renderId,
      project_id: render.project_id,
      format:     render.format,
      style:      project.style,
      audio_url:  project.audio_url ?? null,
      scenes:     sceneList.map((s) => ({
        index:         s.order_index,
        description:   s.description,
        visual_prompt: s.visual_prompt,
        image_url:     s.image_url ?? null,
        clip_url:      s.clip_url  ?? null,
      })),
      generated_at: new Date().toISOString(),
      note: 'MVP manifest. Attach a render worker (FFmpeg/Remotion) to produce the final video.',
    }

    const manifestJson  = JSON.stringify(manifest, null, 2)
    const storagePath   = `freksframe/${render.project_id}/renders/${renderId}/manifest.json`

    // ── Upload manifest to Storage ────────────────────────────────────────
    const { error: uploadErr } = await sb.storage
      .from('freks-assets')
      .upload(storagePath, manifestJson, {
        contentType: 'application/json',
        upsert: true,
      })

    if (uploadErr) {
      throw new Error(`Storage upload failed: ${uploadErr.message}`)
    }

    const { data: urlData } = sb.storage
      .from('freks-assets')
      .getPublicUrl(storagePath)

    const manifestUrl = urlData?.publicUrl ?? null

    // ── TODO: Dispatch to real render worker here ─────────────────────────
    // When a video renderer (FFmpeg Lambda, Remotion, Replicate, etc.) is
    // available, invoke it here and pass it the manifest URL.  Update
    // freks_renders.render_url once the video is ready.
    // For now we complete immediately with only the manifest URL.

    // ── Mark completed ────────────────────────────────────────────────────
    await sb
      .from('freks_renders')
      .update({ status: 'completed', manifest_url: manifestUrl })
      .eq('id', renderId)

    // ── Update project status ─────────────────────────────────────────────
    await sb
      .from('freks_projects')
      .update({ status: 'done' })
      .eq('id', render.project_id)

    return new Response(
      JSON.stringify({
        success:      true,
        render_id:    renderId,
        manifest_url: manifestUrl,
        scene_count:  sceneList.length,
        format:       render.format,
      }),
      { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    // Extract only the message string; never expose the full stack trace externally.
    const message = err instanceof Error ? err.message : String(err)
    await failRender(renderId, message)

    return new Response(
      JSON.stringify({ error: 'Render processing failed. Check the render record for details.' }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    )
  }
})
