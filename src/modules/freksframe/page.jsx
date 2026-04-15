import { useState } from 'react'
import { useAuth } from '../../auth/AuthProvider.jsx'
import { supabase } from '../../lib/supabase.js'
import { cn } from '../../shared/utils/cn.js'
import { useFreksProjects } from './hooks/useFreksProjects.js'
import { useFreksScenes } from './hooks/useFreksScenes.js'
import { useFreksRenders } from './hooks/useFreksRenders.js'

// ─── constants ───────────────────────────────────────────────────────────────

const STYLE_OPTIONS = [
  { value: 'cinematic', label: 'Cinematic' },
  { value: 'anime', label: 'Anime' },
  { value: 'comic', label: 'Comic Book' },
  { value: 'watercolor', label: 'Watercolor' },
  { value: 'pixel_art', label: 'Pixel Art' },
  { value: 'dark_fantasy', label: 'Dark Fantasy' },
  { value: 'minimalist', label: 'Minimalist' },
]

const FORMAT_OPTIONS = [
  { value: 'mp4', label: 'MP4 Video' },
  { value: 'gif', label: 'Animated GIF' },
  { value: 'frames_zip', label: 'Frame Pack (ZIP)' },
]

const STATUS_BADGE = {
  draft: 'bg-gray-100 text-gray-600',
  generating: 'bg-yellow-100 text-yellow-700',
  ready: 'bg-green-100 text-green-700',
  rendering: 'bg-blue-100 text-blue-700',
  done: 'bg-indigo-100 text-indigo-700',
  failed: 'bg-red-100 text-red-600',
  queued: 'bg-gray-100 text-gray-600',
}

const SCENE_STATUS_BADGE = {
  pending: 'bg-gray-100 text-gray-500',
  generating: 'bg-yellow-100 text-yellow-700',
  ready: 'bg-green-100 text-green-700',
}

// ─── sub-components ──────────────────────────────────────────────────────────

function StatusBadge({ status, map = STATUS_BADGE }) {
  return (
    <span
      className={cn(
        'inline-block rounded-full px-2 py-0.5 text-xs font-medium capitalize',
        map[status] ?? 'bg-gray-100 text-gray-600'
      )}
    >
      {status?.replace(/_/g, ' ') ?? '—'}
    </span>
  )
}

function SectionHeading({ children, action }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-400">{children}</h2>
      {action}
    </div>
  )
}

function Card({ children, className }) {
  return (
    <div className={cn('rounded-lg border border-gray-200 bg-white p-5', className)}>
      {children}
    </div>
  )
}

function InlineError({ message }) {
  if (!message) return null
  return (
    <p className="mt-2 rounded bg-red-50 px-3 py-2 text-sm text-red-600">{message}</p>
  )
}

// ─── new-project inline form ─────────────────────────────────────────────────

function NewProjectForm({ onSave, onCancel, saving }) {
  const [title, setTitle] = useState('')
  const [error, setError] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    if (!title.trim()) { setError('Title is required.'); return }
    try {
      await onSave({ title: title.trim(), status: 'draft', lyrics: '', style: 'cinematic' })
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Project title *</label>
        <input
          autoFocus
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          placeholder="e.g. Midnight Drive"
        />
      </div>
      <InlineError message={error} />
      <div className="flex gap-3">
        <button
          type="submit"
          disabled={saving}
          className="rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {saving ? 'Creating…' : 'Create'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded px-4 py-2 text-sm text-gray-600 hover:bg-gray-100"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}

// ─── main page ───────────────────────────────────────────────────────────────

export default function FreksFramePage() {
  const { session } = useAuth()
  const actorId = session?.user?.id

  const { projects, loading: projectsLoading, error: projectsError, createProject, deleteProject } =
    useFreksProjects()

  const [selectedId, setSelectedId] = useState(null)
  const selectedProject = projects.find((p) => p.id === selectedId) ?? null

  const { scenes, loading: scenesLoading, error: scenesError, replaceScenes } =
    useFreksScenes(selectedId)
  const { renders, loading: rendersLoading, error: rendersError, createRender, load: reloadRenders } =
    useFreksRenders(selectedId)

  // UI state
  const [showNewProject, setShowNewProject] = useState(false)
  const [saving, setSaving] = useState(false)

  // Editable fields for the selected project (kept in local state, saved explicitly)
  const [lyrics, setLyrics] = useState('')
  const [audioFile, setAudioFile] = useState(null)
  const [audioUploading, setAudioUploading] = useState(false)
  const [audioUrl, setAudioUrl] = useState('')
  const [style, setStyle] = useState('cinematic')

  // Generation + render state
  const [generating, setGenerating] = useState(false)
  const [genError, setGenError] = useState(null)
  const [renderFormat, setRenderFormat] = useState('mp4')
  const [queueing, setQueueing] = useState(false)
  const [queueError, setQueueError] = useState(null)
  const [deleteError, setDeleteError] = useState(null)

  // Sync local state when the selected project changes
  function selectProject(project) {
    setSelectedId(project.id)
    setLyrics(project.lyrics ?? '')
    setStyle(project.style ?? 'cinematic')
    setAudioUrl(project.audio_url ?? '')
    setAudioFile(null)
    setGenError(null)
    setQueueError(null)
  }

  // ── handlers ──────────────────────────────────────────────────────────────

  async function handleCreateProject(fields) {
    setSaving(true)
    try {
      const project = await createProject(fields, actorId)
      setShowNewProject(false)
      selectProject(project)
    } finally {
      setSaving(false)
    }
  }

  async function handleAudioUpload(e) {
    const file = e.target.files?.[0]
    if (!file || !selectedId) return
    setAudioFile(file)
    setAudioUploading(true)
    try {
      const ext = file.name.split('.').pop()
      const path = `freksframe/${selectedId}/audio.${ext}`
      const { error: upErr } = await supabase.storage
        .from('freks-assets')
        .upload(path, file, { upsert: true })
      if (upErr) throw new Error(upErr.message)
      const { data: urlData } = supabase.storage.from('freks-assets').getPublicUrl(path)
      setAudioUrl(urlData.publicUrl)
    } catch (err) {
      setGenError(`Audio upload failed: ${err.message}`)
    } finally {
      setAudioUploading(false)
    }
  }

  async function handleSaveProject() {
    if (!selectedId) return
    setSaving(true)
    try {
      const { error } = await supabase
        .from('freks_projects')
        .update({ lyrics, style, audio_url: audioUrl })
        .eq('id', selectedId)
      if (error) throw new Error(error.message)
    } catch (err) {
      setGenError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleGenerateStoryboard() {
    if (!selectedId || !lyrics.trim()) return
    setGenerating(true)
    setGenError(null)

    // Save current inputs first
    await handleSaveProject()

    try {
      const { data, error: fnError } = await supabase.functions.invoke('jamalai-gateway', {
        body: {
          module: 'freksframe',
          task: 'generate_storyboard',
          data: { lyrics, style },
        },
      })
      if (fnError) throw fnError

      // Gateway returns { scenes: [{ description, visual_prompt }] } for this task.
      // `reply` is also present for general assist compatibility but is not used here.
      const sceneList = Array.isArray(data?.scenes) ? data.scenes : []
      if (!sceneList.length) {
        throw new Error('No scenes were generated. Try rephrasing or expanding your lyrics.')
      }
      await replaceScenes(sceneList)

      // Mark project status as ready
      await supabase.from('freks_projects').update({ status: 'ready' }).eq('id', selectedId)
    } catch (err) {
      setGenError(err?.message ?? 'Storyboard generation failed.')
    } finally {
      setGenerating(false)
    }
  }

  async function handleQueueRender() {
    if (!selectedId) return
    setQueueing(true)
    setQueueError(null)
    try {
      await createRender({ format: renderFormat }, actorId)
    } catch (err) {
      setQueueError(err.message)
    } finally {
      setQueueing(false)
    }
  }

  async function handleDeleteProject(id) {
    setDeleteError(null)
    if (!window.confirm('Delete this project and all its scenes and renders?')) return
    try {
      await deleteProject(id)
      if (selectedId === id) {
        setSelectedId(null)
        setLyrics('')
        setStyle('cinematic')
        setAudioUrl('')
        setAudioFile(null)
      }
    } catch (err) {
      setDeleteError(err.message)
    }
  }

  // ── render ─────────────────────────────────────────────────────────────────

  return (
    <div>
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">FreksFrame</h1>
        <p className="mt-1 text-sm text-gray-500">
          AI-powered lyric video storyboard studio — create projects, generate scenes, export renders.
        </p>
      </div>

      {/* ── Projects panel ── */}
      <SectionHeading
        action={
          !showNewProject && (
            <button
              onClick={() => setShowNewProject(true)}
              className="rounded bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
            >
              + New Project
            </button>
          )
        }
      >
        Projects
      </SectionHeading>

      {showNewProject && (
        <Card className="mb-4">
          <NewProjectForm
            onSave={handleCreateProject}
            onCancel={() => setShowNewProject(false)}
            saving={saving}
          />
        </Card>
      )}

      {projectsLoading ? (
        <p className="mb-6 text-sm text-gray-500">Loading projects…</p>
      ) : projectsError ? (
        <p className="mb-6 text-sm text-red-600">{projectsError}</p>
      ) : projects.length === 0 && !showNewProject ? (
        <p className="mb-6 text-sm text-gray-400">No projects yet. Create one to get started.</p>
      ) : (
        <div className="mb-6 divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white">
          {projects.map((p) => (
            <div
              key={p.id}
              className={cn(
                'flex cursor-pointer items-center justify-between px-4 py-3 transition-colors',
                selectedId === p.id ? 'bg-indigo-50' : 'hover:bg-gray-50'
              )}
              onClick={() => selectProject(p)}
            >
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-gray-900">{p.title}</span>
                <StatusBadge status={p.status} />
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-400">
                  {new Date(p.created_at).toLocaleDateString()}
                </span>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDeleteProject(p.id) }}
                  className="rounded p-1 text-gray-300 hover:bg-red-50 hover:text-red-500"
                  title="Delete project"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <InlineError message={deleteError} />

      {/* ── Selected project workspace ── */}
      {selectedProject && (
        <>
          <div className="mb-2 flex items-center gap-2">
            <h2 className="text-base font-semibold text-gray-900">{selectedProject.title}</h2>
            <StatusBadge status={selectedProject.status} />
          </div>

          <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* ── Left: inputs ── */}
            <div className="space-y-5 lg:col-span-1">
              {/* Lyrics */}
              <Card>
                <label className="mb-1 block text-sm font-semibold text-gray-700">Lyrics</label>
                <p className="mb-2 text-xs text-gray-400">
                  Paste the song lyrics. The AI will break them into visual scenes.
                </p>
                <textarea
                  rows={10}
                  value={lyrics}
                  onChange={(e) => setLyrics(e.target.value)}
                  className="w-full resize-y rounded border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  placeholder="Paste lyrics here…"
                />
              </Card>

              {/* Audio upload */}
              <Card>
                <label className="mb-1 block text-sm font-semibold text-gray-700">Audio File</label>
                <p className="mb-2 text-xs text-gray-400">
                  Upload an MP3 or WAV. Stored in Supabase Storage bucket{' '}
                  <code className="rounded bg-gray-100 px-1 text-xs">freks-assets</code>.
                </p>
                <input
                  type="file"
                  accept="audio/*"
                  onChange={handleAudioUpload}
                  disabled={audioUploading}
                  className="w-full text-sm text-gray-600 file:mr-3 file:rounded file:border-0 file:bg-indigo-50 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-indigo-700 hover:file:bg-indigo-100 disabled:opacity-50"
                />
                {audioUploading && (
                  <p className="mt-2 text-xs text-gray-400">Uploading…</p>
                )}
                {audioUrl && !audioUploading && (
                  <p className="mt-2 truncate text-xs text-green-600">
                    ✓ {audioUrl.split('/').pop()}
                  </p>
                )}
              </Card>

              {/* Style */}
              <Card>
                <label className="mb-1 block text-sm font-semibold text-gray-700">Visual Style</label>
                <p className="mb-2 text-xs text-gray-400">
                  Sets the art direction applied to every generated scene.
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {STYLE_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setStyle(opt.value)}
                      className={cn(
                        'rounded border px-3 py-2 text-xs font-medium transition-colors',
                        style === opt.value
                          ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                          : 'border-gray-200 text-gray-600 hover:border-indigo-300 hover:bg-indigo-50'
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </Card>

              {/* Generate button */}
              <button
                onClick={handleGenerateStoryboard}
                disabled={!lyrics.trim() || generating}
                className="w-full flex items-center justify-center gap-2 rounded-md bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {generating ? (
                  <>
                    <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    Generating Storyboard…
                  </>
                ) : (
                  '⚡ Generate Storyboard'
                )}
              </button>

              <InlineError message={genError} />
            </div>

            {/* ── Right: scene list ── */}
            <div className="lg:col-span-2">
              <SectionHeading>Scenes</SectionHeading>

              {scenesLoading ? (
                <p className="text-sm text-gray-500">Loading scenes…</p>
              ) : scenesError ? (
                <p className="text-sm text-red-600">{scenesError}</p>
              ) : scenes.length === 0 ? (
                <Card>
                  <p className="text-sm text-gray-400">
                    No scenes yet. Fill in the lyrics and hit{' '}
                    <strong className="text-gray-600">Generate Storyboard</strong>.
                  </p>
                </Card>
              ) : (
                <div className="space-y-3">
                  {scenes.map((scene, i) => (
                    <Card key={scene.id}>
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-xs font-semibold text-gray-500">
                          Scene {i + 1}
                        </span>
                        <StatusBadge status={scene.status} map={SCENE_STATUS_BADGE} />
                      </div>

                      {scene.image_url ? (
                        <img
                          src={scene.image_url}
                          alt={`Scene ${i + 1}`}
                          className="mb-3 w-full rounded object-cover"
                          style={{ maxHeight: 180 }}
                        />
                      ) : (
                        <div className="mb-3 flex h-24 items-center justify-center rounded border border-dashed border-gray-200 bg-gray-50">
                          <span className="text-xs text-gray-300">No image yet</span>
                        </div>
                      )}

                      <p className="mb-1 text-sm text-gray-800">{scene.description}</p>
                      {scene.visual_prompt && (
                        <p className="text-xs text-gray-400 italic">
                          Prompt: {scene.visual_prompt}
                        </p>
                      )}
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ── Render / export panel ── */}
          <SectionHeading
            action={
              <button
                onClick={() => reloadRenders()}
                className="rounded px-2 py-1 text-xs text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                title="Refresh render status"
              >
                ↻ Refresh
              </button>
            }
          >
            Renders &amp; Export
          </SectionHeading>

          <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Queue new render */}
            <Card>
              <h3 className="mb-3 text-sm font-semibold text-gray-800">Queue Render</h3>
              <label className="mb-1 block text-xs font-medium text-gray-600">Output format</label>
              <select
                value={renderFormat}
                onChange={(e) => setRenderFormat(e.target.value)}
                className="mb-4 w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {FORMAT_OPTIONS.map((f) => (
                  <option key={f.value} value={f.value}>{f.label}</option>
                ))}
              </select>
              <button
                onClick={handleQueueRender}
                disabled={scenes.length === 0 || queueing}
                className="w-full rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {queueing ? 'Starting render…' : '🎬 Queue Render'}
              </button>
              {scenes.length === 0 && (
                <p className="mt-2 text-xs text-gray-400">Generate a storyboard first.</p>
              )}
              <InlineError message={queueError} />
            </Card>

            {/* Render history */}
            <div className="lg:col-span-2">
              {rendersLoading ? (
                <p className="text-sm text-gray-500">Loading renders…</p>
              ) : rendersError ? (
                <p className="text-sm text-red-600">{rendersError}</p>
              ) : renders.length === 0 ? (
                <Card>
                  <p className="text-sm text-gray-400">No renders queued yet.</p>
                </Card>
              ) : (
                <div className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white">
                  {renders.map((r) => (
                    <div key={r.id} className="px-4 py-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <StatusBadge status={r.status} />
                          <span className="text-sm font-medium text-gray-700 uppercase">{r.format}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          {r.render_url && (
                            <a
                              href={r.render_url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs font-medium text-indigo-600 hover:underline"
                            >
                              Download
                            </a>
                          )}
                          <span className="text-xs text-gray-400">
                            {new Date(r.created_at).toLocaleString()}
                          </span>
                        </div>
                      </div>
                      {r.manifest_url && !r.render_url && (
                        <p className="mt-1 text-xs text-gray-400">
                          Manifest ready —{' '}
                          <a
                            href={r.manifest_url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-indigo-500 hover:underline"
                          >
                            view manifest
                          </a>
                          {' '}(attach a render worker to produce the final video)
                        </p>
                      )}
                      {r.error && (
                        <p className="mt-1 text-xs text-red-500">Error: {r.error}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
