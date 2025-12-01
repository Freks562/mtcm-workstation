const express = require('express');
const router = express.Router();
const { requireAdmin, requireOwner } = require('../middleware/auth');
const { getAuditLogs, getAuditSummary, clearAuditLogs } = require('../services/auditLog');
const { getAllUsers } = require('../config/passport');
const { addAuditLog } = require('../services/auditLog');
const contactRoutes = require('./contact');
const logger = require('../services/logger');

/**
 * Admin dashboard
 * GET /admin
 */
router.get('/', requireAdmin, (req, res) => {
  const summary = getAuditSummary();
  
  res.render('admin/index', {
    title: 'Admin Dashboard - MTCM Portal',
    user: req.user,
    summary
  });
});

/**
 * Audit logs page
 * GET /admin/audit
 */
router.get('/audit', requireAdmin, (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 50;
  const action = req.query.action;
  
  const result = getAuditLogs({ page, limit, action });

  res.render('admin/audit', {
    title: 'Audit Logs - MTCM Portal',
    user: req.user,
    logs: result.logs,
    pagination: result.pagination,
    filters: { action }
  });
});

/**
 * Audit logs API
 * GET /admin/audit/api
 */
router.get('/audit/api', requireAdmin, (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 50;
  const { action, userId, startDate, endDate } = req.query;
  
  const result = getAuditLogs({ page, limit, action, userId, startDate, endDate });
  res.json(result);
});

/**
 * Clear audit logs (owner only)
 * DELETE /admin/audit
 */
router.delete('/audit', requireOwner, (req, res) => {
  const count = clearAuditLogs();
  
  addAuditLog({
    action: 'AUDIT_CLEAR',
    userId: req.user.id,
    userEmail: req.user.email,
    details: `Cleared ${count} audit log entries`,
    ip: req.ip,
    userAgent: req.get('user-agent')
  });
  
  res.json({ success: true, cleared: count });
});

/**
 * Users management page
 * GET /admin/users
 */
router.get('/users', requireAdmin, (req, res) => {
  const users = getAllUsers();

  res.render('admin/users', {
    title: 'User Management - MTCM Portal',
    user: req.user,
    users
  });
});

/**
 * Contacts/Leads management page
 * GET /admin/leads
 */
router.get('/leads', requireAdmin, (req, res) => {
  const contacts = contactRoutes.getContacts();
  const leads = contactRoutes.getLeads();

  res.render('admin/leads', {
    title: 'Leads & Contacts - MTCM Portal',
    user: req.user,
    contacts,
    leads
  });
});

/**
 * IDE/Content editor (owner only)
 * GET /admin/ide
 */
router.get('/ide', requireOwner, (req, res) => {
  res.render('admin/ide', {
    title: 'Content IDE - MTCM Portal',
    user: req.user
  });
});

/**
 * Publish content (owner only)
 * POST /admin/publish
 */
router.post('/publish', requireOwner, (req, res) => {
  const { content, type, target } = req.body;
  
  if (!content || !type) {
    return res.status(400).json({ 
      error: 'Invalid request', 
      message: 'Content and type are required' 
    });
  }

  addAuditLog({
    action: 'CONTENT_PUBLISH',
    userId: req.user.id,
    userEmail: req.user.email,
    details: `Published ${type} content`,
    ip: req.ip,
    userAgent: req.get('user-agent'),
    metadata: { type, target }
  });

  logger.info(`Content published by ${req.user.email}: ${type}`);

  res.json({ 
    success: true, 
    message: 'Content published successfully',
    publishedAt: new Date().toISOString()
  });
});

/**
 * System settings (owner only)
 * GET /admin/settings
 */
router.get('/settings', requireOwner, (req, res) => {
  res.render('admin/settings', {
    title: 'System Settings - MTCM Portal',
    user: req.user,
    settings: {
      environment: process.env.NODE_ENV || 'development',
      redisConfigured: !!process.env.REDIS_URL,
      googleAuthConfigured: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
      recaptchaConfigured: !!process.env.RECAPTCHA_SITE_KEY,
      weatherApiConfigured: !!process.env.WEATHER_API_KEY
    }
  });
});

module.exports = router;
