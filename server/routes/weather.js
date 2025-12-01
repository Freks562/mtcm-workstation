/**
 * Weather Routes - API endpoints for weather data with 5-min caching
 * Uses OpenWeatherMap API, aggregates forecast to daily data
 */
const express = require('express');
const router = express.Router();
const configStore = require('../config-store');

const OWM_API_KEY = process.env.OWM_API_KEY;
const OWM_BASE_URL = 'https://api.openweathermap.org/data/2.5';

// Simple in-memory cache with 5-minute TTL
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Get cached data or null if expired/missing
 */
function getCached(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

/**
 * Set cache entry
 */
function setCache(key, data) {
  cache.set(key, { data, timestamp: Date.now() });
}

/**
 * Fetch weather from OpenWeatherMap
 */
async function fetchWeather(city, units = 'metric') {
  if (!OWM_API_KEY) {
    return { error: 'Weather API not configured', code: 'NO_API_KEY' };
  }

  const cacheKey = `weather:${city}:${units}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  try {
    const url = `${OWM_BASE_URL}/weather?q=${encodeURIComponent(city)}&units=${units}&appid=${OWM_API_KEY}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || `Weather API error: ${response.status}`);
    }
    
    const data = await response.json();
    setCache(cacheKey, data);
    return data;
  } catch (error) {
    console.error('Weather fetch error:', error);
    return { error: error.message, code: 'FETCH_ERROR' };
  }
}

/**
 * Fetch weather by coordinates
 */
async function fetchWeatherByCoords(lat, lon, units = 'metric') {
  if (!OWM_API_KEY) {
    return { error: 'Weather API not configured', code: 'NO_API_KEY' };
  }

  const cacheKey = `weather:${lat},${lon}:${units}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  try {
    const url = `${OWM_BASE_URL}/weather?lat=${lat}&lon=${lon}&units=${units}&appid=${OWM_API_KEY}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || `Weather API error: ${response.status}`);
    }
    
    const data = await response.json();
    setCache(cacheKey, data);
    return data;
  } catch (error) {
    console.error('Weather fetch error:', error);
    return { error: error.message, code: 'FETCH_ERROR' };
  }
}

/**
 * Fetch and aggregate forecast to daily data
 * OWM returns 3-hour intervals; we aggregate to daily min/max/precip/clouds
 */
async function fetchForecast(city, units = 'metric') {
  if (!OWM_API_KEY) {
    return { error: 'Weather API not configured', code: 'NO_API_KEY' };
  }

  const cacheKey = `forecast:${city}:${units}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  try {
    const url = `${OWM_BASE_URL}/forecast?q=${encodeURIComponent(city)}&units=${units}&appid=${OWM_API_KEY}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || `Forecast API error: ${response.status}`);
    }
    
    const rawData = await response.json();
    const aggregated = aggregateForecast(rawData);
    setCache(cacheKey, aggregated);
    return aggregated;
  } catch (error) {
    console.error('Forecast fetch error:', error);
    return { error: error.message, code: 'FETCH_ERROR' };
  }
}

/**
 * Fetch forecast by coordinates
 */
async function fetchForecastByCoords(lat, lon, units = 'metric') {
  if (!OWM_API_KEY) {
    return { error: 'Weather API not configured', code: 'NO_API_KEY' };
  }

  const cacheKey = `forecast:${lat},${lon}:${units}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  try {
    const url = `${OWM_BASE_URL}/forecast?lat=${lat}&lon=${lon}&units=${units}&appid=${OWM_API_KEY}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || `Forecast API error: ${response.status}`);
    }
    
    const rawData = await response.json();
    const aggregated = aggregateForecast(rawData);
    setCache(cacheKey, aggregated);
    return aggregated;
  } catch (error) {
    console.error('Forecast fetch error:', error);
    return { error: error.message, code: 'FETCH_ERROR' };
  }
}

/**
 * Aggregate 3-hour forecast intervals to daily summaries
 */
function aggregateForecast(rawData) {
  if (!rawData.list || !Array.isArray(rawData.list)) {
    return { error: 'Invalid forecast data', code: 'INVALID_DATA' };
  }

  // Group by date
  const dailyMap = new Map();
  
  for (const item of rawData.list) {
    const date = item.dt_txt.split(' ')[0]; // YYYY-MM-DD
    
    if (!dailyMap.has(date)) {
      dailyMap.set(date, {
        date,
        temps: [],
        precip: 0,
        clouds: [],
        icons: [],
        descriptions: []
      });
    }
    
    const day = dailyMap.get(date);
    day.temps.push(item.main.temp);
    day.clouds.push(item.clouds.all);
    
    // Accumulate precipitation (rain + snow in mm)
    if (item.rain && item.rain['3h']) {
      day.precip += item.rain['3h'];
    }
    if (item.snow && item.snow['3h']) {
      day.precip += item.snow['3h'];
    }
    
    // Take most common icon/description (midday preferred)
    if (item.weather && item.weather[0]) {
      day.icons.push(item.weather[0].icon);
      day.descriptions.push(item.weather[0].description);
    }
  }

  // Convert to daily array
  const daily = Array.from(dailyMap.values()).map(day => ({
    date: day.date,
    min: Math.round(Math.min(...day.temps) * 10) / 10,
    max: Math.round(Math.max(...day.temps) * 10) / 10,
    precip: Math.round(day.precip * 10) / 10,
    clouds: Math.round(day.clouds.reduce((a, b) => a + b, 0) / day.clouds.length),
    icon: getMostFrequent(day.icons) || '01d',
    desc: getMostFrequent(day.descriptions) || 'Clear'
  }));

  return {
    city: rawData.city,
    daily: daily.slice(0, 5) // 5-day forecast
  };
}

/**
 * Get most frequent item in array
 */
function getMostFrequent(arr) {
  if (!arr.length) return null;
  const counts = {};
  let maxItem = arr[0];
  let maxCount = 1;
  
  for (const item of arr) {
    counts[item] = (counts[item] || 0) + 1;
    if (counts[item] > maxCount) {
      maxCount = counts[item];
      maxItem = item;
    }
  }
  return maxItem;
}

// GET /api/weather - Get current weather
router.get('/', async (req, res) => {
  const config = configStore.getPublicConfig();
  const { city, lat, lon } = req.query;
  const units = req.query.units || config.weatherDefaultUnits;
  
  let data;
  if (lat && lon) {
    data = await fetchWeatherByCoords(lat, lon, units);
  } else {
    data = await fetchWeather(city || config.weatherDefaultCity, units);
  }
  
  if (data.error) {
    return res.status(data.code === 'NO_API_KEY' ? 503 : 500).json(data);
  }
  
  res.json(data);
});

// GET /api/weather/geolocate - Alias for coords-based weather
router.get('/geolocate', async (req, res) => {
  const { lat, lon } = req.query;
  
  if (!lat || !lon) {
    return res.status(400).json({ error: 'lat and lon parameters required' });
  }
  
  const config = configStore.getPublicConfig();
  const units = req.query.units || config.weatherDefaultUnits;
  
  const data = await fetchWeatherByCoords(lat, lon, units);
  
  if (data.error) {
    return res.status(data.code === 'NO_API_KEY' ? 503 : 500).json(data);
  }
  
  res.json(data);
});

// GET /api/weather/forecast - Get aggregated daily forecast
router.get('/forecast', async (req, res) => {
  const config = configStore.getPublicConfig();
  const { city, lat, lon } = req.query;
  const units = req.query.units || config.weatherDefaultUnits;
  
  let data;
  if (lat && lon) {
    data = await fetchForecastByCoords(lat, lon, units);
  } else {
    data = await fetchForecast(city || config.weatherDefaultCity, units);
  }
  
  if (data.error) {
    return res.status(data.code === 'NO_API_KEY' ? 503 : 500).json(data);
  }
  
  res.json(data);
});

// GET /api/weather/config - Get weather configuration
router.get('/config', (req, res) => {
  const config = configStore.getPublicConfig();
  res.json({
    city: config.weatherDefaultCity,
    units: config.weatherDefaultUnits,
    alertMm: config.weatherAlertPrecipMm,
    apiConfigured: !!OWM_API_KEY
  });
});

module.exports = router;
