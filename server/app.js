require('dotenv').config();

const express = require('express');
const helmet = require('helmet');
const compression = require('compression');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));
app.use(compression());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Session configuration
const sessionConfig = {
  secret: process.env.SESSION_SECRET || 'fallback-secret-for-development',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    sameSite: 'lax',
  },
};

if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

app.use(session(sessionConfig));

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

// Passport serialization
passport.serializeUser((user, done) => {
  done(null, user);
});

passport.deserializeUser((user, done) => {
  done(null, user);
});

// Google OAuth Strategy
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_REDIRECT_URI || '/auth/google/callback',
  }, (accessToken, refreshToken, profile, done) => {
    const email = profile.emails && profile.emails[0] && profile.emails[0].value;
    const allowedEmails = (process.env.ALLOWED_EMAILS || '').split(',').map(e => e.trim().toLowerCase());
    
    if (email && allowedEmails.includes(email.toLowerCase())) {
      return done(null, {
        id: profile.id,
        email: email,
        displayName: profile.displayName,
      });
    } else {
      return done(null, false, { message: 'Email not in allowlist' });
    }
  }));
}

// Custom CSRF protection middleware
const generateCsrfToken = () => crypto.randomBytes(32).toString('hex');

const csrfProtection = (req, res, next) => {
  // Skip CSRF for health endpoints and auth routes
  if (req.path === '/healthz' || req.path === '/readyz' || req.path.startsWith('/auth/')) {
    return next();
  }
  
  // For GET requests, generate and store token
  if (req.method === 'GET') {
    if (!req.session.csrfToken) {
      req.session.csrfToken = generateCsrfToken();
    }
    res.locals.csrfToken = req.session.csrfToken;
    return next();
  }
  
  // For state-changing methods, validate token
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
    const tokenFromBody = req.body && req.body._csrf;
    const tokenFromHeader = req.headers['x-csrf-token'];
    const token = tokenFromBody || tokenFromHeader;
    
    if (!token || token !== req.session.csrfToken) {
      const err = new Error('Invalid CSRF token');
      err.code = 'EBADCSRFTOKEN';
      return next(err);
    }
  }
  
  next();
};

app.use(csrfProtection);

// Static files
app.use(express.static(path.join(__dirname, '..', 'app')));

// Middleware to check authentication
const isAuthenticated = (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  }
  res.redirect('/signin');
};

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'app', 'index.html'));
});

app.get('/signin', (req, res) => {
  const csrfToken = res.locals.csrfToken || '';
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Sign In - MTCM Portal</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 100vh;
          margin: 0;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        }
        .signin-container {
          background: white;
          padding: 40px;
          border-radius: 10px;
          box-shadow: 0 10px 40px rgba(0,0,0,0.2);
          text-align: center;
        }
        h1 {
          color: #333;
          margin-bottom: 30px;
        }
        .signin-btn {
          display: inline-flex;
          align-items: center;
          padding: 12px 24px;
          background: #4285f4;
          color: white;
          text-decoration: none;
          border-radius: 5px;
          font-size: 16px;
          transition: background 0.3s;
        }
        .signin-btn:hover {
          background: #357abd;
        }
        .signin-btn img {
          margin-right: 10px;
          width: 20px;
          height: 20px;
        }
      </style>
    </head>
    <body>
      <div class="signin-container">
        <h1>Welcome to MTCM Portal</h1>
        <a href="/auth/google" class="signin-btn">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="20" height="20"><path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"/><path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"/><path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"/><path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z"/></svg>
          Sign in with Google
        </a>
      </div>
    </body>
    </html>
  `);
});

app.get('/admin', isAuthenticated, (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'app', 'admin.html'));
});

// Google OAuth routes
app.get('/auth/google', passport.authenticate('google', {
  scope: ['profile', 'email'],
}));

app.get('/auth/google/callback',
  passport.authenticate('google', {
    failureRedirect: '/signin?error=auth_failed',
  }),
  (req, res) => {
    res.redirect('/admin');
  }
);

app.get('/auth/logout', (req, res, next) => {
  req.logout((err) => {
    if (err) {
      return next(err);
    }
    res.redirect('/');
  });
});

// Health check endpoints
app.get('/healthz', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.get('/readyz', (req, res) => {
  const requiredEnv = ['SESSION_SECRET'];
  const missingEnv = requiredEnv.filter(key => !process.env[key]);
  
  // Check if SESSION_SECRET is properly set (not the fallback)
  const hasProperSessionSecret = process.env.SESSION_SECRET && 
    process.env.SESSION_SECRET !== 'fallback-secret-for-development';
  
  if (missingEnv.length > 0 || !hasProperSessionSecret) {
    return res.status(503).json({
      status: 'not ready',
      missing: missingEnv,
      sessionSecretConfigured: hasProperSessionSecret,
    });
  }
  
  res.status(200).json({ status: 'ready' });
});

// Error handling
app.use((err, req, res, next) => {
  if (err.code === 'EBADCSRFTOKEN') {
    return res.status(403).json({ error: 'Invalid CSRF token' });
  }
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Start server
app.listen(PORT, () => {
  console.log(`MTCM Portal running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;
