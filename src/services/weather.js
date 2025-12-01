const logger = require('./logger');

const WEATHER_API_KEY = process.env.WEATHER_API_KEY;
const WEATHER_API_BASE_URL = process.env.WEATHER_API_BASE_URL || 'https://api.openweathermap.org/data/2.5';

// In-memory bookmarks storage (use database in production)
const userBookmarks = new Map();

/**
 * Get current weather for a location
 */
async function getCurrentWeather({ lat, lon, city }) {
  if (!WEATHER_API_KEY) {
    throw createError(503, 'Weather API not configured');
  }

  let url;
  if (lat && lon) {
    url = `${WEATHER_API_BASE_URL}/weather?lat=${lat}&lon=${lon}&appid=${WEATHER_API_KEY}&units=imperial`;
  } else if (city) {
    url = `${WEATHER_API_BASE_URL}/weather?q=${encodeURIComponent(city)}&appid=${WEATHER_API_KEY}&units=imperial`;
  } else {
    throw createError(400, 'Location required');
  }

  try {
    const response = await fetch(url);
    const data = await response.json();

    if (!response.ok) {
      throw createError(response.status, data.message || 'Weather API error');
    }

    return formatCurrentWeather(data);
  } catch (err) {
    logger.error('Weather API error:', err);
    throw err.status ? err : createError(500, 'Failed to fetch weather data');
  }
}

/**
 * Get weather forecast
 */
async function getForecast({ lat, lon, city, days = 5 }) {
  if (!WEATHER_API_KEY) {
    throw createError(503, 'Weather API not configured');
  }

  let url;
  if (lat && lon) {
    url = `${WEATHER_API_BASE_URL}/forecast?lat=${lat}&lon=${lon}&appid=${WEATHER_API_KEY}&units=imperial&cnt=${days * 8}`;
  } else if (city) {
    url = `${WEATHER_API_BASE_URL}/forecast?q=${encodeURIComponent(city)}&appid=${WEATHER_API_KEY}&units=imperial&cnt=${days * 8}`;
  } else {
    throw createError(400, 'Location required');
  }

  try {
    const response = await fetch(url);
    const data = await response.json();

    if (!response.ok) {
      throw createError(response.status, data.message || 'Weather API error');
    }

    return formatForecast(data);
  } catch (err) {
    logger.error('Forecast API error:', err);
    throw err.status ? err : createError(500, 'Failed to fetch forecast data');
  }
}

/**
 * Get weather alerts (using One Call API if available)
 */
async function getAlerts({ lat: _lat, lon: _lon }) {
  if (!WEATHER_API_KEY) {
    throw createError(503, 'Weather API not configured');
  }

  // Note: Alerts require OpenWeatherMap One Call API 3.0 subscription
  // For demo purposes, return empty alerts
  return {
    alerts: [],
    message: 'Weather alerts require One Call API subscription'
  };
}

/**
 * Format current weather response
 */
function formatCurrentWeather(data) {
  return {
    location: {
      name: data.name,
      country: data.sys?.country,
      lat: data.coord?.lat,
      lon: data.coord?.lon
    },
    current: {
      temp: Math.round(data.main?.temp),
      feelsLike: Math.round(data.main?.feels_like),
      humidity: data.main?.humidity,
      pressure: data.main?.pressure,
      windSpeed: Math.round(data.wind?.speed),
      windDirection: data.wind?.deg,
      visibility: data.visibility ? Math.round(data.visibility / 1609.34) : null, // Convert to miles
      clouds: data.clouds?.all,
      description: data.weather?.[0]?.description,
      icon: data.weather?.[0]?.icon,
      main: data.weather?.[0]?.main
    },
    sun: {
      sunrise: data.sys?.sunrise ? new Date(data.sys.sunrise * 1000).toISOString() : null,
      sunset: data.sys?.sunset ? new Date(data.sys.sunset * 1000).toISOString() : null
    },
    timestamp: new Date().toISOString()
  };
}

/**
 * Format forecast response
 */
function formatForecast(data) {
  const dailyForecasts = new Map();

  data.list?.forEach(item => {
    const date = new Date(item.dt * 1000).toDateString();
    
    if (!dailyForecasts.has(date)) {
      dailyForecasts.set(date, {
        date: new Date(item.dt * 1000).toISOString().split('T')[0],
        temps: [],
        conditions: [],
        humidity: [],
        wind: []
      });
    }

    const day = dailyForecasts.get(date);
    day.temps.push(item.main?.temp);
    day.conditions.push(item.weather?.[0]);
    day.humidity.push(item.main?.humidity);
    day.wind.push(item.wind?.speed);
  });

  const forecast = Array.from(dailyForecasts.values()).map(day => ({
    date: day.date,
    tempHigh: Math.round(Math.max(...day.temps)),
    tempLow: Math.round(Math.min(...day.temps)),
    humidity: Math.round(day.humidity.reduce((a, b) => a + b, 0) / day.humidity.length),
    windSpeed: Math.round(day.wind.reduce((a, b) => a + b, 0) / day.wind.length),
    condition: getMostCommonCondition(day.conditions),
    icon: day.conditions[Math.floor(day.conditions.length / 2)]?.icon
  }));

  return {
    location: {
      name: data.city?.name,
      country: data.city?.country,
      lat: data.city?.coord?.lat,
      lon: data.city?.coord?.lon
    },
    forecast,
    timestamp: new Date().toISOString()
  };
}

/**
 * Get most common weather condition from array
 */
function getMostCommonCondition(conditions) {
  const counts = {};
  conditions.forEach(c => {
    if (c?.main) {
      counts[c.main] = (counts[c.main] || 0) + 1;
    }
  });
  
  let maxCount = 0;
  let mostCommon = null;
  
  Object.entries(counts).forEach(([condition, count]) => {
    if (count > maxCount) {
      maxCount = count;
      mostCommon = condition;
    }
  });
  
  return mostCommon;
}

/**
 * Add a location bookmark for a user
 */
function addBookmark(userId, bookmark) {
  if (!userBookmarks.has(userId)) {
    userBookmarks.set(userId, []);
  }

  const bookmarks = userBookmarks.get(userId);
  
  // Check for duplicate
  const exists = bookmarks.some(b => 
    (b.lat === bookmark.lat && b.lon === bookmark.lon) ||
    (b.city && b.city.toLowerCase() === bookmark.city?.toLowerCase())
  );

  if (exists) {
    throw new Error('Bookmark already exists');
  }

  // Limit bookmarks per user
  if (bookmarks.length >= 10) {
    throw new Error('Maximum bookmarks limit reached (10)');
  }

  const newBookmark = {
    id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
    ...bookmark,
    createdAt: new Date().toISOString()
  };

  bookmarks.push(newBookmark);
  return newBookmark;
}

/**
 * Get bookmarks for a user
 */
function getBookmarks(userId) {
  return userBookmarks.get(userId) || [];
}

/**
 * Delete a bookmark
 */
function deleteBookmark(userId, bookmarkId) {
  const bookmarks = userBookmarks.get(userId);
  if (!bookmarks) return false;

  const index = bookmarks.findIndex(b => b.id === bookmarkId);
  if (index === -1) return false;

  bookmarks.splice(index, 1);
  return true;
}

/**
 * Geolocate by IP (placeholder - would use real IP geolocation service)
 */
async function geolocateByIP(_ip) {
  // In production, use a real IP geolocation service
  // For demo, return a default location
  return {
    lat: 38.9072,
    lon: -77.0369,
    city: 'Washington',
    country: 'US',
    message: 'Default location (IP geolocation requires external service)'
  };
}

/**
 * Create an error with status code
 */
function createError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

module.exports = {
  getCurrentWeather,
  getForecast,
  getAlerts,
  addBookmark,
  getBookmarks,
  deleteBookmark,
  geolocateByIP
};
