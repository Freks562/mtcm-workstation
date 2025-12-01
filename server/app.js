const path = require('path');
const fs = require('fs');
const express = require('express');
const session = require('express-session');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const bodyParser = require('body-parser');
const axios = require('axios');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const nodemailer = require('nodemailer');
const { v4: uuidv4 } = require('uuid');
const { exec } = require('child_process');
require('dotenv').config();

const { readConfig, writeConfig, appendEvent } = require('./config-store');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet({
  contentSecurityPolicy: false, // keep simple; tighten later
  crossOriginEmbedderPolicy: false
}));
app.use(compression());
app.use(morgan('tiny'));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '..', 'app')));
app.use('/public', express.static(path.join(__dirname, '..', 'public')));

// --- sessions
app.use(session({
  secret: process.env.SESSION_SECRET || 'change-me',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: (process.env.SESSION_SECURE === '1')
  }
}));

// --- passport google
passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID || '',
  clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
  callbackURL: process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/auth/google/callback'
}, (accessToken, refreshToken, profile, done) => {
  done(null, {
    id: profile.id,
    email: (profile.emails && profile.emails[0] && profile.emails[0].value) || '',
    name: profile.displayName
  });
}));

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));
app.use(passport.initialize());
app.use(passport.session());

// --- helpers
function getAllowed() {
  const cfg = readConfig();
  const allowed = (cfg.ALLOWED_EMAILS || process.env.ALLOWED_EMAILS || '').split(',').map(s => s.trim()).filter(Boolean);
  const owners = (cfg.OWNER_EMAILS || process.env.OWNER_EMAILS || '').split(',').map(s => s.trim()).filter(Boolean);
  return { allowed, owners };
}
function requireAuth(req, res, next) {
  if (req.user) return next();
  res.redirect('/login.html');
}
function requireAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ ok: false, error: 'unauthenticated' });
  const { allowed } = getAllowed();
  if (allowed.includes(req.user.email)) return next();
  res.status(403).json({ ok: false, error: 'forbidden' });
}
function requireOwner(req, res, next) {
  if (!req.user) return res.status(401).json({ ok: false, error: 'unauthenticated' });
  const { owners } = getAllowed();
  if (owners.includes(req.user.email)) return next();
  res.status(403).json({ ok: false, error: 'owner-only' });
}

// --- ops token helpers
function rnd(n = 40) {
  const abc = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let s = '';
  for (let i = 0; i < n; i++) s += abc[Math.floor(Math.random() * abc.length)];
  return s;
}
function getOps() {
  const cfg = readConfig();
  return {
    token: cfg.OPS_TOKEN || null,
    exp: cfg.OPS_TOKEN_EXPIRES_AT || null,
    hours: Number(cfg.OPS_TOKEN_EXPIRE_HOURS || process.env.OPS_TOKEN_EXPIRE_HOURS || 24)
  };
}
function setOps(token, hours) {
  const exp = new Date(Date.now() + Number(hours || 24) * 3600 * 1000).toISOString();
  writeConfig({ OPS_TOKEN: token, OPS_TOKEN_EXPIRES_AT: exp, OPS_TOKEN_EXPIRE_HOURS: Number(hours || 24) });
  return { token, exp };
}
function isOpsValid(tok) {
  const { token, exp } = getOps();
  if (!tok || !token || tok !== token) return false;
  if (!exp) return true;
  return Date.now() < Date.parse(exp);
}

// --- rate limiter (in-memory, simple)
const hits = new Map(); // key => {hour:n, hourAt, day:n, dayAt}
function makeRateLimiter(name, hourMax = 1, dayMax = 3) {
  return (req, res, next) => {
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || 'unknown';
    const key = `${name}:${ip}`;
    const now = Date.now();
    const H = 60 * 60 * 1000;
    const D = 24 * H;
    const cur = hits.get(key) || { hour: 0, hourAt: now, day: 0, dayAt: now };
    if (now - cur.hourAt >= H) { cur.hour = 0; cur.hourAt = now; }
    if (now - cur.dayAt >= D) { cur.day = 0; cur.dayAt = now; }
    cur.hour++; cur.day++;
    hits.set(key, cur);
    if (cur.hour > hourMax || cur.day > dayMax) {
      appendEvent({ type: 'rate-limit', route: name, ip });
      return res.status(429).json({ ok: false, error: 'Too Many Requests' });
    }
    next();
  };
}

// --- mailer (optional)
function getTransport() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST) return null;
  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT || 587),
    secure: false,
    auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASS } : undefined
  });
}

// --- routes: auth
app.get('/signin', (req, res) => res.sendFile(path.join(__dirname, '..', 'app', 'login.html')));
app.get('/auth/google', passport.authenticate('google', { scope: ['email', 'profile'] }));
app.get('/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/login.html' }),
  (req, res) => {
    const { allowed } = getAllowed();
    if (!allowed.length || allowed.includes(req.user.email)) return res.redirect('/admin');
    req.logout(() => res.redirect('/login.html?denied=1'));
  }
);
app.post('/logout', (req, res) => req.logout(() => res.redirect('/')));

// --- admin guard
app.get('/admin', requireAuth, (req, res) => res.sendFile(path.join(__dirname, '..', 'app', 'admin.html')));
app.get('/api/admin/me', requireAuth, (req, res) => {
  const { owners, allowed } = getAllowed();
  res.json({ ok: true, user: req.user, roles: { admin: allowed.includes(req.user.email), owner: owners.includes(req.user.email) } });
});
app.get('/api/admin/config', requireAdmin, (req, res) => {
  res.json({ ok: true, config: readConfig() });
});
app.post('/api/admin/config', requireAdmin, (req, res) => {
  const next = writeConfig(req.body || {});
  appendEvent({ type: 'config-save', who: req.user.email, fields: Object.keys(req.body || {}) });
  res.json({ ok: true, config: next });
});

// owner actions
app.post('/api/admin/publish-css', requireOwner, (req, res) => {
  const cmd = process.env.CSS_BUILD_CMD || 'echo "no CSS_BUILD_CMD set"';
  exec(cmd, { cwd: process.cwd() }, (err, stdout, stderr) =>
    err ? res.status(500).json({ ok: false, error: stderr || String(err) }) : res.json({ ok: true, log: stdout })
  );
});
app.post('/api/admin/publish-full', requireOwner, (req, res) => {
  const cmd = process.env.FULL_PUBLISH_CMD || 'echo "no FULL_PUBLISH_CMD set"';
  exec(cmd, { cwd: process.cwd() }, (err, stdout, stderr) =>
    err ? res.status(500).json({ ok: false, error: stderr || String(err) }) : res.json({ ok: true, log: stdout })
  );
});
app.post('/api/admin/ops/rotate', requireOwner, (req, res) => {
  const hours = Number(req.body?.hours || readConfig().OPS_TOKEN_EXPIRE_HOURS || process.env.OPS_TOKEN_EXPIRE_HOURS || 24);
  const token = rnd(40);
  const out = setOps(token, hours);
  appendEvent({ type: 'ops-rotate', who: req.user.email, exp: out.exp });
  res.json({ ok: true, revealToken: token, exp: out.exp, hours });
});
app.get('/api/ops/status', (req, res) => {
  const tok = req.query.token || req.headers['x-ops-token'];
  const valid = isOpsValid(tok);
  const { exp, hours } = getOps();
  res.status(valid ? 200 : 401).json({ ok: valid, now: new Date().toISOString(), exp, hours, services: { app: true } });
});

// forms (honeypot + rate-limit)
function honeypotFail(body) { return Boolean(body?.company2); }
function normalizeLead(body, req) {
  return {
    id: uuidv4(),
    name: (body.name || '').trim(),
    org: (body.org || '').trim(),
    email: (body.email || '').trim(),
    phone: (body.phone || '').trim(),
    notes: (body.notes || '').trim(),
    ip: req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || '',
    ua: req.headers['user-agent'] || ''
  };
}
app.post('/lead', makeRateLimiter('lead', 1, 3), (req, res) => {
  if (honeypotFail(req.body)) return res.redirect('/lead/thanks.html');
  const lead = normalizeLead(req.body, req);
  appendEvent({ type: 'lead', ...lead });
  const tx = getTransport();
  const to = process.env.SMTP_FROM || 'ops@mtcm-portal.local';
  if (tx) {
    tx.sendMail({
      from: to, to,
      subject: `New Lead: ${lead.org || lead.name}`,
      text: JSON.stringify(lead, null, 2)
    }).catch(() => {});
  }
  res.sendFile(path.join(__dirname, '..', 'app', 'lead', 'thanks.html'));
});
app.post('/contact', makeRateLimiter('contact', 1, 3), (req, res) => {
  if (honeypotFail(req.body)) return res.redirect('/contact/thanks.html');
  const lead = normalizeLead(req.body, req);
  appendEvent({ type: 'contact', ...lead });
  const tx = getTransport();
  const to = process.env.SMTP_FROM || 'ops@mtcm-portal.local';
  if (tx) {
    tx.sendMail({
      from: to, to,
      subject: `Contact: ${lead.org || lead.name}`,
      text: JSON.stringify(lead, null, 2)
    }).catch(() => {});
  }
  res.sendFile(path.join(__dirname, '..', 'app', 'contact', 'thanks.html'));
});

// weather APIs
app.get('/api/weather/config', (req, res) => {
  const cfg = readConfig();
  res.json({
    city: cfg.WEATHER_DEFAULT_CITY || process.env.WEATHER_DEFAULT_CITY || 'Washington DC',
    units: cfg.WEATHER_DEFAULT_UNITS || process.env.WEATHER_DEFAULT_UNITS || 'metric',
    alertMm: Number(cfg.WEATHER_ALERT_PRECIP_MM || process.env.WEATHER_ALERT_PRECIP_MM || 10)
  });
});
app.get('/api/weather', async (req, res) => {
  try {
    const api = process.env.OWM_API_KEY;
    if (!api) return res.status(500).json({ error: 'Missing OWM_API_KEY' });
    const units = (req.query.units || 'metric');
    const url = req.query.lat && req.query.lon
      ? `https://api.openweathermap.org/data/2.5/weather?lat=${req.query.lat}&lon=${req.query.lon}&appid=${api}&units=${units}`
      : `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(req.query.city || 'Washington DC')}&appid=${api}&units=${units}`;
    const { data } = await axios.get(url, { timeout: 8000 });
    res.json({
      city: data.name,
      description: data.weather?.[0]?.description || '',
      temp: data.main?.temp,
      icon: data.weather?.[0]?.icon,
      humidity: data.main?.humidity,
      wind: data.wind?.speed,
      units
    });
  } catch (e) {
    res.status(500).json({ error: e.response?.data?.message || 'Failed to fetch weather' });
  }
});
app.get('/api/forecast', async (req, res) => {
  try {
    const api = process.env.OWM_API_KEY;
    if (!api) return res.status(500).json({ error: 'Missing OWM_API_KEY' });
    const units = (req.query.units || 'metric');
    const base = req.query.lat && req.query.lon
      ? `https://api.openweathermap.org/data/2.5/forecast?lat=${req.query.lat}&lon=${req.query.lon}&appid=${api}&units=${units}`
      : `https://api.openweathermap.org/data/2.5/forecast?q=${encodeURIComponent(req.query.city || 'Washington DC')}&appid=${api}&units=${units}`;
    const { data } = await axios.get(base, { timeout: 8000 });
    // aggregate by date
    const byDay = {};
    for (const item of data.list || []) {
      const dt = new Date(item.dt * 1000);
      const day = dt.toISOString().slice(0, 10);
      byDay[day] = byDay[day] || { min: +Infinity, max: -Infinity, precip: 0, clouds: 0, count: 0, icon: item.weather?.[0]?.icon, desc: item.weather?.[0]?.description };
      const b = byDay[day];
      b.min = Math.min(b.min, item.main.temp_min);
      b.max = Math.max(b.max, item.main.temp_max);
      b.precip += (item.rain?.['3h'] || 0) + (item.snow?.['3h'] || 0);
      b.clouds += (item.clouds?.all || 0);
      b.count++;
    }
    const days = Object.keys(byDay).slice(0, 5).map(d => {
      const b = byDay[d];
      return { date: d, min: b.min, max: b.max, precip: Number(b.precip.toFixed(1)), clouds: Math.round(b.clouds / b.count), icon: b.icon, desc: b.desc };
    });
    res.json({ city: data.city?.name, units, days });
  } catch (e) {
    res.status(500).json({ error: e.response?.data?.message || 'Failed to fetch forecast' });
  }
});

// health
app.get('/healthz', (req, res) => res.json({ ok: true }));
app.get('/readyz', (req, res) => {
  const ok = Boolean(process.env.SESSION_SECRET);
  res.status(ok ? 200 : 500).json({ ok });
});

// fallback
app.get('/', (req, res) => res.sendFile(path.join(__dirname, '..', 'app', 'index.html')));

app.listen(PORT, () => console.log(`MTCM portal listening on :${PORT}`));
