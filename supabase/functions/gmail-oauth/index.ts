import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'

const PROJECT_REF = 'qvtujdcnzmmdcyxctggb'
const REDIRECT_URI = `https://${PROJECT_REF}.supabase.co/functions/v1/gmail-oauth/callback`
const START_PATH = '/functions/v1/gmail-oauth'
const STATE_COOKIE = 'gmail_oauth_state'
const GMAIL_SCOPE = 'https://www.googleapis.com/auth/gmail.send'
const APP_DOTMAIL_URL =
  Deno.env.get('APP_DOTMAIL_URL') ?? 'https://mtcmglassworkstation.com/ops/dotmail'

serve(async (req) => {
  const url = new URL(req.url)
  const isCallback = url.pathname.endsWith('/callback')

  if (!isCallback) {
    return startOAuth()
  }

  return handleCallback(req, url)
})

function startOAuth() {
  const clientId = Deno.env.get('GOOGLE_CLIENT_ID')
  if (!clientId) {
    return redirectToApp('gmail_connected=false&error=missing_client_id')
  }

  const state = crypto.randomUUID()
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
      'Set-Cookie': `${STATE_COOKIE}=${state}; Path=${START_PATH}; HttpOnly; Secure; SameSite=Lax; Max-Age=600`,
    },
  })
}

function handleCallback(req: Request, url: URL) {
  const providerError = url.searchParams.get('error')
  if (providerError) {
    return redirectToApp(`gmail_connected=false&error=${encodeURIComponent(providerError)}`)
  }

  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')

  if (!code || !state) {
    return redirectToApp('gmail_connected=false&error=missing_params')
  }

  const storedState = readCookie(req.headers.get('cookie'), STATE_COOKIE)
  if (!storedState || storedState !== state) {
    return redirectToApp('gmail_connected=false&error=invalid_state')
  }

  return redirectToApp('gmail_connected=true')
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
