const express = require('express');
const router = express.Router();
const os = require('os');
const logger = require('../services/logger');

// Track server start time for uptime calculation
const startTime = Date.now();

/**
 * Health check endpoint - basic liveness probe
 * GET /health
 */
router.get('/', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: Math.floor((Date.now() - startTime) / 1000),
    service: 'mtcm-portal'
  });
});

/**
 * Detailed health check with system metrics
 * GET /health/detailed
 */
router.get('/detailed', (req, res) => {
  const memoryUsage = process.memoryUsage();
  const cpuUsage = os.loadavg();

  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: Math.floor((Date.now() - startTime) / 1000),
    service: 'mtcm-portal',
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    memory: {
      heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
      heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024),
      external: Math.round(memoryUsage.external / 1024 / 1024),
      rss: Math.round(memoryUsage.rss / 1024 / 1024)
    },
    cpu: {
      loadAvg1m: cpuUsage[0],
      loadAvg5m: cpuUsage[1],
      loadAvg15m: cpuUsage[2]
    },
    system: {
      platform: os.platform(),
      arch: os.arch(),
      nodeVersion: process.version
    }
  });
});

/**
 * Readiness probe - checks if app is ready to serve traffic
 * GET /health/ready
 */
router.get('/ready', async (req, res) => {
  const checks = {
    server: true,
    redis: null
  };

  // Check Redis connection if configured
  if (process.env.REDIS_URL) {
    try {
      const Redis = require('ioredis');
      const redis = new Redis(process.env.REDIS_URL, {
        connectTimeout: 2000,
        maxRetriesPerRequest: 1
      });
      
      await redis.ping();
      checks.redis = true;
      await redis.quit();
    } catch (err) {
      checks.redis = false;
      logger.warn('Redis readiness check failed:', err.message);
    }
  }

  const isReady = checks.server && (checks.redis === null || checks.redis);

  res.status(isReady ? 200 : 503).json({
    status: isReady ? 'ready' : 'not_ready',
    timestamp: new Date().toISOString(),
    checks
  });
});

/**
 * Liveness probe - simple check that server is alive
 * GET /health/live
 */
router.get('/live', (req, res) => {
  res.status(200).json({
    status: 'alive',
    timestamp: new Date().toISOString()
  });
});

/**
 * Blue-green deployment hooks
 * POST /health/drain - Prepare for shutdown
 */
router.post('/drain', (req, res) => {
  logger.info('Received drain request - preparing for shutdown');
  // Could add graceful shutdown logic here
  res.json({
    status: 'draining',
    message: 'Server is preparing for shutdown'
  });
});

/**
 * POST /health/activate - Activate after deployment
 */
router.post('/activate', (req, res) => {
  logger.info('Received activate request - server is active');
  res.json({
    status: 'active',
    message: 'Server is ready to receive traffic'
  });
});

module.exports = router;
