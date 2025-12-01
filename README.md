# MTCM Portal

A production-ready Node.js/Express portal application with Google OAuth authentication.

## Features

- **Security First**: Built with helmet, CSRF protection, rate limiting, and secure session management
- **Google OAuth 2.0**: Secure authentication with email allowlist support
- **Health Endpoints**: `/healthz` and `/readyz` for monitoring and orchestration
- **Docker Ready**: Includes Dockerfile and docker-compose for containerized deployment
- **Render.com Support**: Pre-configured render.yaml for one-click deployment

## Quick Start

### Prerequisites

- Node.js 18.x or higher
- npm or yarn
- Google Cloud Console account (for OAuth credentials)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/your-org/mtcm-portal.git
   cd mtcm-portal
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure environment variables:
   ```bash
   cp .env.example .env
   ```

4. Edit `.env` with your configuration:
   ```env
   NODE_ENV=development
   PORT=3000
   SESSION_SECRET=your-strong-secret-here
   GOOGLE_CLIENT_ID=your-google-client-id
   GOOGLE_CLIENT_SECRET=your-google-client-secret
   GOOGLE_REDIRECT_URI=http://localhost:3000/auth/google/callback
   ALLOWED_EMAILS=admin@example.com,user@example.com
   ```

5. Start the development server:
   ```bash
   npm run dev
   ```

6. Open your browser to `http://localhost:3000`

## Google OAuth Setup

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Navigate to **APIs & Services** > **Credentials**
4. Click **Create Credentials** > **OAuth 2.0 Client IDs**
5. Configure the OAuth consent screen if prompted
6. Set the application type to **Web application**
7. Add authorized redirect URIs:
   - Development: `http://localhost:3000/auth/google/callback`
   - Production: `https://your-domain.com/auth/google/callback`
8. Copy the Client ID and Client Secret to your `.env` file

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `NODE_ENV` | Environment mode (development/production) | Yes |
| `PORT` | Server port (default: 3000) | No |
| `SESSION_SECRET` | Secret for session encryption | Yes |
| `GOOGLE_CLIENT_ID` | Google OAuth Client ID | Yes |
| `GOOGLE_CLIENT_SECRET` | Google OAuth Client Secret | Yes |
| `GOOGLE_REDIRECT_URI` | OAuth callback URL | Yes |
| `ALLOWED_EMAILS` | Comma-separated list of allowed emails | Yes |

## Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server with auto-reload |
| `npm start` | Start production server |
| `npm run build:css` | Build CSS assets |

## Routes

| Route | Description | Protected |
|-------|-------------|-----------|
| `GET /` | Home page | No |
| `GET /signin` | Sign-in page | No |
| `GET /admin` | Admin dashboard | Yes |
| `GET /healthz` | Health check (always 200) | No |
| `GET /readyz` | Readiness check | No |
| `GET /auth/google` | Start Google OAuth flow | No |
| `GET /auth/google/callback` | OAuth callback | No |
| `GET /auth/logout` | Logout user | No |

## Deployment

### Docker

Build and run with Docker:

```bash
# Build the image
docker build -t mtcm-portal .

# Run the container
docker run -p 3000:3000 --env-file .env mtcm-portal
```

### Docker Compose

```bash
# Production deployment
docker-compose -f docker-compose.prod.yml up -d
```

### Render.com

1. Connect your GitHub repository to Render
2. Create a new Web Service
3. Render will automatically detect the `render.yaml` configuration
4. Add the required environment variables in the Render dashboard
5. Deploy!

## Security Features

- **Helmet**: Sets various HTTP headers for security
- **CSRF Protection**: Prevents cross-site request forgery
- **Rate Limiting**: 100 requests per 15 minutes per IP
- **Secure Sessions**: HTTP-only, secure cookies with SameSite protection
- **Email Allowlist**: Only pre-approved emails can access protected routes

## License

ISC