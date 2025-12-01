const express = require('express');
const router = express.Router();
const { basicAuth } = require('../middleware/auth');
const settingsService = require('../services/settingsService');

/**
 * Apply authentication to all admin routes except login
 */
router.use((req, res, next) => {
  if (req.path === '/login') {
    return basicAuth(req, res, next);
  }
  basicAuth(req, res, next);
});

/**
 * GET /admin/login - Display login form
 */
router.get('/login', (req, res) => {
  res.render('admin/login', {
    title: 'Admin Login',
    error: null
  });
});

/**
 * POST /admin/login - Process login
 */
router.post('/login', basicAuth);

/**
 * GET /admin/logout - Logout
 */
router.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/admin/login');
});

/**
 * GET /admin - Admin dashboard
 */
router.get('/', (req, res) => {
  res.render('admin/dashboard', {
    title: 'Admin Dashboard'
  });
});

/**
 * GET /admin/settings - Settings page
 */
router.get('/settings', (req, res) => {
  const settings = settingsService.getSettings();
  res.render('admin/settings', {
    title: 'Admin Settings',
    settings,
    testResult: null,
    message: null
  });
});

/**
 * POST /admin/settings - Update settings
 */
router.post('/settings', (req, res) => {
  const { ALLOWLIST_IPS, ALLOWLIST_EMAIL_DOMAINS, FORCE_CAPTCHA_ALL } = req.body;
  
  const newSettings = {
    ALLOWLIST_IPS: ALLOWLIST_IPS || '',
    ALLOWLIST_EMAIL_DOMAINS: ALLOWLIST_EMAIL_DOMAINS || '',
    FORCE_CAPTCHA_ALL: FORCE_CAPTCHA_ALL === 'true' || FORCE_CAPTCHA_ALL === 'on'
  };

  settingsService.updateSettings(newSettings);

  res.render('admin/settings', {
    title: 'Admin Settings',
    settings: settingsService.getSettings(),
    testResult: null,
    message: { type: 'success', text: 'Settings updated successfully' }
  });
});

/**
 * POST /admin/settings/test-allowlist - Test allowlist
 */
router.post('/settings/test-allowlist', (req, res) => {
  const { testIp, testEmail } = req.body;
  const testResult = settingsService.testAllowlist(testIp, testEmail);
  const settings = settingsService.getSettings();

  res.render('admin/settings', {
    title: 'Admin Settings',
    settings,
    testResult,
    message: null
  });
});

module.exports = router;
