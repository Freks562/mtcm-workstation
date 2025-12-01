/**
 * Request logging middleware
 * Logs IP address and User-Agent for each request
 */
const requestLogger = (req, res, next) => {
  const ip = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  const ua = req.headers['user-agent'] || 'Unknown';
  const timestamp = new Date().toISOString();
  
  console.log(`[${timestamp}] ${req.method} ${req.path} - IP: ${ip} - UA: ${ua}`);
  
  // Store in request for later use
  req.clientIp = ip;
  req.clientUa = ua;
  
  next();
};

module.exports = { requestLogger };
