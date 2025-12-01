/**
 * MTCM Portal v10.0
 * Express server with Google OIDC, forms, weather, health/ready endpoints
 * 
 * Features:
 * - Google OAuth authentication with email allowlist
 * - Lead/Contact forms with honeypot + rate limiting
 * - Weather API with 5-minute caching
 * - Federal kit downloads
 * - Health (/healthz) and readiness (/readyz) endpoints
 */
require('dotenv').config();

const express = require('express');
const session = require('express-session');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const rateLimit = require('express-rate-limit');
const path = require('path');

const configStore = require('./config-store');
const weatherRouter = require('./routes/weather');
const adminRouter = require('./routes/admin');
const formsRouter = require('./routes/forms');
const federalRouter = require('./routes/federal');

const app = express();
const PORT = process.env.PORT || 3000;

// Redis client for session store and rate limiting (optional)
let redisClient = null;
if (process.env.REDIS_URL) {
  const Redis = require('ioredis');
  redisClient = new Redis(process.env.REDIS_URL, {
    maxRetriesPerRequest: 3,
    retryDelayOnFailover: 100,
    lazyConnect: true
  });
  redisClient.on('error', (err) => {
    console.error('Redis connection error:', err.message);
  });
  redisClient.on('connect', () => {
    console.log('Redis connected');
  });
}

// Trust proxy for rate limiting behind reverse proxy
app.set('trust proxy', 1);

// View engine setup
app.set('views', path.join(__dirname, '../app/views'));
app.set('view engine', 'ejs');

// Middleware
app.use(cookieParser());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '../public')));

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'mtcm-default-secret-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.SESSION_SECURE === '1' || process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Passport initialization
app.use(passport.initialize());
app.use(passport.session());

// Allowed emails for admin access
const getAllowedEmails = () => {
  const emails = process.env.ALLOWED_EMAILS || '';
  return emails.split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
};

// Google OAuth Strategy
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_REDIRECT_URI || '/auth/google/callback'
  }, (accessToken, refreshToken, profile, done) => {
    const email = profile.emails && profile.emails[0] ? profile.emails[0].value.toLowerCase() : '';
    const allowedEmails = getAllowedEmails();
    
    if (allowedEmails.length === 0 || allowedEmails.includes(email)) {
      return done(null, {
        id: profile.id,
        email: email,
        name: profile.displayName,
        photo: profile.photos && profile.photos[0] ? profile.photos[0].value : null,
        isAdmin: allowedEmails.length === 0 || allowedEmails.includes(email)
      });
    } else {
      return done(null, false, { message: 'Email not authorized' });
    }
  }));
}

passport.serializeUser((user, done) => {
  done(null, user);
});

passport.deserializeUser((user, done) => {
  done(null, user);
});

// Rate limiting for forms
const formLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limit each IP to 10 requests per windowMs
  message: { error: 'Too many submissions, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Authentication middleware
const requireAuth = (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  }
  res.redirect('/signin');
};

const requireAdmin = (req, res, next) => {
  if (req.isAuthenticated() && req.user.isAdmin) {
    return next();
  }
  res.status(403).json({ error: 'Access denied' });
};

// Health check endpoints
app.get('/healthz', (req, res) => {
  res.status(200).json({ 
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

app.get('/readyz', async (req, res) => {
  // Check if all required services are ready
  const checks = {
    configStore: configStore.isReady(),
    sessionSecret: !!(process.env.SESSION_SECRET)
  };
  
  // Redis ping if configured
  if (redisClient) {
    try {
      await redisClient.ping();
      checks.redis = true;
    } catch (err) {
      checks.redis = false;
    }
  }
  
  const allReady = Object.values(checks).every(Boolean);
  
  res.status(allReady ? 200 : 503).json({
    status: allReady ? 'ready' : 'not_ready',
    checks,
    timestamp: new Date().toISOString()
  });
});

// Public routes
app.get('/', (req, res) => {
  res.render('home', { 
    user: req.user,
    title: 'MTCM Portal',
    config: configStore.getPublicConfig()
  });
});

// Auth routes
app.get('/signin', (req, res) => {
  if (req.isAuthenticated()) {
    return res.redirect('/admin');
  }
  res.render('signin', { 
    title: 'Sign In',
    googleEnabled: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)
  });
});

app.get('/auth/google', 
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

app.get('/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/signin?error=unauthorized' }),
  (req, res) => {
    res.redirect('/admin');
  }
);

app.get('/signout', (req, res) => {
  req.logout((err) => {
    if (err) {
      console.error('Logout error:', err);
    }
    res.redirect('/');
  });
});

// Admin routes
app.get('/admin', requireAuth, (req, res) => {
  res.render('admin', { 
    user: req.user,
    title: 'Admin Dashboard',
    config: configStore.getConfig()
  });
});

// Mount routers
app.use('/api/weather', weatherRouter);
app.use('/api/admin', requireAdmin, adminRouter);
app.use('/federal', federalRouter);
app.use('/', formsRouter(formLimiter));

// 404 handler
app.use((req, res) => {
  res.status(404).render('error', { 
    title: 'Not Found',
    message: 'The page you requested was not found.',
    user: req.user
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).render('error', {
    title: 'Server Error',
    message: process.env.NODE_ENV === 'production' 
      ? 'An unexpected error occurred.' 
      : err.message,
    user: req.user
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`MTCM Portal v10.0 running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/healthz`);
  console.log(`Ready check: http://localhost:${PORT}/readyz`);
});

module.exports = app;
