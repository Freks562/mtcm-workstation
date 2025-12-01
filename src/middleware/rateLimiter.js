const rateLimit = require('express-rate-limit');
const logger = require('../services/logger');

/**
 * Creates a rate limiter middleware with optional Redis store
 * Falls back to in-memory store if Redis is not available
 */
function createRateLimiter(options = {}) {
  const windowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000; // 15 minutes
  const max = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100;

  const limiterConfig = {
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      error: 'Too many requests',
      message: 'You have exceeded the rate limit. Please try again later.',
      retryAfter: Math.ceil(windowMs / 1000)
    },
    handler: (req, res, next, options) => {
      logger.warn(`Rate limit exceeded for IP: ${req.ip}`);
      res.status(429).json(options.message);
    },
    keyGenerator: (req) => {
      // Use X-Forwarded-For header if behind a proxy, otherwise use IP
      return req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    },
    skip: (req) => {
      // Skip rate limiting for health checks
      return req.path.startsWith('/health');
    },
    ...options
  };

  // Try to use Redis store if available
  if (process.env.REDIS_URL) {
    try {
      const RedisStore = require('rate-limit-redis');
      const Redis = require('ioredis');
      
      const redisClient = new Redis(process.env.REDIS_URL, {
        enableOfflineQueue: false,
        maxRetriesPerRequest: 1
      });

      redisClient.on('error', (err) => {
        logger.error('Redis rate limiter error:', err);
      });

      limiterConfig.store = new RedisStore({
        sendCommand: (...args) => redisClient.call(...args),
        prefix: 'mtcm:rl:'
      });

      logger.info('Rate limiter using Redis store');
    } catch (err) {
      logger.warn('Failed to initialize Redis rate limiter, using in-memory store:', err.message);
    }
  } else {
    logger.info('Rate limiter using in-memory store');
  }

  return rateLimit(limiterConfig);
}

/**
 * Strict rate limiter for sensitive endpoints (login, contact forms)
 */
function createStrictRateLimiter() {
  return createRateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // 10 requests per window
    message: {
      error: 'Too many attempts',
      message: 'You have made too many attempts. Please wait 15 minutes before trying again.'
    }
  });
}

/**
 * Very strict rate limiter for API endpoints
 */
function createApiRateLimiter() {
  return createRateLimiter({
    windowMs: 60 * 1000, // 1 minute
    max: 30, // 30 requests per minute
    message: {
      error: 'API rate limit exceeded',
      message: 'You have exceeded the API rate limit. Please slow down your requests.'
    }
  });
}

module.exports = {
  createRateLimiter,
  createStrictRateLimiter,
  createApiRateLimiter
};
