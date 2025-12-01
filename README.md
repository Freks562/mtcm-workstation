# MTCM Portal

[![CI/CD](https://github.com/Freks562/mtcm-portal/actions/workflows/ci-cd.yml/badge.svg)](https://github.com/Freks562/mtcm-portal/actions/workflows/ci-cd.yml)

**Mountaintop Technology Comm (MTCM) Portal** — A secure SDVOSB (Service-Disabled Veteran-Owned Small Business) web application for federal sales.

## Features

- **Authentication**: Google OIDC login with role-based access (Owner/Admin/User)
- **Admin Dashboard**: Content IDE, publish actions, and comprehensive audit logging
- **Federal Kit**: Contract vehicles, certifications, NAICS codes, and capabilities
- **Contact & Leads**: Contact forms with honeypot spam protection and reCAPTCHA
- **Weather Dashboard**: Real-time weather, 5-day forecasts, geolocation, and bookmarks
- **Security**: Per-IP rate limiting, Redis-backed session storage, helmet.js security headers
- **Deployment Ready**: Docker, Render, Fly.io, or VPS with health/ready endpoints
- **Blue-Green Deployment**: Built-in drain/activate hooks for zero-downtime deployments

## Quick Start

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Redis (optional, for production rate limiting and sessions)

### Installation

```bash
# Clone the repository
git clone https://github.com/Freks562/mtcm-portal.git
cd mtcm-portal

# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Configure environment variables (see below)
# Edit .env with your settings

# Start development server
npm run dev
```

### Environment Variables

Create a `.env` file with the following variables:

| Variable | Description | Required |
|----------|-------------|----------|
| `NODE_ENV` | Environment mode (`development`, `production`, `test`) | No (default: development) |
| `PORT` | Server port | No (default: 3000) |
| `SESSION_SECRET` | Secret key for session encryption | **Yes** |
| `GOOGLE_CLIENT_ID` | Google OAuth 2.0 Client ID | **Yes** (for auth) |
| `GOOGLE_CLIENT_SECRET` | Google OAuth 2.0 Client Secret | **Yes** (for auth) |
| `GOOGLE_CALLBACK_URL` | OAuth callback URL | No (default: /auth/google/callback) |
| `REDIS_URL` | Redis connection URL | No (recommended for production) |
| `RECAPTCHA_SITE_KEY` | Google reCAPTCHA v2 site key | No (recommended) |
| `RECAPTCHA_SECRET_KEY` | Google reCAPTCHA v2 secret key | No (recommended) |
| `WEATHER_API_KEY` | OpenWeatherMap API key | No (for weather feature) |
| `ADMIN_EMAIL` | Comma-separated admin email(s) | **Yes** |
| `APP_URL` | Application base URL | No (default: http://localhost:3000) |
| `RATE_LIMIT_WINDOW_MS` | Rate limit window in milliseconds | No (default: 900000) |
| `RATE_LIMIT_MAX_REQUESTS` | Max requests per window | No (default: 100) |
| `LOG_LEVEL` | Logging level (error, warn, info, debug) | No (default: info) |

### Getting API Keys

1. **Google OAuth**: [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Credentials
2. **reCAPTCHA**: [Google reCAPTCHA Admin](https://www.google.com/recaptcha/admin)
3. **OpenWeatherMap**: [OpenWeatherMap API](https://openweathermap.org/api)

## Scripts

```bash
npm start         # Start production server
npm run dev       # Start development server with hot reload
npm test          # Run tests with coverage
npm run lint      # Run ESLint
npm run lint:fix  # Fix ESLint errors automatically
```

## API Endpoints

### Health & Deployment

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Basic health check |
| `/health/live` | GET | Liveness probe |
| `/health/ready` | GET | Readiness probe (checks Redis) |
| `/health/detailed` | GET | Detailed system metrics |
| `/health/drain` | POST | Prepare for shutdown (blue-green) |
| `/health/activate` | POST | Activate after deployment |

### Authentication

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/auth/google` | GET | Initiate Google OAuth login |
| `/auth/google/callback` | GET | OAuth callback handler |
| `/auth/login` | GET | Login page |
| `/auth/logout` | GET | Logout and destroy session |
| `/auth/me` | GET | Get current user info (API) |

### Federal

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/federal` | GET | Federal capabilities page |
| `/federal/kit` | GET | Get capabilities, certs, NAICS |
| `/federal/vehicles` | GET | List contract vehicles |
| `/federal/vehicles/:id` | GET | Get vehicle details |
| `/federal/certifications` | GET | Get certifications |
| `/federal/quote` | POST | Request a quote (auth required) |

### Weather (Auth Required)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/weather` | GET | Weather dashboard |
| `/weather/current` | GET | Get current weather |
| `/weather/forecast` | GET | Get 5-day forecast |
| `/weather/alerts` | GET | Get weather alerts |
| `/weather/bookmarks` | GET | Get saved locations |
| `/weather/bookmarks` | POST | Save a location |
| `/weather/bookmarks/:id` | DELETE | Delete a bookmark |
| `/weather/geolocate` | GET | Get location by IP |

### Contact

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/contact` | GET | Contact form page |
| `/contact` | POST | Submit contact form |
| `/contact/lead` | POST | Submit federal lead |

### Admin (Auth + Admin Required)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/admin` | GET | Admin dashboard |
| `/admin/audit` | GET | Audit logs page |
| `/admin/audit/api` | GET | Audit logs API |
| `/admin/audit` | DELETE | Clear audit logs (owner only) |
| `/admin/users` | GET | User management |
| `/admin/leads` | GET | Leads & contacts |
| `/admin/ide` | GET | Content IDE (owner only) |
| `/admin/publish` | POST | Publish content (owner only) |
| `/admin/settings` | GET | System settings (owner only) |

## Docker Deployment

### Build and Run

```bash
# Build image
docker build -t mtcm-portal .

# Run container
docker run -p 3000:3000 \
  -e SESSION_SECRET=your-secret \
  -e GOOGLE_CLIENT_ID=your-client-id \
  -e GOOGLE_CLIENT_SECRET=your-client-secret \
  -e ADMIN_EMAIL=admin@example.com \
  mtcm-portal
```

### Docker Compose

```bash
# Start all services (app + Redis)
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

## Deployment Platforms

### Render

1. Connect your GitHub repository
2. Set environment variables in Render dashboard
3. Deploy automatically on push to main

### Fly.io

```bash
# Install flyctl
curl -L https://fly.io/install.sh | sh

# Launch app
fly launch

# Set secrets
fly secrets set SESSION_SECRET=your-secret
fly secrets set GOOGLE_CLIENT_ID=your-id
# ... set other secrets

# Deploy
fly deploy
```

### VPS (Ubuntu)

```bash
# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install Redis
sudo apt install redis-server

# Clone and setup
git clone https://github.com/Freks562/mtcm-portal.git
cd mtcm-portal
npm ci --production

# Setup systemd service
sudo cp deployment/mtcm-portal.service /etc/systemd/system/
sudo systemctl enable mtcm-portal
sudo systemctl start mtcm-portal
```

## Blue-Green Deployment

The application supports zero-downtime deployments with built-in hooks:

1. Deploy new version (green environment)
2. Verify health: `GET /health/ready`
3. Switch load balancer to green
4. Drain old environment: `POST /health/drain`
5. Shutdown old environment

## Security Features

- **Helmet.js**: Security headers (CSP, HSTS, etc.)
- **Rate Limiting**: Per-IP with Redis backing
- **Session Security**: HTTP-only, secure cookies
- **Input Validation**: express-validator on all forms
- **Honeypot**: Hidden fields to catch bots
- **reCAPTCHA**: Optional bot protection
- **CSRF Protection**: Via session tokens
- **Audit Logging**: All actions logged

## Project Structure

```
mtcm-portal/
├── src/
│   ├── config/          # Configuration (passport, session)
│   ├── middleware/      # Express middleware (auth, rate limiting)
│   ├── routes/          # API and page routes
│   ├── services/        # Business logic (weather, audit log)
│   ├── views/           # EJS templates
│   ├── public/          # Static assets (CSS, JS, images)
│   └── server.js        # Express app entry point
├── tests/               # Jest test files
├── .github/workflows/   # CI/CD configuration
├── Dockerfile           # Docker build configuration
├── docker-compose.yml   # Multi-container setup
└── package.json         # Dependencies and scripts
```

## License

MIT License - see [LICENSE](LICENSE) for details.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests: `npm test`
5. Submit a pull request

## Support

For questions or issues, please open a GitHub issue or contact the development team.