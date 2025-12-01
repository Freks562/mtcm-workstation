const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { createStrictRateLimiter } = require('../middleware/rateLimiter');
const logger = require('../services/logger');
const { addAuditLog } = require('../services/auditLog');

// Apply strict rate limiting to contact form
router.use(createStrictRateLimiter());

// In-memory contact submissions storage
const contacts = [];
const leads = [];

/**
 * Contact form page
 * GET /contact
 */
router.get('/', (req, res) => {
  res.render('contact/index', {
    title: 'Contact Us - MTCM Portal',
    recaptchaSiteKey: process.env.RECAPTCHA_SITE_KEY
  });
});

/**
 * Validate honeypot field - if filled, it's a bot
 */
function validateHoneypot(req, res, next) {
  // The honeypot field should be empty (hidden from users, but bots fill it)
  const honeypotValue = req.body.website || req.body.phone_confirm || '';
  
  if (honeypotValue.length > 0) {
    logger.warn(`Honeypot triggered from IP: ${req.ip}`);
    addAuditLog({
      action: 'SPAM_BLOCKED',
      details: 'Honeypot field triggered',
      ip: req.ip,
      userAgent: req.get('user-agent'),
      metadata: { honeypotValue }
    });
    
    // Return success to fool the bot
    return res.json({ success: true, message: 'Message sent successfully' });
  }
  
  next();
}

/**
 * Validate reCAPTCHA
 */
async function validateRecaptcha(req, res, next) {
  if (!process.env.RECAPTCHA_SECRET_KEY) {
    // Skip validation if not configured
    return next();
  }

  const recaptchaResponse = req.body['g-recaptcha-response'];
  
  if (!recaptchaResponse) {
    return res.status(400).json({ 
      error: 'reCAPTCHA required', 
      message: 'Please complete the reCAPTCHA verification' 
    });
  }

  try {
    const verifyUrl = 'https://www.google.com/recaptcha/api/siteverify';
    const response = await fetch(verifyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `secret=${process.env.RECAPTCHA_SECRET_KEY}&response=${recaptchaResponse}&remoteip=${req.ip}`
    });

    const data = await response.json();

    if (!data.success) {
      logger.warn(`reCAPTCHA verification failed for IP: ${req.ip}`);
      return res.status(400).json({ 
        error: 'reCAPTCHA failed', 
        message: 'reCAPTCHA verification failed. Please try again.' 
      });
    }

    next();
  } catch (err) {
    logger.error('reCAPTCHA verification error:', err);
    // Allow submission if reCAPTCHA service is down
    next();
  }
}

/**
 * Submit contact form
 * POST /contact
 */
router.post('/',
  validateHoneypot,
  validateRecaptcha,
  [
    body('name')
      .trim()
      .notEmpty().withMessage('Name is required')
      .isLength({ min: 2, max: 100 }).withMessage('Name must be 2-100 characters'),
    body('email')
      .trim()
      .notEmpty().withMessage('Email is required')
      .isEmail().withMessage('Please enter a valid email address')
      .normalizeEmail(),
    body('subject')
      .trim()
      .notEmpty().withMessage('Subject is required')
      .isLength({ min: 5, max: 200 }).withMessage('Subject must be 5-200 characters'),
    body('message')
      .trim()
      .notEmpty().withMessage('Message is required')
      .isLength({ min: 10, max: 5000 }).withMessage('Message must be 10-5000 characters'),
    body('company')
      .optional()
      .trim()
      .isLength({ max: 200 }).withMessage('Company name too long')
  ],
  (req, res) => {
    const errors = validationResult(req);
    
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        errors: errors.array() 
      });
    }

    const { name, email, subject, message, company } = req.body;

    const contact = {
      id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
      name,
      email,
      subject,
      message,
      company: company || null,
      ip: req.ip,
      userAgent: req.get('user-agent'),
      createdAt: new Date().toISOString(),
      status: 'new'
    };

    contacts.unshift(contact);

    addAuditLog({
      action: 'CONTACT_SUBMIT',
      details: `Contact form submitted: ${subject}`,
      ip: req.ip,
      userAgent: req.get('user-agent'),
      metadata: { contactId: contact.id, email }
    });

    logger.info(`Contact form submitted by ${email}: ${subject}`);

    res.json({ 
      success: true, 
      message: 'Thank you for your message. We will get back to you soon.' 
    });
  }
);

/**
 * Submit lead form (for federal sales)
 * POST /contact/lead
 */
router.post('/lead',
  validateHoneypot,
  validateRecaptcha,
  [
    body('name')
      .trim()
      .notEmpty().withMessage('Name is required')
      .isLength({ min: 2, max: 100 }),
    body('email')
      .trim()
      .notEmpty().withMessage('Email is required')
      .isEmail()
      .normalizeEmail(),
    body('agency')
      .trim()
      .notEmpty().withMessage('Agency is required')
      .isLength({ min: 2, max: 200 }),
    body('phone')
      .optional()
      .trim()
      .matches(/^[\d\s\-+()]*$/).withMessage('Invalid phone format'),
    body('interest')
      .trim()
      .notEmpty().withMessage('Area of interest is required'),
    body('timeline')
      .optional()
      .trim(),
    body('budget')
      .optional()
      .trim()
  ],
  (req, res) => {
    const errors = validationResult(req);
    
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        errors: errors.array() 
      });
    }

    const { name, email, agency, phone, interest, timeline, budget } = req.body;

    const lead = {
      id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
      name,
      email,
      agency,
      phone: phone || null,
      interest,
      timeline: timeline || null,
      budget: budget || null,
      ip: req.ip,
      userAgent: req.get('user-agent'),
      createdAt: new Date().toISOString(),
      status: 'new'
    };

    leads.unshift(lead);

    addAuditLog({
      action: 'LEAD_SUBMIT',
      details: `Federal lead submitted from ${agency}`,
      ip: req.ip,
      userAgent: req.get('user-agent'),
      metadata: { leadId: lead.id, agency, interest }
    });

    logger.info(`Federal lead submitted by ${email} from ${agency}`);

    res.json({ 
      success: true, 
      message: 'Thank you for your interest. Our federal sales team will contact you shortly.' 
    });
  }
);

/**
 * Get contacts (admin only - will be protected in admin routes)
 */
function getContacts() {
  return contacts;
}

/**
 * Get leads (admin only)
 */
function getLeads() {
  return leads;
}

module.exports = router;
module.exports.getContacts = getContacts;
module.exports.getLeads = getLeads;
