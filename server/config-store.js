/**
 * Config Store - Persist settings for MTCM Portal
 */
const fs = require('fs');
const path = require('path');

const CONFIG_FILE = path.join(__dirname, '../data/config.json');
const DATA_DIR = path.join(__dirname, '../data');

// Default configuration
const defaultConfig = {
  siteName: 'MTCM Portal',
  weatherDefaultCity: process.env.WEATHER_DEFAULT_CITY || 'Washington DC',
  weatherDefaultUnits: process.env.WEATHER_DEFAULT_UNITS || 'metric',
  weatherAlertPrecipMm: parseInt(process.env.WEATHER_ALERT_PRECIP_MM, 10) || 10,
  contactEmail: process.env.CONTACT_EMAIL || '',
  leadNotifyEmail: process.env.LEAD_NOTIFY_EMAIL || '',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
};

let config = { ...defaultConfig };
let isInitialized = false;

/**
 * Initialize the config store
 */
function init() {
  try {
    // Create data directory if it doesn't exist
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    // Load existing config or create new one
    if (fs.existsSync(CONFIG_FILE)) {
      const data = fs.readFileSync(CONFIG_FILE, 'utf8');
      config = { ...defaultConfig, ...JSON.parse(data) };
    } else {
      saveConfig();
    }
    isInitialized = true;
  } catch (error) {
    console.error('Config store initialization error:', error);
    isInitialized = true; // Still mark as ready, using defaults
  }
}

/**
 * Save config to file
 */
function saveConfig() {
  try {
    config.updatedAt = new Date().toISOString();
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
    return true;
  } catch (error) {
    console.error('Error saving config:', error);
    return false;
  }
}

/**
 * Get full configuration (admin only)
 */
function getConfig() {
  return { ...config };
}

/**
 * Get public-safe configuration
 */
function getPublicConfig() {
  return {
    siteName: config.siteName,
    weatherDefaultCity: config.weatherDefaultCity,
    weatherDefaultUnits: config.weatherDefaultUnits
  };
}

/**
 * Update configuration
 */
function updateConfig(updates) {
  config = { ...config, ...updates };
  return saveConfig();
}

/**
 * Check if config store is ready
 */
function isReady() {
  return isInitialized;
}

// Initialize on load
init();

module.exports = {
  getConfig,
  getPublicConfig,
  updateConfig,
  isReady,
  init
};
