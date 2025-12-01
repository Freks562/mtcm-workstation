const fs = require('fs');
const path = require('path');

/**
 * Settings service for managing runtime configuration
 * Settings are stored in memory and optionally persisted to a JSON file
 */

const SETTINGS_FILE = path.join(__dirname, '../../data/settings.json');

// Default settings
const defaultSettings = {
  ALLOWLIST_IPS: process.env.ALLOWLIST_IPS || '',
  ALLOWLIST_EMAIL_DOMAINS: process.env.ALLOWLIST_EMAIL_DOMAINS || '',
  FORCE_CAPTCHA_ALL: process.env.FORCE_CAPTCHA_ALL === 'true'
};

// In-memory settings store
let settings = { ...defaultSettings };

/**
 * Initialize settings from file if exists
 */
const init = () => {
  try {
    // Ensure data directory exists
    const dataDir = path.dirname(SETTINGS_FILE);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    if (fs.existsSync(SETTINGS_FILE)) {
      const data = fs.readFileSync(SETTINGS_FILE, 'utf8');
      settings = { ...defaultSettings, ...JSON.parse(data) };
      console.log('[SETTINGS] Loaded settings from file');
    }
  } catch (error) {
    console.error('[SETTINGS] Error loading settings:', error);
  }
};

/**
 * Get all settings
 */
const getSettings = () => {
  return { ...settings };
};

/**
 * Update settings
 */
const updateSettings = (newSettings) => {
  settings = {
    ...settings,
    ALLOWLIST_IPS: newSettings.ALLOWLIST_IPS ?? settings.ALLOWLIST_IPS,
    ALLOWLIST_EMAIL_DOMAINS: newSettings.ALLOWLIST_EMAIL_DOMAINS ?? settings.ALLOWLIST_EMAIL_DOMAINS,
    FORCE_CAPTCHA_ALL: newSettings.FORCE_CAPTCHA_ALL ?? settings.FORCE_CAPTCHA_ALL
  };

  // Persist to file
  try {
    const dataDir = path.dirname(SETTINGS_FILE);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
    console.log('[SETTINGS] Settings saved to file');
  } catch (error) {
    console.error('[SETTINGS] Error saving settings:', error);
  }

  return settings;
};

/**
 * Test if an IP or email domain is in the allowlist
 */
const testAllowlist = (ip, email) => {
  const ipAllowlist = (settings.ALLOWLIST_IPS || '').split(',').map(i => i.trim()).filter(i => i);
  const domainAllowlist = (settings.ALLOWLIST_EMAIL_DOMAINS || '').split(',').map(d => d.trim().toLowerCase()).filter(d => d);
  
  const isIpAllowed = ip ? ipAllowlist.includes(ip.trim()) : false;
  const emailDomain = email ? email.split('@')[1]?.toLowerCase() : null;
  const isDomainAllowed = emailDomain ? domainAllowlist.includes(emailDomain) : false;

  return {
    ip: {
      value: ip || '',
      allowed: isIpAllowed,
      allowlist: ipAllowlist
    },
    email: {
      value: email || '',
      domain: emailDomain || '',
      allowed: isDomainAllowed,
      allowlist: domainAllowlist
    },
    isAllowed: isIpAllowed || isDomainAllowed
  };
};

// Initialize on load
init();

module.exports = {
  getSettings,
  updateSettings,
  testAllowlist,
  init
};
