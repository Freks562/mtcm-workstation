/**
 * Forms Routes - Lead and Contact form handling
 * Features:
 * - Honeypot field (company2) - silently drops bot submissions
 * - Per-IP rate limiting (3/min) with Redis support
 * - Allowlist bypass for trusted IPs/domains
 * - Email notifications via SMTP
 */
const express = require('express');
const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');

const SUBMISSIONS_DIR = path.join(__dirname, '../../data/submissions');

// Ensure submissions directory exists
if (!fs.existsSync(SUBMISSIONS_DIR)) {
  fs.mkdirSync(SUBMISSIONS_DIR, { recursive: true });
}

// Parse allowlist environment variables
const ALLOWLIST_IPS = (process.env.ALLOWLIST_IPS || '')
  .split(',')
  .map(ip => ip.trim())
  .filter(Boolean);

const ALLOWLIST_EMAIL_DOMAINS = (process.env.ALLOWLIST_EMAIL_DOMAINS || '')
  .split(',')
  .map(d => d.trim().toLowerCase())
  .filter(Boolean);

// In-memory rate limiter (fallback when Redis not available)
const rateLimitStore = new Map();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX = 3; // 3 requests per minute

/**
 * Simple in-memory rate limiter
 * Returns true if request should be allowed
 */
function checkRateLimit(ip) {
  const now = Date.now();
  const entry = rateLimitStore.get(ip);
  
  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW) {
    rateLimitStore.set(ip, { windowStart: now, count: 1 });
    return true;
  }
  
  if (entry.count >= RATE_LIMIT_MAX) {
    return false;
  }
  
  entry.count++;
  return true;
}

/**
 * Check if IP or email domain is allowlisted
 */
function isAllowlisted(ip, email) {
  // Check IP allowlist
  if (ALLOWLIST_IPS.includes(ip)) {
    return true;
  }
  
  // Check email domain allowlist
  if (email && ALLOWLIST_EMAIL_DOMAINS.length > 0) {
    const domain = email.split('@')[1]?.toLowerCase();
    if (domain && ALLOWLIST_EMAIL_DOMAINS.includes(domain)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Save form submission to file
 */
function saveSubmission(type, data) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `${type}_${timestamp}.json`;
  const filepath = path.join(SUBMISSIONS_DIR, filename);
  
  try {
    fs.writeFileSync(filepath, JSON.stringify({
      type,
      timestamp: new Date().toISOString(),
      ...data
    }, null, 2));
    return true;
  } catch (error) {
    console.error('Error saving submission:', error);
    return false;
  }
}

/**
 * Validate honeypot field (company2 should be empty)
 */
function validateHoneypot(req) {
  // Honeypot field should be empty if human
  const honeypotField = req.body.company2 || '';
  return honeypotField === '';
}

/**
 * Create nodemailer transporter from SMTP env vars
 */
function createMailer() {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER) {
    return null;
  }
  
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT, 10) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
}

/**
 * Send notification email to owner
 */
async function sendOwnerNotification(type, data) {
  const mailer = createMailer();
  if (!mailer) return;
  
  const ownerEmails = process.env.OWNER_EMAILS || process.env.ALLOWED_EMAILS || '';
  if (!ownerEmails) return;
  
  try {
    await mailer.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: ownerEmails,
      subject: `New ${type} submission from ${data.name}`,
      text: `
New ${type} submission received:

Name: ${data.name}
Email: ${data.email}
${data.phone ? `Phone: ${data.phone}` : ''}
${data.company ? `Company: ${data.company}` : ''}
${data.subject ? `Subject: ${data.subject}` : ''}

Message:
${data.message || 'N/A'}

---
Submitted at: ${new Date().toISOString()}
IP: ${data.ip}
      `.trim()
    });
  } catch (error) {
    console.error('Failed to send owner notification:', error);
  }
}

/**
 * Send auto-reply to submitter
 */
async function sendAutoReply(type, data) {
  const mailer = createMailer();
  if (!mailer) return;
  
  try {
    await mailer.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: data.email,
      subject: type === 'lead' 
        ? 'Thank you for your interest!' 
        : 'We received your message',
      text: `
Hi ${data.name},

Thank you for ${type === 'lead' ? 'your interest in our services' : 'contacting us'}. 
We have received your ${type === 'lead' ? 'request' : 'message'} and will get back to you soon.

Best regards,
MTCM Portal Team
      `.trim()
    });
  } catch (error) {
    console.error('Failed to send auto-reply:', error);
  }
}

/**
 * Email validation regex
 */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

module.exports = function(defaultRateLimiter) {
  const router = express.Router();

  // Rate limit middleware for forms
  const formRateLimiter = (req, res, next) => {
    const ip = req.ip || req.connection.remoteAddress;
    const email = req.body.email || '';
    
    // Skip rate limit for allowlisted IPs/domains
    if (isAllowlisted(ip, email)) {
      return next();
    }
    
    if (!checkRateLimit(ip)) {
      return res.status(429).json({ 
        ok: false, 
        error: 'Too many submissions. Please try again later.' 
      });
    }
    
    next();
  };

  // Lead form page
  router.get('/lead', (req, res) => {
    res.render('lead', { 
      title: 'Request Information',
      user: req.user,
      success: req.query.success === '1',
      error: req.query.error
    });
  });

  // Lead form submission
  router.post('/lead', formRateLimiter, async (req, res) => {
    // Check honeypot - silently accept to fool bots
    if (!validateHoneypot(req)) {
      console.log('Honeypot triggered on lead form');
      return res.json({ ok: true });
    }

    const { name, email, phone, company, message } = req.body;

    // Basic validation
    if (!name || !email) {
      return res.status(400).json({ ok: false, error: 'Name and email are required' });
    }

    // Email format validation
    if (!EMAIL_REGEX.test(email)) {
      return res.status(400).json({ ok: false, error: 'Invalid email format' });
    }

    const submissionData = {
      name: name.trim(),
      email: email.trim().toLowerCase(),
      phone: phone ? phone.trim() : '',
      company: company ? company.trim() : '',
      message: message ? message.trim() : '',
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent') || ''
    };

    // Save submission
    const saved = saveSubmission('lead', submissionData);

    if (!saved) {
      return res.status(500).json({ ok: false, error: 'Failed to save submission' });
    }

    // Send emails asynchronously (don't block response)
    sendOwnerNotification('lead', submissionData);
    sendAutoReply('lead', submissionData);

    res.json({ ok: true });
  });

  // Contact form page
  router.get('/contact', (req, res) => {
    res.render('contact', { 
      title: 'Contact Us',
      user: req.user,
      success: req.query.success === '1',
      error: req.query.error
    });
  });

  // Contact form submission
  router.post('/contact', formRateLimiter, async (req, res) => {
    // Check honeypot
    if (!validateHoneypot(req)) {
      console.log('Honeypot triggered on contact form');
      return res.json({ ok: true });
    }

    const { name, email, subject, message } = req.body;

    // Basic validation
    if (!name || !email || !message) {
      return res.status(400).json({ ok: false, error: 'Name, email, and message are required' });
    }

    // Email format validation
    if (!EMAIL_REGEX.test(email)) {
      return res.status(400).json({ ok: false, error: 'Invalid email format' });
    }

    const submissionData = {
      name: name.trim(),
      email: email.trim().toLowerCase(),
      subject: subject ? subject.trim() : 'General Inquiry',
      message: message.trim(),
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent') || ''
    };

    // Save submission
    const saved = saveSubmission('contact', submissionData);

    if (!saved) {
      return res.status(500).json({ ok: false, error: 'Failed to save submission' });
    }

    // Send emails asynchronously
    sendOwnerNotification('contact', submissionData);
    sendAutoReply('contact', submissionData);

    res.json({ ok: true });
  });

  // Weather page
  router.get('/weather', (req, res) => {
    res.render('weather', { 
      title: 'Weather',
      user: req.user
    });
  });

  return router;
};
