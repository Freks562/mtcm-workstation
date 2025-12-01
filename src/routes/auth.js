const express = require('express');
const passport = require('passport');
const router = express.Router();
const logger = require('../services/logger');
const { createStrictRateLimiter } = require('../middleware/rateLimiter');
const { addAuditLog } = require('../services/auditLog');

// Apply strict rate limiting to auth endpoints
router.use(createStrictRateLimiter());

/**
 * Initiate Google OAuth login
 * GET /auth/google
 */
router.get('/google', passport.authenticate('google', {
  scope: ['profile', 'email']
}));

/**
 * Google OAuth callback
 * GET /auth/google/callback
 */
router.get('/google/callback',
  passport.authenticate('google', {
    failureRedirect: '/auth/login?error=auth_failed',
    failureMessage: true
  }),
  (req, res) => {
    // Log successful login
    addAuditLog({
      action: 'LOGIN',
      userId: req.user.id,
      userEmail: req.user.email,
      details: 'User logged in via Google OAuth',
      ip: req.ip,
      userAgent: req.get('user-agent')
    });

    logger.info(`User logged in: ${req.user.email}`);
    
    // Redirect to dashboard or intended destination
    const returnTo = req.session.returnTo || '/dashboard';
    delete req.session.returnTo;
    res.redirect(returnTo);
  }
);

/**
 * Login page
 * GET /auth/login
 */
router.get('/login', (req, res) => {
  if (req.isAuthenticated()) {
    return res.redirect('/dashboard');
  }
  
  const error = req.query.error;
  let errorMessage = null;
  
  if (error === 'auth_failed') {
    errorMessage = 'Authentication failed. Please try again.';
  } else if (error === 'unauthorized') {
    errorMessage = 'You must be logged in to access that page.';
  }

  res.render('auth/login', {
    title: 'Login - MTCM Portal',
    error: errorMessage
  });
});

/**
 * Logout
 * GET /auth/logout
 */
router.get('/logout', (req, res) => {
  if (req.user) {
    addAuditLog({
      action: 'LOGOUT',
      userId: req.user.id,
      userEmail: req.user.email,
      details: 'User logged out',
      ip: req.ip,
      userAgent: req.get('user-agent')
    });
    
    logger.info(`User logged out: ${req.user.email}`);
  }

  req.logout((err) => {
    if (err) {
      logger.error('Logout error:', err);
    }
    req.session.destroy((err) => {
      if (err) {
        logger.error('Session destruction error:', err);
      }
      res.clearCookie('mtcm.sid');
      res.redirect('/');
    });
  });
});

/**
 * Get current user info (API endpoint)
 * GET /auth/me
 */
router.get('/me', (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  res.json({
    user: {
      id: req.user.id,
      email: req.user.email,
      displayName: req.user.displayName,
      photo: req.user.photo,
      isAdmin: req.user.isAdmin,
      isOwner: req.user.isOwner
    }
  });
});

module.exports = router;
