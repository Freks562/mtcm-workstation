# MTCM Portal

A Node.js/Express portal application with public lead and contact forms, featuring comprehensive protection mechanisms including honeypot, rate limiting, and optional reCAPTCHA integration.

## Features

- **Public Forms**: Lead and Contact forms with validation
- **Honeypot Protection**: Hidden field to detect bot submissions
- **Rate Limiting**: Per-IP rate limiting (memory-based, Redis-ready)
- **Allowlist Bypass**: Allowlist IPs and email domains to bypass protections
- **Optional reCAPTCHA v3**: Integration with Google reCAPTCHA v3
- **Email Notifications**: Send owner notification and auto-reply to submitter
- **Admin Settings**: Configure allowlists and protection settings

## Installation

```bash
npm install
```

## Configuration

Copy `.env.example` to `.env` and configure the following:

### Server
- `PORT` - Server port (default: 3000)
- `NODE_ENV` - Environment (development/production)

### Email (SMTP)
- `SMTP_HOST` - SMTP server hostname
- `SMTP_PORT` - SMTP port (default: 587)
- `SMTP_USER` - SMTP username
- `SMTP_PASS` - SMTP password
- `SMTP_FROM` - From email address
- `OWNER_EMAIL` - Email to receive form notifications

### reCAPTCHA (Optional)
- `RECAPTCHA_SITE_KEY` - reCAPTCHA v3 site key
- `RECAPTCHA_SECRET` - reCAPTCHA v3 secret key

### Allowlist
- `ALLOWLIST_IPS` - Comma-separated IP addresses
- `ALLOWLIST_EMAIL_DOMAINS` - Comma-separated email domains
- `FORCE_CAPTCHA_ALL` - Force captcha for all (true/false)

### Rate Limiting
- `RATE_LIMIT_WINDOW_MS` - Rate limit window in ms (default: 900000 / 15 min)
- `RATE_LIMIT_MAX_REQUESTS` - Max requests per window (default: 5)
- `REDIS_URL` - Redis URL for distributed rate limiting (optional)

### Admin
- `ADMIN_USER` - Admin username (default: admin)
- `ADMIN_PASS` - Admin password (default: admin123)
- `SESSION_SECRET` - Session secret key

## Usage

### Start the Server

```bash
npm start
```

### Routes

- `GET /` - Home page
- `GET /lead` - Lead inquiry form
- `POST /lead` - Submit lead inquiry
- `GET /contact` - Contact form
- `POST /contact` - Submit contact message
- `GET /admin` - Admin dashboard (requires authentication)
- `GET /admin/settings` - Admin settings page

### Form Fields

Both forms capture:
- Name (required)
- Organization (optional)
- Email (required)
- Phone (optional)
- Notes/Message (optional)

### Protection Mechanisms

1. **Honeypot**: A hidden field that bots typically fill out
2. **Rate Limiting**: 5 requests per 15 minutes per IP (configurable)
3. **Allowlist**: Bypass protections for trusted IPs/domains
4. **reCAPTCHA v3**: Optional Google reCAPTCHA integration

## Development

### Run Tests

```bash
npm test
```

### Lint

```bash
npm run lint
```

## License

ISC