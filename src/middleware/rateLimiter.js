const settingsService = require('../services/settingsService');

/**
 * Rate limiting middleware with Redis-ready hook
 * Uses memory store by default, can switch to Redis when REDIS_URL is set
 */

// In-memory store for rate limiting
const memoryStore = new Map();

// Cleanup old entries periodically (every 5 minutes)
setInterval(() => {
  const now = Date.now();
  for (const [key, data] of memoryStore.entries()) {
    if (data.resetTime < now) {
      memoryStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

/**
 * Get rate limit store (memory or Redis)
 */
const getStore = () => {
  // Redis-ready hook: check for REDIS_URL
  if (process.env.REDIS_URL) {
    // Future: implement Redis store here
    // const redis = require('redis');
    // return createRedisStore(process.env.REDIS_URL);
    console.log('[RATE_LIMIT] Redis URL configured but not yet implemented, using memory store');
  }
  return {
    type: 'memory',
    get: (key) => memoryStore.get(key),
    set: (key, value) => memoryStore.set(key, value),
    delete: (key) => memoryStore.delete(key)
  };
};

/**
 * Check if IP is in allowlist
 */
const isIpAllowlisted = (ip) => {
  const settings = settingsService.getSettings();
  const allowlistIps = settings.ALLOWLIST_IPS || process.env.ALLOWLIST_IPS || '';
  const ipList = allowlistIps.split(',').map(i => i.trim()).filter(i => i);
  return ipList.includes(ip);
};

/**
 * Check if email domain is in allowlist
 */
const isEmailDomainAllowlisted = (email) => {
  if (!email) return false;
  const settings = settingsService.getSettings();
  const allowlistDomains = settings.ALLOWLIST_EMAIL_DOMAINS || process.env.ALLOWLIST_EMAIL_DOMAINS || '';
  const domainList = allowlistDomains.split(',').map(d => d.trim().toLowerCase()).filter(d => d);
  const emailDomain = email.split('@')[1]?.toLowerCase();
  return domainList.includes(emailDomain);
};

/**
 * Rate limiting middleware factory
 */
const createRateLimiter = (options = {}) => {
  const windowMs = options.windowMs || parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000; // 15 minutes
  const max = options.max || parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 5;
  const store = getStore();

  return (req, res, next) => {
    const ip = req.clientIp || req.ip || 'unknown';
    
    // Check if IP is allowlisted (bypass rate limit)
    if (isIpAllowlisted(ip)) {
      return next();
    }

    // Check if email domain is allowlisted (bypass rate limit)
    const email = req.body?.email;
    if (email && isEmailDomainAllowlisted(email)) {
      return next();
    }

    const key = `ratelimit:${ip}`;
    const now = Date.now();
    
    let data = store.get(key);
    
    if (!data || data.resetTime < now) {
      // First request or window expired
      data = {
        count: 1,
        resetTime: now + windowMs
      };
      store.set(key, data);
      return next();
    }

    data.count++;
    store.set(key, data);

    if (data.count > max) {
      const retryAfter = Math.ceil((data.resetTime - now) / 1000);
      console.log(`[RATE_LIMIT] IP ${ip} exceeded limit (${data.count}/${max})`);
      
      return res.status(429).render('error', {
        title: 'Too Many Requests',
        message: `You have exceeded the rate limit. Please try again in ${Math.ceil(retryAfter / 60)} minutes.`
      });
    }

    next();
  };
};

// Export for testing purposes
const resetStore = () => {
  memoryStore.clear();
};

module.exports = { 
  createRateLimiter, 
  isIpAllowlisted, 
  isEmailDomainAllowlisted,
  resetStore 
};
