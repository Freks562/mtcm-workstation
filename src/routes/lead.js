const express = require('express');
const router = express.Router();
const { honeypot, getHoneypotField } = require('../middleware/honeypot');
const { createRateLimiter } = require('../middleware/rateLimiter');
const { verifyCaptcha, shouldShowCaptcha } = require('../middleware/captcha');
const { sendOwnerNotification, sendAutoReply } = require('../services/emailService');

// Apply rate limiter to POST requests
const rateLimiter = createRateLimiter();

/**
 * GET /lead - Display lead form
 */
router.get('/', (req, res) => {
  res.render('lead', {
    title: 'Lead Form',
    honeypotField: getHoneypotField(),
    showCaptcha: shouldShowCaptcha(req),
    recaptchaSiteKey: process.env.RECAPTCHA_SITE_KEY,
    formData: {},
    errors: []
  });
});

/**
 * POST /lead - Process lead form submission
 */
router.post('/', rateLimiter, honeypot, verifyCaptcha, async (req, res) => {
  const { name, org, email, phone, notes } = req.body;
  const errors = [];

  // Validate required fields
  if (!name || !name.trim()) {
    errors.push('Name is required');
  }
  if (!email || !email.trim()) {
    errors.push('Email is required');
  } else if (!isValidEmail(email)) {
    errors.push('Please enter a valid email address');
  }

  if (errors.length > 0) {
    return res.render('lead', {
      title: 'Lead Form',
      honeypotField: getHoneypotField(),
      showCaptcha: shouldShowCaptcha(req),
      recaptchaSiteKey: process.env.RECAPTCHA_SITE_KEY,
      formData: { name, org, email, phone, notes },
      errors
    });
  }

  // Prepare form data
  const formData = {
    name: name.trim(),
    org: org?.trim() || '',
    email: email.trim().toLowerCase(),
    phone: phone?.trim() || '',
    notes: notes?.trim() || ''
  };

  // Metadata for logging
  const metadata = {
    ip: req.clientIp || req.ip,
    userAgent: req.clientUa || req.headers['user-agent'],
    timestamp: new Date().toISOString()
  };

  // Log the submission
  console.log(`[LEAD] New submission: ${JSON.stringify({ formData, metadata })}`);

  // Send emails
  try {
    await Promise.all([
      sendOwnerNotification('Lead', formData, metadata),
      sendAutoReply('lead inquiry', formData)
    ]);
  } catch (error) {
    console.error('[LEAD] Error sending emails:', error);
  }

  // Render success page
  res.render('form-success', {
    title: 'Thank You',
    message: 'Your lead inquiry has been submitted successfully. We will contact you soon.',
    formType: 'lead'
  });
});

/**
 * Validate email format
 */
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

module.exports = router;
