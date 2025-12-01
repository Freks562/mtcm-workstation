const https = require('https');
const settingsService = require('../services/settingsService');

/**
 * reCAPTCHA v3 verification middleware
 */
const verifyCaptcha = async (req, res, next) => {
  const settings = settingsService.getSettings();
  const siteKey = process.env.RECAPTCHA_SITE_KEY;
  const secretKey = process.env.RECAPTCHA_SECRET;
  const forceAll = settings.FORCE_CAPTCHA_ALL === true || settings.FORCE_CAPTCHA_ALL === 'true' || 
                   process.env.FORCE_CAPTCHA_ALL === 'true';

  // Skip if reCAPTCHA not configured
  if (!siteKey || !secretKey) {
    return next();
  }

  // Check allowlist bypass (unless FORCE_CAPTCHA_ALL is enabled)
  if (!forceAll) {
    const { isIpAllowlisted, isEmailDomainAllowlisted } = require('./rateLimiter');
    const ip = req.clientIp || req.ip;
    const email = req.body?.email;

    if (isIpAllowlisted(ip) || isEmailDomainAllowlisted(email)) {
      return next();
    }
  }

  const captchaToken = req.body['g-recaptcha-response'];

  if (!captchaToken) {
    return res.status(400).render('error', {
      title: 'Verification Failed',
      message: 'Please complete the reCAPTCHA verification.'
    });
  }

  try {
    const verified = await verifyRecaptchaToken(secretKey, captchaToken, req.clientIp);
    
    if (!verified.success || verified.score < 0.5) {
      console.log(`[CAPTCHA] Verification failed for IP ${req.clientIp}: score=${verified.score}`);
      return res.status(400).render('error', {
        title: 'Verification Failed',
        message: 'reCAPTCHA verification failed. Please try again.'
      });
    }

    req.captchaScore = verified.score;
    next();
  } catch (error) {
    console.error('[CAPTCHA] Error verifying reCAPTCHA:', error);
    // Allow through on error if not forcing captcha
    if (!forceAll) {
      return next();
    }
    return res.status(500).render('error', {
      title: 'Verification Error',
      message: 'Unable to verify reCAPTCHA. Please try again.'
    });
  }
};

/**
 * Verify reCAPTCHA token with Google API
 */
const verifyRecaptchaToken = (secretKey, token, remoteIp) => {
  return new Promise((resolve, reject) => {
    const postData = `secret=${encodeURIComponent(secretKey)}&response=${encodeURIComponent(token)}&remoteip=${encodeURIComponent(remoteIp || '')}`;
    
    const options = {
      hostname: 'www.google.com',
      port: 443,
      path: '/recaptcha/api/siteverify',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
};

/**
 * Helper to check if captcha should be shown
 */
const shouldShowCaptcha = (req) => {
  const settings = settingsService.getSettings();
  const siteKey = process.env.RECAPTCHA_SITE_KEY;
  const secretKey = process.env.RECAPTCHA_SECRET;
  const forceAll = settings.FORCE_CAPTCHA_ALL === true || settings.FORCE_CAPTCHA_ALL === 'true' || 
                   process.env.FORCE_CAPTCHA_ALL === 'true';

  // No captcha if not configured
  if (!siteKey || !secretKey) {
    return false;
  }

  // Always show if force all is enabled
  if (forceAll) {
    return true;
  }

  // Check allowlist
  const { isIpAllowlisted } = require('./rateLimiter');
  const ip = req.clientIp || req.ip;

  if (isIpAllowlisted(ip)) {
    return false;
  }

  return true;
};

module.exports = { verifyCaptcha, shouldShowCaptcha, verifyRecaptchaToken };
