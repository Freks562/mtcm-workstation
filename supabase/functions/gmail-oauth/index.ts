import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const PROJECT_REF = 'qvtujdcnzmmdcyxctggb'
const REDIRECT_URI = `https://${PROJECT_REF}.supabase.co/functions/v1/gmail-oauth/callback`
const START_PATH = '/functions/v1'
const STATE_COOKIE = 'gmail_oauth_state'
const STATE_COOKIE_MAX_AGE_SECONDS = 600
const GMAIL_SCOPE = 'https://www.googleapis.com/auth/gmail.send'
const APP_DOTMAIL_URL = 'https://www.mtcmglassworkstation.com/ops/dotmail'
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token'
const TOKEN_EXPIRY_BUFFER_SECONDS = 60
const SUCCESS_REDIRECT = `${APP_DOTMAIL_URL}?gmail_connected=true`
const TOKEN_EXCHANGE_FAILURE_REDIRECT =
  `${APP_DOTMAIL_URL}?gmail_connected=false&error=token_exchange_failed`

serve(async (req) => {
  const url = new URL(req.url)
  const isCallback = url.pathname.endsWith('/callback')

  if (!isCallback) {
    return startOAuth(req, url)
  }

  return await handleCallback(req, url)
})

function startOAuth(req: Request, url: URL) {
  const clientId = Deno.env.get('GMAIL_CLIENT_ID')
  if (!clientId) {
    return redirectToApp('gmail_connected=false&error=missing_client_id')
  }

  const userIdFromQuery = url.searchParams.get('user_id')
  const userIdFromAuth = extractUserIdFromAuthHeader(req.headers.get('authorization'))
  const userId = userIdFromQuery ?? userIdFromAuth

  const nonce = crypto.randomUUID()
  const state = encodeState({ nonce, userId })
  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  authUrl.searchParams.set('client_id', clientId)
  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set('access_type', 'offline')
  authUrl.searchParams.set('prompt', 'consent')
  authUrl.searchParams.set('scope', GMAIL_SCOPE)
  authUrl.searchParams.set('redirect_uri', REDIRECT_URI)
  authUrl.searchParams.set('state', state)

  return new Response(null, {
    status: 302,
    headers: {
      Location: authUrl.toString(),
      'Set-Cookie': `${STATE_COOKIE}=${nonce}; Path=${START_PATH}; HttpOnly; Secure; SameSite=Lax; Max-Age=${STATE_COOKIE_MAX_AGE_SECONDS}`,
    },
  })
}

async function handleCallback(req: Request, url: URL) {
  const providerError = url.searchParams.get('error')
  if (providerError) {
    return redirectToApp(`gmail_connected=false&error=${encodeURIComponent(providerError)}`)
  }

  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')

  if (!code || !state) {
    return redirectToApp('gmail_connected=false&error=missing_params')
  }

  const decodedState = decodeState(state)
  if (!decodedState?.nonce) {
    return redirectToApp('gmail_connected=false&error=invalid_state')
  }

  const storedState = readCookie(req.headers.get('cookie'), STATE_COOKIE)
  if (!storedState || storedState !== decodedState.nonce) {
    return redirectToApp('gmail_connected=false&error=invalid_state')
  }

  const clientId = Deno.env.get('GMAIL_CLIENT_ID')
  const clientSecret = Deno.env.get('GMAIL_CLIENT_SECRET')
  if (!clientId || !clientSecret) {
    return Response.redirect(TOKEN_EXCHANGE_FAILURE_REDIRECT, 302)
  }

  const tokenResponse = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: REDIRECT_URI,
      grant_type: 'authorization_code',
    }),
  })

  if (!tokenResponse.ok) {
    return Response.redirect(TOKEN_EXCHANGE_FAILURE_REDIRECT, 302)
  }

  const tokenData = await tokenResponse.json()
  if (!tokenData?.access_token) {
    return Response.redirect(TOKEN_EXCHANGE_FAILURE_REDIRECT, 302)
  }

  const userId = decodedState.userId
  const expiresAt = tokenData.expires_in
    ? new Date(
      Date.now() + Math.max(0, Number(tokenData.expires_in) - TOKEN_EXPIRY_BUFFER_SECONDS) * 1000
    ).toISOString()
    : null

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceRoleKey) {
    return Response.redirect(TOKEN_EXCHANGE_FAILURE_REDIRECT, 302)
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })
  console.log('gmail_oauth token exchange success', {
    user_id: userId ?? null,
    has_access_token: Boolean(tokenData.access_token),
    has_refresh_token: Boolean(tokenData.refresh_token),
    expires_in: tokenData.expires_in ?? null,
    scope_present: Boolean(tokenData.scope),
  })

  const gmailTokenColumns = await getPublicTableColumns(supabase, 'gmail_tokens')
  if (!gmailTokenColumns || gmailTokenColumns.size === 0) {
    console.error('gmail_oauth gmail_tokens schema read failed or table has no visible columns')
    return Response.redirect(TOKEN_EXCHANGE_FAILURE_REDIRECT, 302)
  }
  console.log('gmail_oauth gmail_tokens schema', { columns: Array.from(gmailTokenColumns) })

  const tokenWrite = await writeGmailTokens(supabase, gmailTokenColumns, {
    userId,
    accessToken: tokenData.access_token,
    refreshToken: tokenData.refresh_token ?? null,
    expiresAt,
    scope: tokenData.scope ?? null,
    tokenType: tokenData.token_type ?? null,
  })
  if (tokenWrite.error) {
    console.error('gmail_oauth gmail_tokens upsert error', tokenWrite.error)
    return Response.redirect(TOKEN_EXCHANGE_FAILURE_REDIRECT, 302)
  }
  console.log('gmail_oauth gmail_tokens upsert response', tokenWrite.response)

  await upsertMailAccountIfExists(supabase, {
    userId,
    accessToken: tokenData.access_token,
    refreshToken: tokenData.refresh_token ?? null,
    expiresAt,
    scope: tokenData.scope ?? null,
    tokenType: tokenData.token_type ?? null,
  })

  return Response.redirect(SUCCESS_REDIRECT, 302)
}

function readCookie(cookieHeader: string | null, key: string): string | null {
  if (!cookieHeader) return null
  const pairs = cookieHeader.split(';')
  for (const pair of pairs) {
    const [rawKey, ...rest] = pair.trim().split('=')
    if (rawKey === key) {
      return rest.join('=') || null
    }
  }
  return null
}

function redirectToApp(query: string) {
  return Response.redirect(`${APP_DOTMAIL_URL}?${query}`, 302)
}

function encodeState(payload: { nonce: string; userId: string | null }) {
  return toBase64Url(JSON.stringify(payload))
}

function decodeState(state: string): { nonce: string; userId: string | null } | null {
  try {
    const parsed = JSON.parse(fromBase64Url(state))
    if (typeof parsed?.nonce !== 'string' || !parsed.nonce) return null
    return {
      nonce: parsed.nonce,
      userId: typeof parsed?.userId === 'string' ? parsed.userId : null,
    }
  } catch (_) {
    return null
  }
}

function toBase64Url(value: string): string {
  return btoa(value).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(value: string): string {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
  const padding = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4))
  return atob(normalized + padding)
}

function extractUserIdFromAuthHeader(authorization: string | null): string | null {
  if (!authorization?.startsWith('Bearer ')) return null
  const token = authorization.slice('Bearer '.length).trim()
  const parts = token.split('.')
  if (parts.length < 2) return null

  try {
    const payload = JSON.parse(fromBase64Url(parts[1]))
    return typeof payload?.sub === 'string' ? payload.sub : null
  } catch (_) {
    return null
  }
}

async function upsertMailAccountIfExists(
  supabase: ReturnType<typeof createClient>,
  {
    userId,
    accessToken,
    refreshToken,
    expiresAt,
    scope,
    tokenType,
  }: {
    userId: string | null
    accessToken: string
    refreshToken: string | null
    expiresAt: string | null
    scope: string | null
    tokenType: string | null
  }
) {
  if (!userId) return

  const columns = await getPublicTableColumns(supabase, 'mail_accounts')
  if (!columns || columns.size === 0) return
  console.log('gmail_oauth mail_accounts schema', { columns: Array.from(columns) })

  const accountRow = mapColumns(columns, {
    user_id: userId,
    owner_id: userId,
    profile_id: userId,
    provider: 'gmail',
    account_type: 'gmail',
    access_token: accessToken,
    refresh_token: refreshToken,
    expires_at: expiresAt,
    token_expires_at: expiresAt,
    scope,
    scopes: scope,
    token_type: tokenType,
    status: 'connected',
    connected: true,
    is_connected: true,
    updated_at: new Date().toISOString(),
  })

  if (Object.keys(accountRow).length === 0) return

  const upsertResult = await supabase
    .from('mail_accounts')
    .upsert(accountRow, { onConflict: 'user_id,provider' })

  if (!upsertResult.error) {
    console.log('gmail_oauth mail_accounts upsert response', upsertResult)
    return
  }

  console.error('gmail_oauth mail_accounts upsert error', upsertResult.error)

  if (isMissingTableError(upsertResult.error.code)) return

  // Fallback handles schemas that only enforce user-level uniqueness for mailbox records.
  const fallbackUpsert = await supabase.from('mail_accounts').upsert(accountRow, { onConflict: 'user_id' })
  if (fallbackUpsert.error) {
    console.error('mail_accounts fallback upsert failed', fallbackUpsert.error)
  } else {
    console.log('gmail_oauth mail_accounts fallback upsert response', fallbackUpsert)
  }
}

function isMissingTableError(code?: string) {
  // 42P01 = PostgreSQL undefined_table, PGRST205 = PostgREST relation not found.
  return code === '42P01' || code === 'PGRST205'
}

async function getPublicTableColumns(
  supabase: ReturnType<typeof createClient>,
  tableName: string
): Promise<Set<string> | null> {
  const { data, error } = await supabase
    .from('information_schema.columns')
    .select('column_name')
    .eq('table_schema', 'public')
    .eq('table_name', tableName)

  if (error) {
    console.error(`gmail_oauth ${tableName} schema read error`, error)
    const fallback = getFallbackColumns(tableName)
    if (fallback) {
      console.log(`gmail_oauth using fallback columns for ${tableName}`, { columns: Array.from(fallback) })
      return fallback
    }
    return null
  }

  const columns = new Set((data ?? []).map((row) => row.column_name as string))
  if (columns.size === 0) {
    const fallback = getFallbackColumns(tableName)
    if (fallback) {
      console.log(`gmail_oauth using fallback columns for ${tableName}`, { columns: Array.from(fallback) })
      return fallback
    }
  }

  return columns
}

function mapColumns(
  columns: Set<string>,
  values: Record<string, unknown>
): Record<string, unknown> {
  const mapped: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(values)) {
    if (!columns.has(key)) continue
    if (value === undefined) continue
    mapped[key] = value
  }
  return mapped
}

async function writeGmailTokens(
  supabase: ReturnType<typeof createClient>,
  columns: Set<string>,
  {
    userId,
    accessToken,
    refreshToken,
    expiresAt,
    scope,
    tokenType,
  }: {
    userId: string | null
    accessToken: string
    refreshToken: string | null
    expiresAt: string | null
    scope: string | null
    tokenType: string | null
  }
) {
  const tokenRow = mapColumns(columns, {
    user_id: userId,
    owner_id: userId,
    profile_id: userId,
    provider: 'gmail',
    access_token: accessToken,
    gmail_access_token: accessToken,
    token: accessToken,
    refresh_token: refreshToken,
    gmail_refresh_token: refreshToken,
    expires_at: expiresAt,
    token_expires_at: expiresAt,
    scope,
    scopes: scope,
    token_type: tokenType,
    type: tokenType,
    updated_at: new Date().toISOString(),
  })

  if (!hasAny(columns, ['access_token', 'gmail_access_token', 'token'])) {
    return { response: null, error: { message: 'No access token column found in gmail_tokens' } }
  }

  if (Object.keys(tokenRow).length === 0) {
    return { response: null, error: { message: 'No compatible columns found in gmail_tokens' } }
  }

  const conflictTargets = [
    'user_id,provider',
    'user_id',
    'owner_id,provider',
    'owner_id',
    'profile_id,provider',
    'profile_id',
  ]

  if (userId) {
    for (const target of conflictTargets) {
      if (!target.split(',').every((column) => columns.has(column))) continue
      const response = await supabase.from('gmail_tokens').upsert(tokenRow, { onConflict: target })
      if (!response.error) return { response, error: null }
      if (!isRetryableConflictError(response.error.code)) {
        return { response, error: response.error }
      }
    }
  }

  const response = await supabase.from('gmail_tokens').insert(tokenRow)
  return { response, error: response.error ?? null }
}

function hasAny(columns: Set<string>, names: string[]) {
  return names.some((name) => columns.has(name))
}

function isRetryableConflictError(code?: string) {
  // 42P10 = invalid_column_reference (often conflict target mismatch), PGRST204/205 = schema cache/relation metadata mismatch.
  return code === '42P10' || code === 'PGRST204' || code === 'PGRST205'
}

function getFallbackColumns(tableName: string): Set<string> | null {
  if (tableName === 'gmail_tokens') {
    return new Set(['user_id', 'access_token', 'refresh_token', 'expires_at', 'scope', 'token_type'])
  }
  if (tableName === 'mail_accounts') {
    return new Set([
      'user_id',
      'provider',
      'access_token',
      'refresh_token',
      'expires_at',
      'scope',
      'token_type',
      'status',
    ])
  }
  return null
}
