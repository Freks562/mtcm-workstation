const logger = require('./logger');

// In-memory audit log storage (use database in production)
const auditLogs = [];
const MAX_LOGS = 10000;

/**
 * Add an entry to the audit log
 * @param {Object} logEntry - The audit log entry
 * @param {string} logEntry.action - The action performed (LOGIN, LOGOUT, CREATE, UPDATE, DELETE, etc.)
 * @param {string} logEntry.userId - ID of the user performing the action
 * @param {string} logEntry.userEmail - Email of the user
 * @param {string} logEntry.details - Description of the action
 * @param {string} logEntry.ip - IP address of the request
 * @param {string} logEntry.userAgent - User agent of the request
 * @param {Object} logEntry.metadata - Additional metadata
 */
function addAuditLog(logEntry) {
  const entry = {
    id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
    timestamp: new Date().toISOString(),
    action: logEntry.action,
    userId: logEntry.userId || 'anonymous',
    userEmail: logEntry.userEmail || 'anonymous',
    details: logEntry.details || '',
    ip: logEntry.ip || 'unknown',
    userAgent: logEntry.userAgent || 'unknown',
    metadata: logEntry.metadata || {}
  };

  auditLogs.unshift(entry);

  // Keep only the most recent logs
  if (auditLogs.length > MAX_LOGS) {
    auditLogs.pop();
  }

  logger.info(`Audit: [${entry.action}] ${entry.userEmail} - ${entry.details}`);

  return entry;
}

/**
 * Get audit logs with pagination and filtering
 * @param {Object} options - Query options
 * @param {number} options.page - Page number (1-based)
 * @param {number} options.limit - Items per page
 * @param {string} options.action - Filter by action type
 * @param {string} options.userId - Filter by user ID
 * @param {string} options.startDate - Filter by start date (ISO string)
 * @param {string} options.endDate - Filter by end date (ISO string)
 */
function getAuditLogs(options = {}) {
  const {
    page = 1,
    limit = 50,
    action,
    userId,
    startDate,
    endDate
  } = options;

  let filtered = [...auditLogs];

  // Apply filters
  if (action) {
    filtered = filtered.filter(log => log.action === action);
  }

  if (userId) {
    filtered = filtered.filter(log => log.userId === userId);
  }

  if (startDate) {
    const start = new Date(startDate);
    filtered = filtered.filter(log => new Date(log.timestamp) >= start);
  }

  if (endDate) {
    const end = new Date(endDate);
    filtered = filtered.filter(log => new Date(log.timestamp) <= end);
  }

  // Pagination
  const total = filtered.length;
  const totalPages = Math.ceil(total / limit);
  const offset = (page - 1) * limit;
  const logs = filtered.slice(offset, offset + limit);

  return {
    logs,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1
    }
  };
}

/**
 * Get audit log actions summary
 */
function getAuditSummary() {
  const actionCounts = {};
  const userCounts = {};

  auditLogs.forEach(log => {
    actionCounts[log.action] = (actionCounts[log.action] || 0) + 1;
    userCounts[log.userEmail] = (userCounts[log.userEmail] || 0) + 1;
  });

  return {
    totalLogs: auditLogs.length,
    actionCounts,
    topUsers: Object.entries(userCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([email, count]) => ({ email, count }))
  };
}

/**
 * Clear all audit logs (admin only)
 */
function clearAuditLogs() {
  const count = auditLogs.length;
  auditLogs.length = 0;
  logger.warn(`Audit logs cleared (${count} entries removed)`);
  return count;
}

module.exports = {
  addAuditLog,
  getAuditLogs,
  getAuditSummary,
  clearAuditLogs
};
