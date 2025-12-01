const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');

/**
 * Dashboard home page
 * GET /dashboard
 */
router.get('/', requireAuth, (req, res) => {
  res.render('dashboard/index', {
    title: 'Dashboard - MTCM Portal',
    user: req.user
  });
});

/**
 * User profile page
 * GET /dashboard/profile
 */
router.get('/profile', requireAuth, (req, res) => {
  res.render('dashboard/profile', {
    title: 'Profile - MTCM Portal',
    user: req.user
  });
});

module.exports = router;
