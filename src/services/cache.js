const config = require('../config');

// Simple in-memory cache
const cache = new Map();

/**
 * Get cached data if still valid
 * @param {string} key - Cache key
 * @returns {object|null} - Cached data or null if expired/missing
 */
function get(key) {
  const item = cache.get(key);
  if (!item) return null;
  
  if (Date.now() > item.expiresAt) {
    cache.delete(key);
    return null;
  }
  
  return item.data;
}

/**
 * Set data in cache
 * @param {string} key - Cache key
 * @param {object} data - Data to cache
 * @param {number} ttlMs - Time to live in milliseconds (default: 5 minutes)
 */
function set(key, data, ttlMs = config.cacheTtlMs) {
  cache.set(key, {
    data,
    expiresAt: Date.now() + ttlMs
  });
}

/**
 * Clear all cached data
 */
function clear() {
  cache.clear();
}

/**
 * Get size of cache
 * @returns {number}
 */
function size() {
  return cache.size;
}

module.exports = { get, set, clear, size };
