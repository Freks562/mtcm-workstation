/**
 * Admin Routes - API endpoints for admin functionality
 * Protected by requireAdmin middleware in app.js
 */
const express = require('express');
const router = express.Router();
const configStore = require('../config-store');

// GET /api/admin/me - Get current user info
router.get('/me', (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  res.json({
    id: req.user.id,
    email: req.user.email,
    name: req.user.name,
    photo: req.user.photo,
    isAdmin: req.user.isAdmin
  });
});

// GET /api/admin/config - Get full configuration
router.get('/config', (req, res) => {
  res.json(configStore.getConfig());
});

// PUT /api/admin/config - Update configuration
router.put('/config', (req, res) => {
  // Allowlist of fields that can be updated via API
  const allowedFields = [
    'siteName',
    'weatherDefaultCity',
    'weatherDefaultUnits',
    'weatherAlertPrecipMm',
    'contactEmail',
    'leadNotifyEmail'
  ];
  
  const updates = {};
  for (const field of allowedFields) {
    if (req.body[field] !== undefined) {
      updates[field] = req.body[field];
    }
  }
  
  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: 'No valid fields to update' });
  }
  
  const success = configStore.updateConfig(updates);
  
  if (success) {
    res.json({ message: 'Configuration updated', config: configStore.getConfig() });
  } else {
    res.status(500).json({ error: 'Failed to save configuration' });
  }
});

module.exports = router;
