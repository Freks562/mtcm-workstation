const axios = require('axios');
const config = require('../config');
const cache = require('./cache');

const BASE_URL = 'https://api.openweathermap.org/data/2.5';

/**
 * Build query params for OpenWeatherMap API
 * @param {object} params - Query parameters
 * @returns {object} - Complete params with API key
 */
function buildParams(params) {
  return {
    ...params,
    appid: config.openWeatherApiKey
  };
}

/**
 * Generate cache key from query params
 * @param {string} type - 'weather' or 'forecast'
 * @param {object} params - Query parameters
 * @returns {string}
 */
function getCacheKey(type, params) {
  const { city, lat, lon, units } = params;
  if (city) {
    return `${type}:city:${city}:${units}`;
  }
  return `${type}:coords:${lat},${lon}:${units}`;
}

/**
 * Get current weather data
 * @param {object} params - { city?, lat?, lon?, units? }
 * @returns {Promise<object>}
 */
async function getCurrentWeather(params) {
  const { city, lat, lon, units = config.weatherDefaults.units } = params;
  
  const cacheKey = getCacheKey('weather', { city, lat, lon, units });
  const cached = cache.get(cacheKey);
  if (cached) return cached;
  
  const queryParams = { units };
  if (city) {
    queryParams.q = city;
  } else if (lat !== undefined && lon !== undefined) {
    queryParams.lat = lat;
    queryParams.lon = lon;
  } else {
    throw new Error('Either city or lat/lon coordinates are required');
  }
  
  const response = await axios.get(`${BASE_URL}/weather`, {
    params: buildParams(queryParams)
  });
  
  const data = response.data;
  cache.set(cacheKey, data);
  return data;
}

/**
 * Get 5-day forecast data and aggregate to daily
 * @param {object} params - { city?, lat?, lon?, units? }
 * @returns {Promise<object>}
 */
async function getForecast(params) {
  const { city, lat, lon, units = config.weatherDefaults.units } = params;
  
  const cacheKey = getCacheKey('forecast', { city, lat, lon, units });
  const cached = cache.get(cacheKey);
  if (cached) return cached;
  
  const queryParams = { units };
  if (city) {
    queryParams.q = city;
  } else if (lat !== undefined && lon !== undefined) {
    queryParams.lat = lat;
    queryParams.lon = lon;
  } else {
    throw new Error('Either city or lat/lon coordinates are required');
  }
  
  const response = await axios.get(`${BASE_URL}/forecast`, {
    params: buildParams(queryParams)
  });
  
  // Aggregate 3-hour data to daily
  const aggregated = aggregateForecastData(response.data);
  cache.set(cacheKey, aggregated);
  return aggregated;
}

/**
 * Aggregate 3-hour forecast data to daily summaries
 * @param {object} rawData - Raw OpenWeatherMap forecast response
 * @returns {object}
 */
function aggregateForecastData(rawData) {
  const dailyData = {};
  
  for (const item of rawData.list) {
    const date = item.dt_txt.split(' ')[0];
    
    if (!dailyData[date]) {
      dailyData[date] = {
        date,
        temps: [],
        clouds: [],
        rain: 0,
        snow: 0,
        weather: [],
        icon: null
      };
    }
    
    dailyData[date].temps.push(item.main.temp);
    dailyData[date].clouds.push(item.clouds.all);
    dailyData[date].rain += item.rain?.['3h'] || 0;
    dailyData[date].snow += item.snow?.['3h'] || 0;
    dailyData[date].weather.push(item.weather[0]);
    
    // Use noon weather icon if available, otherwise first
    const hour = parseInt(item.dt_txt.split(' ')[1].split(':')[0], 10);
    if (hour === 12 || !dailyData[date].icon) {
      dailyData[date].icon = item.weather[0].icon;
      dailyData[date].description = item.weather[0].description;
    }
  }
  
  // Calculate aggregates
  const days = Object.values(dailyData).map(day => ({
    date: day.date,
    temp_min: Math.min(...day.temps),
    temp_max: Math.max(...day.temps),
    precip_mm: Math.round((day.rain + day.snow) * 10) / 10,
    clouds_avg: Math.round(day.clouds.reduce((a, b) => a + b, 0) / day.clouds.length),
    icon: day.icon,
    description: day.description
  }));
  
  return {
    city: rawData.city,
    days: days.slice(0, 5) // Ensure we only return 5 days
  };
}

module.exports = { getCurrentWeather, getForecast };
