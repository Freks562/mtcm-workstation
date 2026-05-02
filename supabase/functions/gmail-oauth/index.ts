import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const PROJECT_REF = 'qvtujdcnzmmdcyxctggb'
const REDIRECT_URI = `https://${PROJECT_REF}.supabase.co/functions/v1/gmail-oauth/callback`
const START_PATH = '/functions/v1'
const STATE_COOKIE = 'gmail_oauth_state'
const GMAIL_SCOPE = 'https://www.googleapis.com/auth/gmail.send'
const APP_DOTMAIL_URL = 'https://www.mtcmglassworkstation.com/ops/dotmail'
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token'
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
      'Set-Cookie': `${STATE_COOKIE}=${nonce}; Path=${START_PATH}; HttpOnly; Secure; SameSite=Lax; Max-Age=600`,
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

  const userId = decodedState.userId ?? extractUserIdFromAuthHeader(req.headers.get('authorization'))
  const expiresAt = tokenData.expires_in
    ? new Date(Date.now() + Number(tokenData.expires_in) * 1000).toISOString()
    : null

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceRoleKey) {
    return Response.redirect(TOKEN_EXCHANGE_FAILURE_REDIRECT, 302)
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })

  const tokenRow: Record<string, unknown> = {
    access_token: tokenData.access_token,
    refresh_token: tokenData.refresh_token ?? null,
    expires_at: expiresAt,
    scope: tokenData.scope ?? null,
    token_type: tokenData.token_type ?? null,
  }
  if (userId) {
    tokenRow.user_id = userId
  }

  const tokenWrite = userId
    ? await supabase.from('gmail_tokens').upsert(tokenRow, { onConflict: 'user_id' })
    : await supabase.from('gmail_tokens').insert(tokenRow)

  if (tokenWrite.error) {
    return Response.redirect(TOKEN_EXCHANGE_FAILURE_REDIRECT, 302)
  }

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
    return {
      nonce: typeof parsed?.nonce === 'string' ? parsed.nonce : '',
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

  const accountRow = {
    user_id: userId,
    provider: 'gmail',
    access_token: accessToken,
    refresh_token: refreshToken,
    expires_at: expiresAt,
    scope,
    token_type: tokenType,
    status: 'connected',
  }

  const upsertResult = await supabase
    .from('mail_accounts')
    .upsert(accountRow, { onConflict: 'user_id,provider' })

  if (!upsertResult.error) return

  if (isMissingTableError(upsertResult.error.code)) return

  await supabase.from('mail_accounts').upsert(accountRow, { onConflict: 'user_id' })
}

function isMissingTableError(code?: string) {
  return code === '42P01' || code === 'PGRST205'
}
