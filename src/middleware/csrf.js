const crypto = require('crypto');
const logger = require('../services/logger');

/**
 * Generate a CSRF token
 */
function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * CSRF Protection Middleware using Double Submit Cookie pattern
 * This approach doesn't require server-side session storage for the token
 */
function csrfProtection(options = {}) {
  const cookieName = options.cookieName || 'csrf-token';
  const headerName = options.headerName || 'x-csrf-token';
  const fieldName = options.fieldName || '_csrf';
  const ignoreMethods = options.ignoreMethods || ['GET', 'HEAD', 'OPTIONS'];

  return (req, res, next) => {
    // Skip CSRF in test environment
    if (process.env.NODE_ENV === 'test') {
      req.csrfToken = () => 'test-csrf-token';
      res.locals.csrfToken = 'test-csrf-token';
      return next();
    }

    // Skip CSRF for safe methods
    if (ignoreMethods.includes(req.method)) {
      // Generate token for forms on GET requests
      if (!req.cookies[cookieName]) {
        const token = generateToken();
        res.cookie(cookieName, token, {
          httpOnly: false, // Must be readable by JavaScript
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          maxAge: 24 * 60 * 60 * 1000 // 24 hours
        });
        req.csrfToken = () => token;
      } else {
        req.csrfToken = () => req.cookies[cookieName];
      }
      res.locals.csrfToken = req.csrfToken();
      return next();
    }

    // For unsafe methods, validate the token
    const cookieToken = req.cookies[cookieName];
    const submittedToken = req.body[fieldName] || req.headers[headerName];

    if (!cookieToken || !submittedToken) {
      logger.warn(`CSRF token missing - IP: ${req.ip}, Path: ${req.path}`);
      return res.status(403).json({ 
        error: 'CSRF token missing',
        message: 'Please refresh the page and try again'
      });
    }

    // Constant-time comparison to prevent timing attacks
    if (!crypto.timingSafeEqual(Buffer.from(cookieToken), Buffer.from(submittedToken))) {
      logger.warn(`CSRF token mismatch - IP: ${req.ip}, Path: ${req.path}`);
      return res.status(403).json({ 
        error: 'CSRF token invalid',
        message: 'Please refresh the page and try again'
      });
    }

    // Token is valid, generate a new one for the response
    const newToken = generateToken();
    res.cookie(cookieName, newToken, {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000
    });
    req.csrfToken = () => newToken;
    res.locals.csrfToken = newToken;

    next();
  };
}

/**
 * Skip CSRF for specific paths (e.g., API endpoints with their own auth)
 */
function csrfExclude(paths) {
  return (req, res, next) => {
    // Skip CSRF for health endpoints and API endpoints that use other auth
    if (paths.some(path => req.path.startsWith(path))) {
      return next();
    }
    return csrfProtection()(req, res, next);
  };
}

module.exports = {
  csrfProtection,
  csrfExclude,
  generateToken
};
