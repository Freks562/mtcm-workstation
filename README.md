# MTCM Portal v10.0

A comprehensive web portal with Google authentication, admin dashboard, lead/contact forms, weather dashboard, and federal resource downloads.

## Features

- 🔐 **Google OAuth Authentication** - Secure sign-in with email allowlist
- 👤 **Admin Dashboard** - Manage site configuration
- 📝 **Lead/Contact Forms** - With honeypot + rate limiting protection
- 🌤️ **Weather Dashboard** - Current weather, 5-day forecast, charts, alerts
- 📦 **Federal Kit Downloads** - File hosting and ZIP downloads
- ❤️ **Health Endpoints** - `/healthz` and `/readyz` for monitoring
- 🐳 **Docker Ready** - Dockerfile and docker-compose included
- 🚀 **Deploy Ready** - Render and Fly.io configurations included

## Quick Start

### Local Development

```bash
# Clone the repository
git clone https://github.com/Freks562/mtcm-portal.git
cd mtcm-portal

# Copy environment file and configure
cp .env.example .env
# Edit .env with your values

# Install dependencies
npm install

# Start the server
npm start
# Open http://localhost:3000
```

### Environment Variables

#### Required

| Variable | Description |
|----------|-------------|
| `SESSION_SECRET` | Session encryption key. Generate with `openssl rand -hex 32` |
| `ALLOWED_EMAILS` | Comma-separated list of admin email addresses |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `GOOGLE_REDIRECT_URI` | OAuth callback URL (e.g., `https://yourdomain.com/auth/google/callback`) |
| `OWM_API_KEY` | OpenWeatherMap API key |

#### Optional

| Variable | Description | Default |
|----------|-------------|---------|
| `SESSION_SECURE` | Set to `1` for secure cookies in production | `0` |
| `OWNER_EMAILS` | Email recipients for form notifications | `ALLOWED_EMAILS` |
| `WEATHER_DEFAULT_CITY` | Default city for weather | `Washington DC` |
| `WEATHER_DEFAULT_UNITS` | `metric` or `imperial` | `metric` |
| `WEATHER_ALERT_PRECIP_MM` | Precipitation alert threshold | `10` |
| `REDIS_URL` | Redis URL for rate limiting | - |
| `SMTP_HOST` | SMTP server for emails | - |
| `SMTP_PORT` | SMTP port | `587` |
| `SMTP_USER` | SMTP username | - |
| `SMTP_PASS` | SMTP password | - |
| `SMTP_FROM` | From email address | - |
| `ALLOWLIST_IPS` | IPs to bypass rate limiting | - |
| `ALLOWLIST_EMAIL_DOMAINS` | Email domains to bypass rate limiting | - |
| `OPENAI_API_KEY` | Reserved for AI features | - |

## Endpoints

### Public Routes

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | Home page |
| GET | `/federal` | Federal resources page |
| GET | `/federal/downloads` | List available downloads |
| GET | `/federal/download/:file` | Download specific file |
| GET | `/federal/download-all` | Download all as ZIP |
| GET | `/lead` | Lead form page |
| POST | `/lead` | Submit lead form |
| GET | `/contact` | Contact form page |
| POST | `/contact` | Submit contact form |
| GET | `/weather` | Weather dashboard |
| GET | `/healthz` | Health check (always 200) |
| GET | `/readyz` | Readiness check (checks SESSION_SECRET + Redis) |

### Auth Routes

| Method | Path | Description |
|--------|------|-------------|
| GET | `/signin` | Sign in page |
| GET | `/auth/google` | Start Google OAuth flow |
| GET | `/auth/google/callback` | OAuth callback |
| GET | `/signout` | Sign out |

### API Routes

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/weather` | No | Current weather (`?city=` or `?lat=&lon=`) |
| GET | `/api/weather/forecast` | No | 5-day forecast |
| GET | `/api/weather/geolocate` | No | Weather by coordinates |
| GET | `/api/weather/config` | No | Weather configuration |
| GET | `/api/admin/me` | Admin | Current user info |
| GET | `/api/admin/config` | Admin | Get site configuration |
| PUT | `/api/admin/config` | Admin | Update site configuration |

## Deploy

### Render

1. Go to [Render Dashboard](https://dashboard.render.com/)
2. New → Web Service → Connect your repository
3. Configure:
   - **Build Command**: `npm ci`
   - **Start Command**: `node server/app.js`
4. Add environment variables (see table above)
5. Click **Create Web Service**

Or use the included `render.yaml` Blueprint.

### Fly.io

1. Install [Fly CLI](https://fly.io/docs/hands-on/install-flyctl/)
2. Set repository secret `FLY_API_TOKEN` in GitHub
3. Push to `main` branch - the included workflow will deploy automatically

Or deploy manually:

```bash
fly launch --yes
fly secrets set ALLOWED_EMAILS="email1@example.com,email2@example.com"
fly secrets set SESSION_SECRET="$(openssl rand -hex 32)"
fly secrets set GOOGLE_CLIENT_ID="your-client-id"
fly secrets set GOOGLE_CLIENT_SECRET="your-client-secret"
fly secrets set GOOGLE_REDIRECT_URI="https://your-app.fly.dev/auth/google/callback"
fly secrets set OWM_API_KEY="your-openweathermap-key"
fly deploy
```

### Docker

```bash
# Build and run
docker-compose -f docker-compose.prod.yml up -d

# Or build manually
docker build -t mtcm-portal .
docker run -p 3000:3000 --env-file .env mtcm-portal
```

## Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Create a new project or select existing
3. Configure OAuth consent screen
4. Create OAuth 2.0 Client ID (Web application)
5. Add authorized redirect URIs:
   - Local: `http://localhost:3000/auth/google/callback`
   - Production: `https://your-domain.com/auth/google/callback`
6. Copy Client ID and Client Secret to your environment

## Smoke Test Checklist

After deploying, verify these work:

- [ ] `/healthz` returns 200
- [ ] `/readyz` returns 200 with all checks passing
- [ ] `/signin` shows Google sign-in button
- [ ] Google login works for allowed emails
- [ ] `/admin` accessible after login
- [ ] `/federal` shows downloads page
- [ ] `/lead` form submits successfully
- [ ] `/contact` form submits successfully
- [ ] `/weather` shows weather data and charts
- [ ] Rate limiting returns 429 after 3 rapid submissions

## Project Structure

```
mtcm-portal/
├── server/
│   ├── app.js              # Main Express application
│   ├── config-store.js     # Configuration persistence
│   └── routes/
│       ├── admin.js        # Admin API routes
│       ├── federal.js      # Federal downloads routes
│       ├── forms.js        # Lead/contact form routes
│       └── weather.js      # Weather API routes
├── app/
│   └── views/              # EJS templates
│       ├── home.ejs
│       ├── signin.ejs
│       ├── admin.ejs
│       ├── federal.ejs
│       ├── lead.ejs
│       ├── contact.ejs
│       ├── weather.ejs
│       └── error.ejs
├── public/
│   ├── css/style.css       # Main stylesheet
│   └── downloads/          # Federal kit files
├── data/                   # Runtime data (gitignored)
├── Dockerfile
├── docker-compose.prod.yml
├── fly.toml
├── render.yaml
├── .env.example
└── package.json
```

## Security

- Session cookies are HTTP-only and secure in production
- Honeypot field protection on forms
- Per-IP rate limiting (3 requests/minute)
- Email allowlist for admin access
- Directory traversal protection on downloads
- No hardcoded secrets - all from environment

## License

MIT