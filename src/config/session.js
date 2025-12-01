const logger = require('../services/logger');

/**
 * Session configuration with optional Redis store
 */
function sessionConfig() {
  const config = {
    secret: process.env.SESSION_SECRET || 'mtcm-default-secret-change-me',
    resave: false,
    saveUninitialized: false,
    name: 'mtcm.sid',
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      sameSite: 'lax'
    }
  };

  // Use Redis store in production if available
  if (process.env.REDIS_URL && process.env.NODE_ENV === 'production') {
    try {
      const RedisStore = require('connect-redis').default;
      const Redis = require('ioredis');

      const redisClient = new Redis(process.env.REDIS_URL, {
        enableOfflineQueue: false,
        maxRetriesPerRequest: 3
      });

      redisClient.on('error', (err) => {
        logger.error('Redis session store error:', err);
      });

      redisClient.on('connect', () => {
        logger.info('Connected to Redis for session storage');
      });

      config.store = new RedisStore({
        client: redisClient,
        prefix: 'mtcm:sess:'
      });

      logger.info('Session using Redis store');
    } catch (err) {
      logger.warn('Failed to initialize Redis session store, using memory store:', err.message);
    }
  } else {
    logger.info('Session using in-memory store (not recommended for production)');
  }

  return config;
}

module.exports = { sessionConfig };
