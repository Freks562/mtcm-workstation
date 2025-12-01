const logger = require('../services/logger');

/**
 * Authentication middleware - requires user to be logged in
 */
function requireAuth(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  
  // Store the intended destination for redirect after login
  req.session.returnTo = req.originalUrl;
  
  if (req.xhr || req.headers.accept?.includes('application/json')) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  res.redirect('/auth/login?error=unauthorized');
}

/**
 * Admin middleware - requires user to be an admin
 */
function requireAdmin(req, res, next) {
  if (!req.isAuthenticated()) {
    req.session.returnTo = req.originalUrl;
    
    if (req.xhr || req.headers.accept?.includes('application/json')) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    return res.redirect('/auth/login?error=unauthorized');
  }
  
  if (!req.user.isAdmin) {
    logger.warn(`Unauthorized admin access attempt by ${req.user.email}`);
    
    if (req.xhr || req.headers.accept?.includes('application/json')) {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    return res.status(403).render('error', {
      title: 'Access Denied',
      message: 'You do not have permission to access this page.',
      error: { status: 403 }
    });
  }
  
  next();
}

/**
 * Owner middleware - requires user to be the owner
 */
function requireOwner(req, res, next) {
  if (!req.isAuthenticated()) {
    req.session.returnTo = req.originalUrl;
    
    if (req.xhr || req.headers.accept?.includes('application/json')) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    return res.redirect('/auth/login?error=unauthorized');
  }
  
  if (!req.user.isOwner) {
    logger.warn(`Unauthorized owner access attempt by ${req.user.email}`);
    
    if (req.xhr || req.headers.accept?.includes('application/json')) {
      return res.status(403).json({ error: 'Owner access required' });
    }
    
    return res.status(403).render('error', {
      title: 'Access Denied',
      message: 'Only the system owner can access this page.',
      error: { status: 403 }
    });
  }
  
  next();
}

module.exports = {
  requireAuth,
  requireAdmin,
  requireOwner
};
